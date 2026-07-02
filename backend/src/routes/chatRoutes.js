const router = require('express').Router();
const ctrl = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const { internOnly } = require('../middleware/authMiddleware');
const upload = require('../middleware/upload');

// Admin routes
router.get('/conversations', ctrl.getAllConversations);
router.get('/announcements', ctrl.getAnnouncements);
router.get('/:intern_id/messages', ctrl.getMessages);
router.post('/send', upload.single('file'), ctrl.sendMessage);
router.delete('/:id', ctrl.deleteMessage);

// Intern routes
router.get('/my-messages', authMiddleware, internOnly, ctrl.getMyMessages);
router.post('/my-messages', authMiddleware, internOnly, upload.single('file'), ctrl.sendMyMessage);

module.exports = router;