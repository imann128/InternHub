const LocationModel = require('../models/locationModel');

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
    res.status(201).json({ success: true, data: location });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const existing = await LocationModel.getById(orgId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Location not found' });
    const location = await LocationModel.update(orgId, req.params.id, req.body);
    res.json({ success: true, data: location });
  } catch (err) { next(err); }
};

// Soft-delete only — locations may already be referenced by past attendance
// rows (via the intern that was assigned to them at the time), and by
// interns.location_id. Deactivating instead of deleting keeps that history
// intact while removing the location from active use (dropdowns, check-in).
const deactivate = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const existing = await LocationModel.getById(orgId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Location not found' });
    const location = await LocationModel.setActive(orgId, req.params.id, false);
    res.json({ success: true, data: location });
  } catch (err) { next(err); }
};

const activate = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const existing = await LocationModel.getById(orgId, req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Location not found' });
    const location = await LocationModel.setActive(orgId, req.params.id, true);
    res.json({ success: true, data: location });
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
    res.json({ success: true, message: 'Interns updated for this location' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, deactivate, activate, assignInterns };