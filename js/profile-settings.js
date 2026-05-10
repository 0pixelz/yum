// ─── PROFILE SETTINGS ────────────────────────────────────────────────
// Replaces the standalone "Delete account" button with a single "Profile
// Settings" button. Opens a sheet showing the user's avatar plus rows
// for sound, dice skin, achievements, match history, and (for Google
// users) account deletion.

(function() {
  const GOOGLE_PROFILE_KEY = 'yum_google_profile';
  const DEVICE_PROFILE_KEY = 'yum_device_profile';

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function googleProfile() { return readJSON(GOOGLE_PROFILE_KEY, null); }
  function deviceProfile() { return readJSON(DEVICE_PROFILE_KEY, null); }
  function isGoogleSignedIn() { const p = googleProfile(); return !!(p && p.uid); }

  function injectStyles() {
    if (document.getElementById('profileSettingsStyles')) return;
    const style = document.createElement('style');
    style.id = 'profileSettingsStyles';
    style.textContent = `
      .profile-settings-btn {
        border: 1px solid rgba(78,205,196,.45);
        background: rgba(78,205,196,.13);
        color: #9be7e0;
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
      .profile-settings-btn:hover { background: rgba(78,205,196,.22); }

      #profileSettingsOverlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.72);
        z-index: 9998;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      #profileSettingsOverlay.show { display: flex; }
      .ps-sheet {
        background: var(--card, #1a1a3e);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 18px;
        padding: 20px;
        max-width: 460px;
        width: 100%;
        max-height: 88vh;
        overflow-y: auto;
        color: var(--white, #fff);
        font-family: Nunito, sans-serif;
        box-shadow: 0 22px 70px rgba(0,0,0,0.55);
      }
      .ps-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      .ps-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.5rem;
        letter-spacing: 2.5px;
        color: var(--gold, #f5a623);
      }
      .ps-close {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        color: var(--white, #fff);
        border-radius: 999px;
        width: 34px; height: 34px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .ps-identity {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        margin-bottom: 16px;
      }
      .ps-avatar {
        width: 64px; height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f5a623, #e94560);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: 'Bebas Neue', cursive;
        font-size: 1.7rem;
        color: #fff;
        letter-spacing: 1px;
        overflow: hidden;
        flex: 0 0 auto;
        border: 2px solid rgba(255,255,255,0.18);
      }
      .ps-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .ps-name { font-weight: 900; font-size: 1.05rem; }
      .ps-sub { color: var(--muted, #aab); font-size: .78rem; margin-top: 2px; word-break: break-all; }

      .ps-row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 8px;
        color: var(--white, #fff);
        font-family: Nunito, sans-serif;
        font-weight: 800;
        font-size: .92rem;
        cursor: pointer;
        text-align: left;
      }
      .ps-row:hover { background: rgba(255,255,255,0.09); }
      .ps-row-icon {
        width: 34px; height: 34px;
        border-radius: 10px;
        background: rgba(245,166,35,0.16);
        color: var(--gold, #f5a623);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
      }
      .ps-row-label { flex: 1; }
      .ps-row-value {
        font-weight: 800;
        font-size: .8rem;
        color: var(--muted, #aab);
      }
      .ps-row-chev { color: var(--muted, #aab); }

      .ps-row.ps-danger {
        background: rgba(233, 69, 96, 0.12);
        border-color: rgba(233, 69, 96, 0.35);
        color: #ff6b85;
      }
      .ps-row.ps-danger .ps-row-icon {
        background: rgba(233, 69, 96, 0.22);
        color: #ff6b85;
      }
      .ps-row.ps-danger:hover { background: rgba(233, 69, 96, 0.2); }

      .ps-section-label {
        font-family: 'Bebas Neue', cursive;
        font-size: .8rem;
        letter-spacing: 2px;
        color: var(--muted, #aab);
        margin: 12px 4px 6px;
      }
    `;
    document.head.appendChild(style);
  }

  function getAvatarMarkup() {
    const g = googleProfile();
    if (g && g.photoURL) {
      return `<img src="${g.photoURL}" alt="" referrerpolicy="no-referrer">`;
    }
    const name = (g && g.name) || (deviceProfile() && deviceProfile().name) || 'Player';
    const initials = String(name).trim().split(/\s+/).map(s => s[0]).join('').slice(0, 2).toUpperCase() || 'P';
    return initials;
  }

  function getDisplayName() {
    const g = googleProfile();
    if (g) return g.name || g.email || 'Player';
    const d = deviceProfile();
    return d ? d.name : 'Player';
  }

  function getSubLabel() {
    const g = googleProfile();
    if (g) return g.email || 'Signed in with Google';
    return 'Device profile';
  }

  function soundIsOn() {
    try { return localStorage.getItem('yumSound') !== 'off'; } catch(e) { return true; }
  }

  function activeSkinName() {
    try {
      const id = localStorage.getItem('yum_active_dice_skin') || 'classic';
      return id.charAt(0).toUpperCase() + id.slice(1);
    } catch(e) { return 'Classic'; }
  }

  function ensureLobbyVisibleForOverlay(openFn) {
    // openSkinStore / openSession / openAchievements all render into overlays
    // that sit above the lobby. Closing the settings sheet first keeps the
    // z-index clean and lets the user back out into the lobby naturally.
    closeSettings();
    setTimeout(() => { try { openFn(); } catch(e) { console.warn(e); } }, 60);
  }

  function buildOverlay() {
    if (document.getElementById('profileSettingsOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'profileSettingsOverlay';
    ov.innerHTML = `
      <div class="ps-sheet" role="dialog" aria-modal="true" aria-labelledby="psTitle">
        <div class="ps-header">
          <div class="ps-title" id="psTitle">PROFILE SETTINGS</div>
          <button type="button" class="ps-close" id="psClose" aria-label="Close">
            <i class="icn icn-close"></i>
          </button>
        </div>

        <div class="ps-identity">
          <div class="ps-avatar" id="psAvatar"></div>
          <div style="min-width:0;flex:1">
            <div class="ps-name" id="psName"></div>
            <div class="ps-sub" id="psSub"></div>
          </div>
        </div>

        <div class="ps-section-label">PREFERENCES</div>

        <button type="button" class="ps-row" id="psSoundRow">
          <span class="ps-row-icon"><i class="icn icn-sound-on" id="psSoundIcon"></i></span>
          <span class="ps-row-label">Sound</span>
          <span class="ps-row-value" id="psSoundValue">On</span>
        </button>

        <button type="button" class="ps-row" id="psSkinRow">
          <span class="ps-row-icon"><i class="icn icn-dice"></i></span>
          <span class="ps-row-label">Dice skin</span>
          <span class="ps-row-value" id="psSkinValue">Classic</span>
          <span class="ps-row-chev">›</span>
        </button>

        <div class="ps-section-label">PROGRESS</div>

        <button type="button" class="ps-row" id="psAchRow">
          <span class="ps-row-icon"><i class="icn icn-trophy"></i></span>
          <span class="ps-row-label">Achievements</span>
          <span class="ps-row-chev">›</span>
        </button>

        <button type="button" class="ps-row" id="psHistoryRow">
          <span class="ps-row-icon"><i class="icn icn-clipboard"></i></span>
          <span class="ps-row-label">Match history</span>
          <span class="ps-row-chev">›</span>
        </button>

        <div id="psAccountSection" style="display:none">
          <div class="ps-section-label">ACCOUNT</div>
          <button type="button" class="ps-row ps-danger" id="psDeleteRow">
            <span class="ps-row-icon"><i class="icn icn-close"></i></span>
            <span class="ps-row-label">Delete account</span>
            <span class="ps-row-chev">›</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    ov.addEventListener('click', e => {
      if (e.target === ov) closeSettings();
    });
    document.getElementById('psClose').addEventListener('click', closeSettings);

    document.getElementById('psSoundRow').addEventListener('click', () => {
      if (typeof window.toggleSound === 'function') window.toggleSound();
      refreshSettings();
    });

    document.getElementById('psSkinRow').addEventListener('click', () => {
      if (typeof window.openSkinStore === 'function') {
        ensureLobbyVisibleForOverlay(window.openSkinStore);
      } else if (window.showToast) {
        showToast('Dice skins unavailable');
      }
    });

    document.getElementById('psAchRow').addEventListener('click', () => {
      if (typeof window.openAchievements === 'function') {
        ensureLobbyVisibleForOverlay(window.openAchievements);
      }
    });

    document.getElementById('psHistoryRow').addEventListener('click', () => {
      if (typeof window.openSession === 'function') {
        ensureLobbyVisibleForOverlay(window.openSession);
      }
    });

    document.getElementById('psDeleteRow').addEventListener('click', () => {
      closeSettings();
      setTimeout(() => {
        if (typeof window.confirmDeleteYumAccount === 'function') window.confirmDeleteYumAccount();
      }, 60);
    });
  }

  function refreshSettings() {
    const ov = document.getElementById('profileSettingsOverlay');
    if (!ov) return;

    const avatar = document.getElementById('psAvatar');
    if (avatar) avatar.innerHTML = getAvatarMarkup();

    const name = document.getElementById('psName');
    if (name) name.textContent = getDisplayName();

    const sub = document.getElementById('psSub');
    if (sub) sub.textContent = getSubLabel();

    const on = soundIsOn();
    const sIcon = document.getElementById('psSoundIcon');
    const sVal = document.getElementById('psSoundValue');
    if (sIcon) sIcon.className = on ? 'icn icn-sound-on' : 'icn icn-sound-off';
    if (sVal) sVal.textContent = on ? 'On' : 'Off';

    const skinVal = document.getElementById('psSkinValue');
    if (skinVal) skinVal.textContent = activeSkinName();

    const acct = document.getElementById('psAccountSection');
    if (acct) acct.style.display = isGoogleSignedIn() ? '' : 'none';
  }

  function openSettings() {
    injectStyles();
    buildOverlay();
    refreshSettings();
    const ov = document.getElementById('profileSettingsOverlay');
    if (ov) ov.classList.add('show');
  }

  function closeSettings() {
    const ov = document.getElementById('profileSettingsOverlay');
    if (ov) ov.classList.remove('show');
  }

  window.openYumProfileSettings = openSettings;
  window.closeYumProfileSettings = closeSettings;

  function ensureSettingsButton() {
    injectStyles();
    const bar = document.getElementById('profileLoginBar');
    if (!bar) return;

    if (bar.querySelector('.profile-settings-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile-settings-btn';
    btn.title = 'Profile settings';
    btn.innerHTML = '<i class="icn icn-tap"></i><span>Profile settings</span>';
    btn.addEventListener('click', openSettings);
    bar.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureSettingsButton);
  } else {
    ensureSettingsButton();
  }

  // The profile bar is re-rendered on auth state changes and by a watchdog
  // in profile-login.js, so re-attach the button on the same cadence.
  setInterval(ensureSettingsButton, 700);
})();
