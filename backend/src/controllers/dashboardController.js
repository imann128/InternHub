const DashboardModel = require('../models/dashboardModel');

const getStats = async (req, res, next) => {
  try {
    const orgId = req.user.organization_id;
    const data = await DashboardModel.getStats(orgId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

module.exports = { getStats };