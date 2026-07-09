const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const c = require("../controllers/paymentController");

router.use(attachAdmin);

router.get(
  "/",
  requirePermission("payments.view"),
  asyncHandler(c.listPayments)
);

router.get(
  "/stats",
  requirePermission("payments.view"),
  asyncHandler(c.getStats)
);

router.get(
  "/sessions",
  requirePermission("payments.view"),
  asyncHandler(c.getSessions)
);

router.get(
  "/user/:userId",
  requirePermission("payments.view"),
  asyncHandler(c.getUserPayments)
);

router.get(
  "/:id",
  requirePermission("payments.view"),
  asyncHandler(c.getPayment)
);

router.patch(
  "/:id/status",
  requirePermission("payments.edit"),
  asyncHandler(c.updateStatus)
);

module.exports = router;