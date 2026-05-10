const mongoose = require("mongoose");

/**
 * Future-facing report queue (populate when mobile/web submit flows exist).
 * Index for moderator dashboards by status + recency.
 */
const discussionReportSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, trim: true, index: true },
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    reason: { type: String, default: "", trim: true, maxlength: 800 },
    details: { type: String, default: "", maxlength: 2000 },
    status: {
      type: String,
      enum: ["pending", "reviewing", "dismissed", "action_taken"],
      default: "pending",
      index: true,
    },
    adminNote: { type: String, default: "", maxlength: 1000 },
    handledByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

discussionReportSchema.index({ status: 1, createdAt: -1 });
discussionReportSchema.index({ reportedUserId: 1, createdAt: -1 });

module.exports =
  mongoose.models.DiscussionReport ||
  mongoose.model("DiscussionReport", discussionReportSchema);
