const mongoose = require("mongoose");

const watchSessionSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    sessionType: { type: String, enum: ["watch"], default: "watch", index: true },
    isLive: { type: Boolean, default: false, index: true },
    subTags: [{ type: String }],
    thumbnailUrl: { type: String, default: "" },
    scheduleLink: { type: String, default: "" },
    contentUrl: { type: String, default: "" },
    date: { type: String, required: true },
    time: { type: String, required: true },
    duration: { type: Number, required: true }, // duration in minutes (1-60)
    startsAt: { type: Date },
    endTime: { type: Date, required: true },
    endTimeString: { type: String, default: "" },
    hostId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    visibility: {
      type: String,
      enum: ["public", "private", "pay_to_watch"],
      default: "public",
      index: true,
    },
    paymentAmount: { type: Number, default: 0 },
    paidParticipantIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    hasTiers: { type: Boolean, default: false },
    vipPaymentAmount: { type: Number, default: 0 },
    normalPaymentAmount: { type: Number, default: 0 },
    vipParticipantIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    bannedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    recordingStatus: { type: String, default: "not_started" },
    recordingUrl: { type: String, default: "" },
    speakQueue: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        name: { type: String, required: true },
        subscriptionPlan: { type: String, default: "VIEW" },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    activeSpeakerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    activeSpeakerName: { type: String, default: "" },
    language: { type: String, default: "en" },
    isAutomated: { type: Boolean, default: false },
    isDynamic: { type: Boolean, default: false, index: true },
    source: {
      type: String,
      enum: ["static", "news_ai", "ai_generated", "static_fallback"],
      default: "static",
    },
    status: { type: String, default: "scheduled" },
  },
  { timestamps: true, collection: "watchsessions" }
);

module.exports = mongoose.model("WatchSession", watchSessionSchema);
