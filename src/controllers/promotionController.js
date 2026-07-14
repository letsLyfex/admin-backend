const { sendPromotionalEmail } = require("../services/emailService");
const User = require("../models/User");
const UnsubscribedEmail = require("../models/UnsubscribedEmail");
const ScheduledPromotion = require("../models/ScheduledPromotion");
const { asyncHandler } = require("../utils/asyncHandler");
const ejs = require("ejs");
const path = require("path");

const sendPromotion = asyncHandler(async (req, res) => {
  const { subject, htmlContent, externalEmails, templateType, templateData, dripDelivery, emailsPerHour, scheduleTime, sendToExternalOnly, targetGroup, excludedEmails, senderName } = req.body;

  let finalHtml = htmlContent;

  if (templateType === "session") {
    if (!templateData || !templateData.sessionTitle || !templateData.sessionLink) {
      return res.status(400).json({ success: false, message: "Missing required template data." });
    }
    
    // Add default backend URL for the unsubscribe link and logo inside EJS
    let backendUrl = process.env.APP_PUBLIC_URL || process.env.ADMIN_BACKEND_URL || "http://localhost:4100";
    if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);
    templateData.backendUrl = backendUrl;
    templateData.unsubscribeUrl = `${backendUrl}/promotions/unsubscribe?email={{params.USER_EMAIL}}`;
    
    const templatePath = path.join(__dirname, "../templates/sessionPromotion.ejs");
    finalHtml = await ejs.renderFile(templatePath, templateData);
  } else if (templateType === "general") {
    if (!templateData || !templateData.description) {
      return res.status(400).json({ success: false, message: "Missing required template data." });
    }

    let backendUrl = process.env.APP_PUBLIC_URL || process.env.ADMIN_BACKEND_URL || "http://localhost:4100";
    if (backendUrl.endsWith('/')) backendUrl = backendUrl.slice(0, -1);
    templateData.backendUrl = backendUrl;
    templateData.unsubscribeUrl = `${backendUrl}/promotions/unsubscribe?email={{params.USER_EMAIL}}`;
    
    const templatePath = path.join(__dirname, "../templates/generalPromotion.ejs");
    finalHtml = await ejs.renderFile(templatePath, templateData);
  }

  if (!subject || !finalHtml) {
    return res.status(400).json({ success: false, message: "Subject and HTML content are required." });
  }

  // 1. Fetch all registered users who have not been deleted and have not unsubscribed
  let registeredUsers = [];
  const isExternalOnly = sendToExternalOnly === true || sendToExternalOnly === "true";
  
  if (!isExternalOnly) {
    const query = { deletedAt: null, unsubscribedPromotions: { $ne: true } };
    if (targetGroup === "recurring") {
      query.isManual = { $ne: true };
    } else if (targetGroup === "non-recurring") {
      query.isManual = true;
    }
    const users = await User.find(query).select("email fullName").lean();
    registeredUsers = users.map(u => ({
      email: (u.email || "").trim(),
      name: (u.fullName || "").trim()
    })).filter(u => u.email);
  }

  // 2. Process external emails
  let externalList = [];
  if (externalEmails && typeof externalEmails === "string") {
    const parts = externalEmails.split(/,/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      const match = trimmed.match(/^([^<]+)<([^>]+)>$/);
      if (match) {
        externalList.push({
          name: match[1].trim(),
          email: match[2].trim()
        });
      } else {
        externalList.push({
          name: "",
          email: trimmed
        });
      }
    }
  } else if (Array.isArray(externalEmails)) {
    externalList = externalEmails.map(e => {
      if (typeof e === "object" && e !== null) {
        return {
          email: String(e.email || "").trim(),
          name: String(e.name || "").trim()
        };
      }
      return {
        email: String(e).trim(),
        name: ""
      };
    }).filter(e => e.email);
  }

  // 3. Combine and deduplicate by email
  const recipientsMap = new Map();
  if (!isExternalOnly) {
    for (const r of registeredUsers) {
      recipientsMap.set(r.email.toLowerCase(), r);
    }
  }
  for (const r of externalList) {
    recipientsMap.set(r.email.toLowerCase(), r);
  }

  // Fetch globally unsubscribed emails to filter out external list opt-outs
  const unsubscribedDocs = await UnsubscribedEmail.find().select("email").lean();
  const unsubscribedEmails = new Set(unsubscribedDocs.map(d => d.email.toLowerCase()));

  // Filter out any unsubscribed emails and locally excluded emails
  const excludedSet = new Set((excludedEmails || []).map(e => String(e).toLowerCase().trim()));
  const allRecipients = Array.from(recipientsMap.values()).filter(
    r => !unsubscribedEmails.has(r.email.toLowerCase()) && !excludedSet.has(r.email.toLowerCase())
  );

  if (allRecipients.length === 0) {
    return res.status(400).json({ success: false, message: "No valid recipients found." });
  }

  // 4. Send emails or schedule them
  const isScheduledFuture = scheduleTime && new Date(scheduleTime).getTime() > Date.now();

  if (isScheduledFuture) {
    const batchSize = dripDelivery && emailsPerHour && emailsPerHour > 0 ? Number(emailsPerHour) : allRecipients.length;
    
    await ScheduledPromotion.create({
      subject,
      htmlContent: finalHtml,
      pendingRecipients: allRecipients,
      emailsPerHour: batchSize,
      status: "active",
      nextRunAt: new Date(scheduleTime),
      senderName
    });

    return res.json({
      success: true,
      message: `Promotion scheduled for ${new Date(scheduleTime).toLocaleString()}. ${allRecipients.length} queued.`,
      data: { totalRecipients: allRecipients.length, scheduledFor: scheduleTime }
    });
  } else if (dripDelivery && emailsPerHour && emailsPerHour > 0) {
    const batchSize = Number(emailsPerHour);
    const initialBatch = allRecipients.slice(0, batchSize);
    const remaining = allRecipients.slice(batchSize);

    let successCount = 0;
    let failureCount = 0;

    // Send the first batch immediately
    if (initialBatch.length > 0) {
      const result = await sendPromotionalEmail(initialBatch, subject, finalHtml, senderName);
      successCount = result.successCount;
      failureCount = result.failureCount;
    }

    // Schedule the rest
    if (remaining.length > 0) {
      await ScheduledPromotion.create({
        subject,
        htmlContent: finalHtml,
        pendingRecipients: remaining,
        emailsPerHour: batchSize,
        status: "active",
        nextRunAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        senderName
      });
    }

    return res.json({
      success: true,
      message: `Promotion started in drip mode. Sent ${initialBatch.length} immediately. ${remaining.length} scheduled.`,
      data: {
        totalRecipients: allRecipients.length,
        initialBatchSent: initialBatch.length,
        scheduledRemaining: remaining.length,
        successCount,
        failureCount
      }
    });
  } else {
    // Normal immediate delivery
    const { successCount, failureCount } = await sendPromotionalEmail(allRecipients, subject, finalHtml, senderName);

    res.json({
      success: true,
      message: "Promotion sent.",
      data: {
        totalRecipients: allRecipients.length,
        successCount,
        failureCount
      }
    });
  }
});

