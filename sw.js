/* =======================================================
   SERVICE WORKER
   Strategy:
     - App files (html/css/js)  → NETWORK FIRST
         Online: hamesha fresh code (code change + refresh = turant naya)
         Offline: cache se chalega
     - CDN (gstatic, fonts)      → CACHE FIRST
         Versioned hai, change nahi hota, cache se tez

   Pehle sab kuch cache-first tha — isiliye code change karne
   par phone par purana page dikhta tha. Ab app files pehle
   network se aati hain, cache sirf backup hai.
   ======================================================= */
const CACHE = 'bunny-v2';

const PRECACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './firebase-config.js',
    './logo.png'
];

// app files — inhe hamesha fresh chahiye
const isAppFile = (url, base) =>
    url.origin === base &&
    (url.pathname.endsWith('.html') || url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.js') || url.pathname === '/');

// CDN — inhe cache se dena hai (gstatic, fonts)
const isCdn = (url) =>
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // Firebase realtime DB (WebSocket) — cache kabhi nahi
    if (url.hostname.includes('firebaseio.com')) return;

    // ---------- APP FILES: network first ----------
    if (isAppFile(url, self.location.origin)) {
        e.respondWith(
            fetch(req)
                .then((res) => {
                    if (res && res.ok) {
                        const clone = res.clone();
                        caches.open(CACHE).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
        );
        return;
    }

    // ---------- CDN: cache first ----------
    if (isCdn(url)) {
        e.respondWith(
            caches.match(req).then((hit) => {
                if (hit) return hit;
                return fetch(req)
                    .then((res) => {
                        if (res && res.ok) {
                            const clone = res.clone();
                            caches.open(CACHE).then((c) => c.put(req, clone));
                        }
                        return res;
                    })
                    .catch(() => hit);
            })
        );
        return;
    }

    // ---------- baaki: network, fallback cache ----------
    e.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok && url.origin === self.location.origin) {
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, clone));
                }
                return res;
            })
            .catch(() => caches.match(req))
    );
});