const mongoose = require("mongoose");

const scheduledWhatsAppSchema = new mongoose.Schema(
  {
    templateName: { type: String, required: true },
    languageCode: { type: String, default: "en_US" },
    components: { type: [mongoose.Schema.Types.Mixed], default: [] },
    pendingRecipients: { type: [mongoose.Schema.Types.Mixed], default: [] },
    messagesPerHour: { type: Number, required: true },
    status: { type: String, enum: ["active", "completed", "failed"], default: "active" },
    nextRunAt: { type: Date, required: true },
    campaignTitle: { type: String, default: "" },
  },
  { timestamps: true, collection: "scheduledWhatsApp" }
);

module.exports = mongoose.model("ScheduledWhatsApp", scheduledWhatsAppSchema);
