// ===== CityJoy Common JS =====
// Tüm sayfalarda ortak kullanılan fonksiyonlar

// ── Loading Screen ──────────────────────────────────────────
function initLoadingScreen(delay = 800) {
  window.addEventListener('load', function () {
    setTimeout(function () {
      const ls = document.getElementById('loading-screen');
      if (ls) {
        ls.style.opacity = '0';
        setTimeout(() => { ls.style.display = 'none'; }, 500);
      }
    }, delay);
  });
}

// ── Tab Switcher ─────────────────────────────────────────────
// tabId        : gösterilecek içerik elementinin id'si
// btn          : tıklanan tab butonu elementi
// tabSelector  : tüm tab butonlarının CSS selector'ı
// contentSelector : tüm içerik alanlarının CSS selector'ı
function switchTab(tabId, btn, tabSelector, contentSelector) {
  tabSelector = tabSelector || '.cj-tab';
  contentSelector = contentSelector || '.tab-content';

  document.querySelectorAll(tabSelector).forEach(t => t.classList.remove('active'));
  document.querySelectorAll(contentSelector).forEach(c => c.style.display = 'none');

  if (btn) btn.classList.add('active');
  const el = document.getElementById(tabId);
  if (el) el.style.display = 'block';
}

// ── Modal ────────────────────────────────────────────────────
function openModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) {
    m.style.display = 'flex';
    requestAnimationFrame(() => { m.classList.add('active'); });
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) {
    m.classList.remove('active');
    setTimeout(() => { m.style.display = 'none'; }, 300);
    document.body.style.overflow = '';
  }
}

// ESC tuşu ile açık modal'ı kapat
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(function (m) {
      m.classList.remove('active');
      setTimeout(() => { m.style.display = 'none'; }, 300);
    });
    document.body.style.overflow = '';
  }
});

// Modal overlay'e tıklayınca kapat
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    setTimeout(() => { e.target.style.display = 'none'; }, 300);
    document.body.style.overflow = '';
  }
});

// ── Ripple Effect ─────────────────────────────────────────────
function addRipple(element) {
  element.addEventListener('click', function (e) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${e.clientX - rect.left - size / 2}px;
      top: ${e.clientY - rect.top - size / 2}px;
      background: rgba(217, 160, 102, 0.15);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple-anim 0.5s ease-out;
      pointer-events: none;
    `;
    if (!element.style.position || element.style.position === 'static') {
      element.style.position = 'relative';
    }
    element.style.overflow = 'hidden';
    element.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

// Ripple CSS animasyonu (dinamik inject)
(function injectRippleStyle() {
  if (document.getElementById('cj-ripple-style')) return;
  const style = document.createElement('style');
  style.id = 'cj-ripple-style';
  style.textContent = `
    @keyframes ripple-anim {
      to { transform: scale(2.5); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
})();

// ── Toast Notification ────────────────────────────────────────
function showToast(message, type) {
  type = type || 'info'; // 'info' | 'success' | 'error'
  const colors = {
    info:    'rgba(37, 198, 207, 0.9)',
    success: 'rgba(34, 197, 94, 0.9)',
    error:   'rgba(239, 68, 68, 0.9)'
  };
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    font-size: 0.8rem;
    font-family: inherit;
    letter-spacing: 0.5px;
    z-index: 9000;
    backdrop-filter: blur(10px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    opacity: 0;
    transition: all 0.3s ease;
    white-space: nowrap;
    max-width: 90vw;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── Auto Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  // Loading screen varsa başlat
  if (document.getElementById('loading-screen')) {
    initLoadingScreen();
  }

  // İlk tab'ı otomatik aç
  const firstTab = document.querySelector('.cj-tab.active');
  const firstContent = document.querySelector('.tab-content');
  if (firstContent) firstContent.style.display = 'block';
});
