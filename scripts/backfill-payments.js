/**
 * One-time backfill: populate the Payment collection from historical data.
 * Fetches exact payment dates from Razorpay API first, then uses those
 * timestamps when writing Payment records.
 *
 * Run once:
 *   node scripts/backfill-payments.js
 *
 * Safe to run multiple times — clears old approximated records first,
 * then re-inserts with correct Razorpay dates.
 */

const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../.env.example") });
dotenv.config({ path: path.join(__dirname, "../.env"), override: true });

const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
const Razorpay = require("razorpay");

const User         = require("../src/models/User");
const Payment      = require("../src/models/Payment");
const WatchSession = require("../src/models/WatchSession");
const LiveSession   = require("../src/models/LiveSession");
const PauseContent  = require("../src/models/PauseContent");

// ── Razorpay: fetch ALL captured payments, paginated ────────────────────────

async function fetchAllRazorpayPayments(razorpay) {
  const allPayments = [];
  const count = 100;
  let skip = 0;

  console.log("  Fetching payments from Razorpay API (this may take a moment)…");

  while (true) {
    const response = await razorpay.payments.all({ count, skip });
    const items = response.items || [];
    allPayments.push(...items);
    console.log(`    Fetched ${allPayments.length} so far (batch size ${items.length})`);
    if (items.length < count) break; // last page
    skip += count;
  }

  console.log(`  Total Razorpay payments fetched: ${allPayments.length}`);
  return allPayments;
}

// ── Build lookup maps from Razorpay data ─────────────────────────────────────

