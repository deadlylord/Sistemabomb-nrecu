const CACHE_NAME = 'bombon-pos-cache-v1.1.132-local-styles';
const urlsToCache = ['/', '/index.html', '/startup.js', '/manifest.json', '/assets/icon.svg', '/assets/maskable_icon.svg', '/icon-192.png', '/icon-512.png'];
const staticAsset = /^\/assets\/[^?]+\.(?:js|css|svg|png|jpe?g|webp|gif|ico|woff2?|ttf)$/i;
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache).catch(error => console.warn('Offline resources unavailable:', error))));
});
self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('bombon-pos-cache-') && name !== CACHE_NAME).slice(0, -1).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    // Business/API responses must never enter a shared application-shell cache.
    if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Authorization') || request.cache === 'no-store' || request.cache === 'no-cache') return;
    if (!urlsToCache.includes(url.pathname) && !staticAsset.test(url.pathname)) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
            const response = await fetch(request);
            // An old tab may request a hashed chunk removed by a new deployment.
            const isScript = /\.js$/i.test(url.pathname);
            if (!response.ok || (isScript && !/javascript/i.test(response.headers.get('Content-Type') || ''))) {
                const previous = staticAsset.test(url.pathname) ? await caches.match(request) : await cache.match(request);
                if (previous) return previous;
                return Response.error();
            }
            const policy = response.headers.get('Cache-Control') || '';
            if (response.status === 200 && !/no-store|private/i.test(policy) && !response.redirected) {
                event.waitUntil(cache.put(request, response.clone()));
            }
            return response;
        } catch {
            const cached = staticAsset.test(url.pathname) ? await caches.match(request) : await cache.match(request);
            if (cached) return cached;
            if (request.mode === 'navigate') return await cache.match('/') || Response.error();
            return Response.error();
        }
    })());
});
