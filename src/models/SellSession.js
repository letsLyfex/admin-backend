const mongoose = require("mongoose");
const sellSessionSchema = new mongoose.Schema(
  { productName: { type: String, default: "" } },
  { timestamps: true, collection: "sellsessions" }
);
module.exports = mongoose.model("SellSession", sellSessionSchema);
