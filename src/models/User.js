const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
{
  fullName: String,
  email: String,
  password: String,
  phone: String,

  subscriptionPlan: {
    type: String,
    enum: ["VIEW", "TALK", "CONTRIBUTE"],
    default: "VIEW",
  },

  isOnline: Boolean,
  lastActiveAt: Date,

  // Admin fields
  isBlocked: {
    type: Boolean,
    default: false,
  },

  blockedReason: {
    type: String,
    default: "",
  },

  isSuspended: {
    type: Boolean,
    default: false,
  },

  suspendedUntil: {
    type: Date,
    default: null,
  },

  deletedAt: {
    type: Date,
    default: null,
  },

  contributorVerifiedAt: {
    type: Date,
    default: null,
  },

  contributorBadge: {
    type: Boolean,
    default: false,
  },

  contributorBadgeAssignedAt: {
    type: Date,
    default: null,
  },
},
{ timestamps: true }
);

module.exports = mongoose.model("User", userSchema);