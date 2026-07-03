const pool = require('../config/db');

const TaskModel = {
  getAll: async (organizationId, { status, intern_id, priority }) => {
    let query = `
      SELECT t.*, i.name as intern_name 
      FROM tasks t 
      LEFT JOIN interns i ON t.intern_id = i.id 
      WHERE t.organization_id = $1
    `;
    const params = [organizationId];
    if (status)    { params.push(status);    query += ` AND t.status = $${params.length}`; }
    if (intern_id) { params.push(intern_id); query += ` AND t.intern_id = $${params.length}`; }
    if (priority)  { params.push(priority);  query += ` AND t.priority = $${params.length}`; }
    query += ' ORDER BY t.created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  },

  getById: async (organizationId, id) => {
    const result = await pool.query(
      `SELECT t.*, i.name as intern_name 
       FROM tasks t LEFT JOIN interns i ON t.intern_id = i.id 
       WHERE t.id = $1 AND t.organization_id = $2`, [id, organizationId]
    );
    return result.rows[0];
  },

  create: async (organizationId, { intern_id, title, description, due_date, priority }) => {
    // Confirm the intern belongs to this org before assigning a task to them —
    // otherwise a guessed intern_id could assign work across organizations.
    const internCheck = await pool.query(
      'SELECT id FROM interns WHERE id = $1 AND organization_id = $2',
      [intern_id, organizationId]
    );
    if (!internCheck.rows[0]) return null;

    const result = await pool.query(
      `INSERT INTO tasks (intern_id, title, description, due_date, priority, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [intern_id, title.trim(), description?.trim() || null, due_date || null, priority || 'medium', organizationId]
    );
    return result.rows[0];
  },

  updateStatus: async (organizationId, id, { status, due_date, priority }) => {
    const result = await pool.query(
      `UPDATE tasks SET
        status   = COALESCE($1, status),
        due_date = COALESCE($2, due_date),
        priority = COALESCE($3, priority)
       WHERE id = $4 AND organization_id = $5 RETURNING *`,
      [status || null, due_date || null, priority || null, id, organizationId]
    );
    return result.rows[0];
  },

  update: async (organizationId, id, { title, description, due_date, priority }) => {
    const result = await pool.query(
      `UPDATE tasks SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        due_date    = COALESCE($3, due_date),
        priority    = COALESCE($4, priority)
      WHERE id = $5 AND organization_id = $6 RETURNING *`,
      [title || null, description || null, due_date || null, priority || null, id, organizationId]
    );
    return result.rows[0];
  },

  delete: async (organizationId, id) => {
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND organization_id = $2 RETURNING *',
      [id, organizationId]
    );
    return result.rows[0];
  },
};

module.exports = TaskModel;