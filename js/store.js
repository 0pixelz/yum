// ─── ACHIEVEMENT CREDIT STORE ────────────────────────────────────────
// Each unlocked achievement gives 1 credit. Credits can unlock dice skins.

(function() {
  const STORE_OWNED_KEY = 'yum_store_owned_skins';
  const STORE_ACTIVE_KEY = 'yum_active_dice_skin';

  const SKINS = [
    {
      id: 'classic',
      name: 'Classic White',
      cost: 0,
      preview: ['⚀','⚁','⚂','⚃','⚄','⚅'],
      className: 'skin-classic'
    },
    {
      id: 'gold',
      name: 'Gold Dice',
      cost: 1,
      preview: ['①','②','③','④','⑤','⑥'],
      className: 'skin-gold'
    },
    {
      id: 'neon',
      name: 'Neon Dice',
      cost: 1,
      preview: ['1','2','3','4','5','6'],
      className: 'skin-neon'
    },
    {
      id: 'ice',
      name: 'Ice Dice',
      cost: 1,
      preview: ['❄1','❄2','❄3','❄4','❄5','❄6'],
      className: 'skin-ice'
    },
    {
      id: 'fire',
      name: 'Fire Dice',
      cost: 2,
      preview: ['🔥1','🔥2','🔥3','🔥4','🔥5','🔥6'],
      className: 'skin-fire'
    },
    {
      id: 'galaxy',
      name: 'Galaxy Dice',
      cost: 3,
      preview: ['✦1','✦2','✦3','✦4','✦5','✦6'],
      className: 'skin-galaxy'
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
        background: var(--white);
        color: #111;
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
      body.skin-gold .die { background: linear-gradient(135deg, #fff7cc, #f5a623); color: #251400; }
      body.skin-neon .die { background: #101827; color: #4ecdc4; border: 1px solid rgba(78,205,196,0.6); box-shadow: 0 0 18px rgba(78,205,196,0.25); }
      body.skin-ice .die { background: linear-gradient(135deg, #e0f7ff, #8fd8ff); color: #06283d; }
      body.skin-fire .die { background: linear-gradient(135deg, #ffd166, #e94560); color: #180004; }
      body.skin-galaxy .die { background: radial-gradient(circle at 30% 20%, #a855f7, #0f172a 68%); color: #f8fafc; border: 1px solid rgba(168,85,247,0.7); box-shadow: 0 0 20px rgba(168,85,247,0.28); }
    `;
    document.head.appendChild(style);
  }

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
          <button class="store-close" onclick="closeSkinStore()">✕</button>
        </div>
        <div class="store-credit-box">
          <div>
            <div class="store-credit-label">1 completed achievement = 1 credit</div>
            <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">Credits are saved on this device</div>
          </div>
          <div class="store-credit-value" id="storeCreditValue">0</div>
        </div>
        <div class="store-grid" id="storeGrid"></div>
      </div>`;
    document.body.appendChild(overlay);
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
  }

  function renderSkinStore() {
    const grid = document.getElementById('storeGrid');
    const creditValue = document.getElementById('storeCreditValue');
    if (!grid || !creditValue) return;

    const credits = getAvailableCredits();
    const owned = getOwnedSkins();
    const active = getActiveSkinId();
    creditValue.textContent = credits;

    grid.innerHTML = SKINS.map(skin => {
      const isOwned = owned.includes(skin.id);
      const isActive = active === skin.id;
      const canBuy = credits >= skin.cost;
      const preview = skin.preview.map(face => `<span>${face}</span>`).join('');
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

  function applySkin() {
    const skin = getActiveSkin();
    document.body.classList.remove(...SKINS.map(s => s.className));
    document.body.classList.add(skin.className);

    if (Array.isArray(window.DICE_FACES)) {
      skin.preview.forEach((face, i) => { window.DICE_FACES[i] = face; });
    } else if (typeof DICE_FACES !== 'undefined' && Array.isArray(DICE_FACES)) {
      skin.preview.forEach((face, i) => { DICE_FACES[i] = face; });
    }

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStore);
  } else {
    initStore();
  }
})();
