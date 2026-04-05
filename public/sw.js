/** Em push na main, o workflow GitHub substitui este valor pelo CACHE_ID (igual ao ?v= do index.html). */
const CACHE_NAME = 'cv-edi-pro-v10589';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/main.js',
    '/config.js',
    '/api.js',
    '/ui.js',
    '/auth.js',
    '/cv-builder.js',
    '/pdf.js',
    '/style.css',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) =>
                Promise.allSettled(
                    PRECACHE_URLS.map((url) =>
                        cache.add(new Request(url, { cache: 'reload' })).catch((err) => {
                            console.warn('[SW] precache:', url, err);
                        })
                    )
                )
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (url.pathname.startsWith('/api/')) return;

    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            })
            .catch(() => caches.match(request).then((c) => c || Promise.reject(new Error('offline'))))
    );
});
