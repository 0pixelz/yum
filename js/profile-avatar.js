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

  // ── Win-milestone avatars ────────────────────────────────────────────
  // A die face showing a win count, unlocked once the player reaches that many
  // total wins (online + vs-bot). Escalating metal/gem colours mark prestige.
  const MILESTONES = [
    { id:'win25',   num:25,   wins:25,   name:'25 Wins',   top:'#f0d7b8', mid:'#c07a34', bot:'#6e3f14', stroke:'#3a1f08', ink:'#fff3e0', glow:'rgba(192,122,52,0.55)' },
    { id:'win50',   num:50,   wins:50,   name:'50 Wins',   top:'#eef1f6', mid:'#9aa6bd', bot:'#59657e', stroke:'#2c3446', ink:'#ffffff', glow:'rgba(154,166,189,0.55)' },
    { id:'win100',  num:100,  wins:100,  name:'100 Wins',  top:'#ffe7a8', mid:'#f5a623', bot:'#c46b0d', stroke:'#5a2a08', ink:'#3a1a05', glow:'rgba(245,166,35,0.6)'  },
    { id:'win200',  num:200,  wins:200,  name:'200 Wins',  top:'#d7fbff', mid:'#41c7d8', bot:'#186f7c', stroke:'#0a3540', ink:'#04252b', glow:'rgba(65,199,216,0.6)'  },
    { id:'win500',  num:500,  wins:500,  name:'500 Wins',  top:'#f0d6ff', mid:'#a855f7', bot:'#5b1ea3', stroke:'#260a52', ink:'#f6ecff', glow:'rgba(168,85,247,0.6)'  },
    { id:'win1000', num:1000, wins:1000, name:'1000 Wins', top:'#ffd6e0', mid:'#e94560', bot:'#7d1029', stroke:'#3a0612', ink:'#fff0f3', glow:'rgba(233,69,96,0.65)' }
  ];
  const MILE = {};
  MILESTONES.forEach(m => { MILE[m.id] = m; });

  function totalWins() {
    try {
      const s = JSON.parse(localStorage.getItem('yum_stats') || '{}');
      return (Number(s.onlineWins) || 0) + (Number(s.botGameWins) || 0);
    } catch (e) { return 0; }
  }
  function milestoneUnlocked(m) { return !!m && totalWins() >= m.wins; }

  // Small gold padlock that matches the game's dice/gold styling (no emoji).
  function lockSvg() {
    return `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="#ffd76a" stroke-width="2.1" stroke-linecap="round"/>
      <rect x="5.5" y="10" width="13" height="9.5" rx="2.2" fill="#f5a623" stroke="#5a2a08" stroke-width="1"/>
      <circle cx="12" cy="14.4" r="1.5" fill="#5a2a08"/>
      <rect x="11.2" y="14.4" width="1.6" height="3" rx="0.8" fill="#5a2a08"/>
    </svg>`;
  }

  // A die avatar whose face shows a number instead of pips.
  function numberDieSvg(m, sizeAttr) {
    const id = 'avn-' + Math.random().toString(36).slice(2, 9);
    const label = String(m.num);
    const fs = label.length >= 4 ? 19 : label.length === 3 ? 23 : 30;
    return `<svg viewBox="0 0 64 64" ${sizeAttr || ''} aria-hidden="true">
      <defs>
        <radialGradient id="${id}-f" cx="0.32" cy="0.28" r="0.95">
          <stop offset="0%" stop-color="${m.top}"/>
          <stop offset="55%" stop-color="${m.mid}"/>
          <stop offset="100%" stop-color="${m.bot}"/>
        </radialGradient>
        <radialGradient id="${id}-g" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="${m.glow}"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="58" rx="22" ry="3.5" fill="rgba(0,0,0,0.35)"/>
      <circle cx="32" cy="32" r="28" fill="url(#${id}-g)"/>
      <rect x="10" y="8" width="44" height="44" rx="9"
            fill="url(#${id}-f)" stroke="${m.stroke}" stroke-width="1.2"/>
      <text x="32" y="31" text-anchor="middle" dominant-baseline="central"
            font-family="'Bebas Neue','Arial Narrow',sans-serif" font-weight="700"
            font-size="${fs}" letter-spacing="0.5" fill="${m.ink}">${label}</text>
    </svg>`;
  }

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
      if (id && THEMES[id]) return id;
      if (id === 'google') return id;
      // A milestone avatar stays selected only while it's still unlocked (win
      // counts don't drop, but this keeps things safe if stats reset).
      if (id && MILE[id] && milestoneUnlocked(MILE[id])) return id;
    } catch(e) {}
    return DEFAULT_ID;
  }

  function setCurrentId(id) {
    if (id === 'google') { if (!googleProfile()) return; }
    else if (MILE[id]) { if (!milestoneUnlocked(MILE[id])) return; } // locked — ignore
    else if (!THEMES[id]) return;
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

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function googlePhotoMarkup(name) {
    const g = googleProfile();
    if (g && g.photoURL) {
      return `<img src="${_esc(g.photoURL)}" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">`;
    }
    return `<span class="ya-initials">${_esc(initialsFor(name || (g && g.name) || 'Player'))}</span>`;
  }

  // Build the inner HTML of an avatar bubble for a given id + name.
  // The container element is supplied by the caller (so its size/border
  // styling stays consistent with whatever surface it lives on).
  function markup(id, name) {
    if (id === 'google') return googlePhotoMarkup(name);
    if (MILE[id]) return numberDieSvg(MILE[id]);
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
        height: 100dvh; /* dynamic viewport so a tall sheet + its close stays on-screen */
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
        max-height: 88dvh;
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
      .ya-section {
        grid-column: 1 / -1;
        margin: 6px 0 2px;
        font-family: 'Bebas Neue', cursive;
        letter-spacing: 2px;
        font-size: 0.95rem;
        color: var(--gold, #f5a623);
        display: flex; align-items: baseline; gap: 8px;
      }
      .ya-section-note {
        font-family: Nunito, sans-serif; font-weight: 700;
        letter-spacing: 0; font-size: 0.68rem; color: var(--muted, #aab);
      }
      .ya-pick-tile.locked { cursor: default; }
      .ya-pick-tile.locked .ya-pick-art { opacity: 0.4; filter: grayscale(0.55); }
      .ya-pick-tile.locked .ya-pick-name { opacity: 0.5; }
      .ya-pick-lock {
        position: absolute; top: 6px; left: 6px;
        width: 22px; height: 22px; border-radius: 50%;
        background: rgba(20,12,4,0.72);
        border: 1px solid rgba(245,166,35,0.55);
        box-shadow: 0 0 8px rgba(245,166,35,0.25);
        display: inline-flex; align-items: center; justify-content: center;
      }
      .ya-pick-lock svg { display: block; }
      .ya-pick-req {
        margin-top: 2px; font-size: 0.62rem; font-weight: 800;
        letter-spacing: 0.3px; color: var(--gold, #f5a623); opacity: 0.85;
      }
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

    // Win-milestone avatars, with a lock badge + requirement until earned.
    const wins = totalWins();
    const mileTiles = MILESTONES.map(m => {
      const unlocked = wins >= m.wins;
      const sel = current === m.id;
      return `
        <button type="button" class="ya-pick-tile ${sel ? 'selected' : ''} ${unlocked ? '' : 'locked'}"
                data-id="${m.id}" data-locked="${unlocked ? '0' : '1'}" data-req="${m.wins}">
          <span class="ya-pick-check">✓</span>
          ${unlocked ? '' : `<span class="ya-pick-lock">${lockSvg()}</span>`}
          <div class="ya-pick-art">${numberDieSvg(m)}</div>
          <div class="ya-pick-name">${m.name}</div>
          ${unlocked ? '' : `<div class="ya-pick-req">Win ${m.wins}</div>`}
        </button>`;
    }).join('');

    grid.innerHTML = tiles.join('') +
      `<div class="ya-section">WIN MILESTONES <span class="ya-section-note">${wins} win${wins === 1 ? '' : 's'} so far</span></div>` +
      mileTiles;

    grid.querySelectorAll('.ya-pick-tile').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        if (btn.getAttribute('data-locked') === '1') {
          const req = btn.getAttribute('data-req');
          if (window.showToast) showToast(`Reach ${req} wins to unlock this avatar`);
          return;
        }
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
    list: ORDER.map(id => ({ id, name: THEMES[id].name, face: THEMES[id].face }))
      .concat(MILESTONES.map(m => ({ id: m.id, name: m.name, wins: m.wins }))),
    getCurrentId,
    setCurrentId,
    markup,
    markupForProfile,
    openPicker,
    closePicker,
    refreshLobbyAvatar() {},
    totalWins,
    nameOf(id) {
      if (id === 'google') return 'Google photo';
      if (MILE[id]) return MILE[id].name;
      return (THEMES[id] || THEMES[DEFAULT_ID]).name;
    }
  };
})();
