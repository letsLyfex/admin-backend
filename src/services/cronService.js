const cron = require("node-cron");
const ScheduledPromotion = require("../models/ScheduledPromotion");
const ScheduledWhatsApp = require("../models/ScheduledWhatsApp");
const { sendPromotionalEmail } = require("./emailService");
const { sendBulkWhatsApp } = require("./whatsappService");

function initCronJobs() {
  // Run every minute to process scheduled drip campaigns
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      // 1. Process Scheduled Email Promotions
      const emailCampaigns = await ScheduledPromotion.find({
        status: "active",
        nextRunAt: { $lte: now }
      });

      for (const campaign of emailCampaigns) {
        const batchSize = campaign.emailsPerHour;
        const batch = campaign.pendingRecipients.slice(0, batchSize);
        const remaining = campaign.pendingRecipients.slice(batchSize);

        if (batch.length > 0) {
          await sendPromotionalEmail(batch, campaign.subject, campaign.htmlContent, campaign.senderName);
          console.log(`[Cron] Sent ${batch.length} drip emails for campaign: ${campaign.subject}`);
        }

        if (remaining.length === 0) {
          campaign.status = "completed";
          campaign.pendingRecipients = [];
        } else {
          campaign.pendingRecipients = remaining;
          campaign.nextRunAt = new Date(Date.now() + 60 * 60 * 1000);
        }

        await campaign.save();
      }

      // 2. Process Scheduled WhatsApp Promotions
      const whatsappCampaigns = await ScheduledWhatsApp.find({
        status: "active",
        nextRunAt: { $lte: now }
      });

      for (const campaign of whatsappCampaigns) {
        const batchSize = campaign.messagesPerHour;
        const batch = campaign.pendingRecipients.slice(0, batchSize);
        const remaining = campaign.pendingRecipients.slice(batchSize);

        if (batch.length > 0) {
          const result = await sendBulkWhatsApp(
            batch,
            campaign.templateName,
            campaign.languageCode,
            campaign.components
          );
          console.log(`[Cron] Sent ${result.successCount} drip WhatsApp messages (Failed: ${result.failureCount}) for template: ${campaign.templateName}`);
        }

        if (remaining.length === 0) {
          campaign.status = "completed";
          campaign.pendingRecipients = [];
        } else {
          campaign.pendingRecipients = remaining;
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

