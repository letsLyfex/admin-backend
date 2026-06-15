const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const PauseContent = require("../models/PauseContent");

//  WATCH SESSION ANALYTICS 

async function getWatchSessionAnalytics() {
  const now = new Date();
  const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    automatedSessions,
    paidSessions,
    categoryAgg,
    sourceAgg,
    recentSessions,
    participantAgg,
  ] = await Promise.all([
    WatchSession.countDocuments(),

WatchSession.countDocuments({
  startsAt: { $lte: now },
  endTime: { $exists: false },   
  status: { $nin: ["ended", "cancelled"] },
}),

    WatchSession.countDocuments({ status: "ended" }),
    WatchSession.countDocuments({ status: "scheduled" }),
    WatchSession.countDocuments({ isAutomated: true }),
    WatchSession.countDocuments({ visibility: "pay_to_watch" }),

    // sessions per category
    WatchSession.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // sessions per source
    WatchSession.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    WatchSession.aggregate([
      { $match: { createdAt: { $gte: thirty } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    
    WatchSession.aggregate([
      {
        $project: {
          duration: 1,
          participantCount: {
            $max: [
              { $size: { $ifNull: ["$participants", []] } },
              {
                $add: [
                  { $size: { $ifNull: ["$paidParticipantIds", []] } },
                  { $size: { $ifNull: ["$vipParticipantIds", []] } },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalParticipants: { $sum: "$participantCount" },
          peakParticipants: { $max: "$participantCount" },
          avgDuration: {
            $avg: {
              $cond: [{ $gt: ["$duration", 0] }, "$duration", null],
            },
          },
        },
      },
    ]),

  ]);

  // Recorded: check both recordingStatus AND recordingUrl existing
  const recordedSessions = await WatchSession.countDocuments({
    $or: [
      { recordingStatus: "completed" },
      { recordingUrl: { $exists: true, $ne: null, $ne: "" } },
    ],
  });

  const agg = participantAgg[0] ?? {};

  return {
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    automatedSessions,
    recordedSessions,
    paidSessions,
    totalParticipants: agg.totalParticipants ?? 0,
    peakParticipants: agg.peakParticipants ?? 0,
    avgDurationMinutes: Math.round((agg.avgDuration ?? 0) * 100) / 100,
    byCategory: categoryAgg.map((a) => ({
      category: a._id || "uncategorized",
      count: a.count,
    })),
    bySource: sourceAgg.map((a) => ({
      source: a._id || "static",
      count: a.count,
    })),
    last30DaysTrend: recentSessions.map((a) => ({
      date: a._id,
      count: a.count,
    })),
  };
}

//  LIVE SESSION ANALYTICS (LEARN) 

async function getLiveSessionAnalytics() {
  const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    learnType,
    watchType,
    automatedSessions,
    paidSessions,
    visibilityAgg,
    sourceAgg,
    recentSessions,
    participantAgg,
  ] = await Promise.all([
    LiveSession.countDocuments(),

LiveSession.countDocuments({
  firstJoinAt: { $exists: true },
  endTime: { $exists: false },
  status: { $nin: ["ended", "cancelled"] },
}),

    LiveSession.countDocuments({ status: "ended" }),
    LiveSession.countDocuments({ status: "scheduled" }),
    LiveSession.countDocuments({ sessionType: "learn" }),
    LiveSession.countDocuments({ sessionType: "watch" }),
    LiveSession.countDocuments({ isAutomated: true }),
    LiveSession.countDocuments({ visibility: "pay_to_watch" }),

    // by visibility
    LiveSession.aggregate([
      { $group: { _id: "$visibility", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // by source
    LiveSession.aggregate([
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    LiveSession.aggregate([
      { $match: { createdAt: { $gte: thirty } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    LiveSession.aggregate([
      {
        $project: {
          duration: 1,
          participantCount: {
            $max: [
              { $size: { $ifNull: ["$participants", []] } },
              {
                $add: [
                  { $size: { $ifNull: ["$paidParticipantIds", []] } },
                  { $size: { $ifNull: ["$vipParticipantIds", []] } },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalParticipants: { $sum: "$participantCount" },
          peakParticipants: { $max: "$participantCount" },
          avgDuration: {
            $avg: {
              $cond: [{ $gt: ["$duration", 0] }, "$duration", null],
            },
          },
        },
      },
    ]),
  ]);

  // Recorded: check both fields
  const recordedSessions = await LiveSession.countDocuments({
    $or: [
      { recordingStatus: "completed" },
      { recordingUrl: { $exists: true, $ne: null, $ne: "" } },
    ],
  });

  const agg = participantAgg[0] ?? {};

  return {
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    byType: { learn: learnType, watch: watchType },
    automatedSessions,
    recordedSessions,
    paidSessions,
    totalParticipants: agg.totalParticipants ?? 0,
    peakParticipants: agg.peakParticipants ?? 0,
    avgDurationMinutes: Math.round((agg.avgDuration ?? 0) * 100) / 100,
    byVisibility: visibilityAgg.map((a) => ({
      visibility: a._id || "public",
      count: a.count,
    })),
    bySource: sourceAgg.map((a) => ({
      source: a._id || "static",
      count: a.count,
    })),
    last30DaysTrend: recentSessions.map((a) => ({
      date: a._id,
      count: a.count,
    })),
  };
}

//  PAUSE SESSION ANALYTICS 

async function getPauseSessionAnalytics() {
  const thirty = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalSessions,
    liveSessions,
    instantHangouts,
    recordedSessions,
    vibeTagAgg,
    recentSessions,
    participantAgg,
  ] = await Promise.all([
    PauseContent.countDocuments(),

    PauseContent.countDocuments({
      $or: [{ isLive: true }, { status: "live" }],
    }),

    PauseContent.countDocuments({ isInstantHangout: true }),

    PauseContent.countDocuments({
      $or: [
        { recordingStatus: "completed" },
        { recordingUrl: { $exists: true, $ne: null, $ne: "" } },
      ],
    }),

    PauseContent.aggregate([
      { $group: { _id: "$vibeTag", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    PauseContent.aggregate([
      { $match: { createdAt: { $gte: thirty } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    // Pause uses participantIds, not participants
    PauseContent.aggregate([
      {
        $project: {
          duration: 1,
          views: 1,
          participantCount: {
            $max: [
              { $size: { $ifNull: ["$participantIds", []] } },
              {
                $add: [
                  { $size: { $ifNull: ["$paidParticipantIds", []] } },
                  { $size: { $ifNull: ["$vipParticipantIds", []] } },
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalParticipants: { $sum: "$participantCount" },
          peakParticipants: { $max: "$participantCount" },
          totalViews: { $sum: { $ifNull: ["$views", 0] } },
          avgDuration: {
            $avg: {
              $cond: [{ $gt: ["$duration", 0] }, "$duration", null],
            },
          },
        },
      },
    ]),
  ]);

  const agg = participantAgg[0] ?? {};

  return {
    totalSessions,
    liveSessions,
    instantHangouts,
    recordedSessions,
    totalParticipants: agg.totalParticipants ?? 0,
    peakParticipants: agg.peakParticipants ?? 0,
    totalViews: agg.totalViews ?? 0,
    avgDurationMinutes: Math.round((agg.avgDuration ?? 0) * 100) / 100,
    byVibeTag: vibeTagAgg.map((a) => ({
      vibeTag: a._id || "none",
      count: a.count,
    })),
    last30DaysTrend: recentSessions.map((a) => ({
      date: a._id,
      count: a.count,
    })),
  };
}

module.exports = {
  getWatchSessionAnalytics,
  getLiveSessionAnalytics,
  getPauseSessionAnalytics,
};