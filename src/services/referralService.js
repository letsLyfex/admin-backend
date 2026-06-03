const ReferralWithdrawal = require("../models/ReferralWithdrawal");
const User = require("../models/User");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");

async function listWithdrawals(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (String(query.q || "").trim()) {
    // search by userId if valid ObjectId
    if (mongoose.isValidObjectId(query.q.trim())) {
      filter.userId = new mongoose.Types.ObjectId(query.q.trim());
    }
  }

  if (query.status) filter.status = query.status;
  if (query.reason) filter.reason = query.reason;

  // date range filter
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const [items, total] = await Promise.all([
    ReferralWithdrawal.find(filter)
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ReferralWithdrawal.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

async function getWithdrawalById(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, "Invalid ID");

  const withdrawal = await ReferralWithdrawal.findById(id)
    .populate("userId", "fullName email profilePic")
    .lean();

  if (!withdrawal) throw new AppError(404, "Withdrawal not found");
  return withdrawal;
}

async function updateWithdrawalStatus(id, { status, note }, actorId, ip, ua) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, "Invalid ID");

  const allowed = ["pending", "completed", "failed", "rejected"];
  if (!allowed.includes(status))
    throw new AppError(400, `Status must be one of: ${allowed.join(", ")}`);

  const withdrawal = await ReferralWithdrawal.findByIdAndUpdate(
    id,
    { $set: { status } },
    { new: true, runValidators: true }
  ).lean();

  if (!withdrawal) throw new AppError(404, "Withdrawal not found");

  await recordActivity({
    adminId: actorId,
    action: "referral_withdrawal_status_update",
    targetType: "referral_withdrawal",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return withdrawal;
}

async function getWithdrawalStats() {
  const [total, pending, completed, failed, rejected] = await Promise.all([
    ReferralWithdrawal.countDocuments(),
    ReferralWithdrawal.countDocuments({ status: "pending" }),
    ReferralWithdrawal.countDocuments({ status: "completed" }),
    ReferralWithdrawal.countDocuments({ status: "failed" }),
    ReferralWithdrawal.countDocuments({ status: "rejected" }),
  ]);

  // total amount by status
  const amountAgg = await ReferralWithdrawal.aggregate([
    {
      $group: {
        _id: "$status",
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const amounts = {};
  amountAgg.forEach((a) => {
    amounts[a._id] = a.totalAmount;
  });

  return {
    count: { total, pending, completed, failed, rejected },
    amounts,
  };
}

async function getUserReferralSummary(userId) {
  if (!mongoose.isValidObjectId(userId))
    throw new AppError(400, "Invalid user ID");

  const [user, transactions] = await Promise.all([
    User.findById(userId, "fullName email").lean(),
    ReferralWithdrawal.find({ userId })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  if (!user) throw new AppError(404, "User not found");

  const total = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const completed = transactions
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const pending = transactions
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  return {
    user,
    summary: { total, completed, pending },
    transactions,
  };
}

module.exports = {
  listWithdrawals,
  getWithdrawalById,
  updateWithdrawalStatus,
  getWithdrawalStats,
  getUserReferralSummary,
};