function buildLookupMaps(razorpayPayments) {
  // paymentId  → exact Date
  const byPaymentId = new Map();
  // "userId_roomId" → { date, paymentId, orderId }
  const byUserRoom = new Map();

  for (const p of razorpayPayments) {
    if (!p.created_at) continue;
    const date = new Date(p.created_at * 1000); // Razorpay uses Unix seconds
    const notes = p.notes || {};

    // Index by Razorpay payment ID (for subscriptions)
    if (p.id) byPaymentId.set(p.id, { date, orderId: p.order_id });

    // Index by userId+roomId (for session access)
    if (notes.userId && notes.roomId) {
      const key = `${notes.userId}_${notes.roomId}`;
      // Keep the earliest payment if multiple (shouldn't happen, but safety)
      if (!byUserRoom.has(key) || date < byUserRoom.get(key).date) {
        byUserRoom.set(key, { date, paymentId: p.id, orderId: p.order_id });
      }
    }
  }

  return { byPaymentId, byUserRoom };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();
  const RZP_KEY_ID  = String(process.env.RAZORPAY_KEY_ID || "").trim();
  const RZP_SECRET  = String(process.env.RAZORPAY_KEY_SECRET || "").trim();

  if (!MONGODB_URI) { console.error("Missing MONGODB_URI"); process.exit(1); }
  if (!RZP_KEY_ID || !RZP_SECRET) { console.error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET"); process.exit(1); }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const razorpay = new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_SECRET });

  // ── Step 1: pull all Razorpay payment data ────────────────────────────────
  console.log("\n[Step 1] Fetching all payments from Razorpay…");
  const rzpPayments = await fetchAllRazorpayPayments(razorpay);
  const { byPaymentId, byUserRoom } = buildLookupMaps(rzpPayments);
  console.log(`  Lookup maps: ${byPaymentId.size} by paymentId, ${byUserRoom.size} by userId+roomId`);

  // ── Step 2: clear previous approximated backfill records ──────────────────
  // These are records with no real razorpayOrderId (created by the first backfill run)
  console.log("\n[Step 2] Removing previously approximated backfill records…");
  const deleted = await Payment.collection.deleteMany({ razorpayOrderId: "" });
  console.log(`  Removed ${deleted.deletedCount} approximated records`);

  let created = 0;
  let skipped = 0;
  const PLAN_PRICE = { TALK: 299, CONTRIBUTE: 599, VIEW: 0 };

  // ── Step 3: subscription payments ────────────────────────────────────────
  console.log("\n[Step 3] Backfilling subscription payments…");

  const usersWithSub = await User.find({ hasPaidSubscription: true })
    .select("_id subscriptionPlan usedPaymentIds updatedAt createdAt")
    .lean();

  console.log(`  Found ${usersWithSub.length} users with paid subscriptions`);

  for (const user of usersWithSub) {
    const paymentIds = user.usedPaymentIds || [];
    const plan = String(user.subscriptionPlan || "").toUpperCase();
    const amount = PLAN_PRICE[plan] ?? 0;
    const fallbackDate = user.updatedAt || user.createdAt || new Date();

    if (paymentIds.length === 0) {
      // No payment ID — use user.updatedAt as fallback
      const result = await Payment.collection.updateOne(
        { userId: user._id, type: "subscription", razorpayPaymentId: "" },
        {
          $setOnInsert: {
            userId: user._id, type: "subscription",
            razorpayOrderId: "", razorpayPaymentId: "",
            amount, currency: "INR", status: "paid", plan,
            tier: null, sessionId: null, sessionType: null, note: "",
            createdAt: fallbackDate, updatedAt: fallbackDate,
          },
        },
        { upsert: true }
      );
      result.upsertedCount ? created++ : skipped++;
    } else {
      for (const payId of paymentIds) {
        const rzp = byPaymentId.get(payId);
        const exactDate = rzp?.date || fallbackDate;
        const orderId   = rzp?.orderId || "";

        const result = await Payment.collection.updateOne(
          { razorpayPaymentId: payId },
          {
            $setOnInsert: {
              userId: user._id, type: "subscription",
              razorpayOrderId: orderId, razorpayPaymentId: payId,
              amount, currency: "INR", status: "paid", plan,
              tier: null, sessionId: null, sessionType: null, note: "",
              createdAt: exactDate, updatedAt: exactDate,
            },
          },
          { upsert: true }
        );
        result.upsertedCount ? created++ : skipped++;
      }
    }
  }
  console.log(`  ✓ ${created} created, ${skipped} already existed`);

  // ── Step 4: Watch session access payments ─────────────────────────────────
  console.log("\n[Step 4] Backfilling Watch session access payments…");
  created = 0; skipped = 0;

  const watchWithPaid = await WatchSession.find({ "paidParticipantIds.0": { $exists: true } })
    .select("_id title roomId paymentAmount hasTiers vipPaymentAmount normalPaymentAmount paidParticipantIds vipParticipantIds updatedAt createdAt")
    .lean();

  console.log(`  Found ${watchWithPaid.length} watch sessions with paid participants`);

  for (const session of watchWithPaid) {
    const vipSet = new Set((session.vipParticipantIds || []).map(String));
    for (const userId of (session.paidParticipantIds || [])) {
      const isVip = session.hasTiers && vipSet.has(String(userId));
      const amount = session.hasTiers
        ? (isVip ? session.vipPaymentAmount : session.normalPaymentAmount)
        : session.paymentAmount;

      const key = `${String(userId)}_${session.roomId}`;
      const rzp = byUserRoom.get(key);
      const exactDate = rzp?.date || session.updatedAt || session.createdAt || new Date();
      const paymentId = rzp?.paymentId || "";
      const orderId   = rzp?.orderId || "";

      const result = await Payment.collection.updateOne(
        { userId: new mongoose.Types.ObjectId(String(userId)), sessionId: session._id, type: "session_access" },
        {
          $setOnInsert: {
            userId: new mongoose.Types.ObjectId(String(userId)),
            type: "session_access",
            razorpayOrderId: orderId, razorpayPaymentId: paymentId,
            amount: amount || 0, currency: "INR", status: "paid",
            plan: session.title || "", sessionId: session._id,
            sessionType: "watch", tier: isVip ? "vip" : "normal", note: "",
            createdAt: exactDate, updatedAt: exactDate,
          },
        },
        { upsert: true }
      );
      result.upsertedCount ? created++ : skipped++;
    }
  }
  console.log(`  ✓ ${created} created, ${skipped} already existed`);

  // ── Step 5: Live session access payments ──────────────────────────────────
  console.log("\n[Step 5] Backfilling Live session access payments…");
  created = 0; skipped = 0;

  const liveWithPaid = await LiveSession.find({ "paidParticipantIds.0": { $exists: true } })
    .select("_id title roomId paymentAmount hasTiers vipPaymentAmount normalPaymentAmount paidParticipantIds vipParticipantIds updatedAt createdAt")
    .lean();

  console.log(`  Found ${liveWithPaid.length} live sessions with paid participants`);

  for (const session of liveWithPaid) {
    const vipSet = new Set((session.vipParticipantIds || []).map(String));
    for (const userId of (session.paidParticipantIds || [])) {
      const isVip = session.hasTiers && vipSet.has(String(userId));
      const amount = session.hasTiers
        ? (isVip ? session.vipPaymentAmount : session.normalPaymentAmount)
        : session.paymentAmount;

      const key = `${String(userId)}_${session.roomId}`;
      const rzp = byUserRoom.get(key);
      const exactDate = rzp?.date || session.updatedAt || session.createdAt || new Date();
      const paymentId = rzp?.paymentId || "";
      const orderId   = rzp?.orderId || "";

      const result = await Payment.collection.updateOne(
        { userId: new mongoose.Types.ObjectId(String(userId)), sessionId: session._id, type: "session_access" },
        {
          $setOnInsert: {
            userId: new mongoose.Types.ObjectId(String(userId)),
            type: "session_access",
            razorpayOrderId: orderId, razorpayPaymentId: paymentId,
            amount: amount || 0, currency: "INR", status: "paid",
            plan: session.title || "", sessionId: session._id,
            sessionType: "live", tier: isVip ? "vip" : "normal", note: "",
            createdAt: exactDate, updatedAt: exactDate,
          },
        },
        { upsert: true }
      );
      result.upsertedCount ? created++ : skipped++;
    }
  }
  console.log(`  ✓ ${created} created, ${skipped} already existed`);

  // ── Step 6: Pause session access payments ─────────────────────────────────
  console.log("\n[Step 6] Backfilling Pause session access payments…");
  created = 0; skipped = 0;

  const pauseWithPaid = await PauseContent.find({ "paidParticipantIds.0": { $exists: true } })
    .select("_id title roomId paymentAmount hasTiers vipPaymentAmount normalPaymentAmount paidParticipantIds vipParticipantIds updatedAt createdAt")
    .lean();

  console.log(`  Found ${pauseWithPaid.length} pause sessions with paid participants`);

  for (const session of pauseWithPaid) {
    const vipSet = new Set((session.vipParticipantIds || []).map(String));
    for (const userId of (session.paidParticipantIds || [])) {
      const isVip = session.hasTiers && vipSet.has(String(userId));
      const amount = session.hasTiers
        ? (isVip ? session.vipPaymentAmount : session.normalPaymentAmount)
        : session.paymentAmount;

      const key = `${String(userId)}_${session.roomId}`;
      const rzp = byUserRoom.get(key);
      const exactDate = rzp?.date || session.updatedAt || session.createdAt || new Date();
      const paymentId = rzp?.paymentId || "";
      const orderId   = rzp?.orderId || "";

      const result = await Payment.collection.updateOne(
        { userId: new mongoose.Types.ObjectId(String(userId)), sessionId: session._id, type: "session_access" },
        {
          $setOnInsert: {
            userId: new mongoose.Types.ObjectId(String(userId)),
            type: "session_access",
            razorpayOrderId: orderId, razorpayPaymentId: paymentId,
            amount: amount || 0, currency: "INR", status: "paid",
            plan: session.title || "", sessionId: session._id,
            sessionType: "pause", tier: isVip ? "vip" : "normal", note: "",
            createdAt: exactDate, updatedAt: exactDate,
          },
        },
        { upsert: true }
      );
      result.upsertedCount ? created++ : skipped++;
    }
  }
  console.log(`  ✓ ${created} created, ${skipped} already existed`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const totalPayments = await Payment.countDocuments();
  console.log(`\n✅ Backfill complete. Total Payment records: ${totalPayments}`);
  console.log("   Dates sourced directly from Razorpay where available.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
