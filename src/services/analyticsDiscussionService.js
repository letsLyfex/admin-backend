const UserAnalytics = require("../models/UserAnalytics");
const MeetingMessage = require("../models/MeetingMessage");
const DiscussionRoom = require("../models/DiscussionRoom");
const SavedDiscussionRecording = require("../models/SavedDiscussionRecording");
const DiscussionReport = require("../models/DiscussionReport"); // ADD THIS

async function getDiscussionAnalyticsSummary() {
  const now = new Date();

  const [rooms, messageCount, recordingsCount, totalReports, pendingReports, resolvedReports] =
    await Promise.all([
      DiscussionRoom.find({})
        .select("participants duration endTime startsAt topic isLive")
        .lean(),
      MeetingMessage.countDocuments({ roomType: "discussion" }),
      SavedDiscussionRecording.countDocuments({}),
      DiscussionReport.countDocuments({}),
      DiscussionReport.countDocuments({ status: "pending" }),
      DiscussionReport.countDocuments({ status: "resolved" }),
    ]);

  const totalRooms = rooms.length;

  const liveNow   = rooms.filter(r =>  r.isLive === true || r.status === "live").length;
  const ended     = rooms.filter(r => r.status === "ended" || (r.endTime != null && new Date(r.endTime) <= now && !r.isLive)).length;
  const scheduled = totalRooms - liveNow - ended;

  const byStatus = [
    { label: "Live",      value: liveNow },
    { label: "Ended",     value: ended },
    { label: "Scheduled", value: scheduled },
  ];

  const participantSets = rooms.map(r => new Set((r.participants || []).map(x => String(x))));
  const totalParticipants = participantSets.reduce((s, set) => s + set.size, 0);
  const peakUsers = participantSets.reduce((m, set) => Math.max(m, set.size), 0);

  const durationsMin = rooms
    .map(r => (Number(r.duration) > 0 ? Number(r.duration) : null))
    .filter(Boolean);
  const avgRoomDurationMinutes = durationsMin.length
    ? durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length
    : 0;

  // --- Engagement ---
  let engagementRate = 0;
  if (totalRooms > 0) {
    const withChat = await MeetingMessage.distinct("roomId", { roomType: "discussion" });
    engagementRate = Math.min(1, withChat.length / totalRooms);
  }

  const avgMessagesPerRoom = totalRooms > 0 ? Math.round(messageCount / totalRooms) : 0;
  const speakingTimeMinutesProxy = Math.round(
    (avgRoomDurationMinutes * peakUsers) / Math.max(totalRooms, 1)
  );

  return {
    // Rooms
    totalRooms,
    liveNow,
    liveRooms: liveNow,
    ended,
    endedRooms: ended,
    scheduled,
    scheduledRooms: scheduled,
    byStatus,

    // Reports
    totalReports,
    pendingReports,
    resolvedReports,

    // Participants
    totalParticipants,
    peakUsers,
    avgRoomDurationMinutes: Math.round(avgRoomDurationMinutes * 100) / 100,
    messageCount,
    avgMessagesPerRoom,
    recordingsCount,
    speakingTimeMinutesProxy,
    engagementRate: Math.round(engagementRate * 10000) / 10000,
  };
}

module.exports = { getDiscussionAnalyticsSummary };