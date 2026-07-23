// firestore-sync.js — syncs user data to Firestore

function _fsDb()  { return window._firebaseDb || null; }
function _fsUid() { var p = typeof getParent === 'function' ? getParent() : null; return p ? p.uid : null; }

// Called once on login — writes profile, kids list, and all progress
function fsyncUserLogin(fbUser) {
    var db = _fsDb();
    if (!db) return;

    var kids = typeof getChildren === 'function' ? getChildren() : [];
    var kidsData = kids.map(function(k) {
        return { id: k.id, name: k.name, gender: k.gender || 'male', age: k.age || '' };
    });

    var progressData = {};
    kids.forEach(function(k) {
        var raw = localStorage.getItem('engProgress_' + k.id);
        try { progressData[k.id] = raw ? JSON.parse(raw) : {}; } catch(e) { progressData[k.id] = {}; }
    });

    var userRef = db.collection('users').doc(fbUser.uid);
    userRef.get().then(function(doc) {
        var data = doc.exists ? doc.data() : {};
        // Pull Firestore premium into window so isPremium() can read it
        if (data.premium) window._fsUserPremium = true;

        var updates = {
            email: fbUser.email,
            name:  fbUser.displayName || fbUser.email.split('@')[0],
            lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
            kids: kidsData,
            progress: progressData
        };
        if (!data.registeredAt) {
            updates.registeredAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        return userRef.set(updates, { merge: true });
    }).catch(function(e) { console.warn('[fsync] login sync error:', e.message); });
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

    // Dotted path updates only this kid's subtree in the progress map
    var update = {};
    update['progress.' + kid.id] = progress;

    db.collection('users').doc(uid).update(update)
        .catch(function(e) { console.warn('[fsync] progress sync error:', e.message); });
}
