const jwt = require('jsonwebtoken');
const { isJtiBlacklisted } = require('../services/sessionService');

// Access token now arrives as an HttpOnly cookie, not an Authorization
// header — the frontend never has the raw token in JS-readable storage.
// There is no header fallback — cookie is the only accepted source.
const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Belt-and-suspenders: any token without organization_id is stale/invalid
    // for this rollout. Better to force re-login than let a scoped query run
    // with organization_id = undefined (which would just error, but let's be
    // explicit rather than rely on that).
    if (!decoded.organization_id) {
      return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
    }

    if (decoded.jti && (await isJtiBlacklisted(decoded.jti))) {
      return res.status(401).json({ success: false, message: 'Session has been logged out' });
    }

    req.user = decoded;
    req.admin = decoded; // keep backward compat
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access only' });
  }
  next();
};

const internOnly = (req, res, next) => {
  if (req.user?.role !== 'intern') {
    return res.status(403).json({ success: false, message: 'Intern access only' });
  }
  next();
};

module.exports = authMiddleware;
module.exports.adminOnly = adminOnly;
module.exports.internOnly = internOnly;
