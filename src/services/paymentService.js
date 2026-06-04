const Payment = require("../models/Payment");
const User = require("../models/User");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");

async function listPayments(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.plan) filter.plan = query.plan;

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  if (query.q && mongoose.isValidObjectId(query.q.trim())) {
    filter.userId = new mongoose.Types.ObjectId(query.q.trim());
  }

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .populate("userId", "fullName email subscriptionPlan")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return { items, meta: paginationMeta(total, page, limit) };
}

async function getPaymentById(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, "Invalid ID");

  const payment = await Payment.findById(id)
    .populate("userId", "fullName email subscriptionPlan")
    .lean();

  if (!payment) throw new AppError(404, "Payment not found");
  return payment;
}

async function getUserPayments(userId) {
  if (!mongoose.isValidObjectId(userId))
    throw new AppError(400, "Invalid user ID");

  const [user, payments] = await Promise.all([
    User.findById(userId, "fullName email subscriptionPlan").lean(),
    Payment.find({ userId }).sort({ createdAt: -1 }).lean(),
  ]);

  if (!user) throw new AppError(404, "User not found");

  const total = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const paid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    user,
    summary: { total, paid, count: payments.length },
    payments,
  };
}

async function updatePaymentStatus(id, { status, note }, actorId, ip, ua) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, "Invalid ID");

  const allowed = ["created", "paid", "failed", "refunded"];
  if (!allowed.includes(status))
    throw new AppError(400, `Status must be one of: ${allowed.join(", ")}`);

  const payment = await Payment.findByIdAndUpdate(
    id,
    { $set: { status, ...(note && { note }) } },
    { new: true, runValidators: true }
  ).lean();

  if (!payment) throw new AppError(404, "Payment not found");

  await recordActivity({
    adminId: actorId,
    action: "payment_status_update",
    targetType: "payment",
    targetId: String(id),
    ipAddress: String(ip || "").slice(0, 64),
    userAgent: String(ua || "").slice(0, 512),
  });

  return payment;
}

async function getPaymentStats() {
  const [total, paid, failed, refunded, created] = await Promise.all([
    Payment.countDocuments(),
    Payment.countDocuments({ status: "paid" }),
    Payment.countDocuments({ status: "failed" }),
    Payment.countDocuments({ status: "refunded" }),
    Payment.countDocuments({ status: "created" }),
  ]);

  const revenueAgg = await Payment.aggregate([
    { $match: { status: "paid" } },
    {
      $group: {
        _id: "$type",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const planAgg = await Payment.aggregate([
    { $match: { status: "paid", type: "subscription" } },
    {
      $group: {
        _id: "$plan",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const revenue = {};
  revenueAgg.forEach((r) => {
    revenue[r._id] = { amount: r.totalAmount, count: r.count };
  });

  return {
    count: { total, paid, failed, refunded, created },
    revenue,
    byPlan: planAgg.map((p) => ({
      plan: p._id,
      count: p.count,
      totalAmount: p.totalAmount,
    })),
  };
}

module.exports = {
  listPayments,
  getPaymentById,
  getUserPayments,
  updatePaymentStatus,
  getPaymentStats,
};