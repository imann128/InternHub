const pool = require('../config/db');

const ChatModel = {
  getMessages: async (intern_id) => {
    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE intern_id = $1 OR is_announcement = TRUE
       ORDER BY created_at ASC`,
      [intern_id]
    );
    return result.rows;
  },

  getAnnouncements: async () => {
    const result = await pool.query(
      `SELECT * FROM chat_messages 
       WHERE is_announcement = TRUE
       ORDER BY created_at DESC`
    );
    return result.rows;
  },

  getAllConversations: async () => {
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
      LEFT JOIN chat_messages cm ON cm.intern_id = i.id AND cm.is_announcement = FALSE
      ORDER BY i.id, cm.created_at DESC
    `);
    return result.rows;
  },

  sendMessage: async ({ sender_role, intern_id, message, file_url, file_name, file_type, is_announcement }) => {
    const result = await pool.query(
      `INSERT INTO chat_messages 
       (sender_role, intern_id, message, file_url, file_name, file_type, is_announcement)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [sender_role, intern_id || null, message || null, file_url || null, file_name || null, file_type || null, is_announcement || false]
    );
    return result.rows[0];
  },

  deleteMessage: async (id) => {
    const result = await pool.query('DELETE FROM chat_messages WHERE id=$1 RETURNING *', [id]);
    return result.rows[0];
  },
};

module.exports = ChatModel;