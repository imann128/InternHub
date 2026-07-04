const path = require('path');
const fs = require('fs');
const SubmissionModel = require('../models/submissionModel');
const TaskModel = require('../models/taskModel');
const InternModel = require('../models/internModel');
const OrganizationModel = require('../models/organizationModel');
const slackService = require('../services/slackService');
const { UPLOAD_DIR } = require('../middleware/fileUpload');
const { logAudit } = require('../services/auditService');
const { encryptAndWrite, readAndDecrypt } = require('../utils/fileCrypto');

const getAll = async (req, res, next) => {
    try {
        const { task_id, status, page, limit } = req.query;
        const orgId = req.user.organization_id;
        const intern_id = req.user.role === 'intern' ? req.user.id : req.query.intern_id;
        const { rows, pagination } = await SubmissionModel.getAll(orgId, { task_id, intern_id, status, page, limit });
        res.json({ success: true, data: rows, pagination });
    } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
    try {
        const orgId = req.user.organization_id;
        const submission = await SubmissionModel.getById(orgId, req.params.id);
        // Cross-intern access is reported as 404, not 403 — a 403 confirms the
        // submission exists but belongs to someone else, which leaks that a
        // given submission ID is in use. 404 gives no signal either way.
        if (!submission || (req.user.role === 'intern' && submission.intern_id !== req.user.id)) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }
        res.json({ success: true, data: submission });
    } catch (err) { next(err); }
};

const create = async (req, res, next) => {
    try {
        const orgId = req.user.organization_id;
        const { task_id, notes } = req.body;
        const intern_id = req.user.id;

        const submission = await SubmissionModel.create(orgId, { task_id, intern_id, notes });
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Task not found or not assigned to you' });
        }
        if (req.files?.length) {
            // Files arrive in memory (see middleware/fileUpload.js) so they can
            // be encrypted before ever touching disk. Each file object is
            // mutated with a `.filename` (the encrypted file's on-disk name),
            // matching the shape multer's old diskStorage used to produce, so
            // SubmissionModel.addFiles below doesn't need to change at all.
            const destDir = path.join(UPLOAD_DIR, String(orgId));
            for (const file of req.files) {
                file.filename = encryptAndWrite(file.buffer, destDir, file.originalname);
            }
            await SubmissionModel.addFiles(orgId, submission.id, req.files);
        }

        const [task, intern, org] = await Promise.all([
            TaskModel.getById(orgId, task_id),
            InternModel.getById(orgId, intern_id),
            OrganizationModel.getById(orgId),
        ]);
        slackService.sendSubmissionCreated(org, {
            id: submission.id,
            task_title: task?.title,
            intern_name: intern?.name,
            notes: submission.notes,
        }).catch(() => { });

        logAudit({
            organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'create',
            entityType: 'submission', entityId: submission.id,
            changedFields: { task_id: submission.task_id, intern_id: submission.intern_id },
        });

        res.status(201).json({ success: true, data: submission });
    } catch (err) { next(err); }
};

const review = async (req, res, next) => {
    try {
        const orgId = req.user.organization_id;
        const { status, score, feedback, version } = req.body;
        if (!['approved', 'rejected', 'revision_requested'].includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid review status' });
        }
        if (version == null) {
            return res.status(400).json({ success: false, message: 'Missing version — refresh and try again' });
        }

        const existing = await SubmissionModel.getById(orgId, req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Submission not found' });

        const outcome = await SubmissionModel.review(orgId, req.params.id, { status, score, feedback, expectedVersion: version });
        if (!outcome) return res.status(404).json({ success: false, message: 'Submission not found' });
        if (outcome.conflict) {
            return res.status(409).json({ success: false, message: 'This submission was updated by someone else. Refresh and try again.' });
        }

        logAudit({
            organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
            entityType: 'submission', entityId: outcome.id,
            changedFields: { status: outcome.status, score: outcome.score, feedback: outcome.feedback },
        });

        Promise.all([
            InternModel.getById(orgId, existing.intern_id),
            OrganizationModel.getById(orgId),
        ])
            .then(([intern, org]) => slackService.sendSubmissionReviewed(org, {
                intern_name: intern?.name,
                task_title: existing.task_title,
                status: outcome.status,
                score: outcome.score,
                feedback: outcome.feedback,
            }))
            .catch(() => { });

        res.json({ success: true, data: outcome });
    } catch (err) { next(err); }
};

const downloadFile = async (req, res, next) => {
    try {
        const orgId = req.user.organization_id;
        const submission = await SubmissionModel.getById(orgId, req.params.id);
        if (!submission || (req.user.role === 'intern' && submission.intern_id !== req.user.id)) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }
        const file = (submission.files || []).find(f => String(f.id) === String(req.params.fileId));
        if (!file) return res.status(404).json({ success: false, message: 'File not found' });

        const safeName = String(file.storage_key || '').replace(/^\/+/, '');
        const abs = path.resolve(UPLOAD_DIR, safeName);
        if (!abs.startsWith(path.resolve(UPLOAD_DIR) + path.sep) || !fs.existsSync(abs)) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const downloadName = String(file.file_name || safeName).replace(/[\r\n"]/g, '');
        res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.send(readAndDecrypt(abs));
    } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, review, downloadFile };
