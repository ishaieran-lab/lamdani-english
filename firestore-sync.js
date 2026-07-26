// firestore-sync.js — syncs user data to Firestore

function _fsDb()  { return window._firebaseDb || null; }
function _fsUid() { var p = typeof getParent === 'function' ? getParent() : null; return p ? p.uid : null; }

// Called once on login — restores from Firestore if local is empty, otherwise pushes local → Firestore
function fsyncUserLogin(fbUser) {
    var db = _fsDb();
    if (!db) return Promise.resolve();

    var localKids = typeof getChildren === 'function' ? getChildren() : [];
    var userRef   = db.collection('users').doc(fbUser.uid);

    return userRef.get().then(function(doc) {
        var data = doc.exists ? doc.data() : {};

        // Always pull premium status
        if (data.premium) window._fsUserPremium = true;

        if (localKids.length > 0) {
            // Local data exists — push to Firestore
            var kidsData = localKids.map(function(k) {
                return { id: k.id, name: k.name, gender: k.gender || 'male', age: k.age || '' };
            });
            var progressData = {};
            localKids.forEach(function(k) {
                var raw = localStorage.getItem('engProgress_' + k.id);
                try { progressData[k.id] = raw ? JSON.parse(raw) : {}; } catch(e) { progressData[k.id] = {}; }
            });
            var updates = {
                email: fbUser.email,
                name:  fbUser.displayName || fbUser.email.split('@')[0],
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                kids: kidsData,
                progress: progressData
            };
            if (!data.registeredAt) updates.registeredAt = firebase.firestore.FieldValue.serverTimestamp();
            return userRef.set(updates, { merge: true });
        }

        // No local data — restore from Firestore if available
        if (doc.exists && data.kids && data.kids.length > 0) {
            if (typeof saveChildren === 'function') saveChildren(data.kids);
            if (data.progress) {
                data.kids.forEach(function(k) {
                    if (data.progress[k.id]) {
                        localStorage.setItem('engProgress_' + k.id, JSON.stringify(data.progress[k.id]));
                    }
                });
            }
            // Update only metadata — do NOT overwrite kids/progress with empty
            return userRef.set({
                email: fbUser.email,
                name:  fbUser.displayName || fbUser.email.split('@')[0],
                lastLogin: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // Brand new user — write metadata only
        var newUpdates = {
            email: fbUser.email,
            name:  fbUser.displayName || fbUser.email.split('@')[0],
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!data.registeredAt) newUpdates.registeredAt = firebase.firestore.FieldValue.serverTimestamp();
        return userRef.set(newUpdates, { merge: true });

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

    var update = {};
    update['progress.' + kid.id] = progress;

    db.collection('users').doc(uid).update(update)
        .catch(function(e) { console.warn('[fsync] progress sync error:', e.message); });
}
