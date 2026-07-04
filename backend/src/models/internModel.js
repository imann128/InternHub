const pool = require('../config/db');
const { parsePagination, buildMeta } = require('../utils/pagination');

// Same 404-vs-409 contract used across every versioned model in this app:
// 0 affected rows from the UPDATE could mean "not found" or "version
// conflict" -- a follow-up existence check (still org-scoped) disambiguates.
const resolveUpdateOutcome = async (updateResult, existsQuery, existsParams) => {
  if (updateResult.rows[0]) return updateResult.rows[0];
  const exists = await pool.query(existsQuery, existsParams);
  return exists.rows[0] ? { conflict: true } : null;
};

const InternModel = {
  getAll: async (organizationId, { search, department, status, page, limit }) => {
    let filterSql = '';
    const params = [organizationId];

    if (search) {
      params.push(`%${search}%`);
      filterSql += ` AND name ILIKE $${params.length}`;
    }
    if (department) {
      params.push(department);
      filterSql += ` AND department = $${params.length}`;
    }
    if (status) {
      params.push(status);
      filterSql += ` AND interns.status = $${params.length}`;
    }

    const baseWhere = 'WHERE organization_id = $1 AND deleted_at IS NULL' + filterSql;

    // Count runs with the exact same filters, before limit/offset are
    // pushed onto params, so the page controls on the frontend know the
    // true total instead of just "however many rows came back this page."
    const countResult = await pool.query(`SELECT COUNT(*) FROM interns ${baseWhere}`, params);
    const total = parseInt(countResult.rows[0].count, 10);

    const { page: pageNum, limit: limitNum, offset } = parsePagination({ page, limit });
    params.push(limitNum, offset);
    const result = await pool.query(
      `SELECT interns.* FROM interns ${baseWhere} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { rows: result.rows, pagination: buildMeta(total, pageNum, limitNum) };
  },

  getProfile: async (organizationId, id) => {
    const internResult = await pool.query(
      'SELECT * FROM interns WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, organizationId]
    );
    if (!internResult.rows[0]) return null;

    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE intern_id = $1 AND organization_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC',
      [id, organizationId]
    );

    const attendanceResult = await pool.query(
      `SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN attendance.status = 'absent' THEN 1 END) as absent_days,
        COALESCE(SUM(total_hours), 0) as total_hours
      FROM attendance WHERE intern_id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    const recentAttendance = await pool.query(
      'SELECT * FROM attendance WHERE intern_id = $1 AND organization_id = $2 ORDER BY date DESC LIMIT 7',
      [id, organizationId]
    );

    return {
      intern: internResult.rows[0],
      tasks: tasksResult.rows,
      stats: attendanceResult.rows[0],
      recentAttendance: recentAttendance.rows,
    };
  },

  getById: async (organizationId, id) => {
    const result = await pool.query(
      'SELECT * FROM interns WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, organizationId]
    );
    return result.rows[0];
  },

  create: async (organizationId, { name, email, department, joining_date, location_id }) => {
    const bcrypt = require('bcryptjs');
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(tempPassword, 12);
    const result = await pool.query(
      'INSERT INTO interns (name, email, department, joining_date, password, location_id, organization_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name.trim(), email.trim().toLowerCase(), department.trim(), joining_date, hashed, location_id || null, organizationId]
    );
    return { ...result.rows[0], tempPassword };
  },

  update: async (organizationId, id, { name, email, department, joining_date, status, location_id, expectedVersion }) => {
    const result = await pool.query(
      `UPDATE interns SET name=$1, email=$2, department=$3, joining_date=$4, status=COALESCE($5,status),
       location_id=$6 WHERE id=$7 AND organization_id=$8 AND deleted_at IS NULL AND version=$9 RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), department.trim(), joining_date, status || null, location_id || null, id, organizationId, expectedVersion]
    );
    return resolveUpdateOutcome(
      result,
      'SELECT id FROM interns WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',
      [id, organizationId]
    );
  },

  delete: async (organizationId, id) => {
    const result = await pool.query(
      'UPDATE interns SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL RETURNING *',
      [id, organizationId]
    );
    return result.rows[0];
  },

  emailExists: async (email, excludeId = null) => {
    // Global check by design -- email is unique across all orgs, not per-org.
    // `interns` has Row-Level Security enabled (migrate.js) -- a plain
    // SELECT here would only ever see the caller's own organization once
    // the app connects as the restricted interns_app role, which defeats
    // the point of a global uniqueness check. Goes through a SECURITY
    // DEFINER function instead, which runs with the table owner's
    // privileges (bypassing RLS) for this one legitimate cross-tenant
    // check, and nothing else.
    const result = await pool.query(
      'SELECT intern_email_exists($1, $2) AS exists',
      [email.trim().toLowerCase(), excludeId]
    );
    return result.rows[0].exists;
  },

  toggleStatus: async (organizationId, id) => {
    const result = await pool.query(
      `UPDATE interns SET status = CASE WHEN status='active' THEN 'inactive' ELSE 'active' END
      WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL RETURNING *`,
      [id, organizationId]
    );
    return result.rows[0];
  },

  findByEmail: async (email) => {
    // Global lookup by design -- used at login before organization_id is
    // known. Same SECURITY DEFINER bypass as emailExists above, for the
    // same reason -- see intern_find_by_email in migrate.js.
    const result = await pool.query('SELECT * FROM intern_find_by_email($1)', [email.trim().toLowerCase()]);
    return result.rows[0];
  },

  saveFaceDescriptor: async (organizationId, id, descriptor) => {
    const result = await pool.query(
      'UPDATE interns SET face_descriptor = $1, face_verified = TRUE WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL RETURNING id, name, email, face_verified',
      [JSON.stringify(descriptor), id, organizationId]
    );
    return result.rows[0];
  },

  getFaceDescriptor: async (organizationId, id) => {
    const result = await pool.query(
      'SELECT face_descriptor, face_verified FROM interns WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [id, organizationId]
    );
    return result.rows[0];
  },

  // Records the intern's acceptance of the data/privacy consent notice.
  // Stamped server-side (NOW(), not a client-supplied timestamp) so it's
  // an actual audit record, not just a value the browser could fake or
  // lose on refresh. consent_version is stored alongside it so a future
  // policy revision can tell "accepted the old version" apart from "never
  // accepted at all."
  recordConsent: async (organizationId, id, version) => {
    const result = await pool.query(
      `UPDATE interns SET consent_accepted_at = CURRENT_TIMESTAMP, consent_version = $1
       WHERE id = $2 AND organization_id = $3 AND deleted_at IS NULL
       RETURNING id, consent_accepted_at, consent_version`,
      [version, id, organizationId]
    );
    return result.rows[0];
  },

  // Self-service profile edit from the intern's own Settings page — narrower
  // than the admin-side `update` above (no status/location_id changes here;
  // those stay admin-controlled). Same optimistic-lock contract as every
  // other versioned update in this app.
  updateSelf: async (organizationId, id, { name, email, department, expectedVersion }) => {
    const result = await pool.query(
      `UPDATE interns SET name=$1, email=$2, department=$3
       WHERE id=$4 AND organization_id=$5 AND deleted_at IS NULL AND version=$6 RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), department.trim(), id, organizationId, expectedVersion]
    );
    return resolveUpdateOutcome(
      result,
      'SELECT id FROM interns WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',
      [id, organizationId]
    );
  },

  verifyPassword: async (plain, hashed) => {
    const bcrypt = require('bcryptjs');
    if (!hashed) return false;
    return bcrypt.compare(plain, hashed);
  },

  changePassword: async (organizationId, id, newPassword) => {
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 12);
    const result = await pool.query(
      'UPDATE interns SET password=$1 WHERE id=$2 AND organization_id=$3 AND deleted_at IS NULL RETURNING id',
      [hashed, id, organizationId]
    );
    return result.rows[0];
  },

  getPreferences: async (organizationId, id) => {
    const result = await pool.query(
      'SELECT email_notifications, chat_sound FROM interns WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',
      [id, organizationId]
    );
    return result.rows[0];
  },

  updatePreferences: async (organizationId, id, { email_notifications, chat_sound }) => {
    const result = await pool.query(
      `UPDATE interns SET
         email_notifications = COALESCE($1, email_notifications),
         chat_sound = COALESCE($2, chat_sound)
       WHERE id=$3 AND organization_id=$4 AND deleted_at IS NULL
       RETURNING email_notifications, chat_sound`,
      [email_notifications ?? null, chat_sound ?? null, id, organizationId]
    );
    return result.rows[0];
  },

};

module.exports = InternModel;
