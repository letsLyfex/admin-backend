const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const c = require("../controllers/referralController");

router.use(attachAdmin);

router.get(
  "/",
  requirePermission("referrals.view"),
  asyncHandler(c.listWithdrawals)
);

router.get(
  "/stats",
  requirePermission("referrals.view"),
  asyncHandler(c.getStats)
);

router.get(
  "/user/:userId",
  requirePermission("referrals.view"),
  asyncHandler(c.getUserSummary)
);

router.get(
  "/:id",
  requirePermission("referrals.view"),
  asyncHandler(c.getWithdrawal)
);

router.patch(
  "/:id/status",
  requirePermission("referrals.edit"),
  asyncHandler(c.updateStatus)
);

module.exports = router;