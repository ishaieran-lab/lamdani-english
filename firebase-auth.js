// firebase-auth.js — Firebase Authentication (compat SDK v10)
// נטען אחרי firebase-app-compat.js ו-firebase-auth-compat.js

(function() {
    var firebaseConfig = {
        apiKey:            "AIzaSyDttv79Uf6CVsJob2S6xVyA0fE6hkvuq1U",
        authDomain:        "lamdani-eng.firebaseapp.com",
        projectId:         "lamdani-eng",
        storageBucket:     "lamdani-eng.firebasestorage.app",
        messagingSenderId: "95853150948",
        appId:             "1:95853150948:web:454dfcbfa89cc0ea5f62f1",
        measurementId:     "G-SM6JG73T8P"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    var auth = firebase.auth();

    window._firebaseAuth = auth;

    auth.onAuthStateChanged(function(user) {
        if (user) {
            if (typeof window.onFirebaseAuth === 'function') window.onFirebaseAuth(user);
        } else {
            if (typeof window.onFirebaseLogout === 'function') window.onFirebaseLogout();
        }
    });

    // ── Modal ────────────────────────────────────────────────────────
    window.openLoginModal = function(mode) {
        if (!document.getElementById('fbLoginOv')) _buildModal();
        document.getElementById('fbLoginOv').style.display = 'flex';
        _setMode(mode === 'login' ? 'login' : 'register');
        _setErr('');
    };

    window.closeLoginModal = function() {
        var ov = document.getElementById('fbLoginOv');
        if (ov) ov.style.display = 'none';
    };

    // ── Google Sign In ───────────────────────────────────────────────
    window.fbSignInGoogle = function() {
        var provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then(function() { window.closeLoginModal(); })
            .catch(function(e) {
                console.error('Google sign-in error:', e.code, e.message);
                if (e.code !== 'auth/popup-closed-by-user') {
                    _setErr('שגיאה בכניסה עם Google: ' + e.code);
                }
            });
    };

    // ── Email Submit ─────────────────────────────────────────────────
    window.fbSubmitEmail = function() {
        var mode  = document.getElementById('fbModeVal').value;
        var email = (document.getElementById('fbEmail').value || '').trim();
        var pass  = (document.getElementById('fbPass').value  || '').trim();
        var name  = mode === 'register' ? (document.getElementById('fbName').value || '').trim() : '';

        if (!email || !pass) { _setErr('נא למלא אימייל וסיסמה'); return; }
        if (mode === 'register' && !name) { _setErr('נא למלא שם'); return; }

        var btn = document.getElementById('fbSubmitBtn');
        btn.disabled = true; btn.textContent = '...';

        var promise = mode === 'register'
            ? auth.createUserWithEmailAndPassword(email, pass)
                  .then(function(cred) { return cred.user.updateProfile({ displayName: name }); })
            : auth.signInWithEmailAndPassword(email, pass);

        promise
            .then(function() { window.closeLoginModal(); })
            .catch(function(e) {
                console.error('Auth error:', e.code, e.message);
                var msgs = {
                    'auth/email-already-in-use':  'האימייל כבר רשום — נסה להתחבר',
                    'auth/invalid-credential':    'אימייל או סיסמה שגויים',
                    'auth/invalid-email':         'כתובת אימייל לא תקינה',
                    'auth/user-not-found':        'משתמש לא נמצא',
                    'auth/wrong-password':        'סיסמה שגויה',
                    'auth/weak-password':         'הסיסמה חלשה — מינימום 6 תווים',
                    'auth/too-many-requests':     'יותר מדי ניסיונות — נסה שוב מאוחר יותר',
                    'auth/unauthorized-domain':   'הדומיין לא מורשה ב-Firebase',
                    'auth/network-request-failed':'בעיית רשת — בדוק חיבור לאינטרנט'
                };
                _setErr(msgs[e.code] || ('שגיאה: ' + e.code));
                btn.disabled = false;
                _setMode(mode);
            });
    };

    // ── Toggle Mode ──────────────────────────────────────────────────
    window.fbToggleMode = function() {
        var cur = document.getElementById('fbModeVal').value;
        _setMode(cur === 'register' ? 'login' : 'register');
        _setErr('');
    };

    function _setMode(mode) {
        document.getElementById('fbModeVal').value = mode;
        var isReg = mode === 'register';
        document.getElementById('fbNameRow').style.display  = isReg ? 'block' : 'none';
        document.getElementById('fbModalTitle').textContent = isReg ? 'הרשמה' : 'כניסה';
        document.getElementById('fbSubmitBtn').textContent  = isReg ? 'הרשמה ←' : 'כנס ←';
        document.getElementById('fbToggleBtn').textContent  = isReg
            ? 'כבר יש לך חשבון? כנס'
            : 'אין לך חשבון? הירשם';
    }

    function _setErr(msg) {
        var el = document.getElementById('fbErr');
        if (el) el.textContent = msg || '';
    }

    // ── Build Modal ──────────────────────────────────────────────────
    function _buildModal() {
        var d = document.createElement('div');
        d.id = 'fbLoginOv';
        d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:none;align-items:center;justify-content:center;z-index:9999;direction:rtl;';
        d.onclick = function(e) { if (e.target === d) window.closeLoginModal(); };
        d.innerHTML =
            '<div style="background:#fff;border-radius:1.2rem;padding:2rem 2rem 1.5rem;width:min(92vw,380px);position:relative;text-align:center;font-family:inherit;" onclick="event.stopPropagation()">' +
                '<button onclick="closeLoginModal()" style="position:absolute;top:0.7rem;left:0.8rem;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8;">✕</button>' +
                '<input type="hidden" id="fbModeVal" value="register">' +
                '<div id="fbModalTitle" style="font-size:1.35rem;font-weight:800;color:#1e293b;margin-bottom:1.4rem;">הרשמה</div>' +

                '<button onclick="fbSignInGoogle()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:0.6rem;padding:0.7rem;border:1.5px solid #e2e8f0;border-radius:0.6rem;background:#fff;cursor:pointer;font-size:0.95rem;font-weight:600;margin-bottom:1rem;transition:border-color 0.15s;" onmouseover="this.style.borderColor=\'#94a3b8\'" onmouseout="this.style.borderColor=\'#e2e8f0\'">' +
                    '<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 8 2.8l6-6C34.1 3.1 29.3 1 24 1 14.9 1 7.1 6.7 3.8 14.7l7 5.4C12.5 13.7 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-16.9z"/><path fill="#FBBC05" d="M10.8 28.1c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7-5.4C2.3 16.6 1 20.2 1 24s1.3 7.4 3.7 10.5l7.1-5.4z"/><path fill="#34A853" d="M24 47c5.4 0 9.9-1.8 13.2-4.8l-7.4-5.7c-1.8 1.2-4.1 1.9-5.8 1.9-6.2 0-11.4-4.2-13.3-9.9l-7.1 5.4C7.1 41.3 14.9 47 24 47z"/></svg>' +
                    'המשך עם Google' +
                '</button>' +

                '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;"><div style="flex:1;height:1px;background:#e2e8f0;"></div><span style="color:#94a3b8;font-size:0.8rem;">או</span><div style="flex:1;height:1px;background:#e2e8f0;"></div></div>' +

                '<div id="fbNameRow" style="margin-bottom:0.65rem;text-align:right;">' +
                    '<label style="font-size:0.82rem;font-weight:600;color:#374151;display:block;margin-bottom:0.25rem;">שם מלא</label>' +
                    '<input id="fbName" type="text" placeholder="השם שלך..." dir="rtl" style="width:100%;padding:0.6rem 0.75rem;border:1.5px solid #e2e8f0;border-radius:0.5rem;font-size:0.95rem;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')document.getElementById(\'fbEmail\').focus()">' +
                '</div>' +

                '<div style="margin-bottom:0.65rem;text-align:right;">' +
                    '<label style="font-size:0.82rem;font-weight:600;color:#374151;display:block;margin-bottom:0.25rem;">אימייל</label>' +
                    '<input id="fbEmail" type="email" placeholder="your@email.com" dir="ltr" style="width:100%;padding:0.6rem 0.75rem;border:1.5px solid #e2e8f0;border-radius:0.5rem;font-size:0.95rem;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')document.getElementById(\'fbPass\').focus()">' +
                '</div>' +

                '<div style="margin-bottom:0.9rem;text-align:right;">' +
                    '<label style="font-size:0.82rem;font-weight:600;color:#374151;display:block;margin-bottom:0.25rem;">סיסמה</label>' +
                    '<input id="fbPass" type="password" placeholder="לפחות 6 תווים" dir="ltr" style="width:100%;padding:0.6rem 0.75rem;border:1.5px solid #e2e8f0;border-radius:0.5rem;font-size:0.95rem;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')fbSubmitEmail()">' +
                '</div>' +

                '<div id="fbErr" style="color:#ef4444;font-size:0.85rem;margin-bottom:0.65rem;min-height:1.1em;"></div>' +

                '<button id="fbSubmitBtn" onclick="fbSubmitEmail()" style="width:100%;padding:0.75rem;background:#2563eb;color:#fff;border:none;border-radius:0.6rem;font-size:1rem;font-weight:700;cursor:pointer;margin-bottom:0.9rem;">הרשמה ←</button>' +

                '<button id="fbToggleBtn" onclick="fbToggleMode()" style="background:none;border:none;color:#2563eb;font-size:0.85rem;cursor:pointer;text-decoration:underline;">כבר יש לך חשבון? כנס</button>' +
            '</div>';
        document.body.appendChild(d);
    }
})();
