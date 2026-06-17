// Service Worker for Magazzino V5.5 PWA
// This enables the "Install" prompt in Chrome/Edge

const CACHE_NAME = 'magazzino-v5-cache-v1';

// Files to cache for offline access (minimal for now)
const urlsToCache = [
    '/',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching essential files');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                // Force activation immediately
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - Network first strategy (always try network, fallback to cache)
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip API requests and supabase
    const url = new URL(event.request.url);
    if (url.pathname.startsWith('/api/') ||
        url.hostname.includes('supabase')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone the response before caching
                const responseClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    // No cache entry: return a synthetic offline response
                    // to avoid "Failed to convert value to 'Response'" errors
                    return new Response('Offline', {
                        status: 503,
                        statusText: 'Offline',
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
    );
});
