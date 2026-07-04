const pool = require('../config/db');

const DashboardModel = {
  getStats: async (organizationId) => {
    // The five queries below are independent of each other -- previously
    // awaited one at a time, which serializes their DB round-trips end to
    // end. Running them concurrently bounds total latency to the slowest
    // single query instead of the sum of all of them.
    const [
      statsResult,
      deptResult,
      taskStatusResult,
      recentActivity,
      internPerformance,
    ] = await Promise.all([
      // Soft-deleted interns are excluded from every count below (both the
      // intern count itself and any tasks belonging to them) -- a departed
      // intern's old tasks shouldn't keep inflating "active" totals. Tasks'
      // own deleted_at is now also checked, which the total/completed/pending
      // counts had been missing entirely (a separate, pre-existing gap).
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM interns WHERE organization_id = $1 AND deleted_at IS NULL) AS total_interns,
          (SELECT COUNT(*) FROM tasks t JOIN interns i ON i.id = t.intern_id
             WHERE t.organization_id = $1 AND t.deleted_at IS NULL AND i.deleted_at IS NULL) AS total_tasks,
          (SELECT COUNT(*) FROM tasks t JOIN interns i ON i.id = t.intern_id
             WHERE t.status = 'completed' AND t.organization_id = $1 AND t.deleted_at IS NULL AND i.deleted_at IS NULL) AS completed_tasks,
          (SELECT COUNT(*) FROM tasks t JOIN interns i ON i.id = t.intern_id
             WHERE t.status = 'pending' AND t.organization_id = $1 AND t.deleted_at IS NULL AND i.deleted_at IS NULL) AS pending_tasks
      `, [organizationId]),

      pool.query(`
        SELECT department, COUNT(*) as count
        FROM interns
        WHERE organization_id = $1 AND deleted_at IS NULL
        GROUP BY department
      `, [organizationId]),

      pool.query(`
        SELECT t.status, COUNT(*) as count
        FROM tasks t JOIN interns i ON i.id = t.intern_id
        WHERE t.organization_id = $1 AND t.deleted_at IS NULL AND i.deleted_at IS NULL
        GROUP BY t.status
      `, [organizationId]),

      pool.query(`
        (
          SELECT
            'task_assigned' as type,
            t.title as message,
            i.name as intern_name,
            t.created_at as time
          FROM tasks t
          JOIN interns i ON t.intern_id = i.id
          WHERE t.organization_id = $1 AND t.deleted_at IS NULL AND i.deleted_at IS NULL
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
          WHERE organization_id = $1 AND deleted_at IS NULL
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
          JOIN interns i ON a.intern_id = i.id
          WHERE a.organization_id = $1 AND i.deleted_at IS NULL
          ORDER BY a.created_at DESC
          LIMIT 5
        )
        ORDER BY time DESC
        LIMIT 8
      `, [organizationId]),

      // Fan-out fix: this used to LEFT JOIN both tasks and attendance
      // directly onto interns in one query. When an intern has T tasks and
      // A attendance rows, that join produces T*A combined rows *before*
      // GROUP BY -- so COUNT(t.id)/COUNT(a.id)/SUM(a.total_hours) were all
      // silently inflated by a multiplicative factor that only got worse as
      // more tasks and attendance records accumulated. Pre-aggregating each
      // side in its own subquery and joining the two *aggregates* together
      // avoids the cross product entirely.
      pool.query(`
        SELECT
          i.id,
          i.name,
          i.department,
          COALESCE(t.total_tasks, 0) as total_tasks,
          COALESCE(t.completed_tasks, 0) as completed_tasks,
          COALESCE(a.total_days, 0) as total_days,
          COALESCE(a.present_days, 0) as present_days
        FROM interns i
        LEFT JOIN (
          SELECT intern_id,
                 COUNT(*) as total_tasks,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
          FROM tasks
          WHERE organization_id = $1 AND deleted_at IS NULL
          GROUP BY intern_id
        ) t ON t.intern_id = i.id
        LEFT JOIN (
          SELECT intern_id,
                 COUNT(*) as total_days,
                 COUNT(CASE WHEN status = 'present' THEN 1 END) as present_days
          FROM attendance
          WHERE organization_id = $1
          GROUP BY intern_id
        ) a ON a.intern_id = i.id
        WHERE i.organization_id = $1 AND i.deleted_at IS NULL
        ORDER BY completed_tasks DESC
        LIMIT 5
      `, [organizationId]),
    ]);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = new Date().toISOString().slice(0, 10);

    let internOfWeekRows = [];
    try {
      // Same fan-out fix as internPerformance above, plus a second bug:
      // weekStartStr/weekEndStr were computed but never actually passed
      // into the query or used to filter anything -- "intern of the week"
      // was silently scoring on all-time attendance hours, not this
      // week's. The attendance subquery below is now the only one scoped
      // to the current week; task completion rate intentionally stays
      // all-time (a fair "how reliable is this intern overall" signal),
      // matching what the score formula's /40-hour-week normalization was
      // clearly designed around.
      const internOfWeek = await pool.query(`
        SELECT
          i.id,
          i.name,
          i.department,
          COALESCE(t.completed_tasks, 0) as completed_tasks,
          COALESCE(t.total_tasks, 0) as total_tasks,
          COALESCE(a.weekly_hours, 0) as weekly_hours,
          ROUND(
            (
              COALESCE(t.completed_tasks::float / NULLIF(t.total_tasks, 0) * 60, 0)
              +
              LEAST(COALESCE(a.weekly_hours, 0) / 40.0, 1) * 40
            )::numeric, 1
          ) as score
        FROM interns i
        LEFT JOIN (
          SELECT intern_id,
                 COUNT(*) as total_tasks,
                 COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks
          FROM tasks
          WHERE organization_id = $1 AND deleted_at IS NULL
          GROUP BY intern_id
        ) t ON t.intern_id = i.id
        LEFT JOIN (
          SELECT intern_id, SUM(total_hours) as weekly_hours
          FROM attendance
          WHERE organization_id = $1 AND date BETWEEN $2 AND $3
          GROUP BY intern_id
        ) a ON a.intern_id = i.id
        WHERE i.organization_id = $1 AND i.deleted_at IS NULL
        ORDER BY score DESC
      `, [organizationId, weekStartStr, weekEndStr]);
      internOfWeekRows = internOfWeek.rows;
    } catch (err) {
      console.error('internOfWeek query error:', err.message);
    }

    return {
      stats: statsResult.rows[0],
      departmentDistribution: deptResult.rows,
      taskStatusDistribution: taskStatusResult.rows,
      recentActivity: recentActivity.rows,
      internPerformance: internPerformance.rows,
      internOfWeek: internOfWeekRows,
    };
  },
};

module.exports = DashboardModel;
