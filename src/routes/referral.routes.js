const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const c = require("../controllers/referralController");

router.use(attachAdmin);

router.get(
  "/",
  requirePermission("referrals.read"),
  asyncHandler(c.listWithdrawals)
);

router.get(
  "/stats",
  requirePermission("referrals.read"),
  asyncHandler(c.getStats)
);

router.get(
  "/user/:userId",
  requirePermission("referrals.read"),
  asyncHandler(c.getUserSummary)
);

router.get(
  "/:id",
  requirePermission("referrals.read"),
  asyncHandler(c.getWithdrawal)
);

router.patch(
  "/:id/status",
  requirePermission("referrals.manage"),
  asyncHandler(c.updateStatus)
);

module.exports = router;