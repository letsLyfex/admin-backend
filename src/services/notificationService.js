const User = require("../models/User");
const ReferralWithdrawal = require("../models/ReferralWithdrawal");
const AdminActivityLog = require("../models/AdminActivityLog");

const ACTION_LABELS = {
  login: "logged in",
  logout: "logged out",
  token_refresh: "refreshed session",
  user_block: "blocked a user",
  user_unblock: "unblocked a user",
  user_suspend: "suspended a user",
  user_unsuspend: "unsuspended a user",
  user_delete: "deleted a user",
  user_reset: "reset a user account",
  referral_withdrawal_status_update: "updated a referral withdrawal",
  payment_status_update: "updated a payment",
  discussion_pin: "pinned a discussion",
  discussion_feature: "featured a discussion",
  discussion_delete: "deleted a discussion",
  discussion_report_update: "updated a report",
};

async function getNotifications() {
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    pendingReferrals,
    newUsers24h,
    recentActivity,
    newPayments7d,
  ] = await Promise.all([
    ReferralWithdrawal.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "fullName email")
      .lean(),

    User.countDocuments({
      createdAt: { $gte: last24h },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }),

    AdminActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(8)
      .populate("adminId", "fullName")
      .lean(),

    User.countDocuments({
      hasPaidSubscription: true,
      updatedAt: { $gte: last7d },
    }),
  ]);

  const notifications = [];

  // Pending referrals — each one is actionable
  pendingReferrals.forEach((r) => {
    notifications.push({
      id: `referral_${r._id}`,
      type: "referral",
      title: "Pending Referral Withdrawal",
      message: `${r.userId?.fullName ?? "A user"} requested ₹${r.amount} withdrawal`,
      link: "/referrals",
      createdAt: r.createdAt,
    });
  });

  // New users summary
  if (newUsers24h > 0) {
    notifications.push({
      id: `new_users_${last24h.toISOString()}`,
      type: "users",
      title: "New Registrations",
      message: `${newUsers24h} new user${newUsers24h > 1 ? "s" : ""} joined in the last 24 hours`,
      link: "/users",
      createdAt: now,
    });
  }

  // New paid subscriptions
  if (newPayments7d > 0) {
    notifications.push({
      id: `payments_${last7d.toISOString()}`,
      type: "payment",
      title: "New Paid Subscriptions",
      message: `${newPayments7d} subscription${newPayments7d > 1 ? "s" : ""} activated in the last 7 days`,
      link: "/payments",
      createdAt: now,
    });
  }

  // Recent admin activity
  recentActivity.forEach((log) => {
    const label = ACTION_LABELS[log.action] ?? log.action.replace(/_/g, " ");
    notifications.push({
      id: `activity_${log._id}`,
      type: "activity",
      title: "Admin Activity",
      message: `${log.adminId?.fullName ?? "An admin"} ${label}`,
      link: "/activity-logs",
      createdAt: log.createdAt,
    });
  });

  // Sort newest first
  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    notifications: notifications.slice(0, 15),
    unreadCount: pendingReferrals.length + (newUsers24h > 0 ? 1 : 0) + (newPayments7d > 0 ? 1 : 0),
  };
}

module.exports = { getNotifications };
