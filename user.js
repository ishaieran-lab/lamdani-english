// ════════════════════════════════════════════════════════════════
// user.js — ניהול הורה, ילדים והתקדמות
// ════════════════════════════════════════════════════════════════

// ── תמונת פרופיל ────────────────────────────────────────────────
var _kidPhoto   = '';
var _kidEditId  = '';
var _editMode   = false; // true = edit form, false = add form

function _openAvatarMenu() {
    var menu = document.getElementById('avatarMenu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') {
        setTimeout(function() {
            document.addEventListener('click', function _closeMenu(e) {
                if (!menu.contains(e.target)) { menu.style.display = 'none'; }
                document.removeEventListener('click', _closeMenu);
            });
        }, 10);
    }
}
function _avatarPickCamera() {
    _editMode = false;
    document.getElementById('avatarMenu').style.display = 'none';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('kidAvatarInputCamera').click();
        return;
    }
    var ov = document.createElement('div');
    ov.id = 'cameraOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:20000;display:flex;align-items:center;justify-content:center;direction:rtl;';
    ov.innerHTML =
        '<div style="background:#111;overflow:hidden;max-width:92vw;text-align:center;">' +
            '<video id="camVideo" autoplay playsinline muted style="display:block;width:100%;max-width:380px;max-height:55vh;object-fit:cover;background:#000;"></video>' +
            '<div style="padding:0.9rem;display:flex;gap:0.8rem;justify-content:center;">' +
                '<button onclick="_capturePhoto()" style="padding:0.65rem 2rem;background:#2563eb;color:#fff;border:none;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">📷 צלם</button>' +
                '<button onclick="_closeCameraOv()" style="padding:0.65rem 1.4rem;background:#374151;color:#fff;border:none;font-size:1rem;cursor:pointer;font-family:inherit;">ביטול</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(ov);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(function(stream) {
            window._camStream = stream;
            document.getElementById('camVideo').srcObject = stream;
        })
        .catch(function() {
            _closeCameraOv();
            document.getElementById('kidAvatarInputCamera').click();
        });
}
function _capturePhoto() {
    var v = document.getElementById('camVideo');
    if (!v) return;
    var c = document.createElement('canvas');
    var max = 200, scale = Math.min(max / v.videoWidth, max / v.videoHeight, 1);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    _kidPhoto = c.toDataURL('image/jpeg', 0.75);
    var pfx = _editMode ? 'kidEditAvatar' : 'kidAvatar';
    var av = document.getElementById(pfx + 'Img'), em = document.getElementById(pfx + 'Emoji');
    if (av) { av.src = _kidPhoto; av.style.display = 'block'; }
    if (em) em.style.display = 'none';
    _closeCameraOv();
}
function _closeCameraOv() {
    if (window._camStream) { window._camStream.getTracks().forEach(function(t){t.stop();}); window._camStream=null; }
    var ov = document.getElementById('cameraOv'); if (ov) ov.remove();
}
function _avatarPickGallery() { _editMode = false; document.getElementById('avatarMenu').style.display='none'; document.getElementById('kidAvatarInputGallery').click(); }

function _openEditAvatarMenu() {
    _editMode = true;
    var menu = document.getElementById('editAvatarMenu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    if (menu.style.display === 'block') {
        setTimeout(function() {
            document.addEventListener('click', function _c(e) {
                if (!menu.contains(e.target)) { menu.style.display = 'none'; }
                document.removeEventListener('click', _c);
            });
        }, 10);
    }
}
function _editAvatarPickCamera() {
    _editMode = true;
    document.getElementById('editAvatarMenu').style.display = 'none';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('kidEditAvatarInputCamera').click();
        return;
    }
    var ov = document.createElement('div');
    ov.id = 'cameraOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:20000;display:flex;align-items:center;justify-content:center;direction:rtl;';
    ov.innerHTML =
        '<div style="background:#111;overflow:hidden;max-width:92vw;text-align:center;">' +
            '<video id="camVideo" autoplay playsinline muted style="display:block;width:100%;max-width:380px;max-height:55vh;object-fit:cover;background:#000;"></video>' +
            '<div style="padding:0.9rem;display:flex;gap:0.8rem;justify-content:center;">' +
                '<button onclick="_capturePhoto()" style="padding:0.65rem 2rem;background:#2563eb;color:#fff;border:none;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">📷 צלם</button>' +
                '<button onclick="_closeCameraOv()" style="padding:0.65rem 1.4rem;background:#374151;color:#fff;border:none;font-size:1rem;cursor:pointer;font-family:inherit;">ביטול</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(ov);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(function(stream) {
            window._camStream = stream;
            document.getElementById('camVideo').srcObject = stream;
        })
        .catch(function() {
            _closeCameraOv();
            document.getElementById('kidEditAvatarInputCamera').click();
        });
}
function _editAvatarPickGallery() { _editMode = true; document.getElementById('editAvatarMenu').style.display='none'; document.getElementById('kidEditAvatarInputGallery').click(); }

