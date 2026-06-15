const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const a = require("../controllers/analyticsController");

const router = express.Router();

router.use(attachAdmin);

router.get(
  "/dashboard",
  requirePermission("dashboard.view"),
  asyncHandler(a.dashboard)
);

router.get(
  "/users",
  requirePermission("analytics.view"),
  asyncHandler(a.users),
);

router.get(
  "/discussions",
  requirePermission("analytics.view"),
  asyncHandler(a.discussions),
);

router.get(
  "/watch",
  requirePermission("analytics.view"),
  asyncHandler(a.watchSessions)
);

router.get(
  "/live",
  requirePermission("analytics.view"),
  asyncHandler(a.liveSessions)
);

router.get(
  "/pause",
  requirePermission("analytics.view"),
  asyncHandler(a.pauseSessions)
);
module.exports = router;
