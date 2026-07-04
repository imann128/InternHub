const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 10) || 30;

// Short-lived access token. Carries a `jti` so a single still-live token can
// be individually blacklisted on logout, without needing to revoke every
// token a user has ever been issued. Also carries organization_id — every
// org-scoped query in this app reads it straight off req.user, so it has to
// travel with the token, not just id/role.
const signAccessToken = ({ id, role, organizationId }) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ id, role, organization_id: organizationId, jti }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
  return { token, jti };
};

// Refresh tokens are opaque random values, not JWTs — the client only ever
// holds the raw value (in an HttpOnly cookie); the DB only ever stores its
// SHA-256 hash. A leaked DB row is therefore useless on its own, and a
// leaked cookie can be revoked server-side by deleting/marking the matching
// session row without needing to rotate any shared secret.
const generateRefreshToken = () => {
  const raw = crypto.randomBytes(40).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash, expiresAt };
};

const hashRefreshToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

// CSRF double-submit token — readable by JS (not HttpOnly) so the frontend
// can echo it back in a request header. Only meaningful because auth now
// lives in cookies the browser attaches automatically; an attacker's page
// can trigger the cookie to be sent but can't read this value to also set
// the header, since it can't read cookies across origins.
const generateCsrfToken = () => crypto.randomBytes(24).toString('hex');

const isProd = process.env.NODE_ENV === 'production';

const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  path: '/',
};

const accessTokenCookieOptions = () => ({
  ...baseCookieOptions,
  maxAge: 15 * 60 * 1000, // keep in sync with ACCESS_TOKEN_EXPIRES_IN's typical value
});

// Scoped to /api/auth — the refresh token only ever needs to be sent to the
// refresh/logout endpoints, not on every API call, so it isn't attached
// (and isn't a bigger target) on unrelated requests.
const refreshTokenCookieOptions = () => ({
  ...baseCookieOptions,
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
});

const csrfCookieOptions = () => ({
  httpOnly: false,
  secure: isProd,
  sameSite: 'strict',
  path: '/',
  maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
});

module.exports = {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateCsrfToken,
  accessTokenCookieOptions,
  refreshTokenCookieOptions,
  csrfCookieOptions,
};
