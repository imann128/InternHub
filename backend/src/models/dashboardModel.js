const pool = require('../config/db');

const DashboardModel = {
  getStats: async (organizationId) => {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM interns WHERE organization_id = $1) AS total_interns,
        (SELECT COUNT(*) FROM tasks WHERE organization_id = $1) AS total_tasks,
        (SELECT COUNT(*) FROM tasks WHERE status = 'completed' AND organization_id = $1) AS completed_tasks,
        (SELECT COUNT(*) FROM tasks WHERE status = 'pending' AND organization_id = $1) AS pending_tasks
    `, [organizationId]);

    const deptResult = await pool.query(`
      SELECT department, COUNT(*) as count 
      FROM interns 
      WHERE organization_id = $1
      GROUP BY department
    `, [organizationId]);

    const taskStatusResult = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      WHERE organization_id = $1
      GROUP BY status
    `, [organizationId]);

    const recentActivity = await pool.query(`
      (
        SELECT 
          'task_assigned' as type,
          t.title as message,
          i.name as intern_name,
          t.created_at as time
        FROM tasks t
        LEFT JOIN interns i ON t.intern_id = i.id
        WHERE t.organization_id = $1
        ORDER BY t.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT
          'intern_added' as type,
          'New intern added' as message,
          name as intern_name,
          created_at as time
        FROM interns
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT
          'attendance' as type,
          CONCAT('Marked ', a.status) as message,
          i.name as intern_name,
          a.created_at as time
        FROM attendance a
        LEFT JOIN interns i ON a.intern_id = i.id
        WHERE a.organization_id = $1
        ORDER BY a.created_at DESC
        LIMIT 5
      )
      ORDER BY time DESC
      LIMIT 8
    `, [organizationId]);

    const internPerformance = await pool.query(`
      SELECT
        i.id,
        i.name,
        i.department,
        COUNT(t.id) as total_tasks,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(a.id) as total_days,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days
      FROM interns i
      LEFT JOIN tasks t ON t.intern_id = i.id
      LEFT JOIN attendance a ON a.intern_id = i.id
      WHERE i.organization_id = $1
      GROUP BY i.id, i.name, i.department
      ORDER BY completed_tasks DESC
      LIMIT 5
    `, [organizationId]);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = new Date().toISOString().slice(0, 10);

    let internOfWeekRows = [];
    try {
      const internOfWeek = await pool.query(`
        SELECT
          i.id,
          i.name,
          i.department,
          COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
          COUNT(t.id) as total_tasks,
          COALESCE(SUM(a.total_hours), 0) as weekly_hours,
          ROUND(
            (
              COALESCE(COUNT(CASE WHEN t.status = 'completed' THEN 1 END)::float / 
               NULLIF(COUNT(t.id), 0) * 60, 0)
              +
              LEAST(COALESCE(SUM(a.total_hours), 0) / 40.0, 1) * 40
            )::numeric, 1
          ) as score
        FROM interns i
        LEFT JOIN tasks t ON t.intern_id = i.id
        LEFT JOIN attendance a ON a.intern_id = i.id
        WHERE i.organization_id = $1
        GROUP BY i.id, i.name, i.department
        ORDER BY score DESC
      `, [organizationId]);
      internOfWeekRows = internOfWeek.rows;
    } catch (err) {
      console.error('internOfWeek query error:', err.message);
    }

    return {
      stats: result.rows[0],
      departmentDistribution: deptResult.rows,
      taskStatusDistribution: taskStatusResult.rows,
      recentActivity: recentActivity.rows,
      internPerformance: internPerformance.rows,
      internOfWeek: internOfWeekRows,
    };
  },
};

module.exports = DashboardModel;