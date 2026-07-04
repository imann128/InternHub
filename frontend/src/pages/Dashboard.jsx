import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import StatCard from '../components/common/StatCard';
import TaskStatusChart from '../components/charts/TaskStatusChart';
import DepartmentChart from '../components/charts/DepartmentChart';
import dashboardService from '../services/dashboardService';
import Loader from '../components/common/Loader';
import { CheckIcon, PlusIcon, DotIcon, ChatBubbleIcon } from '../components/common/Icons';
import '../styles/dashboard.css';

const activityIcon = (type) => {
  if (type === 'task_assigned') return { Icon: CheckIcon, bg: 'var(--primary-light)', color: 'var(--primary)' };
  if (type === 'intern_added') return { Icon: PlusIcon, bg: 'var(--warning-light)', color: 'var(--warning)' };
  if (type === 'attendance') return { Icon: DotIcon, bg: 'var(--accent-teal-light)', color: 'var(--accent-teal)' };
  return { Icon: ChatBubbleIcon, bg: 'var(--accent-purple-light)', color: 'var(--accent-purple)' };
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
      <div className="page-stack">

        <div className="stat-grid">
          <div className="stagger-1"><StatCard label="Total Interns" value={stats.total_interns} color="primary" /></div>
          <div className="stagger-2"><StatCard label="Total Tasks" value={stats.total_tasks} color="muted" /></div>
          <div className="stagger-3"><StatCard label="Completed Tasks" value={stats.completed_tasks} color="success" /></div>
          <div className="stagger-4"><StatCard label="Pending Tasks" value={stats.pending_tasks} color="warning" /></div>
        </div>

        <div className="charts-grid">
          <div className="dash-panel">
            <h3 className="chart-title">Tasks by status</h3>
            <TaskStatusChart data={taskStatusDistribution} />
          </div>
          <div className="dash-panel">
            <h3 className="chart-title">Department distribution</h3>
            <DepartmentChart data={departmentDistribution} />
          </div>
        </div>

        <div className="dashboard-bottom">
          <div className="dash-panel">
            <h3 className="chart-title">Recent activity</h3>
            {recentActivity.length === 0 ? (
              <p className="empty-text" style={{ padding: '20px 0' }}>No activity yet</p>
            ) : (
              <div className="activity-list">
                {recentActivity.map((item, i) => {
                  const { Icon, bg, color } = activityIcon(item.type);
                  return (
                    <div key={i} className="activity-item">
                      <div className="activity-icon" style={{ background: bg, color }}><Icon size={13} /></div>
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

          <div className="dash-panel">
            <h3 className="chart-title">Intern performance</h3>
            {internPerformance.length === 0 ? (
              <p className="empty-text" style={{ padding: '20px 0', color: 'var(--muted)' }}>No data yet</p>
            ) : (
              <div className="performance-list">
                {internPerformance.map(intern => {
                  const taskPct = intern.total_tasks > 0 ? Math.round((intern.completed_tasks / intern.total_tasks) * 100) : 0;
                  const attPct = intern.total_days > 0 ? Math.round((intern.present_days / intern.total_days) * 100) : 0;
                  return (
                    <div key={intern.id} className="performance-item" onClick={() => navigate(`/interns/${intern.id}/profile`)}>
                      <div className="perf-header">
                        <div className="perf-avatar">{intern.name.charAt(0)}</div>
                        <span className="perf-name">{intern.name}</span>
                        <span className="badge badge-muted">{intern.department}</span>
                      </div>
                      <div className="perf-bars">
                        <div className="perf-bar-group">
                          <div className="perf-bar-row">
                            <span className="perf-bar-label">Tasks</span>
                            <span className="perf-pct">{taskPct}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${taskPct}%`, background: 'var(--accent-teal)' }} />
                          </div>
                        </div>
                        <div className="perf-bar-group">
                          <div className="perf-bar-row">
                            <span className="perf-bar-label">Attend.</span>
                            <span className="perf-pct">{attPct}%</span>
                          </div>
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${attPct}%`, background: 'var(--warning)' }} />
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
        <div className="dash-panel dash-panel-purple">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 className="chart-title" style={{ margin: 0 }}>Weekly leaderboard</h3>
            <span style={{ fontSize: 11.5, color: 'var(--accent-purple)' }}>40% attendance · 60% task completion</span>
          </div>

          {internOfWeek.length === 0 ? (
            <p style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {internOfWeek.map((intern, index) => {
                const taskPct = intern.total_tasks > 0 ? Math.round((intern.completed_tasks / intern.total_tasks) * 100) : 0;
                const hoursPct = Math.min(Math.round((parseFloat(intern.weekly_hours) / 40) * 100), 100);
                return (
                  <div
                    key={intern.id}
                    onClick={() => navigate(`/interns/${intern.id}/profile`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 16px',
                      borderRadius: 14,
                      background: 'var(--bg-inset)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-purple)', width: 24, textAlign: 'center', flexShrink: 0 }}>
                      #{index + 1}
                    </span>

                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'var(--accent-purple-light)',
                      color: 'var(--accent-purple)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 13, flexShrink: 0
                    }}>
                      {intern.name.charAt(0)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>{intern.name}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent-purple)' }}>
                          Score: {intern.score || 0}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--accent-purple-light)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${taskPct}%`, background: 'var(--accent-teal)', borderRadius: 999 }} />
                        </div>
                        <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--accent-purple-light)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${hoursPct}%`, background: 'var(--warning)', borderRadius: 999 }} />
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