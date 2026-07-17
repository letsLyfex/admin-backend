const Payment = require("../models/Payment");
const User = require("../models/User");
const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const PauseContent = require("../models/PauseContent");
const DiscussionRoom = require("../models/DiscussionRoom");
const SellSession = require("../models/SellSession");
const CompeteSession = require("../models/CompeteSession");
const HelpSession = require("../models/HelpSession");
const mongoose = require("mongoose");
const { AppError } = require("../utils/AppError");
const { getPagination, paginationMeta } = require("../utils/pagination");
const { recordActivity } = require("./activityLogService");

async function listPayments(query) {
  const { page, limit, skip } = getPagination(query);

  const filter = {};
  if (query.type) filter.type = query.type;
  if (query.status) filter.status = query.status;
  if (query.sessionType) filter.sessionType = query.sessionType;
  if (query.sessionId && mongoose.isValidObjectId(query.sessionId)) {
    filter.sessionId = new mongoose.Types.ObjectId(query.sessionId);
  }

  if (query.q) {
    const esc = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(esc, "i");

    // Resolve matching user IDs and session IDs so search works across all pages
    const [matchUsers, matchWatch, matchLive, matchPause, matchDiscuss] = await Promise.all([
      User.find({ $or: [{ fullName: regex }, { email: regex }] }).select("_id").lean(),
      WatchSession.find({ title: regex }).select("_id").lean(),
      LiveSession.find({ title: regex }).select("_id").lean(),
      PauseContent.find({ title: regex }).select("_id").lean(),
      DiscussionRoom.find({ topic: regex }).select("_id").lean(),
    ]);

    const userIds = matchUsers.map((u) => u._id);
    const sessionIds = [...matchWatch, ...matchLive, ...matchPause, ...matchDiscuss].map((s) => s._id);

    const orClauses = [
      { razorpayPaymentId: regex },
      { razorpayOrderId: regex },
    ];
    if (userIds.length) orClauses.push({ userId: { $in: userIds } });
    if (sessionIds.length) orClauses.push({ sessionId: { $in: sessionIds } });

    filter.$or = orClauses;
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
    const [watchSessions, liveSessions, pauseContents, discussionRooms, sellSessions, competeSessions, helpSessions] = await Promise.all([
      WatchSession.find({ _id: { $in: sessionIds } }).select("_id title").lean(),
      LiveSession.find({ _id: { $in: sessionIds } }).select("_id title").lean(),
      PauseContent.find({ _id: { $in: sessionIds } }).select("_id title").lean(),
      DiscussionRoom.find({ _id: { $in: sessionIds } }).select("_id topic").lean(),
      SellSession.find({ _id: { $in: sessionIds } }).select("_id productName").lean(),
      CompeteSession.find({ _id: { $in: sessionIds } }).select("_id topic").lean(),
      HelpSession.find({ _id: { $in: sessionIds } }).select("_id topic").lean(),
    ]);
    [...watchSessions, ...liveSessions, ...pauseContents].forEach((s) => {
      sessionTitles[String(s._id)] = s.title;
    });
    [...discussionRooms, ...competeSessions, ...helpSessions].forEach((s) => {
      sessionTitles[String(s._id)] = s.topic;
    });
    sellSessions.forEach((s) => {
      sessionTitles[String(s._id)] = s.productName;
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

// Returns all sessions that have paid participants or payment records, for the filter dropdown
async function listPaymentSessions() {
  const paidQuery = { paidParticipantIds: { $exists: true, $not: { $size: 0 } } };

  // Approach 1: sessions linked via Payment.sessionId
  const sessionIds = await Payment.distinct("sessionId", {
    type: "session_access",
    sessionId: { $ne: null },
  });

  // Approach 2: sessions that have paidParticipantIds set (catches older payments
  // where sessionId was not stored on the Payment record)
  const [
    watchById, liveById, pauseById, discussById, sellById, competeById, helpById,
    watchByPaid, liveByPaid, pauseByPaid, discussByPaid,
  ] = await Promise.all([
    sessionIds.length ? WatchSession.find({ _id: { $in: sessionIds } }).select("_id title hostId").lean() : [],
    sessionIds.length ? LiveSession.find({ _id: { $in: sessionIds } }).select("_id title hostId").lean() : [],
    sessionIds.length ? PauseContent.find({ _id: { $in: sessionIds } }).select("_id title hostId").lean() : [],
    sessionIds.length ? DiscussionRoom.find({ _id: { $in: sessionIds } }).select("_id topic hostId").lean() : [],
    sessionIds.length ? SellSession.find({ _id: { $in: sessionIds } }).select("_id productName hostId").lean() : [],
    sessionIds.length ? CompeteSession.find({ _id: { $in: sessionIds } }).select("_id topic hostId").lean() : [],
    sessionIds.length ? HelpSession.find({ _id: { $in: sessionIds } }).select("_id topic hostId").lean() : [],
    WatchSession.find(paidQuery).select("_id title hostId").lean(),
    LiveSession.find(paidQuery).select("_id title hostId").lean(),
    PauseContent.find(paidQuery).select("_id title hostId").lean(),
    DiscussionRoom.find(paidQuery).select("_id topic hostId").lean(),
  ]);

  // Merge both sets, deduplicating by _id
  const seen = new Set();
  const sessions = [];

  const add = (arr, nameKey, type) => {
    for (const s of arr) {
      const id = String(s._id);
      if (!seen.has(id) && s[nameKey]) {
        seen.add(id);
        sessions.push({ _id: s._id, name: s[nameKey], type, hostId: s.hostId });
      }
    }
  };

  add([...watchById, ...watchByPaid], "title", "watch");
  add([...liveById, ...liveByPaid], "title", "live");
  add([...pauseById, ...pauseByPaid], "title", "pause");
  add([...discussById, ...discussByPaid], "topic", "discussion");
  add(sellById, "productName", "sell");
  add(competeById, "topic", "compete");
  add(helpById, "topic", "help");

  // Look up host names
  const hostIds = [...new Set(sessions.map(s => s.hostId).filter(Boolean).map(String))];
  const hostUsers = hostIds.length
    ? await User.find({ _id: { $in: hostIds } }).select("_id fullName").lean()
    : [];
  const hostMap = {};
  hostUsers.forEach(u => { hostMap[String(u._id)] = u.fullName; });

  sessions.forEach(s => {
    s.hostName = (s.hostId && hostMap[String(s.hostId)]) || null;
    delete s.hostId;
  });

  sessions.sort((a, b) => a.name.localeCompare(b.name));
  return sessions;
}

module.exports = {
  listPayments,
  getPaymentById,
  getUserPayments,
  updatePaymentStatus,
  getPaymentStats,
  listPaymentSessions,
};