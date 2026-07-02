const { WebClient } = require('@slack/web-api');
const slackConfig = require('../config/slack');

const client = slackConfig.enabled ? new WebClient(slackConfig.botToken) : null;

const send = async (text, blocks) => {
  if (!client) return;
  try {
    await client.chat.postMessage({
      channel: slackConfig.defaultChannel,
      text,
      ...(blocks ? { blocks } : {}),
    });
  } catch (err) {
    console.error('Slack error:', err.message);
  }
};

const slackService = {
  notifyInternAdded: async ({ name, email, department }) => {
    await send(
      `👤 New intern added: ${name}`,
      [
        { type: 'header', text: { type: 'plain_text', text: '👤 New Intern Added' } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Name:*\n${name}` },
            { type: 'mrkdwn', text: `*Email:*\n${email}` },
            { type: 'mrkdwn', text: `*Department:*\n${department}` },
          ],
        },
      ]
    );
  },

  notifyTaskAssigned: async ({ intern_name, task_title, task_description, priority, due_date }) => {
    const due = due_date
      ? new Date(due_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'No deadline';

    await send(
      `📋 Task assigned to ${intern_name}: ${task_title}`,
      [
        { type: 'header', text: { type: 'plain_text', text: '📋 New Task Assigned' } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Intern:*\n${intern_name}` },
            { type: 'mrkdwn', text: `*Task:*\n${task_title}` },
            { type: 'mrkdwn', text: `*Priority:*\n${priority || 'medium'}` },
            { type: 'mrkdwn', text: `*Due:*\n${due}` },
          ],
        },
        task_description
          ? { type: 'section', text: { type: 'mrkdwn', text: `*Description:*\n${task_description.slice(0, 300)}` } }
          : null,
      ].filter(Boolean)
    );
  },

  notifyAnnouncement: async ({ title, body }) => {
    await send(
      `📢 Announcement: ${title}`,
      [
        { type: 'header', text: { type: 'plain_text', text: `📢 ${title}` } },
        { type: 'section', text: { type: 'mrkdwn', text: body?.slice(0, 500) || '_No content_' } },
      ]
    );
  },

  notifyCheckIn: async ({ intern_name, time, type }) => {
    await send(
      `${type === 'in' ? '🟢' : '🔴'} ${intern_name} checked ${type === 'in' ? 'in' : 'out'} at ${time}`,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${type === 'in' ? '🟢' : '🔴'} *${intern_name}* checked ${type === 'in' ? 'in' : 'out'} at *${time}*`,
          },
        },
      ]
    );
  },

  notifyTaskCompleted: async ({ intern_name, task_title }) => {
    await send(
      `✅ ${intern_name} completed: ${task_title}`,
      [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *${intern_name}* marked task *"${task_title}"* as completed`,
          },
        },
      ]
    );
  },

  notifyWeeklyDigest: async ({ week_start, week_end, rows }) => {
    const lines = rows.map(r =>
      `• *${r.intern_name}*: ${r.days_present} present | ${parseFloat(r.total_hours).toFixed(1)}h`
    ).join('\n');

    await send(
      `📊 Weekly Attendance Report (${week_start} → ${week_end})`,
      [
        { type: 'header', text: { type: 'plain_text', text: `📊 Weekly Report: ${week_start} → ${week_end}` } },
        { type: 'section', text: { type: 'mrkdwn', text: lines || '_No attendance data_' } },
      ]
    );
  },

  notifyDeadlineAlert: async ({ intern_name, task_title, due_date, days_left }) => {
    const urgency = days_left <= 1 ? '🚨' : '⚠️';
    const dueLabel = days_left === 0 ? 'today' : days_left === 1 ? 'tomorrow' : `in ${days_left} days`;
    await send(
      `${urgency} Deadline: ${task_title} due ${dueLabel}`,
      [
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Intern:*\n${intern_name}` },
            { type: 'mrkdwn', text: `*Task:*\n${task_title}` },
            { type: 'mrkdwn', text: `*Due:*\n${dueLabel} (${due_date})` },
          ],
        },
      ]
    );
  },
  sendSubmissionCreated: async ({ id, task_title, intern_name, notes }) => {
    await send(
      `📤 ${intern_name} submitted work for: ${task_title}`,
      [
        { type: 'header', text: { type: 'plain_text', text: '📤 Work Submitted' } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Intern:*\n${intern_name}` },
            { type: 'mrkdwn', text: `*Task:*\n${task_title}` },
          ],
        },
        notes ? { type: 'section', text: { type: 'mrkdwn', text: `*Notes:*\n${notes.slice(0, 300)}` } } : null,
      ].filter(Boolean)
    );
  },

  sendSubmissionReviewed: async ({ intern_name, task_title, status, score, feedback }) => {
    const emoji = { approved: '✅', rejected: '❌', revision_requested: '🔄' }[status] || '📋';
    await send(
      `${emoji} Submission ${status.replace('_', ' ')}: ${task_title}`,
      [
        { type: 'header', text: { type: 'plain_text', text: `${emoji} Submission Reviewed` } },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Intern:*\n${intern_name}` },
            { type: 'mrkdwn', text: `*Task:*\n${task_title}` },
            { type: 'mrkdwn', text: `*Status:*\n${status.replace('_', ' ')}` },
            score != null ? { type: 'mrkdwn', text: `*Score:*\n${score}/100` } : null,
          ].filter(Boolean),
        },
        feedback ? { type: 'section', text: { type: 'mrkdwn', text: `*Feedback:*\n${feedback.slice(0, 300)}` } } : null,
      ].filter(Boolean)
    );
  },
};

module.exports = slackService;