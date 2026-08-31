const CACHE_NAME = 'bombon-pos-cache-v1.1.85-network-first';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/icon.svg',
    '/assets/maskable_icon.svg',
    '/icon-192.png',
    '/icon-512.png',
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force the new service worker to activate immediately without waiting
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache and caching basic offline resources');
                return cache.addAll(urlsToCache).catch(err => {
                    console.warn('Some resource failed to cache, continuing...', err);
                });
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Claim control of clients immediately
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests and same-origin URLs
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Network-First strategy: try the network, fall back to cache when offline
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If we get a valid response, cache it and return
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // If network fails (offline), try matching in the cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If not in cache and navigating, fall back to / (index.html)
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
            })
    );
});