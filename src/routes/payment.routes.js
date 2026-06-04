const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const c = require("../controllers/paymentController");

router.use(attachAdmin);

router.get(
  "/",
  requirePermission("payments.read"),
  asyncHandler(c.listPayments)
);

router.get(
  "/stats",
  requirePermission("payments.read"),
  asyncHandler(c.getStats)
);

router.get(
  "/user/:userId",
  requirePermission("payments.read"),
  asyncHandler(c.getUserPayments)
);

router.get(
  "/:id",
  requirePermission("payments.read"),
  asyncHandler(c.getPayment)
);

router.patch(
  "/:id/status",
  requirePermission("payments.manage"),
  asyncHandler(c.updateStatus)
);

module.exports = router;