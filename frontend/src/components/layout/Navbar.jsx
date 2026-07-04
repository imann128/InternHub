import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import '../../styles/layout.css';

const Navbar = ({ title, subtitle, action }) => {
  const { admin } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const initials = (admin?.name || 'Admin')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-heading">
        <h1 className="navbar-title">{title}</h1>
        <span className="navbar-status">
          <span className="navbar-status-dot" />
          {subtitle || 'Admin panel'}
        </span>
      </div>
      <div className="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {action}
        <button
          className="navbar-icon-btn"
          onClick={() => setDark(d => !d)}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="navbar-avatar">{initials}</span>
          <span className="navbar-admin-name">{admin?.name || 'Admin'}</span>
        </div>
      </div>
    </header>
  );
};

export default Navbar;