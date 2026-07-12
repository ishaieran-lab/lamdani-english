// ════════════════════════════════════════════════════════════════
// user.js — ניהול משתמשים והתקדמות (משותף לכל הדפים)
// ════════════════════════════════════════════════════════════════

// ── תפריט ניווט עליון ──────────────────────────────────────────
function toggleNavMenu() {
    var panel = document.getElementById('navMenuPanel');
    if (!panel) return;
    panel.classList.toggle('open');
}
document.addEventListener('click', function(e) {
    var btn = document.getElementById('navMenuBtn');
    var panel = document.getElementById('navMenuPanel');
    if (!panel || !btn) return;
    if (!btn.contains(e.target) && !panel.contains(e.target)) {
        panel.classList.remove('open');
    }
});

var USER_KEY  = 'engUser';    // המשתמש הפעיל כרגע
var USERS_KEY = 'engUsers';   // רשימת כל המשתמשים
var PROG_KEY  = 'engProgress'; // prefix להתקדמות לפי משתמש
var VOCAB_VER = '4';          // להעלות כשמשתנה סדר/מבנה VOCAB

// ── אחסון ──────────────────────────────────────────────────────
function getUser()     { try{return JSON.parse(localStorage.getItem(USER_KEY))||null;}catch(e){return null;} }
function saveUser(u)   { localStorage.setItem(USER_KEY,JSON.stringify(u)); }
function clearUser()   { localStorage.removeItem(USER_KEY); }

function getUsers()    { try{return JSON.parse(localStorage.getItem(USERS_KEY))||[];}catch(e){return [];} }
function saveUsers(a)  { localStorage.setItem(USERS_KEY,JSON.stringify(a)); }

function getProgress() {
    var u = getUser();
    var k = u ? PROG_KEY + '_' + u.id : PROG_KEY;
    try{return JSON.parse(localStorage.getItem(k))||{};}catch(e){return {};}
}
function saveProgress(p) {
    var u = getUser();
    var k = u ? PROG_KEY + '_' + u.id : PROG_KEY;
    localStorage.setItem(k, JSON.stringify(p));
}

// ── מיגרציה ממשתמש ישן (ללא id) ────────────────────────────────
function _migrate() {
    var u = getUser();
    if (!u) return;
    if (!u.id) {
        u.id = 'usr_' + Date.now();
        saveUser(u);
        var oldP = localStorage.getItem(PROG_KEY);
        if (oldP) {
            localStorage.setItem(PROG_KEY + '_' + u.id, oldP);
            localStorage.removeItem(PROG_KEY);
        }
    }
    var users = getUsers();
    if (!users.find(function(x){ return x.id === u.id; })) {
        users.push(u);
        saveUsers(users);
    }
}

// ── אוואטר ─────────────────────────────────────────────────────
function getAvatarEmoji(gender, age) {
    age = parseInt(age) || 20;
    if (gender === 'female') return age < 18 ? '👧' : age >= 60 ? '👵' : '👩';
    return age < 18 ? '👦' : age >= 60 ? '👴' : '👨';
}
function getAvatarColor(gender) {
    return gender === 'female' ? '#db2777' : '#2563eb';
}

// ── רישום התקדמות ───────────────────────────────────────────────
function logProgress(module, stageIdx, type, score) {
    if (!getUser()) return;
    var p = getProgress();
    if (!p[module]) p[module] = {};
    if (!p[module][stageIdx]) p[module][stageIdx] = {};
    var s = p[module][stageIdx];
    s.lastActivity = new Date().toISOString();
    if (type === 'rule')      s.ruleViewed     = true;
    if (type === 'vocab')     s.vocabViewed    = true;
    if (type === 'examples')  s.examplesViewed = true;
    if (type === 'grammar')   { s.grammarAttempts=(s.grammarAttempts||0)+1; s.grammarBest=Math.min(100,Math.max(s.grammarBest||0,score||0)); }
    if (type === 'vocabQuiz') { s.vocabAttempts =(s.vocabAttempts||0)+1;   s.vocabBest  =Math.min(100,score||0); }
    if (type === 'match')     { s.matchAttempts =(s.matchAttempts||0)+1;   s.matchBest  =Math.min(100,Math.max(s.matchBest||0,  score||0)); }
    saveProgress(p);
    if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
}

