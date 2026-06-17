const mongoose = require("mongoose");

const unsubscribedEmailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
  },
  { timestamps: true, collection: "unsubscribedEmails" }
);

module.exports = mongoose.model("UnsubscribedEmail", unsubscribedEmailSchema);
