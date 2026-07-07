const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["subscription", "session_access"],
      required: true,
      index: true,
    },
    // Razorpay fields
    razorpayOrderId: { type: String, default: "", index: true },
    razorpayPaymentId: { type: String, default: "", index: true },
    razorpaySignature: { type: String, default: "" },

    // Payment details
    amount: { type: Number, required: true }, // in rupees
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["created", "paid", "failed", "refunded"],
      default: "created",
      index: true,
    },

    // For subscription payments
    plan: {
      type: String,
      enum: ["VIEW", "CONTRIBUTE", null],
      default: null,
    },
    subscriptionExpiresAt: { type: Date, default: null },

    // For session access payments
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    sessionType: {
      type: String,
      enum: ["watch", "live", "pause", "discussion", "sell", "compete", null],
      default: null,
    },

    // Tier
    tier: {
      type: String,
      enum: ["vip", "normal", null],
      default: null,
    },

    // Meta
    note: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "payments",
  }
);

module.exports = mongoose.model("Payment", paymentSchema);