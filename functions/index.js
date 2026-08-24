const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

// Cardcom credentials — loaded from functions/.env (not committed to git)
const CARDCOM_TERMINAL = parseInt(process.env.CARDCOM_TERMINAL) || 1000;
const CARDCOM_API_NAME = process.env.CARDCOM_API_NAME || "";
const CARDCOM_API_PASS = process.env.CARDCOM_API_PASS || "";
const CARDCOM_API_URL = "https://secure.cardcom.solutions/api/v11";
const SITE_URL = "https://lamdanien.co.il";
const FUNCTIONS_URL = "https://cardcomcallback-2tarox7bha-uc.a.run.app";

// Gmail credentials — loaded from functions/.env
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || GMAIL_USER;

async function sendMail(to, subject, text) {
  if (!GMAIL_USER || !GMAIL_APP_PASS) return;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
    });
    await transporter.sendMail({ from: `למדני אנגלית <${GMAIL_USER}>`, to, subject, text });
    console.log("Email sent to", to, ":", subject);
  } catch (err) {
    console.warn("Email send failed:", err.message);
  }
}

async function sendAdminEmail(subject, text) {
  return sendMail(ADMIN_EMAIL, subject, text);
}

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
      WebHookUrl: FUNCTIONS_URL,
    };

    try {
      const response = await fetch(`${CARDCOM_API_URL}/LowProfile/Create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      console.log("Cardcom response:", JSON.stringify(data));

      if (data.ResponseCode !== 0) {
        console.error("Cardcom error:", data);
        return res.status(500).json({ error: data.Description || "שגיאה בשירות התשלום" });
      }

      // Use Url field if returned, otherwise build from LowProfileCode
      const paymentUrl = data.Url ||
        (data.LowProfileCode
          ? `https://secure.cardcom.solutions/Interface/Lowprofile.aspx?LowProfileCode=${data.LowProfileCode}`
          : null);

      if (!paymentUrl) {
        console.error("No payment URL in response:", data);
        return res.status(500).json({ error: "לא התקבל קישור תשלום מקארדקום" });
      }

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
      chargeFailedAt: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(`User ${uid} activated premium until ${expiry.toISOString()}`);

  // Send admin notification
  const userRecord = await admin.auth().getUser(uid).catch(() => null);
  const userEmail = userRecord ? userRecord.email : uid;
  await sendAdminEmail(
    `מנוי חדש — ${userEmail}`,
    `משתמש חדש רכש מנוי חודשי.\n\nאימייל: ${userEmail}\nUID: ${uid}\nתאריך: ${now.toISOString()}`
  );

  res.status(200).send("OK");
});

// ─── 3. (removed) Monthly recurring charge ────────────────────────────────────
// The site is free. The scheduled charge job was deleted so no card can ever be
// charged, even if a premium flag is set by mistake. See git history to restore.

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

    // Send admin notification
    const userRecord = await admin.auth().getUser(uid).catch(() => null);
    const userEmail = userRecord ? userRecord.email : uid;
    await sendAdminEmail(
      `ביטול מנוי — ${userEmail}`,
      `משתמש ביטל את המנוי שלו.\n\nאימייל: ${userEmail}\nUID: ${uid}\nתאריך: ${new Date().toISOString()}`
    );

    res.json({ success: true });
  }
);

// ─── 5. Admin delete user ─────────────────────────────────────────────────────
// Deletes a user from both Firebase Auth and Firestore (admin only)
exports.adminDeleteUser = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    let callerEmail;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      callerEmail = decoded.email;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden" });
    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ error: "Missing uid" });
    await db.collection("users").doc(uid).set(
      { _deleted: true, _deletedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    ).catch(() => {});
    await admin.auth().deleteUser(uid).catch(() => {});
    res.json({ ok: true });
  }
);

// ─── 6. Contact form ──────────────────────────────────────────────────────────
exports.contactForm = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: "Missing fields" });
    await sendAdminEmail(
      `פנייה מהאתר — ${name}`,
      `שם: ${name}\nאימייל: ${email}\n\nהודעה:\n${message}`
    );
    res.json({ ok: true });
  }
);

