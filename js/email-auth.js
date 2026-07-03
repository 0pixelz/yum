// ─── EMAIL / PASSWORD SIGN-IN ────────────────────────────────────────────────
// Firebase email+password authentication (per the firebase-auth-basics skill),
// wired into the app's existing profile system. Works on every platform —
// web, PWA, and inside the native apps (no popups, no WebView restrictions).
//
// Registration hardening:
//   • Create Account asks for a confirm-password + a small human check.
//   • New accounts must click the emailed VERIFICATION LINK before they can
//     sign in: after registration (and after any sign-in attempt with an
//     unverified email) the session is signed out immediately, so unverified
//     accounts are unusable and bot registrations are worthless.
//   • Server-side bot protection comes from Firebase App Check (reCAPTCHA v3,
//     already active in firebase-init.js) — enforce it for Authentication in
//     the Firebase console once the native apps also attest.
//
// The signed-in profile is stored under the same localStorage key and shape
// every consumer gates on (yum_google_profile with type:'google' — a legacy
// field name; provider:'password' marks the real origin).
(function () {
  'use strict';

  const PROFILE_KEY = 'yum_google_profile';

  // continueUrl for verification / reset emails: Firebase's action page shows
  // a "Continue" back to the game when it's done. (The action URL itself is
  // console-managed — Google rejects callbackUri changes via API.)
  const ACTION_SETTINGS = { url: 'https://yamio.io/' };

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

  // ── Human check (light client-side deterrent; App Check is the real wall) ──
  let captchaAnswer = null;
  function newCaptcha() {
    const a = 2 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    captchaAnswer = a + b;
    const label = document.getElementById('eaCaptchaLabel');
    if (label) label.textContent = `Human check: what is ${a} + ${b}?`;
    const input = document.getElementById('eaCaptcha');
    if (input) input.value = '';
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
      .ea-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
      .ea-tab {
        flex: 1; border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.05);
        color: var(--muted); border-radius: 999px; padding: 8px; cursor: pointer;
        font-family: 'Nunito', sans-serif; font-weight: 900; font-size: 0.78rem; letter-spacing: 0.5px;
      }
      .ea-tab.active { background: rgba(245,166,35,0.14); color: var(--gold); border-color: rgba(245,166,35,0.5); }
      .ea-input {
        width: 100%; box-sizing: border-box; margin-bottom: 10px;
        background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.16);
        border-radius: 12px; padding: 12px 14px; color: var(--white);
        font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 0.95rem;
      }
      .ea-input:focus { outline: none; border-color: var(--gold); }
      .ea-captcha-label {
        font-size: 0.78rem; font-weight: 800; color: var(--muted); margin: 2px 0 6px;
      }
      .ea-btn {
        width: 100%; border: none; border-radius: 999px; padding: 12px;
        font-family: 'Nunito', sans-serif; font-weight: 900; letter-spacing: 0.6px;
        cursor: pointer; margin-top: 4px;
      }
      .ea-btn-primary { background: linear-gradient(135deg, var(--green), #2ecc71); color: #111; }
      .ea-links {
        display: flex; justify-content: space-between; margin-top: 12px;
        font-size: 0.76rem; font-weight: 800;
      }
      .ea-links a { color: var(--muted); cursor: pointer; text-decoration: underline; }
      .ea-info {
        background: rgba(78,205,196,0.10); border: 1px solid rgba(78,205,196,0.35);
        color: var(--green); border-radius: 12px; padding: 10px 12px;
        font-size: 0.78rem; font-weight: 800; margin-bottom: 10px; display: none;
      }
      .ea-info.show { display: block; }
      .ea-busy { opacity: 0.6; pointer-events: none; }
      .ea-signup-only { display: none; }
      .ea-box[data-mode="signup"] .ea-signup-only { display: block; }
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
      <div class="ea-box" data-mode="signin">
        <div class="ea-title"><i class="icn icn-key"></i> EMAIL ACCOUNT</div>
        <div class="ea-tabs">
          <button class="ea-tab active" id="eaTabIn">SIGN IN</button>
          <button class="ea-tab" id="eaTabUp">CREATE ACCOUNT</button>
        </div>
        <div class="ea-info" id="eaInfo"></div>
        <input class="ea-input" id="eaEmail" type="email" placeholder="Email" autocomplete="email" autocapitalize="none">
        <input class="ea-input" id="eaPassword" type="password" placeholder="Password" autocomplete="current-password">
        <div class="ea-signup-only">
          <input class="ea-input" id="eaPassword2" type="password" placeholder="Confirm password" autocomplete="new-password">
          <div class="ea-captcha-label" id="eaCaptchaLabel"></div>
          <input class="ea-input" id="eaCaptcha" type="number" inputmode="numeric" placeholder="Answer">
        </div>
        <button class="ea-btn ea-btn-primary" id="eaSubmit">SIGN IN</button>
        <div class="ea-links">
          <a id="eaForgot">Forgot password?</a>
          <a id="eaClose">Close</a>
        </div>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#eaTabIn').onclick = () => setMode('signin');
    ov.querySelector('#eaTabUp').onclick = () => setMode('signup');
    ov.querySelector('#eaSubmit').onclick = () => submit();
    ov.querySelector('#eaForgot').onclick = resetPassword;
    ov.querySelector('#eaClose').onclick = closeModal;
    return ov;
  }

  let mode = 'signin';
  function setMode(m) {
    mode = m;
    const box = document.querySelector('#emailAuthOverlay .ea-box');
    if (!box) return;
    box.setAttribute('data-mode', m);
    document.getElementById('eaTabIn')?.classList.toggle('active', m === 'signin');
    document.getElementById('eaTabUp')?.classList.toggle('active', m === 'signup');
    const submitBtn = document.getElementById('eaSubmit');
    if (submitBtn) submitBtn.textContent = m === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN';
    const pw = document.getElementById('eaPassword');
    if (pw) pw.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    if (m === 'signup') newCaptcha();
    showInfo('');
  }

  function showInfo(text) {
    const el = document.getElementById('eaInfo');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('show', !!text);
  }

  function openModal() {
    ensureModal().classList.add('open');
    setMode('signin');
    setTimeout(() => document.getElementById('eaEmail')?.focus(), 150);
  }
  function closeModal() {
    document.getElementById('emailAuthOverlay')?.classList.remove('open');
  }
  window.openEmailSignIn = openModal;

  let busy = false;
  async function submit() {
    if (busy) return;
    const email = (document.getElementById('eaEmail')?.value || '').trim();
    const password = document.getElementById('eaPassword')?.value || '';
    if (!email) { if (window.showToast) showToast('Enter your email'); return; }
    if (!password) { if (window.showToast) showToast('Enter a password'); return; }

    if (mode === 'signup') {
      const password2 = document.getElementById('eaPassword2')?.value || '';
      if (password !== password2) {
        if (window.showToast) showToast('Passwords don\'t match');
        return;
      }
      const answer = parseInt(document.getElementById('eaCaptcha')?.value, 10);
      if (answer !== captchaAnswer) {
        if (window.showToast) showToast('Human check failed — try the new question');
        newCaptcha();
        return;
      }
    }

    busy = true;
    const box = document.querySelector('#emailAuthOverlay .ea-box');
    if (box) box.classList.add('ea-busy');
    try {
      const auth = await getAuth();

      if (mode === 'signup') {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        // Verification gate: send the link and immediately sign out — the
        // account exists but is unusable until the emailed link is clicked.
        try { await cred.user.sendEmailVerification(ACTION_SETTINGS); } catch (e) {}
        await auth.signOut();
        setMode('signin');
        showInfo(`Almost there! We emailed a confirmation link to ${email}. Click it, then sign in here.`);
        if (window.showToast) showToast('Confirmation email sent — check your inbox');
        return;
      }

      // Sign in
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const user = cred && cred.user;
      if (!user) throw new Error('No user returned');

      if (!user.emailVerified) {
        // Re-send the link (best effort — may be rate limited) and refuse the
        // session until the address is confirmed.
        try { await user.sendEmailVerification(ACTION_SETTINGS); } catch (e) {}
        await auth.signOut();
        showInfo(`Your email isn't confirmed yet. We re-sent the link to ${email} — click it, then sign in.`);
        if (window.showToast) showToast('Please confirm your email first');
        return;
      }

      saveProfile(user);
      closeModal();
      if (window.showToast) showToast('Signed in!');
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
      await auth.sendPasswordResetEmail(email, ACTION_SETTINGS);
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
      || document.getElementById('appleWebSignInBtn')
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
