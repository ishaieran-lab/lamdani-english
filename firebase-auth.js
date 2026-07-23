// firebase-auth.js — Firebase Authentication (compat SDK v10)
// המודל עצמו נמצא ב-HTML. קובץ זה רק מטפל באימות.

(function() {
    var firebaseConfig = {
        apiKey:            "AIzaSyDttv79Uf6CVsJob2S6xVyAOfE6hkvuq1U",
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

    if (typeof firebase.firestore === 'function') {
        window._firebaseDb = firebase.firestore();
    }

    // ── Auth State ───────────────────────────────────────────────────
    // emailVerified check: prevents redirect during registration (Firebase auto-signs in
    // the new user before our code can call signOut + sendEmailVerification)
    auth.onAuthStateChanged(function(user) {
        if (user && user.emailVerified) {
            if (typeof window.onFirebaseAuth   === 'function') window.onFirebaseAuth(user);
        } else if (!user) {
            if (typeof window.onFirebaseLogout === 'function') window.onFirebaseLogout();
        }
    });

    function setErr(msg) {
        var el = document.getElementById('fbErr');
        if (el) el.textContent = msg || '';
    }

    // ── Google Sign In (רשום על _fbDoGoogle) ────────────────────────
    window._fbDoGoogle = function() {
        var provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider)
            .then(function() { closeLoginModal(); })
            .catch(function(e) {
                console.error('Google sign-in:', e.code, e.message);
                if (e.code !== 'auth/popup-closed-by-user') setErr('שגיאה: ' + e.code);
                else setErr('');
            });
    };

    // ── Email/Password ───────────────────────────────────────────────
    var _pendingEmail = '';
    var _pendingPass  = '';
    var VERIFY_URL = 'https://ishaieran-lab.github.io/lamdani-english/verify.html';

    function getActionSettings() { return { url: VERIFY_URL }; }

    window._fbDoEmail = function() {
        var mode  = document.getElementById('fbModeVal').value;
        var email = (document.getElementById('fbEmail').value || '').trim();
        var pass  = (document.getElementById('fbPass').value  || '').trim();
        var name  = mode === 'register' ? (document.getElementById('fbName').value || '').trim() : '';

        if (!email || !pass) { setErr('נא למלא אימייל וסיסמה'); return; }
        if (mode === 'register' && !name) { setErr('נא למלא שם'); return; }

        var btn = document.getElementById('fbSubmitBtn');
        btn.disabled = true; btn.textContent = '...';

        var msgs = {
            'auth/email-already-in-use':  'האימייל כבר רשום — נסה להתחבר',
            'auth/invalid-credential':    'אימייל או סיסמה שגויים',
            'auth/invalid-email':         'כתובת אימייל לא תקינה',
            'auth/user-not-found':        'משתמש לא נמצא',
            'auth/wrong-password':        'סיסמה שגויה',
            'auth/weak-password':         'סיסמה חלשה — מינימום 6 תווים',
            'auth/too-many-requests':     'יותר מדי ניסיונות — נסה מאוחר יותר',
            'auth/unauthorized-domain':   'הדומיין לא מורשה ב-Firebase',
            'auth/email-not-verified':    'נא לאמת את האימייל תחילה — בדוק תיבת דואר ותיקיית ספאם/זבל'
        };

        var p = mode === 'register'
            ? auth.createUserWithEmailAndPassword(email, pass)
                  .then(function(c) {
                      _pendingEmail = email;
                      _pendingPass  = pass;
                      return c.user.updateProfile({ displayName: name })
                          .then(function() { return c.user.sendEmailVerification(getActionSettings()); })
                          .then(function() { return auth.signOut(); });
                  })
            : auth.signInWithEmailAndPassword(email, pass)
                  .then(function(c) {
                      if (!c.user.emailVerified) {
                          return auth.signOut().then(function() {
                              throw { code: 'auth/email-not-verified' };
                          });
                      }
                  });

        p.then(function() {
            if (mode === 'register') {
                btn.disabled = false; btn.textContent = 'הרשמה ←';
                if (typeof window.fbShowVerifyView === 'function') window.fbShowVerifyView(email);
            } else {
                closeLoginModal();
            }
        }).catch(function(e) {
            console.error('Auth error:', e.code, e.message);
            setErr(msgs[e.code] || ('שגיאה: ' + e.code));
            btn.disabled = false;
            btn.textContent = mode === 'register' ? 'הרשמה ←' : 'כנס ←';
        });
    };

    window._fbDoResend = function() {
        if (!_pendingEmail || !_pendingPass) return;
        var msg = document.getElementById('fbResendMsg');
        if (msg) { msg.style.color = '#64748b'; msg.textContent = 'שולח...'; }
        auth.signInWithEmailAndPassword(_pendingEmail, _pendingPass)
            .then(function(c) {
                return c.user.sendEmailVerification(getActionSettings())
                    .then(function() { return auth.signOut(); });
            })
            .then(function() {
                if (msg) { msg.style.color = '#16a34a'; msg.textContent = '✅ מייל האימות נשלח שוב!'; }
                if (typeof window.fbStartResendCountdown === 'function') window.fbStartResendCountdown(60);
            })
            .catch(function(e) {
                if (msg) { msg.style.color = '#ef4444'; msg.textContent = 'שגיאה: ' + e.code; }
                var btn = document.getElementById('fbResendBtn');
                if (btn) btn.disabled = false;
            });
    };
})();
