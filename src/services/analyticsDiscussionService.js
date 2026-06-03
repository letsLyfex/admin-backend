const UserAnalytics = require("../models/UserAnalytics");
const MeetingMessage = require("../models/MeetingMessage");
const DiscussionRoom = require("../models/DiscussionRoom");
const SavedDiscussionRecording = require("../models/SavedDiscussionRecording");
function discussionRoomModel() {
  return DiscussionRoom;
}
function meetingMessageModel() {
  return MeetingMessage;
}
function savedDiscussionRecordingModel() {
  return SavedDiscussionRecording;
}

/**
 * Aggregated discussion metrics (some fields are proxies where product telemetry is not persisted).
 */
async function getDiscussionAnalyticsSummary() {
  const DiscussionRoom = discussionRoomModel();
  const MeetingMessage = meetingMessageModel();
  const SavedDiscussionRecording = savedDiscussionRecordingModel();

  const rooms = await DiscussionRoom.find({})
    .select("participants duration endTime startsAt topic isLive")
    .lean();

  const totalRooms = rooms.length;
  const participantSets = rooms.map((r) => new Set((r.participants || []).map((x) => String(x))));
  const totalParticipants = participantSets.reduce((s, set) => s + set.size, 0);

  const peakUsers = participantSets.reduce((m, set) => Math.max(m, set.size), 0);

  const durationsMin = rooms
    .map((r) => (Number(r.duration) > 0 ? Number(r.duration) : null))
    .filter(Boolean);
  const avgRoomDurationMinutes = durationsMin.length
    ? durationsMin.reduce((a, b) => a + b, 0) / durationsMin.length
    : 0;

  const [messageCount] = await Promise.all([
    MeetingMessage.countDocuments({ roomType: "discussion" }),
  ]);

  let speakingTimeMinutesProxy = Math.round((avgRoomDurationMinutes * peakUsers) / Math.max(totalRooms, 1));

  let engagementRate = 0;
  if (totalRooms > 0) {
    const withChat = await MeetingMessage.distinct("roomId", { roomType: "discussion" });
    engagementRate = Math.min(1, withChat.length / totalRooms);
  }

  const recordingsCount = await SavedDiscussionRecording.countDocuments({});

  const avgMessagesPerRoom =
    totalRooms > 0 ? Math.round(messageCount / totalRooms) : 0;

  return {
    totalRooms,
    totalParticipantsUniqueNote:
      "Sum of participant array lengths per room document (Mongo-stored roster; may overlap across rooms).",
    totalParticipants,
    avgRoomDurationMinutes: Math.round(avgRoomDurationMinutes * 100) / 100,
    avgSessionDurationNote:
      "Uses scheduled discussion duration field (minutes), not tracked LiveKit session length.",
    peakUsers,
    peakUsersNote: "Maximum participants roster size on any single DiscussionRoom row.",
    messageCount,
    avgMessagesPerRoom,
    recordingsCount,
    speakingTimeMinutesProxy,
    speakingTimeNote:
      "(avgScheduledDuration * peakUsers) / totalRooms — rough proxy until per-participant speech telemetry exists.",
    engagementRate: Math.round(engagementRate * 10000) / 10000,
    engagementRateNote: "Rooms with ≥1 persisted chat message (MeetingMessage.discussion) / totalRooms.",
  };
}

module.exports = { getDiscussionAnalyticsSummary };
