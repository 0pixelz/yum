// ─── MULTIPLAYER FIREBASE FALLBACK ───────────────────────────────────
// Helps older cached/lazy Firebase startup recover before creating or joining rooms.

(function() {
  function patchAsyncFunction(name) {
    const original = window[name];
    if (typeof original !== 'function') return;
    if (original.__firebaseFallbackPatched) return;

    const patched = async function(...args) {
      if (typeof window.ensureFirebaseDb === 'function') {
        window.ensureFirebaseDb();
      }

      // Give Firebase a brief moment to expose window.db if the SDK just finished loading.
      if (!window.db) {
        await new Promise(resolve => setTimeout(resolve, 250));
        if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
      }

      return original.apply(this, args);
    };

    patched.__firebaseFallbackPatched = true;
    window[name] = patched;
  }

  function initMultiplayerFallback() {
    patchAsyncFunction('createGame');
    patchAsyncFunction('joinGame');
    patchAsyncFunction('startGame');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMultiplayerFallback);
  } else {
    initMultiplayerFallback();
  }
})();
