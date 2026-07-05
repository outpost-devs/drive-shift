# Drive-Shift
## Product Requirements Document — Version 1.0

**Status:** Draft for build
**Owner:** Allen
**Doc type:** Full PRD + Engineering Spec + Design System

---

## Table of Contents

1. Executive Summary
2. Problem Statement
3. Goals, Non-Goals & Scope
4. User Stories
5. Tech Stack
6. System Architecture
7. Authentication & OAuth Flow
8. Database Schema
9. Backend Architecture
10. The Transfer Engine
11. Google Drive API Reference
12. **Design System** (Brand, Color, Type, Spacing, Motion, Components)
13. **Page-by-Page Design Specification**
14. Real-Time Progress System
15. Security Model
16. Error Handling & Rate Limiting
17. REST API Reference
18. Environment Variables
19. Deployment Plan
20. Testing Strategy
21. Glossary

---

## 1. Executive Summary

Drive-Shift is a web application that moves files and folders directly between two Google Drive accounts, server-to-server, without ever routing the data through the user's device or through Drive-Shift's own backend disk. It solves a simple, common problem: a Google Drive account that's run out of space, sitting quietly under an inbox that can no longer sync, while its owner has no fast way to shift that weight to a second, emptier account short of downloading everything and uploading it again.

The product is built to feel like it could ship from Google itself — restrained, fast, quietly confident, and unmistakably at home next to Drive, Docs, and Gmail. Every visual decision in this document is written to that standard.

---

## 2. Problem Statement

### The trigger

A Google Drive account fills up. Once it does, the knock-on effects aren't just "no more storage" — Gmail, which shares the same storage pool, starts failing to receive new mail. The account effectively goes quiet from the outside, and the person often doesn't notice until something important bounces.

### The current workaround, and why it's bad

The standard fix is: download everything from the full account to a local machine, then re-upload it to a second account with room to spare. For any non-trivial amount of data this means:

- Hours of local bandwidth spent twice — once down, once up
- Enough free local disk space to hold a full copy in transit
- A process that has to restart from zero if the connection drops partway through
- The person's own laptop sitting there as the bottleneck for a problem that has nothing to do with their laptop

### The insight the product is built on

The two Drive accounts already live inside the same infrastructure — Google's. There's no reason the data should ever leave that infrastructure to move between them. The three-step mental model that inspired this product is simple: **access → copy → delete**. Grant temporary access to the file, copy it directly server-to-server, then optionally remove the original — freeing space in the source account while the data safely exists in the target account the whole time.

Drive-Shift is that three-step idea, built out into a real, secure, resilient product.

---

## 3. Goals, Non-Goals & Scope

### Goals (v1)

- Transfer files and folders — including deeply nested folder trees — between two personal Google Drive accounts.
- Zero infrastructure cost to build, host, and run at small scale (up to 100 authorized users).
- Resilient to crashes, dropped connections, and Google API rate limits — a transfer should never silently corrupt or vanish.
- Give the user honest, real-time visibility into what's happening, what failed, and a one-click way to retry only what failed.
- A visual and interaction quality that would not look out of place inside Google's own product suite.

### Non-Goals (v1)

- **Shared Drives (Team Drives)** — different ownership model, explicitly out of scope.
- **Files needing chunked/resumable upload beyond what a native `files.copy` call supports** — surfaced as a clear failure, not silently broken.
- **More than 100 total users** — the app stays in Google's OAuth "Testing" publishing mode; going beyond 100 users is a deliberate future decision requiring a paid Google security assessment.
- **Automatic permanent deletion after a Move** — v1 only moves originals to Trash; the user manages their own Drive trash.
- **Teams, billing, multi-tenant admin surfaces** — this is a personal utility, not a SaaS platform with organizations.

---

## 4. User Stories

- *"My personal Drive is full and Gmail stopped receiving mail. I have a second, empty Google account. I want to move my old project folders over without downloading 40GB to my laptop first."*
- *"I want to choose whether the originals stay behind (Copy) or get cleared out to free up space (Move) — and I want that choice to be obvious and hard to get wrong."*
- *"If my Wi-Fi drops halfway through a 2,000-file transfer, I don't want to start over from file one."*
- *"I want to see, file by file, what's happening — not just a spinner."*

---

## 5. Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | Next.js (React, App Router) | Free |
| Styling | Tailwind CSS | Free |
| Motion | Framer Motion | Free |
| Backend | Java Spring Boot 3 | Free |
| Database | PostgreSQL via Supabase free tier | Free |
| ORM | Spring Data JPA / Hibernate | Free |
| Scheduling | Spring `@Scheduled` | Free |
| Containerization | Docker | Free |
| Backend hosting | Render.com free Web Service | Free |
| Frontend hosting | Vercel Hobby tier | Free |
| CI/CD | GitHub Actions | Free |
| Auth | Google OAuth 2.0 (Authorization Code flow) | Free |
| Token key storage | Render environment variables | Free |
| Optional email | Resend.com free tier / Gmail SMTP | Free |

