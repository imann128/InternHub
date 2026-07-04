const crypto = require('crypto');
const pool = require('../config/db');

const generateCode = () => crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars

const OrganizationModel = {
  getAll: async () => {
    const result = await pool.query('SELECT * FROM organizations ORDER BY id ASC');
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query('SELECT * FROM organizations WHERE id = $1', [id]);
    return result.rows[0];
  },

  findByInviteCode: async (code) => {
    const result = await pool.query('SELECT * FROM organizations WHERE admin_invite_code = $1', [code]);
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

  // Regenerates the org's invite code, invalidating any previously shared
  // one. Retries a handful of times on the (astronomically unlikely) chance
  // two orgs land on the same 10-char random code, since the column is
  // UNIQUE.
  regenerateInviteCode: async (id) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      try {
        const result = await pool.query(
          `UPDATE organizations SET admin_invite_code = $1 WHERE id = $2 RETURNING *`,
          [code, id]
        );
        return result.rows[0];
      } catch (err) {
        if (err.code !== '23505') throw err; // unique_violation -> retry with a new code
      }
    }
    throw new Error('Could not generate a unique invite code, please try again.');
  },

  updateGroqKey: async (id, groqApiKey) => {
    const result = await pool.query(
      `UPDATE organizations SET groq_api_key = $1 WHERE id = $2 RETURNING *`,
      [groqApiKey || null, id]
    );
    return result.rows[0];
  },
};

module.exports = OrganizationModel;
