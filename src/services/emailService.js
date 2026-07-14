const fetch = global.fetch; // using native fetch in Node 18+
const User = require("../models/User");

async function sendPromotionalEmail(recipients, subject, htmlContent, senderName) {
  const apiKey = process.env.BRAVO_API_KEY;
  const fromName = senderName || process.env.BRAVO_FROM_NAME || "TheLyfex";
  const fromEmail = process.env.BRAVO_FROM_EMAIL || "admin@thelyfex.com";

  if (!apiKey) {
    throw new Error("BRAVO_API_KEY is missing in env");
  }

  if (!recipients || recipients.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // Map recipients to nameMap, resolving names from DB only for those that need it
  const nameMap = new Map();
  const emailsNeedLookup = [];
  
  for (const r of recipients) {
    if (!r) continue;
    const email = typeof r === "string" ? r.trim() : (r.email || "").trim();
    const name = typeof r === "string" ? "" : (r.name || "").trim();
    
    if (email) {
      const emailLower = email.toLowerCase();
      if (name) {
        nameMap.set(emailLower, name);
      } else {
        emailsNeedLookup.push(email);
      }
    }
  }

  if (emailsNeedLookup.length > 0) {
    try {
      const users = await User.find({ email: { $in: emailsNeedLookup } }).select("email fullName").lean();
      for (const u of users) {
        if (u.email && u.fullName) {
          nameMap.set(u.email.toLowerCase(), u.fullName.trim());
        }
      }
    } catch (err) {
      console.error("[emailService] Failed to fetch user names from DB:", err);
    }
  }

  const chunkSize = 50;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    
    const backendUrl = process.env.APP_PUBLIC_URL || process.env.ADMIN_BACKEND_URL || "http://localhost:4100";
    
    let finalHtml = htmlContent;
    if (!finalHtml.includes("{{params.USER_EMAIL}}")) {
      finalHtml += `<br><br><hr style="border:0; border-top:1px solid #eaeaea;"><p style="font-size: 12px; color: #888; text-align: center;">Don't want to receive these emails anymore? <a href="${backendUrl}/promotions/unsubscribe?email={{params.USER_EMAIL}}" style="color: #3b82f6; text-decoration: none;">Unsubscribe here</a>.</p>`;
    }

    const payload = {
      sender: { name: fromName, email: fromEmail },
      subject: subject,
      htmlContent: finalHtml,
      headers: {
        "List-Unsubscribe": `<${backendUrl}/promotions/unsubscribe?email={{params.USER_EMAIL}}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
      },
      messageVersions: chunk.map((r) => {
        const email = typeof r === "string" ? r.trim() : (r.email || "").trim();
        const name = nameMap.get(email.toLowerCase()) || "Customer";
        return {
          to: [{ email }],
          params: { 
            USER_EMAIL: email,
            USER_NAME: name 
          }
        };
      })
    };

    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[emailService] Failed to send to chunk ${i}: ${errorText}`);
        failureCount += chunk.length;
      } else {
        successCount += chunk.length;
      }
    } catch (err) {
      console.error(`[emailService] Fetch error for chunk ${i}:`, err);
      failureCount += chunk.length;
    }
  }

  return { successCount, failureCount };
}

module.exports = { sendPromotionalEmail };
