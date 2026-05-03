// ─── ROLLER DICE SIZE FIX ────────────────────────────────────────────
// Keeps the 5 main roller dice on one horizontal line while staying larger
// than the original dice. Scoreboard dice icons are untouched.

(function() {
  function injectDiceSizeStyles() {
    if (document.getElementById('diceSizeFixStyles')) return;

    const style = document.createElement('style');
    style.id = 'diceSizeFixStyles';
    style.textContent = `
      .dice-section .dice-row {
        display: flex !important;
        flex-wrap: nowrap !important;
        justify-content: center !important;
        align-items: flex-start !important;
        gap: 8px !important;
        margin-bottom: 14px !important;
      }

      .dice-section .die-wrap {
        flex: 0 0 auto !important;
        min-width: 0 !important;
      }

      .dice-section .die {
        width: 56px !important;
        height: 56px !important;
        border-radius: 12px !important;
        font-size: 1.95rem !important;
      }

      .dice-section .die-hold-btn {
        font-size: 0.66rem !important;
        padding: 4px 8px !important;
        min-width: 0 !important;
      }

      @media (max-width: 380px) {
        .dice-section .dice-row {
          gap: 6px !important;
        }

        .dice-section .die {
          width: 52px !important;
          height: 52px !important;
          border-radius: 11px !important;
          font-size: 1.75rem !important;
        }

        .dice-section .die-hold-btn {
          font-size: 0.62rem !important;
          padding: 3px 7px !important;
        }
      }

      @media (max-width: 340px) {
        .dice-section .dice-row {
          gap: 5px !important;
        }

        .dice-section .die {
          width: 48px !important;
          height: 48px !important;
          font-size: 1.6rem !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDiceSizeStyles);
  } else {
    injectDiceSizeStyles();
  }
})();

// ─── PWA INSTALL FLOW ────────────────────────────────────────────────
// Android: uses the native beforeinstallprompt event.
// iPhone/iPad: shows clear Share → Add to Home Screen instructions.

(function() {
  const DISMISSED_KEY = 'yum_install_banner_dismissed';
  let deferredInstallPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent || '') ||
      ((navigator.platform || '').toLowerCase() === 'macintel' && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /android/i.test(navigator.userAgent || '');
  }

  function bannerDismissed() {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  }

  function installBanner() {
    return document.getElementById('installBanner');
  }

  function setBannerText(title, subtitle, buttonText) {
    const banner = installBanner();
    if (!banner) return;
    const titleEl = banner.querySelector('.ib-title');
    const subEl = banner.querySelector('.ib-sub');
    const btn = banner.querySelector('.ib-btn');
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = subtitle;
    if (btn) btn.textContent = buttonText;
  }

  function showInstallBanner(force) {
    const banner = installBanner();
    if (!banner || isStandalone()) return;
    if (!force && bannerDismissed()) return;

    if (isIOS()) {
      setBannerText('Install YUM!', 'Tap Share, then Add to Home Screen', 'HOW');
      banner.style.display = 'flex';
      return;
    }

    if (deferredInstallPrompt || isAndroid()) {
      setBannerText('Install YUM!', 'Add to home screen as an app', 'INSTALL');
      banner.style.display = 'flex';
    }
  }

  window.hideInstallBanner = function hideInstallBanner() {
    localStorage.setItem(DISMISSED_KEY, '1');
    const banner = installBanner();
    if (banner) banner.style.display = 'none';
  };

  function showIOSInstallHelp() {
    if (document.getElementById('iosInstallHelpOverlay')) {
      document.getElementById('iosInstallHelpOverlay').classList.add('open');
      return;
    }

    const style = document.createElement('style');
    style.id = 'iosInstallHelpStyles';
    style.textContent = `
      #iosInstallHelpOverlay {
        position: fixed;
        inset: 0;
        z-index: 1200;
        display: none;
        align-items: flex-end;
        justify-content: center;
        background: rgba(0,0,0,.72);
        padding: 16px;
      }
      #iosInstallHelpOverlay.open { display: flex; }
      .ios-install-card {
        width: min(440px, 100%);
        background: linear-gradient(145deg, var(--panel), #1a1a5e);
        border: 1px solid rgba(245,166,35,.35);
        border-radius: 24px;
        padding: 18px;
        box-shadow: 0 20px 60px rgba(0,0,0,.55);
        text-align: center;
      }
      .ios-install-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.8rem;
        letter-spacing: 3px;
        color: var(--gold);
      }
      .ios-install-step {
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: left;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 15px;
        padding: 12px;
        margin-top: 10px;
        color: var(--white);
        font-weight: 900;
      }
      .ios-install-step span {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--gold);
        color: #251400;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .ios-install-close {
        width: 100%;
        margin-top: 14px;
        border: none;
        border-radius: 999px;
        padding: 11px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 1000;
        background: linear-gradient(135deg, var(--green), #2ecc71);
        color: #111;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'iosInstallHelpOverlay';
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.remove('open'); };
    overlay.innerHTML = `
      <div class="ios-install-card">
        <div class="ios-install-title">Install YUM! on iPhone</div>
        <div class="ios-install-step"><span>1</span><div>Open this game in Safari.</div></div>
        <div class="ios-install-step"><span>2</span><div>Tap the Share button at the bottom.</div></div>
        <div class="ios-install-step"><span>3</span><div>Choose Add to Home Screen.</div></div>
        <button class="ios-install-close" onclick="document.getElementById('iosInstallHelpOverlay').classList.remove('open')">GOT IT</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.classList.add('open');
  }

  window.installApp = async function installApp() {
    localStorage.removeItem(DISMISSED_KEY);

    if (isStandalone()) {
      if (window.showToast) showToast('YUM! is already installed');
      return;
    }

    if (isIOS()) {
      showIOSInstallHelp();
      showInstallBanner(true);
      return;
    }

    if (!deferredInstallPrompt) {
      showInstallBanner(true);
      if (window.showToast) showToast('Open in Chrome and try again if install does not appear');
      return;
    }

    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;

    if (choice && choice.outcome === 'accepted') {
      const banner = installBanner();
      if (banner) banner.style.display = 'none';
      if (window.showToast) showToast('YUM! installed 🎲');
    }
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallBanner(false);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const banner = installBanner();
    if (banner) banner.style.display = 'none';
    localStorage.setItem(DISMISSED_KEY, '1');
  });

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  function initPwaInstall() {
    registerServiceWorker();
    if (isStandalone()) return;
    if (isIOS()) setTimeout(() => showInstallBanner(false), 1400);
    else if (isAndroid()) setTimeout(() => showInstallBanner(false), 2200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwaInstall);
  } else {
    initPwaInstall();
  }
})();
