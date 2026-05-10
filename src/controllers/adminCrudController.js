const svc = require("../services/adminCrudService");
const { getClientIp } = require("../utils/requestHelpers");

function ctx(req) {
  return [
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  ];
}

exports.list = async (req, res) => {
  const out = await svc.listAdmins(req.query);
  res.json(out);
};

exports.create = async (req, res) => {
  const doc = await svc.createAdmin(req.body || {}, ...ctx(req));
  res.status(201).json({
    id: String(doc._id),
    email: doc.email,
    fullName: doc.fullName,
    role: doc.roleId,
    createdAt: doc.createdAt,
  });
};

exports.update = async (req, res) => {
  const doc = await svc.updateAdmin(req.params.id, req.body || {}, ...ctx(req));
  res.json({
    id: String(doc._id),
    email: doc.email,
    fullName: doc.fullName,
    role: doc.roleId,
  });
};

exports.remove = async (req, res) => {
  const out = await svc.deleteAdmin(req.params.id, ...ctx(req));
  res.json(out);
};

exports.suspend = async (req, res) => {
  const { suspend, reason } = req.body || {};
  const doc = await svc.suspendAdmin(
    req.params.id,
    { suspend: Boolean(suspend), reason },
    ...ctx(req),
  );
  res.json({
    id: String(doc._id),
    email: doc.email,
    fullName: doc.fullName,
    isSuspended: doc.isSuspended,
    role: doc.roleId,
  });
};
