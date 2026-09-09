const { sendSingleWhatsApp, sendBulkWhatsApp, normalizePhoneNumber } = require("../services/whatsappService");
const User = require("../models/User");
const ScheduledWhatsApp = require("../models/ScheduledWhatsApp");
const { asyncHandler } = require("../utils/asyncHandler");

/**
 * Format component array from structured payload if provided by frontend
 */
function formatTemplateComponents({ headerType, headerMediaUrl, headerText, bodyVariables, buttonParam }) {
  const components = [];

  // Header component
  if (headerType === "IMAGE" && headerMediaUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "image",
          image: { link: headerMediaUrl.trim() }
        }
      ]
    });
  } else if (headerType === "VIDEO" && headerMediaUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "video",
          video: { link: headerMediaUrl.trim() }
        }
      ]
    });
  } else if (headerType === "TEXT" && headerText) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "text",
          text: headerText.trim()
        }
      ]
    });
  } else if (headerType === "DOCUMENT" && headerMediaUrl) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: { link: headerMediaUrl.trim() }
        }
      ]
    });
  }

  // Body component with variable parameters
  if (Array.isArray(bodyVariables) && bodyVariables.length > 0) {
    const parameters = bodyVariables.map((val) => ({
      type: "text",
      text: String(val || "")
    }));

    components.push({
      type: "body",
      parameters
    });
  }

  // Button component (dynamic URL or payload)
  if (buttonParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [
        {
          type: "text",
          text: String(buttonParam).trim()
        }
      ]
    });
  }

  return components;
}

/**
 * Parse external phone list string or array
 */
function parseExternalPhones(externalPhones) {
  const list = [];
  if (!externalPhones) return list;

  if (typeof externalPhones === "string") {
    // Split by comma or newline
    const rawParts = externalPhones.split(/[\r\n,]+/);
    for (const part of rawParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle Name <+919876543210> format
      const match = trimmed.match(/^([^<]+)<([^>]+)>$/);
      if (match) {
        const cleanPhone = normalizePhoneNumber(match[2].trim());
        if (cleanPhone) {
          list.push({
            name: match[1].trim(),
            phone: cleanPhone
          });
        }
      } else {
        const cleanPhone = normalizePhoneNumber(trimmed);
        if (cleanPhone) {
          list.push({
            name: "",
            phone: cleanPhone
          });
        }
      }
    }
  } else if (Array.isArray(externalPhones)) {
    for (const item of externalPhones) {
      if (typeof item === "object" && item !== null) {
        const cleanPhone = normalizePhoneNumber(item.phone || item.mobile || "");
        if (cleanPhone) {
          list.push({
            name: String(item.name || item.fullName || "").trim(),
            phone: cleanPhone
          });
        }
      } else if (typeof item === "string") {
        const cleanPhone = normalizePhoneNumber(item);
        if (cleanPhone) {
          list.push({
            name: "",
            phone: cleanPhone
          });
        }
      }
    }
  }

  return list;
}

/**
 * Send a test WhatsApp message to an admin-supplied number
 */
const sendTestWhatsApp = asyncHandler(async (req, res) => {
  const { testPhone, templateName, languageCode = "en_US", components, headerType, headerMediaUrl, headerText, bodyVariables, buttonParam } = req.body;

  if (!testPhone) {
    return res.status(400).json({ success: false, message: "Test phone number is required." });
  }

  if (!templateName) {
    return res.status(400).json({ success: false, message: "Template name is required." });
  }

  const cleanPhone = normalizePhoneNumber(testPhone);
  if (!cleanPhone) {
    return res.status(400).json({ success: false, message: "Invalid test phone number format." });
  }

  let finalComponents = components;
  if (!finalComponents || !Array.isArray(finalComponents) || finalComponents.length === 0) {
    finalComponents = formatTemplateComponents({
      headerType,
      headerMediaUrl,
      headerText,
      bodyVariables,
      buttonParam
    });
  }

  try {
    const result = await sendSingleWhatsApp({
      to: cleanPhone,
      templateName,
      languageCode,
      components: finalComponents
    });

    return res.json({
      success: true,
      message: `Test WhatsApp message sent successfully to ${cleanPhone}.`,
      data: result
    });
  } catch (error) {
    console.error("[whatsappController] Test send failed:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to send test WhatsApp message.",
      details: error.details || null
    });
  }
});

/**
 * Preview eligible registered users with valid phone numbers
 */
const getWhatsAppPreview = asyncHandler(async (req, res) => {
  const { targetGroup } = req.query;

  const query = {
    deletedAt: null,
    phone: { $exists: true, $ne: "" }
  };

  if (targetGroup === "recurring") {
    query.isManual = { $ne: true };
  } else if (targetGroup === "non-recurring") {
    query.isManual = true;
  }

  const users = await User.find(query).select("fullName email phone isManual").lean();

  const validUsers = [];
  for (const u of users) {
    const cleanPhone = normalizePhoneNumber(u.phone);
    if (cleanPhone) {
      validUsers.push({
        id: u._id,
        fullName: u.fullName || "",
        email: u.email || "",
        phone: u.phone,
        normalizedPhone: cleanPhone,
        isManual: u.isManual
      });
    }
  }

  res.json({
    success: true,
    count: validUsers.length,
    users: validUsers
  });
});

/**
 * Send bulk WhatsApp campaign or schedule it
 */