**Total monthly infrastructure cost: $0**, provided usage stays within free-tier limits and the OAuth app stays in Testing mode (≤100 users).

---

## 6. System Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│                  │  HTTPS  │                      │  HTTPS  │  Google Drive   │
│  Next.js Client  │◄───────►│  Spring Boot Backend │◄───────►│  API (Source &  │
│  (Vercel)        │  + SSE  │  (Render.com)         │         │  Target accts)  │
│                  │         │                      │         │                 │
└─────────────────┘         └──────────┬───────────┘         └─────────────────┘
                                        │
                                        ▼
                              ┌───────────────────┐
                              │   PostgreSQL       │
                              │   (Supabase)       │
                              │  - users            │
                              │  - oauth_tokens      │
                              │  - transfer_jobs      │
                              │  - transfer_job_items │
                              └───────────────────┘
```

**Core principle:** the backend never touches file bytes. It only ever exchanges small JSON metadata payloads with Google's API — every byte of actual file content moves entirely within Google's own infrastructure.

### Two Independent Identities Per Job

Every job involves two separate OAuth connections:
- **Source token** — authorizes actions on the account files come *from* (grant/revoke permission, trash originals).
- **Target token** — authorizes actions on the account files go *to* (execute the copy, create folders).

---

## 7. Authentication & OAuth Flow

### 7.1 Base App Login

1. User clicks "Continue with Google" on the landing page.
2. Backend redirects to Google's consent screen with `client_id`, `redirect_uri`, `scope=openid email profile`, a server-generated `state` (CSRF protection), and `prompt=consent`.
3. Google authenticates the user (2FA/Passkey handled entirely by Google's own UI).
4. Google redirects back with an authorization `code` and the original `state`.
5. Backend verifies `state` matches — rejects the request otherwise.
6. Backend exchanges `code` for tokens, creates/finds the `users` row, issues an HttpOnly/Secure/SameSite=Lax session cookie, redirects to `/dashboard`.

### 7.2 Connecting Source and Target Drive Accounts

- Independently, from the dashboard, the user clicks "Connect Source Account" and "Connect Target Account" — each triggers the same OAuth flow, this time requesting the `drive` scope.
- Each connection is stored as its own `oauth_tokens` row (`account_type = source` or `target`), encrypted before storage.
- These can be reconnected or swapped at any time without redoing the base login.

### 7.3 Token Refresh

- Access tokens expire (~1 hour); the backend refreshes them silently using the stored refresh token before any Drive API call, transparent to the user.

### 7.4 Known Platform Behavior: 7-Day Refresh Token Expiry

Because the app stays in Google's "Testing" publishing status (to avoid the paid CASA security assessment), **Google automatically expires refresh tokens for External Testing-mode apps after 7 days**, regardless of usage. This is documented Google behavior, not a bug to engineer around.

- **Impact:** roughly weekly, a connected account's refresh token stops working; the next Drive call fails with `invalid_grant`.
- **Handling:** the backend catches this specific error, marks the `oauth_tokens` row as needing re-auth, and shows "Please reconnect your Source/Target account" — a one-click fix, same as the original connection.
- **Why this is fine:** Drive-Shift is used for occasional bulk transfers, not continuous syncing — a user doing a one-off job will simply never encounter this.

### 7.5 The Swap Control

Clicking the swap button in the dashboard header flips which connected account displays as Source vs Target — it creates no new tokens, just repoints the UI — and **clears the current in-progress file selection** to prevent transferring against the wrong account context.

---

## 8. Database Schema

```sql
CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login          TIMESTAMPTZ,
    last_transfer_date  TIMESTAMPTZ
);

CREATE TABLE oauth_tokens (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_type                VARCHAR(10) NOT NULL CHECK (account_type IN ('source', 'target')),
    google_email                VARCHAR(255) NOT NULL,
    encrypted_access_token      TEXT NOT NULL,
    encrypted_refresh_token     TEXT NOT NULL,
    expires_at                  TIMESTAMPTZ NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, account_type)
);

CREATE TABLE transfer_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              VARCHAR(25) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','running','paused','completed',
                                           'completed_with_errors','failed','cancelled')),
    transfer_mode       VARCHAR(4) NOT NULL CHECK (transfer_mode IN ('COPY','MOVE')),
    total_files         INTEGER NOT NULL DEFAULT 0,
    total_folders       INTEGER NOT NULL DEFAULT 0,
    files_completed     INTEGER NOT NULL DEFAULT 0,
    files_failed        INTEGER NOT NULL DEFAULT 0,
    folders_created     INTEGER NOT NULL DEFAULT 0,
    conflict_policy     VARCHAR(10) NOT NULL DEFAULT 'rename'
                        CHECK (conflict_policy IN ('skip','rename','overwrite')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transfer_job_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id              UUID NOT NULL REFERENCES transfer_jobs(id) ON DELETE CASCADE,
    item_type           VARCHAR(6) NOT NULL CHECK (item_type IN ('file','folder')),
    source_id           VARCHAR(100) NOT NULL,
    target_id           VARCHAR(100),
    source_parent_id    VARCHAR(100),
    target_parent_id    VARCHAR(100),
    name                VARCHAR(500) NOT NULL,
    mime_type           VARCHAR(150),
    size_bytes          BIGINT DEFAULT 0,
    status              VARCHAR(25) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','permission_granted','copied','verified',
                                           'permission_revoked','trashed','completed',
                                           'failed','permanently_failed')),
    permission_id       VARCHAR(100),
    retry_count         INTEGER NOT NULL DEFAULT 0,
    last_error          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_items_job_id ON transfer_job_items(job_id);
