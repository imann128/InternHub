// Shared clamp/offset logic so every paginated list endpoint (interns,
// tasks, submissions, chat) agrees on the same defaults and the same
// abuse-guard (capping limit so a client can't request an enormous page
// size and defeat the point of paginating in the first place).
const parsePagination = ({ page, limit }, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || defaultLimit));
  const offset = (pageNum - 1) * limitNum;
  return { page: pageNum, limit: limitNum, offset };
};

const buildMeta = (total, page, limit) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { parsePagination, buildMeta };
