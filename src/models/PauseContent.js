const mongoose = require("mongoose");

const pauseContentSchema = new mongoose.Schema(
  {
    roomId: { type: String, default: "" },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    type: { type: String, default: "pause" },
    imageUrl: { type: String, default: "" },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionType: { type: String, default: "pause" },
    isLive: { type: Boolean, default: false },
    isInstantHangout: { type: Boolean, default: false },
    vibeTag: { type: String, default: "" },
    livekitRoomId: { type: String, default: "" },
    participantIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    startsAt: { type: Date, default: null },
    endTime: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    duration: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    egressId: { type: String, default: "" },
    filePath: { type: String, default: "" },
    recordingStartedAt: { type: Date, default: null },
    recordingStatus: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "failed"],
      default: "not_started",
    },
    recordingUrl: { type: String, default: "" },
  },
  { timestamps: true, collection: "pausecontents" }
);

module.exports = mongoose.model("PauseContent", pauseContentSchema);