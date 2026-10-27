// CityJoy Service Worker (FAZ 6 - PWA + Cache + Push)
const CACHE_ADI = 'cityjoy-v2';
const OFFLINE_URL = '/404.html';

// ─── Önbelleğe alınacak statik dosyalar ───────────────────────────
const STATIK_DOSYALAR = [
    '/',
    '/index.html',
    '/giris.html',
    '/anasayfa.html',
    '/kesfet-genel.html',
    '/profil.html',
    '/mesajlar.html',
    '/yeni-gonderi.html',
    '/js/firebase-config.js',
    '/js/auth-check.js',
    '/js/post-service.js',
    '/js/user-service.js',
    '/js/chat-service.js',
    '/js/notification-service.js',
    '/404.html'
];

// ─── INSTALL ──────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_ADI).then((cache) => {
            // Hata verirse durma — her dosya ayrı ayrı
            return Promise.allSettled(
                STATIK_DOSYALAR.map(url => cache.add(url).catch(() => null))
            );
        })
    );
    self.skipWaiting();
});

// ─── ACTIVATE ─────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((anahtarlar) => 
            Promise.all(
                anahtarlar
                    .filter(k => k !== CACHE_ADI)
                    .map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// ─── FETCH - Network First (Firebase), Cache First (Statik) ───────
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Firebase / Google isteklerini her zaman ağdan çek
    if (
        url.hostname.includes('firebase') ||
        url.hostname.includes('googleapis') ||
        url.hostname.includes('gstatic') ||
        url.hostname.includes('firebaseio') ||
        url.hostname.includes('firestore') ||
        e.request.method !== 'GET'
    ) {
        return; // SW müdahale etme
    }

    // CDN (Tailwind, fonts) → ağ önce, önbellek yedek
    if (url.hostname.includes('tailwindcss') || url.hostname.includes('fonts')) {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    const klon = res.clone();
                    caches.open(CACHE_ADI).then(c => c.put(e.request, klon));
                    return res;
                })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Yerel dosyalar → önbellek önce, ağ yedek
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;

            return fetch(e.request)
                .then(res => {
                    if (res.ok) {
                        const klon = res.clone();
                        caches.open(CACHE_ADI).then(c => c.put(e.request, klon));
                    }
                    return res;
                })
                .catch(() => caches.match(OFFLINE_URL));
        })
    );
});

// ─── PUSH BİLDİRİM ────────────────────────────────────────────────
self.addEventListener('push', (e) => {
    let veri = { title: 'CityJoy', body: 'Yeni bir bildirim var', icon: '/cityjoy-assets/logo.png' };
    
    try {
        if (e.data) veri = { ...veri, ...e.data.json() };
    } catch (_) {
        if (e.data) veri.body = e.data.text();
    }

    e.waitUntil(
        self.registration.showNotification(veri.title, {
            body: veri.body,
            icon: veri.icon || '/cityjoy-assets/logo.png',
            badge: '/cityjoy-assets/badge.png',
            data: { url: veri.url || '/' },
            vibrate: [100, 50, 100],
            requireInteraction: false,
            tag: veri.tag || 'cityjoy-bildirim'
        })
    );
});

// ─── BİLDİRİME TIKLAMA ────────────────────────────────────────────
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    const hedefUrl = e.notification.data?.url || '/anasayfa.html';

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Açık sekme varsa ona git
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(hedefUrl);
                    return client.focus();
                }
            }
            // Yoksa yeni sekme aç
            return clients.openWindow(hedefUrl);
        })
    );
});

// ─── BACKGROUND SYNC (Offline Gönderi) ───────────────────────────
self.addEventListener('sync', (e) => {
    if (e.tag === 'gonderi-gonder') {
        e.waitUntil(offlineGonderileriGonder());
    }
});

async function offlineGonderileriGonder() {
    // IndexedDB'deki bekleyen gönderileri gönder
    // (İleride implement edilebilir)
    console.log('[SW] Background sync: gonderi-gonder');
}
