// ─── PROFILE LOGIN ───────────────────────────────────────────────────
// Adds Google sign-in and a local device profile fallback.
// Note: browsers cannot read a device MAC address, so this uses a local random device ID.

(function() {
  const DEVICE_PROFILE_KEY = 'yum_device_profile';
  const GOOGLE_PROFILE_KEY = 'yum_google_profile';

  const GOOGLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style="flex:0 0 auto"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

  const APPLE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="flex:0 0 auto"><path d="M17.05 12.54c-.03-2.89 2.36-4.27 2.47-4.34-1.35-1.97-3.44-2.24-4.18-2.27-1.78-.18-3.47 1.05-4.37 1.05-.9 0-2.29-1.02-3.77-1-1.94.03-3.72 1.13-4.72 2.86-2.01 3.49-.51 8.66 1.45 11.49.96 1.39 2.1 2.94 3.6 2.88 1.44-.06 1.99-.93 3.73-.93s2.24.93 3.77.9c1.56-.03 2.55-1.41 3.5-2.8 1.1-1.61 1.55-3.17 1.58-3.25-.03-.02-3.03-1.16-3.06-4.59zM14.16 4.06c.79-.96 1.33-2.29 1.18-3.62-1.14.05-2.53.76-3.35 1.72-.73.85-1.38 2.21-1.21 3.51 1.28.1 2.58-.65 3.38-1.61z"/></svg>`;

  // The signed-in chip shows the icon of the provider actually used —
  // profiles record it in `provider` ('apple.com', 'password', or absent
  // for the original Google flow).
  function providerIcon(profile) {
    if (profile && profile.provider === 'apple.com') return APPLE_ICON_SVG;
    if (profile && profile.provider === 'password') return '<i class="icn icn-key"></i>';
    return GOOGLE_ICON_SVG;
  }

  function injectProfileLoginStyles() {
    if (document.getElementById('profileLoginStyles')) return;
    const style = document.createElement('style');
    style.id = 'profileLoginStyles';
    style.textContent = `
      .social-login-btn {
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.08);
        color: var(--white);
        border-radius: 999px;
        padding: 8px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: .6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

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

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getDeviceProfile() {
    let profile = loadJSON(DEVICE_PROFILE_KEY, null);
    if (!profile) {
      const id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      profile = {
        type: 'device',
        id,
        name: 'Player ' + id.slice(-4).toUpperCase(),
        createdAt: Date.now()
      };
      saveJSON(DEVICE_PROFILE_KEY, profile);
    }
    return profile;
  }

  function getCurrentProfile() {
    return loadJSON(GOOGLE_PROFILE_KEY, null) || getDeviceProfile();
  }

  function prefillPlayerNameIfEmpty() {
    const input = document.getElementById('playerName');
    if (!input || input.value.trim()) return;
    let saved = '';
    try { saved = localStorage.getItem('yum_last_username') || ''; } catch(e) {}
    if (!saved) {
      const google = loadJSON(GOOGLE_PROFILE_KEY, null);
      if (google && google.name) saved = String(google.name);
    }
    if (!saved) return;
    const max = parseInt(input.getAttribute('maxlength'), 10) || 16;
    input.value = saved.slice(0, max);
  }

  function applyProfileToLobby(profile) {
    renderProfileBar();
    if (window.YumAvatars && typeof window.YumAvatars.refreshLobbyAvatar === 'function') {
      window.YumAvatars.refreshLobbyAvatar();
    }
    prefillPlayerNameIfEmpty();
  }

  function renderProfileBar() {
    injectProfileLoginStyles();
    const input = document.getElementById('playerName');
    if (!input) return;

    let bar = document.getElementById('profileLoginBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'profileLoginBar';
      bar.style.cssText = 'width:100%;max-width:520px;margin:-4px 0 12px;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap';
      input.insertAdjacentElement('afterend', bar);
    }

    const google = loadJSON(GOOGLE_PROFILE_KEY, null);
    const device = getDeviceProfile();

    if (google) {
      bar.innerHTML = `
        <div style="display:inline-flex;align-items:center;gap:8px;color:var(--white);font-size:.85rem;font-weight:800;padding:6px 12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);border-radius:999px">
          ${providerIcon(google)}<span>${google.name || google.email}</span>
        </div>
        <button type="button" onclick="signOutProfile()" style="border:1px solid rgba(233,69,96,.25);background:rgba(233,69,96,.08);color:var(--accent);border-radius:999px;padding:8px 14px;font-family:Nunito,sans-serif;font-weight:900;letter-spacing:.6px;cursor:pointer">Sign out</button>
      `;
    } else {
      bar.innerHTML = `
        <div style="width:100%;text-align:center;color:var(--muted);font-size:.72rem;font-weight:800;margin-bottom:2px"><i class="icn icn-tap"></i> Device profile: ${device.name}</div>
        <button type="button" onclick="signInWithGoogle()" class="social-login-btn">${GOOGLE_ICON_SVG}<span>Continue with Google</span></button>
      `;
    }
  }

  async function getAuthInstance() {
    if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    if (!window.firebase) throw new Error('Firebase SDK not loaded');
    if (!firebase.auth) {
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js', 'firebaseAuthSdk');
    }
    return firebase.auth();
  }

  function buildGoogleProfile(user) {
    return {
      type: 'google',
      uid: user.uid,
      name: user.displayName || (user.email ? user.email.split('@')[0] : 'Player'),
      email: user.email || '',
      photoURL: user.photoURL || '',
      signedInAt: Date.now()
    };
  }

  function failToast(e) {
    const code = (e && (e.code || e.name)) || 'unknown';
    console.warn('Google sign-in failed:', code, e);
    if (window.showToast) showToast('Google sign-in failed: ' + code);
  }

  window.signInWithGoogle = async function signInWithGoogle() {
    // Resolve the auth instance synchronously so the click's user-activation
    // is still "alive" when signInWithPopup() opens its window. Any await
    // before the popup (loading the SDK, signing out) breaks the gesture chain
    // and iOS Safari blocks the popup — which previously dropped us into the
    // broken signInWithRedirect path (the "missing initial state" full-page
    // error). The auth SDK is already loaded at startup by firebase-init.js,
    // so getAuthInstance() only ever needs its async branch in edge cases.
    let auth;
    try {
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
      if (!window.firebase) throw new Error('Firebase SDK not loaded');
      auth = firebase.auth ? firebase.auth() : await getAuthInstance();
    } catch(e) {
      failToast(e);
      return;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    // Use popup only. We deliberately do NOT sign out the eager anonymous user
    // first (that extra await would break the gesture) — signInWithPopup swaps
    // the current user for the Google account on its own. We also deliberately
    // do NOT fall back to signInWithRedirect: in storage-partitioned browsers
    // (iOS Safari, Chrome 115+ installed PWAs) the redirect handler can't read
    // the sessionStorage state it saved, so it renders "Unable to process
    // request due to missing initial state" instead of completing sign-in.
    try {
      const result = await auth.signInWithPopup(provider);
      const user = result && result.user;
      if (!user) return;
      saveJSON(GOOGLE_PROFILE_KEY, buildGoogleProfile(user));
      applyProfileToLobby();
      if (typeof window.yumRefreshMenuButtons === 'function') window.yumRefreshMenuButtons();
      if (window.showToast) showToast('Signed in with Google');
    } catch(popupErr) {
      const popupCode = (popupErr && popupErr.code) || '';
      // Quietly ignore the user simply dismissing the popup.
      if (popupCode === 'auth/popup-closed-by-user'
        || popupCode === 'auth/cancelled-popup-request') return;
      failToast(popupErr);
    }
  };

  window.useDeviceProfile = function useDeviceProfile() {
    localStorage.removeItem(GOOGLE_PROFILE_KEY);
    const profile = getDeviceProfile();
    applyProfileToLobby(profile);
    if (window.showToast) showToast('Using this device profile');
  };

  window.signOutProfile = async function signOutProfile() {
    try {
      if (window.firebase && firebase.auth) await firebase.auth().signOut();
    } catch(e) {}
    localStorage.removeItem(GOOGLE_PROFILE_KEY);
    applyProfileToLobby(getDeviceProfile());
    if (typeof window.yumRefreshMenuButtons === 'function') window.yumRefreshMenuButtons();
    if (window.showToast) showToast('Signed out');
  };

  window.getYumProfile = getCurrentProfile;

  function captureGoogleUser(user, opts) {
    if (!user || user.isAnonymous) return false;
    // Skip the anonymous-side of providerData; we only want real Google users.
    const isGoogle = (user.providerData || []).some(p => p && p.providerId === 'google.com');
    if (!isGoogle) return false;
    const existing = loadJSON(GOOGLE_PROFILE_KEY, null);
    if (existing && existing.uid === user.uid) return false;
    saveJSON(GOOGLE_PROFILE_KEY, buildGoogleProfile(user));
    applyProfileToLobby();
    if (typeof window.yumRefreshMenuButtons === 'function') window.yumRefreshMenuButtons();
    if (opts && opts.toast && window.showToast) showToast('Signed in with Google');
    return true;
  }

  // We no longer call signInWithRedirect (popup only), but a returning user may
  // still land here with a leftover/broken redirect from an older session. Read
  // and clear it without surfacing the storage-partitioned "missing initial
  // state" error to the user — popup sign-in is the supported path now.
  async function finishRedirectSignIn() {
    try {
      const auth = await getAuthInstance();
      const result = await auth.getRedirectResult();
      if (result && result.user) {
        captureGoogleUser(result.user, { toast: true });
      }
    } catch(e) {
      console.warn('Ignoring stale Google redirect result:', e && e.code, e);
    }
  }

  // Storage partitioning in installed PWAs can break getRedirectResult, but the
  // Firebase auth state itself is usually still restored on the app origin
  // after the redirect lands. Watching onAuthStateChanged catches the Google
  // user in that case so the profile bar updates without needing a reload.
  async function watchAuthForGoogleUser() {
    try {
      const auth = await getAuthInstance();
      auth.onAuthStateChanged(u => {
        if (u && !u.isAnonymous) captureGoogleUser(u, { toast: true });
      });
    } catch(e) {}
  }

  function initProfileLogin() {
    injectProfileLoginStyles();
    const profile = getCurrentProfile();
    applyProfileToLobby(profile);
    finishRedirectSignIn();
    watchAuthForGoogleUser();

    // When the user returns from Chrome Custom Tabs in an installed PWA, the
    // page typically isn't reloaded, so re-check both the redirect result and
    // the current auth user every time the tab becomes visible again.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      finishRedirectSignIn();
      try {
        const u = window.firebase && firebase.auth && firebase.auth().currentUser;
        if (u && !u.isAnonymous) captureGoogleUser(u, { toast: true });
      } catch(e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileLogin);
  } else {
    initProfileLogin();
  }

  // Watchdog: re-render the social login bar if anything strips it from the DOM,
  // or if profile-login.js ran before the lobby input was present.
  setInterval(() => {
    const input = document.getElementById('playerName');
    if (!input) return;
    const bar = document.getElementById('profileLoginBar');
    const signedIn = !!loadJSON(GOOGLE_PROFILE_KEY, null);
    const expectedSelector = signedIn
      ? 'button[onclick*="signOutProfile"]'
      : 'button[onclick*="signInWithGoogle"]';
    const hasExpectedBtn = bar && bar.querySelector(expectedSelector);
    if (!bar || !hasExpectedBtn) {
      renderProfileBar();
    }
  }, 700);
})();

// ─── SHARE LOBBY / DIRECT JOIN LINK ──────────────────────────────────
// Adds a native Share Lobby button and supports opening ?room=CODE links.

(function() {
  function injectShareStyles() {
    if (document.getElementById('shareLobbyStyles')) return;
    const style = document.createElement('style');
    style.id = 'shareLobbyStyles';
    style.textContent = `
      .share-lobby-btn {
        border: 1px solid rgba(245,166,35,.45);
        background: rgba(245,166,35,.13);
        color: var(--gold);
        border-radius: 999px;
        padding: 10px 16px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: .8px;
        box-shadow: 0 8px 28px rgba(245,166,35,.12);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        cursor: pointer;
      }
      .share-lobby-btn.full {
        width: min(280px, 88vw);
        margin: 8px auto 2px;
      }
      .share-link-hint {
        color: var(--muted);
        font-size: .72rem;
        font-weight: 800;
        text-align: center;
        margin-top: 5px;
      }
      .direct-join-pill {
        width: min(420px, 90vw);
        margin: 8px auto 12px;
        padding: 9px 12px;
        border-radius: 999px;
        border: 1px solid rgba(78,205,196,.28);
        background: rgba(78,205,196,.10);
        color: var(--green);
        font-size: .76rem;
        font-weight: 900;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  function currentRoomCode() {
    try {
      if (typeof roomCode !== 'undefined' && roomCode) return String(roomCode).toUpperCase();
    } catch(e) {}
    try {
      if (typeof currentRoomCode !== 'undefined' && currentRoomCode) return String(currentRoomCode).toUpperCase();
    } catch(e) {}
    const display = document.getElementById('displayCode');
    if (display && display.textContent && !display.textContent.includes('-')) return display.textContent.trim().toUpperCase();
    const badge = document.getElementById('mpCodeBadge');
    if (badge && badge.textContent && !badge.textContent.includes('-')) return badge.textContent.trim().toUpperCase();
    const join = document.getElementById('joinCode');
    if (join && join.value) return join.value.trim().toUpperCase();
    return '';
  }

  function shareUrlForRoom(code) {
    const cleanCode = String(code || '').trim().toUpperCase();
    const base = location.origin + location.pathname.replace(/index\.html$/i, '');
    return `${base}?room=${encodeURIComponent(cleanCode)}`;
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch(e) {}
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch(e) {}
    ta.remove();
    return ok;
  }

  window.shareLobby = async function shareLobby() {
    const code = currentRoomCode();
    if (!code) {
      if (window.showToast) showToast('Create a multiplayer room first');
      return;
    }

    const url = shareUrlForRoom(code);
    const text = `Join my Yamio game lobby. Room code: ${code}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Join my Yamio lobby', text, url });
        return;
      }
    } catch(e) {
      // User cancelled native share sheet; do nothing.
      return;
    }

    const copied = await copyText(`${text}\n${url}`);
    if (window.showToast) showToast(copied ? 'Lobby link copied' : url);
    else alert(copied ? 'Lobby link copied!' : url);
  };

  function directRoomFromUrl() {
    const params = new URLSearchParams(location.search);
    return (params.get('room') || params.get('join') || params.get('code') || '').trim().toUpperCase();
  }

  function prepareDirectJoin() {
    const code = directRoomFromUrl();
    if (!code) return;

    const join = document.getElementById('joinCode');
    if (join) join.value = code;

    const lobby = document.getElementById('lobbyOverlay');
    if (lobby && !document.getElementById('directJoinPill')) {
      const pill = document.createElement('div');
      pill.id = 'directJoinPill';
      pill.className = 'direct-join-pill';
      pill.textContent = `Room ${code} ready — tap JOIN GAME`;
      const roomWrap = document.querySelector('.room-code-input-wrap');
      if (roomWrap) roomWrap.insertAdjacentElement('beforebegin', pill);
      else lobby.insertAdjacentElement('afterbegin', pill);
    }

    // If the profile already filled a player name, join automatically after scripts finish.
    setTimeout(() => {
      const name = document.getElementById('playerName');
      const stillInLobby = document.getElementById('lobbyOverlay')?.style.display !== 'none';
      if (name && name.value.trim().length >= 2 && stillInLobby && typeof joinGame === 'function') {
        try { joinGame(); } catch(e) {}
      }
    }, 900);
  }

  function patchRoomCreationToRefreshShare() {
    ['createGame', 'joinGame', 'startGame'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__shareLobbyPatched) return;
      const patched = async function(...args) {
        return original.apply(this, args);
      };
      patched.__shareLobbyPatched = true;
      window[name] = patched;
    });
  }

  function initShareLobby() {
    injectShareStyles();
    prepareDirectJoin();
    patchRoomCreationToRefreshShare();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShareLobby);
  else initShareLobby();

  setInterval(() => {
    patchRoomCreationToRefreshShare();
  }, 1200);
})();
