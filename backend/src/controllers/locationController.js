const LocationModel = require('../models/locationModel');
const { logAudit } = require('../services/auditService');

const getAll = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const locations = await LocationModel.getAll(orgId);
    res.json({ success: true, data: locations });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const location = await LocationModel.getById(orgId, req.params.id);
    if (!location) return res.status(404).json({ success: false, message: 'Location not found' });
    res.json({ success: true, data: location });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const location = await LocationModel.create(orgId, req.body);
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'create',
      entityType: 'location', entityId: location.id,
      changedFields: { name: location.name, latitude: location.latitude, longitude: location.longitude, radius_meters: location.radius_meters },
    });
    res.status(201).json({ success: true, data: location });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { version } = req.body;
    if (version == null) {
      return res.status(400).json({ success: false, message: 'Missing version — refresh and try again' });
    }
    const outcome = await LocationModel.update(orgId, req.params.id, { ...req.body, expectedVersion: version });
    if (!outcome) return res.status(404).json({ success: false, message: 'Location not found' });
    if (outcome.conflict) {
      return res.status(409).json({ success: false, message: 'This location was updated by someone else. Refresh and try again.' });
    }
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'location', entityId: outcome.id,
      changedFields: { name: outcome.name, latitude: outcome.latitude, longitude: outcome.longitude, radius_meters: outcome.radius_meters },
    });
    res.json({ success: true, data: outcome });
  } catch (err) { next(err); }
};

// Soft-delete only — locations may already be referenced by past attendance
// rows (via the intern that was assigned to them at the time), and by
// interns.location_id. Deactivating instead of deleting keeps that history
// intact while removing the location from active use (dropdowns, check-in).
const deactivate = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { version } = req.body;
    if (version == null) {
      return res.status(400).json({ success: false, message: 'Missing version — refresh and try again' });
    }
    const outcome = await LocationModel.setActive(orgId, req.params.id, false, version);
    if (!outcome) return res.status(404).json({ success: false, message: 'Location not found' });
    if (outcome.conflict) {
      return res.status(409).json({ success: false, message: 'This location was updated by someone else. Refresh and try again.' });
    }
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'location', entityId: outcome.id, changedFields: { is_active: false },
    });
    res.json({ success: true, data: outcome });
  } catch (err) { next(err); }
};

const activate = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { version } = req.body;
    if (version == null) {
      return res.status(400).json({ success: false, message: 'Missing version — refresh and try again' });
    }
    const outcome = await LocationModel.setActive(orgId, req.params.id, true, version);
    if (!outcome) return res.status(404).json({ success: false, message: 'Location not found' });
    if (outcome.conflict) {
      return res.status(409).json({ success: false, message: 'This location was updated by someone else. Refresh and try again.' });
    }
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'location', entityId: outcome.id, changedFields: { is_active: true },
    });
    res.json({ success: true, data: outcome });
  } catch (err) { next(err); }
};

const assignInterns = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const existing = await LocationModel.getById(orgId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Location not found' });

    const { intern_ids } = req.body;
    if (!Array.isArray(intern_ids) || !intern_ids.every((id) => Number.isInteger(Number(id)))) {
      return res.status(400).json({ success: false, message: 'intern_ids must be an array of intern IDs' });
    }

    const result = await LocationModel.assignInterns(orgId, req.params.id, intern_ids.map(Number));
    if (!result) return res.status(404).json({ success: false, message: 'Location not found' });
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'location', entityId: existing.id, changedFields: { assigned_intern_ids: intern_ids.map(Number) },
    });
    res.json({ success: true, message: 'Interns updated for this location' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, deactivate, activate, assignInterns };
