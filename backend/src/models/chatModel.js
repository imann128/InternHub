const pool = require('../config/db');

const ChatModel = {
  getMessages: async (organizationId, intern_id) => {
    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE organization_id = $1 AND (intern_id = $2 OR is_announcement = TRUE)
       ORDER BY created_at ASC`,
      [organizationId, intern_id]
    );
    return result.rows;
  },

  getAnnouncements: async (organizationId) => {
    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE organization_id = $1 AND is_announcement = TRUE
       ORDER BY created_at DESC`,
      [organizationId]
    );
    return result.rows;
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
      WHERE i.organization_id = $1
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