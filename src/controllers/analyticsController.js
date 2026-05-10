const userAn = require("../services/analyticsUserService");
const discAn = require("../services/analyticsDiscussionService");

exports.users = async (_req, res) => {
  res.json(await userAn.getUserAnalyticsSummary());
};

exports.discussions = async (_req, res) => {
  res.json(await discAn.getDiscussionAnalyticsSummary());
};