function _setKidAvatar(input) {
    if (!input.files || !input.files[0]) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        var imgEl = new Image();
        imgEl.onload = function() {
            var canvas = document.createElement('canvas');
            var max = 200;
            var scale = Math.min(max / imgEl.width, max / imgEl.height, 1);
            canvas.width = Math.round(imgEl.width * scale);
            canvas.height = Math.round(imgEl.height * scale);
            canvas.getContext('2d').drawImage(imgEl, 0, 0, canvas.width, canvas.height);
            _kidPhoto = canvas.toDataURL('image/jpeg', 0.75);
            var pfx = _editMode ? 'kidEditAvatar' : 'kidAvatar';
            var av = document.getElementById(pfx + 'Img'), em = document.getElementById(pfx + 'Emoji');
            if (av) { av.src = _kidPhoto; av.style.display = 'block'; }
            if (em) em.style.display = 'none';
        };
        imgEl.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
}

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
    if (!btn.contains(e.target) && !panel.contains(e.target))
        panel.classList.remove('open');
});

// ── מפתחות localStorage ─────────────────────────────────────────
var PARENT_KEY   = 'fbParent';         // { uid, email, name }
var KIDS_PREFIX  = 'engKids_';         // engKids_{uid} → מערך ילדים
var ACTIVE_KID   = 'activeKid';        // הילד הפעיל כרגע
var PROG_KEY     = 'engProgress';      // prefix להתקדמות
var VOCAB_VER    = '4';

// ── הורה ────────────────────────────────────────────────────────
function getParent()     { try{return JSON.parse(localStorage.getItem(PARENT_KEY))||null;}catch(e){return null;} }
function saveParent(p)   { localStorage.setItem(PARENT_KEY, JSON.stringify(p)); }
function clearParent()   { localStorage.removeItem(PARENT_KEY); }

// ── ילדים ───────────────────────────────────────────────────────
function getChildren() {
    var p = getParent();
    if (!p) return [];
    try { return JSON.parse(localStorage.getItem(KIDS_PREFIX + p.uid)) || []; } catch(e) { return []; }
}
function saveChildren(arr) {
    var p = getParent();
    if (!p) return;
    localStorage.setItem(KIDS_PREFIX + p.uid, JSON.stringify(arr));
}

// ── ילד פעיל ────────────────────────────────────────────────────
function getActiveKid()      { try{return JSON.parse(localStorage.getItem(ACTIVE_KID))||null;}catch(e){return null;} }
function setActiveKid(kid)   { localStorage.setItem(ACTIVE_KID, JSON.stringify(kid)); }
function clearActiveKid()    { localStorage.removeItem(ACTIVE_KID); }

// ── getUser — תאימות לשאר הקוד ──────────────────────────────────
function getUser() {
    var kid = getActiveKid();
    if (!kid) return null;
    return { id: kid.id, username: kid.name, gender: kid.gender, age: kid.age };
}
function saveUser(u)  {}   // לא בשימוש — שמירה דרך setActiveKid
function clearUser()  { clearActiveKid(); }

// ── התקדמות ─────────────────────────────────────────────────────
function getProgress() {
    var kid = getActiveKid();
    var k = kid ? PROG_KEY + '_' + kid.id : PROG_KEY;
    try { return JSON.parse(localStorage.getItem(k)) || {}; } catch(e) { return {}; }
}
function saveProgress(p) {
    var kid = getActiveKid();
    var k = kid ? PROG_KEY + '_' + kid.id : PROG_KEY;
    localStorage.setItem(k, JSON.stringify(p));
}

// ── compat stubs ─────────────────────────────────────────────────
function getUsers()    { return getChildren(); }
function saveUsers(a)  { saveChildren(a); }

