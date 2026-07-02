const router = require('express').Router();
const ctrl = require('../controllers/submissionController');
const { internOnly, adminOnly } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/fileUpload');
const { submissionValidator, reviewValidator } = require('../validators/submissionValidator');
const validate = require('../utils/validate');

// authMiddleware is applied where this router is mounted (server.js), same
// pattern as taskRoutes/attendanceRoutes — so req.user is already set here.

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.get('/:id/files/:fileId/download', ctrl.downloadFile);

router.post('/', internOnly, upload.array('files', 5), submissionValidator, validate, ctrl.create);
router.post('/:id/review', adminOnly, reviewValidator, validate, ctrl.review);

module.exports = router;
