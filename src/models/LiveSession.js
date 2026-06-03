const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, required: true },
    sessionType: {
      type: String,
      enum: ["learn", "watch"],
      default: "learn",
      index: true,
    },
    isLive: { type: Boolean, default: false, index: true },
    hostJoined: { type: Boolean, default: false },
    subTags: [{ type: String }],
    thumbnailUrl: { type: String, default: "" },
    scheduleLink: { type: String, default: "" },
    contentUrl: { type: String, default: "" },
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    date: { type: String },
    time: { type: String },
    duration: { type: Number, default: 60 },
    startsAt: { type: Date, default: null },
    endTime: { type: Date, default: null },
    endTimeString: { type: String, default: "" },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mediaAllowedUserIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    mediaBlockedUserIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
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
    status: { type: String, default: "scheduled" },
    firstJoinAt: { type: Date, default: null },
    egressId: { type: String, default: "" },
    filePath: { type: String, default: "" },
    recordingStatus: { type: String, default: "not_started" },
    recordingUrl: { type: String, default: "" },
    recordingAllowed: { type: Boolean, default: null }, // null: not decided, true: allowed, false: not allowed
    bannedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    language: { type: String, default: "en" },
    isAutomated: { type: Boolean, default: false },
    isDynamic: { type: Boolean, default: false, index: true },
    source: {
      type: String,
      enum: ["static", "news_ai", "ai_generated", "static_fallback"],
      default: "static",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("LiveSession", liveSessionSchema);
