// ─── MULTIPLAYER DICE SKIN SYNC ──────────────────────────────────────
// Each player's own skin shows on the dice when it is their turn.
// Skin ID is published to Firebase once on join and on skin change.
// It is NOT republished on every roll/hold to avoid Firebase feedback loops.

(function() {
  const ACTIVE_SKIN_KEY = 'yum_active_dice_skin';
  let _skinPublishedRoomRef = null;

  const SKIN_FACES = {
    classic:  ['⚀','⚁','⚂','⚃','⚄','⚅'],
    gold:     ['①','②','③','④','⑤','⑥'],
    neon:     ['1','2','3','4','5','6'],
    ice:      ['❄1','❄2','❄3','❄4','❄5','❄6'],
    fire:     ['🔥1','🔥2','🔥3','🔥4','🔥5','🔥6'],
    galaxy:   ['✦1','✦2','✦3','✦4','✦5','✦6'],
    red:      ['⚀','⚁','⚂','⚃','⚄','⚅'],
    blue:     ['⚀','⚁','⚂','⚃','⚄','⚅'],
    green:    ['⚀','⚁','⚂','⚃','⚄','⚅'],
    purple:   ['⚀','⚁','⚂','⚃','⚄','⚅'],
    orange:   ['⚀','⚁','⚂','⚃','⚄','⚅'],
    pink:     ['⚀','⚁','⚂','⚃','⚄','⚅'],
    black:    ['⚀','⚁','⚂','⚃','⚄','⚅'],
    teal:     ['⚀','⚁','⚂','⚃','⚄','⚅'],
    candy:    ['⚀','⚁','⚂','⚃','⚄','⚅'],
    ocean:    ['⚀','⚁','⚂','⚃','⚄','⚅'],
    midnight: ['★1','★2','★3','★4','★5','★6'],
    lava:     ['🌋1','🌋2','🌋3','🌋4','🌋5','🌋6'],
    rosegold: ['♥1','♥2','♥3','♥4','♥5','♥6'],
    diamond:  ['💎1','💎2','💎3','💎4','💎5','💎6']
  };

  function activeSkinId() {
    const id = localStorage.getItem(ACTIVE_SKIN_KEY) || 'classic';
    return SKIN_FACES[id] ? id : 'classic';
  }

  function faceFor(value, skinId) {
    const faces = SKIN_FACES[skinId] || SKIN_FACES.classic;
    return value > 0 ? faces[value - 1] : '–';
  }

  function publishMySkin() {
    try {
      if (!roomRef || !playerId) return;
      const skinId = activeSkinId();
      roomRef.child('players/' + playerId + '/skin').set(skinId);
      _skinPublishedRoomRef = roomRef;
    } catch(e) {}
  }

  function publishMyPerDieColors() {
    try {
      if (!roomRef || !playerId) return;
      let colors = null;
      try { colors = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch(e) {}
      roomRef.child('players/' + playerId + '/perDieColors').set(colors || null);
    } catch(e) {}
  }

  // ─── CSS skin classes ────────────────────────────────────────────────

  function injectSkinSyncStyles() {
    if (document.getElementById('skinSyncStyles')) return;
    const style = document.createElement('style');
    style.id = 'skinSyncStyles';
    style.textContent = `
      .remote-skin-dice span,
      .bap-dice span,
      .bap-dice .die,
      .live-dice .die,
      .opp-live-dice .die {
        transition: background .15s, color .15s, box-shadow .15s, border-color .15s;
      }
      .remote-skin-classic { background: var(--white) !important; color:#111 !important; }
      .remote-skin-gold { background:linear-gradient(135deg,#fff7cc,#f5a623) !important; color:#251400 !important; }
      .remote-skin-neon { background:#101827 !important; color:#4ecdc4 !important; border:1px solid rgba(78,205,196,.6) !important; box-shadow:0 0 18px rgba(78,205,196,.25) !important; }
      .remote-skin-ice { background:linear-gradient(135deg,#e0f7ff,#8fd8ff) !important; color:#06283d !important; }
      .remote-skin-fire { background:linear-gradient(135deg,#ffd166,#e94560) !important; color:#180004 !important; }
      .remote-skin-galaxy { background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%) !important; color:#f8fafc !important; border:1px solid rgba(168,85,247,.7) !important; box-shadow:0 0 20px rgba(168,85,247,.28) !important; }
      .remote-skin-red { background:#dc2626 !important; color:#fff !important; }
      .remote-skin-blue { background:#2563eb !important; color:#fff !important; }
      .remote-skin-green { background:#16a34a !important; color:#fff !important; }
      .remote-skin-purple { background:#7c3aed !important; color:#fff !important; }
      .remote-skin-orange { background:#ea580c !important; color:#fff !important; }
      .remote-skin-pink { background:#db2777 !important; color:#fff !important; }
      .remote-skin-black { background:#1c1c1c !important; color:#fff !important; border:1px solid rgba(255,255,255,.15) !important; }
      .remote-skin-teal { background:#0d9488 !important; color:#fff !important; }
      .remote-skin-candy { background:linear-gradient(135deg,#fdf2f8,#fbcfe8,#f9a8d4) !important; color:#be185d !important; }
      .remote-skin-ocean { background:linear-gradient(135deg,#0c4a6e,#0369a1) !important; color:#bae6fd !important; }
      .remote-skin-midnight { background:linear-gradient(135deg,#020617,#1e293b) !important; color:#94a3b8 !important; border:1px solid rgba(148,163,184,.2) !important; }
      .remote-skin-lava { background:linear-gradient(135deg,#0f0000,#7f1d1d) !important; color:#fbbf24 !important; border:1px solid rgba(251,191,36,.4) !important; box-shadow:0 0 18px rgba(239,68,68,.35) !important; }
      .remote-skin-rosegold { background:linear-gradient(135deg,#fce7f3,#f9a8d4,#fda4af) !important; color:#831843 !important; }
      .remote-skin-diamond { background:linear-gradient(135deg,#dbeafe,#e0e7ff,#f3e8ff) !important; color:#312e81 !important; border:1px solid rgba(167,139,250,.7) !important; box-shadow:0 0 20px rgba(167,139,250,.3) !important; }
      /* High-specificity overrides so opponent skin beats body.skin-* rules from skin-store. */
      #diceRow .die.remote-skin-classic:not(.held) { background: var(--white) !important; color:#111 !important; }
      #diceRow .die.remote-skin-gold:not(.held) { background:linear-gradient(135deg,#fff7cc,#f5a623) !important; color:#251400 !important; }
      #diceRow .die.remote-skin-neon:not(.held) { background:#101827 !important; color:#4ecdc4 !important; border:1px solid rgba(78,205,196,.6) !important; box-shadow:0 0 18px rgba(78,205,196,.25) !important; }
      #diceRow .die.remote-skin-ice:not(.held) { background:linear-gradient(135deg,#e0f7ff,#8fd8ff) !important; color:#06283d !important; }
      #diceRow .die.remote-skin-fire:not(.held) { background:linear-gradient(135deg,#ffd166,#e94560) !important; color:#180004 !important; }
      #diceRow .die.remote-skin-galaxy:not(.held) { background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%) !important; color:#f8fafc !important; border:1px solid rgba(168,85,247,.7) !important; box-shadow:0 0 20px rgba(168,85,247,.28) !important; }
      #diceRow .die.remote-skin-red:not(.held) { background:#dc2626 !important; color:#fff !important; }
      #diceRow .die.remote-skin-blue:not(.held) { background:#2563eb !important; color:#fff !important; }
      #diceRow .die.remote-skin-green:not(.held) { background:#16a34a !important; color:#fff !important; }
      #diceRow .die.remote-skin-purple:not(.held) { background:#7c3aed !important; color:#fff !important; }
      #diceRow .die.remote-skin-orange:not(.held) { background:#ea580c !important; color:#fff !important; }
      #diceRow .die.remote-skin-pink:not(.held) { background:#db2777 !important; color:#fff !important; }
      #diceRow .die.remote-skin-black:not(.held) { background:#1c1c1c !important; color:#fff !important; border:1px solid rgba(255,255,255,.15) !important; }
      #diceRow .die.remote-skin-teal:not(.held) { background:#0d9488 !important; color:#fff !important; }
      #diceRow .die.remote-skin-candy:not(.held) { background:linear-gradient(135deg,#fdf2f8,#fbcfe8,#f9a8d4) !important; color:#be185d !important; }
      #diceRow .die.remote-skin-ocean:not(.held) { background:linear-gradient(135deg,#0c4a6e,#0369a1) !important; color:#bae6fd !important; }
      #diceRow .die.remote-skin-midnight:not(.held) { background:linear-gradient(135deg,#020617,#1e293b) !important; color:#94a3b8 !important; border:1px solid rgba(148,163,184,.2) !important; }
      #diceRow .die.remote-skin-lava:not(.held) { background:linear-gradient(135deg,#0f0000,#7f1d1d) !important; color:#fbbf24 !important; border:1px solid rgba(251,191,36,.4) !important; box-shadow:0 0 18px rgba(239,68,68,.35) !important; }
      #diceRow .die.remote-skin-rosegold:not(.held) { background:linear-gradient(135deg,#fce7f3,#f9a8d4,#fda4af) !important; color:#831843 !important; }
      #diceRow .die.remote-skin-diamond:not(.held) { background:linear-gradient(135deg,#dbeafe,#e0e7ff,#f3e8ff) !important; color:#312e81 !important; border:1px solid rgba(167,139,250,.7) !important; box-shadow:0 0 20px rgba(167,139,250,.3) !important; }
      .skin-mini-badge {
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-left:6px;
        padding:2px 7px;
        border-radius:999px;
        font-size:.62rem;
        font-weight:900;
        letter-spacing:.5px;
        background:rgba(245,166,35,.13);
        border:1px solid rgba(245,166,35,.3);
        color:var(--gold);
        vertical-align:middle;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Remote skin CSS applied to #diceRow ────────────────────────────

  // Tracks the skin class currently stamped on #diceRow dice so we avoid
  // removing + re-adding the same class on every Firebase event (which
  // would produce a one-frame flash as the element briefly has no class).
  let _appliedRemoteSkin = null;

  function applyRemoteSkin(skinId) {
    const safe = SKIN_FACES[skinId] ? skinId : 'classic';
    if (_appliedRemoteSkin === safe) return;
    _appliedRemoteSkin = safe;
    const row = document.getElementById('diceRow');
    if (!row) return;
    row.querySelectorAll('.die').forEach(el => {
      Object.keys(SKIN_FACES).forEach(id => el.classList.remove('remote-skin-' + id));
      el.classList.add('remote-skin-' + safe);
    });
  }

  function clearRemoteSkin() {
    if (_appliedRemoteSkin === null) return;
    _appliedRemoteSkin = null;
    const row = document.getElementById('diceRow');
    if (!row) return;
    row.querySelectorAll('.die').forEach(el => {
      Object.keys(SKIN_FACES).forEach(id => el.classList.remove('remote-skin-' + id));
      el.style.removeProperty('background');
      el.style.removeProperty('color');
    });
  }

  // ─── Per-die colour palette (opponent free-colour feature) ──────────

  const PER_DIE_PALETTE = [
    ['#f8f8f8', '#111'],
    ['#ef4444', '#fff'],
    ['#f97316', '#fff'],
    ['#f5a623', '#251400'],
    ['#22c55e', '#07130a'],
    ['#14b8a6', '#031817'],
    ['#3b82f6', '#fff'],
    ['#8b5cf6', '#fff'],
    ['#ec4899', '#fff'],
    ['#111827', '#fff']
  ];

  function applyOpponentPerDieColors(liveDice, row) {
    if (!row) return;
    const diceEls = row.querySelectorAll('.die');
    // Prefer colors embedded in liveDice, fall back to the player's stored perDieColors
    const perDieColors = (liveDice && liveDice.perDieColors) ||
      (typeof currentTurnId !== 'undefined' && allPlayers &&
        allPlayers[currentTurnId] && allPlayers[currentTurnId].perDieColors) || null;
    diceEls.forEach(el => {
      el.style.removeProperty('background');
      el.style.removeProperty('color');
      el.style.removeProperty('border');
    });
    if (!perDieColors || !Array.isArray(perDieColors) || perDieColors.length !== 5) return;
    diceEls.forEach((el, idx) => {
      const i = el.hasAttribute('data-i') ? Number(el.getAttribute('data-i')) : idx;
      if (i < 0 || i >= 5 || el.classList.contains('held')) return;
      const pair = PER_DIE_PALETTE.find(p => p[0].toLowerCase() === String(perDieColors[i]).toLowerCase()) || PER_DIE_PALETTE[0];
      el.style.setProperty('background', pair[0], 'important');
      el.style.setProperty('color', pair[1], 'important');
    });
  }

  // ─── Opponent dice display patch ─────────────────────────────────────
  // The key change vs. the old approach: we track a hash of the opponent's
  // dice state. showOpponentDiceInRoller is called on EVERY Firebase event
  // (even ones that don't touch the dice), and each call runs renderDice(true)
  // which triggers the die-spin animation. By skipping the call when nothing
  // changed we eliminate the strobe entirely.

  let _lastOppDiceHash = null;
  let _lastOppSkin     = null;

  function patchOpponentDiceDisplay() {
    const orig = window.showOpponentDiceInRoller;
    if (typeof orig !== 'function' || orig.__skinPatched) return;

    window.showOpponentDiceInRoller = function(liveDice, oppName) {
      const skinId = (liveDice && liveDice.skin) ||
        (typeof currentTurnId !== 'undefined' && allPlayers &&
          allPlayers[currentTurnId] && allPlayers[currentTurnId].skin) ||
        'classic';
      const safe = SKIN_FACES[skinId] ? skinId : 'classic';

      // Hash covers dice values, held flags, and roll number.
      const diceHash = liveDice
        ? JSON.stringify(liveDice.dice) + '|' + JSON.stringify(liveDice.held) + '|' + (liveDice.roll || 0)
        : null;

      const diceChanged = diceHash !== _lastOppDiceHash;
      const skinChanged = safe !== _lastOppSkin;

      if (!diceChanged && !skinChanged) return; // nothing to update, skip re-render

      _lastOppDiceHash = diceHash;
      _lastOppSkin     = safe;

      if (diceChanged) {
        // Override getDieFace so renderDice inside orig uses the opponent's skin faces.
        const oppFaces = SKIN_FACES[safe];
        const origGetDieFace = window.getDieFace;
        window.getDieFace = function(dieIndex, value) {
          return value <= 0 ? '–' : oppFaces[value - 1];
        };
        const result = orig.apply(this, arguments);
        window.getDieFace = origGetDieFace;

        // Force CSS re-apply after renderDice rebuilt the DOM (elements may be new).
        _appliedRemoteSkin = null;
        applyRemoteSkin(safe);
        applyOpponentPerDieColors(liveDice, document.getElementById('diceRow'));
        return result;
      }

      // Dice are the same but skin changed — just update CSS, no re-render.
      applyRemoteSkin(safe);
    };
    window.showOpponentDiceInRoller.__skinPatched = true;
  }

  function patchRestoreMyDiceUI() {
    const orig = window.restoreMyDiceUI;
    if (typeof orig !== 'function' || orig.__skinPatched) return;
    window.restoreMyDiceUI = function() {
      // Strip opponent skin CSS before renderDice paints my dice.
      clearRemoteSkin();
      // Reset opponent dice tracking so the next turn detects a change correctly.
      _lastOppDiceHash = null;
      _lastOppSkin     = null;
      return orig.apply(this, arguments);
    };
    window.restoreMyDiceUI.__skinPatched = true;
  }

  // ─── Single-player bot turn dice ─────────────────────────────────────
  // During the bot's turn the main #diceRow is reused to show its rolls,
  // which would otherwise inherit the local player's equipped skin. Force
  // the classic faces + skin so the bot has its own visual identity.

  function patchShowBotDiceInRoller() {
    const orig = window.showBotDiceInRoller;
    if (typeof orig !== 'function' || orig.__skinPatched) return;
    window.showBotDiceInRoller = function() {
      const classicFaces = SKIN_FACES.classic;
      const origGetDieFace = window.getDieFace;
      window.getDieFace = function(dieIndex, value) {
        return value <= 0 ? '–' : classicFaces[value - 1];
      };
      const result = orig.apply(this, arguments);
      window.getDieFace = origGetDieFace;
      _appliedRemoteSkin = null;
      applyRemoteSkin('classic');
      const row = document.getElementById('diceRow');
      if (row) row.querySelectorAll('.die').forEach(el => {
        el.style.removeProperty('background');
        el.style.removeProperty('color');
        el.style.removeProperty('border');
      });
      return result;
    };
    window.showBotDiceInRoller.__skinPatched = true;
  }

  function patchClearDice() {
    const orig = window.clearDice;
    if (typeof orig !== 'function' || orig.__skinPatched) return;
    window.clearDice = function() {
      clearRemoteSkin();
      return orig.apply(this, arguments);
    };
    window.clearDice.__skinPatched = true;
  }

  // ─── Skin-changing functions ─────────────────────────────────────────

  function patchSkinChangingFunctions() {
    ['equipSkin', 'buySkin'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__skinPublishPatched) return;
      const patched = function(...args) {
        const result = original.apply(this, args);
        setTimeout(() => publishMySkin(), 50);
        return result;
      };
      patched.__skinPublishPatched = true;
      window[name] = patched;
    });
    ['setDieColor', 'resetDieColors'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__skinPublishPatched) return;
      const patched = function(...args) {
        const result = original.apply(this, args);
        setTimeout(() => publishMyPerDieColors(), 50);
        return result;
      };
      patched.__skinPublishPatched = true;
      window[name] = patched;
    });
  }

  // ─── Leaderboard / action-popup decoration ───────────────────────────

  function skinName(id) {
    return {
      classic: 'Classic', gold: 'Gold', neon: 'Neon', ice: 'Ice', fire: 'Fire',
      galaxy: 'Galaxy', red: 'Red', blue: 'Blue', green: 'Green', purple: 'Purple',
      orange: 'Orange', pink: 'Pink', black: 'Black', teal: 'Teal', candy: 'Candy',
      ocean: 'Ocean', midnight: 'Midnight', lava: 'Lava', rosegold: 'Rose Gold',
      diamond: 'Diamond'
    }[id] || 'Classic';
  }

  function decorateDiceContainer(container, skinId) {
    if (!container) return;
    const safe = SKIN_FACES[skinId] ? skinId : 'classic';
    container.querySelectorAll('.die, span, .bap-die').forEach(el => {
      Object.keys(SKIN_FACES).forEach(id => el.classList.remove('remote-skin-' + id));
      el.classList.add('remote-skin-' + safe);
    });
  }

  function updateOpponentSkinBadges() {
    try {
      if (!allPlayers) return;
      Object.entries(allPlayers).forEach(([id, p]) => {
        const skinId = p.skin || (p.liveDice && p.liveDice.skin) || 'classic';
        Array.from(document.querySelectorAll('.lb-name, .opp-hname, .bap-name')).forEach(el => {
          if (!el || !p.name || !el.textContent.includes(p.name)) return;
          let badge = el.querySelector('.skin-mini-badge');
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'skin-mini-badge';
            el.appendChild(badge);
          }
          badge.textContent = skinName(skinId);
        });
      });
    } catch(e) {}
  }

  function decorateRemoteLiveDice() {
    try {
      if (!allPlayers) return;
      Object.entries(allPlayers).forEach(([id, p]) => {
        if (id === playerId) return;
        const skinId = p.skin || (p.liveDice && p.liveDice.skin) || 'classic';
        document.querySelectorAll('.live-dice, .opp-live-dice, .bap-dice').forEach(el =>
          decorateDiceContainer(el, skinId));
      });
    } catch(e) {}
  }

  function applySkinToActionPopup() {
    try {
      const nameEl = document.getElementById('bapName');
      const diceEl = document.getElementById('bapDice');
      if (!diceEl) return;
      let skinId = 'classic';
      if (allPlayers && nameEl) {
        const text = nameEl.textContent || '';
        const found = Object.values(allPlayers).find(p => p && p.name && text.includes(p.name));
        if (found) skinId = found.skin || (found.liveDice && found.liveDice.skin) || 'classic';
      }
      decorateDiceContainer(diceEl, skinId);
    } catch(e) {}
  }

  function patchFunction(name, after) {
    const original = window[name];
    if (typeof original !== 'function' || original.__skinSyncPatched) return;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(after, 0);
      return result;
    };
    patched.__skinSyncPatched = true;
    window[name] = patched;
  }

  // ─── Firebase listener ───────────────────────────────────────────────

  function listenForRoomSkinChanges() {
    try {
      if (!roomRef || !mpMode) return;
      if (window.__skinSyncListeningRef === roomRef) return;
      window.__skinSyncListeningRef = roomRef;

      roomRef.child('players').on('value', snap => {
        const players = snap.val() || {};
        if (allPlayers) {
          Object.keys(players).forEach(id => {
            if (!allPlayers[id]) allPlayers[id] = {};
            allPlayers[id].skin = players[id].skin || 'classic';
            if (players[id].liveDice) allPlayers[id].liveDice = players[id].liveDice;
            if (players[id].perDieColors) allPlayers[id].perDieColors = players[id].perDieColors;
          });
        }
        updateOpponentSkinBadges();
        decorateRemoteLiveDice();
        applySkinToActionPopup();
      });
    } catch(e) {}
  }

  // ─── Init ────────────────────────────────────────────────────────────

  function trySetup() {
    try {
      patchSkinChangingFunctions();
      patchOpponentDiceDisplay();
      patchRestoreMyDiceUI();
      patchShowBotDiceInRoller();
      patchClearDice();
      patchFunction('renderLeaderboard', () => {
        updateOpponentSkinBadges();
        decorateRemoteLiveDice();
      });
      patchFunction('showBotActionPopup', () => {
        setTimeout(applySkinToActionPopup, 0);
      });
      if (_skinPublishedRoomRef !== roomRef) { publishMySkin(); publishMyPerDieColors(); }
      listenForRoomSkinChanges();
      updateOpponentSkinBadges();
      decorateRemoteLiveDice();
    } catch(e) {}
  }

  function initSkinSync() {
    injectSkinSyncStyles();
    trySetup();

    // Retry a handful of times to handle delayed lobby/game init.
    // Stops after 5 attempts (~7.5 s) — no infinite interval that would
    // write to Firebase every 1.5 s and trigger the strobe feedback loop.
    let retries = 5;
    const retryInterval = setInterval(() => {
      trySetup();
      if (--retries <= 0) clearInterval(retryInterval);
    }, 1500);
  }

  window.getActiveDiceSkinId    = activeSkinId;
  window.getDiceFaceForSkin     = faceFor;
  window.publishMyDiceSkin      = publishMySkin;
  window.publishMyDiceColors    = publishMyPerDieColors;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkinSync);
  } else {
    initSkinSync();
  }
})();
