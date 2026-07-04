import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import internPortalService from '../../services/internPortalService';
import chatService from '../../services/chatService';
import submissionService from '../../services/submissionService';
import InternLayout from '../../components/intern/InternLayout';
import Loader from '../../components/common/Loader';
import { toast } from 'react-toastify';

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SUBMISSION_STATUS_COLOR = {
  approved: 'var(--accent-teal)',
  pending: 'var(--warning)',
  rejected: 'var(--danger)',
  revision_requested: 'var(--accent-purple)',
};

const SUBMISSION_SWATCH = ['var(--primary)', 'var(--accent-teal)', 'var(--warning)', 'var(--accent-purple)'];

// Formats a past timestamp as "2h ago" / "Yesterday" / "3 days ago" — no
// external date library needed for this coarse a granularity.
const relativeTime = (isoString) => {
  const then = new Date(isoString);
  const diffMs = Date.now() - then.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

// Monday of the current week, at local midnight.
const getMonday = (d) => {
  const offset = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
};

const toDateKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const Ring = ({ label, sub, pct, color, cardBg }) => (
  <div className="idash-ring-card" style={{ background: cardBg }}>
    <div>
      <div className="idash-ring-label">{label}</div>
      <div className="idash-ring-sub">{sub}</div>
    </div>
    <div
      className="idash-ring-donut"
      style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.3) 0deg)` }}
    >
      <div className="idash-ring-donut-inner" style={{ background: cardBg }}>{pct}%</div>
    </div>
  </div>
);

const InternDashboard = () => {
  const { intern } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [messages, setMessages] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      internPortalService.getMe(),
      chatService.getMyMessages({ page: 1, limit: 20 }),
      submissionService.getAll({ limit: 3 }),
    ])
      .then(([meRes, chatRes, subsRes]) => {
        setData(meRes.data.data);
        const chatItems = chatRes.data.data || chatRes.data.messages || chatRes.data || [];
        const list = Array.isArray(chatItems) ? chatItems : [];
        setMessages(list);
        setAnnouncements(list.filter((m) => m.is_announcement).slice(0, 3));
        setSubmissions(subsRes.data.data || []);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    internPortalService.getFaceStatus()
      .then((res) => {
        if (!res.data.data.face_verified) navigate('/intern/verify-identity');
      })
      .catch(() => {});
  }, [navigate]);

  if (loading) return <Loader />;
  if (!data) return null;

  const { tasks, attendance, stats } = data;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const attendancePct = stats.total_days > 0 ? Math.round((stats.present_days / stats.total_days) * 100) : 0;
  const tasksPct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const now = new Date();
  const monday = getMonday(now);
  const weekDates = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const weekKeys = weekDates.map(toDateKey);
  const attendanceByDate = Object.fromEntries((attendance || []).map((a) => [a.date?.slice?.(0, 10) || toDateKey(new Date(a.date)), a]));

  // Weekly hours: sum only this week's actual attendance records, not the
  // all-time total_hours figure — showing an all-time number in a "this
  // week" slot would misrepresent the data.
  const weeklyHours = weekKeys.reduce((sum, key) => sum + parseFloat(attendanceByDate[key]?.total_hours || 0), 0);
  const WEEKLY_TARGET = 40;
  const weeklyHoursPct = Math.min(Math.round((weeklyHours / WEEKLY_TARGET) * 100), 100);

  const todayKey = toDateKey(now);
  const week = DAY_NAMES.map((day, i) => {
    const key = weekKeys[i];
    const isToday = key === todayKey;
    const isFuture = weekDates[i] > now && !isToday;
    const record = attendanceByDate[key];
    let icon = '—';
    if (isToday) icon = '●';
    else if (!isFuture) icon = record?.status === 'present' ? '✓' : record ? '✕' : '—';
    return {
      day, date: weekDates[i].getDate(), icon,
      bg: isToday ? 'var(--accent-purple)' : 'var(--bg-inset)',
      color: isToday ? '#fff' : 'var(--text)',
      subColor: isToday ? 'rgba(255,255,255,0.75)' : 'var(--muted)',
    };
  });
  const fmt = (d) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  const weekLabel = `${fmt(weekDates[0])} – ${fmt(weekDates[6])}`;
  const todayLabel = `${FULL_DAY_NAMES[now.getDay()]}, ${fmt(now)}`;

  const upcoming = tasks
    .filter((t) => t.status !== 'completed' && t.due_date && new Date(t.due_date) >= new Date(now.toDateString()))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 2);

  const searchQ = searchQuery.trim().toLowerCase();
  const taskMatches = searchQ ? tasks.filter((t) => t.title?.toLowerCase().includes(searchQ)).slice(0, 5) : [];
  const messageMatches = searchQ ? messages.filter((m) => m.message?.toLowerCase().includes(searchQ)).slice(0, 5) : [];
  const hasQuery = searchQ.length > 0;
  const hasResults = taskMatches.length > 0 || messageMatches.length > 0;

  const rings = [
    { label: 'Attendance', sub: `${stats.present_days}/${stats.total_days} days`, pct: attendancePct, color: '#8FCBFF', cardBg: 'var(--primary)' },
    { label: 'Tasks done', sub: `${completed}/${tasks.length} tasks`, pct: tasksPct, color: '#9CF2E8', cardBg: 'var(--accent-teal)' },
    { label: 'Weekly hours', sub: `${weeklyHours.toFixed(1)} / ${WEEKLY_TARGET}h`, pct: weeklyHoursPct, color: '#FFE985', cardBg: 'var(--warning)' },
  ];

  return (
    <InternLayout
      intern={intern}
      title={`Hello, ${intern?.name?.split(' ')[0] || ''}!`}
      subtitle={todayLabel}
      center={(
        <div
          className="idash-search-wrap"
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
        >
          <div className="idash-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              className="idash-search-input"
              placeholder="Search tasks, messages…"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
          </div>
          {searchOpen && hasQuery && (
            <div className="idash-search-dropdown">
              {!hasResults && <div className="idash-search-empty">No matches for "{searchQuery}"</div>}
              {taskMatches.length > 0 && (
                <div className="idash-search-group">
                  <div className="idash-search-group-label">Tasks</div>
                  {taskMatches.map((t) => (
                    <button key={`t-${t.id}`} className="idash-search-item" onClick={() => navigate('/intern/tasks')}>
                      <span className="idash-search-item-title">{t.title}</span>
                      <span className="idash-search-item-sub">{t.status}</span>
                    </button>
                  ))}
                </div>
              )}
              {messageMatches.length > 0 && (
                <div className="idash-search-group">
                  <div className="idash-search-group-label">Messages</div>
                  {messageMatches.map((m) => (
                    <button key={`m-${m.id}`} className="idash-search-item" onClick={() => navigate('/intern/chat')}>
                      <span className="idash-search-item-title">{m.message}</span>
                      <span className="idash-search-item-sub">{m.is_announcement ? 'Announcement' : 'Chat'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    >
      <div className="page-stack">
        <div className="idash-grid">
          <div className="intern-panel" style={{ background: 'var(--primary-light)' }}>
            <div className="intern-panel-title">Announcements</div>
            <div className="idash-list">
              {announcements.length === 0 && (
                <div className="idash-empty">
                  <div style={{ fontSize: 20, marginBottom: 6 }}>🔔</div>
                  <div>No announcements yet</div>
                </div>
              )}
              {announcements.map((a) => (
                <div key={a.id} className="idash-item">
                  <div className="idash-item-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 10v4a1 1 0 0 0 1 1h3l5 4V5L7 9H4a1 1 0 0 0-1 1z" /><path d="M16 9a3 3 0 0 1 0 6" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="idash-item-title">{a.message}</div>
                    <div className="idash-item-sub">Admin · {relativeTime(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="intern-see-more" onClick={() => navigate('/intern/chat')}>See more ›</button>
          </div>

          <div className="intern-panel" style={{ background: 'var(--warning-light)' }}>
            <div className="intern-panel-title">Upcoming tasks</div>
            <div className="idash-list">
              {upcoming.length === 0 && (
                <div className="idash-empty">
                  <div style={{ fontSize: 20, marginBottom: 6 }}>✅</div>
                  <div>You're all caught up — no upcoming tasks</div>
                </div>
              )}
              {upcoming.map((t) => (
                <div key={t.id} className="idash-inset-card">
                  <div className="idash-item-title">{t.title}</div>
                  <div className="idash-item-sub">Due {new Date(t.due_date).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
            <button className="intern-see-more" onClick={() => navigate('/intern/tasks')}>See more ›</button>
          </div>

          <div className="idash-ring-list">
            {rings.map((r) => <Ring key={r.label} {...r} />)}
            <button className="intern-see-more" style={{ textAlign: 'center', marginTop: 2 }} onClick={() => navigate('/intern/tasks')}>See more ›</button>
          </div>

          <div className="intern-panel idash-week" style={{ background: 'var(--accent-purple-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span className="intern-panel-title" style={{ marginBottom: 0 }}>My week</span>
              <span className="idash-week-label">{weekLabel}</span>
            </div>
            <div className="idash-week-grid">
              {week.map((d, i) => (
                <div key={i} className="idash-week-day" style={{ background: d.bg }}>
                  <div style={{ color: d.subColor }} className="idash-week-day-name">{d.day}</div>
                  <div style={{ color: d.color }} className="idash-week-day-date">{d.date}</div>
                  <div style={{ color: d.color }} className="idash-week-day-icon">{d.icon}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="intern-panel" style={{ background: 'var(--bg-panel)' }}>
          <div className="intern-panel-title">Recent submissions</div>
          {submissions.length === 0 ? (
            <div className="idash-empty" style={{ background: 'var(--bg-inset)' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
              <div>No submissions yet</div>
            </div>
          ) : (
            <div className="idash-submissions-grid">
              {submissions.map((s, i) => (
                <div key={s.id} className="idash-sub-card">
                  <div className="idash-sub-swatch" style={{ background: SUBMISSION_SWATCH[i % SUBMISSION_SWATCH.length] }} />
                  <div className="idash-sub-body">
                    <div className="idash-item-title">{s.task_title}</div>
                    <div className="idash-sub-status-row">
                      <span className="idash-sub-dot" style={{ background: SUBMISSION_STATUS_COLOR[s.status] || 'var(--muted)' }} />
                      <span className="idash-sub-status-label">{s.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </InternLayout>
  );
};

export default InternDashboard;
