import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import Loader from '../components/common/Loader';
import EmptyState from '../components/common/EmptyState';
import attendanceService from '../services/attendanceService';
import internService from '../services/internService';
import { toast } from 'react-toastify';
import { CheckIcon } from '../components/common/Icons';
import '../styles/interns.css';
import '../styles/attendance.css';

const THRESHOLD = 40;

const getWeekRange = () => {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    week_start: monday.toISOString().slice(0, 10),
    week_end: sunday.toISOString().slice(0, 10),
  };
};

const Attendance = () => {
  const [tab, setTab] = useState('daily');
  const [interns, setInterns] = useState([]);
  const [records, setRecords] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterIntern, setFilterIntern] = useState('');
  const weekRange = getWeekRange();

  useEffect(() => {
    internService.getAll({}).then(res => setInterns(res.data.data)).catch(() => {});
  }, []);

  const fetchDaily = useCallback(() => {
    setLoading(true);
    attendanceService.getAll({ date: selectedDate, intern_id: filterIntern })
      .then(res => setRecords(res.data.data))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [selectedDate, filterIntern]);

  const fetchWeekly = useCallback(() => {
    setLoading(true);
    attendanceService.getWeeklySummary({ ...weekRange, intern_id: filterIntern })
      .then(res => setWeekly(res.data.data))
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [filterIntern]);

  useEffect(() => {
    if (tab === 'daily') fetchDaily();
    else fetchWeekly();
  }, [tab, fetchDaily, fetchWeekly]);

  const getRecord = (internId) => records.find(r => r.intern_id === internId);

  const handleCheckIn = async (internId) => {
    setActing(internId);
    const now = new Date().toTimeString().slice(0, 8);
    try {
      await attendanceService.checkIn({ intern_id: internId, date: selectedDate, check_in: now });
      toast.success('Checked in');
      fetchDaily();
    } catch (err) { toast.error(err.message); }
    finally { setActing(null); }
  };

  const handleCheckOut = async (internId) => {
    setActing(internId);
    const now = new Date().toTimeString().slice(0, 8);
    try {
      await attendanceService.checkOut({ intern_id: internId, date: selectedDate, check_out: now });
      toast.success('Checked out');
      fetchDaily();
    } catch (err) { toast.error(err.message); }
    finally { setActing(null); }
  };

  const handleMarkAbsent = async (internId) => {
    setActing(internId);
    try {
      await attendanceService.mark({ intern_id: internId, date: selectedDate, status: 'absent' });
      toast.success('Marked absent');
      fetchDaily();
    } catch (err) { toast.error(err.message); }
    finally { setActing(null); }
  };

  const filteredInterns = filterIntern
    ? interns.filter(i => i.id === parseInt(filterIntern))
    : interns;

  const formatTime = (t) => {
    if (!t) return '—';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <MainLayout
      title="Attendance"
      action={
        <button
          className="btn-pill-primary"
          style={{ background: 'var(--card)', color: 'var(--muted-strong)' }}
          onClick={() => attendanceService.exportCSV({
            date: tab === 'daily' ? selectedDate : undefined,
            intern_id: filterIntern || undefined,
          })}
        >
          ↓ Export CSV
        </button>
      }
    >
      <div className="page-stack">
        <div className="filters-row">
          <div className="tab-switch">
            <button className={`tab-btn ${tab === 'daily' ? 'tab-active' : ''}`} onClick={() => setTab('daily')}>Daily</button>
            <button className={`tab-btn ${tab === 'weekly' ? 'tab-active' : ''}`} onClick={() => setTab('weekly')}>Weekly summary</button>
          </div>
          {tab === 'daily' && (
            <input type="date" className="filter-select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          )}
          <select className="filter-select" value={filterIntern} onChange={e => setFilterIntern(e.target.value)}>
            <option value="">All interns</option>
            {interns.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>

        {loading ? <Loader /> : tab === 'daily' ? (
          filteredInterns.length === 0 ? <EmptyState message="No interns found" /> : (
            <div className="interns-table-wrap">
              <table className="interns-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Check in</th>
                    <th>Check out</th>
                    <th>Hours</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterns.map(intern => {
                    const rec = getRecord(intern.id);
                    const isActing = acting === intern.id;
                    return (
                      <tr key={intern.id}>
                        <td><span className="intern-name">{intern.name}</span></td>
                        <td><span className="badge badge-muted">{intern.department}</span></td>
                        <td><span className="time-val">{formatTime(rec?.check_in)}</span></td>
                        <td><span className="time-val">{formatTime(rec?.check_out)}</span></td>
                        <td><span className="hours-val">{rec?.total_hours ? `${rec.total_hours}h` : '—'}</span></td>
                        <td>
                          {rec ? (
                            <span className={`badge ${rec.status === 'present' ? 'badge-success' : 'badge-danger'}`}>
                              {rec.status}
                            </span>
                          ) : <span className="badge badge-muted">Not marked</span>}
                        </td>
                        <td>
                          <div className="action-btns">
                            {!rec?.check_in && (
                              <button className="btn-present" onClick={() => handleCheckIn(intern.id)} disabled={isActing}>
                                {isActing ? '...' : 'Check in'}
                              </button>
                            )}
                            {rec?.check_in && !rec?.check_out && (
                              <button className="btn-absent" onClick={() => handleCheckOut(intern.id)} disabled={isActing}>
                                {isActing ? '...' : 'Check out'}
                              </button>
                            )}
                            {rec?.check_in && rec?.check_out && (
                              <span className="badge badge-success">Done</span>
                            )}
                            {!rec?.check_in && (
                              <button className="btn-mark-absent" onClick={() => handleMarkAbsent(intern.id)} disabled={isActing}>
                                Absent
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          weekly.length === 0 ? <EmptyState message="No data found" /> : (
            <div className="interns-table-wrap">
              <p className="week-range-label">Week: {weekRange.week_start} → {weekRange.week_end}</p>
              <table className="interns-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Days present</th>
                    <th>Days absent</th>
                    <th>Total hours</th>
                    <th>{THRESHOLD}h target</th>
                  </tr>
                </thead>
                <tbody>
                  {weekly.map(row => {
                    const pct = Math.min((parseFloat(row.total_hours) / THRESHOLD) * 100, 100).toFixed(0);
                    const met = parseFloat(row.total_hours) >= THRESHOLD;
                    return (
                      <tr key={row.intern_id}>
                        <td><span className="intern-name">{row.intern_name}</span></td>
                        <td><span className="badge badge-muted">{row.department}</span></td>
                        <td><span className="badge badge-success">{row.days_present}</span></td>
                        <td><span className="badge badge-danger">{row.days_absent}</span></td>
                        <td><span className="hours-val">{parseFloat(row.total_hours).toFixed(2)}h</span></td>
                        <td>
                          <div className="progress-wrap">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${pct}%`, background: met ? 'var(--accent-teal)' : 'var(--primary)' }} />
                            </div>
                            <span className="progress-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: met ? 'var(--accent-teal)' : 'var(--primary)' }}>
                              {pct}% {met && <CheckIcon size={11} />}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </MainLayout>
  );
};

export default Attendance;