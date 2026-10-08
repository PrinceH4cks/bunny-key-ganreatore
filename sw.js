/* =======================================================
   SERVICE WORKER — full page cache
   Pehli visit par saari files cache ho jati hain.
   Agli visit par network ki zaroorat nahi — page foran
   cache se load hota hai (offline bhi chalta hai).

   Firebase SDK (gstatic) ko runtime cache me rakha hai —
   woh already fast hai, par offline support milta hai.
   ======================================================= */
const CACHE = 'bunny-v1';

const PRECACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './firebase-config.js',
    './logo.png'
];

// Install — sab kuch cache karo
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE)
            // addAll poora fail ho jaata hai agar ek 404 ho — isliye
            // individually add karna safer hai
            .then((c) => Promise.all(
                PRECACHE.map((url) => c.add(url).catch(() => null))
            ))
            .then(() => self.skipWaiting())
    );
});

// Activate — purana cache hata do
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch — cache first, network fallback
self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Firebase realtime database (WebSocket) ko cache mat karo
    if (url.hostname.includes('firebaseio.com')) return;

    e.respondWith(
        caches.match(req).then((hit) => {
            if (hit) {
                // Cache me hai — turant do, background me update karo
                fetch(req)
                    .then((res) => {
                        if (res && res.ok) {
                            caches.open(CACHE).then((c) => c.put(req, res.clone()));
                        }
                    })
                    .catch(() => {});
                return hit;
            }

            // Cache me nahi — network se le kar cache me daalo
            return fetch(req)
                .then((res) => {
                    if (res && res.ok && (url.origin === self.location.origin || url.hostname.includes('gstatic.com'))) {
                        const clone = res.clone();
                        caches.open(CACHE).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() => caches.match('./index.html'));
        })
    );
});