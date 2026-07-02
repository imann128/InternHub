const path = require('path');
const fs = require('fs');
const SubmissionModel = require('../models/submissionModel');
const TaskModel = require('../models/taskModel');
const InternModel = require('../models/internModel');
const slackService = require('../services/slackService');
const { UPLOAD_DIR } = require('../middleware/fileUpload');

const getAll = async (req, res, next) => {
    try {
        const { task_id, status } = req.query;
        // Interns only ever see their own submissions, regardless of what's in the query.
        const intern_id = req.user.role === 'intern' ? req.user.id : req.query.intern_id;
        const rows = await SubmissionModel.getAll({ task_id, intern_id, status });
        res.json({ success: true, data: rows });
    } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
    try {
        const submission = await SubmissionModel.getById(req.params.id);
        if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
        if (req.user.role === 'intern' && submission.intern_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        res.json({ success: true, data: submission });
    } catch (err) { next(err); }
};

const create = async (req, res, next) => {
    try {
        const { task_id, notes } = req.body;
        const intern_id = req.user.id;

        const submission = await SubmissionModel.create({ task_id, intern_id, notes });
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Task not found or not assigned to you' });
        }
        if (req.files?.length) {
            await SubmissionModel.addFiles(submission.id, req.files);
        }

        // Fire-and-forget: ping the supervisor channel. Never let a Slack outage
        // block the intern's submission from succeeding.
        const [task, intern] = await Promise.all([
            TaskModel.getById(task_id),
            InternModel.getById(intern_id),
        ]);
        slackService.sendSubmissionCreated({
            id: submission.id,
            task_title: task?.title,
            intern_name: intern?.name,
            notes: submission.notes,
        }).catch(() => { });

        res.status(201).json({ success: true, data: submission });
    } catch (err) { next(err); }
};

const review = async (req, res, next) => {
    try {
        const { status, score, feedback } = req.body;
        const existing = await SubmissionModel.getById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Submission not found' });

        const updated = await SubmissionModel.review(req.params.id, { status, score, feedback });
        if (!updated) return res.status(400).json({ success: false, message: 'Invalid review status' });

        // DM the intern directly — sendSubmissionReviewed no-ops quietly if they
        // haven't connected Slack yet (getSlackUserId returns null in that case).
        InternModel.getById(existing.intern_id)
            .then((intern) => slackService.sendSubmissionReviewed({
                intern_name: intern?.name,
                task_title: existing.task_title,
                status: updated.status,
                score: updated.score,
                feedback: updated.feedback,
            }))
            .catch(() => { });

        res.json({ success: true, data: updated });
    } catch (err) { next(err); }
};

const downloadFile = async (req, res, next) => {
    try {
        const submission = await SubmissionModel.getById(req.params.id);
        if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });
        if (req.user.role === 'intern' && submission.intern_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        const file = (submission.files || []).find(f => String(f.id) === String(req.params.fileId));
        if (!file) return res.status(404).json({ success: false, message: 'File not found' });

        // storage_key is server-generated, but resolve+confirm the path stays
        // inside UPLOAD_DIR to defend against any traversal.
        const safeName = path.basename(String(file.storage_key || ''));
        const abs = path.resolve(UPLOAD_DIR, safeName);
        if (!abs.startsWith(path.resolve(UPLOAD_DIR) + path.sep) || !fs.existsSync(abs)) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const downloadName = String(file.file_name || safeName).replace(/[\r\n"]/g, '');
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        fs.createReadStream(abs).pipe(res);
    } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, review, downloadFile };
