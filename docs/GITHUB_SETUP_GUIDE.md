# Drive-Shift — GitHub Setup Guide

Covers: org name, repo name, folder structure, Projects board, Actions, Wiki,
and Discussions — all set up specifically for a 2-person team working the
split described in `WORK_DIVISION.md`.

---

## 1. Organization name

Since you mentioned adding future apps under the same org, pick something
that isn't tied to "Drive-Shift" specifically.

**Duo/collaboration-themed:**
- `forkbound`
- `parallel-forge`
- `ctrl-alt-build`
- `twoport-labs`
- `dualcore-dev`
- `null-pointer-labs`

**Neutral studio-style (ages well, sounds like a real dev shop):**
- `originate-labs`
- `latch-works`
- `driftwood-dev`
- `basecamp-forge` *(careful — close to the existing Basecamp brand, avoid if you want to stay clear of any confusion)*
- `holdfast-labs`
- `outpost-dev`

**Short & brandable (good if you ever want a matching domain):**
- `forgekit`
- `loopstack`
- `pivotware`

Quick filter before you commit: check the name isn't already a GitHub org
(`github.com/<name>`) and ideally check the `.dev` or `.com` domain isn't
taken if you'd want a landing page later. My pick if you want one
recommendation: **`originate-labs`** — reads as a real studio, isn't
tied to this one project, ages fine in 3 years.

---

## 2. Repo name

