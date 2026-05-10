// ─── DELETE ACCOUNT ──────────────────────────────────────────────────
// Adds a "Delete Account" button next to the Sign Out button when the
// user is signed in with Google. Wipes the user's Firebase Realtime
// Database record at /users/$uid, deletes the Firebase Auth user, and
// clears local game data.

(function() {
  const GOOGLE_PROFILE_KEY = 'yum_google_profile';

  function injectStyles() {
    if (document.getElementById('deleteAccountStyles')) return;
    const style = document.createElement('style');
    style.id = 'deleteAccountStyles';
    style.textContent = `
      .delete-account-btn {
        border: 1px solid rgba(233, 69, 96, 0.55);
        background: rgba(233, 69, 96, 0.18);
        color: #ff6b85;
        border-radius: 999px;
        padding: 8px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: .6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .delete-account-btn:hover { background: rgba(233, 69, 96, 0.28); }

      #deleteAccountModal {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        z-index: 9999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      #deleteAccountModal.show { display: flex; }
      .da-box {
        background: var(--card, #1a1a3e);
        border: 1px solid rgba(233, 69, 96, 0.4);
        border-radius: 16px;
        padding: 22px;
        max-width: 420px;
        width: 100%;
        color: var(--white, #fff);
        font-family: Nunito, sans-serif;
        box-shadow: 0 18px 60px rgba(0,0,0,0.5);
      }
      .da-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.5rem;
        letter-spacing: 2px;
        color: #ff6b85;
        margin-bottom: 8px;
      }
      .da-msg { font-size: .95rem; line-height: 1.45; margin-bottom: 14px; color: var(--white, #fff); }
      .da-list { font-size: .85rem; color: var(--muted, #aab); margin: 0 0 16px 18px; padding: 0; }
      .da-list li { margin: 3px 0; }
      .da-btns { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
      .da-btn {
        border-radius: 999px;
        padding: 9px 18px;
        font-weight: 900;
        font-family: Nunito, sans-serif;
        cursor: pointer;
        border: 1px solid transparent;
      }
      .da-btn-cancel {
        background: rgba(255,255,255,0.08);
        color: var(--white, #fff);
        border-color: rgba(255,255,255,0.16);
      }
      .da-btn-confirm {
        background: linear-gradient(135deg, #e94560, #c0392b);
        color: #fff;
      }
      .da-btn[disabled] { opacity: 0.6; cursor: progress; }
    `;
    document.head.appendChild(style);
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function isGoogleSignedIn() {
    const profile = readJSON(GOOGLE_PROFILE_KEY, null);
    return !!(profile && profile.uid);
  }

  function clearLocalGameData() {
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /^yum/i.test(k)) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch(e) {}
  }

  async function reauthWithGoogle(user) {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    return user.reauthenticateWithPopup(provider);
  }

  async function performDelete() {
    if (!window.firebase || !firebase.auth) throw new Error('Firebase not loaded');
    if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();

    const auth = firebase.auth();
    let user = auth.currentUser;
    if (!user || user.isAnonymous) {
      throw new Error('Not signed in with Google');
    }

    const uid = user.uid;

    // Delete the user's profile, credits, skins, achievements, stats etc.
    if (window.db && window.db.ref) {
      try {
        await window.db.ref('users/' + uid).remove();
      } catch(e) {
        console.warn('Failed to remove /users/' + uid, e);
        throw new Error('Could not remove your data: ' + ((e && e.code) || e.message || e));
      }
    }

    // Delete the Firebase Auth account itself. Google requires a recent
    // login for this; if the session is old, re-authenticate via popup.
    try {
      await user.delete();
    } catch(e) {
      const code = e && e.code;
      if (code === 'auth/requires-recent-login') {
        await reauthWithGoogle(user);
        user = auth.currentUser;
        await user.delete();
      } else {
        throw e;
      }
    }
  }

  function buildModal() {
    if (document.getElementById('deleteAccountModal')) return;
    const modal = document.createElement('div');
    modal.id = 'deleteAccountModal';
    modal.innerHTML = `
      <div class="da-box" role="dialog" aria-modal="true" aria-labelledby="daTitle">
        <div class="da-title" id="daTitle">Delete account?</div>
        <div class="da-msg">This permanently removes your Yamio account and all data tied to it. This cannot be undone.</div>
        <ul class="da-list">
          <li>Your Google sign-in for Yamio</li>
          <li>Credits, skins, achievements and stats</li>
          <li>Daily challenge progress and streaks</li>
          <li>This device's saved profile</li>
        </ul>
        <div class="da-btns">
          <button type="button" class="da-btn da-btn-cancel" id="daCancel">Cancel</button>
          <button type="button" class="da-btn da-btn-confirm" id="daConfirm">Delete account</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal();
    });
    document.getElementById('daCancel').addEventListener('click', closeModal);
    document.getElementById('daConfirm').addEventListener('click', onConfirm);
  }

  function openModal() {
    buildModal();
    const modal = document.getElementById('deleteAccountModal');
    const confirm = document.getElementById('daConfirm');
    const cancel = document.getElementById('daCancel');
    if (confirm) { confirm.disabled = false; confirm.textContent = 'Delete account'; }
    if (cancel) cancel.disabled = false;
    modal.classList.add('show');
  }

  function closeModal() {
    const modal = document.getElementById('deleteAccountModal');
    if (modal) modal.classList.remove('show');
  }

  async function onConfirm() {
    const confirmBtn = document.getElementById('daConfirm');
    const cancelBtn = document.getElementById('daCancel');
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = 'Deleting…'; }
    if (cancelBtn) cancelBtn.disabled = true;

    try {
      await performDelete();
      clearLocalGameData();
      closeModal();
      if (window.showToast) showToast('Account deleted');
      setTimeout(() => location.reload(), 600);
    } catch(e) {
      console.warn('Delete account failed:', e);
      const code = (e && (e.code || e.message)) || 'unknown error';
      if (window.showToast) showToast('Delete failed: ' + code);
      else alert('Delete failed: ' + code);
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = 'Delete account'; }
      if (cancelBtn) cancelBtn.disabled = false;
    }
  }

  window.confirmDeleteYumAccount = openModal;
  window.isYumGoogleSignedIn = isGoogleSignedIn;

  // Strip any legacy standalone delete-account button left over in the
  // profile bar; the action lives inside the Profile Settings sheet now.
  function removeLegacyButton() {
    const bar = document.getElementById('profileLoginBar');
    if (!bar) return;
    const existing = bar.querySelector('.delete-account-btn');
    if (existing) existing.remove();
  }

  injectStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLegacyButton);
  } else {
    removeLegacyButton();
  }
  setInterval(removeLegacyButton, 1500);
})();
