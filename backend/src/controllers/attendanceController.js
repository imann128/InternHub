const AttendanceModel = require('../models/attendanceModel');

const getAll = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { intern_id, date } = req.query;
    const records = await AttendanceModel.getAll(orgId, { intern_id, date });
    res.json({ success: true, data: records });
  } catch (err) { next(err); }
};

const getWeeklySummary = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { intern_id, week_start, week_end } = req.query;
    if (!week_start || !week_end) {
      return res.status(400).json({ success: false, message: 'week_start and week_end required' });
    }
    const data = await AttendanceModel.getWeeklySummary(orgId, { intern_id, week_start, week_end });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const checkIn = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { intern_id, date, check_in } = req.body;
    if (!intern_id || !date || !check_in) {
      return res.status(400).json({ success: false, message: 'intern_id, date, check_in required' });
    }
    const record = await AttendanceModel.checkIn(orgId, { intern_id, date, check_in });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
};

const checkOut = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { intern_id, date, check_out } = req.body;
    if (!intern_id || !date || !check_out) {
      return res.status(400).json({ success: false, message: 'intern_id, date, check_out required' });
    }
    const record = await AttendanceModel.checkOut(orgId, { intern_id, date, check_out });
    if (!record) return res.status(400).json({ success: false, message: 'Check-in first before checking out' });
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
};

const mark = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const record = await AttendanceModel.mark(orgId, req.body);
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
};

const exportCSV = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { date, intern_id } = req.query;
    const records = await AttendanceModel.getAll(orgId, { date, intern_id });

    const header = 'Intern,Date,Status,Check In,Check Out,Total Hours';
    const rows = records.map(r =>
      `${r.intern_name},${r.date},${r.status},${r.check_in || ''},${r.check_out || ''},${r.total_hours || ''}`
    );
    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
    res.send(csv);
  } catch (err) { next(err); }
};

module.exports = { getAll, getWeeklySummary, checkIn, checkOut, mark, exportCSV };