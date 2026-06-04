const userAn = require("../services/analyticsUserService");
const discAn = require("../services/analyticsDiscussionService");
const sessionAn = require("../services/analyticsSessionService"); 
const dashAn = require("../services/analyticsDashboardService");

exports.users = async (_req, res) => {
  res.json(await userAn.getUserAnalyticsSummary());
};

exports.discussions = async (_req, res) => {
  res.json(await discAn.getDiscussionAnalyticsSummary());
};

exports.watchSessions = async (_req, res) => {
  res.json(await sessionAn.getWatchSessionAnalytics());
};

exports.liveSessions = async (_req, res) => {
  res.json(await sessionAn.getLiveSessionAnalytics());
};

exports.pauseSessions = async (_req, res) => {
  res.json(await sessionAn.getPauseSessionAnalytics());
};

exports.dashboard = async (_req, res) => {
  res.json(await dashAn.getDashboardSummary());
};