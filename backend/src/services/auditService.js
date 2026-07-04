const pool = require('../config/db');

// Fire-and-forget, same pattern as slackService/emailService calls elsewhere
// in this codebase: audit logging must never block or fail the request that
// triggered it. Callers should call this without awaiting, or await it but
// swallow errors with .catch(() => {}) — never let it throw into the
// response path.
//
// organizationId is required (not optional) — an audit row without it is
// itself a cross-tenant leak risk (org A's admin querying audit_logs could
// see org B's rows if this were ever left off).
//
// changedFields should be a plain object of the fields that were written
// (not the full row) — e.g. { status: 'approved', score: 90 }. Keep it to
// what actually changed, not secrets (passwords, tokens, face_descriptor).
const logAudit = async ({ organizationId, actorId, actorRole, action, entityType, entityId, changedFields }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (organization_id, actor_id, actor_role, action, entity_type, entity_id, changed_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [organizationId ?? null, actorId ?? null, actorRole ?? null, action, entityType, entityId ?? null, changedFields ? JSON.stringify(changedFields) : null]
    );
  } catch (err) {
    // Deliberately not rethrown — see comment above. Logged so a broken
    // audit_logs table doesn't fail silently forever.
    console.error('Audit log write failed:', err.message);
  }
};

module.exports = { logAudit };