function getStageStatus(module, idx) {
    var p = getProgress();
    if (!p[module] || !p[module][idx]) return 'none';
    var s = p[module][idx];
    var practiced = s.grammarBest !== undefined || s.vocabBest !== undefined;
    if (practiced) return 'complete';
    return 'none';
}

// ── סרגל ניווט ─────────────────────────────────────────────────
function renderUserNav() {
    var el = document.getElementById('userNavArea');
    if (!el) return;
    var u = getUser();
    if (!u) {
        el.innerHTML =
            '<button class="u-login-btn" onclick="openLoginModal()">כניסת משתמש</button>';
    } else {
        var emoji = getAvatarEmoji(u.gender, u.age);
        var color = getAvatarColor(u.gender);
        var hasOthers = getUsers().filter(function(x){ return x.id !== u.id; }).length > 0;
        el.innerHTML =
            '<div class="u-chip" onclick="uToggleMenu(event)">' +
                '<span class="u-av-sm" style="background:' + color + '">' + emoji + '</span>' +
                '<span class="u-chip-name">' + u.username + '</span>' +
                '<span class="u-chip-arr">▾</span>' +
            '</div>' +
            '<div class="u-menu" id="uMenu" style="display:none">' +
                '<div class="u-menu-head">' +
                    '<span class="u-av-lg" style="background:' + color + '">' + emoji + '</span>' +
                    '<div>' +
                        '<div class="u-menu-uname">' + u.username + '</div>' +
                        '<div class="u-menu-sub">גיל ' + u.age + ' · ' + (u.gender === 'female' ? 'נקבה' : 'זכר') + '</div>' +
                    '</div>' +
                '</div>' +
                '<button class="u-menu-item" onclick="openLoginModal(\'edit\')">✏️ ערוך פרופיל</button>' +
                '<button class="u-menu-item" onclick="openLoginModal(\'select\')">👥 החלף משתמש</button>' +
                '<button class="u-menu-item u-menu-logout" onclick="uLogout()">🚪 התנתק</button>' +
            '</div>';
    }
    if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
}

function uToggleMenu(e) {
    e.stopPropagation();
    var m = document.getElementById('uMenu');
    if (m) m.style.display = (m.style.display === 'none') ? 'block' : 'none';
}

document.addEventListener('click', function() {
    var m = document.getElementById('uMenu');
    if (m) m.style.display = 'none';
});

function uLogout() {
    if (confirm('להתנתק?')) {
        clearUser();
        renderUserNav();
        if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
    }
}

// ── מודל כניסה ─────────────────────────────────────────────────
var _sg       = 'male';
var _formMode = 'create'; // 'create' | 'edit'

function openLoginModal(mode) {
    var ov = document.getElementById('uLoginOv');
    if (!ov) { _buildModal(); ov = document.getElementById('uLoginOv'); }

    var users = getUsers();
    if (!mode) mode = users.length > 0 ? 'select' : 'create';
    if (mode === 'select' && users.length === 0) mode = 'create';

    if (mode === 'select') {
        _showSelectView();
    } else if (mode === 'edit') {
        _showFormView(true);
    } else {
        _showFormView(false);
    }

    ov.style.display = 'flex';
}

function closeLoginModal() {
    var ov = document.getElementById('uLoginOv');
    if (ov) ov.style.display = 'none';
}

