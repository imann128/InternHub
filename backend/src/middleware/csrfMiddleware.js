// Double-submit CSRF check. Only matters now that auth lives in cookies the
// browser attaches automatically to same-site requests — a malicious page
// can make the browser send those cookies, but it can't read the csrf_token
// cookie (cross-origin) to also set the matching header, so a mismatch (or
// missing header) means the request didn't originate from a page that could
// read this site's cookies.
//
// Safe methods (GET/HEAD/OPTIONS) are exempt — they shouldn't mutate state
// in the first place, and are what CSRF-safe navigations use anyway.
const CSRF_EXEMPT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfProtection = (req, res, next) => {
  if (CSRF_EXEMPT_METHODS.has(req.method)) return next();

  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: 'CSRF token missing or invalid' });
  }
  next();
};

module.exports = csrfProtection;
