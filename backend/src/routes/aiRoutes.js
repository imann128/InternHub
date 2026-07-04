const router = require('express').Router();
const { adminOnly } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/aiController');

// Any logged-in user (admin or intern) can talk to the portal assistant --
// aiController picks the right system prompt based on req.user.role.
router.post('/chat', ctrl.chat);

// Lets the frontend hide the AI chat bubble / Enhance button entirely when
// neither an org key nor the server's global key is configured.
router.get('/status', ctrl.getStatus);

// Task description enhancement is only ever surfaced on the (admin-only)
// task creation form.
router.post('/enhance-task', adminOnly, ctrl.enhanceTaskDescription);

module.exports = router;
