const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const auth = require("../controllers/adminAuthController");
const crud = require("../controllers/adminCrudController");
const activity = require("../controllers/activityController");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();

router.post("/login", asyncHandler(auth.login));
router.post("/refresh-token", asyncHandler(auth.refresh));

router.use(attachAdmin);

router.post("/logout", asyncHandler(auth.logout));
router.get("/me", asyncHandler(auth.me));
router.patch("/profile", asyncHandler(auth.updateProfile));

router.get("/activity-logs", requirePermission("activity_logs.view"), asyncHandler(activity.list));

router.post("/create", requirePermission("admin_accounts.manage"), asyncHandler(crud.create));
router.get("/all", requirePermission("admin_accounts.view"), asyncHandler(crud.list));
router.patch("/update/:id", requirePermission("admin_accounts.manage"), asyncHandler(crud.update));
router.delete("/delete/:id", requirePermission("admin_accounts.manage"), asyncHandler(crud.remove));
router.patch("/suspend/:id", requirePermission("admin_accounts.manage"), asyncHandler(crud.suspend));

module.exports = router;
