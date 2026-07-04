const pool = require('../config/db');
const TaskModel = require('../models/taskModel');
const InternModel = require('../models/internModel');
const OrganizationModel = require('../models/organizationModel');
const slackService = require('../services/slackService');
const emailService = require('../services/emailService');
const { logAudit } = require('../services/auditService');

const getAll = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { status, intern_id, priority, page, limit } = req.query;
    const { rows, pagination } = await TaskModel.getAll(orgId, { status, intern_id, priority, page, limit });
    res.json({ success: true, data: rows, pagination });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const task = await TaskModel.getById(orgId, req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { intern_ids, intern_id, ...rest } = req.body;
    const ids = intern_ids?.length ? intern_ids : [intern_id];
    const org = await OrganizationModel.getById(orgId);

    const tasks = [];
    for (const id of ids) {
      const intern = await InternModel.getById(orgId, id);
      if (!intern) continue;
      const task = await TaskModel.create(orgId, { intern_id: id, ...rest });
      if (!task) continue;
      await emailService.sendTaskAssigned({
        intern_name: intern.name,
        intern_email: intern.email,
        task_title: task.title,
        task_description: task.description,
        task_priority: task.priority,
        task_due_date: task.due_date,
      }).catch(() => { });

      await slackService.notifyTaskAssigned(org, {
        intern_name: intern.name,
        task_title: task.title,
        task_description: task.description,
        priority: task.priority,
        due_date: task.due_date,
      }).catch(() => { });
      logAudit({
        organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'create',
        entityType: 'task', entityId: task.id,
        changedFields: { title: task.title, intern_id: task.intern_id, priority: task.priority, due_date: task.due_date },
      });
      tasks.push(task);
    }

    res.status(201).json({ success: true, data: tasks });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { version } = req.body;
    if (version == null) {
      return res.status(400).json({ success: false, message: 'Missing version — refresh and try again' });
    }
    const outcome = await TaskModel.updateStatus(orgId, req.params.id, { ...req.body, expectedVersion: version });
    if (!outcome) return res.status(404).json({ success: false, message: 'Task not found' });
    if (outcome.conflict) {
      return res.status(409).json({ success: false, message: 'This task was updated by someone else. Refresh and try again.' });
    }
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'task', entityId: outcome.id,
      changedFields: { status: outcome.status, due_date: outcome.due_date, priority: outcome.priority },
    });

    if (outcome.status === 'pending' && outcome.due_date && new Date(outcome.due_date) < new Date()) {
      const intern = await InternModel.getById(orgId, outcome.intern_id);
      if (intern) {
        await emailService.sendTaskOverdue({
          intern_name: intern.name,
          intern_email: intern.email,
          task_title: outcome.title,
          task_due_date: outcome.due_date,
        }).catch(() => { });
      }
    }
    res.json({ success: true, data: outcome });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { version } = req.body;
    if (version == null) {
      return res.status(400).json({ success: false, message: 'Missing version — refresh and try again' });
    }
    const outcome = await TaskModel.update(orgId, req.params.id, { ...req.body, expectedVersion: version });
    if (!outcome) return res.status(404).json({ success: false, message: 'Task not found' });
    if (outcome.conflict) {
      return res.status(409).json({ success: false, message: 'This task was updated by someone else. Refresh and try again.' });
    }
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'task', entityId: outcome.id,
      changedFields: { title: outcome.title, description: outcome.description, priority: outcome.priority, due_date: outcome.due_date },
    });
    res.json({ success: true, data: outcome });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const task = await TaskModel.delete(orgId, req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'delete',
      entityType: 'task', entityId: task.id,
    });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

const getComments = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const result = await pool.query(
      'SELECT * FROM task_comments WHERE task_id=$1 AND organization_id=$2 ORDER BY created_at ASC',
      [req.params.id, orgId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

const addComment = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ success: false, message: 'Comment is required' });

    const task = await TaskModel.getById(orgId, req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const result = await pool.query(
      'INSERT INTO task_comments (task_id, comment, organization_id) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, comment.trim(), orgId]
    );

    const intern = await InternModel.getById(orgId, task.intern_id);
    if (intern) {
      await emailService.sendTaskComment({
        intern_name: intern.name,
        intern_email: intern.email,
        task_title: task.title,
        comment: comment.trim(),
      }).catch(() => { });
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, updateStatus, update, remove, getComments, addComment };
