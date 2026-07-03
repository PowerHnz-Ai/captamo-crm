const CACHE_NAME = 'meu-checklist-v4';
const base = self.location.pathname.replace(/sw\.js$/, '') || '/';
const p = (path) => (base.endsWith('/') ? base : base + '/') + path;
const urlsToCache = [
  base,
  p('index.html'),
  p('auth.html'),
  p('styles.css'),
  p('auth.css'),
  p('dist/tailwind.css'),
  p('app.js'),
  p('auth.js'),
  p('config.js'),
  p('firebase-init.js'),
  p('manifest.json')
];
const runtimeAssets = new Set([
  p('app.js'),
  p('auth.js'),
  p('styles.css'),
  p('auth.css'),
  p('dist/tailwind.css')
]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    const url = new URL(event.request.url);
    const isAuthRoute = /\/auth\/?$/.test(url.pathname);
    const shell = isAuthRoute ? p('auth.html') : p('index.html');
    event.respondWith(
      fetch(isAuthRoute ? shell : event.request).catch(() => caches.match(shell))
    );
    return;
  }

  const reqUrl = new URL(event.request.url);
  const isSameOrigin = reqUrl.origin === self.location.origin;
  if (isSameOrigin && runtimeAssets.has(reqUrl.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
