const pool = require('../config/db');

const FILES_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', f.id,
        'file_name', f.file_name,
        'storage_key', f.storage_key,
        'mime_type', f.mime_type,
        'size', f.size
      )
    ) FILTER (WHERE f.id IS NOT NULL),
    '[]'
  ) as files
`;

const SubmissionModel = {
  getAll: async ({ task_id, intern_id, status }) => {
    let query = `
      SELECT s.*, t.title as task_title, i.name as intern_name, ${FILES_AGG}
      FROM submissions s
      LEFT JOIN tasks t ON t.id = s.task_id
      LEFT JOIN interns i ON i.id = s.intern_id
      LEFT JOIN submission_files f ON f.submission_id = s.id
      WHERE 1=1
    `;
    const params = [];
    if (task_id) { params.push(task_id); query += ` AND s.task_id = $${params.length}`; }
    if (intern_id) { params.push(intern_id); query += ` AND s.intern_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND s.status = $${params.length}`; }
    query += ' GROUP BY s.id, t.title, i.name ORDER BY s.created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  },

  getById: async (id) => {
    const result = await pool.query(
      `SELECT s.*, t.title as task_title, i.name as intern_name, ${FILES_AGG}
       FROM submissions s
       LEFT JOIN tasks t ON t.id = s.task_id
       LEFT JOIN interns i ON i.id = s.intern_id
       LEFT JOIN submission_files f ON f.submission_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, t.title, i.name`,
      [id]
    );
    return result.rows[0];
  },

  create: async ({ task_id, intern_id, notes }) => {
    // The task must exist and actually be assigned to this intern — otherwise
    // an intern could submit work against any task_id.
    const taskCheck = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND intern_id = $2',
      [task_id, intern_id]
    );
    if (!taskCheck.rows[0]) return null;

    const result = await pool.query(
      `INSERT INTO submissions (task_id, intern_id, notes, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [task_id, intern_id, notes || null]
    );
    return result.rows[0];
  },

  addFiles: async (submissionId, files) => {
    for (const file of files) {
      await pool.query(
        `INSERT INTO submission_files (submission_id, file_name, storage_key, mime_type, size)
         VALUES ($1, $2, $3, $4, $5)`,
        [submissionId, file.originalname, file.filename, file.mimetype, file.size]
      );
    }
  },

  review: async (id, { status, score, feedback }) => {
    if (!['approved', 'rejected', 'revision_requested'].includes(status)) return null;
    const result = await pool.query(
      `UPDATE submissions SET
        status      = $1,
        score       = COALESCE($2, score),
        feedback    = COALESCE($3, feedback),
        reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4 RETURNING *`,
      [status, score ?? null, feedback ?? null, id]
    );
    return result.rows[0];
  },
};

module.exports = SubmissionModel;