CREATE INDEX idx_job_items_status ON transfer_job_items(status);
CREATE INDEX idx_job_items_reconciliation
    ON transfer_job_items(status, updated_at)
    WHERE status = 'copied';
CREATE INDEX idx_tokens_user_type ON oauth_tokens(user_id, account_type);
```

`transfer_job_items` is the real unit of work — one row per file or folder — which is what makes per-item retry, safe pause/resume, and crash recovery possible. `size_bytes = 0` is normal for native Google Workspace files (Docs/Sheets/Slides), which don't count against storage quota.

---

## 9. Backend Architecture

```
com.driveshift
├── config          -- Security, OAuth client registration, scheduling
├── controller       -- Auth, Drive browsing, Transfer jobs, SSE
├── service
│   ├── OAuthTokenService        -- encryption/decryption, refresh, 7-day-expiry handling
│   ├── DriveTreeService          -- recursive folder tree-walk
│   ├── TransferEngineService     -- the per-file lifecycle
│   ├── ReconciliationService     -- scheduled sweep for orphaned permissions
│   ├── QuotaService              -- quota math with Workspace-file exclusion
│   └── RateLimiterService        -- bounded concurrency + backoff
├── repository       -- Spring Data JPA repositories
├── entity           -- JPA entities matching the schema exactly
├── dto              -- request/response payloads
└── security          -- AES-256 util, OAuth state store
```

Every unit of transfer work is a database row, not an in-memory object. Worker threads claim `pending` items from `transfer_job_items` via `SELECT ... FOR UPDATE SKIP LOCKED`, so a server restart (expected on Render's free tier after idle spin-down) never loses in-progress job state — workers simply resume by querying for unfinished rows on startup.

---

## 10. The Transfer Engine

### 10.1 Step 1 — Build the Tree

On the final "Copy/Move" click, the backend recursively lists the selected Source folders (`drive.files.list`, paginated), builds an in-memory tree, then flattens it into `transfer_job_items` rows — **folders first, in top-down order**, then files, each tagged with its parent folder.

> **Why folders can't be copied directly:** Google's `drive.files.copy` endpoint does not support folder mimeTypes — it works on files only. Folder structure must be recreated by explicitly creating new folders in the target and mapping each source folder ID to its new target folder ID, which every file/subfolder underneath then references as its parent.

### 10.2 Step 2 — Folder Creation

For each folder row, in top-down order: Target token calls `drive.files.create` (folder mimeType), parented to the already-created corresponding target folder. The returned ID becomes this row's `target_id` and is what every child item below it uses as its `target_parent_id`.

### 10.3 Step 3 — Per-File Lifecycle

A bounded pool of **5 concurrent workers** processes files:

1. **Permission Injection** — Source token grants Target account `reader` access (`drive.permissions.create`). Status → `permission_granted`.
2. **Server-Side Duplication** — Target token copies the file (`drive.files.copy`) into the mapped target folder. Status → `copied`.
3. **Integrity Verification (mandatory gate)** — Compare source vs. copied file size and checksum. **No source file is ever touched until this passes.** Status → `verified`.
4. **Permission Cleanup** — Source token revokes the temporary grant (`drive.permissions.delete`), regardless of Copy/Move mode. Status → `permission_revoked`.
5. **Source Handling (Move only)** — Source token trashes the original (`trashed: true`) — **never a hard delete in v1**. Status → `trashed` → `completed`.

Any failure at any step retries up to 3 times before the item is marked `permanently_failed` and surfaced distinctly to the user.

### 10.4 Idle Polling Backoff (mandatory)

Workers must not poll the database on a fixed tight interval regardless of whether work exists. When idle, back off: 5s, then 10s, then 20s, capping at 60s — resetting instantly when new work appears. Without this, 5 workers polling every 100ms during idle hours generates roughly 180,000 unnecessary queries per hour, burning through Supabase's free-tier compute budget for zero actual work.

### 10.5 Quota Math

Native Google Workspace files (Docs, Sheets, Slides, Forms, Drawings — `mimeType` prefixed `application/vnd.google-apps.`) do not count against Drive storage quota. Both the live client-side estimate and the authoritative server-side pre-flight check must exclude them from the byte total.

### 10.6 Move Mode Is Trash-First, Never Instant-Delete

v1 only ever sets `trashed: true` — never calls `drive.files.delete`. This means a bug in verification, or user regret, is always recoverable from the Source account's own 30-day Google Drive trash.

### 10.7 Reconciliation Sweep

A scheduled task (every 5 minutes) finds `transfer_job_items` stuck at `copied` for over 10 minutes — meaning a crash likely interrupted verification/revoke — and re-attempts both, closing the security gap where a Target account could otherwise retain standing access to a Source file indefinitely.

### 10.8 Rate Limiting & Backoff

Every outgoing Drive API call is wrapped with exponential backoff (500ms → doubling → 30s cap, max 6 attempts) on `403`/`5xx` responses. Sustained rate-limit pressure automatically reduces a job's worker concurrency before scaling back up.

---

## 11. Google Drive API Reference

| Purpose | API Method | Token Used |
|---|---|---|
| List files/folders | `drive.files.list` | Source |
| Get file metadata (verification) | `drive.files.get` | Source & Target |
| Grant temporary read access | `drive.permissions.create` | Source |
| Copy a file | `drive.files.copy` | Target |
| Create a folder | `drive.files.create` | Target |
| Revoke temporary access | `drive.permissions.delete` | Source |
| Trash the original (Move mode) | `drive.files.update` | Source |
| Check Target storage quota | `about.get` | Target |

**Scopes:** `openid email profile` for base login (unrestricted); `https://www.googleapis.com/auth/drive` for Source/Target connections (restricted — accepted via Testing mode, see Section 15.1).

