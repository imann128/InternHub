import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import Loader from '../components/common/Loader';
import internService from '../services/internService';
import { toast } from 'react-toastify';
import { CheckIcon } from '../components/common/Icons';
import '../styles/interns.css';
import '../styles/profile.css';

const THRESHOLD = 40;

const InternProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        internService.getProfile(id)
            .then(res => setData(res.data.data))
            .catch(err => { toast.error(err.message); navigate('/interns'); })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <MainLayout title="Profile"><Loader /></MainLayout>;
    if (!data) return null;

    const { intern, tasks, stats, recentAttendance } = data;

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const pendingTasks = tasks.filter(t => t.status === 'pending').length;
    const taskCompletionPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const hoursPct = Math.min((parseFloat(stats.total_hours) / THRESHOLD) * 100, 100).toFixed(0);
    const hoursmet = parseFloat(stats.total_hours) >= THRESHOLD;
    const attendancePct = stats.total_days > 0
        ? Math.round((stats.present_days / stats.total_days) * 100)
        : 0;

    return (
        <MainLayout title="Intern profile">
            <div className="profile-page page-enter">

                <button className="btn-back-link" onClick={() => navigate('/interns')}>← Back to interns</button>

                {/* HEADER */}
                <div className="profile-header">
                    <div className="profile-avatar">
                        {intern.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="profile-info">
                        <h2 className="profile-name">{intern.name}</h2>
                        <p className="profile-email">{intern.email}</p>
                        <div className="profile-meta">
                            <span className="badge badge-muted">{intern.department}</span>
                            <span className="profile-date">Joined {new Date(intern.joining_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                            <span className={`badge ${intern.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                {intern.status || 'active'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* STAT CARDS */}
                <div className="profile-stats">
                    <div className="profile-stat-card stagger-1" style={{ background: 'var(--bg-panel)' }}>
                        <div className="pstat-value">{tasks.length}</div>
                        <div className="pstat-label">Total tasks</div>
                    </div>
                    <div className="profile-stat-card stagger-2" style={{ background: 'var(--accent-teal-light)' }}>
                        <div className="pstat-value" style={{ color: 'var(--accent-teal)' }}>{completedTasks}</div>
                        <div className="pstat-label">Completed</div>
                    </div>
                    <div className="profile-stat-card stagger-3" style={{ background: 'var(--warning-light)' }}>
                        <div className="pstat-value" style={{ color: 'var(--warning)' }}>{pendingTasks}</div>
                        <div className="pstat-label">Pending</div>
                    </div>
                    <div className="profile-stat-card stagger-4" style={{ background: 'var(--primary-light)' }}>
                        <div className="pstat-value" style={{ color: 'var(--primary)' }}>{attendancePct}%</div>
                        <div className="pstat-label">Attendance rate</div>
                    </div>
                </div>

                <div className="profile-grid">

                    {/* PROGRESS */}
                    <div className="profile-panel">
                        <h3 className="section-title">Progress</h3>

                        <div className="progress-section">
                            <div className="progress-header">
                                <span className="progress-name">Task completion</span>
                                <span className="progress-pct">{taskCompletionPct}%</span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${taskCompletionPct}%`, background: 'var(--accent-teal)' }} />
                            </div>
                        </div>

                        <div className="progress-section">
                            <div className="progress-header">
                                <span className="progress-name">Weekly hours ({parseFloat(stats.total_hours).toFixed(1)}h / {THRESHOLD}h)</span>
                                <span className="progress-pct" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: hoursmet ? 'var(--accent-teal)' : 'var(--primary)' }}>
                                    {hoursPct}% {hoursmet && <CheckIcon size={11} />}
                                </span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${hoursPct}%`, background: hoursmet ? 'var(--accent-teal)' : 'var(--primary)' }} />
                            </div>
                        </div>

                        <div className="progress-section">
                            <div className="progress-header">
                                <span className="progress-name">Attendance rate</span>
                                <span className="progress-pct">{attendancePct}%</span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${attendancePct}%`, background: 'var(--warning)' }} />
                            </div>
                        </div>
                    </div>

                    {/* RECENT ATTENDANCE */}
                    <div className="profile-panel">
                        <h3 className="section-title">Recent attendance</h3>
                        {recentAttendance.length === 0 ? (
                            <p className="empty-text" style={{ padding: '20px 0' }}>No attendance records yet</p>
                        ) : (
                            <div className="attendance-list">
                                {recentAttendance.map(rec => (
                                    <div key={rec.id} className="attendance-item">
                                        <span className="attendance-date">
                                            {new Date(rec.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </span>
                                        <div className="attendance-right">
                                            {rec.check_in && <span className="time-chip">{rec.check_in?.slice(0, 5)}</span>}
                                            {rec.check_out && <span className="time-chip">– {rec.check_out?.slice(0, 5)}</span>}
                                            <span className={`badge ${rec.status === 'present' ? 'badge-success' : 'badge-danger'}`}>
                                                {rec.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* TASKS */}
                <div className="profile-panel">
                    <h3 className="section-title">Assigned tasks</h3>
                    {tasks.length === 0 ? (
                        <p className="empty-text" style={{ padding: '20px 0' }}>No tasks assigned yet</p>
                    ) : (
                        <div className="interns-table-wrap">
                            <table className="interns-table">
                                <thead>
                                    <tr>
                                        <th>Title</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Assigned</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tasks.map(task => (
                                        <tr key={task.id}>
                                            <td><span className="intern-name">{task.title}</span></td>
                                            <td>{task.description || '—'}</td>
                                            <td>
                                                <span className={`badge ${task.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>
                                                    {task.status}
                                                </span>
                                            </td>
                                            <td>{new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </MainLayout>
    );
};

export default InternProfile;