// Single source of truth for "what's the current consent policy version".
// Shared between internPortalRoutes.js (records acceptance) and
// authController.js (tells the frontend whether the logged-in intern's
// stored consent_version still matches, so a policy update re-prompts
// everyone automatically instead of silently grandfathering old consent
// into covering new data uses).
//
// Bump this whenever the privacy policy materially changes.
const CONSENT_VERSION = '2026-07-1';

module.exports = { CONSENT_VERSION };
