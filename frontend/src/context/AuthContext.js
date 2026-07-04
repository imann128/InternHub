import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [intern, setIntern] = useState(null);
  const [loading, setLoading] = useState(true);

  // The access token is an HttpOnly cookie now — the frontend has no way to
  // read it directly, so on every fresh load (or hard refresh) it asks the
  // backend who, if anyone, the current cookies belong to.
  useEffect(() => {
    authService.me()
      .then((res) => {
        const { role, admin: adminData, intern: internData } = res.data.data;
        if (role === 'admin') setAdmin(adminData);
        if (role === 'intern') setIntern(internData);
      })
      .catch(() => {
        setAdmin(null);
        setIntern(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (data) => {
    setAdmin(data.admin);
    setIntern(null);
  };

  const internLogin = (data) => {
    setIntern(data.intern);
    setAdmin(null);
  };

  const logout = () => {
    // Best-effort: revoke the session server-side, but don't block clearing
    // local state on it — the user should end up logged out client-side
    // even if this call fails (network blip, already-expired session, etc).
    authService.logout().catch(() => {});
    setAdmin(null);
    setIntern(null);
  };

  return (
    <AuthContext.Provider value={{ admin, intern, login, internLogin, logout, loading, setIntern }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
