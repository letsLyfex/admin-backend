const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const d = require("../controllers/discussAdminController");

const router = express.Router();

router.use(attachAdmin);

router.get("/stats", requirePermission("sessions.view"), asyncHandler(d.getStats));
router.get("/rooms", requirePermission("sessions.view"), asyncHandler(d.listRooms));

router.get("/reports", requirePermission("sessions.moderate"), asyncHandler(d.listReports));

router.patch(
  "/reports/:reportId",
  requirePermission("sessions.moderate"),
  asyncHandler(d.patchReport),
);

router.get("/room/:id", requirePermission("sessions.view"), asyncHandler(d.getRoom));

router.delete(
  "/room/:id",
  requirePermission("sessions.delete"),
  asyncHandler(d.deleteRoom),
);

router.patch(
  "/pin/:id",
  requirePermission("sessions.pin"),
  asyncHandler(d.pin),
);

router.patch(
  "/feature/:id",
  requirePermission("sessions.feature"),
  asyncHandler(d.feature),
);

module.exports = router;
