const Payment = require("../models/Payment");
const User = require("../models/User");
const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const PauseContent = require("../models/PauseContent");
const DiscussionRoom = require("../models/DiscussionRoom");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");

async function listPayments(query) {
  const { page, limit, skip } = getPagination(query);

  const filter = {};
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.q) {
    // search by razorpay payment/order ID
    const esc = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { razorpayPaymentId: new RegExp(esc, "i") },
      { razorpayOrderId: new RegExp(esc, "i") },
    ];
  }

  const [rawItems, total] = await Promise.all([
    Payment.find(filter)
      .populate("userId", "fullName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);

  // Enrich session_access items with session title
  const sessionIds = rawItems
    .filter((p) => p.type === "session_access" && p.sessionId)
    .map((p) => p.sessionId);

  let sessionTitles = {};
  if (sessionIds.length > 0) {
    const [watchSessions, liveSessions, pauseContents, discussionRooms] = await Promise.all([
      WatchSession.find({ _id: { $in: sessionIds } }).select("_id title").lean(),
      LiveSession.find({ _id: { $in: sessionIds } }).select("_id title").lean(),
      PauseContent.find({ _id: { $in: sessionIds } }).select("_id title").lean(),
      DiscussionRoom.find({ _id: { $in: sessionIds } }).select("_id topic").lean(),
    ]);
    [...watchSessions, ...liveSessions, ...pauseContents].forEach((s) => {
      sessionTitles[String(s._id)] = s.title;
    });
    discussionRooms.forEach((s) => {
      sessionTitles[String(s._id)] = s.topic;
    });
  }

  const items = rawItems.map((p) => ({
    _id: String(p._id),
    type: p.type,
    userId: p.userId,
    plan: p.type === "session_access"
      ? (sessionTitles[String(p.sessionId)] ?? p.plan ?? "Session Access")
      : (p.plan ?? "Subscription"),
    status: p.status,
    amount: p.amount,
    currency: p.currency,
    razorpayPaymentId: p.razorpayPaymentId || null,
    razorpayOrderId: p.razorpayOrderId || null,
    sessionId: p.sessionId,
    sessionType: p.sessionType,
    tier: p.tier,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));

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
  const [statusAgg, revenueAgg, watchSessions, liveSessions] = await Promise.all([
    Payment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$currency", total: { $sum: "$amount" } } },
    ]),
    WatchSession.find(
      { paidParticipantIds: { $exists: true, $not: { $size: 0 } } },
      { title: 1, paidParticipantIds: 1, vipParticipantIds: 1, paymentAmount: 1, hasTiers: 1, vipPaymentAmount: 1, normalPaymentAmount: 1 }
    ).lean(),
    LiveSession.find(
      { paidParticipantIds: { $exists: true, $not: { $size: 0 } } },
      { title: 1, paidParticipantIds: 1, vipParticipantIds: 1, paymentAmount: 1, hasTiers: 1, vipPaymentAmount: 1, normalPaymentAmount: 1 }
    ).lean(),
  ]);

  const statusMap = {};
  statusAgg.forEach((s) => { statusMap[s._id] = s.count; });

  const revenue = {};
  revenueAgg.forEach((r) => { revenue[r._id || "INR"] = r.total; });

  const byPlan = [...watchSessions, ...liveSessions]
    .map((session) => {
      const txCount = (session.paidParticipantIds || []).length;
      let sessionRevenue;
      if (session.hasTiers) {
        const vipCount = (session.vipParticipantIds || []).length;
        const normalCount = txCount - vipCount;
        sessionRevenue = vipCount * (session.vipPaymentAmount || 0) + normalCount * (session.normalPaymentAmount || 0);
      } else {
        sessionRevenue = txCount * (session.paymentAmount || 0);
      }
      return { plan: session.title || "Unknown", count: txCount, total: sessionRevenue };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => b.total - a.total);

  const total = Object.values(statusMap).reduce((s, v) => s + v, 0);

  return {
    count: {
      total,
      paid: statusMap.paid || 0,
      failed: statusMap.failed || 0,
      refunded: statusMap.refunded || 0,
      created: statusMap.created || 0,
    },
    revenue: Object.keys(revenue).length > 0 ? revenue : { INR: 0 },
    byPlan,
  };
}

module.exports = {
  listPayments,
  getPaymentById,
  getUserPayments,
  updatePaymentStatus,
  getPaymentStats,
};