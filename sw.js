const CACHE_NAME = 'yum-pwa-v4';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

async function withInjectedScripts(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  let html = await response.text();
  const scripts = `\n<script src="js/hide-device-profile.js?v=4"></script>\n<script src="js/lobby-actions-restore.js?v=4"></script>\n<script src="js/daily-challenge-button-fix.js?v=4"></script>\n`;

  if (!html.includes('js/hide-device-profile.js')) {
    html = html.replace('</body>', scripts + '</body>');
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNavigation = event.request.mode === 'navigate';
  const isCodeAsset = /\.(js|css)$/i.test(url.pathname);

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then(response => withInjectedScripts(response.clone()).then(injected => {
          const copy = injected.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => null);
          return injected;
        }))
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
    );
    return;
  }

  if (isCodeAsset) {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => null);
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          cache.put(event.request, response.clone()).catch(() => null);
          return response;
        }).catch(() => null);
        return cached || networkFetch;
      })
    )
  );
});
