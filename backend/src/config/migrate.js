require('dotenv').config();
const { Pool } = require('pg');

// Migrations run DDL (CREATE/ALTER TABLE, CREATE INDEX) and so need a role
// with schema-owner privileges. That role must never be the same one the
// running server connects as (see roles.sql for why) -- so this file gets
// its own dedicated pool instead of reusing ./db's pool.
//
// DB_MIGRATE_USER/DB_MIGRATE_PASSWORD fall back to DB_USER/DB_PASSWORD so
// this doesn't break for anyone who hasn't run roles.sql yet -- but once
// you have, set DB_MIGRATE_USER=interns_owner in your environment (not
// necessarily in the same .env the server reads, since the server should
// never see the owner password) and this script will use the elevated
// role while the running app keeps using the restricted one.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_MIGRATE_USER || process.env.DB_USER,
  password: process.env.DB_MIGRATE_PASSWORD || process.env.DB_PASSWORD,
});

const migrate = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS interns (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        department VARCHAR(100) NOT NULL,
        joining_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(10) DEFAULT 'active',
        password VARCHAR(255),
        face_descriptor TEXT,
        face_verified BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        intern_id INTEGER REFERENCES interns(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        priority VARCHAR(10) DEFAULT 'medium',
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        intern_id INTEGER REFERENCES interns(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        status VARCHAR(20) NOT NULL,
        check_in TIME,
        check_out TIME,
        total_hours NUMERIC(5,2),
        source VARCHAR(10),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (intern_id, date)
      );

      CREATE TABLE IF NOT EXISTS task_comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        intern_id INTEGER REFERENCES interns(id) ON DELETE CASCADE,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'submitted',
        score INTEGER,
        feedback TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS submission_files (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
        file_name VARCHAR(255),
        storage_key VARCHAR(255),
        mime_type VARCHAR(100),
        file_size INTEGER,
        checksum_sha256 VARCHAR(64),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        sender_role VARCHAR(10) NOT NULL,
        intern_id INTEGER REFERENCES interns(id) ON DELETE CASCADE,
        message TEXT,
        file_url VARCHAR(500),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        is_announcement BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS locations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        radius_meters INTEGER NOT NULL DEFAULT 80,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ALTER statements for columns added after the tables may have already
    // existed in a running database -- CREATE TABLE IF NOT EXISTS above won't
    // retrofit these onto a pre-existing table.
    await pool.query(`
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS face_descriptor TEXT;
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS face_verified BOOLEAN DEFAULT FALSE;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source VARCHAR(10);
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL;
      ALTER TABLE submission_files ADD COLUMN IF NOT EXISTS file_size INTEGER;
      ALTER TABLE submission_files ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64);
    `);

    // Multi-tenant support: organizations table + nullable organization_id
    // columns on every tenant-owned table. Nullable for now so this deploys
    // safely against existing data. A one-off backfill script (not part of
    // migrate.js) will set organization_id on all existing rows, then a
    // later migrate.js change tightens these to NOT NULL.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slack_bot_token VARCHAR(255),
        slack_channel_id VARCHAR(100),
        slack_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE admins ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE attendance ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE submission_files ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
      ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
    `);

    // admin_invite_code: lets an existing admin invite a co-worker into the
    // SAME organization as a second admin (signup with this code skips
    // creating a brand-new org and skips the global ADMIN_SIGNUP_KEY check).
    // groq_api_key: optional per-org Groq key so AI features work without
    // relying on the server-wide GROQ_API_KEY env var; aiController falls
    // back to the server key, then degrades gracefully if neither is set.
    await pool.query(`
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS admin_invite_code VARCHAR(64) UNIQUE;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS groq_api_key VARCHAR(255);
    `);
    // --- Optimistic locking: a `version` column on every table that admins
    // edit concurrently (interns, tasks, submissions, locations). A
    // BEFORE UPDATE trigger bumps it automatically on every row update, so
    // application code never has to manually increment it -- it only needs
    // to include `AND version = $N` in its UPDATE's WHERE clause (alongside
    // the existing `AND organization_id = $M` scoping -- both conditions
    // must hold) and treat 0 affected rows as a conflict (409), not a
    // silent no-op. Deliberately NOT added to `attendance` (upsert/check-in
    // flow, not a concurrently-hand-edited resource in the same way) or
    // `admins` (no update path exists for admin rows today).
    await pool.query(`
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

      CREATE OR REPLACE FUNCTION bump_version() RETURNS TRIGGER AS $BODY$
      BEGIN
        NEW.version = OLD.version + 1;
        RETURN NEW;
      END;
      $BODY$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_bump_version ON interns;
      CREATE TRIGGER trg_bump_version BEFORE UPDATE ON interns
        FOR EACH ROW EXECUTE FUNCTION bump_version();

      DROP TRIGGER IF EXISTS trg_bump_version ON tasks;
      CREATE TRIGGER trg_bump_version BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION bump_version();

      DROP TRIGGER IF EXISTS trg_bump_version ON submissions;
      CREATE TRIGGER trg_bump_version BEFORE UPDATE ON submissions
        FOR EACH ROW EXECUTE FUNCTION bump_version();

      DROP TRIGGER IF EXISTS trg_bump_version ON locations;
      CREATE TRIGGER trg_bump_version BEFORE UPDATE ON locations
        FOR EACH ROW EXECUTE FUNCTION bump_version();
    `);

    // --- Soft delete: `deleted_at` instead of removing rows, so history
    // (past tasks, past locations, a since-removed intern's attendance
    // record) survives. The plain UNIQUE constraint on interns.email would
    // otherwise block re-adding an intern with the same email after they're
    // "deleted" -- replaced here with a partial unique index that only
    // applies to non-deleted rows, so the email frees up once soft-deleted.
    // Intentionally NOT scoped by organization_id -- email is globally
    // unique across all orgs by design (see AdminModel/InternModel
    // findByEmail, used at login before organization_id is even known).
    await pool.query(`
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
      ALTER TABLE locations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

      ALTER TABLE interns DROP CONSTRAINT IF EXISTS interns_email_key;
      CREATE UNIQUE INDEX IF NOT EXISTS interns_email_active_idx
        ON interns(email) WHERE deleted_at IS NULL;
    `);

    // --- Self-service settings: notification/sound preferences an intern
    // can toggle from their own Settings page. Both default true (opt-out,
    // not opt-in) so behavior doesn't silently change for existing interns
    // who've never touched these settings.
    await pool.query(`
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS chat_sound BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    // --- Data consent record. Face descriptor + GPS check-in location are
    // sensitive personal data (biometric + location), so interns need to
    // affirmatively consent before that data is collected, and the app
    // needs an auditable record of when/which policy version they accepted
    // -- not just a client-side flag a browser refresh could lose.
    // consent_version lets a future policy change re-prompt only interns
    // who accepted an older version, instead of nulling everyone's consent.
    await pool.query(`
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMP;
      ALTER TABLE interns ADD COLUMN IF NOT EXISTS consent_version VARCHAR(20);
    `);

    // --- Audit logging. Unlike sessions/token_blacklist below, this table
    // gets its own `organization_id` column directly (not just derivable
    // via actor_id) so a per-org audit trail can be queried without a join,
    // and so org A's admin can never end up looking at org B's audit rows
    // through any code path that forgets the join.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        actor_id INTEGER,
        actor_role VARCHAR(10),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER,
        changed_fields JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS audit_logs_org_idx ON audit_logs(organization_id, created_at DESC);
    `);

    // --- Refresh tokens + session revocation. `sessions` holds one row per
    // issued refresh token, hashed (never the raw value) so a DB read alone
    // can't be replayed as a live session. Refresh is single-use: rotating
    // a session marks the old row revoked_at and inserts a new one, rather
    // than reusing/updating in place, so token-reuse (a stolen+replayed old
    // refresh token) is detectable. Not organization-scoped directly --
    // actor_id + actor_role is enough to look a session up, and the actor's
    // own organization_id is fetched fresh from their admin/intern row on
    // every request rather than trusted from an old session. `token_blacklist`
    // exists only so logout can immediately kill the still-live short-lived
    // access token instead of waiting out its ~15min natural expiry --
    // entries are looked up by jti and are safe to prune once past expires_at.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        actor_id INTEGER NOT NULL,
        actor_role VARCHAR(10) NOT NULL,
        refresh_token_hash VARCHAR(64) NOT NULL,
        user_agent TEXT,
        ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS sessions_refresh_hash_idx ON sessions(refresh_token_hash);
      CREATE INDEX IF NOT EXISTS sessions_actor_idx ON sessions(actor_id, actor_role);

      CREATE TABLE IF NOT EXISTS token_blacklist (
        jti UUID PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL
      );
    `);

    // --- Indexes. None of the multi-tenancy ALTER TABLEs above added an
    // index on the organization_id column they introduced -- every single
    // query in every model filters or joins on organization_id, so without
    // one, each of those becomes a full sequential table scan once a table
    // grows past a few thousand rows. Composite indexes below lead with
    // organization_id and add the next-most-common filter column from the
    // actual WHERE clauses in the model files, so the org_id-only case is
    // still served by the same index (leftmost-prefix). Postgres also
    // doesn't auto-index foreign key columns (unlike some other databases),
    // so a few of those are added directly where nothing else already
    // covers them.
    await pool.query(`
      CREATE INDEX IF NOT EXISTS interns_org_status_idx ON interns(organization_id, status);
      CREATE INDEX IF NOT EXISTS interns_org_department_idx ON interns(organization_id, department);
      CREATE INDEX IF NOT EXISTS interns_location_idx ON interns(location_id);

      -- Partial index for retentionService.js's daily scan for
      -- long-soft-deleted interns -- WHERE deleted_at IS NOT NULL keeps this
      -- tiny (only ever matches soft-deleted rows) rather than indexing
      -- every active intern's NULL deleted_at for no benefit.
      CREATE INDEX IF NOT EXISTS interns_org_deleted_at_idx ON interns(organization_id, deleted_at) WHERE deleted_at IS NOT NULL;

      CREATE INDEX IF NOT EXISTS tasks_org_status_idx ON tasks(organization_id, status);
      CREATE INDEX IF NOT EXISTS tasks_org_intern_idx ON tasks(organization_id, intern_id);

      -- attendance.intern_id is already covered by the UNIQUE(intern_id, date)
      -- constraint's implicit index (leftmost-prefix serves intern_id-only
      -- lookups too) -- only the organization_id + date filter pattern used
      -- by getAll()/getWeeklySummary() needs a new index here.
      CREATE INDEX IF NOT EXISTS attendance_org_date_idx ON attendance(organization_id, date);

      CREATE INDEX IF NOT EXISTS submissions_org_task_idx ON submissions(organization_id, task_id);
      CREATE INDEX IF NOT EXISTS submissions_org_intern_idx ON submissions(organization_id, intern_id);
      CREATE INDEX IF NOT EXISTS submissions_org_status_idx ON submissions(organization_id, status);

      CREATE INDEX IF NOT EXISTS submission_files_org_idx ON submission_files(organization_id);
      CREATE INDEX IF NOT EXISTS submission_files_submission_idx ON submission_files(submission_id);

      CREATE INDEX IF NOT EXISTS locations_org_idx ON locations(organization_id);

      -- Covers getMessages() (intern_id + chronological order) and
      -- getAnnouncements()/getAllConversations() (is_announcement filter).
      CREATE INDEX IF NOT EXISTS chat_messages_org_intern_idx ON chat_messages(organization_id, intern_id, created_at);
      CREATE INDEX IF NOT EXISTS chat_messages_org_announcement_idx ON chat_messages(organization_id, is_announcement, created_at);

      CREATE INDEX IF NOT EXISTS task_comments_org_task_idx ON task_comments(organization_id, task_id);
    `);

    console.log('Migration successful');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed', err);
    process.exit(1);
  }
};

migrate();
