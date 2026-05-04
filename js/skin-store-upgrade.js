// ─── SKIN STORE UPGRADE ──────────────────────────────────────────────
// Adds a main-menu skin store button for logged-in users, keeps original dice
// color customization free with a palette, and makes premium skins harder to unlock.

(function() {
  const ACTIVE_KEY = 'yum_active_dice_skin';
  const OWNED_KEY = 'yum_store_owned_skins';
  const COLOR_KEY = 'yum_custom_dice_color';
  const PROFILE_KEY = 'yum_google_profile';

  const PALETTE = [
    ['white', '#f8f8f8', '#111'],
    ['red', '#ef4444', '#fff'],
    ['orange', '#f97316', '#fff'],
    ['gold', '#f5a623', '#251400'],
    ['green', '#22c55e', '#07130a'],
    ['teal', '#14b8a6', '#031817'],
    ['blue', '#3b82f6', '#fff'],
    ['purple', '#8b5cf6', '#fff'],
    ['pink', '#ec4899', '#fff'],
    ['black', '#111827', '#fff']
  ];

  const DOT_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

  const PREMIUM_SKINS = [
    { id: 'gold', name: 'Gold Dice', cost: 5, preview: DOT_FACES, style: 'background:linear-gradient(135deg,#fff7cc,#f5a623);color:#251400' },
    { id: 'neon', name: 'Neon Dice', cost: 8, preview: DOT_FACES, style: 'background:#101827;color:#4ecdc4;border:1px solid rgba(78,205,196,.6)' },
    { id: 'ice', name: 'Ice Dice', cost: 10, preview: DOT_FACES, style: 'background:linear-gradient(135deg,#e0f7ff,#8fd8ff);color:#06283d' },
    { id: 'fire', name: 'Fire Dice', cost: 15, preview: DOT_FACES, style: 'background:linear-gradient(135deg,#ffd166,#e94560);color:#180004' },
    { id: 'galaxy', name: 'Galaxy Dice', cost: 25, preview: DOT_FACES, style: 'background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%);color:#f8fafc;border:1px solid rgba(168,85,247,.7)' }
  ];

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getProfile() {
    return loadJSON(PROFILE_KEY, null);
  }

  function isLoggedInUser() {
    const p = getProfile();
    return !!(p && (p.type === 'google' || p.type === 'apple') && (p.uid || p.email));
  }

  function getUnlockedAchievementCount() {
    try {
      if (typeof loadUnlocked === 'function') return Object.keys(loadUnlocked()).length;
    } catch(e) {}
    return Object.keys(loadJSON('yum_achievements', {})).length;
  }

  function getOwned() {
    const owned = loadJSON(OWNED_KEY, ['classic']);
    if (!owned.includes('classic')) owned.push('classic');
    return [...new Set(owned)];
  }

  function setOwned(owned) {
    saveJSON(OWNED_KEY, [...new Set(['classic', ...owned])]);
  }

  function spentCredits() {
    const owned = getOwned();
    return PREMIUM_SKINS.reduce((sum, skin) => sum + (owned.includes(skin.id) ? skin.cost : 0), 0);
  }

  function availableCredits() {
    return Math.max(0, getUnlockedAchievementCount() - spentCredits());
  }

  function getActive() {
    return localStorage.getItem(ACTIVE_KEY) || 'classic';
  }

  function colorPair() {
    const saved = localStorage.getItem(COLOR_KEY) || '#f8f8f8';
    return PALETTE.find(p => p[1].toLowerCase() === saved.toLowerCase()) || PALETTE[0];
  }

  function keepDiceDots() {
    if (!Array.isArray(window.DICE_FACES)) return;
    DOT_FACES.forEach((face, i) => { window.DICE_FACES[i] = face; });
  }

  function injectStyles() {
    if (document.getElementById('skinStoreUpgradeStyles')) return;
    const style = document.createElement('style');
    style.id = 'skinStoreUpgradeStyles';
    style.textContent = `
      .main-skin-store-btn {
        width: min(520px, 100%);
        border: 1px solid rgba(245,166,35,.42);
        background: rgba(245,166,35,.13);
        color: var(--gold);
        border-radius: 999px;
        padding: 10px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: 1px;
        cursor: pointer;
        box-shadow: 0 8px 28px rgba(245,166,35,.12);
      }
      #skinStoreUpgradeOverlay {
        position: fixed;
        inset: 0;
        z-index: 980;
        display: none;
        align-items: flex-end;
        justify-content: center;
        background: rgba(0,0,0,.72);
      }
      #skinStoreUpgradeOverlay.open { display: flex; }
      .ssu-sheet {
        width: 100%;
        max-width: 520px;
        max-height: 84vh;
        overflow-y: auto;
        border-radius: 24px 24px 0 0;
        background: var(--panel);
        border: 1px solid rgba(245,166,35,.22);
        box-shadow: 0 -16px 50px rgba(0,0,0,.55);
        padding: 18px 16px 28px;
      }
      .ssu-head { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px; }
      .ssu-title { font-family:'Bebas Neue',cursive;font-size:1.55rem;letter-spacing:3px;color:var(--gold); }
      .ssu-close { border:none;background:rgba(255,255,255,.08);color:var(--muted);border-radius:999px;padding:8px 12px;font-weight:900; }
      .ssu-credit { display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:15px;padding:11px 13px;margin-bottom:12px; }
      .ssu-small { color:var(--muted);font-size:.72rem;font-weight:800; }
      .ssu-credit-num { font-family:'Bebas Neue',cursive;font-size:1.7rem;letter-spacing:2px;color:var(--gold); }
      .ssu-section { background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px;margin-bottom:12px; }
      .ssu-section-title { font-weight:1000;color:var(--green);letter-spacing:1px;margin-bottom:8px; }
      .ssu-palette { display:flex;flex-wrap:wrap;gap:8px;margin-top:9px; }
      .ssu-swatch { width:38px;height:38px;border-radius:10px;border:2px solid rgba(255,255,255,.14);box-shadow:0 3px 10px rgba(0,0,0,.25);cursor:pointer; }
      .ssu-swatch.active { border-color:var(--gold);box-shadow:0 0 0 3px rgba(245,166,35,.18); }
      .ssu-skins { display:grid;gap:10px; }
      .ssu-card { background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px; }
      .ssu-card.active { border-color:rgba(78,205,196,.55);box-shadow:0 0 18px rgba(78,205,196,.16); }
      .ssu-card-top { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px; }
      .ssu-name { font-weight:1000;color:var(--white); }
      .ssu-cost { color:var(--gold);font-size:.76rem;font-weight:1000;white-space:nowrap; }
      .ssu-preview { display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px; }
      .ssu-preview span { width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:1000;line-height:1; }
      .ssu-action { width:100%;border:none;border-radius:999px;padding:9px 12px;font-family:Nunito,sans-serif;font-weight:1000;letter-spacing:.7px;cursor:pointer;background:linear-gradient(135deg,var(--green),#2ecc71);color:#111; }
      .ssu-action.locked { background:rgba(255,255,255,.08);color:var(--muted);border:1px solid rgba(255,255,255,.1); }
      .ssu-action.active { background:rgba(78,205,196,.12);color:var(--green);border:1px solid rgba(78,205,196,.35); }
      body.skin-gold .dice-section .die { background:linear-gradient(135deg,#fff7cc,#f5a623)!important;color:#251400!important; }
      body.skin-neon .dice-section .die { background:#101827!important;color:#4ecdc4!important;border:1px solid rgba(78,205,196,.6)!important;box-shadow:0 0 18px rgba(78,205,196,.25)!important; }
      body.skin-ice .dice-section .die { background:linear-gradient(135deg,#e0f7ff,#8fd8ff)!important;color:#06283d!important; }
      body.skin-fire .dice-section .die { background:linear-gradient(135deg,#ffd166,#e94560)!important;color:#180004!important; }
      body.skin-galaxy .dice-section .die { background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%)!important;color:#f8fafc!important;border:1px solid rgba(168,85,247,.7)!important;box-shadow:0 0 20px rgba(168,85,247,.28)!important; }
      body.skin-classic .dice-section .die,
      body:not(.skin-gold):not(.skin-neon):not(.skin-ice):not(.skin-fire):not(.skin-galaxy) .dice-section .die {
        background: var(--yum-custom-die-bg, #f8f8f8) !important;
        color: var(--yum-custom-die-fg, #111) !important;
      }
      body.skin-classic .dice-section .die.held,
      body.skin-gold .dice-section .die.held,
      body.skin-neon .dice-section .die.held,
      body.skin-ice .dice-section .die.held,
      body.skin-fire .dice-section .die.held,
      body.skin-galaxy .dice-section .die.held,
      body:not(.skin-gold):not(.skin-neon):not(.skin-ice):not(.skin-fire):not(.skin-galaxy) .dice-section .die.held {
        background: var(--gold) !important;
        color: #111 !important;
        border: none !important;
        box-shadow: 0 0 14px rgba(245,166,35,0.6) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applySkinAndColor() {
    keepDiceDots();
    const active = getActive();
    document.body.classList.remove('skin-classic','skin-gold','skin-neon','skin-ice','skin-fire','skin-galaxy');
    document.body.classList.add(PREMIUM_SKINS.some(s => s.id === active) ? `skin-${active}` : 'skin-classic');
    const pair = colorPair();
    document.documentElement.style.setProperty('--yum-custom-die-bg', pair[1]);
    document.documentElement.style.setProperty('--yum-custom-die-fg', pair[2]);
  }

  function ensureOverlay() {
    let overlay = document.getElementById('skinStoreUpgradeOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'skinStoreUpgradeOverlay';
    overlay.onclick = e => { if (e.target === overlay) closeSkinStore(); };
    overlay.innerHTML = `<div class="ssu-sheet">
      <div class="ssu-head"><div class="ssu-title">🎨 SKIN STORE</div><button class="ssu-close" onclick="closeSkinStore()">✕</button></div>
      <div class="ssu-credit"><div><div class="ssu-small">Completed achievements give credits</div><div class="ssu-small">Premium skins now cost more credits</div></div><div class="ssu-credit-num" id="ssuCredits">0</div></div>
      <div id="ssuContent"></div>
    </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function renderStore() {
    ensureOverlay();
    const content = document.getElementById('ssuContent');
    const creditEl = document.getElementById('ssuCredits');
    if (!content || !creditEl) return;
    creditEl.textContent = availableCredits();
    const owned = getOwned();
    const active = getActive();
    const currentColor = colorPair()[1].toLowerCase();

    const paletteHtml = PALETTE.map(([name, bg]) => `<button class="ssu-swatch ${currentColor === bg.toLowerCase() ? 'active' : ''}" title="${name}" style="background:${bg}" onclick="setClassicDiceColor('${bg}')"></button>`).join('');

    const skinsHtml = PREMIUM_SKINS.map(skin => {
      const isOwned = owned.includes(skin.id);
      const isActive = active === skin.id;
      const canBuy = availableCredits() >= skin.cost;
      const preview = skin.preview.map(face => `<span style="${skin.style}">${face}</span>`).join('');
      let action = '';
      if (isActive) action = `<button class="ssu-action active" disabled>✓ EQUIPPED</button>`;
      else if (isOwned) action = `<button class="ssu-action" onclick="equipSkin('${skin.id}')">EQUIP</button>`;
      else if (canBuy) action = `<button class="ssu-action" onclick="buySkin('${skin.id}')">UNLOCK · ${skin.cost} CREDITS</button>`;
      else action = `<button class="ssu-action locked" disabled>LOCKED · NEED ${skin.cost} CREDITS</button>`;
      return `<div class="ssu-card ${isActive ? 'active' : ''}"><div class="ssu-card-top"><div class="ssu-name">${skin.name}</div><div class="ssu-cost">${skin.cost} credits</div></div><div class="ssu-preview">${preview}</div>${action}</div>`;
    }).join('');

    content.innerHTML = `<div class="ssu-section"><div class="ssu-section-title">FREE ORIGINAL DICE COLOR</div><div class="ssu-small">Choose a color from the palette. This stays free.</div><div class="ssu-palette">${paletteHtml}</div><button class="ssu-action ${active === 'classic' ? 'active' : ''}" style="margin-top:10px" onclick="equipSkin('classic')">${active === 'classic' ? '✓ USING ORIGINAL DICE' : 'USE ORIGINAL DICE'}</button></div><div class="ssu-section"><div class="ssu-section-title">PREMIUM ACHIEVEMENT SKINS</div><div class="ssu-skins">${skinsHtml}</div></div>`;
  }

  window.openSkinStore = function openSkinStoreUpgrade() {
    injectStyles();
    ensureOverlay();
    renderStore();
    document.getElementById('skinStoreUpgradeOverlay').classList.add('open');
  };

  window.closeSkinStore = function closeSkinStoreUpgrade() {
    const overlay = document.getElementById('skinStoreUpgradeOverlay');
    if (overlay) overlay.classList.remove('open');
  };

  window.setClassicDiceColor = function setClassicDiceColor(bg) {
    const pair = PALETTE.find(p => p[1].toLowerCase() === String(bg).toLowerCase()) || PALETTE[0];
    localStorage.setItem(COLOR_KEY, pair[1]);
    localStorage.setItem(ACTIVE_KEY, 'classic');
    applySkinAndColor();
    renderStore();
    if (typeof renderDice === 'function') renderDice(false);
  };

  window.equipSkin = function equipSkinUpgrade(id) {
    if (id !== 'classic' && !getOwned().includes(id)) return;
    localStorage.setItem(ACTIVE_KEY, id);
    applySkinAndColor();
    renderStore();
    if (typeof renderDice === 'function') renderDice(false);
    if (window.showToast) showToast(id === 'classic' ? 'Original dice equipped' : 'Skin equipped');
  };

  window.buySkin = function buySkinUpgrade(id) {
    const skin = PREMIUM_SKINS.find(s => s.id === id);
    if (!skin) return;
    const owned = getOwned();
    if (owned.includes(id)) return equipSkin(id);
    if (availableCredits() < skin.cost) {
      if (window.showToast) showToast(`Need ${skin.cost} credits`);
      return;
    }
    owned.push(id);
    setOwned(owned);
    equipSkin(id);
    if (window.showToast) showToast(`${skin.name} unlocked!`);
  };

  function addMainMenuStoreButton() {
    const lobby = document.getElementById('lobbyOverlay');
    const profileBar = document.getElementById('profileLoginBar');
    if (!lobby || !profileBar) return;

    let btn = document.getElementById('mainSkinStoreBtn');
    if (!isLoggedInUser()) {
      if (btn) btn.remove();
      return;
    }

    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'mainSkinStoreBtn';
      btn.type = 'button';
      btn.className = 'main-skin-store-btn';
      btn.onclick = window.openSkinStore;
      profileBar.insertAdjacentElement('afterend', btn);
    }
    btn.textContent = `🎨 Skin Store · ${availableCredits()} credits`;
  }

  function init() {
    injectStyles();
    applySkinAndColor();
    addMainMenuStoreButton();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    applySkinAndColor();
    addMainMenuStoreButton();
  }, 1200);
})();
