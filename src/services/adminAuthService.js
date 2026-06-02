const crypto = require("crypto");
const bcrypt = require("bcrypt");
const Admin = require("../models/Admin");
const AdminRefreshToken = require("../models/AdminRefreshToken");
const { signAdminAccessToken, verifyAdminAccessToken } = require("../config/jwt");
const { recordActivity } = require("./activityLogService");
const { hashRefreshToken } = require("../models/AdminRefreshToken");
const { AppError } = require("../utils/AppError");
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function authenticateWithPassword(emailRaw, password, ip, ua) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email || !password) {
    throw new AppError(400, "Email and password are required");
  }
  const admin = await Admin.findOne({ email }).populate("roleId");
  if (!admin) throw new AppError(401, "Invalid credentials");
  const ok = admin
   ? await bcrypt.compare(String(password||""), admin.passwordHash||"")
   : false;
  if (!admin || !ok) throw new AppError(401, "Invalid credentials");
  if (admin.isSuspended) throw new AppError(403, "Account suspended");
  if (!admin.roleId?.isActive) throw new AppError(403, "Role inactive");

  admin.lastLoginAt = new Date();
  admin.lastLoginIp = String(ip || "").slice(0, 64);
  await admin.save();

  const refreshRaw = crypto.randomBytes(48).toString("hex");
  const tokenHash = hashRefreshToken(refreshRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await AdminRefreshToken.create({
    adminId: admin._id,
    tokenHash,
    expiresAt,
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  const accessToken = signAdminAccessToken(admin._id);

  await recordActivity({
    adminId: admin._id,
    action: "login",
    targetType: "admin",
    targetId: String(admin._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return {
    accessToken,
    expiresInSeconds: 3600,
    refreshToken: refreshRaw,
    refreshExpiresAt: expiresAt.toISOString(),
    admin: {
      id: String(admin._id),
      email: admin.email,
      fullName: admin.fullName,
      role: admin.roleId
        ? {
            id: String(admin.roleId._id),
            name: admin.roleId.name,
            slug: admin.roleId.slug,
          }
        : null,
    },
  };
}

async function refreshSession(refreshRaw, ip, ua) {
  if (!refreshRaw) throw new AppError(400, "refreshToken is required");
  const tokenHash = hashRefreshToken(refreshRaw);
  const doc = await AdminRefreshToken.findOne({ tokenHash, revokedAt: null }).populate({
    path: "adminId",
    populate: { path: "roleId" },
  });
  if (!doc || doc.expiresAt.getTime() < Date.now()) {
    throw new AppError(401, "Invalid or expired refresh token");
  }
  const admin = doc.adminId;
  if (!admin || admin.isSuspended) throw new AppError(403, "Account unavailable");
  if (!admin.roleId?.isActive) throw new AppError(403, "Role is inactive");

  doc.revokedAt = new Date();
  await doc.save();

  const nextRaw = crypto.randomBytes(48).toString("hex");
  const nextHash = hashRefreshToken(nextRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await AdminRefreshToken.create({
    adminId: admin._id,
    tokenHash: nextHash,
    expiresAt,
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  const accessToken = signAdminAccessToken(admin._id);

  await recordActivity({
    adminId: admin._id,
    action: "token_refresh",
    targetType: "admin",
    targetId: String(admin._id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return {
    accessToken,
    expiresInSeconds: 3600,
    refreshToken: nextRaw,
    refreshExpiresAt: expiresAt.toISOString(),
  };
}

async function logout(refreshRaw, ip, ua, adminIdForLog) {
  if (refreshRaw) {
    const tokenHash = hashRefreshToken(refreshRaw);
    const doc = await AdminRefreshToken.findOne({ tokenHash, revokedAt: null });
    if (doc) {
      doc.revokedAt = new Date();
      await doc.save();
    }
  }
  if (adminIdForLog) {
    await recordActivity({
      adminId: adminIdForLog,
      action: "logout",
      targetType: "admin",
      targetId: String(adminIdForLog),
      ipAddress: String(ip || "").slice(0, 64),
      userAgent: String(ua || "").slice(0, 512),
    });
  }
  return { ok: true };
}

function parseBearer(header) {
  if (!header || !String(header).startsWith("Bearer ")) return "";
  return String(header).slice(7).trim();
}

async function verifyAccessFromHeader(header) {
  const token = parseBearer(header);
  if (!token) throw new AppError(401, "Unauthorized");
  let decoded;
  try {
    decoded = verifyAdminAccessToken(token);
  } catch {
    throw new AppError(401, "Invalid or expired token");
  }
  if (decoded.typ !== "admin_access" || !decoded.sub) {
    throw new AppError(401, "Invalid token type");
  }
  const admin = await Admin.findById(decoded.sub).populate("roleId");
  if (!admin) throw new AppError(401, "Unauthorized");
  if (admin.isSuspended) throw new AppError(403, "Account suspended");
  if (!admin.roleId?.isActive) throw new AppError(403, "Role is inactive");
  return admin;
}

async function updateAdminProfile(adminId, { fullName, currentPassword, newPassword }) {
  const admin = await Admin.findById(adminId);
  if (!admin) throw new AppError(404, "Admin not found");
  if (fullName != null) {
    const n = String(fullName).trim();
    if (n.length < 2) throw new AppError(400, "Invalid fullName");
    admin.fullName = n;
  }
  if (newPassword) {
    if (!currentPassword) throw new AppError(400, "currentPassword is required to set newPassword");
    const ok = await bcrypt.compare(String(currentPassword), admin.passwordHash || "");
    if (!ok) throw new AppError(400, "Current password is incorrect");
    if (String(newPassword).length < 10) throw new AppError(400, "newPassword must be at least 10 characters");
    admin.passwordHash = await bcrypt.hash(String(newPassword), 12);
  }
  await admin.save();
  await admin.populate("roleId", "name slug isActive");
  return admin;
}

module.exports = {
  authenticateWithPassword,
  refreshSession,
  logout,
  verifyAccessFromHeader,
  parseBearer,
  updateAdminProfile,
};
