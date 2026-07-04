const pool = require('../config/db');
const { parsePagination, buildMeta } = require('../utils/pagination');

const ChatModel = {
  // Returns the most recent `limit` messages (page 1 = most recent),
  // re-sorted back to chronological order for display -- opening a
  // conversation with months of history no longer means loading every
  // message that was ever sent in it.
  getMessages: async (organizationId, intern_id, { page, limit } = {}) => {
    const { page: pageNum, limit: limitNum, offset } = parsePagination({ page, limit }, { defaultLimit: 50, maxLimit: 200 });

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM chat_messages WHERE organization_id = $1 AND (intern_id = $2 OR is_announcement = TRUE)`,
      [organizationId, intern_id]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE organization_id = $1 AND (intern_id = $2 OR is_announcement = TRUE)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [organizationId, intern_id, limitNum, offset]
    );
    return { rows: result.rows.reverse(), pagination: buildMeta(total, pageNum, limitNum) };
  },

  getAnnouncements: async (organizationId, { page, limit } = {}) => {
    const { page: pageNum, limit: limitNum, offset } = parsePagination({ page, limit }, { defaultLimit: 50, maxLimit: 200 });

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM chat_messages WHERE organization_id = $1 AND is_announcement = TRUE`,
      [organizationId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE organization_id = $1 AND is_announcement = TRUE
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [organizationId, limitNum, offset]
    );
    return { rows: result.rows, pagination: buildMeta(total, pageNum, limitNum) };
  },

  getAllConversations: async (organizationId) => {
    const result = await pool.query(`
      SELECT DISTINCT ON (i.id)
        i.id as intern_id,
        i.name as intern_name,
        i.department,
        cm.message as last_message,
        cm.created_at as last_message_time,
        cm.sender_role,
        cm.file_name
      FROM interns i
      LEFT JOIN chat_messages cm ON cm.intern_id = i.id AND cm.is_announcement = FALSE AND cm.organization_id = $1
      WHERE i.organization_id = $1 AND i.deleted_at IS NULL
      ORDER BY i.id, cm.created_at DESC
    `, [organizationId]);
    return result.rows;
  },

  sendMessage: async (organizationId, { sender_role, intern_id, message, file_url, file_name, file_type, is_announcement }) => {
    const result = await pool.query(
      `INSERT INTO chat_messages 
       (sender_role, intern_id, message, file_url, file_name, file_type, is_announcement, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [sender_role, intern_id || null, message || null, file_url || null, file_name || null, file_type || null, is_announcement || false, organizationId]
    );
    return result.rows[0];
  },

  deleteMessage: async (organizationId, id) => {
    const result = await pool.query(
      'DELETE FROM chat_messages WHERE id=$1 AND organization_id=$2 RETURNING *',
      [id, organizationId]
    );
    return result.rows[0];
  },
};

module.exports = ChatModel;
