// src/models/PauseContent.js

const mongoose = require("mongoose");

const pauseContentSchema = new mongoose.Schema(
  {
    roomId: String,
    title: String,
    description: String,
    type: String,
    imageUrl: String,
    creatorId: mongoose.Schema.Types.ObjectId,
    sessionType: String,
    isLive: Boolean,
    isInstantHangout: Boolean,
    vibeTag: String,
    livekitRoomId: String,
    participantIds: [mongoose.Schema.Types.ObjectId],
    startsAt: Date,
    endTime: Date,
    startedAt: Date,
    duration: Number,
    views: Number,
    egressId: String,
    filePath: String,
    recordingStartedAt: Date,
    recordingStatus: String,
    recordingUrl: String,
  },
  {
    timestamps: true,
    collection: "pausecontents", // verify actual collection name
  }
);

module.exports = mongoose.model("PauseContent", pauseContentSchema);