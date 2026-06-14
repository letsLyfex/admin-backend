const User = require("../models/User");
const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const PauseContent = require("../models/PauseContent");
const DiscussionRoom = require("../models/DiscussionRoom");
const ReferralWithdrawal = require("../models/ReferralWithdrawal");
const AdminActivityLog = require("../models/AdminActivityLog");
const { approxOnlineUsers } = require("./analyticsUserService");

async function getDashboardSummary() {
  const now = new Date();
  const last30 = new Date(now);
  last30.setUTCDate(last30.getUTCDate() - 30);

  const last7 = new Date(now);
  last7.setUTCDate(last7.getUTCDate() - 7);

  const [
    // Users
    totalUsers,       // ALL documents — matches MongoDB compass count
    activeUsers,      // non-deleted only — for context
    deletedUsers,     // soft-deleted count
    blockedUsers,
    suspendedUsers,
    newUsersLast30,
    newUsersLast7,

    // Sessions
    totalWatch,
    liveWatch,
    totalLive,
    liveLive,
    totalPause,
    livePause,
    totalDiscuss,
    liveDiscuss,

    // Referrals
    referralPending,
    referralCompleted,
    referralPendingAgg,

    // Payments — from User model (Payment collection is empty)
    totalPayments,
    paidPayments,
    planAgg,

    // Activity
    recentActivity,
  ] = await Promise.all([

    // Total 
    User.countDocuments({}),

    // Active 
    User.countDocuments({ deletedAt: null }),  

    // Deleted 
    User.countDocuments({ deletedAt: { $ne: null, $exists: true } }),

    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ isSuspended: true }),
    User.countDocuments({ createdAt: { $gte: last30 } }),
    User.countDocuments({ createdAt: { $gte: last7 } }),

    // Watch
    WatchSession.countDocuments(),
    WatchSession.countDocuments({ isLive: true }),

    // Live
    LiveSession.countDocuments(),
    LiveSession.countDocuments({ isLive: true }),

    // Pause
    PauseContent.countDocuments(),
    PauseContent.countDocuments({ isLive: true }),

    // Discuss
    DiscussionRoom.countDocuments(),
    DiscussionRoom.countDocuments({ isLive: true }),

    // Referrals
    ReferralWithdrawal.countDocuments({ status: "pending" }),
    ReferralWithdrawal.countDocuments({ status: "completed" }),
    ReferralWithdrawal.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),

    // Payments
    User.countDocuments({ hasPaidSubscription: true }),
    User.countDocuments({
      hasPaidSubscription: true,
      subscriptionExpiresAt: { $gt: new Date() },
    }),
    User.aggregate([
      { $match: { hasPaidSubscription: true } },
      { $group: { _id: "$subscriptionPlan", count: { $sum: 1 } } },
    ]),

    // Recent activity — last 10 actions
    AdminActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("adminId", "fullName email")
      .lean(),
  ]);

  // Online users across all session types
  const onlineUsers = await approxOnlineUsers();

  const PLAN_PRICE = { TALK: 299, CONTRIBUTE: 599 };
  const revenue = {};
  planAgg.forEach((p) => {
    revenue[p._id] = {
      amount: p.count * (PLAN_PRICE[p._id] ?? 0),
      count: p.count,
    };
  });

  return {
    users: {
      total: totalUsers,       
      active: activeUsers,    
      deleted: deletedUsers,  
      online: onlineUsers,
      blocked: blockedUsers,
      suspended: suspendedUsers,
      newLast7Days: newUsersLast7,
      newLast30Days: newUsersLast30,
    },
    sessions: {
      watch: { total: totalWatch, live: liveWatch },
      live: { total: totalLive, live: liveLive },
      pause: { total: totalPause, live: livePause },
      discuss: { total: totalDiscuss, live: liveDiscuss },
      totalLiveNow: liveWatch + liveLive + livePause + liveDiscuss,
    },
    referrals: {
      pending: referralPending,
      completed: referralCompleted,
      pendingAmount: referralPendingAgg[0]?.total || 0,
    },
    payments: {
      total: totalPayments,
      paid: paidPayments,
      revenue,
    },
    recentActivity,
  };
}

module.exports = { getDashboardSummary };