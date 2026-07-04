# DB role separation — runbook

## Why this matters

Right now the running server and `migrate.js` both connect to Postgres as
the same role (whatever `DB_USER` is set to). If that role owns the schema
or is a superuser, then any SQL injection bug, a stray raw query, or a
leaked `.env` gives an attacker (or a bug) `DROP TABLE`, `ALTER TABLE`, or
`GRANT` power — not just "read the wrong org's rows." Parameterized queries
protect against injection at the application layer, but that's one bug away
from being wrong in a future PR. The database itself should refuse to let
the live server do DDL, no matter what SQL string reaches it.

The fix is two roles:

- **`interns_owner`** — owns the schema, has full DDL rights. Used *only*
  when running `node src/config/migrate.js`. Never used by the live server.
- **`interns_app`** — DML only (`SELECT`/`INSERT`/`UPDATE`/`DELETE`), no
  `CREATE`/`ALTER`/`DROP`/`GRANT`. This is what the running Express server
  connects as in production.

The code side of this is already done — `backend/src/config/migrate.js` now
opens its own pool from `DB_MIGRATE_USER`/`DB_MIGRATE_PASSWORD` (falling
back to `DB_USER`/`DB_PASSWORD` if unset, so nothing breaks until you do
this), completely separate from the server's pool in `config/db.js`. What's
left is creating the actual Postgres roles on your real database — that
requires DB admin access I don't have from here, so it's on you (or
whoever holds the DB credentials) to run.

## Steps

1. **Take a backup first.** `pg_dump` your production database before
   touching roles/ownership. This is a low-risk change, but "low-risk" and
   "backed up" should always travel together.

2. **Copy `backend/src/config/roles.sql.example` to `roles.sql`** (the real
   `roles.sql` is gitignored — it will contain live passwords once you fill
   it in, same handling as `.env`) and replace the two placeholder passwords
   (`REPLACE_WITH_STRONG_SECRET_OWNER` / `REPLACE_WITH_STRONG_SECRET_APP`)
   with real, randomly generated secrets. Don't reuse any existing password.

3. **Find out who currently owns your tables.** Connect as your existing
   admin/superuser and run:
   ```sql
   SELECT tableowner, COUNT(*) FROM pg_tables WHERE schemaname = 'public' GROUP BY tableowner;
   ```
   If everything is owned by some role other than `interns_owner` (likely —
   e.g. `postgres`, or whatever role you've been running migrate.js as),
   you'll reassign ownership after creating `interns_owner` (step 5).

4. **Run `roles.sql` against your production database**, connected as a
   superuser or the current owning role:
   ```
   psql -U <your_current_admin_user> -d <your_db_name> -f backend/src/config/roles.sql
   ```
   This creates both roles and grants `interns_app` DML on every existing
   table, plus a default-privileges rule so future tables (created by later
   migrations, run as `interns_owner`) are automatically granted too.

5. **Reassign table ownership to `interns_owner`** (if step 3 showed tables
   owned by a different role). Run `reassign_ownership.sql` (in the same
   directory as `roles.sql`), not `REASSIGN OWNED BY <role> TO interns_owner`
   — the latter fails with `cannot reassign ownership of objects owned by
   role postgres because they are required by the database system` when the
   current owner is the bootstrap `postgres` superuser, because it tries to
   move cluster-level objects too, not just your tables:
   ```
   psql -U <your_current_admin_user> -d <your_db_name> -f backend/src/config/reassign_ownership.sql
   ```
   This moves ownership of just your tables, their sequences, and any
   functions (e.g. `bump_version()`) to `interns_owner` — nothing else.

6. **Update your production environment variables:**
   - `DB_USER=interns_app`, `DB_PASSWORD=<the interns_app password>` — in
     whatever env config the *running server* reads (your process manager,
     Docker env, hosting platform's env panel, etc).
   - `DB_MIGRATE_USER=interns_owner`, `DB_MIGRATE_PASSWORD=<the interns_owner password>`
     — set these only in the environment you run `node src/config/migrate.js`
     from (your deploy script/CI job), not in the server's runtime env. The
     server process should never have the owner password available to it at
     all — if it's compromised, it shouldn't be able to read a credential
     that can drop tables even indirectly via `process.env`.

7. **Verify the restriction actually holds** before trusting it. Connect as
   `interns_app` and confirm DDL is refused:
   ```
   psql -U interns_app -d <your_db_name> -c "DROP TABLE interns;"
   ```
   This should fail with a permission-denied error. If it succeeds, stop —
   something in steps 4–5 didn't take, most likely table ownership wasn't
   reassigned to `interns_owner` in step 5.

8. **Redeploy the server** with the new `DB_USER`/`DB_PASSWORD`, and confirm
   normal app operation (login, list interns, create a task, etc. — regular
   DML) still works. Then run a migration once with `DB_MIGRATE_USER` set to
   confirm that path still works too.

9. **Rotate out the old shared credential** once you've confirmed both
   paths work — don't leave the original superuser/owner password sitting
   around as a working fallback.

## What this does *not* protect against

This is defense-in-depth for the database layer specifically. It doesn't
replace parameterized queries (still required — a DML-only role can still
run `DELETE FROM interns` with no `WHERE` clause if a query is malformed),
doesn't replace the `organization_id` scoping already enforced in every
model method, and doesn't protect the `interns_owner` credential itself —
that one still needs to be treated as sensitive as any other DB admin
password, just used rarely (deploys/migrations only) rather than sitting in
the live server's memory on every request.
