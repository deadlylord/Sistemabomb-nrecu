const CACHE_NAME = 'bombon-pos-cache-v7';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/index.tsx', // The main app code
    '/assets/icon.svg',
    '/assets/maskable_icon.svg',
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force the new service worker to activate immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache and caching local resources');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to cache local resources during install:', error);
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Take control of all open clients
    );
});

self.addEventListener('fetch', (event) => {
    // Use a "cache falling back to network, then cache" strategy for performance and offline capability.
    event.respondWith(
        caches.match(event.request).then((response) => {
            // If we have a cached response, return it.
            if (response) {
                return response;
            }

            // If not, fetch from the network.
            return fetch(event.request).then(
                (networkResponse) => {
                    // Check if we received a valid response
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Cache the new resource for next time.
                                cache.put(event.request, responseToCache);
                            });
                    }
                    return networkResponse;
                }
            ).catch(() => {
                // This will be triggered on network failure if the resource is not cached.
                // For page navigation, we can provide a fallback to the root.
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }
            });
        })
    );
});