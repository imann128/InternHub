import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import internPortalService from '../../services/internPortalService';
import useCamera from '../../hooks/useCamera';
import { loadFaceModels, getFaceDescriptor } from '../../utils/faceApi';
import getCurrentLocation from '../../hooks/useGeolocation';
import { toast } from 'react-toastify';
import Loader from '../../components/common/Loader';
import { CheckIcon, WarningIcon, WifiOffIcon, CameraIcon, CloseIcon, DotIcon } from '../../components/common/Icons';
import '../../styles/mobile-checkin.css';

const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Same formula as backend/src/utils/geo.js haversineDistance — kept in sync
// so the live "Xm away" pill shown before check-in matches what the server
// will actually decide when the check-in request lands.
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const toDateKey = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const getMonday = (d) => {
  const offset = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
};

const MobileCheckIn = () => {
  const navigate = useNavigate();
  const { videoRef, ready, error: camError, startCamera, stopCamera } = useCamera();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [liveDistance, setLiveDistance] = useState(null); // { meters, withinRange } | null | 'unavailable'
  const [flow, setFlow] = useState('idle'); // idle | checking | success | out_of_range | offline | error
  const [flowMessage, setFlowMessage] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    internPortalService.getMe()
      .then((res) => {
        setProfile(res.data.data.intern);
        setAttendance(res.data.data.attendance || []);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { loadFaceModels().catch(() => {}); }, []);

  // Without this, an intern who never finished the one-time face setup (or
  // opens this route directly, e.g. from a home-screen shortcut, without
  // ever visiting the dashboard first) could get all the way to "Capture &
  // Verify" only to hit a generic "Please complete face verification
  // first" 400 with no way to actually do that from this page. Redirect
  // upfront instead, same guard InternDashboard already uses.
  useEffect(() => {
    internPortalService.getFaceStatus()
      .then((res) => {
        if (!res.data.data.face_verified) navigate('/intern/verify-identity');
      })
      .catch(() => {});
  }, [navigate]);

  // Live distance pill: best-effort, doesn't block the page if geolocation
  // is denied -- it just falls back to "unavailable" rather than guessing.
  useEffect(() => {
    if (!profile?.location_latitude || !profile?.location_longitude) return;
    getCurrentLocation()
      .then(({ latitude, longitude }) => {
        const meters = Math.round(haversineDistance(latitude, longitude, profile.location_latitude, profile.location_longitude));
        setLiveDistance({ meters, withinRange: meters <= (profile.location_radius_meters || 80) });
      })
      .catch(() => setLiveDistance('unavailable'));
  }, [profile]);

  const todayKey = toDateKey(new Date());
  const todayRecord = attendance.find((r) => (r.date?.slice?.(0, 10) || toDateKey(new Date(r.date))) === todayKey);
  const action = todayRecord?.check_in && !todayRecord?.check_out ? 'out' : 'in';
  const alreadyDone = todayRecord?.check_in && todayRecord?.check_out;

  const openCamera = async () => {
    setFlow('idle');
    setShowCamera(true);
    await startCamera();
  };

  const closeCamera = () => {
    stopCamera();
    setShowCamera(false);
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setFlow('checking');
    try {
      const descriptor = await getFaceDescriptor(videoRef.current);
      if (!descriptor) {
        setFlow('error');
        setFlowMessage('No face detected. Move closer to the camera and try again.');
        return;
      }
      const { latitude, longitude } = await getCurrentLocation();
      const call = action === 'in' ? internPortalService.checkInSelf : internPortalService.checkOutSelf;
      await call(descriptor, latitude, longitude);
      setFlow('success');
      closeCamera();
      fetchData();
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      if (!err.response) {
        setFlow('offline');
        setFlowMessage("Can't reach the server. Check your connection and try again.");
      } else if (status === 403) {
        setFlow('out_of_range');
        setFlowMessage(msg);
      } else {
        setFlow('error');
        setFlowMessage(msg);
      }
    }
  };

  const now = new Date();
  const monday = getMonday(now);
  const weekDates = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const attendanceByDate = Object.fromEntries(attendance.map((a) => [a.date?.slice?.(0, 10) || toDateKey(new Date(a.date)), a]));
  const week = DAY_NAMES.map((day, i) => {
    const key = toDateKey(weekDates[i]);
    const isToday = key === todayKey;
    const isFuture = weekDates[i] > now && !isToday;
    const record = attendanceByDate[key];
    let icon = '—';
    if (isToday) icon = <DotIcon size={9} />;
    else if (!isFuture) icon = record?.status === 'present' ? <CheckIcon size={11} /> : record ? <CloseIcon size={10} /> : '—';
    return { day, icon, isToday };
  });

  if (loading) return <Loader />;

  const card = alreadyDone
    ? { cls: 'mci-card-teal', icon: <CheckIcon size={26} />, title: 'All done for today', sub: `Checked in at ${todayRecord.check_in} · out at ${todayRecord.check_out}`, showButton: false }
    : flow === 'checking'
    ? { cls: 'mci-card-blue', icon: <span className="btn-spinner" />, title: 'Verifying…', sub: 'Checking your face ID and location', showButton: false }
    : flow === 'success'
    ? { cls: 'mci-card-teal', icon: <CheckIcon size={26} />, title: `Checked ${action === 'in' ? 'in' : 'out'} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`, sub: 'Have a great day!', showButton: false }
    : flow === 'out_of_range'
    ? { cls: 'mci-card-danger', icon: <WarningIcon size={26} />, title: "You're outside the check-in radius", sub: flowMessage, showButton: true, btnLabel: 'Try again' }
    : flow === 'offline'
    ? { cls: 'mci-card-muted', icon: <WifiOffIcon size={26} />, title: "Can't reach the server", sub: flowMessage, showButton: true, btnLabel: 'Retry' }
    : flow === 'error'
    ? { cls: 'mci-card-danger', icon: <WarningIcon size={26} />, title: 'Something went wrong', sub: flowMessage, showButton: true, btnLabel: 'Try again' }
    : { cls: 'mci-card-blue', icon: <CameraIcon size={26} />, title: `Ready to check ${action}`, sub: 'Verify your face to continue.', showButton: true, btnLabel: action === 'in' ? 'Check In' : 'Check Out' };

  return (
    <div className="mci-page">
      <div className="mci-header">
        <div className="mci-title">Check {action === 'in' ? 'In' : 'Out'}</div>
        <div className="mci-subtitle">{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="mci-body">
        <div className="mci-location-pill">
          <div className="mci-location-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="mci-location-name">{profile?.location_name || 'No location assigned'}</div>
            <div className={`mci-location-distance ${liveDistance === 'unavailable' ? 'muted' : liveDistance?.withinRange ? 'ok' : liveDistance ? 'bad' : 'muted'}`}>
              {liveDistance === 'unavailable' ? 'Location unavailable'
                : liveDistance ? `${liveDistance.meters}m away · ${liveDistance.withinRange ? 'within range' : 'out of range'}`
                : profile?.location_id ? 'Checking your distance…' : 'Contact your admin to get a location assigned'}
            </div>
          </div>
        </div>

        <div className={`mci-card ${card.cls}`}>
          <div className="mci-card-icon">{card.icon}</div>
          <div>
            <div className="mci-card-title">{card.title}</div>
            <div className="mci-card-sub">{card.sub}</div>
          </div>
          {card.showButton && (
            <button className="mci-card-btn" onClick={openCamera}>{card.btnLabel}</button>
          )}
        </div>

        <div className="mci-week-card">
          <div className="mci-week-title">This week</div>
          <div className="mci-week-grid">
            {week.map((d, i) => (
              <div key={i} className={`mci-week-day ${d.isToday ? 'today' : ''}`}>
                <div className="mci-week-day-name">{d.day}</div>
                <div className="mci-week-day-icon">{d.icon}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mci-tabbar">
        <button className="mci-tab active" onClick={() => navigate('/intern/mobile-checkin')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          <span>Attendance</span>
        </button>
        <button className="mci-tab" onClick={() => navigate('/intern/dashboard')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
          <span>Home</span>
        </button>
        <button className="mci-tab" onClick={() => navigate('/intern/chat')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span>Chat</span>
        </button>
      </div>

      {showCamera && (
        <div className="mci-camera-overlay">
          <div className="mci-camera-sheet">
            <div className="mci-camera-box">
              {camError && <span className="mci-camera-error">{camError}</span>}
              <video ref={videoRef} autoPlay muted playsInline className={`mci-camera-video ${ready ? 'visible' : ''}`} />
            </div>
            <p className="mci-camera-status">{flow === 'checking' ? 'Verifying…' : 'Position your face in the frame'}</p>
            <button className="mci-card-btn" style={{ width: '100%' }} onClick={handleCapture} disabled={!ready || flow === 'checking'}>
              {flow === 'checking' ? <span className="btn-spinner" /> : 'Capture & Verify'}
            </button>
            <button className="mci-camera-cancel" onClick={closeCamera}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileCheckIn;
