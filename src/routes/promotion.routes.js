const express = require("express");
const { sendPromotion, unsubscribe, resubscribe, getUnsubscribedUsers } = require("../controllers/promotionController");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();

// Public route
router.get("/unsubscribe", unsubscribe);
router.post("/unsubscribe", unsubscribe);
router.get("/resubscribe", resubscribe);

// Protected routes
router.use(attachAdmin);

router.get(
  "/unsubscribed",
  requirePermission("promotions.view"),
  getUnsubscribedUsers
);

router.post(
  "/send",
  requirePermission("promotions.view"),
  sendPromotion
);

module.exports = router;
