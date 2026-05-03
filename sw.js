const CACHE_NAME = 'yum-pwa-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/firebase-init.js',
  './js/app.js',
  './js/multiplayer-rematch.js',
  './js/first-roll.js',
  './js/rematch-fix.js',
  './js/rematch-final.js',
  './js/achievements.js',
  './js/score-labels.js',
  './js/store.js',
  './js/profile-login.js',
  './js/scoring-rules.js',
  './js/dice-size-fix.js',
  './js/yum-roll-celebration.js',
  './js/skin-store-upgrade.js',
  './js/per-die-color-palette.js',
  './js/daily-rewards-lobby-upgrade.js',
  './icon.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => null))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => null);
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
