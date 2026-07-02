const router = require('express').Router();
const authMiddleware = require('../middleware/authMiddleware');
const { internOnly } = require('../middleware/authMiddleware');
const pool = require('../config/db');
const InternModel = require('../models/internModel');
const AttendanceModel = require('../models/attendanceModel');
const LocationModel = require('../models/locationModel');
const { isWithinLocation } = require('../utils/geo');
const { isFaceMatch } = require('../utils/faceMatch');
const slackService = require('../services/slackService');

// Shared by check-in and check-out: resolves the intern's assigned,
// active location, or a ready-to-send error if they don't have one.
const getInternLocationOrError = async (internId) => {
  const intern = await InternModel.getById(internId);
  if (!intern?.location_id) {
    return { error: { status: 400, message: 'No location assigned to your account. Contact your admin.' } };
  }
  const location = await LocationModel.getById(intern.location_id);
  if (!location || !location.is_active) {
    return { error: { status: 400, message: 'Your assigned location is no longer active. Contact your admin.' } };
  }
  return { location };
};

// Check face verification status
router.get('/face/status', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const data = await InternModel.getFaceDescriptor(req.user.id);
    res.json({ success: true, data: { face_verified: data?.face_verified || false } });
  } catch (err) { next(err); }
});

// First-time face setup
router.post('/face/setup', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const { descriptor } = req.body;
    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({ success: false, message: 'Valid face descriptor required' });
    }
    const result = await InternModel.saveFaceDescriptor(req.user.id, descriptor);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Self check-in
router.post('/attendance/check-in', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const { descriptor, latitude, longitude } = req.body;
    if (!descriptor || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'Face descriptor and location required' });
    }

    const stored = await InternModel.getFaceDescriptor(req.user.id);
    if (!stored?.face_verified) {
      return res.status(400).json({ success: false, message: 'Please complete face verification first' });
    }

    const storedDescriptor = JSON.parse(stored.face_descriptor);
    const { match, distance } = isFaceMatch(storedDescriptor, descriptor);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Face does not match. Try again.' });
    }

    const { location, error } = await getInternLocationOrError(req.user.id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const locationCheck = isWithinLocation(latitude, longitude, location);
    if (!locationCheck.valid) {
      return res.status(403).json({
        success: false,
        message: `You must be at ${location.name} to check in. You are ${locationCheck.distance}m away.`,
      });
    }



    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8);

    const record = await AttendanceModel.checkInSelf({
      intern_id: req.user.id,
      date,
      check_in: time,
      latitude,
      longitude,
    });

    res.json({ success: true, data: record });
    const internData = await InternModel.getById(req.user.id);
    await slackService.notifyCheckIn({
      intern_name: internData.name,
      time: time,
      type: 'in',
    }).catch(() => { });
  } catch (err) { next(err); }
});

// Self check-out
router.post('/attendance/check-out', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const { descriptor, latitude, longitude } = req.body;
    if (!descriptor || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'Face descriptor and location required' });
    }

    const stored = await InternModel.getFaceDescriptor(req.user.id);
    if (!stored?.face_verified) {
      return res.status(400).json({ success: false, message: 'Please complete face verification first' });
    }

    const storedDescriptor = JSON.parse(stored.face_descriptor);
    const { match } = isFaceMatch(storedDescriptor, descriptor);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Face does not match. Try again.' });
    }

    const { location, error } = await getInternLocationOrError(req.user.id);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    const locationCheck = isWithinLocation(latitude, longitude, location);
    if (!locationCheck.valid) {
      return res.status(403).json({
        success: false,
        message: `You must be at ${location.name} to check out. You are ${locationCheck.distance}m away.`,
      });
    }

    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8);

    const record = await AttendanceModel.checkOutSelf({
      intern_id: req.user.id,
      date,
      check_out: time,
      latitude,
      longitude,
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Check in first before checking out' });
    }

    res.json({ success: true, data: record });
    const internData = await InternModel.getById(req.user.id);
    await slackService.notifyCheckIn({
      intern_name: internData.name,
      time: time,
      type: 'out',
    }).catch(() => { });
  } catch (err) { next(err); }
});


// Get own profile + tasks + attendance
router.get('/me', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const id = req.user.id;
    const intern = await pool.query(
      `SELECT i.id, i.name, i.email, i.department, i.joining_date, i.status,
              i.location_id, l.name AS location_name, l.is_active AS location_active
       FROM interns i
       LEFT JOIN locations l ON l.id = i.location_id
       WHERE i.id=$1`,
      [id]
    );
    const tasks = await pool.query(`
  SELECT t.*, 
    COALESCE(
      json_agg(tc ORDER BY tc.created_at ASC) FILTER (WHERE tc.id IS NOT NULL), 
      '[]'
    ) as comments
  FROM tasks t
  LEFT JOIN task_comments tc ON tc.task_id = t.id
  WHERE t.intern_id=$1
  GROUP BY t.id
  ORDER BY t.created_at DESC
`, [id]);
    const attendance = await pool.query('SELECT * FROM attendance WHERE intern_id=$1 ORDER BY date DESC LIMIT 30', [id]);
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_days,
        COUNT(CASE WHEN attendance.status='present' THEN 1 END) as present_days,
        COALESCE(SUM(total_hours),0) as total_hours
      FROM attendance WHERE intern_id=$1`, [id]);

    res.json({
      success: true, data: {
        intern: intern.rows[0],
        tasks: tasks.rows,
        attendance: attendance.rows,
        stats: stats.rows[0],
      }
    });
  } catch (err) { next(err); }
});

// Mark task complete
router.patch('/tasks/:id/complete', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE tasks SET status='completed' WHERE id=$1 AND intern_id=$2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
