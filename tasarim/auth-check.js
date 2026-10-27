// CityJoy - Oturum Kontrolü + Konum Sistemi
// Korumalı olmayan sayfalar
const PUBLIC_PAGES = ['index.html', 'giris.html', 'kayit.html', 'dil-secimi.html', '404.html'];

// ── Konum + Şehir sistemini yükle (her sayfada otomatik çalışır) ──
function _scriptYukle(src, sonra) {
  const s = document.createElement('script');
  s.src = src;
  if (sonra) s.onload = sonra;
  document.head.appendChild(s);
}
// Önce konum.js, yüklendikten sonra sehir-init.js
_scriptYukle('./konum.js', () => _scriptYukle('./sehir-init.js'));

const currentPage = window.location.pathname.split('/').pop() || 'index.html';
const isPublic = PUBLIC_PAGES.some(p => currentPage.includes(p));

if (!isPublic) {
    // Önce hızlı localStorage kontrolü
    if (localStorage.getItem('cj_oturum') !== 'acik') {
        window.location.replace('giris.html');
    } else {
        // Sonra Firebase doğrulaması
        import('./firebase-config.js').then(({ auth }) => {
            import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").then(({ onAuthStateChanged }) => {
                onAuthStateChanged(auth, (user) => {
                    if (!user) {
                        localStorage.removeItem('cj_oturum');
                        window.location.replace('giris.html');
                    }
                });
            });
        });
    }
}