// ── אוואטר ─────────────────────────────────────────────────────
function getAvatarEmoji(gender, age) {
    age = parseInt(age) || 10;
    if (gender === 'female') return age < 18 ? '👧' : '👩';
    return age < 18 ? '👦' : '👨';
}
function getAvatarColor(gender) {
    return gender === 'female' ? '#db2777' : '#2563eb';
}

// ── רישום התקדמות ───────────────────────────────────────────────
function logProgress(module, stageIdx, type, score) {
    if (!getActiveKid()) return;
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
    if (type === 'match')     { s.matchAttempts =(s.matchAttempts||0)+1;   s.matchBest  =Math.min(100,Math.max(s.matchBest||0,score||0)); }
    saveProgress(p);
    if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
}

function getStageStatus(module, idx) {
    var p = getProgress();
    if (!p[module] || !p[module][idx]) return 'none';
    var s = p[module][idx];
    var practiced = s.grammarBest !== undefined || s.vocabBest !== undefined;
    return practiced ? 'complete' : 'none';
}

// ── סרגל ניווט ─────────────────────────────────────────────────
function renderUserNav() {
    var el = document.getElementById('userNavArea');
    if (!el) return;
    var parent = getParent();
    var kid    = getActiveKid();

    if (!parent) {
        el.innerHTML = '<button class="u-login-btn" onclick="openLoginModal()">כניסה / הרשמה</button>';
    } else if (!kid) {
        el.innerHTML = '<button class="u-login-btn" onclick="openChildPicker()">בחר ילד 👦</button>';
    } else {
        var emoji = getAvatarEmoji(kid.gender, kid.age);
        var color = getAvatarColor(kid.gender);
        var photoStyle = kid.photo
            ? 'background:none;padding:0;overflow:hidden;'
            : 'background:' + color + ';';
        var photoInner = kid.photo
            ? '<img src="' + kid.photo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">'
            : emoji;
        el.innerHTML =
            '<div class="u-chip" onclick="uToggleMenu(event)">' +
                '<span class="u-av-sm" style="' + photoStyle + '">' + photoInner + '</span>' +
                '<span class="u-chip-name">' + kid.name + '</span>' +
                '<span class="u-chip-arr">▾</span>' +
            '</div>' +
            '<div class="u-menu" id="uMenu" style="display:none">' +
                '<div class="u-menu-head">' +
                    '<span class="u-av-lg" style="' + photoStyle + '">' + photoInner + '</span>' +
                    '<div>' +
                        '<div class="u-menu-uname">' + kid.name + '</div>' +
                        '<div class="u-menu-sub">' + (parent.email || '') + '</div>' +
                    '</div>' +
                '</div>' +
                '<button class="u-menu-item" onclick="_openEditCurrentKid()">✏️ עריכת פרופיל</button>' +
                '<button class="u-menu-item" onclick="openChildPicker()">👥 החלף משתמש</button>' +
                '<button class="u-menu-item u-menu-logout" onclick="uLogout()"><img src="images/ui/log-out.png" style="width:1.1rem;height:1.1rem;object-fit:contain;vertical-align:middle;"> התנתק</button>' +
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

function _showConfirm(opts) {
    var existing = document.getElementById('customConfirmOv');
    if (existing) existing.remove();
    var ov = document.createElement('div');
    ov.id = 'customConfirmOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:30000;display:flex;align-items:center;justify-content:center;direction:rtl;';
    var imgOverlay = opts.img
        ? '<div style="position:relative;display:block;">' +
              '<img src="' + opts.img + '" style="width:100%;display:block;">' +
              '<button id="ccCancel" style="position:absolute;left:19%;bottom:11%;width:34%;border:none;background:transparent;cursor:pointer;padding:0;">' +
                  '<img src="images/ui/כפתור ביטול.png" style="width:100%;display:block;">' +
              '</button>' +
              '<button id="ccOk" style="position:absolute;right:19%;bottom:11%;width:34%;border:none;background:transparent;cursor:pointer;padding:0;">' +
                  '<img src="images/ui/כפתור התנתק.png" style="width:100%;display:block;">' +
              '</button>' +
          '</div>'
        : '<div style="padding:1.6rem 1.8rem 1.4rem;text-align:center;">' +
              (opts.icon ? '<div style="font-size:2.4rem;margin-bottom:0.6rem;">' + opts.icon + '</div>' : '') +
              '<div style="font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:0.45rem;">' + opts.title + '</div>' +
              '<div style="font-size:0.92rem;color:#475569;margin-bottom:1.2rem;line-height:1.55;">' + opts.msg + '</div>' +
              '<div style="display:flex;gap:0.75rem;">' +
                  '<button id="ccCancel" style="flex:1;padding:0.65rem;border:1.5px solid #e2e8f0;background:#fff;font-size:0.95rem;font-family:inherit;cursor:pointer;color:#374151;font-weight:600;">' + (opts.cancel || 'ביטול') + '</button>' +
                  '<button id="ccOk" style="flex:1;padding:0.65rem;border:none;background:' + (opts.danger ? '#ef4444' : '#2563eb') + ';color:#fff;font-size:0.95rem;font-family:inherit;cursor:pointer;font-weight:700;">' + opts.ok + '</button>' +
              '</div>' +
          '</div>';
    ov.innerHTML =
        '<div style="width:min(66vw,574px);overflow:hidden;">' +
            imgOverlay +
        '</div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    document.getElementById('ccCancel').onclick = function() { close(); if (opts.onCancel) opts.onCancel(); };
    document.getElementById('ccOk').onclick    = function() { close(); if (opts.onOk)     opts.onOk();     };
    ov.addEventListener('click', function(e) { if (e.target === ov) close(); });
}

function uLogout() {
    _showConfirm({
        img: 'images/ui/התנתקות.jpg',
        title: 'התנתקות',
        msg: 'האם אתה בטוח שברצונך להתנתק?',
        ok: 'התנתק',
        cancel: 'ביטול',
        danger: true,
        onOk: function() {
            clearActiveKid();
            clearParent();
            if (window._firebaseAuth) {
                window._firebaseAuth.signOut().catch(function() { renderUserNav(); });
            } else {
                renderUserNav();
                if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
            }
        }
    });
}

// ── Callbacks מ-Firebase Auth ────────────────────────────────────
window.onFirebaseAuth = function(fbUser) {
    saveParent({ uid: fbUser.uid, email: fbUser.email, name: fbUser.displayName || fbUser.email.split('@')[0] });
    var kids = getChildren();
    if (kids.length === 0 || !getActiveKid()) {
        openChildPicker();
    } else {
        renderUserNav();
        if (typeof window.onUserLogin === 'function') window.onUserLogin();
        if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
    }
};

window.onFirebaseLogout = function() {
    clearActiveKid();
    clearParent();
    renderUserNav();
    if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
};

// ── בוחר ילד ────────────────────────────────────────────────────
var _kidGender = 'male';

function openChildPicker() {
    if (!document.getElementById('kidPickerOv')) _buildKidPicker();
    document.getElementById('kidPickerOv').style.display = 'flex';
    _showKidList();
}

function closeChildPicker() {
    var ov = document.getElementById('kidPickerOv');
    if (ov) ov.style.display = 'none';
}

function _selectKid(id) {
    var kids = getChildren();
    var kid  = kids.find(function(k) { return k.id === id; });
    if (!kid) return;
    setActiveKid(kid);
    closeChildPicker();
    renderUserNav();
    if (typeof window.onUserLogin    === 'function') window.onUserLogin();
    if (typeof window.onProgressUpdated === 'function') window.onProgressUpdated();
}

function _showKidList() {
    var parent = getParent();
    var kids   = getChildren();
    var cur    = getActiveKid();

    document.getElementById('kidListView').style.display = 'block';
    document.getElementById('kidFormView').style.display = 'none';
    var ev = document.getElementById('kidEditView'); if (ev) ev.style.display = 'none';

    var pName = parent ? (parent.name || parent.email) : '';
    document.getElementById('kidPickerLine1').textContent = 'שלום, ' + pName + '!';
    document.getElementById('kidPickerLine2').textContent = 'מי לומד היום?';

    var SZ = '5rem';
    document.getElementById('kidGrid').innerHTML = kids.map(function(k) {
        var emoji = getAvatarEmoji(k.gender, k.age);
        var color = getAvatarColor(k.gender);
        var isCur = cur && cur.id === k.id;
        var circleBase = 'width:' + SZ + ';height:' + SZ + ';border-radius:50%;flex-shrink:0;';
        var avatarHtml = k.photo
            ? '<span style="' + circleBase + 'display:block;overflow:hidden;"><img src="' + k.photo + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"></span>'
            : '<span style="' + circleBase + 'background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:2.5rem;">' + emoji + '</span>';
        return '<div class="kp-card' + (isCur ? ' kp-card-active' : '') + '" onclick="_selectKid(\'' + k.id + '\')" style="cursor:pointer;">' +
            avatarHtml +
            '<div style="font-weight:700;font-size:1.05rem;color:#0f172a;font-family:inherit;text-align:center;width:100%;">' + k.name + '</div>' +
        '</div>';
    }).join('');
}

function _showAddKidForm() {
    document.getElementById('kidListView').style.display = 'none';
    document.getElementById('kidFormView').style.display = 'block';
    document.getElementById('kidName').value = '';
    document.getElementById('kidAge').value  = '';
    document.getElementById('kidErr').textContent = '';
    _kidGender = 'male';
    _kidPhoto  = '';
    var av = document.getElementById('kidAvatarImg');
    var em = document.getElementById('kidAvatarEmoji');
    if (av) { av.src = ''; av.style.display = 'none'; }
    if (em) em.style.display = 'block';
    _refreshKidGender();
    setTimeout(function(){ var f=document.getElementById('kidName'); if(f) f.focus(); }, 80);
}

function setKidGender(g) { _kidGender = g; _refreshKidGender(); }

function _refreshKidGender() {
    var bm = document.getElementById('kgBtnM'), bf = document.getElementById('kgBtnF');
    if (bm) bm.className = 'gender-btn' + (_kidGender === 'male'   ? ' active' : '');
    if (bf) bf.className = 'gender-btn' + (_kidGender === 'female' ? ' active' : '');
}

function _saveNewKid() {
    var name = (document.getElementById('kidName').value || '').trim();
    var age  = parseInt(document.getElementById('kidAge').value) || 0;
    var err  = document.getElementById('kidErr');
    if (!name) { err.textContent = 'נא להזין שם'; return; }
    if (age < 1 || age > 120) age = 0;
    err.textContent = '';

    var kid  = { id: 'kid_' + Date.now(), name: name, gender: _kidGender, age: age, photo: _kidPhoto };
    var kids = getChildren();
    kids.push(kid);
    saveChildren(kids);
    _selectKid(kid.id);
}

function _buildKidPicker() {
    var d = document.createElement('div');
    d.id = 'kidPickerOv';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:none;align-items:center;justify-content:center;z-index:10000;direction:rtl;';
    d.innerHTML =
        '<div style="background:#fff;border-radius:0;padding:1.2rem 1.5rem;width:min(94vw,460px);position:relative;font-family:inherit;" onclick="event.stopPropagation()">' +

            '<div id="kidListView">' +
                '<div style="margin-bottom:1.4rem;text-align:center;">' +
                    '<div id="kidPickerLine1" style="font-size:1.25rem;font-weight:800;color:#1e293b;"></div>' +
                    '<div id="kidPickerLine2" style="font-size:1.1rem;font-weight:600;color:#475569;margin-top:0.2rem;"></div>' +
                '</div>' +
                '<div id="kidGrid" style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;margin-bottom:2rem;"></div>' +
                '<button onclick="_showAddKidForm()" style="width:100%;padding:0.65rem;border:2px dashed #cbd5e1;border-radius:0;background:none;cursor:pointer;color:#64748b;font-size:0.95rem;font-weight:600;font-family:inherit;margin-top:1.5rem;">＋ הוסף פרופיל</button>' +
            '</div>' +

            '<div id="kidFormView" style="display:none">' +
                '<button onclick="_showKidList()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.9rem;margin-bottom:0.4rem;padding:0;font-weight:600;">→ חזור</button>' +

                '<div style="text-align:center;margin-bottom:0.7rem;">' +
                    '<div style="position:relative;width:4rem;height:4rem;margin:0 auto 0.2rem;cursor:pointer;" onclick="_openAvatarMenu()">' +
                        '<div style="width:4rem;height:4rem;border-radius:50%;background:#f0f4ff;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
                            '<span id="kidAvatarEmoji" style="font-size:2rem;">👤</span>' +
                            '<img id="kidAvatarImg" src="" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:50%;">' +
                        '</div>' +
                        '<div style="position:absolute;bottom:1px;left:1px;width:1.6rem;height:1.6rem;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.2);">+</div>' +
                    '</div>' +
                    '<input type="file" id="kidAvatarInputGallery" accept="image/*" style="display:none;" onchange="_setKidAvatar(this)">' +
                    '<input type="file" id="kidAvatarInputCamera"  accept="image/*" capture="user" style="display:none;" onchange="_setKidAvatar(this)">' +
                    '<div id="avatarMenu" style="display:none;position:absolute;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:20;left:50%;transform:translateX(-50%);white-space:nowrap;">' +
                        '<button onclick="_avatarPickCamera()" style="display:block;width:100%;padding:0.6rem 1.2rem;border:none;background:none;font-family:inherit;font-size:0.95rem;cursor:pointer;text-align:right;">📷 צלם תמונה</button>' +
                        '<button onclick="_avatarPickGallery()" style="display:block;width:100%;padding:0.6rem 1.2rem;border:none;background:none;font-family:inherit;font-size:0.95rem;cursor:pointer;text-align:right;">🖼️ העלה מהגלריה</button>' +
                    '</div>' +
                    '<div style="font-size:0.78rem;color:#94a3b8;margin-bottom:0.3rem;margin-top:0.15rem;">הוסף תמונה</div>' +
                    '<div style="font-size:1.35rem;font-weight:800;color:#0f172a;">פרופיל חדש</div>' +
                    '<div style="color:#94a3b8;font-size:0.92rem;margin-top:0.1rem;">הכנס את פרטי המשתמש</div>' +
                '</div>' +

                '<div style="margin-bottom:0.6rem;">' +
                    '<label style="font-size:0.88rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">שם</label>' +
                    '<input id="kidName" type="text" placeholder="השם שלך..." dir="rtl" style="width:100%;padding:0.5rem 0.9rem;border:1.5px solid #e2e8f0;border-radius:0;font-size:1rem;box-sizing:border-box;font-family:inherit;outline:none;transition:border-color 0.15s;" onfocus="this.style.borderColor=\'#2563eb\'" onblur="this.style.borderColor=\'#e2e8f0\'" onkeydown="if(event.key===\'Enter\')document.getElementById(\'kidAge\').focus()">' +
                '</div>' +

                '<div style="margin-bottom:0.6rem;">' +
                    '<label style="font-size:0.88rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">גיל <span style="font-weight:400;color:#94a3b8;font-size:0.82rem;">(אופציונלי)</span></label>' +
                    '<input id="kidAge" type="number" placeholder="למשל: 12" min="1" max="120" style="width:100%;padding:0.5rem 0.9rem;border:1.5px solid #e2e8f0;border-radius:0;font-size:1rem;box-sizing:border-box;font-family:inherit;outline:none;transition:border-color 0.15s;" onfocus="this.style.borderColor=\'#2563eb\'" onblur="this.style.borderColor=\'#e2e8f0\'" onkeydown="if(event.key===\'Enter\')_saveNewKid()">' +
                '</div>' +

                '<div id="kidErr" style="color:#ef4444;font-size:0.88rem;margin-bottom:0.4rem;min-height:1em;text-align:center;"></div>' +

                '<button onclick="_saveNewKid()" style="width:100%;padding:0.8rem;background:none;color:#0f172a;border:none;border-radius:0;font-size:1.5rem;font-weight:800;cursor:pointer;font-family:inherit;transition:opacity 0.15s;letter-spacing:0.02em;" onmouseover="this.style.opacity=\'0.5\'" onmouseout="this.style.opacity=\'1\'">שמור ←</button>' +
            '</div>' +

            '<div id="kidEditView" style="display:none">' +
                '<button onclick="_showKidList()" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.9rem;margin-bottom:0.4rem;padding:0;font-weight:600;">→ חזור</button>' +

                '<div style="text-align:center;margin-bottom:0.7rem;">' +
                    '<div style="position:relative;width:4rem;height:4rem;margin:0 auto 0.2rem;cursor:pointer;" onclick="_openEditAvatarMenu()">' +
                        '<div style="width:4rem;height:4rem;border-radius:50%;background:#f0f4ff;border:2px solid #e2e8f0;display:flex;align-items:center;justify-content:center;overflow:hidden;">' +
                            '<span id="kidEditAvatarEmoji" style="font-size:2rem;">👤</span>' +
                            '<img id="kidEditAvatarImg" src="" style="display:none;width:100%;height:100%;object-fit:cover;border-radius:50%;">' +
                        '</div>' +
                        '<div style="position:absolute;bottom:1px;left:1px;width:1.6rem;height:1.6rem;background:#2563eb;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,0.2);">+</div>' +
                    '</div>' +
                    '<input type="file" id="kidEditAvatarInputGallery" accept="image/*" style="display:none;" onchange="_setKidAvatar(this)">' +
                    '<input type="file" id="kidEditAvatarInputCamera"  accept="image/*" capture="user" style="display:none;" onchange="_setKidAvatar(this)">' +
                    '<div id="editAvatarMenu" style="display:none;position:absolute;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:20;left:50%;transform:translateX(-50%);white-space:nowrap;">' +
                        '<button onclick="_editAvatarPickCamera()" style="display:block;width:100%;padding:0.6rem 1.2rem;border:none;background:none;font-family:inherit;font-size:0.95rem;cursor:pointer;text-align:right;">📷 צלם תמונה</button>' +
                        '<button onclick="_editAvatarPickGallery()" style="display:block;width:100%;padding:0.6rem 1.2rem;border:none;background:none;font-family:inherit;font-size:0.95rem;cursor:pointer;text-align:right;">🖼️ העלה מהגלריה</button>' +
                    '</div>' +
                    '<div style="font-size:0.78rem;color:#94a3b8;margin-top:0.3rem;">החלף תמונה</div>' +
                '</div>' +

                '<div style="margin-bottom:0.6rem;">' +
                    '<label style="font-size:0.88rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">שם</label>' +
                    '<input id="kidEditName" type="text" dir="rtl" style="width:100%;padding:0.5rem 0.9rem;border:1.5px solid #e2e8f0;border-radius:0;font-size:1rem;box-sizing:border-box;font-family:inherit;outline:none;transition:border-color 0.15s;" onfocus="this.style.borderColor=\'#2563eb\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
                '</div>' +

                '<div style="margin-bottom:0.5rem;">' +
                    '<label style="font-size:0.88rem;font-weight:700;color:#475569;display:block;margin-bottom:0.25rem;">מין</label>' +
                    '<div style="display:flex;gap:0;">' +
                        '<button id="kgEditBtnM" class="gender-btn active" onclick="setKidEditGender(\'male\')">' +
                            '<span class="gb-wrap"><span class="gb-emoji">👦🏽</span></span>זכר' +
                        '</button>' +
                        '<button id="kgEditBtnF" class="gender-btn" onclick="setKidEditGender(\'female\')">' +
                            '<span class="gb-wrap"><span class="gb-emoji">👩‍🦰</span></span>נקבה' +
                        '</button>' +
                    '</div>' +
                '</div>' +

                '<div id="kidEditErr" style="color:#ef4444;font-size:0.88rem;margin-bottom:0.4rem;min-height:1em;text-align:center;"></div>' +

                '<button onclick="_saveEditKid()" style="width:100%;padding:0.8rem;background:none;color:#0f172a;border:none;border-radius:0;font-size:1.5rem;font-weight:800;cursor:pointer;font-family:inherit;transition:opacity 0.15s;" onmouseover="this.style.opacity=\'0.5\'" onmouseout="this.style.opacity=\'1\'">שמור שינויים ←</button>' +
                '<button onclick="_deleteKid(_kidEditId)" style="width:100%;padding:0.5rem;background:none;color:#ef4444;border:none;border-radius:0;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;margin-top:0.3rem;transition:opacity 0.15s;" onmouseover="this.style.opacity=\'0.6\'" onmouseout="this.style.opacity=\'1\'">🗑 מחק משתמש</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(d);
}

// ── עריכת פרופיל ────────────────────────────────────────────────
function _openEditCurrentKid() {
    var kid = getActiveKid();
    if (!kid) return;
    var ov = document.getElementById('kidPickerOv');
    if (ov) ov.style.display = 'flex';
    var m = document.getElementById('uMenu');
    if (m) m.style.display = 'none';
    _showEditKidForm(kid.id);
}

function _showEditKidForm(id) {
    _kidEditId = id;
    var kids = getChildren();
    var kid = null;
    for (var i = 0; i < kids.length; i++) { if (kids[i].id === id) { kid = kids[i]; break; } }
    if (!kid) return;
    _kidPhoto  = kid.photo || '';
    _kidGender = kid.gender || 'male';
    document.getElementById('kidListView').style.display = 'none';
    document.getElementById('kidFormView').style.display = 'none';
    document.getElementById('kidEditView').style.display = 'block';
    document.getElementById('kidEditName').value = kid.name || '';
    document.getElementById('kidEditErr').textContent = '';
    var av = document.getElementById('kidEditAvatarImg');
    var em = document.getElementById('kidEditAvatarEmoji');
    if (kid.photo) {
        if (av) { av.src = kid.photo; av.style.display = 'block'; }
        if (em) em.style.display = 'none';
    } else {
        if (av) av.style.display = 'none';
        if (em) { em.style.display = 'block'; em.textContent = getAvatarEmoji(kid.gender, kid.age); }
    }
    _refreshKidEditGender();
}
function _refreshKidEditGender() {
    var bm = document.getElementById('kgEditBtnM'), bf = document.getElementById('kgEditBtnF');
    if (bm) bm.className = 'gender-btn' + (_kidGender === 'male'   ? ' active' : '');
    if (bf) bf.className = 'gender-btn' + (_kidGender === 'female' ? ' active' : '');
}
function setKidEditGender(g) { _kidGender = g; _refreshKidEditGender(); }
function _saveEditKid() {
    var name = (document.getElementById('kidEditName').value || '').trim();
    var err  = document.getElementById('kidEditErr');
    if (!name) { err.textContent = 'נא להזין שם'; return; }
    err.textContent = '';
    var kids = getChildren();
    var idx = -1;
    for (var i = 0; i < kids.length; i++) { if (kids[i].id === _kidEditId) { idx = i; break; } }
    if (idx === -1) return;
    kids[idx].name   = name;
    kids[idx].gender = _kidGender;
    if (_kidPhoto) kids[idx].photo = _kidPhoto;
    saveChildren(kids);
    var active = getActiveKid();
    if (active && active.id === _kidEditId) setActiveKid(kids[idx]);
    _showKidList();
    renderUserNav();
}
function _deleteKid(id) {
    _showConfirm({
        icon: '🗑️',
        title: 'מחיקת פרופיל',
        msg: 'פעולה זו תמחק את הפרופיל לצמיתות ולא ניתן לשחזרו.',
        ok: 'מחק',
        cancel: 'ביטול',
        danger: true,
        onOk: function() {
            var kids = getChildren();
            var remaining = [];
            for (var i = 0; i < kids.length; i++) { if (kids[i].id !== id) remaining.push(kids[i]); }
            saveChildren(remaining);
            var active = getActiveKid();
            if (active && active.id === id) clearActiveKid();
            _kidEditId = '';
            _showKidList();
            renderUserNav();
        }
    });
}

// ── מודל כניסה ─────────────────────────────────────────────────
function openLoginModal(mode) {
    var ov = document.getElementById('fbLoginOv');
    if (!ov) return;
    ov.style.display = 'flex';
    var m = mode === 'login' ? 'login' : 'register';
    var isReg = m === 'register';
    document.getElementById('fbModeVal').value = m;
    document.getElementById('fbNameRow').style.display  = isReg ? 'block' : 'none';
    document.getElementById('fbModalTitle').textContent = isReg ? 'הרשמה' : 'כניסה';
    document.getElementById('fbSubmitBtn').textContent  = isReg ? 'הרשמה ←' : 'כנס ←';
    document.getElementById('fbToggleBtn').textContent  = isReg ? 'כבר יש לך חשבון? כנס' : 'אין לך חשבון? הירשם';
    document.getElementById('fbErr').textContent = '';
}

function closeLoginModal() {
    var ov = document.getElementById('fbLoginOv');
    if (ov) ov.style.display = 'none';
}

// ── איפוס ציוני אוצר מילים ─────────────────────────────────────
function _resetVocabIfNeeded() {
    if (localStorage.getItem('vocabVer') === VOCAB_VER) return;
    var kids = getChildren();
    kids.forEach(function(k) {
        var key = PROG_KEY + '_' + k.id;
        try {
            var p = JSON.parse(localStorage.getItem(key)) || {};
            delete p['vocabulary'];
            localStorage.setItem(key, JSON.stringify(p));
        } catch(e) {}
    });
    localStorage.setItem('vocabVer', VOCAB_VER);
}

// ── אתחול ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
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
