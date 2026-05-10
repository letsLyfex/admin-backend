const mongoose = require("mongoose");

/**
 * Audit trail for admin actions.
 * Recommended TTL index in production: { createdAt: 1 } expireAfterSeconds (e.g. 180d) — add via ops when ready.
 */
const adminActivityLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
      index: true,
    },
    action: { type: String, required: true, trim: true, maxlength: 120, index: true },
    targetType: { type: String, default: "", trim: true, maxlength: 64, index: true },
    targetId: { type: String, default: "", trim: true, maxlength: 64, index: true },
    ipAddress: { type: String, default: "", trim: true, maxlength: 64 },
    userAgent: { type: String, default: "", maxlength: 512 },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminActivityLogSchema.index({ adminId: 1, createdAt: -1 });
adminActivityLogSchema.index({ action: 1, createdAt: -1 });
adminActivityLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports =
  mongoose.models.AdminActivityLog ||
  mongoose.model("AdminActivityLog", adminActivityLogSchema);
