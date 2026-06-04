const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const a = require("../controllers/analyticsController");

const router = express.Router();

router.use(attachAdmin);

router.get(
  "/dashboard",
  requirePermission("analytics.read"),
  asyncHandler(a.dashboard)
);

router.get(
  "/users",
  requirePermission("analytics.users"),
  asyncHandler(a.users),
);

router.get(
  "/discussions",
  requirePermission("analytics.discussions"),
  asyncHandler(a.discussions),
);

router.get(
  "/watch",
  requirePermission("analytics.read"),
  asyncHandler(a.watchSessions)
);

router.get(
  "/live",
  requirePermission("analytics.read"),
  asyncHandler(a.liveSessions)
);

router.get(
  "/pause",
  requirePermission("analytics.read"),
  asyncHandler(a.pauseSessions)
);
module.exports = router;
