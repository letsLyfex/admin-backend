const mongoose = require("mongoose");

/**
 * Dedicated admin identities (never mixed with User collection).
 * Index email unique; partial index suggested for suspended flag in analytics queries.
 */
const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },
    isSuspended: { type: Boolean, default: false, index: true },
    suspendedReason: { type: String, default: "", maxlength: 500 },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: "", maxlength: 64 },
    refreshTokenVersion: { type: Number, default: 0 },
    createdByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

adminSchema.index({ createdAt: -1 });
adminSchema.index({ isSuspended: 1, email: 1 });

module.exports = mongoose.models.Admin || mongoose.model("Admin", adminSchema);
