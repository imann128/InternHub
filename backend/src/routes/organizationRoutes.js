const router = require('express').Router();
const { adminOnly } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/organizationController');

// Everything here is org-settings management -- admin only, no intern access.
router.get('/settings', adminOnly, ctrl.getSettings);
router.post('/invite-code/regenerate', adminOnly, ctrl.regenerateInviteCode);
router.put('/groq-key', adminOnly, ctrl.updateGroqKey);

module.exports = router;
