// ─── SIGN IN WITH APPLE (WEB / PWA) ─────────────────────────────────────────
// Apple sign-in for the browser build, via Firebase's OAuth popup flow —
// the same popup-only strategy as Google sign-in in profile-login.js (no
// redirect fallback: storage-partitioned browsers break getRedirectResult).
// Inside the native iOS app this module stays inert; js/native-auth.js
// provides the native ASAuthorization flow there.
//
// Requires one-time Apple Developer + Firebase console setup (a Services ID
// registered with Firebase's auth handler as return URL, entered in the
// Firebase Apple provider config). Until then the button shows a clear
// "not configured" toast rather than failing silently.
(function () {
  'use strict';

  // Native app: native-auth.js owns Apple sign-in there.
  if (window.Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) return;

  const PROFILE_KEY = 'yum_google_profile';

  const APPLE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:0 0 auto"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.39 2.1 2.94 3.6 2.88 1.44-.06 1.99-.93 3.73-.93s2.24.93 3.77.9c1.56-.03 2.55-1.41 3.5-2.8 1.1-1.61 1.55-3.17 1.58-3.25-.03-.02-3.03-1.16-3.06-4.59zM14.16 4.06c.79-.96 1.33-2.29 1.18-3.62-1.14.05-2.53.76-3.35 1.72-.73.85-1.38 2.21-1.21 3.51 1.28.1 2.58-.65 3.38-1.61z"/></svg>';

  function saveProfile(user) {
    const email = user.email || '';
    const name = user.displayName || (email ? email.split('@')[0] : 'Player');
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({
        type: 'google',          // legacy gate value used app-wide for "signed in"
        provider: 'apple.com',
        uid: user.uid,
        name,
        email,
        photoURL: user.photoURL || '',
        signedInAt: Date.now(),
      }));
    } catch (e) {}
    if (typeof window.yumRefreshMenuButtons === 'function') window.yumRefreshMenuButtons();
    if (window.YumAvatars && typeof window.YumAvatars.refreshLobbyAvatar === 'function') {
      try { window.YumAvatars.refreshLobbyAvatar(); } catch (e) {}
    }
    const input = document.getElementById('playerName');
    if (input && !input.value.trim()) input.value = name.slice(0, parseInt(input.getAttribute('maxlength'), 10) || 16);
    if (typeof window.hydrateYumCreditsFromFirebase === 'function') {
      try { window.hydrateYumCreditsFromFirebase(); } catch (e) {}
    }
  }

  window.signInWithAppleWeb = async function signInWithAppleWeb() {
    // Resolve auth synchronously — an await before signInWithPopup breaks the
    // click's user-activation and browsers block the popup (same constraint
    // as signInWithGoogle in profile-login.js).
    let auth;
    try {
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
      if (!window.firebase || !firebase.auth) throw new Error('Firebase auth not loaded');
      auth = firebase.auth();
    } catch (e) {
      if (window.showToast) showToast('Sign-in unavailable — reload and try again');
      return;
    }

    const provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');

    try {
      const result = await auth.signInWithPopup(provider);
      const user = result && result.user;
      if (!user) return;
      saveProfile(user);
      if (window.showToast) showToast('Signed in with Apple');
    } catch (err) {
      const code = (err && err.code) || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
      console.warn('Apple web sign-in failed:', err);
      const MESSAGES = {
        'auth/operation-not-allowed': 'Apple sign-in isn\'t configured for the website yet',
        'auth/unauthorized-domain': 'This site isn\'t authorized for sign-in — contact support@yamio.io',
        'auth/popup-blocked': 'Your browser blocked the sign-in popup — allow popups and try again',
        'auth/network-request-failed': 'Network error — check your connection and try again',
        'auth/invalid-credential': 'Apple rejected the sign-in — the web Services ID setup may be incomplete',
      };
      if (window.showToast) showToast(MESSAGES[code] || ('Apple sign-in failed: ' + (code || 'unknown error')));
    }
  };

  // ── Lobby button (web only) ────────────────────────────────────────────────
  function ensureButton() {
    const bar = document.getElementById('profileLoginBar');
    if (!bar) return;

    let signedIn = false;
    try { signedIn = !!JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) {}

    const existing = document.getElementById('appleWebSignInBtn');
    if (signedIn) { if (existing) existing.remove(); return; }
    if (existing) return;

    const googleBtn = bar.querySelector('button[onclick*="signInWithGoogle"]');
    if (!googleBtn) return; // bar mid-rebuild; retry next tick

    const btn = document.createElement('button');
    btn.id = 'appleWebSignInBtn';
    btn.type = 'button';
    btn.className = 'social-login-btn';
    btn.style.cssText = 'background:#000;border-color:#000;color:#fff';
    btn.innerHTML = `${APPLE_ICON_SVG}<span>Sign in with Apple</span>`;
    btn.onclick = () => window.signInWithAppleWeb();
    googleBtn.insertAdjacentElement('afterend', btn);
  }

  setInterval(ensureButton, 700);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureButton);
  } else {
    ensureButton();
  }
})();
