(function () {
    if (localStorage.getItem('lmd_cookies') === '1') return;

    var css = '#lmd-cc{position:fixed;bottom:0;left:0;right:0;background:#1e293b;color:#e2e8f0;padding:0.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;z-index:9990;font-size:0.875rem;flex-wrap:wrap;box-shadow:0 -2px 12px rgba(0,0,0,0.25);}' +
              '#lmd-cc a{color:#93c5fd;text-decoration:underline;}' +
              '#lmd-cc-btn{background:#2563eb;color:#fff;border:none;border-radius:6px;padding:0.45rem 1.4rem;font-size:0.875rem;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0;}' +
              '#lmd-cc-btn:hover{background:#1d4ed8;}';
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.id = 'lmd-cc';
    bar.innerHTML = '<span>האתר משתמש בעוגיות לניתוח גולשים ושיפור השירות. <a href="/privacy.html">מדיניות פרטיות ←</a></span>' +
                    '<button id="lmd-cc-btn">הבנתי</button>';

    function mount() {
        if (document.body) {
            document.body.appendChild(bar);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

    document.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'lmd-cc-btn') {
            localStorage.setItem('lmd_cookies', '1');
            bar.remove();
        }
    });
})();
