# Drive-Shift — API Contract (v1)

This is the frozen interface between `/frontend` and `/backend`. Both sides
build against this document. If an endpoint needs to change shape, update
this file first and flag it in a Discussion thread — don't let the two
codebases silently drift apart.

Base URL (local): `http://localhost:8080`
Base URL (prod): `https://drive-shift-api.onrender.com`

All authenticated requests rely on the `HttpOnly` session cookie set at
login — no bearer tokens on the client.

---

## Auth

### `GET /auth/login`
Redirects to Google's consent screen. No request body.
**Response:** `302 Redirect` → Google OAuth URL.

### `GET /auth/callback`
Google redirects here with `code` and `state` query params.
**Response:** `302 Redirect` → `/dashboard`, sets session cookie.
**Error:** `400` if `state` mismatch.
```json
{ "error": "invalid_state", "message": "OAuth state verification failed" }
```

### `POST /auth/logout`
**Response:** `200 OK`
```json
{ "success": true }
```

### `GET /auth/connect/source`
Redirects to Google consent screen requesting `drive` scope, tagged for
Source account.
**Response:** `302 Redirect`

### `GET /auth/connect/target`
Same as above, tagged for Target account.
**Response:** `302 Redirect`

### `GET /auth/callback/drive`
Shared callback for both Source and Target connections.
**Response:** `302 Redirect` → `/dashboard`
**Error:** `400`
```json
{ "error": "invalid_state", "message": "OAuth state verification failed" }
```

---

## Drive Browsing

### `GET /api/drive/source/tree?folderId={id}`
`folderId` optional — omit for root.
**Response:** `200 OK`
```json
{
  "folderId": "1a2b3c",
  "breadcrumb": [
    { "id": "root", "name": "My Drive" },
    { "id": "1a2b3c", "name": "Projects" }
  ],
  "items": [
    {
      "id": "1x2y3z",
      "name": "Photos",
      "type": "folder",
      "mimeType": "application/vnd.google-apps.folder",
      "sizeBytes": null
    },
    {
      "id": "9f8e7d",
      "name": "resume.pdf",
      "type": "file",
      "mimeType": "application/pdf",
      "sizeBytes": 245760
    }
  ]
}
```
**Error:** `401` if Source not connected —
```json
{ "error": "source_not_connected", "message": "Please connect a Source account" }
```
**Error:** `409` if token expired (7-day Testing-mode expiry) —
```json
{ "error": "reauth_required", "accountType": "source" }
```

### `GET /api/drive/target/folders?parentId={id}`
Same shape as above, `items` filtered to folders only (used for
destination picking).

### `POST /api/drive/target/folders`
**Request:**
```json
{ "parentId": "1a2b3c", "name": "New Folder" }
```
**Response:** `201 Created`
```json
{ "id": "5g6h7i", "name": "New Folder", "parentId": "1a2b3c" }
```

### `GET /api/drive/target/quota`
**Response:** `200 OK`
```json
{
  "usedBytes": 9663676416,
  "totalBytes": 16106127360,
  "percentUsed": 60
}
```

---

## Transfer Jobs

### `POST /api/jobs`
**Request:**
```json
{
  "transferMode": "COPY",
  "conflictPolicy": "rename",
  "sourceItemIds": ["1x2y3z", "9f8e7d"],
  "targetParentId": "5g6h7i"
}
```
`transferMode`: `"COPY" | "MOVE"`. `conflictPolicy`: `"skip" | "rename" | "overwrite"`.

**Response:** `201 Created`
```json
{
  "id": "job-uuid-here",
  "status": "pending",
  "transferMode": "COPY",
  "totalFiles": 664,
  "totalFolders": 12,
  "createdAt": "2026-07-05T10:00:00Z"
}
```
**Error:** `402` (quota check failed pre-flight) —
```json
{ "error": "insufficient_target_quota", "requiredBytes": 6400000000, "availableBytes": 5000000000 }
```

### `GET /api/jobs/{id}`
**Response:** `200 OK`
```json
{
  "id": "job-uuid-here",
  "status": "running",
  "transferMode": "COPY",
  "conflictPolicy": "rename",
  "totalFiles": 664,
  "totalFolders": 12,
  "filesCompleted": 412,
  "filesFailed": 2,
  "foldersCreated": 12,
  "createdAt": "2026-07-05T10:00:00Z",
  "updatedAt": "2026-07-05T10:04:12Z"
}
```
`status`: `"pending" | "running" | "paused" | "completed" | "completed_with_errors" | "failed" | "cancelled"`

### `GET /api/jobs/{id}/stream`
Server-Sent Events. `Content-Type: text/event-stream`. One event per
`transfer_job_items` status change:
```
event: progress
data: {"item":"report.pdf","status":"completed","filesCompleted":412,"totalFiles":664}

event: progress
data: {"item":"invoice.pdf","status":"failed","filesCompleted":412,"totalFiles":664,"error":"rate_limited"}

event: done
data: {"status":"completed_with_errors","filesCompleted":650,"filesFailed":14,"totalFiles":664}
```
Client contract: always call `GET /api/jobs/{id}` first on
reconnect/tab-reopen to get persisted state, **then** subscribe to this
stream — the stream is a live diff, not the source of truth.

### `POST /api/jobs/{id}/pause`
**Response:** `200 OK`
```json
{ "id": "job-uuid-here", "status": "paused" }
```

### `POST /api/jobs/{id}/resume`
**Response:** `200 OK`
```json
{ "id": "job-uuid-here", "status": "running" }
```

### `POST /api/jobs/{id}/cancel`
**Response:** `200 OK`
```json
{ "id": "job-uuid-here", "status": "cancelled" }
```

### `POST /api/jobs/{id}/retry-failed`
**Response:** `200 OK`
```json
{ "id": "job-uuid-here", "status": "running", "itemsRequeued": 14 }
```

---

## Standard error shape

Every non-2xx response (unless noted otherwise above) follows:
```json
{ "error": "machine_readable_code", "message": "Human-readable explanation" }
```
Frontend should switch on `error`, not parse `message` — `message` is
allowed to change wording without being a breaking change.

---

## Change log

| Date | Change |
|---|---|
| 2026-07-05 | Initial contract frozen for Milestone 1 build-out. |
