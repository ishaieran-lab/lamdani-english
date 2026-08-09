// premium-guard.js — הוסף לכל דף תוכן מוגן
// מציג מסך טעינה → בודק Auth + Firestore premium → מסיר או מציג paywall
(function () {
  var PAYMENT_FN = "https://createpaymentsession-2tarox7bha-uc.a.run.app";

  // ── Spinner overlay מיידי ─────────────────────────────────────
  var _style = document.createElement("style");
  _style.textContent =
    "@keyframes _pgSpin{to{transform:rotate(360deg)}}" +
    "#_pgOv{position:fixed;inset:0;background:#fff;z-index:9998;display:flex;align-items:center;justify-content:center;}";
  document.head.appendChild(_style);

  function _showSpinner() {
    var ov = document.createElement("div");
    ov.id = "_pgOv";
    ov.innerHTML =
      '<div style="width:38px;height:38px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:_pgSpin 0.8s linear infinite;"></div>';
    document.body.appendChild(ov);
  }

  function _showPaywall(fbUser) {
    var ov = document.getElementById("_pgOv");
    if (!ov) return;
    ov.innerHTML =
      '<div style="text-align:center;padding:2rem 1.5rem;max-width:420px;font-family:inherit;">' +
        '<div style="font-size:3rem;margin-bottom:1rem;">🔒</div>' +
        '<div style="font-size:1.5rem;font-weight:800;color:#0f172a;margin-bottom:0.5rem;">תוכן למנויים בלבד</div>' +
        '<div style="color:#475569;font-size:1rem;line-height:1.6;margin-bottom:1.5rem;">' +
          'גישה לכל התכנים — אוצר מילים, דקדוק, הבנת הנקרא ותרגול משפטים.<br>' +
          '<strong style="color:#1e40af;">35 ₪ לחודש בלבד.</strong>' +
        '</div>' +
        '<button id="_pgSubBtn" style="display:block;width:100%;padding:0.9rem;background:#2563eb;color:#fff;border:none;border-radius:50px;font-size:1.05rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:0.75rem;">רכוש מנוי ←</button>' +
        '<a href="app.html" style="display:block;color:#64748b;font-size:0.9rem;text-decoration:none;">חזור לדף הבית</a>' +
      '</div>';

    document.getElementById("_pgSubBtn").addEventListener("click", function () {
      var btn = document.getElementById("_pgSubBtn");
      btn.textContent = "טוען...";
      btn.disabled = true;

      fbUser.getIdToken().then(function (token) {
        return fetch(PAYMENT_FN, {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert("שגיאה: " + (data.error || "לא ניתן לפתוח עמוד תשלום"));
          btn.textContent = "רכוש מנוי ←";
          btn.disabled = false;
        }
      }).catch(function () {
        alert("שגיאת תקשורת — נסה שוב");
        btn.textContent = "רכוש מנוי ←";
        btn.disabled = false;
      });
    });
  }

  function _check() {
    if (!window.firebase || !window.firebase.auth || !window.firebase.firestore) {
      setTimeout(_check, 80);
      return;
    }
    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) { window.location.href = "index.html"; return; }

      firebase.firestore().collection("users").doc(user.uid).get()
        .then(function (doc) {
          if (doc.exists && doc.data().premium === true) {
            var ov = document.getElementById("_pgOv");
            if (ov) ov.remove();
          } else {
            _showPaywall(user);
          }
        })
        .catch(function () {
          // On Firestore error — allow access rather than block
          var ov = document.getElementById("_pgOv");
          if (ov) ov.remove();
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { _showSpinner(); _check(); });
  } else {
    _showSpinner(); _check();
  }
})();
