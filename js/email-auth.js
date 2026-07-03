// ─── EMAIL / PASSWORD SIGN-IN ────────────────────────────────────────────────
// Firebase email+password authentication (per the firebase-auth-basics skill),
// wired into the app's existing profile system. Unlike the OAuth providers it
// works EVERYWHERE — web, PWA, and inside the native apps (no popups, no
// WebView restrictions) — so it's also the account option for platforms where
// Google's popup can't run.
//
// The signed-in profile is stored under the same localStorage key and shape
// every consumer gates on (yum_google_profile with type:'google' — a legacy
// field name; provider:'password' marks the real origin).
(function () {
  'use strict';

  const PROFILE_KEY = 'yum_google_profile';

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

  // Human-readable messages for the auth error codes players actually hit.
  function friendly(code) {
    switch (code) {
      case 'auth/invalid-email':          return 'That email address doesn\'t look right';
      case 'auth/missing-password':       return 'Enter a password';
      case 'auth/weak-password':          return 'Password too weak — use at least 6 characters';
      case 'auth/email-already-in-use':   return 'An account with this email already exists — try Sign In';
      case 'auth/user-not-found':         return 'No account with this email — try Create Account';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':     return 'Wrong email or password';
      case 'auth/too-many-requests':      return 'Too many attempts — wait a minute and try again';
      case 'auth/network-request-failed': return 'Network error — check your connection';
      case 'auth/operation-not-allowed':  return 'Email sign-in isn\'t enabled yet';
      default: return 'Sign-in failed: ' + (code || 'unknown error');
    }
  }

  function saveProfile(user) {
    const email = user.email || '';
    const name = user.displayName || (email ? email.split('@')[0] : 'Player');
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({
        type: 'google',          // legacy gate value used app-wide for "signed in"
        provider: 'password',
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

  // ── Modal ──────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('emailAuthStyles')) return;
    const s = document.createElement('style');
    s.id = 'emailAuthStyles';
    s.textContent = `
      #emailAuthOverlay {
        position: fixed; inset: 0; z-index: 1200; display: none;
        align-items: center; justify-content: center; background: rgba(0,0,0,0.7);
        padding: 20px;
      }
      #emailAuthOverlay.open { display: flex; }
      .ea-box {
        width: min(360px, 92vw); background: var(--panel); border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.14); padding: 20px 18px;
        box-shadow: 0 18px 60px rgba(0,0,0,0.5);
      }
      .ea-title {
        font-family: 'Bebas Neue', cursive; letter-spacing: 2.5px; font-size: 1.3rem;
        color: var(--gold); margin-bottom: 12px; text-align: center;
      }
      .ea-input {
        width: 100%; box-sizing: border-box; margin-bottom: 10px;
        background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.16);
        border-radius: 12px; padding: 12px 14px; color: var(--white);
        font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 0.95rem;
      }
      .ea-input:focus { outline: none; border-color: var(--gold); }
      .ea-btn {
        width: 100%; border: none; border-radius: 999px; padding: 12px;
        font-family: 'Nunito', sans-serif; font-weight: 900; letter-spacing: 0.6px;
        cursor: pointer; margin-top: 4px;
      }
      .ea-btn-primary { background: linear-gradient(135deg, var(--green), #2ecc71); color: #111; }
      .ea-btn-secondary {
        background: rgba(255,255,255,0.08); color: var(--white);
        border: 1px solid rgba(255,255,255,0.16); margin-top: 8px;
      }
      .ea-links {
        display: flex; justify-content: space-between; margin-top: 12px;
        font-size: 0.76rem; font-weight: 800;
      }
      .ea-links a { color: var(--muted); cursor: pointer; text-decoration: underline; }
      .ea-busy { opacity: 0.6; pointer-events: none; }
    `;
    document.head.appendChild(s);
  }

  function ensureModal() {
    let ov = document.getElementById('emailAuthOverlay');
    if (ov) return ov;
    injectStyles();
    ov = document.createElement('div');
    ov.id = 'emailAuthOverlay';
    ov.onclick = e => { if (e.target === ov) closeModal(); };
    ov.innerHTML = `
      <div class="ea-box">
        <div class="ea-title"><i class="icn icn-key"></i> SIGN IN WITH EMAIL</div>
        <input class="ea-input" id="eaEmail" type="email" placeholder="Email" autocomplete="email" autocapitalize="none">
        <input class="ea-input" id="eaPassword" type="password" placeholder="Password" autocomplete="current-password">
        <button class="ea-btn ea-btn-primary" id="eaSignIn">SIGN IN</button>
        <button class="ea-btn ea-btn-secondary" id="eaSignUp">CREATE ACCOUNT</button>
        <div class="ea-links">
          <a id="eaForgot">Forgot password?</a>
          <a id="eaClose">Close</a>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#eaSignIn').onclick = () => submit('signin');
    ov.querySelector('#eaSignUp').onclick = () => submit('signup');
    ov.querySelector('#eaForgot').onclick = resetPassword;
    ov.querySelector('#eaClose').onclick = closeModal;
    return ov;
  }

  function openModal() {
    ensureModal().classList.add('open');
    setTimeout(() => document.getElementById('eaEmail')?.focus(), 150);
  }
  function closeModal() {
    document.getElementById('emailAuthOverlay')?.classList.remove('open');
  }
  window.openEmailSignIn = openModal;

  let busy = false;
  async function submit(mode) {
    if (busy) return;
    const email = (document.getElementById('eaEmail')?.value || '').trim();
    const password = document.getElementById('eaPassword')?.value || '';
    if (!email) { if (window.showToast) showToast('Enter your email'); return; }
    if (!password) { if (window.showToast) showToast('Enter a password'); return; }

    busy = true;
    const box = document.querySelector('#emailAuthOverlay .ea-box');
    if (box) box.classList.add('ea-busy');
    try {
      const auth = await getAuth();
      const cred = mode === 'signup'
        ? await auth.createUserWithEmailAndPassword(email, password)
        : await auth.signInWithEmailAndPassword(email, password);
      if (!cred || !cred.user) throw new Error('No user returned');
      saveProfile(cred.user);
      closeModal();
      if (window.showToast) showToast(mode === 'signup' ? 'Account created — signed in!' : 'Signed in!');
    } catch (err) {
      console.warn('Email auth failed:', err);
      if (window.showToast) showToast(friendly(err && err.code));
    } finally {
      busy = false;
      if (box) box.classList.remove('ea-busy');
    }
  }

  async function resetPassword() {
    const email = (document.getElementById('eaEmail')?.value || '').trim();
    if (!email) { if (window.showToast) showToast('Enter your email first, then tap Forgot password'); return; }
    try {
      const auth = await getAuth();
      await auth.sendPasswordResetEmail(email);
      if (window.showToast) showToast('Password reset email sent — check your inbox');
    } catch (err) {
      if (window.showToast) showToast(friendly(err && err.code));
    }
  }

  // Re-authentication for sensitive actions (account deletion).
  window.yamioEmailReauth = async function yamioEmailReauth(user) {
    const password = window.prompt('Confirm your password to continue:');
    if (!password) throw new Error('cancelled');
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    return user.reauthenticateWithCredential(credential);
  };

  // ── Lobby button (all platforms) ───────────────────────────────────────────
  function ensureEmailButton() {
    const bar = document.getElementById('profileLoginBar');
    if (!bar) return;

    let signedIn = false;
    try { signedIn = !!JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) {}

    const existing = document.getElementById('emailSignInBtn');
    if (signedIn) { if (existing) existing.remove(); return; }
    if (existing) return;

    // Anchor on whichever provider button the platform shows.
    const anchor = document.getElementById('appleSignInBtn')
      || bar.querySelector('button[onclick*="signInWithGoogle"]');
    if (!anchor) return; // bar mid-rebuild; retry next tick

    const btn = document.createElement('button');
    btn.id = 'emailSignInBtn';
    btn.type = 'button';
    btn.className = 'social-login-btn';
    btn.innerHTML = '<i class="icn icn-key"></i><span>Sign in with email</span>';
    btn.onclick = openModal;
    anchor.insertAdjacentElement('afterend', btn);
  }

  setInterval(ensureEmailButton, 700);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureEmailButton);
  } else {
    ensureEmailButton();
  }
})();
