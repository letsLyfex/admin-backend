const fetch = global.fetch; // Node 18+ native fetch
const User = require("../models/User");

/**
 * Normalizes phone numbers to Meta WhatsApp international format (digits only, no + or spaces).
 * Example: "+91 98765-43210" -> "919876543210"
 */
function normalizePhoneNumber(raw) {
  if (!raw) return "";
  let cleaned = String(raw).replace(/[^\d]/g, "").trim();

  // If 10 digits and starts with 6,7,8,9 (standard Indian mobile), prepend 91 default if no country code
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    cleaned = `91${cleaned}`;
  }

  // Standard E.164 without plus ranges from 10 to 15 digits
  if (cleaned.length < 10 || cleaned.length > 15) {
    return "";
  }

  return cleaned;
}

/**
 * Build component parameters for a recipient, replacing dynamic placeholders like {{name}}.
 */
function buildRecipientComponents(baseComponents = [], recipient = {}) {
  const recipientName = (recipient.name || recipient.fullName || "Customer").trim();
  
  return baseComponents.map(comp => {
    if (!comp || !comp.parameters) return comp;

    const updatedParams = comp.parameters.map(param => {
      if (param.type === "text" && typeof param.text === "string") {
        let textVal = param.text;
        textVal = textVal.replace(/\{\{\s*name\s*\}\}/gi, recipientName);
        textVal = textVal.replace(/\{\{\s*phone\s*\}\}/gi, recipient.phone || "");
        textVal = textVal.replace(/\{\{\s*email\s*\}\}/gi, recipient.email || "");
        return { ...param, text: textVal };
      }
      return param;
    });

    return {
      ...comp,
      parameters: updatedParams
    };
  });
}

/**
 * Send a single WhatsApp template message via Meta Cloud API.
 */
async function sendSingleWhatsApp({ to, templateName, languageCode = "en_US", components = [] }) {
  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_API_VERSION || "v20.0";

  if (!accessToken || !phoneNumberId) {
    throw new Error("META_ACCESS_TOKEN or META_PHONE_NUMBER_ID is missing in environment variables.");
  }

  const cleanPhone = normalizePhoneNumber(to);
  if (!cleanPhone) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "template",
    template: {
      name: templateName.trim(),
      language: {
        code: languageCode.trim()
      }
    }
  };

  if (Array.isArray(components) && components.length > 0) {
    payload.template.components = components;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const responseData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = responseData?.error?.message || responseData?.error?.error_user_msg || `Meta API Error (${response.status})`;
    const err = new Error(errorMsg);
    err.details = responseData?.error;
    err.status = response.status;
    throw err;
  }

  return responseData;
}

/**
 * Bulk send WhatsApp template messages with rate limiting and throttling.
 * @param {Array<{phone: string, name?: string, email?: string}>} recipients
 * @param {string} templateName
 * @param {string} languageCode
 * @param {Array} baseComponents
 * @param {number} delayBetweenMs - Delay in ms between individual messages to respect Meta rate limits
 */
async function sendBulkWhatsApp(recipients = [], templateName, languageCode = "en_US", baseComponents = [], delayBetweenMs = 60) {
  if (!recipients || recipients.length === 0) {
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  let successCount = 0;
  let failureCount = 0;
  const errors = [];

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const rawPhone = typeof r === "string" ? r : (r.phone || r.mobile || "");
    const cleanPhone = normalizePhoneNumber(rawPhone);

    if (!cleanPhone) {
      failureCount++;
      if (errors.length < 10) {
        errors.push({ phone: rawPhone, error: "Invalid phone number format" });
      }
      continue;
    }

    const recipientObj = typeof r === "object" && r !== null ? r : { phone: cleanPhone, name: "" };
    const personalizedComponents = buildRecipientComponents(baseComponents, recipientObj);

    try {
      await sendSingleWhatsApp({
        to: cleanPhone,
        templateName,
        languageCode,
        components: personalizedComponents
      });
      successCount++;
    } catch (err) {
      failureCount++;
      console.error(`[whatsappService] Failed to send to ${cleanPhone}:`, err.message);
      if (errors.length < 10) {
        errors.push({ phone: cleanPhone, error: err.message });
      }
    }

    // Small delay between sends to prevent burst limits
    if (delayBetweenMs > 0 && i < recipients.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenMs));
    }
  }

  return {
    successCount,
    failureCount,
    total: recipients.length,
    errors
  };
}

module.exports = {
  normalizePhoneNumber,
  buildRecipientComponents,
  sendSingleWhatsApp,
  sendBulkWhatsApp
};
