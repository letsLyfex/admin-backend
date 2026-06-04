const User = require("../models/User");
const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const PauseContent = require("../models/PauseContent");
const DiscussionRoom = require("../models/DiscussionRoom");
const ReferralWithdrawal = require("../models/ReferralWithdrawal");
const Payment = require("../models/Payment");
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
    totalUsers,
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

    // Payments
    totalPayments,
    paidPayments,
    revenueAgg,

    // Activity
    recentActivity,
  ] = await Promise.all([
    // Users
    User.countDocuments({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }),
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
    Payment.countDocuments(),
    Payment.countDocuments({ status: "paid" }),
    Payment.aggregate([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: "$type",
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
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

  // Revenue breakdown
  const revenue = {};
  revenueAgg.forEach((r) => {
    revenue[r._id] = { amount: r.totalAmount, count: r.count };
  });

  return {
    users: {
      total: totalUsers,
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