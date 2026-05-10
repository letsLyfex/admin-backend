const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const Role = require("../models/Role");
const AdminRefreshToken = require("../models/AdminRefreshToken");
const { recordActivity } = require("./activityLogService");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");

async function listAdmins(query) {
  const { page, limit, skip } = getPagination(query);
  const q = String(query.q || "").trim();
  const filter = {};
  if (q) {
    filter.$or = [
      { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      { fullName: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
    ];
  }
  const [items, total] = await Promise.all([
    Admin.find(filter)
      .populate("roleId", "name slug isActive isSystem")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Admin.countDocuments(filter),
  ]);
  return {
    items: items.map((a) => ({
      id: String(a._id),
      email: a.email,
      fullName: a.fullName,
      isSuspended: a.isSuspended,
      suspendedReason: a.suspendedReason,
      lastLoginAt: a.lastLoginAt,
      lastLoginIp: a.lastLoginIp,
      role: a.roleId,
      createdAt: a.createdAt,
    })),
    meta: paginationMeta(total, page, limit),
  };
}

async function createAdmin({ email, password, fullName, roleId }, actorAdminId, ip, ua) {
  const em = String(email || "").trim().toLowerCase();
  if (!em || !password || !fullName || !roleId) {
    throw new AppError(400, "email, password, fullName, and roleId are required");
  }
  if (String(password).length < 10) {
    throw new AppError(400, "Password must be at least 10 characters");
  }
  const role = await Role.findById(roleId);
  if (!role || !role.isActive) throw new AppError(400, "Invalid role");
  const exists = await Admin.findOne({ email: em });
  if (exists) throw new AppError(409, "Email already in use");

  const passwordHash = await bcrypt.hash(String(password), 12);
  const admin = await Admin.create({
    email: em,
    passwordHash,
    fullName: String(fullName).trim(),
    roleId: role._id,
    createdByAdminId: actorAdminId || null,
  });

  if (actorAdminId) await recordActivity({
    adminId: actorAdminId,
    action: "admin_create",
    targetType: "admin",
    targetId: String(admin._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
    meta: { email: admin.email },
  });

  await admin.populate("roleId", "name slug isActive");
  return admin;
}

async function updateAdmin(id, { fullName, roleId }, actorAdminId, ip, ua) {
  const admin = await Admin.findById(id);
  if (!admin) throw new AppError(404, "Admin not found");
  if (fullName != null) admin.fullName = String(fullName).trim();
  if (roleId) {
    const role = await Role.findById(roleId);
    if (!role || !role.isActive) throw new AppError(400, "Invalid role");
    admin.roleId = role._id;
  }
  await admin.save();

  await recordActivity({
    adminId: actorAdminId,
    action: "admin_update",
    targetType: "admin",
    targetId: String(admin._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  await admin.populate("roleId", "name slug isActive");
  return admin;
}

async function deleteAdmin(id, actorAdminId, ip, ua) {
  if (String(id) === String(actorAdminId)) {
    throw new AppError(400, "Cannot delete your own admin account via this endpoint");
  }
  const admin = await Admin.findById(id);
  if (!admin) throw new AppError(404, "Admin not found");
  await Admin.deleteOne({ _id: id });

  await recordActivity({
    adminId: actorAdminId,
    action: "admin_delete",
    targetType: "admin",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
    meta: { email: admin.email },
  });
  return { ok: true };
}

async function suspendAdmin(id, { suspend, reason }, actorAdminId, ip, ua) {
  const admin = await Admin.findById(id);
  if (!admin) throw new AppError(404, "Admin not found");
  if (String(id) === String(actorAdminId)) {
    throw new AppError(400, "Cannot suspend yourself");
  }
  admin.isSuspended = Boolean(suspend);
  admin.suspendedReason = suspend ? String(reason || "").trim().slice(0, 500) : "";
  if (suspend) admin.refreshTokenVersion = (admin.refreshTokenVersion || 0) + 1;
  await admin.save();

  await AdminRefreshToken.updateMany(
    { adminId: admin._id, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );

  await recordActivity({
    adminId: actorAdminId,
    action: suspend ? "admin_suspend" : "admin_unsuspend",
    targetType: "admin",
    targetId: String(admin._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });
  await admin.populate("roleId", "name slug isActive");
  return admin;
}

module.exports = {
  listAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  suspendAdmin,
};
