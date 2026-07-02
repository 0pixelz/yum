// ─── NATIVE APP BRIDGE (Capacitor) ──────────────────────────────────────────
// Active only inside the Android app (Capacitor WebView). On the plain web /
// PWA build every hook below is a no-op. Loaded LAST so its wrappers sit
// outside every other module's.
//
// Responsibilities:
//   • hide the native splash screen once the UI is ready
//   • make the Android hardware/gesture back button behave like an app:
//     close the top-most overlay → confirm-quit a running game → minimize
//   • haptic feedback on dice rolls
(function () {
  'use strict';

  const cap = window.Capacitor;
  const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  window.isYamioNativeApp = isNative;
  if (!isNative) return;

  document.body && document.body.classList.add('native-app');
  const P = cap.Plugins || {};

  // ── Splash ────────────────────────────────────────────────────────────────
  function hideSplash() {
    try { P.SplashScreen && P.SplashScreen.hide(); } catch (e) {}
  }
  if (document.readyState === 'complete') {
    setTimeout(hideSplash, 250);
  } else {
    window.addEventListener('load', () => setTimeout(hideSplash, 250));
  }
  // Safety net: never leave the splash stuck if 'load' hangs on slow devices.
  setTimeout(hideSplash, 6000);

  // ── Android back button ───────────────────────────────────────────────────
  // Ordered top-most-first: the first visible overlay is what "back" closes.
  const OVERLAYS = [
    { id: 'reactionPicker',      close: () => window.closeReactionPicker && closeReactionPicker() },
    { id: 'confirmModal',        close: () => window.closeConfirm && closeConfirm() },
    { id: 'modalBackdrop',       close: () => window.closeModalEl && closeModalEl() },
    { id: 'oppViewer',           close: () => window.closeOppViewerBtn && closeOppViewerBtn() },
    { id: 'skinStoreOverlay',    close: () => window.closeSkinStore && closeSkinStore() },
    { id: 'yamWorldShopOverlay', close: el => el.classList.remove('open') },
    { id: 'yamWorldOverlay',     close: () => window.closeYamWorld && closeYamWorld() },
    { id: 'howToPlayOverlay',    close: () => window.closeHowToPlay && closeHowToPlay() },
    { id: 'achOverlay',          close: () => window.closeAchievements && closeAchievements() },
    { id: 'sessionOverlay',      close: () => window.closeSession && closeSession() },
    { id: 'botModeModal',        close: () => window.closeBotModeChoice && closeBotModeChoice() },
    { id: 'findMatchModeModal',  close: () => window.closeFindMatchModeChoice && closeFindMatchModeChoice() },
  ];

  function isShown(el) {
    if (!el) return false;
    if (el.classList.contains('open') || el.classList.contains('show')) return true;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }

  function gameRunning() {
    return (typeof botMode !== 'undefined' && botMode) ||
           (typeof mpMode  !== 'undefined' && mpMode);
  }

  function onBack() {
    // 1. Close the top-most open overlay.
    for (const o of OVERLAYS) {
      const el = document.getElementById(o.id);
      if (isShown(el)) {
        try { o.close(el); } catch (e) {}
        return;
      }
    }
    // 2. Mid-game: show the app's own "quit game?" confirm instead of exiting.
    if (gameRunning()) {
      if (typeof confirmNewGame === 'function') confirmNewGame();
      return;
    }
    // 3. Lobby: background the app (Android convention), never hard-exit.
    try { P.App && P.App.minimizeApp(); } catch (e) {}
  }

  if (P.App && typeof P.App.addListener === 'function') {
    P.App.addListener('backButton', onBack);
  }

  // ── Haptics on dice rolls ─────────────────────────────────────────────────
  function buzz() {
    try { P.Haptics && P.Haptics.impact({ style: 'MEDIUM' }); } catch (e) {}
  }
  if (typeof rollDice === 'function') {
    const _origRollDice = rollDice;
    rollDice = function () {
      buzz();
      return _origRollDice.apply(this, arguments);
    };
  }
})();