Just `drive-shift` (kebab-case, matches the product name, matches the
existing env vars in Section 18 of the PRD like `drive-shift-api.onrender.com`
and `drive-shift.vercel.app` — so this isn't just cosmetic, it keeps your
repo name consistent with URLs you'll actually deploy to).

---

## 3. Repo structure

```
drive-shift/
├── .github/
│   ├── workflows/
│   │   ├── backend-ci.yml
│   │   └── frontend-ci.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature.md
│   │   └── config.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── CODEOWNERS
│
├── backend/
│   ├── src/main/java/com/driveshift/
│   │   ├── config/
│   │   ├── controller/
│   │   ├── service/
│   │   ├── repository/
│   │   ├── entity/
│   │   ├── dto/
│   │   └── security/
│   ├── src/test/java/com/driveshift/
│   ├── src/main/resources/db/migration/    ← Flyway SQL files
│   ├── Dockerfile
│   ├── pom.xml
│   └── .env.example
│
├── frontend/
│   ├── app/                                 ← Next.js App Router
│   ├── components/
│   ├── lib/                                 ← API client, mock fixtures
│   ├── styles/
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.ts
│   └── .env.example
│
├── docs/
│   ├── Drive-Shift-PRD-v1.md
│   ├── API_CONTRACT.md
│   └── adr/                                 ← Architecture Decision Records
│       └── 0001-monorepo-vs-split-repos.md
│
├── WORK_DIVISION.md
├── GITHUB_ISSUES.md
└── README.md
```

**`.github/CODEOWNERS`:**
```
/backend/   @Satish-970
/frontend/  @allenjose24
/docs/      @Satish-970 @allenjose24
```

**Root `README.md`** should be short: one-paragraph pitch, link to
`docs/Drive-Shift-PRD-v1.md` for full spec, link to the Wiki for setup
instructions, badges for both CI workflows. Keep the PRD and setup details
out of the README itself — that's what the Wiki is for (Section 5 below).

---

## 4. Project board (GitHub Projects)

Create **one** project, not two — a 2-person team doesn't need
per-person boards, and a single board is what lets you both see the whole
picture at a glance.

**Setup:**
1. Org level → Projects → New project → "Board" template.
2. Name it `Drive-Shift Roadmap`.
3. Columns: `Backlog → Ready → In Progress → In Review → Done`.
   - `Ready` matters more than it looks — it's for issues whose
     dependencies (per `GITHUB_ISSUES.md`) are already satisfied, so
     when one of you finishes something you can glance at `Ready` and
     immediately know what's unblocked, instead of re-reading dependency
     notes each time.
4. Add custom fields:
   - `Area` (single select: Backend / Frontend / Both) — mirrors the
     assignees in `GITHUB_ISSUES.md`.
   - `Milestone` (single select, or use GitHub's native Milestones —
     see below) matching `M0` through `M3`.
5. Automation (Project → Workflows, built-in, no Actions needed):
   - "Item added to project" → sets status `Backlog`.
   - "Item reopened" → moves to `In Progress`.
   - "Pull request merged" → moves linked issue to `Done`.
   - "Issue closed" → moves to `Done`.
6. Two saved views:
   - **Board view** (default) grouped by `Status`.
   - **Table view** filtered `Assignee: me`, grouped by `Area` — each of
     you saves your own filtered version so you're not scanning the
     other person's half every time you check the board.

**Milestones** (native GitHub Milestones, not just a board column) — create
one per phase from `WORK_DIVISION.md`:
- `M0 – Foundations`
- `M1 – Parallel Build`
- `M2 – Integration & Hardening`
- `M3 – Deploy`

Assign every issue from `GITHUB_ISSUES.md` to its milestone on creation —
this gives you a free burndown/progress % on the Milestones page without
any extra tooling.

---

## 5. GitHub Actions

Two independent workflows, path-filtered so a backend-only change never
triggers a frontend build and vice versa — keeps CI fast and keeps you
from stepping on each other's pipeline.

**`.github/workflows/backend-ci.yml`**
```yaml
name: Backend CI
on:
  push:
    branches: [main]
    paths: ["backend/**"]
  pull_request:
    paths: ["backend/**"]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"
          cache: maven
      - run: mvn -B verify
      - name: Build Docker image
        run: docker build -t drive-shift-backend .
```

**`.github/workflows/frontend-ci.yml`**
```yaml
name: Frontend CI
on:
  push:
    branches: [main]
    paths: ["frontend/**"]
  pull_request:
    paths: ["frontend/**"]

jobs:
  build-and-lint:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build
```

Both are intentionally CI-only (test/build/lint) — actual deployment stays
on Render's and Vercel's own git-push auto-deploy (per Section 19 of the
PRD), so you don't need a `deploy.yml` unless you later want deploys gated
behind CI passing. If you do want that gate: add
`vercel/action` / a Render deploy-hook `curl` call as a final step,
triggered only on `main` after tests pass.

**Branch protection to pair with this:** Settings → Branches → require
`Backend CI` to pass for changes touching `backend/**` and `Frontend CI`
for `frontend/**` before merge into `main`.

---

## 6. Wiki

Turn on the Wiki (Settings → Features → Wikis). Use it for anything that's
*operational knowledge*, not project spec (the PRD already covers spec —
don't duplicate it in the Wiki, link to it instead).

Suggested pages:

- **Home** — one paragraph + links to every page below.
- **Local Dev Setup — Backend** — exact steps to get Spring Boot + Postgres
  running locally, required local env vars, how to run migrations.
- **Local Dev Setup — Frontend** — `npm install`, `.env.local` setup,
  how to point at the mock API vs. local backend.
- **Environment Variables Reference** — table of every var from PRD
  Section 18, who owns generating each one (e.g. `GOOGLE_CLIENT_ID` comes
  from whoever sets up Cloud Console), and where it's set (local `.env`
  vs. Render vs. Vercel dashboard).
- **API Contract** — either duplicate or link to `docs/API_CONTRACT.md`
  (linking is better — one source of truth).
- **Deployment Runbook** — step-by-step for a fresh deploy and for
  redeploying after a breaking schema change.
- **Troubleshooting / FAQ** — living page, add to it whenever either of
  you hits something non-obvious (e.g. "Google refresh token expired
  again — see PRD Section 7.4, just reconnect").
- **Decision Log** — short dated entries for any decision not already
  in `docs/adr/`, e.g. "2026-07-10: decided to keep worker pool at 5,
  Render free tier can't handle more."

Keep the Wiki editable by both of you with no approval step — it's meant
to be low-friction, unlike the PRD which should stay stable.

---

## 7. Discussions

Turn on Discussions (Settings → Features → Discussions). This is for
async back-and-forth that isn't a bug and isn't a task — Issues stay
reserved for actionable work.

**Categories to set up:**
- **Announcements** (locked, either of you can post) — "backend deployed
  to staging," "frontend design tokens finalized," etc.
- **Decisions Needed** — open a thread instead of a Slack/WhatsApp message
  for anything that needs a real decision and a paper trail (e.g. "should
  Conflict Resolution default to Rename or Skip?") — resolve it, then
  optionally promote the outcome into `docs/adr/`.
- **Q&A** — "how does the reconciliation sweep interact with a paused
  job?" type questions, gets an accepted-answer marker.
- **Show and tell** — screen recordings/screenshots of UI progress,
  quick wins — genuinely useful for morale on a 2-person project where
  there's no one else to show things to.

Given it's just the two of you, don't over-structure this — the value is
having a searchable paper trail instead of decisions living only in chat
history that neither of you can find three weeks later.

---

## 8. Labels (for Issues)

A small, non-overlapping set — this is deliberately shorter than what a
big team would use:

- `backend`, `frontend` — area
- `auth`, `design`, `security`, `performance`, `testing`, `deploy`,
  `docs` — type/domain (matches the labels already used in
  `GITHUB_ISSUES.md`)
- `blocked` — apply + note what it's blocked on, remove the moment it's
  unblocked so it doesn't go stale
- `good-next` — either of you can tag an issue this when you finish
  something and want to flag what you think should be picked up next,
  without needing a sync call to say so

---

## 9. Issue & PR templates

**`.github/ISSUE_TEMPLATE/feature.md`** — mirror the format already used
in `GITHUB_ISSUES.md` (Assignee / Labels / description / Depends on) so
new issues stay consistent with the existing backlog.

**`.github/PULL_REQUEST_TEMPLATE.md`** — keep it minimal for a 2-person
team:
```markdown
## What this does


## Closes
Closes #

## Checklist
- [ ] Tested locally
- [ ] Matches API_CONTRACT.md (if touching an endpoint)
```

Using `Closes #<issue>` in every PR description is what makes the Project
board automation in Section 4 actually move cards to `Done` automatically.