---

## 12. Design System

> **Design direction:** Drive-Shift should look and feel like it shipped from Google itself — a native member of the Drive / Docs / Meet family, not a third-party tool that merely borrows Google's blue. Every token below is chosen to sit comfortably next to Google Workspace's actual visual language: Material Design 3, restrained motion, generous whitespace, and typography that never shouts.

### 12.1 Brand Tokens

**Color palette:**

| Token | Hex | Usage |
|---|---|---|
| `--gs-blue-600` (primary) | `#1A73E8` | Primary buttons, active states, links, the Transfer Mode toggle's active pill |
| `--gs-blue-700` (primary hover) | `#1557B0` | Hover/pressed state of primary actions |
| `--gs-blue-50` (primary tint) | `#E8F0FE` | Selected-row backgrounds, subtle highlight fields, quota bar fill background |
| `--gs-green-600` (success) | `#188038` | Completed states, success toasts, "verified" checkmarks |
| `--gs-red-600` (destructive/error) | `#D93025` | Move-mode confirmation accents, failed items, delete-adjacent actions |
| `--gs-yellow-600` (warning) | `#F29900` | Quota-nearing-limit warnings, retry-needed badges |
| `--gs-neutral-900` (ink) | `#202124` | Primary text |
| `--gs-neutral-600` (secondary ink) | `#5F6368` | Secondary text, captions, breadcrumbs |
| `--gs-neutral-300` (border) | `#DADCE0` | Dividers, input borders, card outlines |
| `--gs-neutral-100` (surface) | `#F1F3F4` | Page background, inactive pill background |
| `--gs-white` (elevated surface) | `#FFFFFF` | Cards, modals, the split-pane panels |

This is not an invented palette — it is Google's own Material Design product color system (the same blue used across Drive, Docs, and the Google account switcher), chosen deliberately so the product reads as authentically Google-adjacent rather than "inspired by."

**Typography:**

| Role | Typeface | Weight | Size / Line-height | Usage |
|---|---|---|---|---|
| Display (Hero headline) | **Google Sans** (fallback: `"Product Sans", "Google Sans", Roboto, sans-serif`) | 500 (Medium) | 48px / 56px desktop, 32px / 40px mobile | Landing page hero headline only |
| Heading | Google Sans | 500 | 22px / 28px | Section headers, modal titles, workspace pane titles |
| Body | **Roboto** | 400 | 14px / 20px | All body copy, list items, form labels |
| Body — emphasis | Roboto | 500 | 14px / 20px | File names, selected counts, key numbers |
| Caption / metadata | Roboto | 400 | 12px / 16px | Timestamps, byte sizes, breadcrumbs, helper text |
| Numeric / data (progress %, byte counts) | **Roboto Mono** | 400 | 13px / 18px | Progress bar percentage, quota figures — a monospace tabular treatment gives numbers a stable, "product engineering" feel as they update live, avoiding visual jitter as digit widths change |

Google Sans is reserved for moments that need presence (hero, section headers, modal titles) — everywhere else defaults to Roboto, exactly matching how Google's own products allocate the two typefaces. This restraint is itself the signature: nothing in the interface shouts, because nothing in a genuinely Google-built product shouts.

**Spacing scale (8px base grid, matching Material Design 3):**

`4px · 8px · 12px · 16px · 24px · 32px · 48px · 64px · 96px`

All padding, margins, and gaps are drawn from this scale — no arbitrary values. The split-pane workspace uses 24px internal padding, 16px gaps between list rows, 8px between a row's icon and its label.

**Elevation (shadow) system — Material Design 3 tiers:**

