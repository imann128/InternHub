const ChatModel = require('../models/chatModel');
const slackService = require('../services/slackService');
const path = require('path');
const fs = require('fs');
const { encryptAndWrite, readAndDecrypt } = require('../utils/fileCrypto');

const CHAT_UPLOAD_DIR = path.join(__dirname, '..', '..', 'chat-uploads');

const getMessages = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { intern_id } = req.params;
    const { page, limit } = req.query;
    const { rows, pagination } = await ChatModel.getMessages(orgId, intern_id, { page, limit });
    res.json({ success: true, data: rows, pagination });
  } catch (err) { next(err); }
};

const getAllConversations = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const data = await ChatModel.getAllConversations(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getAnnouncements = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { page, limit } = req.query;
    const { rows, pagination } = await ChatModel.getAnnouncements(orgId, { page, limit });
    res.json({ success: true, data: rows, pagination });
  } catch (err) { next(err); }
};

const sendMessage = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { sender_role, intern_id, message, is_announcement } = req.body;
    const file = req.file;

    if (!message?.trim() && !file) {
      return res.status(400).json({ success: false, message: 'Message or file required' });
    }

    // file_url points at an authenticated API route, not a static path.
    // The file arrives in memory (see middleware/upload.js) so it can be
    // encrypted before ever touching disk.
    let file_url = null, file_name = null, file_type = null;
    if (file) {
      const destDir = path.join(CHAT_UPLOAD_DIR, String(orgId));
      const filename = encryptAndWrite(file.buffer, destDir, file.originalname);
      file_url = `/api/chat/files/${filename}`;
      file_name = file.originalname;
      file_type = file.mimetype;
    }

    const msg = await ChatModel.sendMessage(orgId, {
      sender_role,
      intern_id: intern_id || null,
      message: message?.trim() || null,
      file_url,
      file_name,
      file_type,
      is_announcement: is_announcement === 'true' || is_announcement === true,
    });

    if (is_announcement === 'true' || is_announcement === true) {
      const OrganizationModel = require('../models/organizationModel');
      const org = await OrganizationModel.getById(orgId);
      await slackService.notifyAnnouncement(org, {
        title: 'New Announcement',
        body: message,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
};

const deleteMessage = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const msg = await ChatModel.deleteMessage(orgId, req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, data: msg });
  } catch (err) { next(err); }
};

const getMyMessages = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { page, limit } = req.query;
    const { rows, pagination } = await ChatModel.getMessages(orgId, req.user.id, { page, limit });
    res.json({ success: true, data: rows, pagination });
  } catch (err) { next(err); }
};

const sendMyMessage = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { message } = req.body;
    const file = req.file;

    if (!message?.trim() && !file) {
      return res.status(400).json({ success: false, message: 'Message or file required' });
    }

    let file_url = null, file_name = null, file_type = null;
    if (file) {
      const destDir = path.join(CHAT_UPLOAD_DIR, String(orgId));
      const filename = encryptAndWrite(file.buffer, destDir, file.originalname);
      file_url = `/api/chat/files/${filename}`;
      file_name = file.originalname;
      file_type = file.mimetype;
    }

    const msg = await ChatModel.sendMessage(orgId, {
      sender_role: 'intern',
      intern_id: req.user.id,
      message: message?.trim() || null,
      file_url,
      file_name,
      file_type,
      is_announcement: false,
    });

    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
};

// Authenticated download: confirm the requesting user's org actually owns a
// chat message referencing this file before streaming it — file.filename
// alone isn't enough to prove ownership, so we look up the DB row.
const downloadFile = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const filename = path.basename(req.params.filename); // strip any path traversal
    const pool = require('../config/db');
    const result = await pool.query(
      `SELECT * FROM chat_messages WHERE organization_id = $1 AND file_url LIKE $2 LIMIT 1`,
      [orgId, `%/${filename}`]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'File not found' });

    const abs = path.resolve(CHAT_UPLOAD_DIR, String(orgId), filename);
    if (!abs.startsWith(path.resolve(CHAT_UPLOAD_DIR, String(orgId)) + path.sep) || !fs.existsSync(abs)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const downloadName = String(row.file_name || filename).replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', row.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
    res.send(readAndDecrypt(abs));
  } catch (err) { next(err); }
};

module.exports = { getMessages, getAllConversations, getAnnouncements, sendMessage, deleteMessage, getMyMessages, sendMyMessage, downloadFile };
