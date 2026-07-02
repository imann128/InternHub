const router = require('express').Router();
const ctrl = require('../controllers/locationController');
const locationValidator = require('../validators/locationValidator');
const validate = require('../utils/validate');
const { adminOnly } = require('../middleware/authMiddleware');

// Mounted with authMiddleware in server.js — adminOnly on every route since
// locations are an admin-managed setting, not something interns browse.
router.get('/', adminOnly, ctrl.getAll);
router.get('/:id', adminOnly, ctrl.getOne);
router.post('/', adminOnly, locationValidator, validate, ctrl.create);
router.put('/:id', adminOnly, locationValidator, validate, ctrl.update);
router.patch('/:id/deactivate', adminOnly, ctrl.deactivate);
router.patch('/:id/activate', adminOnly, ctrl.activate);
router.put('/:id/interns', adminOnly, ctrl.assignInterns);

module.exports = router;
