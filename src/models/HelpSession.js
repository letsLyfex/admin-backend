const mongoose = require("mongoose");
const helpSessionSchema = new mongoose.Schema(
  { topic: { type: String, default: "" } },
  { timestamps: true, collection: "helpsessions" }
);
module.exports = mongoose.model("HelpSession", helpSessionSchema);
