// Bump this version any time you want to force-clear the cache manually.
// Under normal use, network-first means you'll always get the latest files
// automatically when online — no cache clearing needed.
const CACHE_NAME = 'sinus-tracker-v2';

const APP_FILES = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// ── Install: pre-cache all app files ─────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete any old caches ──────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: network-first for app files, cache fallback offline ────────
//
// Strategy:
//   1. Try the network first — always gets the latest version when online.
//   2. On success, update the cache in the background for next time.
//   3. If the network fails (offline), serve from cache.
//   4. If neither works, let the browser handle the error normally.
//
self.addEventListener('fetch', event => {
  // Only handle GET requests for our own origin
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Network succeeded — clone and refresh the cache entry
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — try the cache
        return caches.match(event.request)
          .then(cached => cached || Response.error());
      })
  );
});
