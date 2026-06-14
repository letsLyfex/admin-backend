const AdminActivityLog = require("../models/AdminActivityLog");
const { getPagination, paginationMeta } = require("../utils/pagination");

async function listLogs(query) {
  const { page, limit, skip } = getPagination(query);

  const filter = {};

  if (query.adminId) {
    filter.adminId = query.adminId;
  }

  if (query.action) {
    filter.action = String(query.action);
  }

  if (query.targetType) {
    filter.targetType = String(query.targetType);
  }

  // Search support
  if (query.q?.trim()) {
    const regex = new RegExp(query.q.trim(), "i");

    filter.$or = [
      { action: regex },
      { targetType: regex },
      { targetId: regex },
      { ipAddress: regex },
    ];
  }

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