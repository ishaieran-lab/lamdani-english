// premium.js — ניהול גישה לתכנים
// כדי להוסיף משתמש: הוסף את האימייל שלו לרשימה למטה

// נושאים/שלבים חופשיים לכולם
var FREE_VOCAB_INDICES   = [0, 3, 6];   // כינויי גוף, מספרים, ימות השבוע
var FREE_GRAMMAR_INDICES = [12];          // TO BE (שלב 1)
var FREE_READING_LEVEL   = 0;             // רמה 1 — קטע ראשון בלבד

var PREMIUM_EMAILS = [
    'ishaieran@gmail.com'
    // 'email2@example.com',
    // 'email3@example.com',
];

function isPremium() {
    // getParent() = ההורה הרשום — יש לו email מ-Firebase
    if (typeof getParent === 'function') {
        var p = getParent();
        if (p && PREMIUM_EMAILS.indexOf(p.email) !== -1) return true;
    }
    return false;
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
