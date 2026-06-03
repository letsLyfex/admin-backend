const mongoose = require("mongoose");

const meetingMessageSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    roomType: {
      type: String,
      enum: ["discussion", "live", "support", "pause", "watch"],
      required: true,
      index: true,
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 1200 },
  },
  { timestamps: true }
);

meetingMessageSchema.index({ roomId: 1, roomType: 1, createdAt: 1 });

module.exports = mongoose.model("MeetingMessage", meetingMessageSchema);

