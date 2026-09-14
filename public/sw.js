// Service Worker for Magazzino V5.5 PWA
// This enables the "Install" prompt in Chrome/Edge

// Bumped on every meaningful change to this file so the browser installs a
// new worker and (via activate below) drops any cache left by a previous
// version, instead of accumulating entries under the same name forever.
const CACHE_NAME = 'magazzino-v5-cache-v2';

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

// Fetch event - always go to the network; only the fixed shell above (cached
// on install) is served if the network request fails.
//
// This used to cache every successfully fetched file (JS/CSS/HTML chunks
// included) under CACHE_NAME and replay it on any subsequent network hiccup.
// Since Next.js build files are content-hashed per deploy but CACHE_NAME
// never changed, a single transient failure on one chunk was enough to lock
// that one file to its old (pre-deploy) version while every other file kept
// updating normally - the same page ended up running a mix of old and new
// code (e.g. inconsistent number formatting between components that should
// be identical) until the cache entry happened to be overwritten again.
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
        fetch(event.request).catch(() => {
            // Network failed: only the small fixed shell is available offline.
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
