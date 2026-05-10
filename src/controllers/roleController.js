const rbac = require("../services/rbacService");
const { getClientIp } = require("../utils/requestHelpers");

exports.listPermissions = async (_req, res) => {
  const items = await rbac.listPermissions();
  res.json({ items });
};

exports.listRoles = async (_req, res) => {
  const items = await rbac.listRoles();
  res.json({ items });
};

exports.createRole = async (req, res) => {
  const actorId = req.adminId;
  const ip = getClientIp(req);
  const ua = String(req.headers["user-agent"] || "");
  const role = await rbac.createRole(req.body || {}, actorId, ip, ua);
  res.status(201).json(role);
};

exports.updateRole = async (req, res) => {
  const role = await rbac.updateRole(
    req.params.id,
    req.body || {},
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  );
  res.json(role);
};

exports.deleteRole = async (req, res) => {
  const out = await rbac.deleteRole(
    req.params.id,
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  );
  res.json(out);
};
