// ─── MULTIPLAYER DICE SKIN SYNC ──────────────────────────────────────
// Makes active dice skins visible to opponents in multiplayer.
// Local skin choice stays in localStorage, then this script publishes it to Firebase.

(function() {
  const ACTIVE_SKIN_KEY = 'yum_active_dice_skin';

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
      if (!window.mpMode || !window.roomRef || !window.playerId) return;
      const skinId = activeSkinId();
      roomRef.child('players/' + playerId + '/skin').set(skinId);
      roomRef.child('players/' + playerId + '/skinUpdatedAt').set(Date.now());
    } catch(e) {}
  }

  function publishLiveDiceSkin() {
    try {
      if (!window.mpMode || !window.roomRef || !window.playerId) return;
      const skinId = activeSkinId();
      const payload = {
        dice: Array.isArray(window.dice) ? window.dice : dice,
        held: Array.isArray(window.held) ? window.held : held,
        roll: 3 - (typeof rollsLeft === 'number' ? rollsLeft : 3),
        skin: skinId,
        ts: Date.now()
      };
      roomRef.child('players/' + playerId + '/liveDice').set(payload);
      roomRef.child('players/' + playerId + '/skin').set(skinId);
    } catch(e) {}
  }

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

  function skinName(id) {
    return {
      classic: 'Classic',
      gold: 'Gold',
      neon: 'Neon',
      ice: 'Ice',
      fire: 'Fire',
      galaxy: 'Galaxy',
      red: 'Red',
      blue: 'Blue',
      green: 'Green',
      purple: 'Purple',
      orange: 'Orange',
      pink: 'Pink',
      black: 'Black',
      teal: 'Teal',
      candy: 'Candy',
      ocean: 'Ocean',
      midnight: 'Midnight',
      lava: 'Lava',
      rosegold: 'Rose Gold',
      diamond: 'Diamond'
    }[id] || 'Classic';
  }

  function decorateDiceContainer(container, skinId) {
    if (!container) return;
    const safeSkin = SKIN_FACES[skinId] ? skinId : 'classic';
    const diceEls = container.querySelectorAll('.die, span, .bap-die');
    diceEls.forEach(el => {
      Object.keys(SKIN_FACES).forEach(id => el.classList.remove('remote-skin-' + id));
      el.classList.add('remote-skin-' + safeSkin);
    });
  }

  function updateOpponentSkinBadges() {
    try {
      if (!window.allPlayers) return;
      Object.entries(allPlayers).forEach(([id, p]) => {
        const skinId = p.skin || (p.liveDice && p.liveDice.skin) || 'classic';
        const nameEls = Array.from(document.querySelectorAll('.lb-name, .opp-hname, .bap-name'));
        nameEls.forEach(el => {
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

  function patchSkinChangingFunctions() {
    ['equipSkin', 'buySkin'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__skinPublishPatched) return;
      const patched = function(...args) {
        const result = original.apply(this, args);
        setTimeout(() => {
          publishMySkin();
          publishLiveDiceSkin();
        }, 50);
        return result;
      };
      patched.__skinPublishPatched = true;
      window[name] = patched;
    });
  }

  function patchDiceSyncFunctions() {
    ['rollDice', 'toggleHold', 'renderDice'].forEach(name => patchFunction(name, () => {
      publishMySkin();
      if (name !== 'renderDice') publishLiveDiceSkin();
    }));

    patchFunction('renderLeaderboard', () => {
      updateOpponentSkinBadges();
      decorateRemoteLiveDice();
    });

    patchFunction('showBotActionPopup', () => {
      setTimeout(applySkinToActionPopup, 0);
    });

    patchOpponentDiceDisplay();
    patchRestoreMyDiceUI();
  }

  function setRollerDiceCssClass(skinId) {
    const safeSkin = SKIN_FACES[skinId] ? skinId : 'classic';
    const row = document.getElementById('diceRow');
    if (!row) return;
    row.querySelectorAll('.die').forEach(el => {
      Object.keys(SKIN_FACES).forEach(id => el.classList.remove('remote-skin-' + id));
      if (safeSkin !== 'classic') el.classList.add('remote-skin-' + safeSkin);
    });
  }

  function clearRollerDiceCssClass() {
    const row = document.getElementById('diceRow');
    if (!row) return;
    row.querySelectorAll('.die').forEach(el => {
      Object.keys(SKIN_FACES).forEach(id => el.classList.remove('remote-skin-' + id));
    });
  }

  function patchOpponentDiceDisplay() {
    const orig = window.showOpponentDiceInRoller;
    if (typeof orig !== 'function' || orig.__skinPatched) return;
    window.showOpponentDiceInRoller = function(liveDice, oppName) {
      const skinId = (liveDice && liveDice.skin) ||
        (window.currentTurnId && window.allPlayers && allPlayers[currentTurnId] && allPlayers[currentTurnId].skin) ||
        'classic';
      const safeSkin = SKIN_FACES[skinId] ? skinId : 'classic';

      // Swap DICE_FACES to opponent's skin so renderDice (called inside orig) uses correct faces
      const savedFaces = Array.isArray(window.DICE_FACES) ? [...window.DICE_FACES] : null;
      if (savedFaces) {
        SKIN_FACES[safeSkin].forEach((face, i) => { window.DICE_FACES[i] = face; });
      }

      const result = orig.apply(this, arguments);

      // Restore DICE_FACES so future local renders use the local player's skin
      if (savedFaces) {
        savedFaces.forEach((face, i) => { window.DICE_FACES[i] = face; });
      }

      // Apply opponent skin CSS (background/colour) to the dice row
      setRollerDiceCssClass(safeSkin);

      return result;
    };
    window.showOpponentDiceInRoller.__skinPatched = true;
  }

  function patchRestoreMyDiceUI() {
    const orig = window.restoreMyDiceUI;
    if (typeof orig !== 'function' || orig.__skinPatched) return;
    window.restoreMyDiceUI = function() {
      // Strip opponent skin CSS before renderDice runs with local player's dice/faces
      clearRollerDiceCssClass();
      return orig.apply(this, arguments);
    };
    window.restoreMyDiceUI.__skinPatched = true;
  }

  function decorateRemoteLiveDice() {
    try {
      if (!window.allPlayers) return;
      Object.entries(allPlayers).forEach(([id, p]) => {
        if (id === playerId) return;
        const skinId = p.skin || (p.liveDice && p.liveDice.skin) || 'classic';
        // Best-effort: decorate any visible dice containers generated for opponent/live dice.
        document.querySelectorAll('.live-dice, .opp-live-dice, .bap-dice').forEach(el => decorateDiceContainer(el, skinId));
      });
    } catch(e) {}
  }

  function applySkinToActionPopup() {
    try {
      const nameEl = document.getElementById('bapName');
      const diceEl = document.getElementById('bapDice');
      if (!diceEl) return;

      let skinId = 'classic';
      if (window.allPlayers && nameEl) {
        const text = nameEl.textContent || '';
        const found = Object.values(allPlayers).find(p => p && p.name && text.includes(p.name));
        if (found) skinId = found.skin || (found.liveDice && found.liveDice.skin) || 'classic';
      }
      decorateDiceContainer(diceEl, skinId);
    } catch(e) {}
  }

  function listenForRoomSkinChanges() {
    try {
      if (!window.roomRef || !window.mpMode) return;
      if (window.__skinSyncListening) return;
      window.__skinSyncListening = true;

      roomRef.child('players').on('value', snap => {
        const players = snap.val() || {};
        if (window.allPlayers) {
          Object.keys(players).forEach(id => {
            if (!allPlayers[id]) allPlayers[id] = players[id];
            allPlayers[id].skin = players[id].skin || 'classic';
            if (players[id].liveDice) allPlayers[id].liveDice = players[id].liveDice;
          });
        }
        updateOpponentSkinBadges();
        decorateRemoteLiveDice();
        applySkinToActionPopup();
      });
    } catch(e) {}
  }

  function initSkinSync() {
    injectSkinSyncStyles();
    patchSkinChangingFunctions();
    patchDiceSyncFunctions();
    publishMySkin();
    listenForRoomSkinChanges();

    // Room/player globals are created after lobby actions, so retry lightly.
    setInterval(() => {
      patchSkinChangingFunctions();
      publishMySkin();
      listenForRoomSkinChanges();
      updateOpponentSkinBadges();
      decorateRemoteLiveDice();
    }, 1500);
  }

  window.getActiveDiceSkinId = activeSkinId;
  window.getDiceFaceForSkin = faceFor;
  window.publishMyDiceSkin = publishMySkin;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSkinSync);
  } else {
    initSkinSync();
  }
})();
