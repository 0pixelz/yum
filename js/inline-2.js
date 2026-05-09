    // Service worker is registered from js/dice-size-fix.js using ./sw.js.
    // A second blob-URL registration here used to fight that one and was
    // refused by some Chromium builds, which made the installed TWA fall
    // back to showing the Chrome URL bar.

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
