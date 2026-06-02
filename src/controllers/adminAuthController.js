const adminAuthService = require("../services/adminAuthService");
const { requireBodyFields } = require("../validators/common");

exports.login = async (req, res) => {
  requireBodyFields(req.body, ["email", "password"]);
  const { getClientIp } = require("../utils/requestHelpers");
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  const { email, password } = req.body || {};
  const out = await adminAuthService.authenticateWithPassword(email, password, ip, ua);
  res.json(out);
};

exports.refresh = async (req, res) => {
  const { getClientIp } = require("../utils/requestHelpers");
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  const refreshToken =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  const out = await adminAuthService.refreshSession(refreshToken, ip, ua);
  res.json(out);
};

exports.logout = async (req, res) => {
  const { getClientIp } = require("../utils/requestHelpers");
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  const refreshToken =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  await adminAuthService.logout(refreshToken, ip, ua, req.adminId);
  res.json({ ok: true });
};

exports.me = async (req, res) => {
  const a = req.admin;
  await a.populate("roleId", "name slug isActive permissionKeys description");
  res.json({
    id: String(a._id),
    email: a.email,
    fullName: a.fullName,
    role: a.roleId
      ? {
          id: String(a.roleId._id),
          name: a.roleId.name,
          slug: a.roleId.slug,
          permissionKeys: a.roleId.permissionKeys || [],
        }
      : null,
  });
};

exports.updateProfile = async (req, res) => {
  const { fullName, currentPassword, newPassword } = req.body || {};
  const updated = await adminAuthService.updateAdminProfile(req.adminId, {
    fullName,
    currentPassword,
    newPassword,
  });
  res.json({
    id: String(updated._id),
    email: updated.email,
    fullName: updated.fullName,
    role: updated.roleId
      ? {
          id: String(updated.roleId._id),
          name: updated.roleId.name,
          slug: updated.roleId.slug,
        }
      : null,
  });
};
