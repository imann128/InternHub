const pool = require('../config/db');
const { parsePagination, buildMeta } = require('../utils/pagination');

const resolveUpdateOutcome = async (updateResult, existsQuery, existsParams) => {
  if (updateResult.rows[0]) return updateResult.rows[0];
  const exists = await pool.query(existsQuery, existsParams);
  return exists.rows[0] ? { conflict: true } : null;
};

const TaskModel = {
  getAll: async (organizationId, { status, intern_id, priority, page, limit }) => {
    let filterSql = '';
    const params = [organizationId];
    if (status)    { params.push(status);    filterSql += ` AND t.status = $${params.length}`; }
    if (intern_id) { params.push(intern_id); filterSql += ` AND t.intern_id = $${params.length}`; }
    if (priority)  { params.push(priority);  filterSql += ` AND t.priority = $${params.length}`; }

    const baseWhere = 'WHERE t.organization_id = $1 AND t.deleted_at IS NULL' + filterSql;

    // Must match the same interns join/filter as the list query below, or
    // the pagination total would count tasks that the list itself excludes.
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM tasks t JOIN interns i ON t.intern_id = i.id AND i.deleted_at IS NULL ${baseWhere}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const { page: pageNum, limit: limitNum, offset } = parsePagination({ page, limit });
    params.push(limitNum, offset);
    // JOIN (not LEFT JOIN) on interns so a task assigned to a soft-deleted
    // intern drops out of the active list entirely -- the row still exists
    // in the tasks table for audit purposes, it's just not surfaced here.
    const result = await pool.query(
      `SELECT t.*, i.name as intern_name
       FROM tasks t
       JOIN interns i ON t.intern_id = i.id AND i.deleted_at IS NULL
       ${baseWhere}
       ORDER BY t.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return { rows: result.rows, pagination: buildMeta(total, pageNum, limitNum) };
  },

  getById: async (organizationId, id) => {
    const result = await pool.query(
      `SELECT t.*, i.name as intern_name 
       FROM tasks t LEFT JOIN interns i ON t.intern_id = i.id 
       WHERE t.id = $1 AND t.organization_id = $2 AND t.deleted_at IS NULL`, [id, organizationId]
    );
    return result.rows[0];
  },

  create: async (organizationId, { intern_id, title, description, due_date, priority }) => {
    // Confirm the intern belongs to this org (and isn't soft-deleted) before
    // assigning a task to them -- otherwise a guessed intern_id could assign
    // work across organizations.
    const internCheck = await pool.query(
      'SELECT id FROM interns WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
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

  updateStatus: async (organizationId, id, { status, due_date, priority, expectedVersion }) => {
    const result = await pool.query(
      `UPDATE tasks SET
        status   = COALESCE($1, status),
        due_date = COALESCE($2, due_date),
        priority = COALESCE($3, priority)
       WHERE id = $4 AND organization_id = $5 AND deleted_at IS NULL AND version = $6 RETURNING *`,
      [status || null, due_date || null, priority || null, id, organizationId, expectedVersion]
    );
    return resolveUpdateOutcome(
      result,
      'SELECT id FROM tasks WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',
      [id, organizationId]
    );
  },

  update: async (organizationId, id, { title, description, due_date, priority, expectedVersion }) => {
    const result = await pool.query(
      `UPDATE tasks SET
        title       = COALESCE($1, title),
        description = COALESCE($2, description),
        due_date    = COALESCE($3, due_date),
        priority    = COALESCE($4, priority)
      WHERE id = $5 AND organization_id = $6 AND deleted_at IS NULL AND version = $7 RETURNING *`,
      [title || null, description || null, due_date || null, priority || null, id, organizationId, expectedVersion]
    );
    return resolveUpdateOutcome(
      result,
      'SELECT id FROM tasks WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',
      [id, organizationId]
    );
  },

  delete: async (organizationId, id) => {
    const result = await pool.query(
      'UPDATE tasks SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL RETURNING *',
      [id, organizationId]
    );
    return result.rows[0];
  },
};

module.exports = TaskModel;
