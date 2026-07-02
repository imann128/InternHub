import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import { toast } from 'react-toastify';
import '../styles/auth.css';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.password) e.password = 'Password is required';
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
      const res = await authService.login(form);
      login(res.data.data);
      toast.success(`Welcome back, ${res.data.data.admin.name}!`);
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
          <div className="auth-logo">IP</div>
          <h1 className="auth-title">Intern Portal</h1>
        </div>
        <h2 className="auth-heading">Sign in</h2>
        <p className="auth-sub">Enter your admin credentials to continue</p>

        <form onSubmit={handleSubmit} className="form">
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

          <button type="submit" className="btn-primary auth-btn" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          No account? <Link to="/signup" className="auth-link">Create one</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 10, color: 'var(--muted)', fontSize: 13 }}>
          Intern? <a href="/intern/login" style={{ color: 'var(--primary)' }}>Login here</a>
        </p>
      </div>
    </div>
  );
};

export default Login;
