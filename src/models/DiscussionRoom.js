const mongoose = require("mongoose");

const discussionRoomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true },
    topic: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    sessionType: {
      type: String,
      enum: ["discuss"],
      default: "discuss",
      index: true,
    },
    isLive: { type: Boolean, default: false, index: true },
    hostJoined: { type: Boolean, default: false },
    subTags: [{ type: String }],
    thumbnailUrl: { type: String, default: "" },
    scheduleLink: { type: String, default: "" },
    contentUrl: { type: String, default: "" },
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
    date: { type: String, required: true },
    time: { type: String, required: true },
    duration: { type: Number, required: true }, // duration in minutes (e.g. 30)
    startsAt: { type: Date }, // scheduled start (same as date+time); used for join guard
    endTime: { type: Date, required: true }, // when room auto-ends (for cleanup & join guard)
    endTimeString: { type: String, default: "" }, // user-provided end time HH:mm
    hostId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    approvedParticipantIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    joinRequests: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        name: { type: String, required: true },
        email: { type: String, default: "" },
        requestedAt: { type: Date, default: Date.now },
      },
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
    egressId: { type: String, default: "", index: true },
    filePath: { type: String, default: "" },
    recordingStartedAt: { type: Date, default: null },
    recordingStatus: { type: String, default: "not_started" },
    recordingUrl: { type: String, default: "" },
    recordingAllowed: { type: Boolean, default: null }, // null: not decided, true: allowed, false: not allowed
    bannedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isAutomated: { type: Boolean, default: false },
    isDynamic: { type: Boolean, default: false, index: true },
    source: {
      type: String,
      enum: ["static", "news_ai", "ai_generated", "static_fallback"],
      default: "static",
    },
    language: { type: String, default: "en" },
    /** LiveKit Agents: dispatch AI voice bot at most once per discussion (set when token path triggers dispatch). */
    aiAgentDispatched: { type: Boolean, default: false },
    /** Host opted in at create time - Anupama 3D avatar, voice intro, @anupama chat. */
    enableAiAssistant: { type: Boolean, default: false, index: true },
    status: { type: String, default: "scheduled" },
  },
  { timestamps: true, collection: "discussionrooms" }
);

module.exports = mongoose.model("DiscussionRoom", discussionRoomSchema);
