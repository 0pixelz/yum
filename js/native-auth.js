// ─── NATIVE SIGN-IN (Capacitor) ─────────────────────────────────────────────
// Sign in with Apple for the native iOS app, wired into the existing Firebase
// auth + profile system. Inactive on the web/PWA build and on Android.
//
// Why this exists:
//   • App Store guideline 4.8: an app offering Google login must offer an
//     equivalent privacy-focused option — Sign in with Apple.
//   • Google's OAuth pages refuse to run inside embedded WebViews, so the
//     web popup flow (signInWithPopup) cannot complete inside the native app.
//     On iOS we therefore hide the Google button and offer Apple instead;
//     accounts still live in the same Firebase project.
//
// The signed-in profile is stored under the same localStorage key and shape
// the rest of the app expects (yum_google_profile with type:'google' — a
// legacy field name that every consumer gates on; provider:'apple.com' marks
// the real origin).
(function () {
  'use strict';

  const cap = window.Capacitor;
  const isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  if (!isNative) return;
  const isIOS = typeof cap.getPlatform === 'function' && cap.getPlatform() === 'ios';
  if (!isIOS) return;

  // The Google button is baked into the login-bar markup and re-added every
  // time the bar re-renders (e.g. right after sign-out). ensureAppleButton()
  // only hides it on a 700ms interval, so on re-render it flashes visible for
  // up to that long. Hide it immediately with CSS — the button can never work
  // in the iOS WebView anyway — so it never renders, no matter when the bar
  // rebuilds. ensureAppleButton() still swaps in the Apple button.
  (function injectHideGoogleCss() {
    const css = 'button[onclick*="signInWithGoogle"]{display:none !important}';
    const add = () => {
      if (document.getElementById('naHideGoogleCss')) return;
      const s = document.createElement('style');
      s.id = 'naHideGoogleCss';
      s.textContent = css;
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add);
  })();

  const P = cap.Plugins || {};
  const PROFILE_KEY = 'yum_google_profile';

  // ── Crypto helpers (nonce guards the Apple → Firebase token exchange) ─────
  function randomString(len) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const buf = new Uint8Array(len);
    crypto.getRandomValues(buf);
    let out = '';
    for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
    return out;
  }

  async function sha256Hex(str) {
    const data = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ── Firebase auth access (mirrors profile-login.js) ───────────────────────
  function loadScriptOnce(src, id) {
    return new Promise((resolve, reject) => {
      if (id && document.getElementById(id)) return resolve();
      const s = document.createElement('script');
      if (id) s.id = id;
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function getAuth() {
    if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    if (!window.firebase) throw new Error('Firebase SDK not loaded');
    if (!firebase.auth) {
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js', 'firebaseAuthSdk');
    }
    return firebase.auth();
  }

  // ── Sign in with Apple ─────────────────────────────────────────────────────
  let signingIn = false;

  window.signInWithApple = async function signInWithApple() {
    if (signingIn) return;
    signingIn = true;
    try {
      if (!P.SignInWithApple) throw new Error('Apple sign-in unavailable');

      const rawNonce = randomString(32);
      const hashedNonce = await sha256Hex(rawNonce);

      // Native ASAuthorization flow; clientId/redirectURI are only used by the
      // plugin's web fallback but its API requires them.
      const result = await P.SignInWithApple.authorize({
        clientId: 'io.yamio.app',
        redirectURI: 'https://yamio.io/',
        scopes: 'email name',
        state: randomString(12),
        nonce: hashedNonce,
      });

      const resp = result && result.response;
      const idToken = resp && resp.identityToken;
      if (!idToken) throw new Error('No identity token from Apple');

      const auth = await getAuth();
      const provider = new firebase.auth.OAuthProvider('apple.com');
      const credential = provider.credential({ idToken, rawNonce });
      const cred = await auth.signInWithCredential(credential);
      const user = cred && cred.user;
      if (!user) throw new Error('Firebase sign-in returned no user');

      // Apple only shares the name on the FIRST authorization — fall back hard.
      const appleName = [resp.givenName, resp.familyName].filter(Boolean).join(' ');
      const email = user.email || resp.email || '';
      const name = appleName || user.displayName || (email ? email.split('@')[0] : 'Player');

      try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify({
          type: 'google',            // legacy gate value used app-wide for "signed in"
          provider: 'apple.com',
          uid: user.uid,
          name,
          email,
          photoURL: user.photoURL || '',
          signedInAt: Date.now(),
        }));
      } catch (e) {}

      // Nudge the UI paths profile-login.js normally refreshes; its 700ms
      // watchdog rebuilds the profile bar off the stored profile.
      if (typeof window.yumRefreshMenuButtons === 'function') window.yumRefreshMenuButtons();
      if (window.YumAvatars && typeof window.YumAvatars.refreshLobbyAvatar === 'function') {
        try { window.YumAvatars.refreshLobbyAvatar(); } catch (e) {}
      }
      const input = document.getElementById('playerName');
      if (input && !input.value.trim()) input.value = name.slice(0, parseInt(input.getAttribute('maxlength'), 10) || 16);
      if (typeof window.hydrateYumCreditsFromFirebase === 'function') {
        try { window.hydrateYumCreditsFromFirebase(); } catch (e) {}
      }
      if (window.showToast) showToast('Signed in with Apple');
    } catch (err) {
      const msg = String((err && (err.message || err.code)) || err || '');
      // Only the user backing out of the Apple sheet (code 1001 / "canceled")
      // is silent. Everything else must be VISIBLE: notably ASAuthorization
      // error 1000, which iOS throws when the build is missing the Sign in
      // with Apple capability — swallowing it made the button look dead.
      if (/cancel|1001/i.test(msg)) return;
      console.warn('Apple sign-in failed:', err);
      if (window.showToast) {
        const hint = /1000/.test(msg)
          ? 'Apple sign-in failed (1000): the build is missing the Sign in with Apple capability'
          : 'Apple sign-in failed: ' + (msg.slice(0, 90) || 'unknown error');
        showToast(hint);
      }
    } finally {
      signingIn = false;
    }
  };

  // Re-authentication for sensitive actions (account deletion) — same native
  // Apple sheet, but the credential is applied to the CURRENT user.
  window.yamioAppleReauth = async function yamioAppleReauth(user) {
    if (!P.SignInWithApple) throw new Error('Apple sign-in unavailable');
    const rawNonce = randomString(32);
    const hashedNonce = await sha256Hex(rawNonce);
    const result = await P.SignInWithApple.authorize({
      clientId: 'io.yamio.app',
      redirectURI: 'https://yamio.io/',
      scopes: 'email name',
      state: randomString(12),
      nonce: hashedNonce,
    });
    const idToken = result && result.response && result.response.identityToken;
    if (!idToken) throw new Error('No identity token from Apple');
    const provider = new firebase.auth.OAuthProvider('apple.com');
    return user.reauthenticateWithCredential(provider.credential({ idToken, rawNonce }));
  };

  // ── Login bar: show Apple, hide the (WebView-incompatible) Google button ──
  const APPLE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:0 0 auto"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.39 2.1 2.94 3.6 2.88 1.44-.06 1.99-.93 3.73-.93s2.24.93 3.77.9c1.56-.03 2.55-1.41 3.5-2.8 1.1-1.61 1.55-3.17 1.58-3.25-.03-.02-3.03-1.16-3.06-4.59zM14.16 4.06c.79-.96 1.33-2.29 1.18-3.62-1.14.05-2.53.76-3.35 1.72-.73.85-1.38 2.21-1.21 3.51 1.28.1 2.58-.65 3.38-1.61z"/></svg>';

  let barObserved = false;
  function ensureAppleButton() {
    const bar = document.getElementById('profileLoginBar');
    if (!bar) return;

    // Re-run the swap the instant the bar's contents change (e.g. renderProfileBar
    // rewrites it on sign-out), so the Apple button appears without waiting for
    // the next interval tick.
    if (!barObserved && typeof MutationObserver === 'function') {
      barObserved = true;
      try { new MutationObserver(ensureAppleButton).observe(bar, { childList: true }); }
      catch (e) { barObserved = false; }
    }

    let signedIn = false;
    try { signedIn = !!JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) {}

    const googleBtn = bar.querySelector('button[onclick*="signInWithGoogle"]');
    if (googleBtn) googleBtn.style.display = 'none';

    const existing = document.getElementById('appleSignInBtn');
    if (signedIn) { if (existing) existing.remove(); return; }
    if (existing) return;
    if (!googleBtn) return; // bar is mid-rebuild; try again next tick

    const btn = document.createElement('button');
    btn.id = 'appleSignInBtn';
    btn.type = 'button';
    btn.className = 'social-login-btn';
    btn.style.cssText = 'background:#000;border-color:#000;color:#fff';
    btn.innerHTML = `${APPLE_ICON_SVG}<span>Sign in with Apple</span>`;
    btn.onclick = () => window.signInWithApple();
    googleBtn.insertAdjacentElement('afterend', btn);
  }

  setInterval(ensureAppleButton, 700);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAppleButton);
  } else {
    ensureAppleButton();
  }
})();
