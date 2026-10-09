// premium.js — ניהול גישה לתכנים
//
// שלוש דרגות:
//   אורח   — לא מחובר · רואה את השלבים החופשיים בלבד
//   רשום   — מחובר ללא תשלום · אותה גישה, אך ההתקדמות נשמרת
//   פרימיום — שילם ובתוקף · גישה מלאה
//
// הרשאת הפרימיום נקבעת בשרת בלבד. הדפדפן רק קורא אותה — חוקי Firestore
// חוסמים כתיבה לשדות האלה, כך שאי אפשר לפתוח גישה מצד הלקוח.

// נושאים/שלבים חופשיים לכולם
var FREE_VOCAB_INDICES    = [0, 3, 6];   // כינויי גוף, מספרים, ימות השבוע
var FREE_GRAMMAR_INDICES  = [12];         // TO BE (שלב 1)
var FREE_READING_LEVEL    = 0;            // רמה 1 — קטע ראשון בלבד
var FREE_SENTENCES_LEVELS = [0, 4];       // צמדי מילים + מחיי היום יום
var FREE_SENTENCES_COUNT  = 3;            // שאלות ראשונות חינם בכל רמה פתוחה

// ── מצב הפרימיום, כפי שנטען מ-Firestore בכניסה ────────────────────
// נקבע ב-firestore-sync.js. ברירת המחדל היא "אין גישה", כך שתקלת רשת
// לא פותחת תוכן בטעות.
window._fsPremium       = window._fsPremium       || false;   // השדה premium
window._fsPremiumExpiry = window._fsPremiumExpiry || null;    // ISO, או null לתמיד

function isLoggedIn() {
    if (typeof getParent !== 'function') return false;
    var p = getParent();
    return !!(p && (p.uid || p.email));
}

// פרימיום = גם מסומן וגם בתוקף. מנוי שפג מחזיר את המשתמש לגישה חלקית,
// לא חוסם אותו — הוא עדיין נכנס ורואה את ההתקדמות של הילדים.
function isPremium() {
    if (!isLoggedIn()) return false;
    if (!window._fsPremium) return false;
    return !isPremiumExpired();
}

function isPremiumExpired() {
    var exp = window._fsPremiumExpiry;
    if (!exp) return false;                  // ללא תאריך = ללא הגבלה
    var t = Date.parse(exp);
    if (isNaN(t)) return false;              // תאריך פגום — לא נועלים בגללו
    return t < Date.now();
}

// כמה ימים נותרו, או null אם אין תוקף / כבר פג
function premiumDaysLeft() {
    var exp = window._fsPremiumExpiry;
    if (!exp) return null;
    var t = Date.parse(exp);
    if (isNaN(t)) return null;
    var days = Math.ceil((t - Date.now()) / 86400000);
    return days > 0 ? days : null;
}

function requirePremium() {
    if (isPremium()) return true;
    showPaywall();
    return false;
}

function showPaywall() {
    var el = document.getElementById('paywallOverlay');
    if (el) el.style.display = 'flex';
}

function closePaywall() {
    var el = document.getElementById('paywallOverlay');
    if (el) el.style.display = 'none';
}