| Level | Shadow | Usage |
|---|---|---|
| 0 | none | Page background, inline content |
| 1 | `0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)` | List rows on hover, the sticky footer |
| 2 | `0 1px 2px rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)` | Cards, the Split-Pane panels themselves |
| 3 | `0 4px 8px 3px rgba(60,64,67,0.15), 0 1px 3px rgba(60,64,67,0.3)` | The Floating Action Bar, FAB button |
| 4 | `0 6px 10px 4px rgba(60,64,67,0.15), 0 2px 3px rgba(60,64,67,0.3)` | The Active Transfer modal, Move confirmation dialog |

**Corner radius:**

- 4px — input fields, small chips
- 8px — list rows, buttons
- 12px — cards, panels
- 16px — modals
- 999px (full pill) — the Copy/Move segmented toggle, status badges

**Iconography:** Google's own **Material Symbols** (outlined weight, 24px grid, optically balanced stroke) — the same icon family used across Drive, Gmail, and Calendar. Specific icons used: `folder`, `description` (generic file), `image`, `movie`, `swap_horiz` (the swap control), `check_circle` (verified/complete), `error` (failed), `pause_circle`, `cancel`, `add_circle` (new folder FAB), `cloud_sync` (in-progress transfer).

### 12.2 Motion Principles

Motion in the product exists to explain state changes, never to decorate. Three deliberate moments:

1. **Page-load stagger on the Landing page** — the hero headline, subheadline, and CTA fade-and-rise in sequence (80ms stagger), a single orchestrated entrance rather than scattered effects elsewhere on the page.
2. **The progress bar itself** — a continuous, physically-eased fill (Framer Motion spring, not a linear CSS transition) that never jumps a percentage instantly; it visibly travels from its old value to its new one over ~400ms whenever an SSE update arrives, so the number reads as alive rather than snapping.
3. **Modal entrance/exit** — the Active Transfer overlay and Move confirmation dialog scale in from 96% to 100% opacity+scale over 200ms with a slight ease-out, matching Google's own Material dialog motion spec, and the background blurs from 0 to 8px over the same duration.

Everything else — hover states on buttons, checkbox toggles, list row selection — uses an instant or near-instant (100ms) transition. This restraint is intentional: a billion-dollar Google product does not animate everything, it animates the three moments that need explaining and leaves the rest crisp and immediate.

### 12.3 Component Specifications

**Primary Button**
- Background `--gs-blue-600`, text white, Roboto Medium 14px, 8px corner radius, 10px vertical / 24px horizontal padding.
- Hover: background darkens to `--gs-blue-700`, elevation rises from 0 to level 1.
- Disabled: background `--gs-neutral-300`, text `--gs-neutral-600`, no shadow, cursor not-allowed.

**Segmented Toggle (Copy / Move)**
- Full-pill container, `--gs-neutral-100` background, 4px internal padding.
- Active segment: white background, `--gs-blue-600` text, level-1 shadow, pill-shaped.
- Inactive segment: transparent, `--gs-neutral-600` text.
- Transition on toggle: the active-segment background slides (Framer Motion `layoutId`) rather than cross-fading, so it visibly travels from one option to the other — reinforcing that this is a single choice being relocated, not two independent buttons.

**List Row (Source/Target file browser)**
- 48px height, 16px horizontal padding, Material Symbols file-type icon (20px) + 8px gap + filename (Roboto 14px, `--gs-neutral-900`) + right-aligned metadata (size, Roboto Mono 12px, `--gs-neutral-600`).
- Checkbox: Material Design checkbox, `--gs-blue-600` when checked.
- Hover: `--gs-neutral-100` background, elevation level 1.
- Selected: `--gs-blue-50` background.

**Quota Bar**
- 8px height, full rounded pill, `--gs-neutral-100` track.
- Fill: `--gs-blue-600` under 80% capacity, `--gs-yellow-600` between 80–95%, `--gs-red-600` above 95% — the color itself communicates urgency without needing separate copy.

**Modal (Move Confirmation / Active Transfer)**
- White surface, 16px corner radius, elevation level 4, max-width 480px, centered.
- 32px internal padding, 16px gap between title/body/actions.
- Title: Google Sans Medium 22px. Body: Roboto 14px, `--gs-neutral-600`.

**Toast (completion / error notices)**
- Bottom-center, `--gs-neutral-900` background, white text, 8px corner radius, level-2 shadow, auto-dismiss after 5s unless it contains an action button (e.g., "Retry failed").

### 12.4 Responsive Behavior

- **Desktop (≥1024px):** full split-pane layout, both Source and Target panes visible side by side.
- **Tablet (768–1023px):** split-pane collapses to a single active pane with a segmented top switcher ("Source" / "Target") — the swap button becomes this switcher's function.
- **Mobile (<768px):** fully stacked, single-column flow: pick source files → pick destination → confirm, as a linear 3-step wizard rather than a split-pane, since two side-by-side panes cannot work at that width. The Floating Action Bar remains fixed to the bottom across all breakpoints.

---

## 13. Page-by-Page Design Specification

### Page 1 — Landing Page (`/`)

**Layout (desktop), top to bottom:**

