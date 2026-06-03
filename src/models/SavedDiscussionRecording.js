// src/models/SavedDiscussionRecording.js

const mongoose = require("mongoose");

const savedDiscussionRecordingSchema = new mongoose.Schema(
  {
    roomId: String,
    recordingUrl: String,
    category: String,
    topic: String,
    description: String,
    hostId: mongoose.Schema.Types.ObjectId,
    date: String,
    time: String,
    recordingDurationMinutes: Number,
    roomDurationMinutes: Number,
  },
  {
    timestamps: true,
    collection: "saveddiscussionrecordings", // verify collection name
  }
);

module.exports = mongoose.model(
  "SavedDiscussionRecording",
  savedDiscussionRecordingSchema
);