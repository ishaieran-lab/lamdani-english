// firestore-sync.js — syncs user data to Firestore

function _fsDb()  { return window._firebaseDb || null; }
function _fsUid() { var p = typeof getParent === 'function' ? getParent() : null; return p ? p.uid : null; }

// Called once on login — merges local kids with Firestore and writes back
function fsyncUserLogin(fbUser) {
    var db = _fsDb();
    if (!db) return Promise.resolve();

    var localKids = typeof getChildren === 'function' ? getChildren() : [];
    var userRef   = db.collection('users').doc(fbUser.uid);

    return userRef.get({ source: 'server' }).then(function(doc) {
        var data = doc.exists ? doc.data() : {};

        // If admin marked this account as deleted — clear local data and stop
        if (data._deleted) {
            if (typeof saveChildren === 'function') saveChildren([]);
            if (typeof clearActiveKid === 'function') clearActiveKid();
            return;
        }

        if (data.premium) window._fsUserPremium = true;

        // Merge local kids + Firestore kids (by id, no duplicates)
        var fsKids = (doc.exists && data.kids) ? data.kids : [];
        var merged = localKids.slice();
        fsKids.forEach(function(fk) {
            var localIdx = -1;
            for (var i = 0; i < merged.length; i++) { if (merged[i].id === fk.id) { localIdx = i; break; } }
            if (localIdx === -1) {
                merged.push(fk);
            } else {
                if (!merged[localIdx].photo && fk.photo) merged[localIdx].photo = fk.photo;
                if (!merged[localIdx].age && fk.age) merged[localIdx].age = fk.age;
            }
        });

        // Merge progress: local wins, Firestore fills the rest
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
            return { id: k.id, name: k.name, gender: k.gender || 'male', age: k.age || '', photo: k.photo || '' };
        });
        var updates = {
            email: fbUser.email,
            name:  fbUser.displayName || fbUser.email.split('@')[0],
            lastLogin: new Date().toISOString(),
            kids: kidsData,
            progress: mergedProgress
        };

        return userRef.set(updates, { merge: true });

    }).catch(function(e) {
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
