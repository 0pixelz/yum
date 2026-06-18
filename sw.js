const CACHE_NAME = 'yamio-pwa-v8';
const NAV_TIMEOUT_MS = 4000;

// Files that must be available offline so the PWA splash always resolves to a
// real page, even when the first launch network fetch fails or hangs. Anything
// referenced from index.html that isn't in this list is fetched on demand via
// the runtime cache.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/icons.css',
  './js/version.js',
  './privacy.html',
  './deleteaccount.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Best-effort precache: one bad asset must not block install, otherwise
      // the previous (possibly broken) SW keeps serving stuck navigations.
      Promise.all(PRECACHE_URLS.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
      ))
    )
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
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }

  // Critical: never intercept cross-origin traffic. Firebase Realtime DB,
  // Firebase Auth, App Check (reCAPTCHA), gstatic SDK scripts, Google Fonts
  // and the Anthropic API must reach the network directly. A previous version
  // of this SW cached every cross-origin GET, which corrupted short-lived
  // Firebase auth/poll URLs and made data fail to load on some Android
  // devices (browser shell visible, no data).
  if (url.origin !== self.location.origin) return;

  // Don't try to cache or intercept the service worker file itself.
  if (url.pathname.endsWith('/sw.js')) return;

  const isNavigation = request.mode === 'navigate';
  const isCodeAsset = /\.(js|css|html)$/i.test(url.pathname);

  if (isNavigation || isCodeAsset) {
    event.respondWith(networkFirstWithTimeout(request, isCodeAsset));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

function networkFirstWithTimeout(request, bypassHttpCache) {
  // Race the network against a timeout. On slow Android mobile networks the
  // first navigation fetch can hang for tens of seconds; without a timeout
  // the PWA system splash never goes away (reported on S21 Ultra / Android 15).
  //
  // For code assets we re-issue the request with `cache: 'reload'` so the
  // network leg bypasses the browser HTTP cache. Otherwise a just-deployed
  // build keeps losing to a stale copy held by the HTTP cache, and the player
  // never sees the update without clearing browser data.
  const networkRequest = bypassHttpCache
    ? new Request(request, { cache: 'reload' })
    : request;
  return new Promise(resolve => {
    let settled = false;
    const finish = response => {
      if (settled) return;
      settled = true;
      resolve(response);
    };

    const fallbackToCache = () => caches.match(request).then(cached => {
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return caches.match('./index.html').then(idx => idx || Response.error());
      }
      return Response.error();
    });

    const timer = setTimeout(() => {
      fallbackToCache().then(res => { if (res) finish(res); });
    }, NAV_TIMEOUT_MS);

    fetch(networkRequest).then(response => {
      clearTimeout(timer);
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(request, copy))
          .catch(() => null);
      }
      finish(response);
    }).catch(() => {
      clearTimeout(timer);
      fallbackToCache().then(finish);
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then(cache =>
    cache.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          cache.put(request, response.clone()).catch(() => null);
        }
        return response;
      }).catch(() => null);
      return cached || networkFetch.then(res => res || Response.error());
    })
  );
}
