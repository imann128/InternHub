const router = require('express').Router();
const authMiddleware = require('../middleware/authMiddleware');
const { internOnly } = require('../middleware/authMiddleware');
const pool = require('../config/db');
const InternModel = require('../models/internModel');
const AttendanceModel = require('../models/attendanceModel');
const LocationModel = require('../models/locationModel');
const OrganizationModel = require('../models/organizationModel');
const { isWithinLocation } = require('../utils/geo');
const { isFaceMatch } = require('../utils/faceMatch');
const slackService = require('../services/slackService');

// Shared by check-in and check-out: resolves the intern's assigned,
// active location, or a ready-to-send error if they don't have one.
const getInternLocationOrError = async (orgId, internId) => {
  const intern = await InternModel.getById(orgId, internId);
  if (!intern?.location_id) {
    return { error: { status: 400, message: 'No location assigned to your account. Contact your admin.' } };
  }
  const location = await LocationModel.getById(orgId, intern.location_id);
  if (!location || !location.is_active) {
    return { error: { status: 400, message: 'Your assigned location is no longer active. Contact your admin.' } };
  }
  return { location };
};

const { CONSENT_VERSION } = require('../config/consent');

// Record acceptance of the data/privacy consent notice — stamped
// server-side so there's an auditable record of who consented and when.
router.post('/consent', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const record = await InternModel.recordConsent(orgId, req.user.id, CONSENT_VERSION);
    if (!record) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
});

// Check face verification status
router.get('/face/status', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const data = await InternModel.getFaceDescriptor(orgId, req.user.id);
    res.json({ success: true, data: { face_verified: data?.face_verified || false } });
  } catch (err) { next(err); }
});

// First-time face setup
router.post('/face/setup', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { descriptor } = req.body;
    if (!descriptor || !Array.isArray(descriptor)) {
      return res.status(400).json({ success: false, message: 'Valid face descriptor required' });
    }
    const result = await InternModel.saveFaceDescriptor(orgId, req.user.id, descriptor);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Self check-in
router.post('/attendance/check-in', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { descriptor, latitude, longitude } = req.body;
    if (!descriptor || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'Face descriptor and location required' });
    }

    const stored = await InternModel.getFaceDescriptor(orgId, req.user.id);
    if (!stored?.face_verified) {
      return res.status(400).json({ success: false, message: 'Please complete face verification first' });
    }

    const storedDescriptor = JSON.parse(stored.face_descriptor);
    const { match, distance } = isFaceMatch(storedDescriptor, descriptor);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Face does not match. Try again.' });
    }

    const { location, error } = await getInternLocationOrError(orgId, req.user.id);
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

    const record = await AttendanceModel.checkInSelf(orgId, {
      intern_id: req.user.id,
      date,
      check_in: time,
      latitude,
      longitude,
    });

    res.json({ success: true, data: record });
    const [internData, org] = await Promise.all([
      InternModel.getById(orgId, req.user.id),
      OrganizationModel.getById(orgId),
    ]);
    await slackService.notifyCheckIn(org, {
      intern_name: internData.name,
      time: time,
      type: 'in',
    }).catch(() => { });
  } catch (err) { next(err); }
});

// Self check-out
router.post('/attendance/check-out', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { descriptor, latitude, longitude } = req.body;
    if (!descriptor || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'Face descriptor and location required' });
    }

    const stored = await InternModel.getFaceDescriptor(orgId, req.user.id);
    if (!stored?.face_verified) {
      return res.status(400).json({ success: false, message: 'Please complete face verification first' });
    }

    const storedDescriptor = JSON.parse(stored.face_descriptor);
    const { match } = isFaceMatch(storedDescriptor, descriptor);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Face does not match. Try again.' });
    }

    const { location, error } = await getInternLocationOrError(orgId, req.user.id);
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

    const record = await AttendanceModel.checkOutSelf(orgId, {
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
    const [internData, org] = await Promise.all([
      InternModel.getById(orgId, req.user.id),
      OrganizationModel.getById(orgId),
    ]);
    await slackService.notifyCheckIn(org, {
      intern_name: internData.name,
      time: time,
      type: 'out',
    }).catch(() => { });
  } catch (err) { next(err); }
});

// Get own profile + tasks + attendance
router.get('/me', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const id = req.user.id;
    const intern = await pool.query(
      `SELECT i.id, i.name, i.email, i.department, i.joining_date, i.status, i.version,
              i.email_notifications, i.chat_sound,
              i.location_id, l.name AS location_name, l.is_active AS location_active,
              l.latitude AS location_latitude, l.longitude AS location_longitude,
              l.radius_meters AS location_radius_meters
       FROM interns i
       LEFT JOIN locations l ON l.id = i.location_id
       WHERE i.id=$1 AND i.organization_id=$2`,
      [id, orgId]
    );
    const tasks = await pool.query(`
  SELECT t.*, 
    COALESCE(
      json_agg(tc ORDER BY tc.created_at ASC) FILTER (WHERE tc.id IS NOT NULL), 
      '[]'
    ) as comments
  FROM tasks t
  LEFT JOIN task_comments tc ON tc.task_id = t.id
  WHERE t.intern_id=$1 AND t.organization_id=$2
  GROUP BY t.id
  ORDER BY t.created_at DESC
`, [id, orgId]);
    const attendance = await pool.query(
      'SELECT * FROM attendance WHERE intern_id=$1 AND organization_id=$2 ORDER BY date DESC LIMIT 30',
      [id, orgId]
    );
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_days,
        COUNT(CASE WHEN attendance.status='present' THEN 1 END) as present_days,
        COALESCE(SUM(total_hours),0) as total_hours
      FROM attendance WHERE intern_id=$1 AND organization_id=$2`, [id, orgId]);

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
    const orgId = req.user.organization_id;
    const result = await pool.query(
      `UPDATE tasks SET status='completed' WHERE id=$1 AND intern_id=$2 AND organization_id=$3 RETURNING *`,
      [req.params.id, req.user.id, orgId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
});

// --- Settings ---

// Update own profile (name/email/department). Location and status stay
// admin-controlled — not editable from here.
router.patch('/profile', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { name, email, department, version } = req.body;
    if (!name?.trim() || !email?.trim() || !department?.trim()) {
      return res.status(400).json({ success: false, message: 'Name, email, and department are required' });
    }
    if (version == null) {
      return res.status(400).json({ success: false, message: 'Missing version for update' });
    }

    const emailTaken = await InternModel.emailExists(email, req.user.id);
    if (emailTaken) {
      return res.status(400).json({ success: false, message: 'That email is already in use' });
    }

    const result = await InternModel.updateSelf(orgId, req.user.id, {
      name, email, department, expectedVersion: version,
    });
    if (!result) return res.status(404).json({ success: false, message: 'Profile not found' });
    if (result.conflict) {
      return res.status(409).json({ success: false, message: 'This profile was updated elsewhere. Please refresh and try again.' });
    }
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// Change own password
router.patch('/password', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const intern = await InternModel.getById(orgId, req.user.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });

    const valid = await InternModel.verifyPassword(current_password, intern.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    await InternModel.changePassword(orgId, req.user.id, new_password);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
});

// Update notification / sound preferences
router.patch('/preferences', authMiddleware, internOnly, async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { email_notifications, chat_sound } = req.body;
    const result = await InternModel.updatePreferences(orgId, req.user.id, { email_notifications, chat_sound });
    if (!result) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

module.exports = router;