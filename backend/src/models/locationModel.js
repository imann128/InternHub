const pool = require('../config/db');

const LocationModel = {
  // Admin management list — includes inactive locations so they can be reactivated.
  getAll: async () => {
    const result = await pool.query('SELECT * FROM locations ORDER BY name ASC');
    return result.rows;
  },

  // Used for dropdowns (intern assignment, check-in lookups) — active only.
  getAllActive: async () => {
    const result = await pool.query('SELECT * FROM locations WHERE is_active = TRUE ORDER BY name ASC');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM locations WHERE id = $1', [id]);
    return result.rows[0];
  },

  create: async ({ name, latitude, longitude, radius_meters }) => {
    const result = await pool.query(
      `INSERT INTO locations (name, latitude, longitude, radius_meters)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), latitude, longitude, radius_meters || 80]
    );
    return result.rows[0];
  },

  update: async (id, { name, latitude, longitude, radius_meters }) => {
    const result = await pool.query(
      `UPDATE locations SET name=$1, latitude=$2, longitude=$3, radius_meters=$4
       WHERE id=$5 RETURNING *`,
      [name.trim(), latitude, longitude, radius_meters || 80, id]
    );
    return result.rows[0];
  },

  setActive: async (id, isActive) => {
    const result = await pool.query(
      'UPDATE locations SET is_active = $1 WHERE id = $2 RETURNING *',
      [isActive, id]
    );
    return result.rows[0];
  },

  // Replaces the full set of interns assigned to this location in one atomic
  // step: clears anyone currently pointing here who isn't in internIds, then
  // assigns everyone in internIds. Lets the "Manage Interns" checkbox list
  // on the admin page just send its current checked state every save.
  assignInterns: async (locationId, internIds) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE interns SET location_id = NULL WHERE location_id = $1', [locationId]);
      if (internIds.length > 0) {
        await client.query(
          'UPDATE interns SET location_id = $1 WHERE id = ANY($2::int[])',
          [locationId, internIds]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};

module.exports = LocationModel;
