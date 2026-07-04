const pool = require('../config/db');

const resolveUpdateOutcome = async (updateResult, existsQuery, existsParams) => {
  if (updateResult.rows[0]) return updateResult.rows[0];
  const exists = await pool.query(existsQuery, existsParams);
  return exists.rows[0] ? { conflict: true } : null;
};

const LocationModel = {
  getAll: async (organizationId) => {
    const result = await pool.query(
      'SELECT * FROM locations WHERE organization_id = $1 ORDER BY name ASC',
      [organizationId]
    );
    return result.rows;
  },

  getAllActive: async (organizationId) => {
    const result = await pool.query(
      'SELECT * FROM locations WHERE organization_id = $1 AND is_active = TRUE ORDER BY name ASC',
      [organizationId]
    );
    return result.rows;
  },

  getById: async (organizationId, id) => {
    const result = await pool.query(
      'SELECT * FROM locations WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    return result.rows[0];
  },

  create: async (organizationId, { name, latitude, longitude, radius_meters }) => {
    const result = await pool.query(
      `INSERT INTO locations (name, latitude, longitude, radius_meters, organization_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), latitude, longitude, radius_meters || 80, organizationId]
    );
    return result.rows[0];
  },

  update: async (organizationId, id, { name, latitude, longitude, radius_meters, expectedVersion }) => {
    const result = await pool.query(
      `UPDATE locations SET name=$1, latitude=$2, longitude=$3, radius_meters=$4
       WHERE id=$5 AND organization_id=$6 AND version=$7 RETURNING *`,
      [name.trim(), latitude, longitude, radius_meters || 80, id, organizationId, expectedVersion]
    );
    return resolveUpdateOutcome(
      result,
      'SELECT id FROM locations WHERE id=$1 AND organization_id=$2',
      [id, organizationId]
    );
  },

  setActive: async (organizationId, id, isActive, expectedVersion) => {
    const result = await pool.query(
      'UPDATE locations SET is_active = $1 WHERE id = $2 AND organization_id = $3 AND version = $4 RETURNING *',
      [isActive, id, organizationId, expectedVersion]
    );
    return resolveUpdateOutcome(
      result,
      'SELECT id FROM locations WHERE id=$1 AND organization_id=$2',
      [id, organizationId]
    );
  },

  // Not version-checked — a set-membership operation across many intern
  // rows, not a single-row edit, so optimistic locking doesn't map cleanly
  // onto it the way it does for update()/setActive().
  //
  // Uses the current request's RLS-scoped client (see config/db.js) rather
  // than pool.connect() -- `locations` and `interns` both have Row-Level
  // Security enabled, and a freshly pool.connect()'d client has no
  // app.current_org_id GUC set, which would make this transaction see zero
  // rows for either table. This function is only ever called from an
  // authenticated admin route, so a scoped client is always present; it is
  // NOT released here -- it's the shared per-request client, released by
  // authMiddleware once the response finishes, not owned by this call.
  assignInterns: async (organizationId, locationId, internIds) => {
    const client = pool.getCurrentClient();
    if (!client) throw new Error('assignInterns requires an active request-scoped DB client');
    try {
      await client.query('BEGIN');
      // Confirm the location belongs to this org before touching anything.
      const locCheck = await client.query(
        'SELECT id FROM locations WHERE id = $1 AND organization_id = $2',
        [locationId, organizationId]
      );
      if (!locCheck.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await client.query(
        'UPDATE interns SET location_id = NULL WHERE location_id = $1 AND organization_id = $2',
        [locationId, organizationId]
      );
      if (internIds.length > 0) {
        await client.query(
          'UPDATE interns SET location_id = $1 WHERE id = ANY($2::int[]) AND organization_id = $3',
          [locationId, internIds, organizationId]
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  },
};

module.exports = LocationModel;
