const express = require("express");
const {
  sendWhatsAppPromotion,
  getWhatsAppPreview,
  sendTestWhatsApp
} = require("../controllers/whatsappController");
const { attachAdmin } = require("../middleware/attachAdmin");
const { requirePermission } = require("../middleware/requirePermission");

const router = express.Router();

router.use(attachAdmin);

router.get(
  "/preview",
  requirePermission("promotions.view"),
  getWhatsAppPreview
);

router.post(
  "/test",
  requirePermission("promotions.view"),
  sendTestWhatsApp
);

router.post(
  "/send",
  requirePermission("promotions.view"),
  sendWhatsAppPromotion
);

module.exports = router;
