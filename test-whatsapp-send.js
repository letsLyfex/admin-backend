/**
 * Quick Meta WhatsApp Cloud API test script.
 * Run: node test-whatsapp-send.js
 */

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env.example") });
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const { sendSingleWhatsApp, normalizePhoneNumber } = require("./src/services/whatsappService");

const TEST_PHONE = process.env.TEST_WHATSAPP_PHONE || "919876543210";
const TEMPLATE_NAME = process.env.TEST_WHATSAPP_TEMPLATE || "hello_world"; // Replace with your approved template name
const LANGUAGE_CODE = process.env.TEST_WHATSAPP_LANG || "en_US";

(async () => {
  console.log("=== Meta WhatsApp Test Script ===");
  console.log("Recipient:", TEST_PHONE);
  console.log("Template:", TEMPLATE_NAME);
  console.log("Language:", LANGUAGE_CODE);

  if (!process.env.META_ACCESS_TOKEN || !process.env.META_PHONE_NUMBER_ID) {
    console.error("Missing META_ACCESS_TOKEN or META_PHONE_NUMBER_ID in .env");
    process.exit(1);
  }

  try {
    const res = await sendSingleWhatsApp({
      to: normalizePhoneNumber(TEST_PHONE),
      templateName: TEMPLATE_NAME,
      languageCode: LANGUAGE_CODE,
      components: []
    });
    console.log("Success! Response:", JSON.stringify(res, null, 2));
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err.message);
    if (err.details) {
      console.error("Error details:", JSON.stringify(err.details, null, 2));
    }
  }
})();
