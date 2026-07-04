import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/auth.css';


const InternLogin = () => {
  const { internLogin, intern } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (intern) navigate('/intern/dashboard');
  }, [intern]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/intern/login', form);
      internLogin(res.data.data);
      toast.success(`Welcome, ${res.data.data.intern.name}`);
      navigate('/intern/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {location.state?.loggedOut && (
          <div className="auth-banner-success">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
            You've been signed out
          </div>
        )}
        <div className="auth-brand">
          <div className="auth-logo">IH</div>
          <span className="auth-title">InternHub</span>
        </div>
        <h2 className="auth-heading">Welcome back</h2>
        <p className="auth-sub">Sign in with your intern credentials</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              required
            />
          </div>
          <button type="submit" className="btn-primary auth-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: 13 }}>
          Admin? <a href="/login" style={{ color: 'var(--primary)' }}>Login here</a>
        </p>
      </div>
    </div>
  );
};

export default InternLogin;