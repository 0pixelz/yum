// ─── FIRST-LOGIN USERNAME PROMPT ─────────────────────────────────────
// On the first login of a real account (Apple / Google / email) the player
// has no saved username yet, so pop a small screen asking them to choose one.
// The name is saved server-side via the setUsername Cloud Function
// (users/$uid/name), so on every later login it's read back and applied
// silently — no prompt, and the lobby name field is pre-filled for them.
//
// Anonymous/device sessions are skipped (they aren't "logged in").

(function () {
  'use strict';

  const LAST_KEY = 'yum_last_username';
  const MAXLEN = 16;
  let shownThisSession = false;
  let handledUid = null;

  function db() {
    try { if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb(); } catch (e) {}
    return (window.db && window.firebase && window.firebase.database) ? window.db : null;
  }

  function nameInput() { return document.getElementById('playerName'); }

  // Apply a chosen/loaded name to the lobby input (the game reads the name from
  // there at create/join/vs-bot time) and remember it locally.
  function applyName(name) {
    const n = String(name || '').trim().slice(0, MAXLEN);
    if (!n) return;
    const input = nameInput();
    if (input) input.value = n;
    try { localStorage.setItem(LAST_KEY, n); } catch (e) {}
  }

  function suggestedName() {
    const input = nameInput();
    const fromInput = input && input.value ? input.value.trim() : '';
    if (fromInput) return fromInput.slice(0, MAXLEN);
    let last = '';
    try { last = localStorage.getItem(LAST_KEY) || ''; } catch (e) {}
    if (last) return last.slice(0, MAXLEN);
    try {
      const u = window.firebase && firebase.auth && firebase.auth().currentUser;
      if (u) {
        if (u.displayName) return u.displayName.trim().slice(0, MAXLEN);
        if (u.email) return u.email.split('@')[0].slice(0, MAXLEN);
      }
    } catch (e) {}
    return '';
  }

  // ── Styles ─────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('firstLoginNameStyles')) return;
    const s = document.createElement('style');
    s.id = 'firstLoginNameStyles';
    s.textContent = `
      #firstLoginNameOverlay {
        position: fixed; inset: 0; height: 100dvh; z-index: 1600;
        background: rgba(0,0,0,.82); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
        display: none; align-items: flex-start; justify-content: center;
        padding: max(14vh, env(safe-area-inset-top)) 16px 16px;
      }
      #firstLoginNameOverlay.open { display: flex; }
      .fln-card {
        width: min(420px, 94vw);
        background: linear-gradient(135deg, var(--panel, #15153a), #1a1a5e);
        border: 1px solid rgba(78,205,196,.5); border-radius: 22px;
        box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 40px rgba(78,205,196,.14);
        padding: 22px 20px; text-align: center;
      }
      .fln-emoji { font-size: 2.2rem; line-height: 1; }
      .fln-title {
        font-family: 'Bebas Neue', cursive; letter-spacing: 3px;
        font-size: 1.7rem; color: var(--gold, #f5a623); margin-top: 6px;
      }
      .fln-sub { color: var(--muted, #9aa); font-size: .82rem; margin: 6px 0 16px; line-height: 1.35; }
      .fln-input {
        width: 100%; box-sizing: border-box; text-align: center;
        background: rgba(0,0,0,.28); border: 1.5px solid rgba(255,255,255,.16);
        border-radius: 14px; padding: 14px 14px; color: var(--white, #fff);
        font-family: Nunito, sans-serif; font-weight: 900; font-size: 1.15rem; letter-spacing: 1px;
      }
      .fln-input:focus { outline: none; border-color: var(--gold, #f5a623); }
      .fln-err { min-height: 16px; color: #ff6b81; font-size: .74rem; font-weight: 800; margin: 8px 2px 0; }
      .fln-save {
        width: 100%; margin-top: 8px; border: none; cursor: pointer;
        border-radius: 999px; padding: 14px; font-family: 'Bebas Neue', cursive;
        letter-spacing: 2px; font-size: 1.15rem; color: #06231f;
        background: linear-gradient(135deg, #4ecdc4, #2ecc71);
        box-shadow: 0 10px 26px rgba(78,205,196,.28);
      }
      .fln-save:disabled { filter: grayscale(.5) brightness(.8); cursor: default; }
    `;
    document.head.appendChild(s);
  }

  // ── Popup ──────────────────────────────────────────────────────────
  function ensureOverlay() {
    let ov = document.getElementById('firstLoginNameOverlay');
    if (ov) return ov;
    injectStyles();
    ov = document.createElement('div');
    ov.id = 'firstLoginNameOverlay';
    ov.innerHTML =
      '<div class="fln-card">' +
        '<div class="fln-emoji"><i class="icn icn-dice icn-gold"></i></div>' +
        '<div class="fln-title">CHOOSE YOUR USERNAME</div>' +
        '<div class="fln-sub">This is how other players will see you. You can change it later in Settings.</div>' +
        '<input class="fln-input" id="flnInput" type="text" maxlength="' + MAXLEN + '" ' +
          'autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Username">' +
        '<div class="fln-err" id="flnErr"></div>' +
        '<button class="fln-save" id="flnSave">SAVE</button>' +
      '</div>';
    document.body.appendChild(ov);

    const input = ov.querySelector('#flnInput');
    const save = ov.querySelector('#flnSave');
    input.addEventListener('input', () => { ov.querySelector('#flnErr').textContent = ''; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSave(); } });
    save.addEventListener('click', doSave);
    return ov;
  }

  function showError(msg) {
    const el = document.getElementById('flnErr');
    if (el) el.textContent = msg || '';
  }

  async function doSave() {
    const ov = document.getElementById('firstLoginNameOverlay');
    const input = document.getElementById('flnInput');
    const save = document.getElementById('flnSave');
    if (!input) return;
    const name = input.value.trim();
    if (!name) { showError('Enter a username first'); return; }

    // Instant client-side check (mirrors the server filter) for quick feedback.
    if (typeof window.yumValidateUsername === 'function') {
      const check = window.yumValidateUsername(name);
      if (!check.ok) { showError(check.reason || 'Please choose a different username.'); return; }
    }

    if (save) { save.disabled = true; save.textContent = 'SAVING…'; }
    try {
      // Persist server-side (validates + stores users/$uid/name) so it follows
      // the account to every future login and device.
      if (window.YumCloud && typeof window.YumCloud.setUsername === 'function') {
        const res = await window.YumCloud.setUsername({ name });
        const finalName = (res && res.name) ? res.name : name;
        applyName(finalName);
      } else {
        applyName(name);
      }
      if (ov) ov.classList.remove('open');
    } catch (err) {
      const msg = String((err && err.message) || '');
      // Cloud errors arrive wrapped as "cloud/setUsername failed: <reason>".
      const reason = msg.replace(/^cloud\/setUsername failed:\s*/i, '').trim();
      showError(reason || 'Could not save that name — try another.');
    } finally {
      if (save) { save.disabled = false; save.textContent = 'SAVE'; }
    }
  }

  function openPrompt() {
    if (shownThisSession) return;
    shownThisSession = true;
    const ov = ensureOverlay();
    const input = ov.querySelector('#flnInput');
    if (input) input.value = suggestedName();
    showError('');
    ov.classList.add('open');
    setTimeout(() => { try { input && input.focus(); } catch (e) {} }, 120);
  }

  // ── Login handling ─────────────────────────────────────────────────
  function handleUser(user) {
    // Only real account logins — skip anonymous/device sessions and signed-out.
    if (!user || user.isAnonymous) return;
    if (handledUid === user.uid) return;
    handledUid = user.uid;

    const database = db();
    if (!database) { return; }
    database.ref('users/' + user.uid + '/name').once('value')
      .then(snap => {
        const saved = snap.val();
        if (saved && String(saved).trim()) {
          // Returning login — apply the saved name silently, no prompt.
          applyName(saved);
        } else {
          // First login for this account — ask for a username.
          openPrompt();
        }
      })
      .catch(() => { /* offline / read failed — don't nag; they can set it in the lobby */ });
  }

  function init() {
    try {
      if (!window.firebase || !firebase.auth) return;
      firebase.auth().onAuthStateChanged(user => {
        if (!user) { handledUid = null; return; }
        handleUser(user);
      });
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for manual re-trigger / testing.
  window.yumOpenUsernamePrompt = openPrompt;
})();
