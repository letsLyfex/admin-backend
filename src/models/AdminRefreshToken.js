const mongoose = require("mongoose");
const crypto = require("crypto");

function hashToken(raw) {
  return crypto.createHash("sha256").update(String(raw)).digest("hex");
}

const adminRefreshTokenSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    ipAddress: { type: String, default: "", maxlength: 64 },
    userAgent: { type: String, default: "", maxlength: 512 },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminRefreshTokenSchema.index({ adminId: 1, expiresAt: 1 });

adminRefreshTokenSchema.statics.hashToken = hashToken;

module.exports =
  mongoose.models.AdminRefreshToken ||
  mongoose.model("AdminRefreshToken", adminRefreshTokenSchema);
module.exports.hashRefreshToken = hashToken;
