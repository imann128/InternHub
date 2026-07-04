import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import internPortalService from '../../services/internPortalService';
import InternLayout from '../../components/intern/InternLayout';
import Loader from '../../components/common/Loader';
import { toast } from 'react-toastify';

const Toggle = ({ on, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: 44, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer', padding: 3,
      background: on ? 'var(--primary)' : 'var(--border)',
      display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start',
    }}
  >
    <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', display: 'block' }} />
  </button>
);

const InternSettings = () => {
  const { intern: authIntern } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null); // { name, email, department, version }
  const [faceVerified, setFaceVerified] = useState(false);
  const [emailNotif, setEmailNotif] = useState(true);
  const [chatSound, setChatSound] = useState(true);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [saveLabel, setSaveLabel] = useState('Save changes');
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([internPortalService.getMe(), internPortalService.getFaceStatus()])
      .then(([meRes, faceRes]) => {
        const intern = meRes.data.data.intern;
        setProfile({ name: intern.name, email: intern.email, department: intern.department, version: intern.version });
        setEmailNotif(intern.email_notifications !== false);
        setChatSound(intern.chat_sound !== false);
        setFaceVerified(faceRes.data.data.face_verified);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const toggleEmailNotif = async () => {
    const next = !emailNotif;
    setEmailNotif(next); // optimistic
    try {
      await internPortalService.updatePreferences({ email_notifications: next });
    } catch (err) {
      setEmailNotif(!next);
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const toggleChatSound = async () => {
    const next = !chatSound;
    setChatSound(next);
    try {
      await internPortalService.updatePreferences({ chat_sound: next });
    } catch (err) {
      setChatSound(!next);
      toast.error(err.response?.data?.message || err.message);
    }
  };

  const handleProfileField = (field) => (e) => {
    setProfile((p) => ({ ...p, [field]: e.target.value }));
  };

  const saveProfile = async () => {
    if (!profile.name.trim() || !profile.email.trim() || !profile.department.trim()) {
      toast.error('Name, email, and department are required');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await internPortalService.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim(),
        department: profile.department.trim(),
        version: profile.version,
      });
      setProfile((p) => ({ ...p, version: res.data.data.version }));
      setSaveLabel('Saved ✓');
      setTimeout(() => setSaveLabel('Save changes'), 1500);
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Your profile changed elsewhere — reloading latest data.');
        load();
      } else {
        toast.error(err.response?.data?.message || err.message);
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Enter your current and new password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      await internPortalService.changePassword({ current_password: currentPassword, new_password: newPassword });
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !profile) return <Loader />;

  return (
    <InternLayout title="Settings" subtitle="Manage your profile and preferences" intern={authIntern}>
      <div className="idash-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>

        <div className="intern-panel" style={{ background: 'var(--bg-panel)' }}>
          <div className="intern-panel-title">Profile</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="form-label">Full name</span>
              <input className="form-input" value={profile.name} onChange={handleProfileField('name')} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="form-label">Email</span>
              <input className="form-input" type="email" value={profile.email} onChange={handleProfileField('email')} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="form-label">Department</span>
              <input className="form-input" value={profile.department} onChange={handleProfileField('department')} />
            </label>
            <button className="btn-pill-primary" style={{ alignSelf: 'flex-start' }} onClick={saveProfile} disabled={savingProfile}>
              {savingProfile ? <span className="btn-spinner" /> : saveLabel}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div className="intern-panel" style={{ background: 'var(--accent-purple-light)' }}>
            <div className="intern-panel-title">Preferences</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="idash-inset-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="idash-item-title">Dark mode</div>
                  <div className="idash-item-sub">Switch the portal to a dark theme</div>
                </div>
                <Toggle on={dark} onClick={toggleDark} />
              </div>
              <div className="idash-inset-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="idash-item-title">Email notifications</div>
                  <div className="idash-item-sub">Task updates and announcements</div>
                </div>
                <Toggle on={emailNotif} onClick={toggleEmailNotif} />
              </div>
              <div className="idash-inset-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="idash-item-title">Chat sounds</div>
                  <div className="idash-item-sub">Play a sound on new messages</div>
                </div>
                <Toggle on={chatSound} onClick={toggleChatSound} />
              </div>
            </div>
          </div>

          <div className="intern-panel" style={{ background: 'var(--accent-teal-light)' }}>
            <div className="intern-panel-title" style={{ marginBottom: 4 }}>Face ID verification</div>
            <div className="idash-item-sub" style={{ marginBottom: 14 }}>Used for daily check-in / check-out</div>
            <div className="idash-inset-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: faceVerified ? 'var(--accent-teal)' : 'var(--warning)' }} />
                <span className="idash-item-title">{faceVerified ? 'Verified' : 'Not verified yet'}</span>
              </div>
              <button
                onClick={() => navigate('/intern/verify-identity')}
                style={{ background: 'transparent', border: '1px solid var(--accent-teal)', color: 'var(--accent-teal)', borderRadius: 99, padding: '7px 16px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {faceVerified ? 'Re-verify' : 'Verify now'}
              </button>
            </div>
          </div>

        </div>

        <div className="intern-panel" style={{ gridColumn: 'span 2', background: 'var(--warning-light)' }}>
          <div className="intern-panel-title">Password</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="form-label">Current password</span>
              <input className="form-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="form-label">New password</span>
              <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <button
              onClick={updatePassword}
              disabled={changingPassword}
              style={{ background: 'var(--warning)', color: '#fff', border: 'none', borderRadius: 99, padding: '11px 22px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            >
              {changingPassword ? <span className="btn-spinner" /> : 'Update password'}
            </button>
          </div>
        </div>

      </div>
    </InternLayout>
  );
};

export default InternSettings;
