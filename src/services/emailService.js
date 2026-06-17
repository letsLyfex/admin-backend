const fetch = global.fetch; // using native fetch in Node 18+

async function sendPromotionalEmail(recipients, subject, htmlContent) {
  const apiKey = process.env.BRAVO_API_KEY;
  const fromName = process.env.BRAVO_FROM_NAME || "TheLyfex";
  const fromEmail = process.env.BRAVO_FROM_EMAIL || "admin@thelyfex.com";

  if (!apiKey) {
    throw new Error("BRAVO_API_KEY is missing in env");
  }

  if (!recipients || recipients.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const chunkSize = 50;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < recipients.length; i += chunkSize) {
    const chunk = recipients.slice(i, i + chunkSize);
    
    const backendUrl = process.env.ADMIN_BACKEND_URL || "http://localhost:4100";
    
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
      messageVersions: chunk.map((email) => ({
        to: [{ email }],
        params: { USER_EMAIL: email }
      }))
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
