const pool = require('../config/db');

const AttendanceModel = {
  getAll: async (organizationId, { intern_id, date }) => {
    // JOIN (not LEFT JOIN) on interns so records belonging to a soft-deleted
    // intern drop out of the active list -- the attendance rows themselves
    // are left untouched in the DB.
    let query = `
      SELECT a.*, i.name as intern_name
      FROM attendance a
      JOIN interns i ON a.intern_id = i.id AND i.deleted_at IS NULL
      WHERE a.organization_id = $1
    `;
    const params = [organizationId];
    if (intern_id) { params.push(intern_id); query += ` AND a.intern_id = $${params.length}`; }
    if (date) { params.push(date); query += ` AND a.date = $${params.length}`; }
    query += ' ORDER BY a.date DESC';
    const result = await pool.query(query, params);
    return result.rows;
  },

  getWeeklySummary: async (organizationId, { intern_id, week_start, week_end }) => {
    const result = await pool.query(`
      SELECT 
        i.id as intern_id,
        i.name as intern_name,
        i.department,
        COALESCE(SUM(a.total_hours), 0) as total_hours,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as days_present,
        COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as days_absent
      FROM interns i
      LEFT JOIN attendance a ON a.intern_id = i.id
        AND a.date BETWEEN $1 AND $2
        AND a.organization_id = $4
      WHERE i.organization_id = $4 AND i.deleted_at IS NULL AND ($3::int IS NULL OR i.id = $3)
      GROUP BY i.id, i.name, i.department
      ORDER BY total_hours DESC
    `, [week_start, week_end, intern_id || null, organizationId]);
    return result.rows;
  },

  checkIn: async (organizationId, { intern_id, date, check_in }) => {
    const result = await pool.query(`
      INSERT INTO attendance (intern_id, date, status, check_in, source, organization_id)
      VALUES ($1, $2, 'present', $3, 'admin', $4)
      ON CONFLICT (intern_id, date)
      DO UPDATE SET check_in = $3, status = 'present', source = 'admin'
      WHERE attendance.organization_id = $4
      RETURNING *
    `, [intern_id, date, check_in, organizationId]);
    return result.rows[0];
  },

  checkOut: async (organizationId, { intern_id, date, check_out }) => {
    const result = await pool.query(`
      UPDATE attendance
      SET 
        check_out = $3,
        source = 'admin',
        total_hours = ROUND(
          EXTRACT(EPOCH FROM ($3::time - check_in)) / 3600
        , 2)
      WHERE intern_id = $1 AND date = $2 AND organization_id = $4
      RETURNING *
    `, [intern_id, date, check_out, organizationId]);
    return result.rows[0];
  },

  mark: async (organizationId, { intern_id, date, status }) => {
    const result = await pool.query(`
      INSERT INTO attendance (intern_id, date, status, organization_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (intern_id, date)
      DO UPDATE SET status = EXCLUDED.status
      WHERE attendance.organization_id = $4
      RETURNING *
    `, [intern_id, date, status, organizationId]);
    return result.rows[0];
  },

  checkInSelf: async (organizationId, { intern_id, date, check_in, latitude, longitude }) => {
    const result = await pool.query(`
      INSERT INTO attendance (intern_id, date, status, check_in, source, latitude, longitude, organization_id)
      VALUES ($1, $2, 'present', $3, 'self', $4, $5, $6)
      ON CONFLICT (intern_id, date)
      DO UPDATE SET check_in = $3, status = 'present', source = 'self', latitude = $4, longitude = $5
      WHERE attendance.organization_id = $6
      RETURNING *
    `, [intern_id, date, check_in, latitude, longitude, organizationId]);
    return result.rows[0];
  },

  checkOutSelf: async (organizationId, { intern_id, date, check_out, latitude, longitude }) => {
    const result = await pool.query(`
      UPDATE attendance
      SET 
        check_out = $3,
        source = 'self',
        latitude = $4,
        longitude = $5,
        total_hours = ROUND(
          EXTRACT(EPOCH FROM ($3::time - check_in)) / 3600
        , 2)
      WHERE intern_id = $1 AND date = $2 AND organization_id = $6
      RETURNING *
    `, [intern_id, date, check_out, latitude, longitude, organizationId]);
    return result.rows[0];
  },
};

module.exports = AttendanceModel;
