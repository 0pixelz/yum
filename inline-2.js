// Inline Service Worker via blob
    if('serviceWorker' in navigator) {
      const swCode = `
        const CACHE = 'yum-v1';
        self.addEventListener('install', e => {
          e.waitUntil(caches.open(CACHE).then(c => c.addAll(['.'])));
          self.skipWaiting();
        });
        self.addEventListener('activate', e => {
          e.waitUntil(clients.claim());
        });
        self.addEventListener('fetch', e => {
          e.respondWith(
            caches.match(e.request).then(r => r || fetch(e.request))
          );
        });
      `;
      const swBlob = new Blob([swCode], {type:'text/javascript'});
      const swURL = URL.createObjectURL(swBlob);
      navigator.serviceWorker.register(swURL).catch(()=>{});
    }

    // Show install prompt banner
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBanner();
    });

    function showInstallBanner() {
      const banner = document.getElementById('installBanner');
      if(banner) banner.style.display = 'flex';
    }

    function installApp() {
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(()=>{ deferredPrompt=null; hideInstallBanner(); });
    }

    function hideInstallBanner() {
      const banner = document.getElementById('installBanner');
      if(banner) banner.style.display = 'none';
    }
