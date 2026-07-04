const router = require('express').Router();
const ctrl = require('../controllers/attendanceController');
const { getAll, getWeeklySummary, checkIn, checkOut, mark, exportCSV } = require('../controllers/attendanceController');
const attendanceValidator = require('../validators/attendanceValidator');
const validate = require('../utils/validate');

router.get('/export', exportCSV);
router.get('/', ctrl.getAll);
router.get('/weekly-summary', ctrl.getWeeklySummary);
router.post('/check-in', ctrl.checkIn);
router.post('/check-out', ctrl.checkOut);
// attendanceValidator existed but was never actually wired in here — the
// manual "mark attendance" endpoint had zero input validation (a bad
// intern_id or status would either 500 out of the DB layer or silently
// insert garbage, instead of a clean 400).
router.post('/', attendanceValidator, validate, ctrl.mark);

module.exports = router;