const unsubscribe = asyncHandler(async (req, res) => {
  // Support both query params (GET) and body (if POST was used with body, though RFC 8058 POST keeps query params)
  const email = req.query.email || req.body.email;

  if (!email) {
    return res.status(400).send("Invalid unsubscribe link.");
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Update User model if they are registered
  await User.updateOne({ email: cleanEmail }, { $set: { unsubscribedPromotions: true } });

  // 2. Add to UnsubscribedEmail collection
  await UnsubscribedEmail.updateOne(
    { email: cleanEmail },
    { $set: { email: cleanEmail } },
    { upsert: true }
  );

  // If it's a POST request (One-Click Unsubscribe from email client headers), just return 200 OK
  if (req.method === 'POST') {
    return res.status(200).send("Unsubscribed");
  }

  res.send(`
    <html>
      <head>
        <title>Unsubscribed</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; background: #f9fafb; color: #111827; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          h1 { color: #10b981; font-size: 24px; margin-bottom: 10px; }
          p { color: #4b5563; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Successfully Unsubscribed</h1>
          <p>You have been removed from our promotional mailing list. You will still receive important account-related emails.</p>
          <br>
          <p style="font-size: 12px;">Made a mistake? <a href="/promotions/resubscribe?email=${encodeURIComponent(cleanEmail)}" style="color: #3b82f6;">Resubscribe here</a></p>
        </div>
      </body>
    </html>
  `);
});

const resubscribe = asyncHandler(async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).send("Invalid resubscribe link.");
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Update User model if they are registered
  await User.updateOne({ email: cleanEmail }, { $set: { unsubscribedPromotions: false } });

  // 2. Remove from UnsubscribedEmail collection
  await UnsubscribedEmail.deleteOne({ email: cleanEmail });

  res.send(`
    <html>
      <head>
        <title>Resubscribed</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 50px; background: #f9fafb; color: #111827; }
          .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
          h1 { color: #3b82f6; font-size: 24px; margin-bottom: 10px; }
          p { color: #4b5563; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Welcome Back!</h1>
          <p>You have successfully resubscribed to our promotional emails.</p>
        </div>
      </body>
    </html>
  `);
});

const getUnsubscribedUsers = asyncHandler(async (req, res) => {
  const unsubscribedDocs = await UnsubscribedEmail.find().sort({ createdAt: -1 }).lean();
  
  if (!unsubscribedDocs || unsubscribedDocs.length === 0) {
    return res.json({ success: true, data: [] });
  }

  const emails = unsubscribedDocs.map(d => d.email);
  const users = await User.find({ email: { $in: emails } }).select("email fullName").lean();
  
  const userMap = new Map(users.map(u => [u.email, u.fullName]));

  const data = unsubscribedDocs.map(doc => ({
    _id: doc._id,
    email: doc.email,
    unsubscribedAt: doc.createdAt,
    isRegistered: userMap.has(doc.email),
    fullName: userMap.get(doc.email) || null
  }));

  res.json({ success: true, data });
});

const getPromotionPreview = asyncHandler(async (req, res) => {
  const { targetGroup } = req.query;

  const query = { deletedAt: null, unsubscribedPromotions: { $ne: true } };
  if (targetGroup === "recurring") {
    query.isManual = { $ne: true };
  } else if (targetGroup === "non-recurring") {
    query.isManual = true;
  }

  const users = await User.find(query).select("email fullName").lean();
  
  const unsubscribedDocs = await UnsubscribedEmail.find().select("email").lean();
  const unsubscribedEmails = new Set(unsubscribedDocs.map(d => d.email.toLowerCase()));

  const filteredUsers = users.filter(u => u.email && !unsubscribedEmails.has(u.email.toLowerCase()));

  res.json({
    success: true,
    count: filteredUsers.length,
    users: filteredUsers.map(u => ({ email: u.email, fullName: u.fullName || "" }))
  });
});

module.exports = { sendPromotion, unsubscribe, resubscribe, getUnsubscribedUsers, getPromotionPreview };
