const AdminActivityLog = require("../models/AdminActivityLog");

async function recordActivity({
  adminId,
  action,
  targetType = "",
  targetId = "",
  ipAddress = "",
  userAgent = "",
  meta = {},
}) {
  await AdminActivityLog.create({
    adminId,
    action,
    targetType,
    targetId,
    ipAddress,
    userAgent,
    meta,
  });
}

module.exports = { recordActivity };