const sendWhatsAppPromotion = asyncHandler(async (req, res) => {
  const {
    templateName,
    languageCode = "en_US",
    campaignTitle,
    targetGroup = "all",
    sendToExternalOnly,
    externalPhones,
    excludedPhones = [],
    components,
    headerType,
    headerMediaUrl,
    headerText,
    bodyVariables,
    buttonParam,
    dripDelivery,
    messagesPerHour,
    scheduleTime
  } = req.body;

  if (!templateName || !templateName.trim()) {
    return res.status(400).json({ success: false, message: "Template name is required." });
  }

  // 1. Build template components
  let finalComponents = components;
  if (!finalComponents || !Array.isArray(finalComponents) || finalComponents.length === 0) {
    finalComponents = formatTemplateComponents({
      headerType,
      headerMediaUrl,
      headerText,
      bodyVariables,
      buttonParam
    });
  }

  // 2. Fetch registered users with valid phone numbers
  let registeredRecipients = [];
  const isExternalOnly = sendToExternalOnly === true || sendToExternalOnly === "true";

  if (!isExternalOnly) {
    const query = {
      deletedAt: null,
      phone: { $exists: true, $ne: "" }
    };

    if (targetGroup === "recurring") {
      query.isManual = { $ne: true };
    } else if (targetGroup === "non-recurring") {
      query.isManual = true;
    }

    const users = await User.find(query).select("fullName email phone").lean();
    for (const u of users) {
      const cleanPhone = normalizePhoneNumber(u.phone);
      if (cleanPhone) {
        registeredRecipients.push({
          name: (u.fullName || "").trim(),
          email: (u.email || "").trim(),
          phone: cleanPhone
        });
      }
    }
  }

  // 3. Process external phone list
  const externalList = parseExternalPhones(externalPhones);

  // 4. Combine & deduplicate by normalized phone number
  const recipientsMap = new Map();
  if (!isExternalOnly) {
    for (const r of registeredRecipients) {
      recipientsMap.set(r.phone, r);
    }
  }
  for (const r of externalList) {
    recipientsMap.set(r.phone, r);
  }

  // 5. Exclude locally excluded phone numbers
  const excludedSet = new Set(
    (excludedPhones || []).map((p) => normalizePhoneNumber(p)).filter(Boolean)
  );

  const allRecipients = Array.from(recipientsMap.values()).filter(
    (r) => !excludedSet.has(r.phone)
  );

  if (allRecipients.length === 0) {
    return res.status(400).json({
      success: false,
      message: "No valid recipients with phone numbers found."
    });
  }

  // 6. Handle future scheduling
  const isScheduledFuture = scheduleTime && new Date(scheduleTime).getTime() > Date.now();

  if (isScheduledFuture) {
    const batchSize = dripDelivery && messagesPerHour && messagesPerHour > 0 ? Number(messagesPerHour) : allRecipients.length;

    await ScheduledWhatsApp.create({
      templateName: templateName.trim(),
      languageCode: languageCode.trim(),
      components: finalComponents,
      pendingRecipients: allRecipients,
      messagesPerHour: batchSize,
      status: "active",
      nextRunAt: new Date(scheduleTime),
      campaignTitle: campaignTitle || templateName
    });

    return res.json({
      success: true,
      message: `WhatsApp campaign scheduled for ${new Date(scheduleTime).toLocaleString()}. ${allRecipients.length} messages queued.`,
      data: {
        totalRecipients: allRecipients.length,
        scheduledFor: scheduleTime
      }
    });
  } else if (dripDelivery && messagesPerHour && messagesPerHour > 0) {
    // Drip delivery mode: send initial batch now, queue remaining
    const batchSize = Number(messagesPerHour);
    const initialBatch = allRecipients.slice(0, batchSize);
    const remaining = allRecipients.slice(batchSize);

    let successCount = 0;
    let failureCount = 0;

    if (initialBatch.length > 0) {
      const result = await sendBulkWhatsApp(
        initialBatch,
        templateName.trim(),
        languageCode.trim(),
        finalComponents
      );
      successCount = result.successCount;
      failureCount = result.failureCount;
    }

    if (remaining.length > 0) {
      await ScheduledWhatsApp.create({
        templateName: templateName.trim(),
        languageCode: languageCode.trim(),
        components: finalComponents,
        pendingRecipients: remaining,
        messagesPerHour: batchSize,
        status: "active",
        nextRunAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        campaignTitle: campaignTitle || templateName
      });
    }

    return res.json({
      success: true,
      message: `WhatsApp campaign started in drip mode. Sent ${initialBatch.length} immediately. ${remaining.length} scheduled.`,
      data: {
        totalRecipients: allRecipients.length,
        initialBatchSent: initialBatch.length,
        scheduledRemaining: remaining.length,
        successCount,
        failureCount
      }
    });
  } else {
    // Normal immediate mass delivery
    const result = await sendBulkWhatsApp(
      allRecipients,
      templateName.trim(),
      languageCode.trim(),
      finalComponents
    );

    return res.json({
      success: true,
      message: `WhatsApp campaign sent. Success: ${result.successCount}, Failed: ${result.failureCount}`,
      data: {
        totalRecipients: allRecipients.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
        errors: result.errors
      }
    });
  }
});

module.exports = {
  sendTestWhatsApp,
  getWhatsAppPreview,
  sendWhatsAppPromotion
};
