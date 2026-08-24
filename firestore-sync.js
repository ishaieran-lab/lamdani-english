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

        // If admin marked this account as deleted — sign out immediately
        if (data._deleted) {
            if (typeof saveChildren === 'function') saveChildren([]);
            if (typeof clearActiveKid === 'function') clearActiveKid();
            var authObj = window._firebaseAuth || (window.firebase && firebase.auth ? firebase.auth() : null);
            if (authObj && authObj.signOut) authObj.signOut();
            return;
        }

        if (data.premium) window._fsUserPremium = true;

        // Firestore is source of truth — build list from server, filtered by local deletions
        var fsKids = (doc.exists && data.kids) ? data.kids : [];
        var deletedKids = [];
        try { deletedKids = JSON.parse(localStorage.getItem('lmd_deleted_kids') || '[]'); } catch(e) {}

        // Start from Firestore kids, skip any that were locally deleted
        var merged = [];
        fsKids.forEach(function(fk) {
            if (deletedKids.indexOf(fk.id) !== -1) return;
            merged.push(fk);
        });

        // Add local kids not yet in Firestore (created offline / Firestore write failed)
        localKids.forEach(function(lk) {
            if (deletedKids.indexOf(lk.id) !== -1) return;
            var exists = false;
            for (var i = 0; i < merged.length; i++) { if (merged[i].id === lk.id) { exists = true; break; } }
            if (!exists) merged.push(lk);
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
            // Runs on every page load of a signed-in user, so this tracks visits
            // rather than sign-ins (a restored session never counts as a sign-in)
            lastVisitAt: new Date().toISOString(),
            kids: kidsData,
            progress: mergedProgress
        };

        return userRef.set(updates, { merge: true });

    }).catch(function(e) {
        console.warn('[fsync] login sync error:', e.message);
    });
}

// Called after adding or editing a kid — pushes the updated kids list to Firestore
function fsyncKids() {
    var db  = _fsDb();
    var uid = _fsUid();
    if (!db || !uid) return;
    var kids = typeof getChildren === 'function' ? getChildren() : [];
    if (!kids.length) return;
    var kidsData = kids.map(function(k) {
        return { id: k.id, name: k.name, gender: k.gender || 'male', age: k.age || '', photo: k.photo || '' };
    });
    // Use set+merge so it works even if the document doesn't exist yet
    db.collection('users').doc(uid).set({ kids: kidsData }, { merge: true })
        .catch(function(e) { console.warn('[fsync] kids sync error:', e.code, e.message); });
}

// Called after every saveProgress() — writes only the active kid's progress, and ensures kids are synced
function fsyncProgress() {
    var db  = _fsDb();
    var uid = _fsUid();
    if (!db || !uid) return;

    var kid = typeof getActiveKid === 'function' ? getActiveKid() : null;
    if (!kid) return;

    var raw = localStorage.getItem('engProgress_' + kid.id);
    var progress;
    try { progress = raw ? JSON.parse(raw) : {}; } catch(e) { progress = {}; }

    // Build update: always include full kids list + this kid's progress
    // IMPORTANT: use update() not set() — update() supports dot-notation paths for nested fields
    var kids = typeof getChildren === 'function' ? getChildren() : [];
    var kidsData = kids.map(function(k) {
        return { id: k.id, name: k.name, gender: k.gender || 'male', age: k.age || '', photo: k.photo || '' };
    });

    var update = {};
    update['progress.' + kid.id] = progress;
    if (kidsData.length) update.kids = kidsData;
    update.lastSyncAt = new Date().toISOString();

    db.collection('users').doc(uid).update(update)
        .then(function() { console.log('[fsync] progress synced ok, kids:', kidsData.length); })
        .catch(function(e) {
            console.error('[fsync] progress sync FAILED:', e.code, e.message);
            // Fallback: try set with merge if document missing
            if (e.code === 'not-found') {
                var fallback = { kids: kidsData, lastSyncAt: new Date().toISOString() };
                fallback['progress'] = {};
                fallback['progress'][kid.id] = progress;
                db.collection('users').doc(uid).set(fallback, { merge: true })
                    .then(function() { console.log('[fsync] fallback set ok'); })
                    .catch(function(e2) { console.error('[fsync] fallback FAILED:', e2.code, e2.message); });
            }
        });
}
