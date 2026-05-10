const { listLogs } = require("../services/activityLogQueryService");

exports.list = async (req, res) => {
  res.json(await listLogs(req.query));
};
