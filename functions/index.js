/**
 * AAYUSH MANAGER — Cloud Functions
 * ---------------------------------
 * Ye ek hi file me 2 kaam karti hai:
 *
 *  1. checkLowStockAndNotify — item ka stock threshold se neeche jaate hi turant:
 *       - phone/browser push notification (app band ho tab bhi)
 *       - email (Firestore "mail" collection ke through, Trigger Email extension use karta hai)
 *
 *  2. dailySummary — roz raat 9:30 PM (IST) apne aap chalti hai aur
 *       "aaj kitna bika, kitni repair hui, kitna revenue aaya" — email pe bhejti hai.
 *
 * DEPLOY KARNE KA TARIKA (SETUP-NOTIFICATIONS.md me poora likha hai):
 *   1. Terminal me: npm install -g firebase-tools
 *   2. firebase login
 *   3. Is 'functions' folder ke andar: npm install
 *   4. Project root me: firebase deploy --only functions
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// ---- Bro yahan apni email daali hai ----
const OWNER_EMAIL = "sumitkumarbihariara@gmail.com";

async function sendEmail(subject, text) {
  // Ye Firestore "mail" collection me ek doc daalta hai. Agar tumne Firebase Extension
  // "Trigger Email from Firestore" install ki hai, wo isse dekh ke apne aap email bhej degi.
  await db.collection("mail").add({
    to: [OWNER_EMAIL],
    message: { subject, text },
  });
}

exports.checkLowStockAndNotify = onDocumentWritten("items/{itemId}", async (event) => {
  const before = event.data.before?.data();
  const after = event.data.after?.data();
  if (!after) return;

  const threshold = Number(after.threshold) || 1;
  const qty = Number(after.qty) || 0;
  const wasLow = before ? (Number(before.qty) || 0) <= (Number(before.threshold) || 1) : false;
  const isLow = qty <= threshold;

  // sirf tab notify karo jab item ABHI low hua ho (pehle low nahi tha) — spam nahi hoga
  if (!isLow || wasLow) return;

  const alertText = `Stock Kam Hai: ${after.name} sirf ${qty} bacha hai (${after.category || "item"})`;

  // 1) push notification — sab registered devices ko
  const tokensSnap = await db.collection("fcmTokens").get();
  if (!tokensSnap.empty) {
    const tokens = tokensSnap.docs.map((d) => d.id);
    try {
      const response = await getMessaging().sendEachForMulticast({
        notification: { title: "Stock Kam Hai ⚠️", body: alertText },
        tokens,
      });
      response.responses.forEach((r, i) => {
        if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
          db.collection("fcmTokens").doc(tokens[i]).delete().catch(() => {});
        }
      });
    } catch (err) {
      console.error("Push bhejne me error:", err);
    }
  }

  // 2) email
  await sendEmail("⚠️ AAYUSH MANAGER — Stock Kam Hai", alertText).catch((e) => console.error(e));
});

// Har roz raat 9:30 PM IST — "aaj kya bika" ka summary email
exports.dailySummary = onSchedule(
  { schedule: "30 21 * * *", timeZone: "Asia/Kolkata" },
  async () => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startTs = Timestamp.fromDate(startOfDay);

    const salesSnap = await db.collection("sales").where("createdAt", ">=", startTs).get();
    const repairsSnap = await db.collection("repairs").where("createdAt", ">=", startTs).get();

    let salesTotal = 0, salesCount = 0, itemsSoldText = [];
    salesSnap.forEach((doc) => {
      const s = doc.data();
      salesTotal += Number(s.amount) || 0;
      salesCount += Number(s.qty) || 0;
      itemsSoldText.push(`- ${s.itemName} x${s.qty} — ₹${s.amount}`);
    });

    let repairTotal = 0, repairCount = 0;
    repairsSnap.forEach((doc) => {
      const r = doc.data();
      repairTotal += Number(r.total) || 0;
      repairCount += 1;
    });

    const dateStr = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
    const grandTotal = salesTotal + repairTotal;

    const summaryText =
      `AAYUSH MANAGER — Din Ka Hisaab (${dateStr})\n\n` +
      `Sales: ${salesCount} items, ₹${salesTotal}\n` +
      `Repairs: ${repairCount} jobs, ₹${repairTotal}\n` +
      `Total Aamdani: ₹${grandTotal}\n\n` +
      (itemsSoldText.length ? `Kya Bika:\n${itemsSoldText.join("\n")}` : "Aaj kuch nahi bika");

    if (salesCount === 0 && repairCount === 0) return; // kuch hua hi nahi toh mat bhejo

    await sendEmail(`AAYUSH MANAGER — Din Ka Hisaab (${dateStr})`, summaryText).catch((e) => console.error(e));
  }
);
    
