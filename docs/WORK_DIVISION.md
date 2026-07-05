# Drive-Shift — Work Division Plan (2-person team)

**You:** Frontend (Next.js, design system, all client-side work)
**Friend:** Backend (Spring Boot, DB, OAuth, Transfer Engine)

---

## 1. The core idea: split on the contract, not on vibes

You can't work in parallel just by saying "you do backend, I do frontend" — the frontend needs *something* to call. The fix is that the PRD already hands you a frozen contract for free:

- **Section 17 (REST API Reference)** — every endpoint, method, and purpose.
- **Section 14 (Real-Time Progress System)** — the exact SSE event shape.
- **Section 8 (Database Schema)** — every field, so response shapes are predictable.

**Day 1 action (do this together, 1-2 hours, before splitting off):** turn Section 17 into a short `API_CONTRACT.md` (or an OpenAPI/Postman file) with exact request/response JSON for each endpoint. Once that's written down and both of you agree to it, you almost never need to block on each other again — you (frontend) build against a mock server or hardcoded fixtures matching that contract, your friend (backend) builds the real thing against the same contract, and you wire them together at the integration checkpoints below.

This one step is what turns "2 people who happen to be building different halves" into "2 people working genuinely in parallel."

---

## 2. Repo & GitHub org setup

1. Create the GitHub org (e.g. `drive-shift-hq` or similar — reusable for future joint projects).
2. Create one repo: `drive-shift`.
3. Structure:
   ```
   drive-shift/
   ├── backend/         ← Spring Boot project (your friend owns this)
   ├── frontend/         ← Next.js project (you own this)
   ├── docs/
   │   ├── API_CONTRACT.md
   │   └── Drive-Shift-PRD-v1.md
   ├── .github/
   │   ├── workflows/     ← CI: separate jobs for backend & frontend
   │   └── CODEOWNERS
   └── README.md
   ```
4. `.github/CODEOWNERS`:
   ```
   /backend/   @friend-github-username
   /frontend/  @your-github-username
   ```
   This auto-requests the right reviewer on PRs without either of you having to remember.
5. Branch protection on `main`: require 1 approval + passing CI before merge. Use short-lived feature branches (`feat/oauth-login`, `feat/split-pane-ui`), not long-lived personal branches — keeps merges small and conflict-free since you're in different folders anyway.
6. GitHub Projects (Kanban board): one board, columns `Backlog → In Progress → In Review → Done`, filtered views by assignee. This is where `GITHUB_ISSUES.md` gets turned into real issues.

---

## 3. Phased plan with parallel tracks

Each phase lists what can run **simultaneously** without either person waiting on the other, and the one thing that requires a sync point.

### Phase 0 — Foundations (1-2 days, do together)
- Write `API_CONTRACT.md` from Section 17 + Section 14 together.
- Agree on the DB schema (Section 8) as final for v1.
- Both scaffold your own project skeletons.
- **Sync point:** none needed after this — this phase *is* the sync point that unlocks everything else.

### Phase 1 — Parallel build (the bulk of the work)

| Track | Backend (friend) | Frontend (you) |
|---|---|---|
| A | Spring Boot skeleton, entities, repositories, Docker, DB migrations | Next.js skeleton, Tailwind config with design tokens (Section 12.1), base layout |
| B | OAuth flow — login, callback, token encryption, refresh (Section 7) | Landing page (Section 13, Page 1), mocked "Continue with Google" |
| C | Drive browsing endpoints — tree walk, quota service (Section 9, 10.1) | Dashboard split-pane UI against mocked file-tree JSON (Section 13, Page 2) |
| D | Transfer Engine — job creation, per-file lifecycle, worker pool (Section 10.2-10.8) | Selection state, Floating Action Bar, Conflict/Move Confirmation modals against mocked responses |
| E | SSE endpoint, reconciliation sweep, rate limiter (Section 14, 10.7, 10.8) | Active Transfer Overlay UI driven by a mocked/fake SSE stream (Section 13, Page 3) |

Within a track, backend and frontend items are independent of each other by construction (both point at the same contract, neither reads the other's code). You can literally work these in any order that suits your own pace — they don't have to be done "in sync" row by row.

- **Sync points during Phase 1:**
  1. After Track B: connect real OAuth login to the frontend (swap mock for real `/auth/login` redirect).
  2. After Track C: point the dashboard at the real `/api/drive/...` endpoints.
  3. After Track D+E: wire the real `POST /api/jobs` + `GET /api/jobs/{id}/stream` into the Active Transfer Overlay.

  Each sync point is small (usually swapping a mock fetch for a real URL) *if* the contract from Phase 0 was followed — this is why the upfront contract work pays for itself repeatedly.

### Phase 2 — Integration & hardening
- Both: end-to-end manual test against two real sandbox Google accounts (Section 20).
- Backend: rate-limit simulation, crash-mid-job recovery test.
- Frontend: responsive behavior pass (Section 12.4), tab-close resilience test.
- This phase is inherently more collaborative — treat it as pairing time, not a parallel split.

### Phase 3 — Deploy & polish
- Backend: Render deploy, env vars, health checks.
- Frontend: Vercel deploy.
- Both: GitHub Actions CI/CD (Section 19).
- Can run in parallel — different platforms, no shared dependency.

---

## 4. How many things can genuinely run in parallel?

- **At the start of Phase 1:** exactly **2** fully independent workstreams (you and your friend), each internally containing **~5 further-independent tracks** (A-E above) that don't block each other either — so in practice each of you always has 3-4 unblocked issues to pick up if one is stuck waiting on a design decision or an external API quirk.
- **True simultaneous max:** since it's a 2-person team, your ceiling is 2 issues in progress at once — the value of the track breakdown above isn't "more parallelism than 2," it's making sure neither of you is ever *blocked* waiting on the other mid-track, which is what actually kills velocity on small teams.

---

## 5. A few things worth deciding together up front (5-minute conversation, not a blocker)

- Who owns the Google Cloud Console project / OAuth credentials setup (Section 19, step 1)? Recommend: backend person, since redirect URIs are backend-owned, but you'll both need to be added as test users.
- Where do shared secrets/env vars live locally? A `.env.example` in each folder, real values shared via a password manager, never committed.
- Commit convention (optional but keeps history readable across two people): Conventional Commits (`feat:`, `fix:`, `chore:`) — takes 0 setup, just an agreement.
