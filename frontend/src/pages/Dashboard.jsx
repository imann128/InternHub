import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import StatCard from '../components/common/StatCard';
import TaskStatusChart from '../components/charts/TaskStatusChart';
import DepartmentChart from '../components/charts/DepartmentChart';
import dashboardService from '../services/dashboardService';
import Loader from '../components/common/Loader';
import '../styles/dashboard.css';

const activityIcon = (type) => {
  if (type === 'task_assigned') return { icon: '✓', bg: '#EEF2FF', color: '#4F46E5' };
  if (type === 'intern_added') return { icon: '◉', bg: '#DCFCE7', color: '#16A34A' };
  return { icon: '▤', bg: '#FEF9C3', color: '#CA8A04' };
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardService.getStats()
      .then(res => setData(res.data.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <MainLayout title="Dashboard"><Loader /></MainLayout>;
  if (error) return <MainLayout title="Dashboard"><p className="error-text">{error}</p></MainLayout>;

  const { stats, departmentDistribution, taskStatusDistribution, recentActivity, internPerformance, internOfWeek = [] } = data;

  return (
    <MainLayout title="Dashboard">
      <div className="page-enter">

        <div className="stat-grid">
          <div className="stagger-1"><StatCard label="Total Interns" value={stats.total_interns} color="primary" /></div>
          <div className="stagger-2"><StatCard label="Total Tasks" value={stats.total_tasks} color="muted" /></div>
          <div className="stagger-3"><StatCard label="Completed Tasks" value={stats.completed_tasks} color="success" /></div>
          <div className="stagger-4"><StatCard label="Pending Tasks" value={stats.pending_tasks} color="warning" /></div>
        </div>

        <div className="charts-grid">
          <div className="card">
            <h3 className="chart-title">Tasks by Status</h3>
            <TaskStatusChart data={taskStatusDistribution} />
          </div>
          <div className="card">
            <h3 className="chart-title">Department Distribution</h3>
            <DepartmentChart data={departmentDistribution} />
          </div>
        </div>

        <div className="dashboard-bottom">
          <div className="card">
            <h3 className="chart-title">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="empty-text" style={{ padding: '20px 0' }}>No activity yet</p>
            ) : (
              <div className="activity-list">
                {recentActivity.map((item, i) => {
                  const { icon, bg, color } = activityIcon(item.type);
                  return (
                    <div key={i} className="activity-item">
                      <div className="activity-icon" style={{ background: bg, color }}>{icon}</div>
                      <div className="activity-content">
                        <p className="activity-message">
                          <strong>{item.intern_name}</strong> — {item.message}
                        </p>
                        <span className="activity-time">
                          {new Date(item.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="chart-title">Intern Performance</h3>
            {internPerformance.length === 0 ? (
              <p className="empty-text" style={{ padding: '20px 0', color: 'var(--muted)' }}>No data yet</p>
            ) : (
              <div className="performance-list">
                {internPerformance.map(intern => {
                  const taskPct = intern.total_tasks > 0 ? Math.round((intern.completed_tasks / intern.total_tasks) * 100) : 0;
                  const attPct = intern.total_days > 0 ? Math.round((intern.present_days / intern.total_days) * 100) : 0;
                  return (
                    <div key={intern.id} className="performance-item" onClick={() => navigate(`/interns/${intern.id}/profile`)}>
                      <div className="perf-avatar">{intern.name.charAt(0)}</div>
                      <div className="perf-info">
                        <div className="perf-header">
                          <span className="perf-name">{intern.name}</span>
                          <span className="badge badge-muted">{intern.department}</span>
                        </div>
                        <div className="perf-bars">
                          <div className="perf-bar-row">
                            <span className="perf-bar-label">Tasks</span>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className="progress-fill" style={{ width: `${taskPct}%`, background: '#22C55E' }} />
                            </div>
                            <span className="perf-pct">{taskPct}%</span>
                          </div>
                          <div className="perf-bar-row">
                            <span className="perf-bar-label">Attend.</span>
                            <div className="progress-bar" style={{ flex: 1 }}>
                              <div className="progress-fill" style={{ width: `${attPct}%`, background: '#F59E0B' }} />
                            </div>
                            <span className="perf-pct">{attPct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* WEEKLY LEADERBOARD */}
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="chart-title" style={{ margin: 0 }}>🏆 Weekly Leaderboard</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>40% Attendance · 60% Task Completion</span>
          </div>

          {internOfWeek.length === 0 ? (
            <p style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {internOfWeek.map((intern, index) => {
                const taskPct = intern.total_tasks > 0 ? Math.round((intern.completed_tasks / intern.total_tasks) * 100) : 0;
                const hoursPct = Math.min(Math.round((parseFloat(intern.weekly_hours) / 40) * 100), 100);
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div
                    key={intern.id}
                    onClick={() => navigate(`/interns/${intern.id}/profile`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${index === 0 ? 'var(--primary)' : 'var(--border)'}`,
                      background: index === 0 ? 'var(--primary-light)' : 'var(--bg)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 22, width: 30, textAlign: 'center' }}>
                      {medals[index] || `#${index + 1}`}
                    </span>

                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: index === 0 ? 'var(--primary)' : 'var(--primary-light)',
                      color: index === 0 ? '#fff' : 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 14, flexShrink: 0
                    }}>
                      {intern.name.charAt(0)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{intern.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>
                          Score: {intern.score || 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Tasks (60%)</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{taskPct}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${taskPct}%`, background: '#22C55E' }} />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Hours (40%)</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{parseFloat(intern.weekly_hours).toFixed(1)}h</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${hoursPct}%`, background: '#F59E0B' }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </MainLayout>
  );
};

export default Dashboard;