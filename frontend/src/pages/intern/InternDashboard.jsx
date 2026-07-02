import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import internPortalService from '../../services/internPortalService';
import Loader from '../../components/common/Loader';
import { toast } from 'react-toastify';

const THRESHOLD = 40;

const InternNavbar = ({ name, onLogout, navigate }) => {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  return (
    <div className="intern-navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 18 }}>IP</span>
        <nav style={{ display: 'flex', gap: 4 }}>
          {[['Dashboard', '/intern/dashboard'], ['Tasks', '/intern/tasks'], ['Attendance', '/intern/attendance'], ['Chat', '/intern/chat']].map(([label, path]) => (
            <button key={path} onClick={() => navigate(path)}
              className={`intern-nav-btn ${window.location.pathname === path ? 'active' : ''}`}>
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={toggleDark} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {dark ? '☀️' : '🌙'}
        </button>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>{name}</span>
        <button onClick={onLogout} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}>Logout</button>
      </div>
    </div>
  );
};

const InternDashboard = () => {
  const { intern, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/intern/me')
      .then(res => setData(res.data.data))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  useEffect(() => {
    internPortalService.getFaceStatus()
      .then(res => {
        if (!res.data.data.face_verified) {
          navigate('/intern/verify-identity');
        }
      })
      .catch(() => {});
  }, []);

  if (loading) return <Loader />;
  if (!data) return null;

  const { tasks, stats } = data;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const hoursPct = Math.min((parseFloat(stats.total_hours) / THRESHOLD) * 100, 100).toFixed(0);
  const attendancePct = stats.total_days > 0 ? Math.round((stats.present_days / stats.total_days) * 100) : 0;

  return (
    <div className="intern-page">
      <InternNavbar name={intern?.name} onLogout={() => { logout(); navigate('/intern/login'); }} navigate={navigate} />
      <div className="intern-content">
        <h2 style={{ color: 'var(--text)', marginBottom: 4 }}>Welcome back, {intern?.name} 👋</h2>
        <p style={{ color: 'var(--muted)', marginBottom: 24 }}>{intern?.department}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total Tasks', value: tasks.length, color: '#4F46E5' },
            { label: 'Completed', value: completed, color: '#22C55E' },
            { label: 'Pending', value: pending, color: '#F59E0B' },
            { label: 'Attendance Rate', value: `${attendancePct}%`, color: '#4F46E5' },
          ].map(s => (
            <div key={s.label} className="intern-stat-card">
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="intern-card">
          <h3 style={{ color: 'var(--text)', marginBottom: 16, fontSize: 16 }}>Progress</h3>
          {[
            { label: 'Task Completion', pct: tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0, color: '#22C55E' },
            { label: `Weekly Hours (${parseFloat(stats.total_hours).toFixed(1)}h / ${THRESHOLD}h)`, pct: hoursPct, color: '#4F46E5' },
            { label: 'Attendance Rate', pct: attendancePct, color: '#F59E0B' },
          ].map(p => (
            <div key={p.label} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: p.color }}>{p.pct}%</span>
              </div>
              <div className="intern-progress-bg">
                <div style={{ width: `${p.pct}%`, background: p.color, borderRadius: 99, height: 8, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>

        <div className="intern-card">
          <h3 style={{ color: 'var(--text)', marginBottom: 16, fontSize: 16 }}>Recent Tasks</h3>
          {tasks.slice(0, 5).map(task => (
            <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text)', fontSize: 14 }}>{task.title}</div>
                {task.due_date && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Due: {new Date(task.due_date).toLocaleDateString()}</div>}
              </div>
              <span style={{ padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                background: task.status === 'completed' ? '#DCFCE7' : '#FEF9C3',
                color: task.status === 'completed' ? '#16A34A' : '#CA8A04' }}>
                {task.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { InternNavbar };
export default InternDashboard;