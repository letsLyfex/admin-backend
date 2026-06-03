const svc = require("../services/referralService");
const { getClientIp } = require("../utils/requestHelpers");

function ctx(req) {
  return [
    req.adminId,
    getClientIp(req),
    String(req.headers["user-agent"] || ""),
  ];
}

exports.listWithdrawals = async (req, res) => {
  res.json(await svc.listWithdrawals(req.query));
};

exports.getWithdrawal = async (req, res) => {
  res.json(await svc.getWithdrawalById(req.params.id));
};

exports.updateStatus = async (req, res) => {
  const { status, note } = req.body || {};
  res.json(
    await svc.updateWithdrawalStatus(
      req.params.id,
      { status, note },
      ...ctx(req)
    )
  );
};

exports.getStats = async (req, res) => {
  res.json(await svc.getWithdrawalStats());
};

exports.getUserSummary = async (req, res) => {
  res.json(await svc.getUserReferralSummary(req.params.userId));
};