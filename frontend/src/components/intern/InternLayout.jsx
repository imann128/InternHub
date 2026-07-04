import { useState, useEffect } from 'react';
import InternSidebar from './InternSidebar';
import '../../styles/layout.css';
import '../../styles/intern-layout.css';

const InternHeader = ({ title, subtitle, center, intern }) => {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const initials = (intern?.name || 'IN')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-heading" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
        <h1 className="navbar-title">{title}</h1>
        {subtitle && <span className="navbar-status" style={{ background: 'none' }}>{subtitle}</span>}
      </div>
      {center && <div style={{ flex: 1, minWidth: 120, maxWidth: 380 }}>{center}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
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
        <span className="navbar-avatar">{initials}</span>
      </div>
    </header>
  );
};

const InternLayout = ({ title, subtitle, center, intern, hideHeader, children }) => (
  <div className="app-canvas">
    <div className="app-shell intern-app-shell">
      <InternSidebar intern={intern} />
      <div className="main-content">
        {!hideHeader && <InternHeader title={title} subtitle={subtitle} center={center} intern={intern} />}
        <main className="page-content page-enter" style={hideHeader ? { paddingTop: 28 } : undefined}>
          {children}
        </main>
      </div>
    </div>
  </div>
);

export default InternLayout;
