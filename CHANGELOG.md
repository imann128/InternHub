# Changelog

All notable changes to InternHub (Interns-Portal) are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [2.0.0] — Multi-tenancy, security hardening, and scale fixes

This release rebuilds the app as a proper multi-tenant platform and closes a long list of real security and correctness gaps found along the way. It is a **breaking change** — see Migration notes below before deploying.

### Added — Multi-tenancy & organizations

- `organizations` table; every tenant-owned table (`interns`, `tasks`, `attendance`, `submissions`, `locations`, `chat_messages`, `submission_files`, `task_comments`) now carries `organization_id`.
- Every model function takes `organizationId` as a mandatory first argument — no query path can run without a tenant filter.
- Admin signup now creates a new, fully isolated organization by default.
- **Org co-admin invite codes**: an admin can generate/regenerate a shareable invite code (Settings page) so a co-worker joins their *same* organization as a second admin, instead of always spinning up a new one.
- **Per-organization Groq AI key** with graceful fallback: an org can set its own key; otherwise the server's shared key is used; if neither exists, AI features are hidden in the UI instead of failing. New `GET /api/ai/status` endpoint.
- Soft-deleted interns are now excluded from dashboard aggregates, the task/attendance/submission lists, and the chat conversation list — their historical rows are preserved, just no longer surfaced as "active."

### Added — Security

- Cookie-based auth rework: HttpOnly `access_token` (JWT) + HttpOnly `refresh_token` (opaque, hashed at rest, single-use with reuse detection) + CSRF double-submit token.
- Immediate logout via access-token blacklist (`token_blacklist`, keyed by `jti`).
- 404 (not 403) on any cross-tenant or cross-intern resource access — never confirms a resource exists elsewhere.
- Optimistic locking: `version` column + `BEFORE UPDATE` trigger on `interns`/`tasks`/`submissions`/`locations`; conflicting concurrent edits return 409 instead of silently overwriting.
- Soft delete (`deleted_at`) on `interns`/`tasks`/`locations`, with a partial unique index so a soft-deleted intern's email can be reused.
- Audit logging (`audit_logs`, with its own `organization_id` column) on every create/update/delete of interns, tasks, submissions, locations, and organization settings.
- **DB role separation**: the running server connects as `interns_app` (DML only — no CREATE/ALTER/DROP/GRANT); migrations run separately under `interns_owner`. Full runbook in `backend/docs/role_separation.md`.
- **Encryption at rest (AES-256-GCM)** for submission files and chat attachments; uploads now go through memory (not disk) so plaintext never touches the filesystem. Backward-compatible with pre-existing plaintext files.
- **File retention cron**: files (not rows) belonging to interns soft-deleted more than `FILE_RETENTION_DAYS` (default 45) days ago are purged daily; submission/message rows are kept for audit purposes.
- **AI proxy**: all Groq calls now go through the backend. Removed the client-exposed `REACT_APP_GROQ_API_KEY`, which was previously bundled into shipped JS and readable via dev tools by any visitor.
- `helmet`, `hpp`, `express-rate-limit` (global + stricter limiters on `/api/auth` and `/api/ai`), and request body size caps.
- Consent tracking for biometric (face descriptor) and location data collection, with a recorded policy version per intern.

### Added — Features

- Geofenced + face-verified attendance check-in/out (`locations` table, haversine distance check, `face-api.js` descriptor matching), including a mobile-optimized check-in page.
- Real-time-style chat: per-intern conversations plus org-wide announcements, with file attachments.
- AI portal assistant (role-aware system prompt) and "Enhance with AI" task description generation.
- Admin Settings page (invite codes, AI key management) and Intern Settings page (profile, preferences, password, face re-verification).
- Pagination on interns/tasks/submissions/chat message lists, front and back end.

### Fixed

- Dashboard stats query fan-out bug that silently multiplied task/attendance counts when an intern had many of both.
- `errorHandler` leaking raw internal error messages in production responses.
- DB pool crashing the process on a connection error instead of logging and recovering.
- `taskValidator` incorrectly applied to the task-edit route; `attendanceValidator` never actually wired into its routes.
- Missing indexes on `organization_id` and common filter columns across every tenant-owned table.
- Task/attendance/submission list pagination counts that didn't match their own list query's filters once soft-deleted-intern exclusion was added.

### Documentation

- New root `README.md` — architecture diagram, design decisions, security model, threat model, setup instructions.
- New `wikis/` — `Home`, `Architecture`, `Multi-Tenancy-and-Organizations`, `Admin-Guide`, `Intern-Guide`, `Security`, `Setup-and-Deployment`.
- `backend/docs/role_separation.md` — DB role separation runbook.

### Migration notes (breaking)

- **Run the migration**: `node backend/src/config/migrate.js` — adds `organizations`, `organization_id` columns, `version`, `deleted_at`, `audit_logs`, `sessions`, `token_blacklist`, `admin_invite_code`, `groq_api_key`, and new indexes. Idempotent, safe to re-run.
- **Backfill required for existing data**: pre-existing rows need `organization_id` populated — see `backend/src/config/backfill_organization_id.sql`. Every query now filters on it; unbackfilled rows become invisible, not erroring.
- **New required env vars**: `JWT_SECRET`, `ADMIN_SIGNUP_KEY`, `FRONTEND_URL`, `FILE_ENCRYPTION_KEY`. Optional: `FILE_RETENTION_DAYS` (default 45), `GROQ_API_KEY`, `DB_MIGRATE_USER`/`DB_MIGRATE_PASSWORD` (if adopting DB role separation).
- **Removed**: `REACT_APP_GROQ_API_KEY` from the frontend `.env` — no longer used or needed; AI calls are proxied through the backend now.
- **Auth mechanism changed**: clients must support cookies (`credentials: true`) and echo the CSRF token header on mutating requests. Any existing API client integration built against header-based JWT auth will need to be updated.
- **DB role separation is opt-in but recommended**: existing deployments can adopt it via `backend/src/config/roles.sql` + `reassign_ownership.sql` without downtime; it isn't required for the migration itself to run.

---

## [1.0.0] — Initial release

Single-tenant intern management: admin/intern accounts, task assignment, attendance marking, Slack notifications, initial chat and submissions support.