// ── תצוגת בחירת משתמש ──────────────────────────────────────────
function _showSelectView() {
    var users = getUsers();
    var cur   = getUser();

    document.getElementById('uSelectView').style.display = 'block';
    document.getElementById('uFormView').style.display   = 'none';

    document.getElementById('uUserList').innerHTML = users.map(function(u) {
        var emoji = getAvatarEmoji(u.gender, u.age);
        var color = getAvatarColor(u.gender);
        var isCur = cur && cur.id === u.id;
        return '<div class="u-user-item' + (isCur ? ' u-user-current' : '') + '" onclick="selectExistingUser(\'' + u.id + '\')">' +
            '<span class="u-av-sm" style="background:' + color + '">' + emoji + '</span>' +
            '<div class="u-user-item-info">' +
                '<span class="u-user-item-name">' + u.username + '</span>' +
                '<span class="u-user-item-sub">גיל ' + u.age + ' · ' + (u.gender === 'female' ? 'נקבה' : 'זכר') + (isCur ? ' · פעיל' : '') + '</span>' +
            '</div>' +
            '<span class="u-user-item-arrow">←</span>' +
        '</div>';
    }).join('');
}

function selectExistingUser(id) {
    var users = getUsers();
    var u = null;
    for (var i = 0; i < users.length; i++) {
        if (users[i].id === id) { u = users[i]; break; }
    }
    if (!u) return;
    saveUser(u);
    closeLoginModal();
    renderUserNav();
    if (typeof window.onUserLogin === 'function') window.onUserLogin();
}

// ── תצוגת טופס יצירה/עריכה ─────────────────────────────────────
function _showFormView(isEdit) {
    _formMode = isEdit ? 'edit' : 'create';
    var hasSavedUsers = getUsers().length > 0;

    document.getElementById('uSelectView').style.display = 'none';
    document.getElementById('uFormView').style.display   = 'block';
    document.getElementById('uFormBack').style.display   = hasSavedUsers ? 'block' : 'none';
    document.getElementById('uFormTitle').textContent    = isEdit ? 'ערוך פרופיל ✏️' : 'משתמש חדש 👤';
    document.getElementById('uFormSub').textContent      = isEdit ? 'עדכן את הפרטים שלך' : 'צור את הפרופיל שלך';

    var u = getUser();
    if (isEdit && u) {
        document.getElementById('uLName').value = u.username;
        document.getElementById('uLAge').value  = u.age;
        _sg = u.gender;
    } else {
        document.getElementById('uLName').value = '';
        document.getElementById('uLAge').value  = '';
        _sg = 'male';
    }
    _refreshGBtns();
    document.getElementById('uLErr').textContent = '';
    setTimeout(function(){ var f = document.getElementById('uLName'); if(f) f.focus(); }, 80);
}

function setGender(g) { _sg = g; _refreshGBtns(); }

function _refreshGBtns() {
    var bm = document.getElementById('gBtnM'), bf = document.getElementById('gBtnF');
    if (bm) bm.className = 'gender-btn' + (_sg === 'male'   ? ' active' : '');
    if (bf) bf.className = 'gender-btn' + (_sg === 'female' ? ' active' : '');
}

// ── שמירת משתמש ────────────────────────────────────────────────
function submitLogin() {
    var name = (document.getElementById('uLName').value || '').trim();
    var age  = parseInt(document.getElementById('uLAge').value) || 0;
    var err  = document.getElementById('uLErr');
    if (!name)              { err.textContent = 'נא להזין שם משתמש'; return; }
    if (age < 5 || age > 120) { err.textContent = 'נא להזין גיל תקין (5–120)'; return; }
    err.textContent = '';

    var cur = getUser();
    var userData;
    if (_formMode === 'edit' && cur) {
        userData = { id: cur.id, username: name, age: age, gender: _sg };
    } else {
        userData = { id: 'usr_' + Date.now(), username: name, age: age, gender: _sg };
    }

    var users = getUsers();
    var found = false;
    for (var i = 0; i < users.length; i++) {
        if (users[i].id === userData.id) { users[i] = userData; found = true; break; }
    }
    if (!found) users.push(userData);
    saveUsers(users);
    saveUser(userData);

    closeLoginModal();
    renderUserNav();
    if (typeof window.onUserLogin === 'function') window.onUserLogin();
}

