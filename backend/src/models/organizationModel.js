const pool = require('../config/db');

const OrganizationModel = {
  getAll: async () => {
    const result = await pool.query('SELECT * FROM organizations ORDER BY id ASC');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
    return result.rows[0];
  },

  updateSlackConfig: async (id, { slack_enabled, slack_channel_id }) => {
    const result = await pool.query(
      `UPDATE organizations SET
        slack_enabled = COALESCE($1, slack_enabled),
        slack_channel_id = COALESCE($2, slack_channel_id)
       WHERE id = $3 RETURNING *`,
      [slack_enabled ?? null, slack_channel_id ?? null, id]
    );
    return result.rows[0];
  },
};

module.exports = OrganizationModel;