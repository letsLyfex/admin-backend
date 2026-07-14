const cron = require("node-cron");
const ScheduledPromotion = require("../models/ScheduledPromotion");
const { sendPromotionalEmail } = require("./emailService");

function initCronJobs() {
  // Run every minute to process scheduled drip campaigns
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      // Find all active campaigns where nextRunAt is in the past or now
      const campaigns = await ScheduledPromotion.find({
        status: "active",
        nextRunAt: { $lte: now }
      });

      for (const campaign of campaigns) {
        // Take the next batch based on emailsPerHour
        const batchSize = campaign.emailsPerHour;
        const batch = campaign.pendingRecipients.slice(0, batchSize);
        const remaining = campaign.pendingRecipients.slice(batchSize);

        if (batch.length > 0) {
          // Send the emails
          await sendPromotionalEmail(batch, campaign.subject, campaign.htmlContent, campaign.senderName);
          console.log(`[Cron] Sent ${batch.length} drip emails for campaign: ${campaign.subject}`);
        }

        // Update the campaign
        if (remaining.length === 0) {
          campaign.status = "completed";
          campaign.pendingRecipients = [];
        } else {
          campaign.pendingRecipients = remaining;
          // Set next run to 1 hour from now
          campaign.nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
        }

        await campaign.save();
      }
    } catch (error) {
      console.error("[Cron] Error processing drip campaigns:", error);
    }
  });

  console.log("[admin] Cron jobs initialized");
}

module.exports = { initCronJobs };
