const mongoose = require("mongoose");

const referralWithdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "rejected"],
      default: "pending",
      index: true,
    },
    reason: {
      type: String,
      enum: ["session_access", "withdrawal", "bonus", "refund"],
      default: "withdrawal",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "referralwithdrawals",
  }
);

module.exports = mongoose.model(
  "ReferralWithdrawal",
  referralWithdrawalSchema
);