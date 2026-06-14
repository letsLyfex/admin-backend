const User = require("../models/User");
const MeetingMessage = require("../models/MeetingMessage");
const DiscussionRoom = require("../models/DiscussionRoom");
const LiveSession = require("../models/LiveSession");
const WatchSession = require("../models/WatchSession");
const PauseContent = require("../models/PauseContent");
const UserAnalytics = require("../models/UserAnalytics");

function startOfUtcDay(d = new Date()) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

async function approxOnlineUsers() {
  return User.countDocuments({ isOnline: true });
}

async function countActiveUsers(since) {
  return User.countDocuments({
    updatedAt: { $gte: since },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });
}


async function countReturningUsers(since) {
  const dayFmt = (dateField) => ({
    $dateToString: { format: "%Y-%m-%d", date: dateField },
  });

  const sessionFilter = { updatedAt: { $gte: since } };
  const msgFilter = { createdAt: { $gte: since } };

  const [liveDays, watchDays, pauseDays, discussDays, msgDays] = await Promise.all([
    LiveSession.aggregate([
      { $match: sessionFilter },
      { $unwind: "$participants" },
      { $group: { _id: { u: "$participants", day: dayFmt("$updatedAt") } } },
    ]),
    WatchSession.aggregate([
      { $match: sessionFilter },
      { $unwind: "$participants" },
      { $group: { _id: { u: "$participants", day: dayFmt("$updatedAt") } } },
    ]),
    PauseContent.aggregate([
      { $match: sessionFilter },
      { $unwind: "$participantIds" },
      { $group: { _id: { u: "$participantIds", day: dayFmt("$updatedAt") } } },
    ]),
    DiscussionRoom.aggregate([
      { $match: sessionFilter },
      { $unwind: "$participants" },
      { $group: { _id: { u: "$participants", day: dayFmt("$updatedAt") } } },
    ]),
    MeetingMessage.aggregate([
      { $match: msgFilter },
      { $group: { _id: { u: "$senderId", day: dayFmt("$createdAt") } } },
    ]),
  ]);

  // Union all (userId, day) pairs into a map → Set<day>
  const userDays = new Map();
  for (const agg of [liveDays, watchDays, pauseDays, discussDays, msgDays]) {
    for (const { _id } of agg) {
      if (!_id?.u) continue;
      const uid = String(_id.u);
      if (!userDays.has(uid)) userDays.set(uid, new Set());
      userDays.get(uid).add(_id.day);
    }
  }

  let returning = 0;
  for (const days of userDays.values()) {
    if (days.size >= 2) returning++;
  }
  return returning;
}

//  Avg session duration 

async function getAvgSessionDurationMs(mauStart) {
  // Try UserAnalytics client payloads (most accurate, but sparse)
  const analyticsSample = await UserAnalytics.find({ updatedAt: { $gte: mauStart } })
    .select("analyticsJson")
    .limit(2000)
    .lean();

  const samples = [];
  for (const row of analyticsSample) {
    try {
      const j = JSON.parse(String(row.analyticsJson || "{}"));
      const v = Number(j.avgSessionDurationMs);
      if (Number.isFinite(v) && v > 0) samples.push(v);
    } catch { /* ignore */ }
  }
  if (samples.length > 0) {
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  }

  // 2. Fallback: avg LiveSession.duration (minutes) for ended sessions
  const durationAgg = await LiveSession.aggregate([
    {
      $match: {
        status: "ended",
        duration: { $gt: 0 },
        updatedAt: { $gte: mauStart },
      },
    },
    { $group: { _id: null, avg: { $avg: "$duration" } } },
  ]);
  if (durationAgg[0]?.avg) {
    return durationAgg[0].avg * 60_000; 
  }

  return 0;
}

//  Main export

async function getUserAnalyticsSummary() {
  const now = new Date();
  const sod = startOfUtcDay(now);          // today 00:00 UTC

  const mauStart = new Date(now);
  mauStart.setUTCDate(mauStart.getUTCDate() - 30);

  const [
    totalUsers,
    blockedUsers,
    suspendedUsers,
    dau,
    mau,
    returningUsers,
    avgSessionDurationMs,
    onlineUsers,
  ] = await Promise.all([
    User.countDocuments({
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    }),
    User.countDocuments({ isBlocked: true }),
    User.countDocuments({ isSuspended: true }),
    countActiveUsers(sod),          
    countActiveUsers(mauStart),     
    countReturningUsers(mauStart),
    getAvgSessionDurationMs(mauStart),
    approxOnlineUsers(),
  ]);

  
  const retentionRate = mau > 0 ? Math.min(1, dau / mau) : 0;

  return {
    totalUsers,
    onlineUsers,
    onlineUsersNote: "Users with isOnline: true (set by socket layer).",
    blockedUsers,
    suspendedUsers,
    dau,
    dauNote: "Users whose User document was updated today (login, join/leave session, disconnect). Same signal that drives isOnline.",
    mau,
    mauNote: "Users whose User document was updated in the last 30 days.",
    returningUsers,
    returningUsersNote:
      "Users with chat or session-participant activity on 2+ distinct days in 30d. Undercounts silent watchers — DAU/MAU is the better engagement signal.",
    avgSessionDurationMs: Math.round(avgSessionDurationMs),
    avgSessionDurationNote:
      "UserAnalytics.analyticsJson when available; falls back to avg LiveSession.duration for ended sessions.",
    retentionRate: Math.round(retentionRate * 10000) / 10000,
    retentionRateNote:
      "DAU / MAU sticky factor. Meaningful once real traffic exists. 0.1 = 10% of monthly users were active today.",
    userAnalyticsRowsTouched30d: 0, 
  };
}

module.exports = { getUserAnalyticsSummary, approxOnlineUsers };