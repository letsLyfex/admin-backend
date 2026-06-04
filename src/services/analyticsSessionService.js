const WatchSession = require("../models/WatchSession");
const LiveSession = require("../models/LiveSession");
const PauseContent = require("../models/PauseContent");
const MeetingMessage = require("../models/MeetingMessage");
const SavedDiscussionRecording = require("../models/SavedDiscussionRecording");

function watchSessionModel() { return WatchSession; }
function liveSessionModel() { return LiveSession; }
function pauseContentModel() { return PauseContent; }
function meetingMessageModel() { return MeetingMessage; }
function savedDiscussionRecordingModel() { return SavedDiscussionRecording; }

//  WATCH SESSION ANALYTICS 

async function getWatchSessionAnalytics() {
  const WatchSession = watchSessionModel();

  const [
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    automatedSessions,
    recordedSessions,
    paidSessions,
    categoryAgg,
    sourceAgg,
    recentSessions,
  ] = await Promise.all([
    WatchSession.countDocuments(),
    WatchSession.countDocuments({ isLive: true }),
    WatchSession.countDocuments({ status: "ended" }),
    WatchSession.countDocuments({ status: "scheduled" }),
    WatchSession.countDocuments({ isAutomated: true }),
    WatchSession.countDocuments({ recordingStatus: "completed" }),
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

    // last 30 days trend
    WatchSession.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // total participants across all sessions
  const sessions = await WatchSession.find({})
    .select("participants duration")
    .lean();

  const totalParticipants = sessions.reduce(
    (sum, s) => sum + (s.participants?.length || 0),
    0
  );
  const peakParticipants = sessions.reduce(
    (max, s) => Math.max(max, s.participants?.length || 0),
    0
  );

  const durations = sessions
    .map((s) => Number(s.duration))
    .filter((d) => d > 0);
  const avgDurationMinutes = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  return {
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    automatedSessions,
    recordedSessions,
    paidSessions,
    totalParticipants,
    totalParticipantsNote:
      "Sum of participant array lengths per WatchSession document.",
    peakParticipants,
    peakParticipantsNote:
      "Maximum participants roster size on any single WatchSession row.",
    avgDurationMinutes: Math.round(avgDurationMinutes * 100) / 100,
    avgDurationNote:
      "Average of scheduled duration field (minutes), not tracked LiveKit session length.",
    byCategory: categoryAgg.map((a) => ({ category: a._id || "uncategorized", count: a.count })),
    bySource: sourceAgg.map((a) => ({ source: a._id || "static", count: a.count })),
    last30DaysTrend: recentSessions.map((a) => ({ date: a._id, count: a.count })),
  };
}

//  LIVE SESSION ANALYTICS (LEARN) 

async function getLiveSessionAnalytics() {
  const LiveSession = liveSessionModel();

  const [
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    learnType,
    watchType,
    automatedSessions,
    recordedSessions,
    paidSessions,
    visibilityAgg,
    sourceAgg,
    recentSessions,
  ] = await Promise.all([
    LiveSession.countDocuments(),
    LiveSession.countDocuments({ isLive: true }),
    LiveSession.countDocuments({ status: "ended" }),
    LiveSession.countDocuments({ status: "scheduled" }),
    LiveSession.countDocuments({ sessionType: "learn" }),
    LiveSession.countDocuments({ sessionType: "watch" }),
    LiveSession.countDocuments({ isAutomated: true }),
    LiveSession.countDocuments({ recordingStatus: "completed" }),
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

    // last 30 days trend
    LiveSession.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const sessions = await LiveSession.find({})
    .select("participants duration")
    .lean();

  const totalParticipants = sessions.reduce(
    (sum, s) => sum + (s.participants?.length || 0),
    0
  );
  const peakParticipants = sessions.reduce(
    (max, s) => Math.max(max, s.participants?.length || 0),
    0
  );

  const durations = sessions
    .map((s) => Number(s.duration))
    .filter((d) => d > 0);
  const avgDurationMinutes = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  return {
    totalSessions,
    liveSessions,
    endedSessions,
    scheduledSessions,
    byType: { learn: learnType, watch: watchType },
    automatedSessions,
    recordedSessions,
    paidSessions,
    totalParticipants,
    totalParticipantsNote:
      "Sum of participant array lengths per LiveSession document.",
    peakParticipants,
    avgDurationMinutes: Math.round(avgDurationMinutes * 100) / 100,
    avgDurationNote:
      "Average of scheduled duration field (minutes), not tracked LiveKit session length.",
    byVisibility: visibilityAgg.map((a) => ({ visibility: a._id || "public", count: a.count })),
    bySource: sourceAgg.map((a) => ({ source: a._id || "static", count: a.count })),
    last30DaysTrend: recentSessions.map((a) => ({ date: a._id, count: a.count })),
  };
}

//  PAUSE SESSION ANALYTICS 

async function getPauseSessionAnalytics() {
  const PauseContent = pauseContentModel();

  const [
    totalSessions,
    liveSessions,
    instantHangouts,
    recordedSessions,
    vibeTagAgg,
    recentSessions,
  ] = await Promise.all([
    PauseContent.countDocuments(),
    PauseContent.countDocuments({ isLive: true }),
    PauseContent.countDocuments({ isInstantHangout: true }),
    PauseContent.countDocuments({ recordingStatus: "completed" }),

    // by vibe tag
    PauseContent.aggregate([
      { $group: { _id: "$vibeTag", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // last 30 days trend
    PauseContent.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const sessions = await PauseContent.find({})
    .select("participantIds duration views")
    .lean();

  const totalParticipants = sessions.reduce(
    (sum, s) => sum + (s.participantIds?.length || 0),
    0
  );
  const peakParticipants = sessions.reduce(
    (max, s) => Math.max(max, s.participantIds?.length || 0),
    0
  );
  const totalViews = sessions.reduce(
    (sum, s) => sum + (Number(s.views) || 0),
    0
  );

  const durations = sessions
    .map((s) => Number(s.duration))
    .filter((d) => d > 0);
  const avgDurationMinutes = durations.length
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  return {
    totalSessions,
    liveSessions,
    instantHangouts,
    recordedSessions,
    totalParticipants,
    totalParticipantsNote:
      "Sum of participantIds array lengths per PauseContent document.",
    peakParticipants,
    totalViews,
    avgDurationMinutes: Math.round(avgDurationMinutes * 100) / 100,
    byVibeTag: vibeTagAgg.map((a) => ({ vibeTag: a._id || "none", count: a.count })),
    last30DaysTrend: recentSessions.map((a) => ({ date: a._id, count: a.count })),
  };
}

module.exports = {
  getWatchSessionAnalytics,
  getLiveSessionAnalytics,
  getPauseSessionAnalytics,
};