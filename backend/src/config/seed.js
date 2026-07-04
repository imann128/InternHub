require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const seed = async () => {
  try {
    // --- Organization ---
    // Every admin/intern row needs an organization_id -- authMiddleware and
    // /auth/refresh both treat a NULL organization_id as an unrecoverable
    // "session expired" (see backfill_organization_id.sql for the same issue
    // on pre-existing rows). Seeding without one reproduces that bug on every
    // fresh `npm run seed`, so create/reuse a seed org first and attach it to
    // both rows below.
    // `organizations.name` has no unique constraint, so this looks up first
    // rather than relying on ON CONFLICT (which needs a matching unique
    // index/constraint to target) -- re-running seed shouldn't spawn a new
    // org row every time.
    const existingOrg = await pool.query('SELECT id FROM organizations WHERE name = $1', ['Seed Organization']);
    let organizationId = existingOrg.rows[0]?.id;
    if (!organizationId) {
      const orgResult = await pool.query(
        `INSERT INTO organizations (name) VALUES ($1) RETURNING id`,
        ['Seed Organization']
      );
      organizationId = orgResult.rows[0].id;
    }

    // --- Admin ---
    const adminPasswordHash = await bcrypt.hash('Admin123!', 12);
    await pool.query(
      `INSERT INTO admins (name, email, password, organization_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, organization_id = EXCLUDED.organization_id`,
      ['Admin', 'admin@example.com', adminPasswordHash, organizationId]
    );

    // --- Intern ---
    const internPasswordHash = await bcrypt.hash('Intern123!', 12);
    await pool.query(
      // migrate.js dropped the plain UNIQUE(email) constraint on interns in
      // favor of a partial unique index (interns_email_active_idx, scoped to
      // deleted_at IS NULL) so a soft-deleted intern's email can be reused.
      // ON CONFLICT (email) alone no longer has a matching arbiter -- the
      // conflict target's predicate must match the partial index exactly.
      `INSERT INTO interns (name, email, department, joining_date, password, status, organization_id)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       ON CONFLICT (email) WHERE deleted_at IS NULL
       DO UPDATE SET password = EXCLUDED.password, organization_id = EXCLUDED.organization_id`,
      ['Aisha', 'aisha@example.com', 'Engineering', '2026-01-01', internPasswordHash, organizationId]
    );

    console.log('Seed successful');
    console.log('  Admin  -> admin@example.com / Admin123!');
    console.log('  Intern -> aisha@example.com / Intern123!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed', err);
    process.exit(1);
  }
};

seed();
