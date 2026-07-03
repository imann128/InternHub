const pool = require('../config/db');

const InternModel = {
  getAll: async (organizationId, { search, department, status }) => {
    let query = 'SELECT interns.* FROM interns WHERE organization_id = $1';
    const params = [organizationId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND name ILIKE $${params.length}`;
    }
    if (department) {
      params.push(department);
      query += ` AND department = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND interns.status = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    return result.rows;
  },

  getProfile: async (organizationId, id) => {
    const internResult = await pool.query(
      'SELECT * FROM interns WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    if (!internResult.rows[0]) return null;

    const tasksResult = await pool.query(
      'SELECT * FROM tasks WHERE intern_id = $1 AND organization_id = $2 ORDER BY created_at DESC',
      [id, organizationId]
    );

    const attendanceResult = await pool.query(
      `SELECT 
        COUNT(*) as total_days,
        COUNT(CASE WHEN attendance.status = 'present' THEN 1 END) as present_days,
        COUNT(CASE WHEN attendance.status = 'absent' THEN 1 END) as absent_days,
        COALESCE(SUM(total_hours), 0) as total_hours
      FROM attendance WHERE intern_id = $1 AND organization_id = $2`,
      [id, organizationId]
    );

    const recentAttendance = await pool.query(
      'SELECT * FROM attendance WHERE intern_id = $1 AND organization_id = $2 ORDER BY date DESC LIMIT 7',
      [id, organizationId]
    );

    return {
      intern: internResult.rows[0],
      tasks: tasksResult.rows,
      stats: attendanceResult.rows[0],
      recentAttendance: recentAttendance.rows,
    };
  },

  getById: async (organizationId, id) => {
    const result = await pool.query(
      'SELECT * FROM interns WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    return result.rows[0];
  },

  create: async (organizationId, { name, email, department, joining_date, location_id }) => {
    const bcrypt = require('bcryptjs');
    const tempPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(tempPassword, 12);
    const result = await pool.query(
      'INSERT INTO interns (name, email, department, joining_date, password, location_id, organization_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name.trim(), email.trim().toLowerCase(), department.trim(), joining_date, hashed, location_id || null, organizationId]
    );
    return { ...result.rows[0], tempPassword };
  },

  update: async (organizationId, id, { name, email, department, joining_date, status, location_id }) => {
    const result = await pool.query(
      `UPDATE interns SET name=$1, email=$2, department=$3, joining_date=$4, status=COALESCE($5,status),
       location_id=$6 WHERE id=$7 AND organization_id=$8 RETURNING *`,
      [name.trim(), email.trim().toLowerCase(), department.trim(), joining_date, status || null, location_id || null, id, organizationId]
    );
    return result.rows[0];
  },

  delete: async (organizationId, id) => {
    await pool.query('DELETE FROM interns WHERE id = $1 AND organization_id = $2', [id, organizationId]);
  },

  emailExists: async (email, excludeId = null) => {
    // Global check by design — email is unique across all orgs, not per-org.
    let query = 'SELECT id FROM interns WHERE email = $1';
    const params = [email.trim().toLowerCase()];
    if (excludeId) {
      params.push(excludeId);
      query += ` AND id != $2`;
    }
    const result = await pool.query(query, params);
    return result.rows.length > 0;
  },

  toggleStatus: async (organizationId, id) => {
    const result = await pool.query(
      `UPDATE interns SET status = CASE WHEN status='active' THEN 'inactive' ELSE 'active' END
      WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, organizationId]
    );
    return result.rows[0];
  },

  findByEmail: async (email) => {
    // Global lookup by design — used at login before organization_id is known.
    const result = await pool.query('SELECT * FROM interns WHERE email = $1', [email.trim().toLowerCase()]);
    return result.rows[0];
  },

  saveFaceDescriptor: async (organizationId, id, descriptor) => {
    const result = await pool.query(
      'UPDATE interns SET face_descriptor = $1, face_verified = TRUE WHERE id = $2 AND organization_id = $3 RETURNING id, name, email, face_verified',
      [JSON.stringify(descriptor), id, organizationId]
    );
    return result.rows[0];
  },

  getFaceDescriptor: async (organizationId, id) => {
    const result = await pool.query(
      'SELECT face_descriptor, face_verified FROM interns WHERE id = $1 AND organization_id = $2',
      [id, organizationId]
    );
    return result.rows[0];
  },

};

module.exports = InternModel;