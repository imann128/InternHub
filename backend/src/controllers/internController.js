const InternModel = require('../models/internModel');
const OrganizationModel = require('../models/organizationModel');
const slackService = require('../services/slackService');
const emailService = require('../services/emailService');

const getAll = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { search, department, status } = req.query;
    const interns = await InternModel.getAll(orgId, { search, department, status });
    res.json({ success: true, data: interns });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const intern = await InternModel.getById(orgId, req.params.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: intern });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { email } = req.body;
    const exists = await InternModel.emailExists(email);
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });
    const intern = await InternModel.create(orgId, req.body);
    await emailService.sendWelcomeIntern({
      name: intern.name,
      email: intern.email,
      department: intern.department,
      tempPassword: intern.tempPassword,
    }).catch(() => {});
    const org = await OrganizationModel.getById(orgId);
    await slackService.notifyInternAdded(org, intern).catch(() => {});
    res.status(201).json({ success: true, data: intern });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { email } = req.body;
    const exists = await InternModel.emailExists(email, req.params.id);
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });
    const intern = await InternModel.update(orgId, req.params.id, req.body);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: intern });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const intern = await InternModel.getById(orgId, req.params.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    await InternModel.delete(orgId, req.params.id);
    res.json({ success: true, message: 'Intern deleted' });
  } catch (err) { next(err); }
};

const getProfile = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const data = await InternModel.getProfile(orgId, req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const toggleStatus = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const intern = await InternModel.toggleStatus(orgId, req.params.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    res.json({ success: true, data: intern });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, getProfile, toggleStatus };