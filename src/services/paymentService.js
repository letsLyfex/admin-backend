const Payment = require("../models/Payment");
const User = require("../models/User");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");

async function listPayments(query) {
  const { page, limit, skip } = getPagination(query);
  const filter = {
    hasPaidSubscription: true,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  };

  if (query.status) {
    if (query.status === "paid") filter.hasPaidSubscription = true;
  }

  if (query.q) {
    const esc = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { fullName: new RegExp(esc, "i") },
      { email: new RegExp(esc, "i") },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("fullName email subscriptionPlan subscriptionExpiresAt hasPaidSubscription usedPaymentIds createdAt updatedAt")
      .lean(),
    User.countDocuments(filter),
  ]);

const mapped = items.map((u) => ({
  _id: u._id,
  userId: { _id: u._id, fullName: u.fullName, email: u.email },
  plan: u.subscriptionPlan,
  status: u.hasPaidSubscription ? "paid" : "created",
  amount: u.subscriptionPlan === "TALK" ? 299 : u.subscriptionPlan === "CONTRIBUTE" ? 599 : 0,
  currency: "INR",
  // Use the last payment ID from usedPaymentIds array
  razorpayPaymentId: u.usedPaymentIds?.length > 0 
    ? u.usedPaymentIds[u.usedPaymentIds.length - 1] 
    : null,
  paymentId: u.usedPaymentIds?.length > 0 
    ? u.usedPaymentIds[u.usedPaymentIds.length - 1] 
    : null,
  subscriptionExpiresAt: u.subscriptionExpiresAt,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
}));

  return { items: mapped, meta: paginationMeta(total, page, limit) };
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
  const [total, paid, talk, contribute] = await Promise.all([
    User.countDocuments({ hasPaidSubscription: true }),
    User.countDocuments({ hasPaidSubscription: true }),
    User.countDocuments({ subscriptionPlan: "TALK", hasPaidSubscription: true }),
    User.countDocuments({ subscriptionPlan: "CONTRIBUTE", hasPaidSubscription: true }),
  ]);

  return {
    count: { total, paid, failed: 0, refunded: 0, created: 0 },
    revenue: { INR: (talk * 299) + (contribute * 599) },
    byPlan: [
      { plan: "TALK", count: talk, total: talk * 299 },
      { plan: "CONTRIBUTE", count: contribute, total: contribute * 599 },
    ],
  };
}

module.exports = {
  listPayments,
  getPaymentById,
  getUserPayments,
  updatePaymentStatus,
  getPaymentStats,
};