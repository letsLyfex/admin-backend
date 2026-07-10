const mongoose = require("mongoose");
const competeSessionSchema = new mongoose.Schema(
  { topic: { type: String, default: "" } },
  { timestamps: true, collection: "competesessions" }
);
module.exports = mongoose.model("CompeteSession", competeSessionSchema);
