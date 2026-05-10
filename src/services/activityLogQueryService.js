const AdminActivityLog = require("../models/AdminActivityLog");
const { getPagination, paginationMeta } = require("../utils/pagination");

async function listLogs(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.adminId) filter.adminId = query.adminId;
  if (query.action) filter.action = String(query.action);
  if (query.targetType) filter.targetType = String(query.targetType);

  const [items, total] = await Promise.all([
    AdminActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("adminId", "email fullName")
      .lean(),
    AdminActivityLog.countDocuments(filter),
  ]);

  return {
    items,
    meta: paginationMeta(total, page, limit),
  };
}

module.exports = { listLogs };
