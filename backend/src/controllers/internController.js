const InternModel = require('../models/internModel');
const slackService = require('../services/slackService');

const getAll = async (req, res, next) => {
  try {
    const { search, department, status } = req.query;
    const interns = await InternModel.getAll({ search, department, status });
    res.json({ success: true, data: interns });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const intern = await InternModel.getById(req.params.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: intern });
  } catch (err) { next(err); }
};

const emailService = require('../services/emailService');

const create = async (req, res, next) => {
  try {
    const { email } = req.body;
    const exists = await InternModel.emailExists(email);
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });
    const intern = await InternModel.create(req.body);
    await emailService.sendWelcomeIntern({
      name: intern.name,
      email: intern.email,
      department: intern.department,
      tempPassword: intern.tempPassword,
    }).catch(() => {});
    await slackService.notifyInternAdded(intern).catch(() => {});
    res.status(201).json({ success: true, data: intern });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { email } = req.body;
    const exists = await InternModel.emailExists(email, req.params.id);
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });
    const intern = await InternModel.update(req.params.id, req.body);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: intern });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const intern = await InternModel.getById(req.params.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    await InternModel.delete(req.params.id);
    res.json({ success: true, message: 'Intern deleted' });
  } catch (err) { next(err); }
};

const getProfile = async (req, res, next) => {
  try {
    const data = await InternModel.getProfile(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const toggleStatus = async (req, res, next) => {
  try {
    const intern = await InternModel.toggleStatus(req.params.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: intern });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, getProfile, toggleStatus };