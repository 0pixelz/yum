// ─── ACHIEVEMENT CREDIT STORE ────────────────────────────────────────
// Each unlocked achievement gives 1 credit. Credits can unlock dice skins.

(function() {
  const STORE_OWNED_KEY = 'yum_store_owned_skins';
  const STORE_ACTIVE_KEY = 'yum_active_dice_skin';
  const PER_DIE_KEY = 'yum_per_die_skins';

  const SKINS = [
    {
      id: 'classic',
      name: 'Classic White',
      cost: 0,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#f8f8f8;color:#111',
      className: 'skin-classic'
    },
    {
      id: 'red',
      name: 'Red Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#dc2626;color:#fff',
      className: 'skin-red'
    },
    {
      id: 'blue',
      name: 'Blue Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#2563eb;color:#fff',
      className: 'skin-blue'
    },
    {
      id: 'green',
      name: 'Green Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#16a34a;color:#fff',
      className: 'skin-green'
    },
    {
      id: 'purple',
      name: 'Purple Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#7c3aed;color:#fff',
      className: 'skin-purple'
    },
    {
      id: 'orange',
      name: 'Orange Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#ea580c;color:#fff',
      className: 'skin-orange'
    },
    {
      id: 'pink',
      name: 'Pink Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#db2777;color:#fff',
      className: 'skin-pink'
    },
    {
      id: 'black',
      name: 'Black Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#1c1c1c;color:#fff;border:1px solid rgba(255,255,255,.15)',
      className: 'skin-black'
    },
    {
      id: 'teal',
      name: 'Teal Dice',
      cost: 1,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:#0d9488;color:#fff',
      className: 'skin-teal'
    },
    {
      id: 'ice',
      name: 'Ice Dice',
      cost: 1,
      preview: ['❄1','❄2','❄3','❄4','❄5','❄6'],
      previewStyle: 'background:linear-gradient(135deg,#e0f7ff,#8fd8ff);color:#06283d',
      className: 'skin-ice'
    },
    {
      id: 'fire',
      name: 'Fire Dice',
      cost: 2,
      preview: ['🔥1','🔥2','🔥3','🔥4','🔥5','🔥6'],
      previewStyle: 'background:linear-gradient(135deg,#ffd166,#e94560);color:#180004',
      className: 'skin-fire'
    },
    {
      id: 'galaxy',
      name: 'Galaxy Dice',
      cost: 3,
      preview: ['✦1','✦2','✦3','✦4','✦5','✦6'],
      previewStyle: 'background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%);color:#f8fafc;border:1px solid rgba(168,85,247,.7)',
      className: 'skin-galaxy'
    },
    {
      id: 'candy',
      name: 'Candy Dice',
      cost: 25,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:linear-gradient(135deg,#fdf2f8,#fbcfe8,#f9a8d4);color:#be185d',
      className: 'skin-candy'
    },
    {
      id: 'ocean',
      name: 'Ocean Dice',
      cost: 50,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      previewStyle: 'background:linear-gradient(135deg,#0c4a6e,#0369a1);color:#bae6fd',
      className: 'skin-ocean'
    },
    {
      id: 'midnight',
      name: 'Midnight Dice',
      cost: 100,
      preview: ['★1','★2','★3','★4','★5','★6'],
      previewStyle: 'background:linear-gradient(135deg,#020617,#1e293b);color:#94a3b8;border:1px solid rgba(148,163,184,.2)',
      className: 'skin-midnight'
    },
    {
      id: 'lava',
      name: 'Lava Dice',
      cost: 150,
      preview: ['🌋1','🌋2','🌋3','🌋4','🌋5','🌋6'],
      previewStyle: 'background:linear-gradient(135deg,#0f0000,#7f1d1d);color:#fbbf24;border:1px solid rgba(251,191,36,.4)',
      className: 'skin-lava'
    },
    {
      id: 'rosegold',
      name: 'Rose Gold Dice',
      cost: 200,
      preview: ['♥1','♥2','♥3','♥4','♥5','♥6'],
      previewStyle: 'background:linear-gradient(135deg,#fce7f3,#f9a8d4,#fda4af);color:#831843',
      className: 'skin-rosegold'
    },
    {
      id: 'neon',
      name: 'Neon Dice',
      cost: 250,
      preview: ['1','2','3','4','5','6'],
      previewStyle: 'background:#101827;color:#4ecdc4;border:1px solid rgba(78,205,196,.6)',
      className: 'skin-neon'
    },
    {
      id: 'gold',
      name: 'Gold Dice',
      cost: 300,
      preview: ['①','②','③','④','⑤','⑥'],
      previewStyle: 'background:linear-gradient(135deg,#fff7cc,#f5a623);color:#251400',
      className: 'skin-gold'
    },
    {
      id: 'diamond',
      name: 'Diamond Dice',
      cost: 500,
      preview: ['💎1','💎2','💎3','💎4','💎5','💎6'],
      previewStyle: 'background:linear-gradient(135deg,#dbeafe,#e0e7ff,#f3e8ff);color:#312e81;border:1px solid rgba(167,139,250,.7)',
      className: 'skin-diamond'
    }
  ];

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getUnlockedAchievementCount() {
    if (typeof loadUnlocked === 'function') return Object.keys(loadUnlocked()).length;
    return Object.keys(loadJSON('yum_achievements', {})).length;
  }

  function getOwnedSkins() {
    const owned = loadJSON(STORE_OWNED_KEY, ['classic']);
    if (!owned.includes('classic')) owned.push('classic');
    return owned;
  }

  function setOwnedSkins(owned) {
    saveJSON(STORE_OWNED_KEY, [...new Set(['classic', ...owned])]);
  }

  function getSpentCredits() {
    const owned = getOwnedSkins();
    return owned.reduce((sum, id) => {
      const skin = SKINS.find(s => s.id === id);
      return sum + (skin ? skin.cost : 0);
    }, 0);
  }

  function getAvailableCredits() {
    return Math.max(0, getUnlockedAchievementCount() - getSpentCredits());
  }

  function getActiveSkinId() {
    const active = localStorage.getItem(STORE_ACTIVE_KEY) || 'classic';
    return SKINS.some(s => s.id === active) ? active : 'classic';
  }

  function getActiveSkin() {
    return SKINS.find(s => s.id === getActiveSkinId()) || SKINS[0];
  }

  // ─── PER-DIE CUSTOMIZATION ──────────────────────────────────────────

  function getPerDieSkins() {
    const saved = loadJSON(PER_DIE_KEY, [null,null,null,null,null]);
    if (!Array.isArray(saved) || saved.length !== 5) return [null,null,null,null,null];
    return saved.map(id => (id && SKINS.some(s => s.id === id)) ? id : null);
  }

  function setPerDieSkins(arr) {
    saveJSON(PER_DIE_KEY, arr);
  }

  function applyDieSkinAttributes() {
    const row = document.getElementById('diceRow');
    if (!row) return;
    const perDie = getPerDieSkins();
    row.querySelectorAll('.die[data-i]').forEach(el => {
      const i = parseInt(el.getAttribute('data-i'));
      const skinId = perDie[i];
      if (skinId) {
        el.setAttribute('data-die-skin', skinId);
      } else {
        el.removeAttribute('data-die-skin');
      }
    });
  }

  // ─── STORE STYLES ───────────────────────────────────────────────────

  function injectStoreStyles() {
    if (document.getElementById('storeStyles')) return;
    const style = document.createElement('style');
    style.id = 'storeStyles';
    style.textContent = `
      .store-open-btn {
        margin: 10px 0 12px;
        width: 100%;
        border: 1px solid rgba(245,166,35,0.35);
        background: rgba(245,166,35,0.12);
        color: var(--gold);
        border-radius: 999px;
        padding: 10px 12px;
        font-family: 'Nunito', sans-serif;
        font-weight: 900;
        letter-spacing: 1px;
        cursor: pointer;
      }
      #skinStoreOverlay {
        position: fixed;
        inset: 0;
        z-index: 960;
        display: none;
        align-items: flex-end;
        justify-content: center;
        background: rgba(0,0,0,0.74);
      }
      #skinStoreOverlay.open { display: flex; }
      .store-sheet {
        width: 100%;
        max-width: 520px;
        max-height: 82vh;
        overflow-y: auto;
        background: var(--panel);
        border-radius: 24px 24px 0 0;
        padding: 18px 16px 28px;
        border: 1px solid rgba(245,166,35,0.22);
        box-shadow: 0 -12px 40px rgba(0,0,0,0.45);
      }
      .store-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .store-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.55rem;
        letter-spacing: 3px;
        color: var(--gold);
      }
      .store-close {
        border: none;
        background: rgba(255,255,255,0.08);
        color: var(--muted);
        border-radius: 999px;
        padding: 8px 12px;
        font-weight: 900;
      }
      .store-credit-box {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 14px;
        padding: 11px 13px;
        margin-bottom: 12px;
      }
      .store-credit-label {
        font-size: 0.76rem;
        color: var(--muted);
        font-weight: 800;
      }
      .store-credit-value {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.6rem;
        color: var(--gold);
        letter-spacing: 2px;
      }
      .store-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
      }
      .skin-card {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 12px;
      }
      .skin-card.active {
        border-color: rgba(78,205,196,0.55);
        box-shadow: 0 0 18px rgba(78,205,196,0.16);
      }
      .skin-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 9px;
      }
      .skin-name {
        font-weight: 900;
        color: var(--white);
      }
      .skin-cost {
        font-size: 0.76rem;
        font-weight: 900;
        color: var(--gold);
        white-space: nowrap;
      }
      .skin-preview {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        margin-bottom: 10px;
      }
      .skin-preview span {
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
        font-weight: 900;
      }
      .skin-action {
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 9px 12px;
        font-family: 'Nunito', sans-serif;
        font-weight: 900;
        letter-spacing: 0.8px;
        cursor: pointer;
        background: linear-gradient(135deg, var(--green), #2ecc71);
        color: #111;
      }
      .skin-action.equipped {
        background: rgba(78,205,196,0.12);
        color: var(--green);
        border: 1px solid rgba(78,205,196,0.35);
      }
      .skin-action.locked {
        background: rgba(255,255,255,0.08);
        color: var(--muted);
        border: 1px solid rgba(255,255,255,0.1);
      }

      /* ── Global skin body classes ── */
      body.skin-gold .die { background: linear-gradient(135deg, #fff7cc, #f5a623); color: #251400; }
      body.skin-neon .die { background: #101827; color: #4ecdc4; border: 1px solid rgba(78,205,196,0.6); box-shadow: 0 0 18px rgba(78,205,196,0.25); }
      body.skin-ice .die { background: linear-gradient(135deg, #e0f7ff, #8fd8ff); color: #06283d; }
      body.skin-fire .die { background: linear-gradient(135deg, #ffd166, #e94560); color: #180004; }
      body.skin-galaxy .die { background: radial-gradient(circle at 30% 20%, #a855f7, #0f172a 68%); color: #f8fafc; border: 1px solid rgba(168,85,247,0.7); box-shadow: 0 0 20px rgba(168,85,247,0.28); }
      body.skin-red .die { background: #dc2626; color: #fff; }
      body.skin-blue .die { background: #2563eb; color: #fff; }
      body.skin-green .die { background: #16a34a; color: #fff; }
      body.skin-purple .die { background: #7c3aed; color: #fff; }
      body.skin-orange .die { background: #ea580c; color: #fff; }
      body.skin-pink .die { background: #db2777; color: #fff; }
      body.skin-black .die { background: #1c1c1c; color: #fff; }
      body.skin-teal .die { background: #0d9488; color: #fff; }
      body.skin-candy .die { background: linear-gradient(135deg, #fdf2f8, #fbcfe8, #f9a8d4); color: #be185d; }
      body.skin-ocean .die { background: linear-gradient(135deg, #0c4a6e, #0369a1); color: #bae6fd; }
      body.skin-midnight .die { background: linear-gradient(135deg, #020617, #1e293b); color: #94a3b8; border: 1px solid rgba(148,163,184,0.2); }
      body.skin-lava .die { background: linear-gradient(135deg, #0f0000, #7f1d1d); color: #fbbf24; border: 1px solid rgba(251,191,36,0.4); box-shadow: 0 0 18px rgba(239,68,68,0.35); }
      body.skin-rosegold .die { background: linear-gradient(135deg, #fce7f3, #f9a8d4, #fda4af); color: #831843; }
      body.skin-diamond .die { background: linear-gradient(135deg, #dbeafe, #e0e7ff, #f3e8ff); color: #312e81; border: 1px solid rgba(167,139,250,0.7); box-shadow: 0 0 20px rgba(167,139,250,0.3); }

      /* ── Per-die overrides (data-die-skin attribute) ── */
      .die[data-die-skin="classic"] { background: #f8f8f8 !important; color: #111 !important; box-shadow: 0 4px 10px rgba(0,0,0,0.3) !important; border: none !important; }
      .die[data-die-skin="gold"] { background: linear-gradient(135deg,#fff7cc,#f5a623) !important; color: #251400 !important; border: none !important; }
      .die[data-die-skin="neon"] { background: #101827 !important; color: #4ecdc4 !important; border: 1px solid rgba(78,205,196,0.6) !important; box-shadow: 0 0 18px rgba(78,205,196,0.25) !important; }
      .die[data-die-skin="ice"] { background: linear-gradient(135deg,#e0f7ff,#8fd8ff) !important; color: #06283d !important; border: none !important; }
      .die[data-die-skin="fire"] { background: linear-gradient(135deg,#ffd166,#e94560) !important; color: #180004 !important; border: none !important; }
      .die[data-die-skin="galaxy"] { background: radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%) !important; color: #f8fafc !important; border: 1px solid rgba(168,85,247,0.7) !important; box-shadow: 0 0 20px rgba(168,85,247,0.28) !important; }
      .die[data-die-skin="red"] { background: #dc2626 !important; color: #fff !important; border: none !important; }
      .die[data-die-skin="blue"] { background: #2563eb !important; color: #fff !important; border: none !important; }
      .die[data-die-skin="green"] { background: #16a34a !important; color: #fff !important; border: none !important; }
      .die[data-die-skin="purple"] { background: #7c3aed !important; color: #fff !important; border: none !important; }
      .die[data-die-skin="orange"] { background: #ea580c !important; color: #fff !important; border: none !important; }
      .die[data-die-skin="pink"] { background: #db2777 !important; color: #fff !important; border: none !important; }
      .die[data-die-skin="black"] { background: #1c1c1c !important; color: #fff !important; border: 1px solid rgba(255,255,255,0.15) !important; }
      .die[data-die-skin="teal"] { background: #0d9488 !important; color: #fff !important; border: none !important; }
      .die[data-die-skin="candy"] { background: linear-gradient(135deg,#fdf2f8,#fbcfe8,#f9a8d4) !important; color: #be185d !important; border: none !important; }
      .die[data-die-skin="ocean"] { background: linear-gradient(135deg,#0c4a6e,#0369a1) !important; color: #bae6fd !important; border: none !important; }
      .die[data-die-skin="midnight"] { background: linear-gradient(135deg,#020617,#1e293b) !important; color: #94a3b8 !important; border: 1px solid rgba(148,163,184,0.2) !important; }
      .die[data-die-skin="lava"] { background: linear-gradient(135deg,#0f0000,#7f1d1d) !important; color: #fbbf24 !important; border: 1px solid rgba(251,191,36,0.4) !important; box-shadow: 0 0 18px rgba(239,68,68,0.35) !important; }
      .die[data-die-skin="rosegold"] { background: linear-gradient(135deg,#fce7f3,#f9a8d4,#fda4af) !important; color: #831843 !important; border: none !important; }
      .die[data-die-skin="diamond"] { background: linear-gradient(135deg,#dbeafe,#e0e7ff,#f3e8ff) !important; color: #312e81 !important; border: 1px solid rgba(167,139,250,0.7) !important; box-shadow: 0 0 20px rgba(167,139,250,0.3) !important; }

      /* ── Per-die customization UI ── */
      .per-die-section {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .per-die-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .per-die-title {
        font-family: 'Bebas Neue', cursive;
        letter-spacing: 2px;
        font-size: 0.95rem;
        color: var(--gold);
      }
      .per-die-reset-btn {
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.07);
        color: var(--muted);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.72rem;
        font-weight: 900;
        cursor: pointer;
        font-family: 'Nunito', sans-serif;
      }
      .per-die-dice-row {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 4px;
      }
      .per-die-slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        flex: 1;
        max-width: 58px;
      }
      .per-die-face {
        width: 46px;
        height: 46px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.55rem;
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        transition: box-shadow 0.15s, transform 0.15s;
        border: 2px solid transparent;
      }
      .per-die-slot.selected .per-die-face {
        border-color: rgba(78,205,196,0.9);
        box-shadow: 0 0 0 3px rgba(78,205,196,0.25), 0 3px 8px rgba(0,0,0,0.35);
        transform: translateY(-2px);
      }
      .per-die-label {
        font-size: 0.6rem;
        color: var(--muted);
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .per-die-picker {
        display: none;
        flex-direction: column;
        gap: 6px;
        padding: 10px 0 2px;
        border-top: 1px solid rgba(255,255,255,0.08);
        margin-top: 10px;
      }
      .per-die-picker.open { display: flex; }
      .per-die-picker-label {
        font-size: 0.72rem;
        color: var(--muted);
        font-weight: 800;
        letter-spacing: 0.5px;
      }
      .per-die-swatches {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .per-die-swatch {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        border: 2px solid transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        cursor: pointer;
        font-weight: 900;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        transition: transform 0.1s, border-color 0.1s;
        font-family: inherit;
      }
      .per-die-swatch:hover { transform: scale(1.12); }
      .per-die-swatch.selected {
        border-color: rgba(78,205,196,0.9);
        box-shadow: 0 0 10px rgba(78,205,196,0.4);
      }
      .per-die-swatch.reset-swatch {
        background: rgba(255,255,255,0.1) !important;
        color: var(--muted) !important;
        font-size: 1.2rem;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── STORE DOM ──────────────────────────────────────────────────────

  function addStoreButtonToAchievements() {
    const sheet = document.querySelector('#achOverlay .ach-sheet');
    const progressLabel = document.getElementById('achProgressLabel');
    if (!sheet || !progressLabel || document.getElementById('openSkinStoreBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'openSkinStoreBtn';
    btn.className = 'store-open-btn';
    btn.type = 'button';
    btn.onclick = openSkinStore;
    progressLabel.insertAdjacentElement('afterend', btn);
    refreshStoreButton();
  }

  function refreshStoreButton() {
    const btn = document.getElementById('openSkinStoreBtn');
    if (!btn) return;
    btn.textContent = `🎨 Dice Skin Store · ${getAvailableCredits()} credit${getAvailableCredits() === 1 ? '' : 's'}`;
  }

  function ensureStoreOverlay() {
    let overlay = document.getElementById('skinStoreOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'skinStoreOverlay';
    overlay.onclick = e => {
      if (e.target === overlay) closeSkinStore();
    };
    overlay.innerHTML = `
      <div class="store-sheet">
        <div class="store-head">
          <div class="store-title">🎨 DICE SKIN STORE</div>
          <button class="store-close">✕</button>
        </div>
        <div class="store-credit-box">
          <div>
            <div class="store-credit-label">1 completed achievement = 1 credit</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">Credits are saved on this device</div>
          </div>
          <div class="store-credit-value" id="storeCreditValue">0</div>
        </div>
        <div id="perDieColorContainer"></div>
        <div id="perDieContainer"></div>
        <div class="store-grid" id="storeGrid"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.store-close').onclick = closeSkinStore;
    return overlay;
  }

  function openSkinStore() {
    injectStoreStyles();
    ensureStoreOverlay();
    renderSkinStore();
    document.getElementById('skinStoreOverlay').classList.add('open');
  }

  function closeSkinStore() {
    const overlay = document.getElementById('skinStoreOverlay');
    if (overlay) overlay.classList.remove('open');
    selectedPerDieIndex = null;
  }

  // ─── PER-DIE UI ─────────────────────────────────────────────────────

  let selectedPerDieIndex = null;

  function renderPerDieSection() {
    const perDie = getPerDieSkins();
    const active = getActiveSkinId();
    const owned = getOwnedSkins();

    const diceHTML = [0,1,2,3,4].map(i => {
      const skinId = perDie[i] || active;
      const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
      const isSelected = selectedPerDieIndex === i;
      const hasCustom = !!perDie[i];
      return `<div class="per-die-slot${isSelected ? ' selected' : ''}" onclick="selectPerDieSlot(${i})">
        <div class="per-die-face" style="${skin.previewStyle || ''}">${skin.preview[0]}</div>
        <div class="per-die-label">DICE ${i+1}${hasCustom ? ' ●' : ''}</div>
      </div>`;
    }).join('');

    let pickerHTML = '';
    if (selectedPerDieIndex !== null) {
      const i = selectedPerDieIndex;
      const currentSkin = perDie[i];
      const swatches = SKINS.filter(s => owned.includes(s.id)).map(skin => {
        const isSelected = currentSkin === skin.id;
        return `<button class="per-die-swatch${isSelected ? ' selected' : ''}"
          onclick="setDieSkin(${i},'${skin.id}')"
          title="${skin.name}"
          style="${skin.previewStyle || 'background:#f8f8f8;color:#111'}">${skin.preview[0]}</button>`;
      }).join('');

      const resetBtn = currentSkin
        ? `<button class="per-die-swatch reset-swatch" onclick="setDieSkin(${i},null)" title="Use global skin">↩</button>`
        : '';

      pickerHTML = `<div class="per-die-picker open">
        <div class="per-die-picker-label">Die ${selectedPerDieIndex + 1} skin — tap to assign:</div>
        <div class="per-die-swatches">${swatches}${resetBtn}</div>
      </div>`;
    }

    return `<div class="per-die-section">
      <div class="per-die-header">
        <div class="per-die-title">CUSTOMIZE EACH DICE</div>
        <button class="per-die-reset-btn" onclick="resetPerDieSkins()">Reset all</button>
      </div>
      <div class="per-die-dice-row">${diceHTML}</div>
      ${pickerHTML}
    </div>`;
  }

  function selectPerDieSlot(i) {
    selectedPerDieIndex = selectedPerDieIndex === i ? null : i;
    const container = document.getElementById('perDieContainer');
    if (container) container.innerHTML = renderPerDieSection();
  }

  function setDieSkin(dieIndex, skinId) {
    const perDie = getPerDieSkins();
    perDie[dieIndex] = skinId || null;
    setPerDieSkins(perDie);
    applyDieSkinAttributes();
    if (typeof renderDice === 'function') renderDice(false);
    const container = document.getElementById('perDieContainer');
    if (container) container.innerHTML = renderPerDieSection();
  }

  function resetPerDieSkins() {
    setPerDieSkins([null,null,null,null,null]);
    selectedPerDieIndex = null;
    applyDieSkinAttributes();
    if (typeof renderDice === 'function') renderDice(false);
    const container = document.getElementById('perDieContainer');
    if (container) container.innerHTML = renderPerDieSection();
  }

  // ─── SKIN STORE RENDER ──────────────────────────────────────────────

  function renderSkinStore() {
    const grid = document.getElementById('storeGrid');
    const creditValue = document.getElementById('storeCreditValue');
    const perDieContainer = document.getElementById('perDieContainer');
    if (!grid || !creditValue) return;

    const credits = getAvailableCredits();
    const owned = getOwnedSkins();
    const active = getActiveSkinId();
    creditValue.textContent = credits;

    if (perDieContainer) perDieContainer.innerHTML = renderPerDieSection();

    grid.innerHTML = SKINS.map(skin => {
      const isOwned = owned.includes(skin.id);
      const isActive = active === skin.id;
      const canBuy = credits >= skin.cost;
      const preview = skin.preview.map(face =>
        `<span style="${skin.previewStyle || 'background:#f8f8f8;color:#111'}">${face}</span>`
      ).join('');
      let action = '';

      if (isActive) {
        action = `<button class="skin-action equipped" disabled>✓ EQUIPPED</button>`;
      } else if (isOwned) {
        action = `<button class="skin-action" onclick="equipSkin('${skin.id}')">EQUIP</button>`;
      } else if (canBuy) {
        action = `<button class="skin-action" onclick="buySkin('${skin.id}')">UNLOCK · ${skin.cost} CREDIT${skin.cost === 1 ? '' : 'S'}</button>`;
      } else {
        action = `<button class="skin-action locked" disabled>LOCKED · NEED ${skin.cost} CREDIT${skin.cost === 1 ? '' : 'S'}</button>`;
      }

      return `<div class="skin-card ${isActive ? 'active' : ''}">
        <div class="skin-top">
          <div class="skin-name">${skin.name}</div>
          <div class="skin-cost">${skin.cost === 0 ? 'FREE' : `${skin.cost} credit${skin.cost === 1 ? '' : 's'}`}</div>
        </div>
        <div class="skin-preview">${preview}</div>
        ${action}
      </div>`;
    }).join('');
  }

  // ─── APPLY SKIN ─────────────────────────────────────────────────────

  function applySkin() {
    const skin = getActiveSkin();
    document.body.classList.remove(...SKINS.map(s => s.className));
    document.body.classList.add(skin.className);

    if (Array.isArray(window.DICE_FACES)) {
      skin.preview.forEach((face, i) => { window.DICE_FACES[i] = face; });
    } else if (typeof DICE_FACES !== 'undefined' && Array.isArray(DICE_FACES)) {
      skin.preview.forEach((face, i) => { DICE_FACES[i] = face; });
    }

    applyDieSkinAttributes();
    if (typeof renderDice === 'function') renderDice(false);
  }

  function buySkin(id) {
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return;

    const owned = getOwnedSkins();
    if (owned.includes(id)) {
      equipSkin(id);
      return;
    }

    if (getAvailableCredits() < skin.cost) {
      if (typeof showToast === 'function') showToast('Not enough credits yet 🏆');
      return;
    }

    owned.push(id);
    setOwnedSkins(owned);
    equipSkin(id);
    if (typeof showToast === 'function') showToast(`Unlocked ${skin.name}! 🎨`);
  }

  function equipSkin(id) {
    if (!SKINS.some(s => s.id === id)) return;
    if (!getOwnedSkins().includes(id)) return;
    localStorage.setItem(STORE_ACTIVE_KEY, id);
    applySkin();
    renderSkinStore();
    refreshStoreButton();
  }

  function patchAchievementsForStore() {
    if (typeof window.openAchievements === 'function' && !window.openAchievements.__storePatched) {
      const originalOpen = window.openAchievements;
      const patchedOpen = function(...args) {
        const result = originalOpen.apply(this, args);
        setTimeout(() => {
          addStoreButtonToAchievements();
          refreshStoreButton();
        }, 0);
        return result;
      };
      patchedOpen.__storePatched = true;
      window.openAchievements = patchedOpen;
    }

    if (typeof window.checkAchievements === 'function' && !window.checkAchievements.__storePatched) {
      const originalCheck = window.checkAchievements;
      const patchedCheck = function(...args) {
        const result = originalCheck.apply(this, args);
        setTimeout(refreshStoreButton, 0);
        return result;
      };
      patchedCheck.__storePatched = true;
      window.checkAchievements = patchedCheck;
    }
  }

  // ─── GLOBAL HOOKS FOR renderDice ────────────────────────────────────

  window.getDieFace = function(dieIndex, value) {
    if (value <= 0) return '–';
    const perDie = getPerDieSkins();
    const skinId = perDie[dieIndex];
    if (skinId) {
      const skin = SKINS.find(s => s.id === skinId);
      if (skin) return skin.preview[value - 1];
    }
    if (Array.isArray(window.DICE_FACES)) return window.DICE_FACES[value - 1];
    return ['⚀','⚁','⚂','⚃','⚄','⚅'][value - 1];
  };

  window.applyDieSkinAttr = function(el, dieIndex) {
    const perDie = getPerDieSkins();
    const skinId = perDie[dieIndex];
    if (skinId) {
      el.setAttribute('data-die-skin', skinId);
    } else {
      el.removeAttribute('data-die-skin');
    }
  };

  function initStore() {
    injectStoreStyles();
    ensureStoreOverlay();
    patchAchievementsForStore();
    addStoreButtonToAchievements();
    applySkin();
    refreshStoreButton();
  }

  window.openSkinStore = openSkinStore;
  window.closeSkinStore = closeSkinStore;
  window.buySkin = buySkin;
  window.equipSkin = equipSkin;
  window.selectPerDieSlot = selectPerDieSlot;
  window.setDieSkin = setDieSkin;
  window.resetPerDieSkins = resetPerDieSkins;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStore);
  } else {
    initStore();
  }
})();
