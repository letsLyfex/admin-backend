const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const d = require("../controllers/discussAdminController");

const router = express.Router();

router.use(attachAdmin);

router.get("/rooms", requirePermission("discussions.read"), asyncHandler(d.listRooms));

router.get("/reports", requirePermission("discussions.moderate"), asyncHandler(d.listReports));

router.patch(
  "/reports/:reportId",
  requirePermission("discussions.moderate"),
  asyncHandler(d.patchReport),
);

router.get("/room/:id", requirePermission("discussions.read"), asyncHandler(d.getRoom));

router.delete(
  "/room/:id",
  requirePermission("discussions.delete"),
  asyncHandler(d.deleteRoom),
);

router.patch(
  "/pin/:id",
  requirePermission("discussions.pin"),
  asyncHandler(d.pin),
);

router.patch(
  "/feature/:id",
  requirePermission("discussions.pin"),
  asyncHandler(d.feature),
);

module.exports = router;
