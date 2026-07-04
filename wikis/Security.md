# Security

← [Home](Home.md)

## Authentication

Cookie-based, not localStorage:

- **`access_token`** — short-lived JWT, HttpOnly, carries `{ id, role, organization_id, jti }`. Verified on every request by `authMiddleware`.
- **`refresh_token`** — opaque random value, HttpOnly, path-scoped to `/api/auth`. Only its **hash** is stored server-side, in the `sessions` table — the raw value never touches the database.
- **`csrf_token`** — JS-readable cookie, must be echoed as an `X-CSRF-Token` header on every mutating request (double-submit pattern). An attacker can make your browser send cookies automatically via a forged cross-site request, but can't read the cookie to also forge the matching header.

Storing tokens in HttpOnly cookies instead of `localStorage` means an XSS payload, if one ever ran, still couldn't exfiltrate the tokens directly via JavaScript.

## Refresh token rotation + reuse detection

Every refresh (`POST /api/auth/refresh`) is single-use: the presented token is looked up, the session is marked `revoked_at`, and a brand-new token is issued. If a *revoked* token is ever presented again, that's treated as a signal the token was stolen and replayed — every session for that account is revoked immediately, forcing a fresh login everywhere, not just for the one suspicious request.

## Logout

Logging out blacklists the current access token's `jti` in the `token_blacklist` table, checked on every request via `authMiddleware`. This kills the token immediately, rather than leaving it valid until its natural ~15-minute expiry.

## 404, not 403, on cross-tenant access

If a request references a resource ID that exists but belongs to a different organization (or a different intern's private data), the API returns 404. A 403 would confirm the resource exists somewhere — 404 gives no signal either way. This falls directly out of how [multi-tenant scoping](Multi-Tenancy-and-Organizations.md#how-every-query-stays-tenant-scoped) works: the query for "this ID in this organization" simply matches zero rows.

## Optimistic locking

`interns`, `tasks`, `submissions`, and `locations` each carry a `version` column, bumped automatically by a `BEFORE UPDATE` trigger. Every update statement requires `AND version = $N` in its `WHERE` clause. A mismatch (someone else edited the row first) means zero rows are affected, which the API treats as a 409 Conflict rather than silently discarding one admin's changes.

## Soft delete

Interns, tasks, and locations are never `DELETE FROM`'d — a `deleted_at` timestamp is set instead, so historical attendance, task, and submission data survives a removal. `interns.email` has a **partial unique index** (`WHERE deleted_at IS NULL`) rather than a plain unique constraint, so a soft-deleted intern's email frees up for reuse without permanently blocking it.

Soft-deleted interns are filtered out of dashboard aggregates, task/attendance/submission lists, and the chat conversation list — their data isn't erased, it's just not surfaced as if they're still active.

## Encryption at rest

Submission files and chat attachments are encrypted before ever touching disk, using AES-256-GCM (`backend/src/utils/fileCrypto.js`). Uploads use `multer.memoryStorage()` so the raw buffer is encrypted in memory and only the ciphertext is written. On-disk layout is self-describing — `[12-byte IV][16-byte auth tag][ciphertext]` — no separate key-management columns needed. Decryption falls back to treating the bytes as legacy plaintext if GCM authentication fails, for backward compatibility with anything uploaded before encryption was added.

## File retention

A daily cron job (3:00 AM) deletes the **file content** — not the database rows — for submissions and chat attachments belonging to interns who have been soft-deleted for more than `FILE_RETENTION_DAYS` (default 45) days. The submission/message rows themselves are kept indefinitely for audit purposes; only the file bytes and their filename/type metadata are cleared. See `backend/src/services/retentionService.js`.

## DB role separation

The running application server connects to Postgres as **`interns_app`**, a role restricted to `SELECT/INSERT/UPDATE/DELETE` — it has no `CREATE`, `ALTER`, `DROP`, or `GRANT` privileges. Migrations run separately, under **`interns_owner`**, which does have schema-owner privileges. This means even a SQL injection bug or a stray raw query in the running server can, at worst, manipulate rows it already has DML rights to — it cannot drop a table, alter a column, or grant itself more access. Full runbook in `backend/docs/role_separation.md` and `backend/src/config/roles.sql`.

## Audit logging

Every create/update/delete on interns, tasks, submissions, locations, and organization settings (invite code regeneration, Groq key changes) writes a row to `audit_logs`: actor ID + role, action, entity type/ID, and a JSON diff of exactly what changed (never full rows, never secrets). The table carries its own `organization_id` column directly — not just derivable by joining through the actor — so a per-org audit query can never accidentally leak across tenants through a forgotten join.

## Rate limiting, headers, body caps

- `helmet` — standard security headers, disables `X-Powered-By`.
- `hpp` — collapses duplicate query-string parameters.
- `express-rate-limit` — a global cap (100 req / 15 min), a tighter cap on `/api/auth` (30 / 15 min, the highest-value brute-force target), and a separate cap on `/api/ai` (40 / 15 min, since each call costs money).
- Request bodies capped at 100kb.

## Attendance-specific: two-factor physical presence

Checking in requires **both** a GPS geofence match and a live face-descriptor match against the intern's enrolled face (see [Intern Guide](Intern-Guide.md#checking-in--out)). Neither alone is sufficient — GPS can be spoofed, and a stolen phone alone doesn't pass the face check.

## What this does *not* protect against

- A compromised admin account acting within its own organization — role separation exists between tenants and between DB privilege levels, not between an admin and the data they're authorized to manage.
- Face descriptor spoofing via a high-quality photo or deepfake — there's no liveness detection, which is a known limitation of descriptor-matching alone.
- Compromise of `JWT_SECRET` or database credentials themselves — these are environment secrets with no HSM/KMS integration in this build.
