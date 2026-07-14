const mongoose = require("mongoose");

const scheduledPromotionSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    htmlContent: { type: String, required: true },
    pendingRecipients: { type: [mongoose.Schema.Types.Mixed], default: [] },
    emailsPerHour: { type: Number, required: true },
    status: { type: String, enum: ["active", "completed", "failed"], default: "active" },
    nextRunAt: { type: Date, required: true },
    senderName: { type: String },
  },
  { timestamps: true, collection: "scheduledPromotions" }
);

module.exports = mongoose.model("ScheduledPromotion", scheduledPromotionSchema);