```
┌──────────────────────────────────────────────────────────┐
│  [Drive-Shift logo/wordmark]              [Sign in link] │
├──────────────────────────────────────────────────────────┤
│                                                            │
│           Move files between Drives.                     │
│           Not through your laptop.                       │
│                                                            │
│   Server-to-server transfers at Google's own speed.       │
│   Zero bytes touch your device or ours.                   │
│                                                            │
│          [ Continue with Google ]                         │
│                                                            │
│        (small caption: "Works with any two Google         │
│         accounts you control.")                            │
│                                                            │
├──────────────────────────────────────────────────────────┤
│   [ Three short supporting panels, Material cards ]        │
│   1) Access   2) Copy   3) Free up space                   │
└──────────────────────────────────────────────────────────┘
```

**Exact specs:**
- Background `--gs-white`. Top nav bar: 64px height, `--gs-neutral-300` bottom border (1px), logo left-aligned at 24px from edge, "Sign in" text link right-aligned (Roboto Medium 14px, `--gs-blue-600`).
- Hero section: centered, max-width 720px, vertically centered in a viewport-height-minus-nav block. Headline in Google Sans Medium 48px / 56px, `--gs-neutral-900`, two lines exactly as shown (the line break itself is intentional — it reads as a statement, then its qualifier). Subheadline directly below at 16px Roboto Regular, `--gs-neutral-600`, max-width 480px, centered.
- Primary CTA button 24px below subheadline: the Primary Button spec from 12.3, but sized up slightly for hero prominence — 12px vertical / 32px horizontal padding, 16px text.
- Caption below CTA: 12px, `--gs-neutral-600`, 8px top margin.
- **Page-load animation:** headline, subheadline, and CTA each fade up 12px into place with an 80ms stagger between them (per Section 12.2) — the single orchestrated motion moment on this page.
- Three supporting cards below the fold: each a Material card (level-2 elevation, 12px radius, 24px padding, white surface), laid out in a 3-column grid on desktop (stacking to 1 column on mobile), each labeled with a Material Symbols icon + short heading + one sentence, mirroring the access → copy → free-up-space mental model the product is built on — this is the one place a numbered/sequential structure is genuinely justified, since it names three ordered technical steps that actually happen in that order.

### Page 2 — Main Workspace (`/dashboard`)

**Layout (desktop):**

```
┌──────────────────────────────────────────────────────────────────────┐
│  [source@gmail.com ▾]     ( Copy Files | Move Files )   [target@... ▾]│  ← Global header
├───────────────────────────┬──┬───────────────────────────────────────┤
│  SOURCE                    │⇄ │  TARGET                                │
│  breadcrumb / breadcrumb   │  │  breadcrumb / breadcrumb                │
│  ☐ 📁 Photos      1.2 GB   │  │  Quota: [██████░░░░] 62% used           │
│  ☐ 📁 Projects    4.8 GB   │  │  ☐ 📁 Backup                            │
│  ☐ 📄 resume.pdf  240 KB   │  │  📁 New Folder [+]                      │
│  ...                       │  │  ...                                    │
│                            │  │                                         │
│  ─────────────────────────  │  │                                         │
│  3 items selected · 6.0 GB  │  │                                         │
├───────────────────────────┴──┴───────────────────────────────────────┤
│                    Copy 6.0 GB to target@gmail.com   [ → ]             │  ← Floating Action Bar
└──────────────────────────────────────────────────────────────────────┘
```

**Exact specs:**

- **Global header:** 72px height, `--gs-white` background, level-1 elevation (a subtle shadow separating it from the panes below, since it stays fixed on scroll). Account email chips on either end (Roboto Medium 14px, small Google-account-style circular avatar placeholder + email + dropdown chevron for reconnect/switch). Center: the Segmented Toggle component (12.3) for Copy/Move.
- **Split panes:** each pane is a Material card (level-2 elevation, 12px radius) with 24px internal padding, occupying 46% width each, with the swap divider taking the remaining ~8% between them.
  - Breadcrumb row: 12px Roboto, `--gs-neutral-600`, `/`-separated, each segment clickable.
  - List rows follow the List Row spec (12.3) exactly, 48px each, scrollable within the pane if content exceeds viewport.
  - **Sticky footer inside the Source pane:** 1px top border `--gs-neutral-300`, showing "N items selected · X.X GB" in Roboto Medium 14px — updates live as checkboxes are toggled, excluding native Google Workspace files from the GB figure per Section 10.5 (though they still count toward "N items").
- **Middle Swap Divider:** a 1px vertical `--gs-neutral-300` line, with a circular 40px button centered on it (white background, level-2 elevation, Material Symbols `swap_horiz` icon, `--gs-blue-600`). On click: the button itself rotates 180° over 200ms (Framer Motion) as visual confirmation of the swap, and a toast reading "Selection cleared after swap" appears bottom-center.
- **Target pane specifics:** Quota Bar (12.3) sits directly under the breadcrumb, with a text label above it in Roboto 12px `--gs-neutral-600`: "62% of 15 GB used." A Floating Action Button (circular, 40px, level-3 elevation, `--gs-blue-600` background, white `add_circle`-adjacent folder icon) sits bottom-right within the pane for inline "Create New Folder" — opens a lightweight inline text field, not a separate modal, to keep the action fast.
- **Floating Action Bar:** fixed to viewport bottom, full width, white background, level-3 elevation (shadow pointing upward since it sits above the content). Centered content: dynamic label in Roboto Medium 16px ("Copy 6.0 GB to target@gmail.com" / "Move 6.0 GB to target@gmail.com" — label text changes live with the toggle state) followed by an arrow-icon Primary Button. Disabled state (12.3) applies until selection + destination + quota checks all pass.

