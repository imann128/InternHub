import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import Loader from '../components/common/Loader';
import organizationService from '../services/organizationService';
import { toast } from 'react-toastify';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null); // { name, inviteCode, hasGroqKey, groqKeyPreview, globalKeyConfigured }
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const load = () => {
    setLoading(true);
    organizationService.getSettings()
      .then(res => setSettings(res.data.data))
      .catch(err => toast.error(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRegenerate = async () => {
    if (settings.inviteCode && !window.confirm('This replaces the current invite code — anyone with the old one will no longer be able to use it. Continue?')) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await organizationService.regenerateInviteCode();
      setSettings(s => ({ ...s, inviteCode: res.data.data.inviteCode }));
      toast.success('Invite code generated');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(settings.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      const res = await organizationService.updateGroqKey(groqKeyInput.trim());
      setSettings(s => ({ ...s, hasGroqKey: res.data.data.hasGroqKey, groqKeyPreview: res.data.data.groqKeyPreview }));
      setGroqKeyInput('');
      toast.success(res.data.data.hasGroqKey ? 'Groq API key saved' : 'Groq API key removed');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message);
    } finally {
      setSavingKey(false);
    }
  };

  if (loading || !settings) return <Loader />;

  const aiAvailable = settings.hasGroqKey || settings.globalKeyConfigured;

  return (
    <MainLayout title="Settings" subtitle="Organization-wide configuration">
      <div className="page-stack" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>

        <div className="intern-panel">
          <div className="intern-panel-title">Invite a co-admin</div>
          <p className="idash-item-sub" style={{ marginBottom: 14 }}>
            Share this code with a co-worker — they can use it on the sign-up page to join <strong>{settings.name}</strong> as a
            second admin, instead of creating a brand-new organization.
          </p>

          {settings.inviteCode ? (
            <div className="idash-inset-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <code style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>{settings.inviteCode}</code>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
                <button className="btn-ghost" onClick={handleRegenerate} disabled={regenerating}>
                  {regenerating ? <span className="btn-spinner" /> : 'Regenerate'}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-pill-primary" onClick={handleRegenerate} disabled={regenerating}>
              {regenerating ? <span className="btn-spinner" /> : 'Generate invite code'}
            </button>
          )}
          <p className="idash-item-sub" style={{ marginTop: 10 }}>
            Regenerating replaces the old code — anyone who still has it won't be able to use it anymore.
          </p>
        </div>

        <div className="intern-panel">
          <div className="intern-panel-title">AI assistant (Groq API key)</div>
          <p className="idash-item-sub" style={{ marginBottom: 14 }}>
            The portal assistant and "Enhance with AI" work out of the box if the server has a shared key configured.
            Add your own key here if you'd rather use your own Groq account and billing.
          </p>

          <div className="idash-inset-card" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: aiAvailable ? 'var(--accent-teal)' : 'var(--warning)' }} />
            <span className="idash-item-title">
              {settings.hasGroqKey
                ? `Using your organization's key (${settings.groqKeyPreview})`
                : settings.globalKeyConfigured
                  ? 'Using the shared server key'
                  : 'AI features are currently unavailable'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              type="password"
              placeholder={settings.hasGroqKey ? 'Enter a new key to replace it' : 'gsk_...'}
              value={groqKeyInput}
              onChange={(e) => setGroqKeyInput(e.target.value)}
            />
            <button className="btn-pill-primary" onClick={handleSaveKey} disabled={savingKey || !groqKeyInput.trim()}>
              {savingKey ? <span className="btn-spinner" /> : 'Save'}
            </button>
          </div>
          {settings.hasGroqKey && (
            <button
              className="btn-ghost"
              style={{ marginTop: 10 }}
              onClick={async () => {
                setSavingKey(true);
                try {
                  const res = await organizationService.updateGroqKey('');
                  setSettings(s => ({ ...s, hasGroqKey: res.data.data.hasGroqKey, groqKeyPreview: res.data.data.groqKeyPreview }));
                  toast.success('Organization key removed — falling back to the shared server key, if any.');
                } catch (err) {
                  toast.error(err.response?.data?.message || err.message);
                } finally {
                  setSavingKey(false);
                }
              }}
              disabled={savingKey}
            >
              Remove organization key
            </button>
          )}
        </div>

      </div>
    </MainLayout>
  );
};

export default Settings;
