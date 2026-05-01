// ─── PROFILE LOGIN ───────────────────────────────────────────────────
// Adds Google/Gmail sign-in and a local device profile fallback.
// Note: browsers cannot read a device MAC address, so this uses a local random device ID.

(function() {
  const DEVICE_PROFILE_KEY = 'yum_device_profile';
  const GOOGLE_PROFILE_KEY = 'yum_google_profile';

  function injectProfileLoginStyles() {
    if (document.getElementById('profileLoginStyles')) return;
    const style = document.createElement('style');
    style.id = 'profileLoginStyles';
    style.textContent = `
      .gmail-login-btn {
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.08);
        color: var(--white);
        border-radius: 999px;
        padding: 8px 12px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: .6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .gmail-logo-mini {
        width: 22px;
        height: 16px;
        border-radius: 3px;
        background: #fff;
        position: relative;
        display: inline-block;
        box-shadow: inset 0 0 0 1px rgba(0,0,0,.08);
        flex: 0 0 auto;
      }
      .gmail-logo-mini::before {
        content: '';
        position: absolute;
        inset: 3px 3px 2px 3px;
        border-left: 4px solid #EA4335;
        border-right: 4px solid #4285F4;
        border-top: 4px solid #EA4335;
        transform: skewY(-34deg);
      }
      .gmail-logo-mini::after {
        content: '';
        position: absolute;
        left: 3px;
        right: 3px;
        bottom: 2px;
        height: 4px;
        background: linear-gradient(90deg, #34A853 0 25%, transparent 25% 75%, #FBBC04 75% 100%);
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

  function applyProfileToLobby(profile) {
    const input = document.getElementById('playerName');
    if (input && profile && profile.name && (!input.value || input.value.trim().length < 2)) {
      input.value = profile.name.slice(0, 16);
    }
    renderProfileBar();
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
    const label = google ? `✅ ${google.name || google.email}` : `📱 Device profile: ${device.name}`;

    bar.innerHTML = `
      <div style="width:100%;text-align:center;color:var(--muted);font-size:.72rem;font-weight:800;margin-bottom:2px">${label}</div>
      <button type="button" onclick="signInWithGoogle()" class="gmail-login-btn"><span class="gmail-logo-mini" aria-hidden="true"></span><span>Continue with Gmail</span></button>
      <button type="button" onclick="useDeviceProfile()" style="border:1px solid rgba(78,205,196,.25);background:rgba(78,205,196,.1);color:var(--green);border-radius:999px;padding:8px 12px;font-family:Nunito,sans-serif;font-weight:900;letter-spacing:.6px">📱 Use this device</button>
      ${google ? '<button type="button" onclick="signOutProfile()" style="border:1px solid rgba(233,69,96,.25);background:rgba(233,69,96,.08);color:var(--accent);border-radius:999px;padding:8px 12px;font-family:Nunito,sans-serif;font-weight:900;letter-spacing:.6px">Sign out</button>' : ''}
    `;
  }

  async function ensureFirebaseAuth() {
    if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    if (!window.firebase) throw new Error('Firebase SDK not loaded');
    if (!firebase.auth) {
      await loadScriptOnce('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js', 'firebaseAuthSdk');
    }
    return firebase.auth();
  }

  window.signInWithGoogle = async function signInWithGoogle() {
    try {
      const auth = await ensureFirebaseAuth();
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      let result;
      try {
        result = await auth.signInWithPopup(provider);
      } catch(popupErr) {
        await auth.signInWithRedirect(provider);
        return;
      }

      const user = result.user;
      if (!user) return;
      const profile = {
        type: 'google',
        uid: user.uid,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Player'),
        email: user.email || '',
        photoURL: user.photoURL || '',
        signedInAt: Date.now()
      };
      saveJSON(GOOGLE_PROFILE_KEY, profile);
      applyProfileToLobby(profile);
      if (window.showToast) showToast('Signed in with Gmail ✅');
    } catch(e) {
      console.warn('Google sign-in failed:', e);
      if (window.showToast) showToast('Google sign-in failed');
    }
  };

  window.useDeviceProfile = function useDeviceProfile() {
    localStorage.removeItem(GOOGLE_PROFILE_KEY);
    const profile = getDeviceProfile();
    applyProfileToLobby(profile);
    if (window.showToast) showToast('Using this device profile 📱');
  };

  window.signOutProfile = async function signOutProfile() {
    try {
      if (window.firebase && firebase.auth) await firebase.auth().signOut();
    } catch(e) {}
    localStorage.removeItem(GOOGLE_PROFILE_KEY);
    applyProfileToLobby(getDeviceProfile());
    if (window.showToast) showToast('Signed out');
  };

  window.getYumProfile = getCurrentProfile;

  async function finishRedirectSignIn() {
    try {
      const auth = await ensureFirebaseAuth();
      const result = await auth.getRedirectResult();
      if (result && result.user) {
        const user = result.user;
        const profile = {
          type: 'google',
          uid: user.uid,
          name: user.displayName || (user.email ? user.email.split('@')[0] : 'Player'),
          email: user.email || '',
          photoURL: user.photoURL || '',
          signedInAt: Date.now()
        };
        saveJSON(GOOGLE_PROFILE_KEY, profile);
        applyProfileToLobby(profile);
      }
    } catch(e) {}
  }

  function initProfileLogin() {
    injectProfileLoginStyles();
    const profile = getCurrentProfile();
    applyProfileToLobby(profile);
    finishRedirectSignIn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileLogin);
  } else {
    initProfileLogin();
  }
})();
