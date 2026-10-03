/**
 * Service Worker - Painel Pessoal PWA
 * Provides safe offline caching and app shell capability.
 */

const CACHE_NAME = 'painel-pessoal-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/components.css',
  './css/modules.css',
  './js/app.js',
  './js/utils/helpers.js',
  './js/storage/storage-interface.js',
  './js/storage/local-storage-adapter.js',
  './js/storage/db.js',
  './js/modules/dashboard.js',
  './js/modules/tasks.js',
  './js/modules/calendar.js',
  './js/modules/studies.js',
  './js/modules/projects.js',
  './js/modules/finance.js',
  './js/modules/habits.js',
  './js/modules/goals.js',
  './js/modules/notes.js',
  './js/modules/settings.js',
  './js/modules/backup.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// 1. Install Event: Precaches static application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use cache.addAll with individual catch so 1 missing asset does not fail installation
      return Promise.allSettled(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[PWA SW] Precache falhou para ${asset}:`, err);
          })
        )
      );
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event: Cleans up obsolete cache versions and claims clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[PWA SW] Removendo cache obsoleto: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Stale-While-Revalidate / Cache-First with Network Fallback
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // Handle navigation requests (e.g. page reload or direct URL)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cachedIndex = await caches.match('./index.html');
        return cachedIndex || caches.match('./');
      })
    );
    return;
  }

  // Handle local assets and CDN resources
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version immediately and fetch fresh copy in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Network failure in background is fine when serving stale
          });
        return cachedResponse;
      }

      // If not in cache, fetch from network and dynamically cache
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache clones of valid responses
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch((err) => {
          // If offline and file not cached
          console.warn(`[PWA SW] Falha de rede para ${url.pathname}:`, err);
        });
    })
  );
});
