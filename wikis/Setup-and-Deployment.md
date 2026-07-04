# Setup & Deployment

← [Home](Home.md)

## Prerequisites

- Node.js 18+
- PostgreSQL 14+ (15+ if you're following DB role separation, due to schema-ownership requirements — see below)

## Backend

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`. At minimum you need:

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Postgres connection for the running app |
| `JWT_SECRET` | Signs access tokens |
| `ADMIN_SIGNUP_KEY` | Required to create the *first* admin / a new organization — see [Multi-Tenancy & Organizations](Multi-Tenancy-and-Organizations.md) |
| `FRONTEND_URL` | Must exactly match where the frontend runs — used for CORS and cookie behavior |
| `GROQ_API_KEY` | Optional. Server-wide fallback AI key — orgs without their own key use this |
| `FILE_ENCRYPTION_KEY` | AES-256-GCM key for encrypting uploaded files at rest |
| `FILE_RETENTION_DAYS` | Days after an intern is soft-deleted before their files are purged (default 45) |
| `DB_MIGRATE_USER`, `DB_MIGRATE_PASSWORD` | Optional — only needed once you've set up DB role separation (below); falls back to `DB_USER`/`DB_PASSWORD` if unset |

### Database role separation (recommended before touching production data)

By default, migrations and the running app can share one Postgres user, which works but means the live server has schema-altering privileges it never actually needs. To harden this:

1. Copy `backend/src/config/roles.sql.example` to `backend/src/config/roles.sql` and fill in real passwords (this file is gitignored — it holds live credentials).
2. Run it as a Postgres superuser to create `interns_owner` (DDL/migrations) and `interns_app` (DML/runtime) roles.
3. If you have existing data owned by a different user, run `backend/src/config/reassign_ownership.sql` to transfer table/sequence/function/schema ownership to `interns_owner`.
4. Set `DB_USER`/`DB_PASSWORD` in `.env` to the `interns_app` credentials (the running app), and `DB_MIGRATE_USER`/`DB_MIGRATE_PASSWORD` to the `interns_owner` credentials (only needed when running migrations).

Full details in `backend/docs/role_separation.md`.

### Run the migration

```bash
node src/config/migrate.js
```

`migrate.js` is idempotent — every statement is `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so it's safe to re-run after pulling changes that add new columns or tables.

## Frontend

```bash
cd frontend
npm install
cp .env.example .env
```

`REACT_APP_API_URL` should point at the backend. Note: there is **no** `REACT_APP_GROQ_API_KEY` — the AI key lives server-side only (per-org or global fallback), never in a client-bundled environment variable, since `REACT_APP_*` variables get compiled directly into shipped JS and are readable by anyone via dev tools.

## Running locally

Two processes, each in its own terminal:

```bash
# Backend
cd backend
npm start          # or: npm run dev (nodemon, auto-restart)

# Frontend
cd frontend
npm start
```

- Admin dashboard: `http://localhost:3000` — sign up the first admin at `/signup` with your `ADMIN_SIGNUP_KEY`.
- Intern portal: `http://localhost:3000/intern/login` — interns are added by an admin, not self-registered.

## Scheduled jobs

These run automatically once the backend process is up (`node-cron`, in-process — no separate worker needed):

- Weekly attendance email report — Monday 8:00 AM
- Weekly Slack digest — Monday 8:00 AM (only for orgs with Slack configured)
- Task deadline alerts — daily 9:00 AM (Slack, only for orgs with Slack configured)
- File retention cleanup — daily 3:00 AM

## Health check

`GET /health` returns `{ status: 'ok' }` — useful for load balancer / uptime checks.
