const pool = require('../config/db');

const FILES_AGG = `
  COALESCE(
    json_agg(
      json_build_object(
        'id', f.id,
        'file_name', f.file_name,
        'storage_key', f.storage_key,
        'mime_type', f.mime_type,
        'size', f.file_size
      )
    ) FILTER (WHERE f.id IS NOT NULL),
    '[]'
  ) as files
`;

const SubmissionModel = {
  getAll: async (organizationId, { task_id, intern_id, status }) => {
    let query = `
      SELECT s.*, t.title as task_title, i.name as intern_name, ${FILES_AGG}
      FROM submissions s
      LEFT JOIN tasks t ON t.id = s.task_id
      LEFT JOIN interns i ON i.id = s.intern_id
      LEFT JOIN submission_files f ON f.submission_id = s.id
      WHERE s.organization_id = $1
    `;
    const params = [organizationId];
    if (task_id) { params.push(task_id); query += ` AND s.task_id = $${params.length}`; }
    if (intern_id) { params.push(intern_id); query += ` AND s.intern_id = $${params.length}`; }
    if (status) { params.push(status); query += ` AND s.status = $${params.length}`; }
    query += ' GROUP BY s.id, t.title, i.name ORDER BY s.created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  },

  getById: async (organizationId, id) => {
    const result = await pool.query(
      `SELECT s.*, t.title as task_title, i.name as intern_name, ${FILES_AGG}
       FROM submissions s
       LEFT JOIN tasks t ON t.id = s.task_id
       LEFT JOIN interns i ON i.id = s.intern_id
       LEFT JOIN submission_files f ON f.submission_id = s.id
       WHERE s.id = $1 AND s.organization_id = $2
       GROUP BY s.id, t.title, i.name`,
      [id, organizationId]
    );
    return result.rows[0];
  },

  create: async (organizationId, { task_id, intern_id, notes }) => {
    // The task must exist, belong to this org, and be assigned to this intern.
    const taskCheck = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND intern_id = $2 AND organization_id = $3',
      [task_id, intern_id, organizationId]
    );
    if (!taskCheck.rows[0]) return null;

    const result = await pool.query(
      `INSERT INTO submissions (task_id, intern_id, notes, status, organization_id)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [task_id, intern_id, notes || null, organizationId]
    );
    return result.rows[0];
  },

  addFiles: async (organizationId, submissionId, files) => {
    // Confirm the submission belongs to this org before attaching files to it.
    const ownCheck = await pool.query(
      'SELECT id FROM submissions WHERE id = $1 AND organization_id = $2',
      [submissionId, organizationId]
    );
    if (!ownCheck.rows[0]) return null;

    for (const file of files) {
      await pool.query(
        `INSERT INTO submission_files (submission_id, file_name, storage_key, mime_type, file_size, organization_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [submissionId, file.originalname, `${organizationId}/${file.filename}`, file.mimetype, file.size, organizationId]
      );
    }
    return true;
  },

  review: async (organizationId, id, { status, score, feedback }) => {
    if (!['approved', 'rejected', 'revision_requested'].includes(status)) return null;
    const result = await pool.query(
      `UPDATE submissions SET
        status      = $1,
        score       = COALESCE($2, score),
        feedback    = COALESCE($3, feedback),
        reviewed_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND organization_id = $5 RETURNING *`,
      [status, score ?? null, feedback ?? null, id, organizationId]
    );
    return result.rows[0];
  },
};

module.exports = SubmissionModel;