// ── בניית המודל ─────────────────────────────────────────────────
function _buildModal() {
    var d = document.createElement('div');
    d.id = 'uLoginOv';
    d.className = 'u-login-ov';
    d.style.display = 'none';
    d.innerHTML =
        '<div class="u-login-box" onclick="event.stopPropagation()">' +
            '<button class="u-login-x" onclick="closeLoginModal()">✕</button>' +

            // ── תצוגת בחירה ──────────────────────────────────
            '<div id="uSelectView">' +
                '<div class="u-login-title">מי מתחבר? 👋</div>' +
                '<div id="uUserList" class="u-user-list"></div>' +
                '<button class="u-new-user-btn" onclick="_showFormView(false)">＋ משתמש חדש</button>' +
            '</div>' +

            // ── טופס יצירה/עריכה ─────────────────────────────
            '<div id="uFormView" style="display:none">' +
                '<button id="uFormBack" class="u-form-back" onclick="_showSelectView()" style="display:none">→ חזור למשתמשים</button>' +
                '<div class="u-login-title" id="uFormTitle">משתמש חדש 👤</div>' +
                '<div class="u-login-sub"  id="uFormSub">צור את הפרופיל שלך</div>' +
                '<div class="u-field">' +
                    '<label class="u-label">שם משתמש</label>' +
                    '<input id="uLName" class="u-input" type="text" placeholder="השם שלך..." dir="rtl" maxlength="20"' +
                    ' onkeydown="if(event.key===\'Enter\')document.getElementById(\'uLAge\').focus()">' +
                '</div>' +
                '<div class="u-field">' +
                    '<label class="u-label">גיל</label>' +
                    '<input id="uLAge" class="u-input u-age-inp" type="number" placeholder="גיל" min="5" max="120"' +
                    ' onkeydown="if(event.key===\'Enter\')submitLogin()">' +
                '</div>' +
                '<div class="u-field">' +
                    '<label class="u-label">מין</label>' +
                    '<div style="display:flex;gap:0.5rem">' +
                        '<button id="gBtnM" class="gender-btn active" onclick="setGender(\'male\')">👦 זכר</button>' +
                        '<button id="gBtnF" class="gender-btn" onclick="setGender(\'female\')">👧 נקבה</button>' +
                    '</div>' +
                '</div>' +
                '<div id="uLErr" class="u-err"></div>' +
                '<button class="btn-primary u-submit-btn" onclick="submitLogin()">כנס ←</button>' +
            '</div>' +
        '</div>';
    d.onclick = function(e) { if (e.target === d) closeLoginModal(); };
    document.body.appendChild(d);
}

// ── איפוס ציוני אוצר מילים בעת שינוי גרסה ─────────────────────
function _resetVocabIfNeeded() {
    if (localStorage.getItem('vocabVer') === VOCAB_VER) return;
    var users = getUsers();
    users.forEach(function(u) {
        var k = PROG_KEY + '_' + u.id;
        try {
            var p = JSON.parse(localStorage.getItem(k)) || {};
            delete p['vocabulary'];
            localStorage.setItem(k, JSON.stringify(p));
        } catch(e) {}
    });
    // גם התקדמות ללא משתמש
    try {
        var p0 = JSON.parse(localStorage.getItem(PROG_KEY)) || {};
        delete p0['vocabulary'];
        localStorage.setItem(PROG_KEY, JSON.stringify(p0));
    } catch(e) {}
    localStorage.setItem('vocabVer', VOCAB_VER);
}

// ── אתחול ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
    _migrate();
    _resetVocabIfNeeded();
    renderUserNav();
});

// ── Backspace = חזור ────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
    if (e.key !== 'Backspace') return;
    var tag = (document.activeElement || {}).tagName || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.activeElement && document.activeElement.isContentEditable) return;
    e.preventDefault();
    if (typeof window.onBackspace === 'function') window.onBackspace();
});