**Interaction states to design for explicitly:**
- **Empty Source pane** (no files in current folder): centered Material Symbols `folder_open` icon (48px, `--gs-neutral-300`) + "This folder is empty" (Roboto 14px `--gs-neutral-600`) — an empty state that's a clear statement, not a dead end.
- **Conflict Resolution Modal:** triggered before the transfer begins if filename collisions are detected in the destination — Modal spec (12.3), radio-button choice of Skip / Rename automatically / Overwrite, applied to the whole job.
- **Move Confirmation Modal:** triggered on final CTA click when Move is active — Modal spec (12.3), with a `--gs-red-600` accent on the confirm button (the one deliberate departure from all-blue primary actions in the entire product, reserved specifically for this one truly destructive action) and copy reading exactly: *"This will move [N] files out of [source email]. Originals will be moved to Trash. This can be undone from Google Drive's own trash for 30 days."* Two buttons: "Cancel" (text button) and "Move files" (red-accented primary).

### Page 3 — Active Transfer Overlay

**Layout:**

```
┌───────────────────────────────────────┐
│                                        │
│         [ animated progress bar ]      │
│              62%                       │
│                                        │
│    Currently copying: report_q3.pdf    │
│                                        │
│    412 of 664 files completed          │
│                                        │
│      [ Pause ]        [ Cancel ]       │
│                                        │
└───────────────────────────────────────┘
```

**Exact specs:**
- Modal spec (12.3), but larger — 560px max-width, centered, level-4 elevation, background behind it blurred 8px (Framer Motion, animating in over 200ms per 12.2).
- Progress bar: 12px height, full pill, `--gs-blue-600` fill on `--gs-neutral-100` track, with the percentage rendered in Roboto Mono (12.1) directly above it so the digits don't visually jitter as they update.
- "Currently copying/moving: [filename]" line updates live via SSE, Roboto 14px, `--gs-neutral-900`, with the filename in Body-emphasis weight.
- Count line ("412 of 664 files completed") in Roboto 12px `--gs-neutral-600` directly below.
- Pause / Cancel: two side-by-side buttons, Pause as a filled secondary style (`--gs-neutral-100` background, `--gs-neutral-900` text), Cancel as a text-only button in `--gs-red-600`.
- **On completion (success):** the progress bar fills to 100% then the modal content cross-fades (200ms) to a success state: Material Symbols `check_circle` (48px, `--gs-green-600`), "All done — 664 files moved to target@gmail.com," and a "View in Target Drive" text link (`--gs-blue-600`) that opens the destination folder directly.
- **On completion with failures:** same layout, but the icon is a `--gs-yellow-600` warning glyph, copy reads "650 of 664 completed — 14 files need attention," with a visible "Retry failed (14)" Primary Button alongside "View in Target Drive."
- **Tab-close resilience:** if the user reopens `/dashboard` mid-transfer, the same Active Transfer Overlay re-opens automatically showing the real, persisted current state (not a blank progress bar) — pulled from `GET /api/jobs/{id}` before re-subscribing to the SSE stream.

---

## 14. Real-Time Progress System

Server-Sent Events (`GET /api/jobs/{id}/stream`) push a small JSON event on every `transfer_job_items` status change: `{ "item": "report.pdf", "status": "completed", "files_completed": 412, "total_files": 664 }`. The database, not the SSE stream, is always the source of truth — any client reconnect re-fetches persisted state first (`GET /api/jobs/{id}`) before resuming live updates, which is what makes the tab-close resilience behavior in Section 13 possible.

---

## 15. Security Model

