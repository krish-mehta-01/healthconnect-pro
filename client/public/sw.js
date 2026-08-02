// HealthConnect Pro — minimal app-shell service worker.
//
// Scope is intentionally narrow: this only caches same-origin static assets (the built
// JS/CSS bundle and the HTML shell) so the app can still LOAD with no connection. It does
// NOT cache or intercept API calls (those go to a different origin — the AppSail backend —
// and pass straight through untouched); offline write support for reports/patients is
// handled separately in the app itself via a localStorage-backed queue
// (client/src/utils/offlineQueue.ts), not through this service worker.
//
// Bump CACHE_NAME on any strategy change below to invalidate old caches on next visit.
const CACHE_NAME = 'hcp-shell-v1';
const APP_SHELL = ['/app/index.html', '/app/manifest.json', '/app/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {
      // Best-effort — a failed precache shouldn't block install (e.g. offline first install).
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests — everything else (the backend API, POST/PUT/
  // DELETE, cross-origin font/CDN requests) passes straight through untouched.
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  // Hashed build assets (content-addressed filenames — safe to cache-first forever).
  if (url.pathname.startsWith('/app/assets/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
    );
    return;
  }

  // App shell / navigation — network-first so users get fresh content when online, falling
  // back to the cached shell when offline.
  if (event.request.mode === 'navigate' || APP_SHELL.some((p) => url.pathname === p)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/app/index.html')))
    );
  }
});
