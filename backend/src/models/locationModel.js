const pool = require('../config/db');

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

  update: async (organizationId, id, { name, latitude, longitude, radius_meters }) => {
    const result = await pool.query(
      `UPDATE locations SET name=$1, latitude=$2, longitude=$3, radius_meters=$4
       WHERE id=$5 AND organization_id=$6 RETURNING *`,
      [name.trim(), latitude, longitude, radius_meters || 80, id, organizationId]
    );
    return result.rows[0];
  },

  setActive: async (organizationId, id, isActive) => {
    const result = await pool.query(
      'UPDATE locations SET is_active = $1 WHERE id = $2 AND organization_id = $3 RETURNING *',
      [isActive, id, organizationId]
    );
    return result.rows[0];
  },

  assignInterns: async (organizationId, locationId, internIds) => {
    const client = await pool.connect();
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
    } finally {
      client.release();
    }
  },
};

module.exports = LocationModel;