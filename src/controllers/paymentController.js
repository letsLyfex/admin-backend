const svc = require("../services/paymentService");

const { getClientIp } = require("../utils/requestHelpers");

function ctx(req) {
  return [
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  ];
}

exports.listPayments = async (req, res) => {
  res.json(await svc.listPayments(req.query));
};

exports.getPayment = async (req, res) => {
  res.json(await svc.getPaymentById(req.params.id));
};

exports.getUserPayments = async (req, res) => {
  res.json(await svc.getUserPayments(req.params.userId));
};

exports.updateStatus = async (req, res) => {
  const { status, note } = req.body || {};
  res.json(
    await svc.updatePaymentStatus(req.params.id, { status, note }, ...ctx(req))
  );
};

exports.getStats = async (req, res) => {
  res.json(await svc.getPaymentStats());
};

exports.getSessions = async (req, res) => {
  res.json(await svc.listPaymentSessions());
};