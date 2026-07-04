const pool = require('../config/db');
const { generateRefreshToken, hashRefreshToken } = require('../utils/tokens');

// Creates a brand-new session row (i.e. a brand-new refresh token) for a
// freshly authenticated actor. Used on login/signup — never on refresh,
// which uses rotateSession instead so the old row is provably retired.
const createSession = async ({ actorId, actorRole, userAgent, ip }) => {
  const { raw, hash, expiresAt } = generateRefreshToken();
  await pool.query(
    `INSERT INTO sessions (actor_id, actor_role, refresh_token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId, actorRole, hash, userAgent || null, ip || null, expiresAt]
  );
  return raw;
};

// Looks up a session regardless of revoked/expired status — used by the
// refresh endpoint to distinguish "never existed" from "already used"
// (the latter is a reuse/compromise signal, not just a normal expiry).
const findSessionByRawToken = async (rawToken) => {
  const hash = hashRefreshToken(rawToken);
  const result = await pool.query('SELECT * FROM sessions WHERE refresh_token_hash = $1', [hash]);
  return result.rows[0];
};

// Single-use rotation: the session behind rawToken is marked revoked, and a
// brand-new session row (and raw token) is created and returned. If the same
// raw token is presented again after this point, the lookup above will find
// it revoked — which is the signal an old refresh token got reused (e.g. a
// stolen cookie replayed after the legitimate client already rotated past
// it). Callers that see a revoked-but-existing session should treat that as
// a compromise signal, not just a normal expiry.
const rotateSession = async (session) => {
  await pool.query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1', [session.id]);
  return createSession({ actorId: session.actor_id, actorRole: session.actor_role, userAgent: session.user_agent, ip: session.ip });
};

const revokeSessionByRawToken = async (rawToken) => {
  const hash = hashRefreshToken(rawToken);
  await pool.query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE refresh_token_hash = $1', [hash]);
};

// Used on password-invalidation-worthy events in the future (e.g. "log out
// everywhere"). Also called by the refresh endpoint itself when it detects
// a revoked-token replay (see rotateSession's comment above).
const revokeAllSessionsForActor = async (actorId, actorRole) => {
  await pool.query(
    'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE actor_id = $1 AND actor_role = $2 AND revoked_at IS NULL',
    [actorId, actorRole]
  );
};

const blacklistJti = async (jti, expiresAt) => {
  await pool.query(
    'INSERT INTO token_blacklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT (jti) DO NOTHING',
    [jti, expiresAt]
  );
};

const isJtiBlacklisted = async (jti) => {
  const result = await pool.query(
    'SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > CURRENT_TIMESTAMP',
    [jti]
  );
  return result.rows.length > 0;
};

module.exports = {
  createSession,
  findSessionByRawToken,
  rotateSession,
  revokeSessionByRawToken,
  revokeAllSessionsForActor,
  blacklistJti,
  isJtiBlacklisted,
};
