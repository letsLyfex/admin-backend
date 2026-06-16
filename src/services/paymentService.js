const Payment = require("../models/Payment");
const User = require("../models/User");
const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");

async function listPayments(query) {
  const { page, limit, skip } = getPagination(query);
  const typeFilter = query.type; // "subscription" | "session_access" | undefined (all)

  // Early exit for statuses that can't exist
  if (query.status === "failed" || query.status === "refunded" || query.status === "created") {
    return { items: [], meta: paginationMeta(0, page, limit) };
  }

  let subscriptionItems = [];
  let sessionItems = [];

  if (!typeFilter || typeFilter === "subscription") {
    const userFilter = {
      hasPaidSubscription: true,
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };
    if (query.q) {
      const esc = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      userFilter.$or = [
        { fullName: new RegExp(esc, "i") },
        { email: new RegExp(esc, "i") },
      ];
    }
    const users = await User.find(userFilter)
      .sort({ updatedAt: -1 })
      .select("fullName email subscriptionPlan subscriptionExpiresAt hasPaidSubscription usedPaymentIds createdAt updatedAt")
      .lean();

    subscriptionItems = users.map((u) => ({
      _id: String(u._id),
      type: "subscription",
      userId: { _id: u._id, fullName: u.fullName, email: u.email },
      plan: u.subscriptionPlan,
      status: "paid",
      amount: u.subscriptionPlan === "TALK" ? 299 : u.subscriptionPlan === "CONTRIBUTE" ? 599 : 0,
      currency: "INR",
      razorpayPaymentId: u.usedPaymentIds?.length > 0
        ? u.usedPaymentIds[u.usedPaymentIds.length - 1]
        : null,
      paymentId: u.usedPaymentIds?.length > 0
        ? u.usedPaymentIds[u.usedPaymentIds.length - 1]
        : null,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }

  if (!typeFilter || typeFilter === "session_access") {
    const sessionFilter = { "paidParticipantIds.0": { $exists: true } };

    const [watchSessions, liveSessions] = await Promise.all([
      WatchSession.find(sessionFilter)
        .populate("paidParticipantIds", "fullName email")
        .populate("vipParticipantIds", "_id")
        .select("title roomId paymentAmount hasTiers vipPaymentAmount normalPaymentAmount paidParticipantIds vipParticipantIds createdAt updatedAt")
        .lean(),
      LiveSession.find(sessionFilter)
        .populate("paidParticipantIds", "fullName email")
        .populate("vipParticipantIds", "_id")
        .select("title roomId paymentAmount hasTiers vipPaymentAmount normalPaymentAmount paidParticipantIds vipParticipantIds createdAt updatedAt")
        .lean(),
    ]);

    const buildSessionItems = (sessions, sessionType) => {
      const items = [];
      for (const session of sessions) {
        const vipIds = new Set(
          (session.vipParticipantIds || []).map((v) => String(v._id || v))
        );
        for (const user of (session.paidParticipantIds || [])) {
          if (!user || typeof user !== "object") continue;
          if (query.q) {
            const q = query.q.toLowerCase();
            if (
              !user.fullName?.toLowerCase().includes(q) &&
              !user.email?.toLowerCase().includes(q) &&
              !session.title?.toLowerCase().includes(q)
            ) continue;
          }
          const isVip = session.hasTiers && vipIds.has(String(user._id));
          const amount = session.hasTiers
            ? (isVip ? session.vipPaymentAmount : session.normalPaymentAmount)
            : session.paymentAmount;

          items.push({
            _id: `${session._id}_${user._id}`,
            type: "session_access",
            userId: { _id: user._id, fullName: user.fullName, email: user.email },
            plan: session.title,
            status: "paid",
            amount: amount || 0,
            currency: "INR",
            sessionId: session._id,
            sessionType,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          });
        }
      }
      return items;
    };

    sessionItems = [
      ...buildSessionItems(watchSessions, "watch"),
      ...buildSessionItems(liveSessions, "live"),
    ];
  }

  const all = [...subscriptionItems, ...sessionItems].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const total = all.length;
  const items = all.slice(skip, skip + limit);

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
  const [talk, contribute, watchAgg, liveAgg] = await Promise.all([
    User.countDocuments({ subscriptionPlan: "TALK", hasPaidSubscription: true }),
    User.countDocuments({ subscriptionPlan: "CONTRIBUTE", hasPaidSubscription: true }),
    WatchSession.aggregate([
      { $match: { "paidParticipantIds.0": { $exists: true } } },
      {
        $project: {
          paidCount: { $size: "$paidParticipantIds" },
          revenue: {
            $multiply: [{ $size: "$paidParticipantIds" }, "$paymentAmount"],
          },
        },
      },
      { $group: { _id: null, count: { $sum: "$paidCount" }, revenue: { $sum: "$revenue" } } },
    ]),
    LiveSession.aggregate([
      { $match: { "paidParticipantIds.0": { $exists: true } } },
      {
        $project: {
          paidCount: { $size: "$paidParticipantIds" },
          revenue: {
            $multiply: [{ $size: "$paidParticipantIds" }, "$paymentAmount"],
          },
        },
      },
      { $group: { _id: null, count: { $sum: "$paidCount" }, revenue: { $sum: "$revenue" } } },
    ]),
  ]);

  const subscriptionCount = talk + contribute;
  const subscriptionRevenue = talk * 299 + contribute * 599;
  const watchCount = watchAgg[0]?.count || 0;
  const watchRevenue = watchAgg[0]?.revenue || 0;
  const liveCount = liveAgg[0]?.count || 0;
  const liveRevenue = liveAgg[0]?.revenue || 0;
  const sessionCount = watchCount + liveCount;
  const sessionRevenue = watchRevenue + liveRevenue;

  return {
    count: {
      total: subscriptionCount + sessionCount,
      paid: subscriptionCount + sessionCount,
      failed: 0,
      refunded: 0,
      created: 0,
    },
    revenue: { INR: subscriptionRevenue + sessionRevenue },
    byPlan: [
      { plan: "TALK", count: talk, total: talk * 299 },
      { plan: "CONTRIBUTE", count: contribute, total: contribute * 599 },
      { plan: "Watch Session Access", count: watchCount, total: watchRevenue },
      { plan: "Live Session Access", count: liveCount, total: liveRevenue },
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