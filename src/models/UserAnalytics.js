const mongoose = require("mongoose");


const userAnalyticsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    contextType: { type: String, required: true },
   
    analyticsJson: { type: String, default: "{}" },
  
    streakDays: { type: Number, default: 0 },
    lastStreakDate: { type: String, default: "" },
  },
  { timestamps: true, collection: "useranalytics" }
);

userAnalyticsSchema.index({ userId: 1, contextType: 1 }, { unique: true });

module.exports = mongoose.model("UserAnalytics", userAnalyticsSchema);
