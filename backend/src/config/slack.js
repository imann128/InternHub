module.exports = {
  enabled: !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_SIGNING_SECRET),
  botToken: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#general',
};