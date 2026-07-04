const OrganizationModel = require('../models/organizationModel');
const { logAudit } = require('../services/auditService');

// Never send the raw stored Groq key back to the client -- only whether one
// is configured and a short preview, same principle as not echoing password
// hashes. The invite code IS shown in full since it's meant to be copied and
// shared with a co-worker, not a secret credential.
const maskKey = (key) => {
  if (!key) return null;
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
};

const getSettings = async (req, res, next) => {
  try {
    const org = await OrganizationModel.getById(req.user.organization_id);
    if (!org) return res.status(404).json({ success: false, message: 'Organization not found' });

    res.json({
      success: true,
      data: {
        id: org.id,
        name: org.name,
        inviteCode: org.admin_invite_code || null,
        hasGroqKey: !!org.groq_api_key,
        groqKeyPreview: maskKey(org.groq_api_key),
        globalKeyConfigured: !!process.env.GROQ_API_KEY,
      },
    });
  } catch (err) { next(err); }
};

const regenerateInviteCode = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const org = await OrganizationModel.regenerateInviteCode(orgId);
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'organization', entityId: orgId, changedFields: { admin_invite_code: '(regenerated)' },
    });
    res.json({ success: true, data: { inviteCode: org.admin_invite_code } });
  } catch (err) { next(err); }
};

const updateGroqKey = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const { groq_api_key } = req.body;
    const trimmed = typeof groq_api_key === 'string' ? groq_api_key.trim() : '';

    const org = await OrganizationModel.updateGroqKey(orgId, trimmed || null);
    logAudit({
      organizationId: orgId, actorId: req.user?.id, actorRole: req.user?.role, action: 'update',
      entityType: 'organization', entityId: orgId, changedFields: { groq_api_key: trimmed ? '(set)' : '(cleared)' },
    });
    res.json({
      success: true,
      data: { hasGroqKey: !!org.groq_api_key, groqKeyPreview: maskKey(org.groq_api_key) },
    });
  } catch (err) { next(err); }
};

module.exports = { getSettings, regenerateInviteCode, updateGroqKey };
