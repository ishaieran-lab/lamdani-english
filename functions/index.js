const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// Cardcom test credentials — replace with production credentials before going live
const CARDCOM_TERMINAL = 1000;
const CARDCOM_API_NAME = "kzFKfohEvL6AOF8aMEJz";
const CARDCOM_API_PASS = "FIDHIh4pAadw3Slbdsjg";
const CARDCOM_API_URL = "https://secure.cardcom.solutions/api/v11";
const SITE_URL = "https://lamdanien.co.il";
const FUNCTIONS_URL = "https://us-central1-lamdani-eng.cloudfunctions.net";

// ─── 1. Create Cardcom payment session ────────────────────────────────────────
// Called from the client (authenticated user) to get a payment URL
exports.createPaymentSession = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    // Verify Firebase Auth token
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });

    let uid, email, displayName;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email || "";
      displayName = decoded.name || email;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    const payload = {
      TerminalNumber: CARDCOM_TERMINAL,
      ApiName: CARDCOM_API_NAME,
      ApiPass: CARDCOM_API_PASS,
      ReturnValue: uid,
      Amount: 35,
      CoinID: 1,
      MaxPayments: 1,
      ProductName: "מנוי חודשי למדני אנגלית",
      SuccessRedirectUrl: `${SITE_URL}/payment-success.html`,
      FailedRedirectUrl: `${SITE_URL}/payment-failed.html`,
      WebHookUrl: `${FUNCTIONS_URL}/cardcomCallback`,
      CreateInvoice: true,
      Document: {
        To: displayName,
        Email: email,
        Type: 305,
      },
      Charge: {
        Total: 35,
        Products: [
          { Description: "מנוי חודשי למדני אנגלית", UnitCost: 35, Quantity: 1 },
        ],
      },
    };

    try {
      const response = await fetch(`${CARDCOM_API_URL}/LowProfile/Create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (data.ResponseCode !== 0) {
        console.error("Cardcom error:", data);
        return res.status(500).json({ error: data.Description || "שגיאה בשירות התשלום" });
      }

      const paymentUrl = `https://secure.cardcom.solutions/Purchase?lowprofilecode=${data.LowProfileCode}`;
      res.json({ url: paymentUrl });
    } catch (err) {
      console.error("createPaymentSession error:", err);
      res.status(500).json({ error: "שירות התשלום אינו זמין כרגע" });
    }
  }
);

// ─── 2. Cardcom payment callback (webhook) ────────────────────────────────────
// Cardcom calls this URL after a completed payment
exports.cardcomCallback = onRequest(async (req, res) => {
  const body = req.body;

  if (String(body.ResponseCode) !== "0") {
    console.log("Payment not successful, ResponseCode:", body.ResponseCode);
    return res.status(200).send("Payment failed");
  }

  const uid = body.ReturnValue;
  const cardToken = body.Token || null;
  const last4 = body.Last4Digits || "";

  if (!uid) return res.status(400).send("Missing uid");

  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 1);

  await db.collection("users").doc(uid).set(
    {
      premium: true,
      premiumSince: admin.firestore.FieldValue.serverTimestamp(),
      premiumExpiry: admin.firestore.Timestamp.fromDate(expiry),
      cardcomToken: cardToken,
      last4: last4,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`User ${uid} activated premium until ${expiry.toISOString()}`);
  res.status(200).send("OK");
});

// ─── 3. Monthly recurring charge ──────────────────────────────────────────────
// Runs on the 1st of every month at 08:00 UTC
exports.chargeMonthly = onSchedule("0 8 1 * *", async () => {
  const now = new Date();

  const snapshot = await db
    .collection("users")
    .where("premium", "==", true)
    .get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.cardcomToken) continue;

    // Skip if subscription is still active
    if (data.premiumExpiry && data.premiumExpiry.toDate() > now) continue;

    try {
      const response = await fetch(`${CARDCOM_API_URL}/Tokens/Charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          TerminalNumber: CARDCOM_TERMINAL,
          ApiName: CARDCOM_API_NAME,
          ApiPass: CARDCOM_API_PASS,
          Token: data.cardcomToken,
          Amount: 35,
          CoinID: 1,
          ProductName: "מנוי חודשי למדני אנגלית",
          CreateInvoice: true,
          Document: { Type: 305 },
        }),
      });

      const result = await response.json();

      if (result.ResponseCode === 0) {
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + 1);
        await doc.ref.update({
          premiumExpiry: admin.firestore.Timestamp.fromDate(expiry),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Renewed premium for user ${doc.id}`);
      } else {
        // Charge failed — disable premium
        await doc.ref.update({
          premium: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.warn(`Charge failed for user ${doc.id}:`, result.Description);
      }
    } catch (err) {
      console.error(`Error charging user ${doc.id}:`, err);
    }
  }
});

// ─── 4. Cancel subscription ───────────────────────────────────────────────────
// Called from client to cancel at end of current period
exports.cancelSubscription = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });

    let uid;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }

    await db.collection("users").doc(uid).update({
      cancelAtPeriodEnd: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true });
  }
);
