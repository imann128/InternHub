const pool = require('../config/db');
const TaskModel = require('../models/taskModel');
const InternModel = require('../models/internModel');
const slackService = require('../services/slackService');

const getAll = async (req, res, next) => {
  try {
    const { status, intern_id, priority } = req.query;
    const tasks = await TaskModel.getAll({ status, intern_id, priority });
    res.json({ success: true, data: tasks });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const task = await TaskModel.getById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

const emailService = require('../services/emailService');

const create = async (req, res, next) => {
  try {
    const { intern_ids, intern_id, ...rest } = req.body;
    const ids = intern_ids?.length ? intern_ids : [intern_id];

    const tasks = [];
    for (const id of ids) {
      const intern = await InternModel.getById(id);
      if (!intern) continue;
      const task = await TaskModel.create({ intern_id: id, ...rest });
      await emailService.sendTaskAssigned({
        intern_name: intern.name,
        intern_email: intern.email,
        task_title: task.title,
        task_description: task.description,
        task_priority: task.priority,
        task_due_date: task.due_date,
      }).catch(() => { });
      
      await slackService.notifyTaskAssigned({
        intern_name: intern.name,
        task_title: task.title,
        task_description: task.description,
        priority: task.priority,
        due_date: task.due_date,
      }).catch(() => { });
      tasks.push(task);
    }

    res.status(201).json({ success: true, data: tasks });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const task = await TaskModel.updateStatus(req.params.id, req.body);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    // send overdue email if still pending and past due
    if (task.status === 'pending' && task.due_date && new Date(task.due_date) < new Date()) {
      const intern = await InternModel.getById(task.intern_id);
      if (intern) {
        await emailService.sendTaskOverdue({
          intern_name: intern.name,
          intern_email: intern.email,
          task_title: task.title,
          task_due_date: task.due_date,
        }).catch(() => { });
      }
    }
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const task = await TaskModel.update(req.params.id, req.body);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const task = await TaskModel.delete(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) { next(err); }
};

const getComments = async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM task_comments WHERE task_id=$1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

const addComment = async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment?.trim()) return res.status(400).json({ success: false, message: 'Comment is required' });

    const task = await TaskModel.getById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const result = await pool.query(
      'INSERT INTO task_comments (task_id, comment) VALUES ($1, $2) RETURNING *',
      [req.params.id, comment.trim()]
    );

    const intern = await InternModel.getById(task.intern_id);
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