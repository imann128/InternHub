import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { toast } from 'react-toastify';
import '../styles/auth.css';

const Signup = () => {
  // 'new' = create a brand-new organization (needs the global signup key).
  // 'join' = join an existing admin's organization as a second admin, using
  // an invite code they generated from their Settings page.
  const [mode, setMode] = useState('new');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', signup_key: '', organization_name: '', invite_code: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (mode === 'new') {
      if (!form.signup_key.trim()) e.signup_key = 'Signup key is required';
    } else {
      if (!form.invite_code.trim()) e.invite_code = 'Invite code is required';
    }
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }
    setLoading(true);
    try {
      const res = await authService.signup({
        name: form.name,
        email: form.email,
        password: form.password,
        ...(mode === 'new'
          ? {
              signup_key: form.signup_key,
              // Optional — backend falls back to `${name}'s Organization` if
              // left blank, so this isn't added to validate()'s required fields.
              organization_name: form.organization_name.trim() || undefined,
            }
          : { invite_code: form.invite_code.trim() }),
      });
      login(res.data.data);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className={`auth-card slide-up ${shake ? 'shake' : ''}`}>
        <div className="auth-brand">
          <div className="auth-logo">IH</div>
          <h1 className="auth-title">InternHub</h1>
        </div>
        <h2 className="auth-heading">Create account</h2>
        <p className="auth-sub">Admin accounts only</p>

        <div className="form-group" style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button
            type="button"
            className={mode === 'new' ? 'btn-pill-primary' : 'btn-ghost'}
            style={{ flex: 1 }}
            onClick={() => { setMode('new'); setErrors({}); }}
          >
            New organization
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'btn-pill-primary' : 'btn-ghost'}
            style={{ flex: 1 }}
            onClick={() => { setMode('join'); setErrors({}); }}
          >
            Join with invite code
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">

          {mode === 'new' ? (
            <>
              <div className="form-group">
                <label className="form-label">Signup Key</label>
                <input
                  className={`form-input ${errors.signup_key ? 'input-error' : ''}`}
                  type="password"
                  name="signup_key"
                  value={form.signup_key}
                  onChange={handleChange}
                  placeholder="Enter admin signup key"
                />
                {errors.signup_key && <span className="form-error">{errors.signup_key}</span>}
              </div>

              <div className="form-group">
                <label className="form-label">Organization Name</label>
                <input
                  className="form-input"
                  name="organization_name"
                  value={form.organization_name}
                  onChange={handleChange}
                  placeholder={`Optional — defaults to "${form.name || 'Your name'}'s Organization"`}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">Invite Code</label>
              <input
                className={`form-input ${errors.invite_code ? 'input-error' : ''}`}
                name="invite_code"
                value={form.invite_code}
                onChange={handleChange}
                placeholder="Code shared by your organization's admin"
                style={{ textTransform: 'uppercase' }}
              />
              {errors.invite_code && <span className="form-error">{errors.invite_code}</span>}
              <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                You'll join their organization as a second admin.
              </p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Your name"
            />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className={`form-input ${errors.email ? 'input-error' : ''}`}
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@example.com"
            />
            {errors.email && <span className="form-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className={`form-input ${errors.password ? 'input-error' : ''}`}
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
            />
            {errors.password && <span className="form-error">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              className={`form-input ${errors.confirm ? 'input-error' : ''}`}
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={handleChange}
              placeholder="••••••••"
            />
            {errors.confirm && <span className="form-error">{errors.confirm}</span>}
          </div>

          <button type="submit" className="btn-primary auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Create Account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
