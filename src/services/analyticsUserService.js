const User = require("../models/User");
const MeetingMessage = require("../models/MeetingMessage");
const DiscussionRoom = require("../models/DiscussionRoom");
const LiveSession = require("../models/LiveSession");
const WatchSession = require("../models/WatchSession");
const PauseContent = require("../models/PauseContent");
const UserAnalytics = require("../models/UserAnalytics");
function userModel() {
  return User;
}
function meetingMessageModel() {
  return MeetingMessage;
}
function discussionRoomModel() {
  return DiscussionRoom;
}
function liveSessionModel() {
  return LiveSession;
}
function watchSessionModel() {
  return WatchSession;
}
function pauseContentModel() {
  return PauseContent;
}
function userAnalyticsModel() {
  return UserAnalytics;
}

function startOfUtcDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function approxOnlineUsers() {
  const User = userModel();
  return await User.countDocuments({ isOnline: true });
}

/**
 * Dashboard metrics. Several values are Mongo-derived approximations (documented inline).
 */
async function getUserAnalyticsSummary() {
  const User = userModel();
  const MeetingMessage = meetingMessageModel();
  const UserAnalytics = userAnalyticsModel();

  const now = new Date();
  const sod = startOfUtcDay(now);
  const mauStart = new Date(now);
  mauStart.setUTCDate(mauStart.getUTCDate() - 30);

  const [
    totalUsers,
    blockedUsers,
    suspendedUsers,
    dauAgg,
    mauAgg,
    recentMsgAgg,
    analyticsActive,
    analyticsSample,
  ] = await Promise.all([
    User.countDocuments({ $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] }),
    User.countDocuments({ isBlocked: true, deletedAt: null }),
    User.countDocuments({ isSuspended: true, deletedAt: null }),
    MeetingMessage.aggregate([
      { $match: { createdAt: { $gte: sod } } },
      { $group: { _id: "$senderId" } },
      { $count: "c" },
    ]),
    MeetingMessage.aggregate([
      { $match: { createdAt: { $gte: mauStart } } },
      { $group: { _id: "$senderId" } },
      { $count: "c" },
    ]),
    MeetingMessage.aggregate([
      { $match: { createdAt: { $gte: mauStart } } },
      {
        $group: {
          _id: { u: "$senderId", day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } } },
        },
      },
      { $group: { _id: "$_id.u", days: { $sum: 1 } } },
      { $match: { days: { $gte: 2 } } },
      { $count: "c" },
    ]),
    UserAnalytics.countDocuments({ updatedAt: { $gte: mauStart } }),
    UserAnalytics.find({ updatedAt: { $gte: mauStart } })
      .select("analyticsJson")
      .limit(2000)
      .lean(),
  ]);

  const dau = dauAgg[0]?.c || 0;
  const mau = mauAgg[0]?.c || 0;
  const returningUsers = recentMsgAgg[0]?.c || 0;

  const onlineUsers = await approxOnlineUsers();

  let avgSessionDurationMs = null;
  const samples = [];
  for (const row of analyticsSample || []) {
    try {
      const j = JSON.parse(String(row.analyticsJson || "{}"));
      const v = Number(j.avgSessionDurationMs);
      if (Number.isFinite(v) && v > 0) samples.push(v);
    } catch {
      /* ignore malformed client payloads */
    }
  }
  if (samples.length) {
    avgSessionDurationMs = samples.reduce((a, b) => a + b, 0) / samples.length;
  }
  if (avgSessionDurationMs == null) {
    // Fallback proxy: messages per active user over MAU window (not true duration)
    const [msgCount, distinctSenders] = await Promise.all([
      MeetingMessage.countDocuments({ createdAt: { $gte: mauStart } }),
      MeetingMessage.distinct("senderId", { createdAt: { $gte: mauStart } }),
    ]);
    avgSessionDurationMs =
      distinctSenders.length > 0 ? (msgCount / distinctSenders.length) * 60_000 : 0;
  }

  const retentionRate =
    totalUsers > 0 ? Math.min(1, Math.max(0, (returningUsers / totalUsers) * (mau / Math.max(totalUsers, 1)))) : 0;

  return {
    totalUsers,
    onlineUsersNote:
      "Distinct user ids currently listed on in-memory Mongo participant rosters for live discussion / learn / watch / pause hangouts (same source the main app updates on socket join).",
    onlineUsers,
    blockedUsers,
    suspendedUsers,
    dau,
    mau,
    returningUsers,
    returningUsersNote:
      "Users with chat activity on 2+ distinct days in the last 30 days (MeetingMessage)",
    avgSessionDurationMs: Math.round(Number(avgSessionDurationMs) || 0),
    avgSessionDurationNote:
      "Uses UserAnalytics.analyticsJson.avgSessionDurationMs when present; otherwise a chat-activity proxy (not true client session time).",
    retentionRate: Math.round(retentionRate * 10000) / 10000,
    retentionRateNote: "Heuristic: (returningUsers / totalUsers) * (mau / totalUsers), capped at 1 — refine with event tracking later.",
    userAnalyticsRowsTouched30d: analyticsActive,
  };
}

module.exports = { getUserAnalyticsSummary, approxOnlineUsers };
