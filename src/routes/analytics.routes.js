const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const a = require("../controllers/analyticsController");

const router = express.Router();

router.use(attachAdmin);

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

module.exports = router;
