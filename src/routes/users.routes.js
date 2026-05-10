const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const u = require("../controllers/userMgmtController");

const router = express.Router();

router.use(attachAdmin);

router.get("/", requirePermission("users.read"), asyncHandler(u.list));

router.patch(
  "/block/:id",
  requirePermission("users.block"),
  asyncHandler(u.block),
);

router.patch(
  "/suspend/:id",
  requirePermission("users.suspend"),
  asyncHandler(u.suspend),
);

router.patch(
  "/assign-badge/:id",
  requirePermission("users.verify_contributor"),
  asyncHandler(u.assignBadge),
);

router.patch("/reset/:id", requirePermission("users.write"), asyncHandler(u.resetAccount));

router.delete("/:id", requirePermission("users.delete"), asyncHandler(u.remove));

router.patch(
  "/verify-contributor/:id",
  requirePermission("users.verify_contributor"),
  asyncHandler(u.verifyContributor),
);

router.get("/:id", requirePermission("users.read"), asyncHandler(u.getOne));

module.exports = router;
