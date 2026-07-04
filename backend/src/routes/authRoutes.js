const router = require('express').Router();
const ctrl = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/signup', ctrl.signup);
router.post('/login', ctrl.login);
router.get('/me', authMiddleware, ctrl.me);
router.post('/intern/login', ctrl.internLogin);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);

module.exports = router;
