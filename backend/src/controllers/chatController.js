const ChatModel = require('../models/chatModel');
const slackService = require('../services/slackService');
const path = require('path');

const getMessages = async (req, res, next) => {
  try {
    const { intern_id } = req.params;
    const messages = await ChatModel.getMessages(intern_id);
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
};

const getAllConversations = async (req, res, next) => {
  try {
    const data = await ChatModel.getAllConversations();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const getAnnouncements = async (req, res, next) => {
  try {
    const data = await ChatModel.getAnnouncements();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const sendMessage = async (req, res, next) => {
  try {
    const { sender_role, intern_id, message, is_announcement } = req.body;
    const file = req.file;

    if (!message?.trim() && !file) {
      return res.status(400).json({ success: false, message: 'Message or file required' });
    }

    const file_url = file ? `/chat-uploads/${file.filename}` : null;
    const file_name = file ? file.originalname : null;
    const file_type = file ? file.mimetype : null;

    const msg = await ChatModel.sendMessage({
      sender_role,
      intern_id: intern_id || null,
      message: message?.trim() || null,
      file_url,
      file_name,
      file_type,
      is_announcement: is_announcement === 'true' || is_announcement === true,
    });

    if (is_announcement === 'true' || is_announcement === true) {
      await slackService.notifyAnnouncement({
        title: 'New Announcement',
        body: message,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
};

const deleteMessage = async (req, res, next) => {
  try {
    const msg = await ChatModel.deleteMessage(req.params.id);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    res.json({ success: true, data: msg });
  } catch (err) { next(err); }
};

const getMyMessages = async (req, res, next) => {
  try {
    const messages = await ChatModel.getMessages(req.user.id);
    res.json({ success: true, data: messages });
  } catch (err) { next(err); }
};

const sendMyMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const file = req.file;

    if (!message?.trim() && !file) {
      return res.status(400).json({ success: false, message: 'Message or file required' });
    }

    const file_url = file ? `/chat-uploads/${file.filename}` : null;
    const file_name = file ? file.originalname : null;
    const file_type = file ? file.mimetype : null;

    const msg = await ChatModel.sendMessage({
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

module.exports = { getMessages, getAllConversations, getAnnouncements, sendMessage, deleteMessage, getMyMessages, sendMyMessage };