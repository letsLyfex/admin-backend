/**
 * One-time test script — sends general promo email to 3 test addresses only.
 * Run: node test-promo-send.js
 * Delete after testing.
 */

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env.example") });
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const ejs = require("ejs");

const TEST_EMAILS = [
  "adityathakkar178@gmail.com",
  "adityathakkar17820@gmail.com",
  "saasproduct0@gmail.com",
];

const apiKey = process.env.BREVO_API_KEY || process.env.BRAVO_API_KEY;
const senderEmail = process.env.BREVO_FROM_EMAIL || process.env.BRAVO_FROM_EMAIL;
const senderName = process.env.BREVO_FROM_NAME || process.env.BRAVO_FROM_NAME;
const backendUrl = process.env.APP_PUBLIC_URL || process.env.ADMIN_BACKEND_URL || "http://localhost:4100";

if (!apiKey) { console.error("Missing BRAVO_API_KEY"); process.exit(1); }

const templateData = {
  title: "Welcome to Lyfex — Explore What's New!",
  description: `Hi there!\n\nWe're excited to have you on Lyfex. Explore live discussion sessions, connect with contributors, and grow your knowledge every day.\n\nJoin our upcoming sessions and be part of an amazing community!`,
  buttonText: "Explore Lyfex",
  buttonLink: "https://thelyfex.com",
  backendUrl,
  unsubscribeUrl: `${backendUrl}/promotions/unsubscribe?email={{EMAIL}}`,
};

const subject = "Welcome to Lyfex — Explore What's New!";

async function sendOne(email) {
  const html = await ejs.renderFile(
    path.join(__dirname, "src/templates/generalPromotion.ejs"),
    { ...templateData, unsubscribeUrl: `${backendUrl}/promotions/unsubscribe?email=${encodeURIComponent(email)}` }
  );

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error(`  FAIL ${email}: ${res.status} ${err}`);
  } else {
    console.log(`  OK   ${email}`);
  }
}

(async () => {
  console.log(`Sending general promo email to ${TEST_EMAILS.length} test addresses...`);
  for (const email of TEST_EMAILS) {
    await sendOne(email);
  }
  console.log("Done.");
})();
