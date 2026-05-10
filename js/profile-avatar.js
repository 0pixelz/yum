// ─── PROFILE AVATAR ──────────────────────────────────────────────────
// Dice-themed avatar set the player can choose from in profile settings.
// The selected avatar id is mirrored into the player's room slot so
// opponents see it in the lobby, matchmaking screen, and in-game viewer.
//
// Public surface (all on window.YumAvatars):
//   list                 — array of {id, name, face, theme}
//   getCurrentId()       — current avatar id (defaults to 'classic')
//   setCurrentId(id)     — persist choice + sync to room + dispatch event
//   markup(id, name)     — HTML for an avatar bubble (uses initials fallback)
//   markupForProfile()   — HTML for the active local profile (handles
//                          'google' photo + initials fallbacks)
//   openPicker()         — opens the avatar selection sheet
//
// A 'yum-avatar-changed' CustomEvent fires whenever the choice changes so
// other UI (lobby card, matchmaking card) can re-render immediately.

(function() {
  'use strict';

  const STORAGE_KEY = 'yum_avatar_id';
  const DEFAULT_ID  = 'classic';
  const GOOGLE_PROFILE_KEY = 'yum_google_profile';
  const DEVICE_PROFILE_KEY = 'yum_device_profile';

  // Each theme defines the die face gradient + pip color. Faces use the
  // classic 1-6 pip layouts so the avatars read as dice at a glance.
  const THEMES = {
    classic:  { name: 'Classic Gold',  face: 6, top: '#ffe7a8', mid: '#f5a623', bot: '#c46b0d', stroke: '#5a2a08', pip: '#3a1a05', glow: 'rgba(245,166,35,0.55)' },
    ruby:     { name: 'Ruby',          face: 1, top: '#ffd2dc', mid: '#e94560', bot: '#7d1029', stroke: '#3a0612', pip: '#2a0410', glow: 'rgba(233,69,96,0.55)' },
    sapphire: { name: 'Sapphire',      face: 2, top: '#cfe4ff', mid: '#3b82f6', bot: '#143982', stroke: '#0a1d44', pip: '#0a1330', glow: 'rgba(59,130,246,0.55)' },
    emerald:  { name: 'Emerald',       face: 3, top: '#c5f5ec', mid: '#4ecdc4', bot: '#0f6c66', stroke: '#06302d', pip: '#04201d', glow: 'rgba(78,205,196,0.55)' },
    amethyst: { name: 'Amethyst',      face: 4, top: '#e2d2ff', mid: '#a855f7', bot: '#5b1ea3', stroke: '#260a52', pip: '#1a0738', glow: 'rgba(168,85,247,0.55)' },
    onyx:     { name: 'Onyx',          face: 5, top: '#7a7a92', mid: '#2c2c4a', bot: '#0e0e1d', stroke: '#000010', pip: '#f5a623', glow: 'rgba(255,255,255,0.18)' },
    pearl:    { name: 'Pearl',         face: 6, top: '#ffffff', mid: '#dfe6f0', bot: '#9aa6bd', stroke: '#4a566c', pip: '#3a4458', glow: 'rgba(220,228,240,0.45)' },
    lava:     { name: 'Lava',          face: 6, top: '#ffd66b', mid: '#ff5722', bot: '#7a1500', stroke: '#3a0a00', pip: '#2a0500', glow: 'rgba(255,87,34,0.6)' },
    ice:      { name: 'Ice',           face: 5, top: '#e6faff', mid: '#5bd0ff', bot: '#1a6a96', stroke: '#0a3552', pip: '#0a2540', glow: 'rgba(91,208,255,0.55)' },
    galaxy:   { name: 'Galaxy',        face: 6, top: '#7a4ad8', mid: '#2d0a6e', bot: '#08001f', stroke: '#03000d', pip: '#fff0a8', glow: 'rgba(122,74,216,0.55)' }
  };

  const ORDER = ['classic','ruby','sapphire','emerald','amethyst','onyx','pearl','lava','ice','galaxy'];

  // Pip layouts on a 64x64 die (rect from x=10..54, y=8..52).
  const PIPS = {
    1: [[32,30]],
    2: [[20,18],[44,42]],
    3: [[20,18],[32,30],[44,42]],
    4: [[20,18],[44,18],[20,42],[44,42]],
    5: [[20,18],[44,18],[32,30],[20,42],[44,42]],
    6: [[20,18],[44,18],[20,30],[44,30],[20,42],[44,42]]
  };

  function dieSvg(theme, sizeAttr) {
    const id = 'av-' + Math.random().toString(36).slice(2, 9);
    const pips = PIPS[theme.face] || PIPS[6];
    const pipMarkup = pips.map(([cx,cy]) =>
      `<circle cx="${cx}" cy="${cy}" r="3.1" fill="${theme.pip}"/>`
    ).join('');
    return `<svg viewBox="0 0 64 64" ${sizeAttr || ''} aria-hidden="true">
      <defs>
        <radialGradient id="${id}-face" cx="0.32" cy="0.28" r="0.95">
          <stop offset="0%" stop-color="${theme.top}"/>
          <stop offset="55%" stop-color="${theme.mid}"/>
          <stop offset="100%" stop-color="${theme.bot}"/>
        </radialGradient>
        <radialGradient id="${id}-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="${theme.glow}"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="22" ry="3.5" fill="rgba(0,0,0,0.35)"/>
      <circle cx="32" cy="32" r="28" fill="url(#${id}-glow)"/>
      <rect x="10" y="8" width="44" height="44" rx="9"
            fill="url(#${id}-face)"
            stroke="${theme.stroke}" stroke-width="1.2"/>
      ${pipMarkup}
    </svg>`;
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function googleProfile() { return loadJSON(GOOGLE_PROFILE_KEY, null); }
  function deviceProfile() { return loadJSON(DEVICE_PROFILE_KEY, null); }

  function getCurrentId() {
    try {
      const id = localStorage.getItem(STORAGE_KEY);
      if (id && (THEMES[id] || id === 'google')) return id;
    } catch(e) {}
    return DEFAULT_ID;
  }

  function setCurrentId(id) {
    if (id !== 'google' && !THEMES[id]) return;
    if (id === 'google' && !googleProfile()) return;
    try { localStorage.setItem(STORAGE_KEY, id); } catch(e) {}
    publishToRoom(id);
    document.dispatchEvent(new CustomEvent('yum-avatar-changed', { detail: { id } }));
  }

  function initialsFor(name) {
    const s = String(name || '').trim();
    if (!s) return 'P';
    const parts = s.split(/\s+/);
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  function googlePhotoMarkup(name) {
    const g = googleProfile();
    if (g && g.photoURL) {
      return `<img src="${g.photoURL}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">`;
    }
    return `<span class="ya-initials">${initialsFor(name || (g && g.name) || 'Player')}</span>`;
  }

  // Build the inner HTML of an avatar bubble for a given id + name.
  // The container element is supplied by the caller (so its size/border
  // styling stays consistent with whatever surface it lives on).
  function markup(id, name) {
    if (id === 'google') return googlePhotoMarkup(name);
    const theme = THEMES[id] || THEMES[DEFAULT_ID];
    return dieSvg(theme);
  }

  // Markup for the local user's current avatar choice.
  function markupForProfile() {
    return markup(getCurrentId(), googleProfile()?.name || deviceProfile()?.name);
  }

  // Try to publish the avatar onto the player's room slot if we're in one.
  // Best-effort only — if the room write fails (e.g. not yet joined), the
  // value will be set on the next createGame/joinGame call instead.
  function publishToRoom(id) {
    try {
      if (typeof window.roomRef !== 'undefined' && window.roomRef
          && typeof window.playerId !== 'undefined' && window.playerId) {
        window.roomRef.child('players/' + window.playerId + '/avatar').set(id);
      }
    } catch(e) {}
  }

  function injectStyles() {
    if (document.getElementById('yumAvatarStyles')) return;
    const style = document.createElement('style');
    style.id = 'yumAvatarStyles';
    style.textContent = `
      .ya-initials {
        font-family: 'Bebas Neue', cursive;
        letter-spacing: 1px;
      }
      /* Make embedded avatar SVGs always fill the bubble cleanly */
      .ya-host svg, .lar-avatar svg, .wup-avatar svg, .mm-card-avatar svg.ya-svg,
      .ps-avatar svg, .opp-avatar svg, .ya-pick-tile svg {
        width: 100%; height: 100%; display: block; border-radius: inherit;
      }

      #yumAvatarPickerOverlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.78);
        z-index: 10000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      #yumAvatarPickerOverlay.show { display: flex; }
      .ya-sheet {
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
      .ya-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 14px;
      }
      .ya-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.5rem;
        letter-spacing: 2.5px;
        color: var(--gold, #f5a623);
      }
      .ya-close {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        color: var(--white, #fff);
        border-radius: 999px;
        width: 34px; height: 34px;
        cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center;
      }
      .ya-sub {
        color: var(--muted, #aab);
        font-size: .82rem;
        margin-bottom: 14px;
      }
      .ya-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
        gap: 10px;
      }
      .ya-pick-tile {
        position: relative;
        background: rgba(255,255,255,0.05);
        border: 1.5px solid rgba(255,255,255,0.1);
        border-radius: 14px;
        padding: 10px 8px 8px;
        cursor: pointer;
        text-align: center;
        font-family: Nunito, sans-serif;
        color: var(--white, #fff);
      }
      .ya-pick-tile:hover { background: rgba(255,255,255,0.09); }
      .ya-pick-tile.selected {
        border-color: var(--gold, #f5a623);
        background: rgba(245,166,35,0.12);
        box-shadow: 0 0 0 2px rgba(245,166,35,0.25) inset;
      }
      .ya-pick-tile .ya-pick-art {
        width: 60px; height: 60px;
        margin: 0 auto 6px;
        border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
      }
      .ya-pick-tile.google .ya-pick-art {
        background: rgba(255,255,255,0.07);
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.12);
      }
      .ya-pick-tile.google .ya-pick-art img {
        width: 100%; height: 100%; object-fit: cover; display: block;
      }
      .ya-pick-name {
        font-weight: 900;
        font-size: .74rem;
        letter-spacing: .4px;
        color: var(--white, #fff);
        opacity: .9;
      }
      .ya-pick-tile.selected .ya-pick-name { color: var(--gold, #f5a623); opacity: 1; }
      .ya-pick-check {
        position: absolute;
        top: 6px; right: 6px;
        width: 18px; height: 18px;
        border-radius: 50%;
        background: var(--gold, #f5a623);
        color: #1a1a3e;
        font-size: .7rem;
        font-weight: 900;
        display: none;
        align-items: center;
        justify-content: center;
      }
      .ya-pick-tile.selected .ya-pick-check { display: inline-flex; }
    `;
    document.head.appendChild(style);
  }

  function buildPicker() {
    if (document.getElementById('yumAvatarPickerOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'yumAvatarPickerOverlay';
    ov.innerHTML = `
      <div class="ya-sheet" role="dialog" aria-modal="true" aria-labelledby="yaTitle">
        <div class="ya-header">
          <div class="ya-title" id="yaTitle">CHOOSE AVATAR</div>
          <button type="button" class="ya-close" id="yaClose" aria-label="Close">
            <i class="icn icn-close"></i>
          </button>
        </div>
        <div class="ya-sub">Pick a die to represent you in lobby, matchmaking, and during games.</div>
        <div class="ya-grid" id="yaGrid"></div>
      </div>
    `;
    document.body.appendChild(ov);

    ov.addEventListener('click', e => {
      if (e.target === ov) closePicker();
    });
    ov.querySelector('#yaClose').addEventListener('click', closePicker);
  }

  function renderPickerGrid() {
    const grid = document.getElementById('yaGrid');
    if (!grid) return;
    const current = getCurrentId();
    const tiles = [];

    const g = googleProfile();
    if (g && g.photoURL) {
      tiles.push(`
        <button type="button" class="ya-pick-tile google ${current === 'google' ? 'selected' : ''}" data-id="google">
          <span class="ya-pick-check">✓</span>
          <div class="ya-pick-art"><img src="${g.photoURL}" alt="" referrerpolicy="no-referrer"></div>
          <div class="ya-pick-name">Google photo</div>
        </button>
      `);
    }

    ORDER.forEach(id => {
      const theme = THEMES[id];
      tiles.push(`
        <button type="button" class="ya-pick-tile ${current === id ? 'selected' : ''}" data-id="${id}">
          <span class="ya-pick-check">✓</span>
          <div class="ya-pick-art">${dieSvg(theme)}</div>
          <div class="ya-pick-name">${theme.name}</div>
        </button>
      `);
    });

    grid.innerHTML = tiles.join('');
    grid.querySelectorAll('.ya-pick-tile').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        setCurrentId(id);
        renderPickerGrid();
        if (window.showToast) showToast('Avatar updated');
        setTimeout(closePicker, 220);
      });
    });
  }

  function openPicker() {
    injectStyles();
    buildPicker();
    renderPickerGrid();
    const ov = document.getElementById('yumAvatarPickerOverlay');
    if (ov) ov.classList.add('show');
  }

  function closePicker() {
    const ov = document.getElementById('yumAvatarPickerOverlay');
    if (ov) ov.classList.remove('show');
  }

  // Expose API + auto-inject styles so consumers (settings sheet, lobby
  // card, matchmaking card) can call markup() without a separate setup.
  injectStyles();

  window.YumAvatars = {
    list: ORDER.map(id => ({ id, name: THEMES[id].name, face: THEMES[id].face })),
    getCurrentId,
    setCurrentId,
    markup,
    markupForProfile,
    openPicker,
    closePicker,
    nameOf(id) {
      if (id === 'google') return 'Google photo';
      return (THEMES[id] || THEMES[DEFAULT_ID]).name;
    }
  };
})();
