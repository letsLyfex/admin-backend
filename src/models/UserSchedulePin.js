// src/models/UserSchedulePin.js

const mongoose = require("mongoose");

const userSchedulePinSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    roomId: String,
    roomType: String,
    title: String,
    startsAt: Date,
    endTime: Date,
  },
  {
    timestamps: true,
    collection: "userschedulepins",
  }
);

module.exports =
  mongoose.models.UserSchedulePin ||
  mongoose.model("UserSchedulePin", userSchedulePinSchema);