// ─── 6. Delete account ────────────────────────────────────────────────────────
exports.deleteAccount = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    let uid, email;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded.uid;
      email = decoded.email || uid;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    await db.collection("users").doc(uid).update({
      _deleted: true,
      _deletedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(() => {});
    await admin.auth().deleteUser(uid);
    await sendAdminEmail(
      `חשבון נמחק — ${email}`,
      `משתמש מחק את חשבונו.\nאימייל: ${email}\nUID: ${uid}\nתאריך: ${new Date().toISOString()}`
    );
    res.json({ ok: true });
  }
);

// ─── 7. Bulk email ────────────────────────────────────────────────────────────
// Admin sends email to a list of addresses
exports.sendBulkEmail = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    let callerEmail;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      callerEmail = decoded.email;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden" });
    const { emails, subject, message } = req.body || {};
    if (!Array.isArray(emails) || !emails.length || !subject || !message) {
      return res.status(400).json({ error: "Missing fields" });
    }
    let sent = 0, failed = 0;
    const errors = [];
    for (const email of emails) {
      try {
        await sendMail(email, subject, message);
        sent++;
      } catch (err) {
        failed++;
        errors.push({ email, error: err.message });
        console.warn("Bulk email failed for", email, err.message);
      }
    }
    console.log(`Bulk email: ${sent} sent, ${failed} failed. Subject: "${subject}"`);
    res.json({ sent, failed, errors });
  }
);

// ─── 8. Admin list users ──────────────────────────────────────────────────────
// Firebase Auth is the source of truth for who exists, when they registered and
// when they last signed in. Firestore only fills in the app data (kids, progress).
exports.adminListUsers = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    let callerEmail;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      callerEmail = decoded.email;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden" });

    try {
      // Every account that actually exists in Firebase Auth
      const authUsers = [];
      let pageToken;
      do {
        const page = await admin.auth().listUsers(1000, pageToken);
        page.users.forEach((u) => authUsers.push(u));
        pageToken = page.pageToken;
      } while (pageToken);

      // App data from Firestore, keyed by uid
      const fsDocs = {};
      const snap = await db.collection("users").get();
      snap.forEach((doc) => { fsDocs[doc.id] = doc.data(); });

      const toIso = (v) => {
        if (!v) return null;
        if (typeof v === "string") return v;
        if (v.toDate) return v.toDate().toISOString();
        return null;
      };

      const users = authUsers
        .filter((au) => !(fsDocs[au.uid] && fsDocs[au.uid]._deleted))
        .map((au) => {
          const d = fsDocs[au.uid] || {};
          return {
            uid: au.uid,
            email: au.email || d.email || "",
            name: d.name || au.displayName || (au.email ? au.email.split("@")[0] : ""),
            createdAt: au.metadata.creationTime ? new Date(au.metadata.creationTime).toISOString() : null,
            lastSignIn: au.metadata.lastSignInTime ? new Date(au.metadata.lastSignInTime).toISOString() : null,
            emailVerified: au.emailVerified,
            hasData: !!fsDocs[au.uid],
            // photos are data-URIs — strip them, the panel only needs name/gender
            kids: (Array.isArray(d.kids) ? d.kids : []).map((k) => ({
              id: k.id, name: k.name, gender: k.gender || "male", age: k.age || "",
            })),
            progress: d.progress || {},
            note: d.note || "",
            price: d.price || "",
            premium: !!d.premium,
            premiumUntil: toIso(d.premiumUntil),
            lastSyncAt: toIso(d.lastSyncAt),
            lastVisitAt: toIso(d.lastVisitAt),
          };
        });

      res.json({ users });
    } catch (err) {
      console.error("adminListUsers error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── 9. הרשמת משתמש חדש ───────────────────────────────────────────────────────
// מופעלת אוטומטית כשנוצר מסמך חדש ב-users (כלומר, משתמש נרשם לראשונה)
exports.onNewUser = onDocumentCreated(
  { document: "users/{uid}", region: "us-central1" },
  async (event) => {
    const data = event.data ? event.data.data() : null;
    if (!data) return;
    const email = data.email || "לא ידוע";
    const name  = data.name  || "לא ידוע";
    const uid   = event.params.uid;
    await sendAdminEmail(
      `משתמש חדש נרשם — ${email}`,
      `שם: ${name}\nאימייל: ${email}\nUID: ${uid}\nתאריך: ${new Date().toISOString()}`
    );
  }
);
