# Architecture

← [Home](Home.md)

## Stack

| Component | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | PostgreSQL, raw `pg` driver — no ORM |
| Auth | JWT access token + opaque refresh tokens, bcrypt password hashing |
| Frontend | React 18, React Router |
| Styling | Bootstrap 5 + custom CSS |
| Maps / geofencing | Leaflet, custom haversine distance check |
| Face verification | face-api.js (client-side descriptor extraction) |
| AI assistant | Groq SDK, proxied through the backend |
| Notifications | Nodemailer (email), Slack Web API |
| Scheduled jobs | node-cron |
| Security middleware | helmet, hpp, express-rate-limit, cookie-parser |

No ORM is used deliberately — every query in `backend/src/models/*.js` is raw SQL with parameterized inputs, which keeps the `organization_id` scoping (see [Multi-Tenancy & Organizations](Multi-Tenancy-and-Organizations.md)) explicit and grep-able rather than hidden behind query-builder magic.

## Request lifecycle

A typical mutating request (e.g. an admin creating a task) passes through, in order:

1. **`helmet`** — sets security headers, disables `X-Powered-By`.
2. **`cors`** — origin allowlist (`FRONTEND_URL`), `credentials: true` so auth cookies travel cross-origin.
3. **`cookie-parser`** — parses `access_token`, `refresh_token`, `csrf_token` cookies.
4. **Body size caps** — `express.json({ limit: '100kb' })`.
5. **`hpp`** — collapses duplicate query-string keys.
6. **Rate limiting** — a global limiter (100 req / 15 min), plus tighter limiters on `/api/auth` (30 / 15 min) and `/api/ai` (40 / 15 min, since AI calls cost money per request).
7. **CSRF check** — every mutating request must echo the `csrf_token` cookie's value in an `X-CSRF-Token` header, except the handful of routes a client can legitimately call before it has ever received that cookie (`/api/auth/login`, `/api/auth/signup`, `/api/auth/intern/login`).
8. **`authMiddleware`** — verifies the `access_token` JWT, checks it isn't blacklisted (logout), and attaches `req.user = { id, role, organization_id }`.
9. **Route → controller → model** — the controller reads `req.user.organization_id` and passes it as the first argument into every model call. There is no code path that queries a tenant-owned table without it.
10. **`logAudit(...)`** (fire-and-forget) — for create/update/delete on interns, tasks, submissions, locations, and organization settings, a row is written to `audit_logs` with actor, action, entity, and a diff of changed fields.

All of this is wired in `backend/src/server.js`.

## Background jobs (node-cron)

All jobs loop over every organization (`OrganizationModel.getAll()`) and act per-tenant — nothing here is global:

| Schedule | Job |
|---|---|
| Monday 8:00 AM | Weekly attendance report emailed to each org's admins |
| Monday 8:00 AM | Weekly attendance digest posted to Slack (if the org has Slack configured) |
| Daily 9:00 AM | Task deadline alerts to Slack for tasks due within 3 days |
| Daily 3:00 AM | Retention cleanup — deletes files (not rows) belonging to interns soft-deleted more than `FILE_RETENTION_DAYS` (default 45) days ago |

## Folder structure

```
Interns-Portal/
├── wikis/                   # you are here
├── backend/
│   ├── docs/
│   │   └── role_separation.md
│   └── src/
│       ├── config/          # db.js, migrate.js, roles.sql, reassign_ownership.sql
│       ├── controllers/     # request handlers per resource
│       ├── middleware/      # auth, CSRF, error handling, uploads
│       ├── models/          # org-scoped DB access, one file per entity
│       ├── routes/          # Express route definitions
│       ├── services/        # audit logging, email, Slack, sessions, retention, file encryption
│       ├── utils/           # geo (haversine), face matching, pagination, tokens
│       └── validators/      # express-validator rules per resource
└── frontend/
    └── src/
        ├── components/
        │   ├── common/      # shared UI, AI chatbot, pagination
        │   ├── forms/       # intern/task/location forms
        │   ├── intern/      # intern-portal-specific components
        │   └── layout/      # admin dashboard shell (Sidebar, Navbar, MainLayout)
        ├── context/         # auth state (AuthContext)
        ├── pages/           # admin pages: Dashboard, Interns, Tasks, Chat, Locations, Settings, Attendance
        │   └── intern/      # intern-facing pages: check-in, tasks, chat, verify identity, settings
        └── services/        # Axios API clients, one per backend resource
```

## Data model at a glance

Every tenant-owned table carries `organization_id` (FK to `organizations`, `ON DELETE CASCADE`):

- `organizations` — name, Slack config, `admin_invite_code`, `groq_api_key`
- `admins`, `interns` — accounts (email is globally unique, not per-org — see [Multi-Tenancy & Organizations](Multi-Tenancy-and-Organizations.md))
- `tasks`, `submissions`, `submission_files` — work assigned to interns and what they turn in
- `attendance` — daily check-in/out records
- `locations` — geofence points interns are assigned to
- `chat_messages` — per-intern conversations + org-wide announcements
- `audit_logs` — who did what, with a diff
- `sessions`, `token_blacklist` — refresh token rotation and logout revocation

`interns`, `tasks`, `submissions`, and `locations` also carry a `version` column (optimistic locking) and a `deleted_at` column (soft delete) — see [Security](Security.md) for why.
