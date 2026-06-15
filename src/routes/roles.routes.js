const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");
const role = require("../controllers/roleController");

const router = express.Router();

router.use(attachAdmin);

router.get("/", requirePermission("roles.view"), asyncHandler(role.listRoles));
router.get("/permissions/catalog", requirePermission("roles.view"), asyncHandler(role.listPermissions));

router.post("/create", requirePermission("roles.manage"), asyncHandler(role.createRole));
router.patch("/:id", requirePermission("roles.manage"), asyncHandler(role.updateRole));
router.delete("/:id", requirePermission("roles.manage"), asyncHandler(role.deleteRole));

module.exports = router;
