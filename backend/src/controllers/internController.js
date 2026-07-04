const InternModel = require('../models/internModel');
const OrganizationModel = require('../models/organizationModel');
const slackService = require('../services/slackService');
const emailService = require('../services/emailService');
const { logAudit } = require('../services/auditService');

const getAll = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { search, department, status, page, limit } = req.query;
    const { rows, pagination } = await InternModel.getAll(orgId, { search, department, status, page, limit });
    res.json({ success: true, data: rows, pagination });
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
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'create',
      entityType: 'intern', entityId: intern.id,
      changedFields: { name: intern.name, email: intern.email, department: intern.department },
    });
    res.status(201).json({ success: true, data: intern });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { email, version } = req.body;
    if (version == null) {
      return res.status(400).json({ success: false, message: 'Missing version — refresh and try again' });
    }
    const exists = await InternModel.emailExists(email, req.params.id);
    if (exists) return res.status(400).json({ success: false, message: 'Email already exists' });

    const outcome = await InternModel.update(orgId, req.params.id, { ...req.body, expectedVersion: version });
    if (!outcome) return res.status(404).json({ success: false, message: 'Intern not found' });
    if (outcome.conflict) {
      return res.status(409).json({ success: false, message: 'This intern was updated by someone else. Refresh and try again.' });
    }
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'intern', entityId: outcome.id,
      changedFields: { name: outcome.name, email: outcome.email, department: outcome.department, status: outcome.status, location_id: outcome.location_id },
    });
    res.json({ success: true, data: outcome });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const intern = await InternModel.getById(orgId, req.params.id);
    if (!intern) return res.status(404).json({ success: false, message: 'Intern not found' });
    await InternModel.delete(orgId, req.params.id);
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'delete',
      entityType: 'intern', entityId: intern.id,
    });
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
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'intern', entityId: intern.id, changedFields: { status: intern.status },
    });
    res.json({ success: true, data: intern });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, getProfile, toggleStatus };