### 15.1 OAuth Scope Strategy
Base login uses only unrestricted `openid email profile`. Source/Target connections require the restricted `drive` scope (needed for arbitrary file listing, permission management, and trash access — narrower scopes like `drive.file` don't cover this use case). The app stays in Google's **Testing** publishing status, with authorized test users added by email (cap of 100), to avoid the paid CASA security assessment required for full public production.

### 15.2 Zero Frontend Token Exposure
Google tokens are never sent to the Next.js frontend. The frontend only ever holds the Drive-Shift session cookie (HttpOnly, Secure, SameSite=Lax). All Drive API calls happen backend-to-Google using tokens decrypted server-side at call time.

### 15.3 Encryption at Rest
`encrypted_access_token` and `encrypted_refresh_token` are AES-256 encrypted before storage — never plaintext.

### 15.4 Key Management
The AES-256 key lives only as a Render.com environment variable — never in git, never in the database itself. A leaked database dump alone is insufficient to decrypt tokens. A full paid KMS is not used at this scale; this is a deliberate zero-cost tradeoff.

### 15.5 CSRF Protection
The OAuth `state` parameter is server-generated, stored server-side, and verified on callback before any token exchange proceeds.

### 15.6 Orphaned Permission Prevention
The reconciliation sweep (10.7) ensures no Target account retains standing reader access to a Source file beyond the transfer's actual completion, even across crashes.

### 15.7 Destructive Action Safeguards
Move mode never hard-deletes (10.6). The integrity verification gate (10.3, step 3) is a hard blocker — no source file is trashed unless its copy is verified first.

---

## 16. Error Handling & Rate Limiting

- Every `transfer_job_items` row tracks its own `retry_count` and `last_error`. Transient failures retry up to 3 times before `permanently_failed`.
- Job-level status is derived from item states: `running` while any item is in-flight, `completed` when all succeed, `completed_with_errors` when some are permanently failed.
- Outgoing Drive API calls use exponential backoff (500ms → 30s cap, 6 attempts) on 403/5xx; sustained rate-limit pressure reduces job concurrency automatically.
- User-facing errors are mapped from raw API error categories (rate limit, permission denied, quota exceeded, checksum mismatch) into plain language — never raw API text.

---

## 17. REST API Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/auth/login` | Redirect to Google OAuth (base login) |
| `GET` | `/auth/callback` | OAuth callback, issues session cookie |
| `POST` | `/auth/logout` | Clears session |
| `GET` | `/auth/connect/source` | OAuth for Source Drive connection |
| `GET` | `/auth/connect/target` | OAuth for Target Drive connection |
| `GET` | `/auth/callback/drive` | Shared Source/Target OAuth callback |
| `GET` | `/api/drive/source/tree?folderId=` | Browse Source folder contents |
| `GET` | `/api/drive/target/folders?parentId=` | Browse Target folders |
| `POST` | `/api/drive/target/folders` | Create a folder in Target |
| `GET` | `/api/drive/target/quota` | Get Target quota |
| `POST` | `/api/jobs` | Create a transfer job |
| `GET` | `/api/jobs/{id}` | Get current job state |
| `GET` | `/api/jobs/{id}/stream` | SSE live progress |
| `POST` | `/api/jobs/{id}/pause` | Pause a job |
| `POST` | `/api/jobs/{id}/resume` | Resume a job |
| `POST` | `/api/jobs/{id}/cancel` | Cancel a job |
| `POST` | `/api/jobs/{id}/retry-failed` | Retry only failed items |

---

## 18. Environment Variables

```
# Backend (Render.com)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI_BASE=https://drive-shift-api.onrender.com
SESSION_COOKIE_SECRET=
TOKEN_ENCRYPTION_KEY=
DATABASE_URL=
FRONTEND_ORIGIN=https://drive-shift.vercel.app
RESEND_API_KEY=
WORKER_POOL_SIZE=5

# Frontend (Vercel)
NEXT_PUBLIC_API_BASE_URL=https://drive-shift-api.onrender.com
```

---

## 19. Deployment Plan

1. **Google Cloud Console:** create a project, enable the Drive API, create OAuth credentials, set redirect URIs, keep publishing status **Testing**, add up to 100 test users.
2. **Supabase:** create a free Postgres project, run the schema from Section 8.
3. **Render.com:** connect the repo, deploy the Dockerized Spring Boot backend, set env vars from Section 18.
4. **Vercel:** connect the repo, deploy the Next.js frontend.
5. **GitHub Actions:** test + build on push, trigger redeploys.
6. **(Optional) UptimeRobot:** ping the backend health endpoint to reduce cold-start frequency.
7. **(Optional) Resend/Gmail SMTP:** enable completion emails.

---

## 20. Testing Strategy

- Unit tests for the per-file lifecycle state machine, including the verification-gate blocking behavior.
- Integration tests against real sandboxed Drive accounts, including deliberately killing the process mid-job to confirm reconciliation.
- Rate-limit simulation to confirm backoff/concurrency-reduction behaves correctly.
- Component tests confirming the Move Confirmation Modal can never be skipped, and the Conflict Resolution choice applies job-wide.
- Manual end-to-end run: nested folder mix of binary files and native Docs, verify Copy recreates structure exactly, verify Move lands originals in Trash (never hard-deleted) with permissions cleaned up.

---

## 21. Glossary

- **Source account** — the Drive account files move *from*.
- **Target account** — the Drive account files move *to*.
- **Transfer job** — one user-initiated batch transfer.
- **Job item** — one file or folder within a job; the real unit of work.
- **Tree-walk** — recursively listing a Source folder's full structure before copying begins.
- **Reconciliation sweep** — the scheduled task that finds and fixes items stuck mid-lifecycle, primarily to revoke orphaned permissions.
- **Native Google Workspace file** — a Doc, Sheet, Slide, Form, or Drawing; doesn't count against storage quota.
- **CASA assessment** — Google's paid third-party security review required to leave Testing mode for full public production beyond 100 users.

---

**End of PRD.**
