// firebase-auth.js — Firebase Authentication (compat SDK v10)
// המודל עצמו נמצא ב-HTML. קובץ זה רק מטפל באימות.

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

    // ── Auth State ───────────────────────────────────────────────────
    auth.onAuthStateChanged(function(user) {
        if (user) {
            if (typeof window.onFirebaseAuth   === 'function') window.onFirebaseAuth(user);
        } else {
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
    window._fbDoEmail = function() {
        var mode  = document.getElementById('fbModeVal').value;
        var email = (document.getElementById('fbEmail').value || '').trim();
        var pass  = (document.getElementById('fbPass').value  || '').trim();
        var name  = mode === 'register' ? (document.getElementById('fbName').value || '').trim() : '';

        if (!email || !pass) { setErr('נא למלא אימייל וסיסמה'); return; }
        if (mode === 'register' && !name) { setErr('נא למלא שם'); return; }

        var btn = document.getElementById('fbSubmitBtn');
        btn.disabled = true; btn.textContent = '...';

        var p = mode === 'register'
            ? auth.createUserWithEmailAndPassword(email, pass)
                  .then(function(c) { return c.user.updateProfile({ displayName: name }); })
            : auth.signInWithEmailAndPassword(email, pass);

        p.then(function() { closeLoginModal(); })
         .catch(function(e) {
             console.error('Auth error:', e.code, e.message);
             var msgs = {
                 'auth/email-already-in-use':  'האימייל כבר רשום — נסה להתחבר',
                 'auth/invalid-credential':    'אימייל או סיסמה שגויים',
                 'auth/invalid-email':         'כתובת אימייל לא תקינה',
                 'auth/user-not-found':        'משתמש לא נמצא',
                 'auth/wrong-password':        'סיסמה שגויה',
                 'auth/weak-password':         'סיסמה חלשה — מינימום 6 תווים',
                 'auth/too-many-requests':     'יותר מדי ניסיונות — נסה מאוחר יותר',
                 'auth/unauthorized-domain':   'הדומיין לא מורשה ב-Firebase'
             };
             setErr(msgs[e.code] || ('שגיאה: ' + e.code));
             btn.disabled = false;
             btn.textContent = mode === 'register' ? 'הרשמה ←' : 'כנס ←';
         });
    };
})();
