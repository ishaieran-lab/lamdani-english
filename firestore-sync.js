// firestore-sync.js — syncs user data to Firestore

function _fsDb()  { return window._firebaseDb || null; }
function _fsUid() { var p = typeof getParent === 'function' ? getParent() : null; return p ? p.uid : null; }

function _fsToast(msg, color) {
    var t = document.getElementById('_fsToast');
    if (!t) {
        t = document.createElement('div');
        t.id = '_fsToast';
        t.style.cssText = 'position:fixed;bottom:5rem;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:0.6rem 1.2rem;border-radius:2rem;font-size:0.85rem;z-index:99999;direction:rtl;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.4s;font-family:inherit;';
        document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = color || '#1e293b';
    t.style.opacity = '1';
    clearTimeout(t._timer);
    t._timer = setTimeout(function() { t.style.opacity = '0'; }, 4000);
}

// Called once on login — restores from Firestore if local is empty, otherwise pushes local → Firestore
function fsyncUserLogin(fbUser) {
    _fsToast('fsync נקרא...', '#475569');
    var db = _fsDb();
    if (!db) {
        _fsToast('❌ Firestore לא זמין (_firebaseDb=null)', '#dc2626');
        return Promise.resolve();
    }

    var localKids = typeof getChildren === 'function' ? getChildren() : [];
    var userRef   = db.collection('users').doc(fbUser.uid);

    _fsToast('מסנכרן נתונים...', '#475569');

    return userRef.get().then(function(doc) {
        var data = doc.exists ? doc.data() : {};
        if (data.premium) window._fsUserPremium = true;

        // Merge local kids + Firestore kids (by id, no duplicates)
        var fsKids = (doc.exists && data.kids) ? data.kids : [];
        var merged = localKids.slice();
        fsKids.forEach(function(fk) {
            if (!merged.find(function(lk) { return lk.id === fk.id; })) {
                merged.push(fk);
            }
        });

        // Merge progress: local wins for kids we have locally, Firestore fills the rest
        var mergedProgress = {};
        if (data.progress) {
            Object.keys(data.progress).forEach(function(kid_id) {
                mergedProgress[kid_id] = data.progress[kid_id];
            });
        }
        merged.forEach(function(k) {
            var raw = localStorage.getItem('engProgress_' + k.id);
            if (raw) {
                try { mergedProgress[k.id] = JSON.parse(raw); } catch(e) {}
            }
        });

        // Save merged list to localStorage
        if (typeof saveChildren === 'function') saveChildren(merged);
        merged.forEach(function(k) {
            if (mergedProgress[k.id]) {
                localStorage.setItem('engProgress_' + k.id, JSON.stringify(mergedProgress[k.id]));
            }
        });

        // Push merged data to Firestore
        var kidsData = merged.map(function(k) {
            return { id: k.id, name: k.name, gender: k.gender || 'male', age: k.age || '' };
        });
        var updates = {
            email: fbUser.email,
            name:  fbUser.displayName || fbUser.email.split('@')[0],
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            kids: kidsData,
            progress: mergedProgress
        };
        if (!data.registeredAt) updates.registeredAt = firebase.firestore.FieldValue.serverTimestamp();

        var added = merged.length - localKids.length;
        if (added > 0) {
            _fsToast('✅ מוזג: ' + merged.length + ' ילדים (' + added + ' שוחזרו)', '#16a34a');
        } else {
            _fsToast('✅ שמור: ' + merged.length + ' ילדים', '#16a34a');
        }

        return userRef.set(updates, { merge: true });

    }).catch(function(e) {
        _fsToast('❌ שגיאת Firestore: ' + e.message, '#dc2626');
        console.warn('[fsync] login sync error:', e.message);
    });
}

// Called after every saveProgress() — writes only the active kid's progress
function fsyncProgress() {
    var db  = _fsDb();
    var uid = _fsUid();
    if (!db || !uid) return;

    var kid = typeof getActiveKid === 'function' ? getActiveKid() : null;
    if (!kid) return;

    var raw = localStorage.getItem('engProgress_' + kid.id);
    var progress;
    try { progress = raw ? JSON.parse(raw) : {}; } catch(e) { progress = {}; }

    var update = {};
    update['progress.' + kid.id] = progress;

    db.collection('users').doc(uid).update(update)
        .catch(function(e) { console.warn('[fsync] progress sync error:', e.message); });
}
