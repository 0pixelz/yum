// ─── FIRST-LAUNCH ASSET PRELOADER ───────────────────────────────────────────
// Game-style "Downloading game data…" screen for the web / PWA build. On the
// first launch of each app version it fetches the COMPLETE asset set (every
// script, stylesheet and icon) from the page, with a real progress bar. Each
// fetch flows through the controlling service worker, whose normal fetch
// handlers cache it — so afterwards the whole game works offline and loads
// instantly. Fetching page-side (instead of messaging the SW) matters: it
// works even while an OLDER service worker still controls the page after a
// deploy, which is exactly the state most returning visitors are in.
// Skipped entirely inside the native app (assets ship in the binary) and on
// repeat launches.
(function () {
  'use strict';

  // Native app: content is bundled locally, nothing to download.
  if (window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) return;
  if (!('serviceWorker' in navigator)) return;

  const version = window.APP_VERSION || 'dev';
  const FLAG_KEY = 'yum_assets_ready__' + version;
  const ATTEMPT_KEY = 'yum_assets_attempts__' + version;
  try { if (localStorage.getItem(FLAG_KEY)) return; } catch (e) { return; }
  if (!navigator.onLine) return; // offline first launch: don't block, retry next time

  const MAX_WAIT_MS = 25000;      // never hold the player hostage on a bad network
  const FETCH_TIMEOUT_MS = 10000; // one hung request must not stall the bar
  const CONCURRENCY = 6;
  const GIVE_UP_ATTEMPTS = 2;     // after 2 timed-out launches, stop nagging

  // ── Asset list: everything the page references, same-origin only ──────────
  function collectAssets() {
    const urls = new Set();
    const sameOrigin = u => {
      try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; }
    };
    document.querySelectorAll('script[src]').forEach(s => { if (sameOrigin(s.src)) urls.add(s.src); });
    document.querySelectorAll('link[rel="stylesheet"][href]').forEach(l => { if (sameOrigin(l.href)) urls.add(l.href); });
    [
      './manifest.json', './icon.svg',
      './icons/icon-192.png', './icons/icon-512.png',
      './icons/icon-maskable-192.png', './icons/icon-maskable-512.png',
      './icons/apple-touch-icon.png', './icons/favicon-32.png',
    ].forEach(u => urls.add(new URL(u, location.href).href));
    return [...urls];
  }

  // ── Overlay UI ─────────────────────────────────────────────────────────────
  let overlay = null, barEl = null, pctEl = null;

  function showOverlay() {
    const style = document.createElement('style');
    style.textContent = `
      #yamPreload {
        position: fixed; inset: 0; z-index: 2000; display: flex;
        flex-direction: column; align-items: center; justify-content: center;
        gap: 14px; background: radial-gradient(circle at 50% 18%, #1b2b6b 0%, #101a45 45%, #080e2c 100%);
        transition: opacity 0.45s ease;
      }
      #yamPreload.gone { opacity: 0; pointer-events: none; }
      .ypl-logo { width: 84px; height: 84px; filter: drop-shadow(0 0 18px rgba(140,170,255,0.5)); }
      .ypl-title { font-family: 'Bebas Neue', cursive; font-size: 1.5rem; letter-spacing: 4px; color: #f5a623; }
      .ypl-sub { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 800; color: #9fb2e6; letter-spacing: 0.5px; }
      .ypl-bar-wrap { width: min(260px, 70vw); height: 10px; border-radius: 999px; background: rgba(255,255,255,0.10); overflow: hidden; border: 1px solid rgba(255,255,255,0.12); }
      .ypl-bar { height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg, #4ecdc4, #f5a623); transition: width 0.25s ease; }
      .ypl-pct { font-family: 'Bebas Neue', cursive; font-size: 1.1rem; letter-spacing: 2px; color: #fff; }
      .ypl-hint { font-family: 'Nunito', sans-serif; font-size: 0.68rem; color: rgba(159,178,230,0.7); }
    `;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.id = 'yamPreload';
    overlay.innerHTML = `
      <svg class="ypl-logo" viewBox="0 0 64 64" aria-hidden="true"><use href="#yum-mark"/></svg>
      <div class="ypl-title">YAMIO</div>
      <div class="ypl-sub">DOWNLOADING GAME DATA…</div>
      <div class="ypl-bar-wrap"><div class="ypl-bar" id="yplBar"></div></div>
      <div class="ypl-pct" id="yplPct">0%</div>
      <div class="ypl-hint">One-time download — the game works offline afterwards</div>`;
    document.body.appendChild(overlay);
    barEl = overlay.querySelector('#yplBar');
    pctEl = overlay.querySelector('#yplPct');
  }

  function setProgress(done, total) {
    if (!barEl || !total) return;
    const pct = Math.min(100, Math.round((done / total) * 100));
    barEl.style.width = pct + '%';
    pctEl.textContent = pct + '%';
  }

  let finished = false;
  function finish(setFlag) {
    if (finished) return;
    finished = true;
    if (setFlag) {
      try {
        localStorage.setItem(FLAG_KEY, String(Date.now()));
        localStorage.removeItem(ATTEMPT_KEY);
      } catch (e) {}
    }
    if (overlay) {
      setProgress(1, 1);
      setTimeout(() => {
        overlay.classList.add('gone');
        setTimeout(() => overlay.remove(), 600);
      }, 250);
    }
  }

  // Wait until a service worker controls this page, so our fetches actually
  // flow through it and land in its cache. On the very first visit the SW
  // registers on DOMContentLoaded and claims the page moments later; for
  // returning visitors a (possibly older) SW is controlling already.
  function waitForController(ms) {
    if (navigator.serviceWorker.controller) return Promise.resolve(true);
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve(!!navigator.serviceWorker.controller), ms);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        resolve(true);
      }, { once: true });
    });
  }

  // Resolves no matter what: success, HTTP error, network error or timeout.
  // The point is populating the SW cache and advancing the bar, not the body.
  function fetchInto(url) {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, FETCH_TIMEOUT_MS);
      fetch(url, { credentials: 'same-origin' })
        .catch(() => null)
        .then(() => { clearTimeout(timer); resolve(); });
    });
  }

  // ── Run ────────────────────────────────────────────────────────────────────
  async function run() {
    let attempts = 0;
    try {
      attempts = (Number(localStorage.getItem(ATTEMPT_KEY)) || 0) + 1;
      localStorage.setItem(ATTEMPT_KEY, String(attempts));
    } catch (e) {}

    showOverlay();
    // Hard cap: hide regardless, and after repeated bad-network launches set
    // the flag anyway so the player isn't greeted by this screen forever.
    const killTimer = setTimeout(() => finish(attempts >= GIVE_UP_ATTEMPTS), MAX_WAIT_MS);

    const controlled = await waitForController(8000);
    if (!controlled) {
      clearTimeout(killTimer);
      finish(attempts >= GIVE_UP_ATTEMPTS);
      return;
    }

    const urls = collectAssets();
    let done = 0, next = 0;
    async function worker() {
      while (next < urls.length && !finished) {
        const url = urls[next++];
        await fetchInto(url);
        done++;
        setProgress(done, urls.length);
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    clearTimeout(killTimer);
    finish(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
