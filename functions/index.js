const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ maxInstances: 10, region: "us-central1" });

const SITE_URL = "https://lamdanien.co.il";

// Cardcom credentials are no longer read here — the card endpoints are gone.
// The values remain in functions/.env should card payments ever return.

// Gmail credentials — loaded from functions/.env
const GMAIL_USER = process.env.GMAIL_USER || "";
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || "";
// Two separate things that used to share one value:
// ADMIN_EMAIL  — the account allowed to call the admin endpoints
// NOTIFY_EMAIL — where the site's own notifications land
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL || GMAIL_USER;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || ADMIN_EMAIL;

// Plain text carries no direction, so mail clients lay Hebrew out left to right.
// Sending an HTML part alongside it fixes the alignment; pre-wrap keeps the
// original line breaks without having to rewrite them as markup.
// The logo travels with the message rather than being linked, because clients
// block remote images by default and a broken placeholder is worse than none.
const LOGO_PATH = require("path").join(__dirname, "email-logo.png");
const LOGO_CID = "lamdani-logo";

function rtlHtml(text) {
  const esc = String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Tahoma first: it renders Hebrew better than Arial and ships on Windows,
  // Mac and Android alike, so nearly every reader gets the intended face.
  const FONT = "Tahoma,'Segoe UI',Arial,sans-serif";
  // Anchored right, not centred: a centred column leaves right-aligned Hebrew
  // floating in the middle of a wide window, away from where the eye expects it.
  return '<div dir="rtl" style="max-width:600px;margin:0 0 0 auto;padding:4px 2px">' +
           '<div style="text-align:right;font-family:' + FONT + ';font-size:17px;' +
               'line-height:1.85;color:#1e293b;white-space:pre-wrap">' + esc + '</div>' +
           '<div style="text-align:center;margin-top:32px;padding-top:20px;' +
               'border-top:1px solid #e2e8f0">' +
             '<img src="cid:' + LOGO_CID + '" alt="למדני אנגלית" width="160" ' +
                 'style="width:160px;max-width:60%;height:auto;display:inline-block">' +
             '<div style="font-family:' + FONT + ';font-size:13px;color:#94a3b8;margin-top:10px">' +
               '<a href="https://lamdanien.co.il" style="color:#94a3b8;text-decoration:none">' +
                 'lamdanien.co.il</a>' +
             '</div>' +
           '</div>' +
         '</div>';
}

// One pooled connection for the life of the instance. Opening a fresh SMTP
// session per message cost seconds each, which is what pushed a 27-recipient
// send past the function's time limit and dropped the caller's connection.
let _transport = null;
function mailer() {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }
  return _transport;
}

// Returns null when the mail went out, otherwise the reason it did not.
// Still never throws, so a failed notification cannot break the request that
// triggered it — but callers that need to report the outcome can now see it.
async function sendMail(to, subject, text) {
  if (!GMAIL_USER || !GMAIL_APP_PASS) {
    console.warn("Email not configured — skipped send to", to);
    return "email not configured";
  }
  try {
    await mailer().sendMail({
      from: `למדני אנגלית <${GMAIL_USER}>`,
      to, subject, text,
      html: rtlHtml(text),
      attachments: [{ filename: "logo.png", path: LOGO_PATH, cid: LOGO_CID }],
    });
    console.log("Email sent to", to, ":", subject);
    return null;
  } catch (err) {
    console.warn("Email send failed:", to, err.message);
    return err.message;
  }
}

async function sendAdminEmail(subject, text) {
  return sendMail(NOTIFY_EMAIL, subject, text);
}

