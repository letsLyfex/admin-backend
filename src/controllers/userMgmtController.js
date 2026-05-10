const svc = require("../services/userManagementService");
const { getClientIp } = require("../utils/requestHelpers");

function ctx(req) {
  return [
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  ];
}

exports.list = async (req, res) => {
  res.json(await svc.listUsers(req.query));
};

exports.getOne = async (req, res) => {
  res.json(await svc.getUserById(req.params.id));
};

exports.block = async (req, res) => {
  const { block, reason } = req.body || {};
  res.json(await svc.blockUser(req.params.id, { block: Boolean(block), reason }, ...ctx(req)));
};

exports.suspend = async (req, res) => {
  const { suspend, until } = req.body || {};
  res.json(await svc.suspendUser(req.params.id, { suspend: Boolean(suspend), until }, ...ctx(req)));
};

exports.remove = async (req, res) => {
  res.json(await svc.softDeleteUser(req.params.id, ...ctx(req)));
};

exports.verifyContributor = async (req, res) => {
  res.json(await svc.verifyContributor(req.params.id, ...ctx(req)));
};

exports.assignBadge = async (req, res) => {
  res.json(await svc.assignContributorBadge(req.params.id, ...ctx(req)));
};

exports.resetAccount = async (req, res) => {
  res.json(await svc.resetAccountState(req.params.id, ...ctx(req)));
};
