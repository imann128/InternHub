import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import internPortalService from '../../services/internPortalService';
import InternLayout from '../../components/intern/InternLayout';
import Loader from '../../components/common/Loader';
import { toast } from 'react-toastify';
import useCamera from '../../hooks/useCamera';
import { loadFaceModels, getFaceDescriptor } from '../../utils/faceApi';
import getCurrentLocation from '../../hooks/useGeolocation';

const InternAttendance = () => {
  const { intern } = useAuth();
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
    <InternLayout title="My attendance" intern={intern}>
      <div className="page-stack">
        <Link to="/intern/mobile-checkin" style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, color: 'var(--primary-dark)', textDecoration: 'none' }}>
          📱 Open mobile check-in view
        </Link>
        {profile && (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {profile.location_id
              ? (profile.location_active
                  ? <>Check-in location: <strong style={{ color: 'var(--text)' }}>{profile.location_name}</strong></>
                  : <span style={{ color: 'var(--danger)' }}>Your assigned location ({profile.location_name}) is no longer active — contact your admin.</span>)
              : <span style={{ color: 'var(--danger)' }}>No check-in location assigned yet — contact your admin before checking in.</span>}
          </p>
        )}

        <div className="intern-panel" style={{ background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
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
          <div className="interns-table-wrap">
            <table className="interns-table">
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
                        background: rec.status === 'present' ? 'var(--accent-teal-light)' : 'var(--danger-light)',
                        color: rec.status === 'present' ? 'var(--accent-teal)' : 'var(--danger)'
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
    </InternLayout>
  );
};

export default InternAttendance;
