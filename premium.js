// premium.js — ניהול גישה לתכנים
// כדי להוסיף משתמש: הוסף את האימייל שלו לרשימה למטה

var PREMIUM_EMAILS = [
    'ishaieran@gmail.com'
    // 'email2@example.com',
    // 'email3@example.com',
];

function isPremium() {
    if (typeof getUser !== 'function') return false;
    var u = getUser();
    if (!u) return false;
    return PREMIUM_EMAILS.indexOf(u.email) !== -1;
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
