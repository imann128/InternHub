import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import internPortalService from '../../services/internPortalService';
import Loader from '../../components/common/Loader';
import { toast } from 'react-toastify';
import { InternNavbar } from './InternDashboard';
import useCamera from '../../hooks/useCamera';
import { loadFaceModels, getFaceDescriptor } from '../../utils/faceApi';
import getCurrentLocation from '../../hooks/useGeolocation';

const InternAttendance = () => {
  const { intern, logout } = useAuth();
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [mode, setMode] = useState(null); // 'in' or 'out'
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const { videoRef, ready, error, startCamera, stopCamera } = useCamera();

  const fetchData = () => {
    setLoading(true);
    api.get('/intern/me')
      .then(res => {
        setAttendance(res.data.data.attendance);
        setProfile(res.data.data.intern);
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  useEffect(() => {
    loadFaceModels().catch(() => { });
  }, []);

  const todayRecord = attendance.find(r => {
    const recDate = new Date(r.created_at);
    const now = new Date();
    return recDate.getFullYear() === now.getFullYear() &&
      recDate.getMonth() === now.getMonth() &&
      recDate.getDate() === now.getDate();
  });

  const openCamera = async (actionMode) => {
    setMode(actionMode);
    setShowCamera(true);
    setStatus('Starting camera...');
    await startCamera();
    setStatus('Position your face in the frame, then click Capture');
  };

  const closeCamera = () => {
    stopCamera();
    setShowCamera(false);
    setMode(null);
    setStatus('');
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setProcessing(true);
    setStatus('Detecting face...');

    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (!descriptor) {
        setStatus('No face detected. Try again.');
        setProcessing(false);
        return;
      }

      setStatus('Getting your location...');
      const { latitude, longitude } = await getCurrentLocation();



      setStatus(mode === 'in' ? 'Checking in...' : 'Checking out...');
      const action = mode === 'in' ? internPortalService.checkInSelf : internPortalService.checkOutSelf;
      await action(descriptor, latitude, longitude);

      toast.success(mode === 'in' ? 'Checked in successfully!' : 'Checked out successfully!');
      closeCamera();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed. Try again.');
      setStatus('Failed. Try again or contact admin.');
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (t) => {
    if (!t) return '—';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
  };

  return (
    <div className="intern-page">
      <InternNavbar name={intern?.name} onLogout={() => { logout(); navigate('/intern/login'); }} navigate={navigate} />

      <div className="intern-content" style={{ maxWidth: 900 }}>
        <h2 style={{ color: 'var(--text)', marginBottom: 16 }}>My Attendance</h2>

        {profile && (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
            {profile.location_id
              ? (profile.location_active
                  ? <>Check-in location: <strong style={{ color: 'var(--text)' }}>{profile.location_name}</strong></>
                  : <span style={{ color: '#DC2626' }}>Your assigned location ({profile.location_name}) is no longer active — contact your admin.</span>)
              : <span style={{ color: '#DC2626' }}>No check-in location assigned yet — contact your admin before checking in.</span>}
          </p>
        )}

        <div className="intern-card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <p style={{ color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>
              {todayRecord?.check_in ? `Checked in at ${formatTime(todayRecord.check_in)}` : 'Not checked in yet'}
              {todayRecord?.check_out ? ` · Checked out at ${formatTime(todayRecord.check_out)}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {!todayRecord?.check_in && (
              <button className="btn-primary" onClick={() => openCamera('in')}>Check In</button>
            )}
            {todayRecord?.check_in && !todayRecord?.check_out && (
              <button className="btn-primary" onClick={() => openCamera('out')}>Check Out</button>
            )}
            {todayRecord?.check_in && todayRecord?.check_out && (
              <span className="badge badge-success">Done for today</span>
            )}
          </div>
        </div>

        {showCamera && (
          <div className="modal-overlay" onClick={closeCamera}>
            <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">{mode === 'in' ? 'Check In' : 'Check Out'} — Face Verification</h3>
                <button className="modal-close" onClick={closeCamera}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#0F172A', borderRadius: 16, overflow: 'hidden', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {error && <span style={{ color: '#F87171', fontSize: 13, padding: '0 20px', textAlign: 'center' }}>{error}</span>}
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: ready ? 'block' : 'none', transform: 'scaleX(-1)' }}
                  />
                </div>
                <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', marginBottom: 16, minHeight: 18 }}>{status}</p>
                <button className="btn-primary" style={{ width: '100%' }} onClick={handleCapture} disabled={!ready || processing}>
                  {processing ? <span className="btn-spinner" /> : 'Capture & Verify'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? <Loader /> : attendance.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 48 }}>No attendance records yet</div>
        ) : (
          <div className="intern-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="intern-table">
              <thead>
                <tr>
                  {['Date', 'Status', 'Check In', 'Check Out', 'Hours', 'Source'].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {attendance.map(rec => (
                  <tr key={rec.id}>
                    <td>{new Date(rec.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td>
                      <span style={{
                        padding: '4px 10px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                        background: rec.status === 'present' ? '#DCFCE7' : '#FEE2E2',
                        color: rec.status === 'present' ? '#16A34A' : '#DC2626'
                      }}>
                        {rec.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>{formatTime(rec.check_in)}</td>
                    <td style={{ color: 'var(--muted)' }}>{formatTime(rec.check_out)}</td>
                    <td style={{ color: 'var(--muted)' }}>{rec.total_hours ? `${rec.total_hours}h` : '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12, textTransform: 'capitalize' }}>{rec.source || 'admin'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InternAttendance;
