# Drive-Shift — Issue Backlog

Copy each block below into a GitHub Issue. Suggested labels are in `[brackets]`.
Milestones map to the phases in `WORK_DIVISION.md`. Issues within the same
milestone and same assignee are ordered but not strictly blocking unless noted.

---

## Milestone 0 — Foundations (both)

### #1 — Write API_CONTRACT.md
**Assignee:** Both
**Labels:** `[setup]` `[docs]`
Turn PRD Section 17 (REST API Reference) + Section 14 (SSE event shape) into
exact request/response JSON examples for every endpoint, saved to
`docs/API_CONTRACT.md`. This is the interface both of you build against —
treat it as the one thing that must be agreed before splitting off.
**Blocks:** everything in Milestone 1.

### #2 — Finalize DB schema as migration files
**Assignee:** Backend
**Labels:** `[setup]` `[backend]`
Convert PRD Section 8 SQL into versioned migration files (Flyway or
Liquibase). Confirm no changes needed vs. the PRD before Milestone 1 starts.

### #3 — Repo scaffolding
**Assignee:** Both
**Labels:** `[setup]`
Create `drive-shift` repo in the org, `/backend` and `/frontend` folders,
`.github/CODEOWNERS`, branch protection on `main`, GitHub Projects board.

---

## Milestone 1A — Backend: Setup & Data Layer

### #4 — Spring Boot project skeleton
**Assignee:** Backend
**Labels:** `[backend]`
Package structure per PRD Section 9 (`config`, `controller`, `service`,
`repository`, `entity`, `dto`, `security`). Dockerfile for local + Render.

### #5 — JPA entities + repositories
**Assignee:** Backend
**Labels:** `[backend]`
Entities matching Section 8 exactly: `User`, `OAuthToken`, `TransferJob`,
`TransferJobItem`. Spring Data JPA repositories for each.
**Depends on:** #2

### #6 — AES-256 token encryption utility
**Assignee:** Backend
**Labels:** `[backend]` `[security]`
Encrypt/decrypt utility for `encrypted_access_token` /
`encrypted_refresh_token` (Section 15.3-15.4). Key read from env var only,
never committed.

---

## Milestone 1A — Frontend: Setup & Design System

### #7 — Next.js project skeleton
**Assignee:** Frontend
**Labels:** `[frontend]`
App Router setup, Tailwind config, base layout, folder structure for
pages/components.

### #8 — Design tokens in Tailwind config
**Assignee:** Frontend
**Labels:** `[frontend]` `[design]`
Encode Section 12.1 exactly: color palette (`--gs-blue-600` etc.),
typography scale (Google Sans / Roboto / Roboto Mono), 8px spacing scale,
elevation levels, corner radii as Tailwind theme extensions or CSS variables.

### #9 — Mock API layer
**Assignee:** Frontend
**Labels:** `[frontend]`
Fixture data + a small fetch wrapper matching `API_CONTRACT.md` responses,
so every page below can be built without a running backend.
**Depends on:** #1

---

## Milestone 1B — Backend: Auth

### #10 — Base OAuth login flow
**Assignee:** Backend
**Labels:** `[backend]` `[auth]`
`GET /auth/login`, `GET /auth/callback` — Section 7.1. Server-generated
`state`, session cookie (HttpOnly/Secure/SameSite=Lax), `users` row
creation.
**Depends on:** #5

### #11 — Source/Target Drive connection flow
**Assignee:** Backend
**Labels:** `[backend]` `[auth]`
`GET /auth/connect/source`, `/auth/connect/target`,
`/auth/callback/drive` — Section 7.2. Stores `oauth_tokens` rows,
encrypted via #6.
**Depends on:** #10, #6

### #12 — Token refresh + 7-day expiry handling
**Assignee:** Backend
**Labels:** `[backend]` `[auth]`
Silent refresh before Drive calls (Section 7.3); catch `invalid_grant` and
mark token row as needing reconnect (Section 7.4).
**Depends on:** #11

---

## Milestone 1B — Frontend: Landing & Auth UI