// ─── Cardcom endpoints removed ────────────────────────────────────────────────
// createPaymentSession / cardcomCallback / cancelSubscription belonged to the
// monthly card subscription. cardcomCallback took a uid from the request body
// and granted premium with no authentication of any kind — it was meant to be
// called by Cardcom alone. Payment is by Bit now, so they are gone rather than
// guarded. See git history if card payments ever return.

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
  // Headroom for a long list; the default minute is not enough as the list grows
  { cors: [SITE_URL], timeoutSeconds: 540 },
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
    // Sent in small parallel batches over the pooled connection. One at a time
    // took seconds per recipient and ran the function out of time partway
    // through a list, leaving the sender with an error and no idea who got it.
    const BATCH = 5;
    for (let i = 0; i < emails.length; i += BATCH) {
      const slice = emails.slice(i, i + BATCH);
      // sendMail reports failure by return value, not by throwing — counting on
      // a catch here is what made rejected logins show up as "sent"
      const reasons = await Promise.all(
        slice.map((email) => sendMail(email, subject, message))
      );
      reasons.forEach((reason, n) => {
        if (reason) { failed++; errors.push({ email: slice[n], error: reason }); }
        else sent++;
      });
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
            // premiumExpiry is the field that is actually written; premiumUntil
            // was the older name and is still read so nothing from before is lost
            premiumUntil: toIso(d.premiumExpiry) || toIso(d.premiumUntil),
            premiumPlan: d.premiumPlan || null,
            payments: Array.isArray(d.payments) ? d.payments : [],
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
// ─── Premium: grant, request, approve ─────────────────────────────────────────

const PLANS = {
  half: { label: "חצי שנה", months: 6,  amount: 149 },
  year: { label: "שנה",     months: 12, amount: 249 },
};

// Extends from whichever is later: today, or an existing expiry. Renewing early
// must not cost the customer the days they already paid for.
function addMonths(from, months) {
  const d = new Date(from.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

async function grantPremium(uid, { months, amount, plan, method, note }) {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};

  const now = new Date();
  const current = data.premiumExpiry && data.premiumExpiry.toDate
    ? data.premiumExpiry.toDate() : null;
  const base = (current && current > now) ? current : now;
  const expiry = addMonths(base, months);

  const payment = {
    at: new Date().toISOString(),
    plan: plan || null,
    months,
    amount: amount == null ? null : Number(amount),
    method: method || "bit",
  };
  if (note) payment.note = note;

  await ref.set({
    premium: true,
    premiumSince: data.premiumSince || admin.firestore.Timestamp.fromDate(now),
    premiumExpiry: admin.firestore.Timestamp.fromDate(expiry),
    premiumPlan: plan || null,
    payments: admin.firestore.FieldValue.arrayUnion(payment),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { expiry, extended: !!(current && current > now) };
}

function fmtDate(d) {
  return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
}

// A request filed from the site tells the owner someone claims to have paid.
// It grants nothing — the money is verified in Bit, then approved by hand.
exports.onPremiumRequest = onDocumentCreated(
  { document: "premiumRequests/{reqId}", region: "us-central1" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const r = snap.data() || {};
    if (r.status !== "pending") return;

    // One open request per account. Without this a single person could file
    // dozens and bury the real ones in the owner's inbox.
    const existing = await db.collection("premiumRequests")
      .where("uid", "==", r.uid).where("status", "==", "pending").get();
    const others = existing.docs.filter((d) => d.id !== event.params.reqId);
    if (others.length) {
      await snap.ref.update({
        status: "duplicate",
        note: "בקשה פתוחה כבר קיימת",
      });
      console.log("Duplicate premium request from", r.email, "— ignored");
      return;
    }

    // Single-use secret so the approve link works from the phone without a
    // login, and only for whoever received this email.
    const token = require("crypto").randomBytes(24).toString("hex");
    await snap.ref.update({ approveToken: token });

    const plan = PLANS[r.plan] || { label: r.plan || "—", months: r.months || 0 };
    const base = `https://us-central1-lamdani-eng.cloudfunctions.net/approvePremium`;
    const link = `${base}?id=${event.params.reqId}&token=${token}`;

    await sendMail(ADMIN_EMAIL,
      `בקשת גישה — ${r.payerName || r.email} · ${plan.label} ${r.amount || ""}₪`,
      `בקשת גישה מלאה\n` +
      `────────────────────\n` +
      `שם בביט : ${r.payerName || "—"}\n` +
      `טלפון   : ···${r.phoneLast4 || "—"}\n` +
      `אימייל  : ${r.email || "—"}\n` +
      `חבילה   : ${plan.label} · ${r.amount || "—"} ₪\n\n` +
      `ודא בביט שהתשלום נכנס, ורק אז אשר:\n\n` +
      `${link}\n\n` +
      `הקישור חד-פעמי. אישור יפתח את הגישה ל-${plan.months} חודשים ` +
      `וישלח הודעה למשתמש.`
    );
  }
);

// Opened from the approval email. Verifies the one-time token, grants the
// access and tells the customer — all from a single tap on a phone.
exports.approvePremium = onRequest(async (req, res) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  const page = (title, body, colour) => `<!doctype html><html lang="he" dir="rtl"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title></head>
    <body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;padding:2rem">
    <div style="max-width:420px;margin:3rem auto;background:#fff;border-radius:16px;
                padding:2rem;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.08)">
      <div style="font-size:2.6rem">${colour}</div>
      <h1 style="font-size:1.3rem;color:#0f172a;margin:.6rem 0 1rem">${title}</h1>
      <div style="color:#475569;line-height:1.8;font-size:.98rem">${body}</div>
    </div></body></html>`;

  const { id, token } = req.query || {};
  if (!id || !token) return res.status(400).send(page("בקשה לא תקינה", "חסרים פרטים בקישור.", "⚠️"));

  try {
    const ref = db.collection("premiumRequests").doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).send(page("הבקשה לא נמצאה", "ייתכן שנמחקה.", "⚠️"));

    const r = snap.data();
    if (r.approveToken !== token) {
      return res.status(403).send(page("קישור לא תקף", "הקישור שגוי או כבר נוצל.", "🚫"));
    }
    if (r.status === "approved") {
      return res.send(page("כבר אושר", "הבקשה הזו אושרה קודם לכן. לא בוצע שינוי נוסף.", "✓"));
    }

    const plan = PLANS[r.plan] || { label: r.plan, months: r.months || 6 };
    const { expiry, extended } = await grantPremium(r.uid, {
      months: plan.months, amount: r.amount, plan: r.plan, method: "bit",
      note: `${r.payerName || ""} ···${r.phoneLast4 || ""}`.trim(),
    });

    await ref.update({
      status: "approved",
      approvedAt: new Date().toISOString(),
      approveToken: admin.firestore.FieldValue.delete(),   // burn the one-time link
    });

    if (r.email) {
      await sendMail(r.email, "הגישה נפתחה — למדני אנגלית",
        `שלום,\n\nהתשלום אומת והגישה המלאה נפתחה.\n\n` +
        `החבילה : ${plan.label}\n` +
        `בתוקף עד : ${fmtDate(expiry)}\n\n` +
        `כל התכנים פתוחים עכשיו — אוצר מילים, דקדוק, הבנת הנקרא ותרגול משפטים.\n\n` +
        `https://lamdanien.co.il/app.html\n\nתודה,\nלמדני אנגלית`);
    }

    res.send(page("הגישה נפתחה ✓",
      `<b>${r.payerName || r.email}</b><br>${plan.label} · ${r.amount || "—"} ₪<br><br>` +
      `בתוקף עד <b>${fmtDate(expiry)}</b>` +
      (extended ? "<br><small>נוסף על התקופה הקיימת</small>" : "") +
      `<br><br><small>נשלחה הודעה למשתמש.</small>`, "✅"));

  } catch (err) {
    console.error("approvePremium:", err);
    res.status(500).send(page("שגיאה", "לא הצלחנו להשלים את הפעולה. נסה שוב.", "⚠️"));
  }
});

// Admin panel: grant access by hand — a gift, a trial, or a payment that came
// in some other way.
exports.adminGrantPremium = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    let callerEmail;
    try {
      callerEmail = (await admin.auth().verifyIdToken(idToken)).email;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden" });

    const { uid, months, amount, plan, notify } = req.body || {};
    const m = parseInt(months, 10);
    if (!uid || !m || m < 1) return res.status(400).json({ error: "Missing uid or months" });

    try {
      const { expiry, extended } = await grantPremium(uid, {
        months: m, amount, plan: plan || null, method: "manual",
      });

      if (notify) {
        const u = await admin.auth().getUser(uid).catch(() => null);
        if (u && u.email) {
          await sendMail(u.email, "הגישה נפתחה — למדני אנגלית",
            `שלום,\n\nהגישה המלאה לאתר נפתחה עבורך.\n\n` +
            `בתוקף עד : ${fmtDate(expiry)}\n\n` +
            `https://lamdanien.co.il/app.html\n\nתודה,\nלמדני אנגלית`);
        }
      }
      res.json({ ok: true, expiry: expiry.toISOString(), extended });
    } catch (err) {
      console.error("adminGrantPremium:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Admin panel: revoke access, for a refund or a mistake.
exports.adminRevokePremium = onRequest(
  { cors: [SITE_URL] },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Unauthorized" });
    let callerEmail;
    try {
      callerEmail = (await admin.auth().verifyIdToken(idToken)).email;
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (callerEmail !== ADMIN_EMAIL) return res.status(403).json({ error: "Forbidden" });

    const { uid } = req.body || {};
    if (!uid) return res.status(400).json({ error: "Missing uid" });

    await db.collection("users").doc(uid).set({
      premium: false,
      premiumExpiry: admin.firestore.FieldValue.delete(),
      premiumPlan: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({ ok: true });
  }
);

// Runs once a day: warns anyone a week from expiry, and clears out requests
// nobody acted on. Deliberately the only scheduled job on the project, and it
// cannot charge anything — it only sends mail and tidies up.
exports.dailyMaintenance = onSchedule(
  { schedule: "0 9 * * *", timeZone: "Asia/Jerusalem", timeoutSeconds: 540 },
  async () => {
    const now = Date.now();
    const DAY = 86400000;

    // ── expiry reminders, 7 days out ──────────────────────────────────────
    const soon = admin.firestore.Timestamp.fromDate(new Date(now + 7 * DAY));
    const today = admin.firestore.Timestamp.fromDate(new Date(now));
    const due = await db.collection("users")
      .where("premium", "==", true)
      .where("premiumExpiry", ">", today)
      .where("premiumExpiry", "<=", soon)
      .get();

    let reminded = 0;
    for (const doc of due.docs) {
      const d = doc.data();
      // once only — otherwise they get the same warning every morning for a week
      if (d.renewalReminderSent) continue;

      const exp = d.premiumExpiry.toDate();
      const days = Math.ceil((exp.getTime() - now) / DAY);
      const rec = await admin.auth().getUser(doc.id).catch(() => null);
      const to = rec && rec.email ? rec.email : d.email;
      if (!to) continue;

      const reason = await sendMail(to, "הגישה שלך מסתיימת בקרוב — למדני אנגלית",
        `שלום,\n\n` +
        `הגישה המלאה שלך בלמדני אנגלית מסתיימת בעוד ${days} ימים, בתאריך ${fmtDate(exp)}.\n\n` +
        `לחידוש:\nhttps://lamdanien.co.il/premium.html\n\n` +
        `חשוב לדעת: הגישה לא תיחסם. החשבון יחזור למצב רשום, ` +
        `הנושאים הפתוחים יישארו זמינים, וכל ההתקדמות של הילדים תישמר במלואה.\n\n` +
        `תודה,\nלמדני אנגלית`);

      if (!reason) {
        await doc.ref.update({ renewalReminderSent: new Date().toISOString() });
        reminded++;
      }
    }

    // Clear the flag once renewed, so the next cycle can warn again
    const future = admin.firestore.Timestamp.fromDate(new Date(now + 8 * DAY));
    const renewed = await db.collection("users")
      .where("premiumExpiry", ">", future).get();
    let cleared = 0;
    for (const doc of renewed.docs) {
      if (!doc.data().renewalReminderSent) continue;
      await doc.ref.update({ renewalReminderSent: admin.firestore.FieldValue.delete() });
      cleared++;
    }

    // ── stale requests ────────────────────────────────────────────────────
    const cutoff = new Date(now - 14 * DAY).toISOString();
    const old = await db.collection("premiumRequests")
      .where("status", "==", "pending").get();
    let closed = 0;
    for (const doc of old.docs) {
      if (String(doc.data().createdAt || "") >= cutoff) continue;
      await doc.ref.update({ status: "expired", expiredAt: new Date().toISOString() });
      closed++;
    }

    console.log(`dailyMaintenance: ${reminded} reminded, ${cleared} flags cleared, ${closed} stale requests closed`);
  }
);

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
