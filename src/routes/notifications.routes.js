const express = require("express");
const router = express.Router();
const { asyncHandler } = require("../utils/asyncHandler");
const { attachAdmin } = require("../middleware/attachAdmin");
const { getNotifications } = require("../services/notificationService");

router.use(attachAdmin);

router.get("/", asyncHandler(async (req, res) => {
  res.json(await getNotifications());
}));

module.exports = router;