### #13 — Landing page
**Assignee:** Frontend
**Labels:** `[frontend]` `[design]`
Section 13, Page 1, exact spec: hero headline/subheadline, CTA, 3-panel
Access/Copy/Free-up-space cards, page-load stagger animation (Section
12.2, #1).
**Depends on:** #8

### #14 — Auth wiring (real login)
**Assignee:** Frontend
**Labels:** `[frontend]` `[auth]`
Wire "Continue with Google" to real `/auth/login` redirect, handle session
cookie, redirect to `/dashboard`. **Integration checkpoint — needs #10 done.**
**Depends on:** #13, #10

### #15 — Account connection UI (Source/Target chips)
**Assignee:** Frontend
**Labels:** `[frontend]` `[auth]`
Header chips for connecting/reconnecting Source & Target accounts
(Section 13, Page 2 header), reconnect prompt UI for expired tokens
(Section 7.4).
**Depends on:** #9 (mock first), then #11

---

## Milestone 1C — Backend: Drive Browsing

### #16 — Recursive folder tree-walk service
**Assignee:** Backend
**Labels:** `[backend]`
`DriveTreeService` — Section 10.1. Paginated `drive.files.list`, builds
in-memory tree, flattens to folders-first ordering.
**Depends on:** #12

### #17 — Drive browsing endpoints
**Assignee:** Backend
**Labels:** `[backend]`
`GET /api/drive/source/tree`, `GET /api/drive/target/folders`,
`POST /api/drive/target/folders` — Section 17.
**Depends on:** #16

### #18 — Quota service
**Assignee:** Backend
**Labels:** `[backend]`
`GET /api/drive/target/quota` — Section 10.5 math, excluding native
Google Workspace files from byte totals.
**Depends on:** #12

---

## Milestone 1C — Frontend: Dashboard Workspace

### #19 — Split-pane layout shell
**Assignee:** Frontend
**Labels:** `[frontend]` `[design]`
Section 13, Page 2 layout: global header, Source/Target panes, swap
divider, responsive breakpoints per Section 12.4.
**Depends on:** #8

### #20 — File browser list (against mock data)
**Assignee:** Frontend
**Labels:** `[frontend]`
List Row component (Section 12.3), breadcrumbs, checkboxes, sticky
selection footer, empty state.
**Depends on:** #9, #19

### #21 — Quota bar + Create Folder FAB
**Assignee:** Frontend
**Labels:** `[frontend]`
Section 12.3 Quota Bar component + inline folder-creation field (Section
13, Page 2, Target pane specifics).
**Depends on:** #20

### #22 — Wire dashboard to real Drive endpoints
**Assignee:** Frontend
**Labels:** `[frontend]` **Integration checkpoint**
Swap mock fetches for real `/api/drive/...` calls.
**Depends on:** #17, #18, #21

---

## Milestone 1D — Backend: Transfer Engine

### #23 — Job creation + folder creation step
**Assignee:** Backend
**Labels:** `[backend]`
`POST /api/jobs` — Section 10.1-10.2. Flattens tree into
`transfer_job_items`, creates folders top-down in Target.
**Depends on:** #16

### #24 — Per-file lifecycle worker pool
**Assignee:** Backend
**Labels:** `[backend]`
Section 10.3: permission injection → copy → integrity verification →
permission cleanup → (Move) trash. 5 concurrent workers via
`SELECT ... FOR UPDATE SKIP LOCKED`. Retry logic (3 attempts).
**Depends on:** #23

### #25 — Idle polling backoff
**Assignee:** Backend
**Labels:** `[backend]` `[performance]`
Section 10.4 — 5s/10s/20s/60s backoff when no work, instant reset on new
work.
**Depends on:** #24

### #26 — Rate limiter + backoff on Drive API calls
**Assignee:** Backend
**Labels:** `[backend]`
Section 10.8 — exponential backoff on 403/5xx, concurrency reduction
under sustained pressure.
**Depends on:** #24

### #27 — Job control endpoints
**Assignee:** Backend
**Labels:** `[backend]`
`GET /api/jobs/{id}`, `/pause`, `/resume`, `/cancel`, `/retry-failed`.
**Depends on:** #24

---

## Milestone 1D — Frontend: Transfer Flow UI

### #28 — Floating Action Bar
**Assignee:** Frontend
**Labels:** `[frontend]`
Section 13, Page 2 — dynamic label, disabled-state logic based on
selection + destination + quota checks.
**Depends on:** #21

### #29 — Conflict Resolution Modal
**Assignee:** Frontend
**Labels:** `[frontend]`
Section 13, Page 2 — Skip/Rename/Overwrite radio choice, job-wide.
**Depends on:** #9 (mock)

### #30 — Move Confirmation Modal
**Assignee:** Frontend
**Labels:** `[frontend]`
Exact copy and red-accent confirm button per Section 13, Page 2 spec —
the one deliberate red-primary-button exception in the whole design system.
**Depends on:** #9 (mock)

### #31 — Wire job creation to real backend
**Assignee:** Frontend
**Labels:** `[frontend]` **Integration checkpoint**
`POST /api/jobs` wired from Floating Action Bar + modals.
**Depends on:** #23, #28, #29, #30

---

## Milestone 1E — Backend: Real-time & Resilience

### #32 — SSE progress stream
**Assignee:** Backend
**Labels:** `[backend]`
`GET /api/jobs/{id}/stream` — Section 14 event shape, DB as source of
truth for reconnects.
**Depends on:** #24

### #33 — Reconciliation sweep
**Assignee:** Backend
**Labels:** `[backend]` `[security]`
Scheduled task every 5 min — Section 10.7, finds items stuck at `copied`
for 10+ min, re-attempts verify/revoke.
**Depends on:** #24

---

## Milestone 1E — Frontend: Active Transfer Overlay

### #34 — Active Transfer Overlay UI (against fake SSE)
**Assignee:** Frontend
**Labels:** `[frontend]` `[design]`
Section 13, Page 3 — progress bar (Roboto Mono %, spring animation per
Section 12.2), success/failure completion states.
**Depends on:** #9

### #35 — Tab-close resilience
**Assignee:** Frontend
**Labels:** `[frontend]`
On `/dashboard` reopen mid-transfer, `GET /api/jobs/{id}` first, then
resubscribe to SSE — Section 13 tab-close behavior.
**Depends on:** #34

### #36 — Wire real SSE stream
**Assignee:** Frontend
**Labels:** `[frontend]` **Integration checkpoint**
Swap fake stream for real `GET /api/jobs/{id}/stream`.
**Depends on:** #32, #34, #35

---

## Milestone 2 — Integration & Hardening (both)

### #37 — End-to-end manual test, two sandbox accounts
**Assignee:** Both
**Labels:** `[testing]`
Nested folder mix, binary + native Docs, verify Copy recreates structure,
verify Move trashes (not hard-deletes) with permissions cleaned up.

### #38 — Crash-mid-job recovery test
**Assignee:** Backend
**Labels:** `[testing]`
Kill process mid-job, confirm workers resume via `SELECT ... FOR UPDATE
SKIP LOCKED` on restart, confirm reconciliation sweep catches orphans.

### #39 — Rate-limit simulation
**Assignee:** Backend
**Labels:** `[testing]`
Confirm backoff/concurrency-reduction (Section 10.8) behaves correctly
under simulated 403/5xx.

### #40 — Responsive behavior pass
**Assignee:** Frontend
**Labels:** `[testing]` `[design]`
Verify Section 12.4 breakpoints: desktop split-pane, tablet single-pane
switcher, mobile 3-step wizard.

### #41 — Component tests: destructive-action safeguards
**Assignee:** Frontend
**Labels:** `[testing]`
Confirm Move Confirmation Modal can never be skipped, Conflict Resolution
choice applies job-wide.

---

## Milestone 3 — Deploy (parallel, no shared dependency)

### #42 — Backend deploy to Render
**Assignee:** Backend
**Labels:** `[deploy]`
Dockerized deploy, env vars from Section 18, health check endpoint.

### #43 — Frontend deploy to Vercel
**Assignee:** Frontend
**Labels:** `[deploy]`
Connect repo (build from `/frontend`), set `NEXT_PUBLIC_API_BASE_URL`.

### #44 — GitHub Actions CI/CD
**Assignee:** Both
**Labels:** `[deploy]`
Separate workflow jobs for `/backend` and `/frontend` — test + build on
push, trigger redeploys.

### #45 — Google Cloud Console OAuth setup
**Assignee:** Backend
**Labels:** `[deploy]` `[auth]`
Create project, enable Drive API, OAuth credentials, redirect URIs,
Testing publishing status, add both of you as test users.
