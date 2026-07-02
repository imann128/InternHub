import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Loader from '../../components/common/Loader';
import { toast } from 'react-toastify';
import submissionService from '../../services/submissionService';

const priorityColor = { high: '#EF4444', medium: '#F59E0B', low: '#22C55E' };

const InternTasks = () => {
  const { intern, logout } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [submitTask, setSubmitTask] = useState(null);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitFiles, setSubmitFiles] = useState([]);
  const [submitLink, setSubmitLink] = useState('');
  const [submitStatus, setSubmitStatus] = useState('full');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submissions, setSubmissions] = useState({});
  const [showCompleted, setShowCompleted] = useState(false);

  const fetchTasks = () => {
    api.get('/intern/me')
      .then(res => {
        setTasks(res.data.data.tasks);
        fetchSubmissions(res.data.data.tasks);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const handleComplete = async (id) => {
    try {
      await api.patch(`/intern/tasks/${id}/complete`);
      toast.success('Task marked complete');
      fetchTasks();
    } catch (err) { toast.error(err.message); }
  };

  const fetchSubmissions = async (taskList) => {
    const map = {};
    for (const t of taskList) {
      try {
        const res = await submissionService.getAll({ task_id: t.id });
        map[t.id] = res.data.data;
      } catch { }
    }
    setSubmissions(map);
  };

  const handleSubmitWork = async () => {
    if (!submitTask) return;
    setSubmitLoading(true);
    try {
      const fd = new FormData();
      fd.append('task_id', submitTask.id);
      if (submitNotes.trim()) fd.append('notes', submitNotes.trim());
      if (submitLink.trim()) fd.append('link', submitLink.trim());
      fd.append('completion', submitStatus);
      submitFiles.forEach(f => fd.append('files', f));
      await submissionService.create(fd);
      toast.success('Work submitted — supervisor notified');
      setSubmitTask(null);
      setSubmitNotes('');
      setSubmitFiles([]);
      setSubmitLink('');
      setSubmitStatus('full');
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally { setSubmitLoading(false); }
  };

  return (
    <div className="intern-page">
      {/* Navbar */}
      <div className="intern-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 18 }}>IP</span>
          <nav style={{ display: 'flex', gap: 4 }}>
            {[['Dashboard', '/intern/dashboard'], ['Tasks', '/intern/tasks'], ['Attendance', '/intern/attendance']].map(([label, path]) => (
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
          <span style={{ color: 'var(--muted)', fontSize: 14 }}>{intern?.name}</span>
          <button onClick={() => { logout(); navigate('/intern/login'); }} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 13 }}>Logout</button>
        </div>
      </div>

      <div className="intern-content" style={{ maxWidth: 900 }}>
        <h2 style={{ color: 'var(--text)', marginBottom: 24 }}>My Tasks</h2>
        {loading ? <Loader /> : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 48 }}>No tasks assigned yet</div>
        ) : (
          <>
            {(() => {
              const pendingTasks = tasks.filter(t => t.status !== 'completed');
              const completedTasks = tasks.filter(t => t.status === 'completed');
              const renderTask = (task) => (
                <div key={task.id} className="intern-task-card" style={{
                borderLeft: `4px solid ${priorityColor[task.priority] || 'var(--border)'}`,
                opacity: task.status === 'completed' ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15, textDecoration: task.status === 'completed' ? 'line-through' : 'none' }}>
                      {task.title}
                    </div>
                    {task.description && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{task.description}</div>}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                      {task.due_date && (
                        <span style={{ fontSize: 12, color: new Date(task.due_date) < new Date() && task.status === 'pending' ? '#EF4444' : 'var(--muted)' }}>
                          Due: {new Date(task.due_date).toLocaleDateString()}
                          {new Date(task.due_date) < new Date() && task.status === 'pending' && ' ⚠'}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: priorityColor[task.priority], fontWeight: 500, textTransform: 'capitalize' }}>
                        {task.priority} priority
                      </span>
                    </div>

                    {/* Comments */}
                    {task.comments && task.comments.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>
                          Notes from supervisor ({task.comments.length})
                        </div>
                        {task.comments.map(c => (
                          <div key={c.id} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 6, borderLeft: '3px solid var(--primary)' }}>
                            <p style={{ margin: 0, color: 'var(--text)', fontSize: 12 }}>{c.comment}</p>
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Submissions */}
                    {submissions[task.id]?.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>
                          Submissions ({submissions[task.id].length})
                        </div>
                        {submissions[task.id].map(s => (
                          <div key={s.id} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 6, borderLeft: `3px solid ${s.status === 'approved' ? '#22C55E' : s.status === 'rejected' ? '#EF4444' : '#F59E0B'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', textTransform: 'capitalize' }}>{s.status.replace('_', ' ')}</span>
                              {s.score != null && <span style={{ fontSize: 11, color: 'var(--muted)' }}>Score: {s.score}/100</span>}
                            </div>
                            {s.feedback && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>{s.feedback}</p>}
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(s.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
                    <span style={{
                      padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                      background: task.status === 'completed' ? '#DCFCE7' : '#FEF9C3',
                      color: task.status === 'completed' ? '#16A34A' : '#CA8A04'
                    }}>
                      {task.status}
                    </span>
                    {task.status === 'pending' && (
                      <button onClick={() => handleComplete(task.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>
                        Mark Done
                      </button>
                    )}
                    <button onClick={() => { setSubmitTask(task); setSubmitNotes(''); setSubmitFiles([]); setSubmitLink(''); setSubmitStatus('full'); }}
                      className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                      Submit Work
                    </button>
                  </div>
                </div>
              </div>
              );

              return (
                <>
                  {pendingTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No pending tasks 🎉</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {pendingTasks.map(renderTask)}
                    </div>
                  )}

                  {completedTasks.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <button
                        onClick={() => setShowCompleted(v => !v)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
                          cursor: 'pointer', color: 'var(--muted)', fontSize: 13, fontWeight: 600, padding: '8px 0'
                        }}
                      >
                        <span style={{
                          display: 'inline-block', transition: 'transform 0.15s ease',
                          transform: showCompleted ? 'rotate(90deg)' : 'rotate(0deg)'
                        }}>▶</span>
                        Completed Tasks ({completedTasks.length})
                      </button>
                      {showCompleted && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                          {completedTasks.map(renderTask)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {submitTask && (
        <div className="modal-overlay" onClick={() => setSubmitTask(null)}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Submit Work — {submitTask.title}</h3>
              <button className="modal-close" onClick={() => setSubmitTask(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-input" rows={3} placeholder="Describe what you completed..."
                  value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Link (optional)</label>
                <input type="url" className="form-input" placeholder="https://..."
                  value={submitLink} onChange={e => setSubmitLink(e.target.value)} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  e.g. hosted demo, GitHub repo, Google Doc, deployed link
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Attach Files (max 5, 10MB each)</label>
                <input type="file" multiple className="form-input"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip"
                  onChange={e => setSubmitFiles(Array.from(e.target.files))} />
                {submitFiles.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    {submitFiles.map(f => f.name).join(', ')}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Completion Status</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={submitStatus === 'full'}
                      onChange={() => setSubmitStatus('full')} />
                    Fully Completed
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={submitStatus === 'partial'}
                      onChange={() => setSubmitStatus('partial')} />
                    Partially Completed
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button className="btn-ghost" onClick={() => setSubmitTask(null)}>Cancel</button>
                <button className="btn-primary" onClick={handleSubmitWork} disabled={submitLoading}>
                  {submitLoading ? <span className="btn-spinner" /> : 'Submit Work'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default InternTasks;