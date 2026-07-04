import axios from 'axios';

// Cookies (access_token, refresh_token, csrf_token) are HttpOnly-except-csrf
// and set by the backend — withCredentials is what makes the browser
// actually attach/accept them on cross-origin requests to the API.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

const readCookie = (name) => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

// Double-submit CSRF: echo the (JS-readable) csrf_token cookie back as a
// header on every request. The backend only actually checks this on
// mutating methods, but there's no harm sending it on GETs too.
api.interceptors.request.use((config) => {
  const csrfToken = readCookie('csrf_token');
  if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
  return config;
});

// Access tokens are short-lived (15m) by design. Rather than making every
// page track expiry, a single 401 triggers one transparent refresh-and-retry
// — concurrent 401s share the same in-flight refresh call instead of each
// firing their own (which would race and rotate the refresh token multiple
// times).
let refreshPromise = null;

const isAuthEndpoint = (url = '') =>
  url.includes('/auth/login') || url.includes('/auth/signup') || url.includes('/auth/intern/login') ||
  url.includes('/auth/refresh') || url.includes('/auth/logout');

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint(original.url)) {
      original._retried = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios.post(
            `${process.env.REACT_APP_API_URL}/auth/refresh`,
            {},
            { withCredentials: true }
          ).finally(() => { refreshPromise = null; });
        }
        await refreshPromise;
        return api(original);
      } catch {
        // Refresh itself failed (session truly expired/revoked) — fall
        // through to the normal error path below, which surfaces a message
        // and lets ProtectedRoute/InternRoute redirect to login on the next
        // auth check.
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0]?.msg ||
      'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export default api;
