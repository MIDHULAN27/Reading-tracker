const CACHE_NAME = 'booklyn-reads-cache-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install Event - Pre-cache shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Custom caching strategies
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (e.g. POST, PUT, DELETE or Supabase auth calls)
  if (req.method !== 'GET') return;

  // Skip backend API requests (dynamic endpoints)
  if (url.pathname.startsWith('/api/')) return;

  // Strategy 1: Cache-First for static assets (Vite JS/CSS assets, SVG, icons)
  if (
    url.origin === self.location.origin &&
    (url.pathname.includes('/assets/') ||
     url.pathname.endsWith('.svg') ||
     url.pathname.endsWith('.png') ||
     url.pathname.endsWith('.ico') ||
     url.pathname.endsWith('.json'))
  ) {
    event.respondWith(
      caches.match(req).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(req).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
          return networkResponse;
        });
      })
    );
    return;
  }

  // Strategy 2: Network-First with Cache Fallback for APIs & External Images (Covers)
  // This allows offline viewing of books that have been searched/viewed before
  if (
    url.hostname.includes('openlibrary.org') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('covers.openlibrary.org') ||
    url.hostname.includes('googleusercontent.com')
  ) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          // If valid response, cache a clone and return it
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          // Fallback to cache if network is fully unavailable (offline)
          return caches.match(req).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            throw err;
          });
        })
    );
    return;
  }

  // Strategy 3: Default Network-First for main pages / router requests (to allow SPA routing fallbacks)
  event.respondWith(
    fetch(req)
      .catch((err) => {
        return caches.match(req).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          
          // If the page request fails (offline) and is not in cache, fallback to index.html
          if (req.mode === 'navigate') {
            return caches.match('/');
          }
          throw err;
        });
      })
  );
});
