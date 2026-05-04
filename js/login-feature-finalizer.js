// ─── LOGIN FEATURE FINALIZER ────────────────────────────────────────
// Final compatibility layer. Owns the logged-in menu buttons and restores
// the upgraded multiplayer lobby actions without loading the old reward UI.

(function() {
  const PROFILE_KEY = 'yum_google_profile';
  const ACTIVE_KEY = 'yum_active_dice_skin';
  const OWNED_KEY = 'yum_store_owned_skins';
  const COLOR_KEY = 'yum_custom_dice_color';

  const PALETTE = [
    ['white', '#f8f8f8', '#111'], ['red', '#ef4444', '#fff'], ['orange', '#f97316', '#fff'],
    ['gold', '#f5a623', '#251400'], ['green', '#22c55e', '#07130a'], ['teal', '#14b8a6', '#031817'],
    ['blue', '#3b82f6', '#fff'], ['purple', '#8b5cf6', '#fff'], ['pink', '#ec4899', '#fff'], ['black', '#111827', '#fff']
  ];
  const DOT_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  const SKINS = [
    { id:'gold', name:'Gold Dice', cost:5, style:'background:linear-gradient(135deg,#fff7cc,#f5a623);color:#251400' },
    { id:'neon', name:'Neon Dice', cost:8, style:'background:#101827;color:#4ecdc4;border:1px solid rgba(78,205,196,.6)' },
    { id:'ice', name:'Ice Dice', cost:10, style:'background:linear-gradient(135deg,#e0f7ff,#8fd8ff);color:#06283d' },
    { id:'fire', name:'Fire Dice', cost:15, style:'background:linear-gradient(135deg,#ffd166,#e94560);color:#180004' },
    { id:'galaxy', name:'Galaxy Dice', cost:25, style:'background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%);color:#f8fafc;border:1px solid rgba(168,85,247,.7)' }
  ];

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }
  function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function isLoggedIn() {
    const p = loadJSON(PROFILE_KEY, null);
    return !!(p && (p.type === 'google' || p.type === 'apple') && (p.uid || p.email));
  }
  function credits() {
    return isLoggedIn() && typeof window.getYumCredits === 'function' ? window.getYumCredits() : 0;
  }
  function spend(amount, reason) {
    return typeof window.spendYumCredits === 'function' && window.spendYumCredits(amount, reason);
  }
  function owned() {
    const list = loadJSON(OWNED_KEY, ['classic']);
    if (!list.includes('classic')) list.push('classic');
    return [...new Set(list)];
  }
  function setOwned(list) { saveJSON(OWNED_KEY, [...new Set(['classic', ...list])]); }
  function activeSkin() { return localStorage.getItem(ACTIVE_KEY) || 'classic'; }
  function colorPair() {
    const saved = localStorage.getItem(COLOR_KEY) || '#f8f8f8';
    return PALETTE.find(p => p[1].toLowerCase() === saved.toLowerCase()) || PALETTE[0];
  }
  function toast(msg) { if (window.showToast) showToast(msg); }

  function injectStyles() {
    if (document.getElementById('loginFeatureFinalizerStyles')) return;
    const s = document.createElement('style');
    s.id = 'loginFeatureFinalizerStyles';
    s.textContent = `
      #skinStoreUpgradeOverlay.final-store{z-index:995}
      .ssu-wallet-note{color:var(--muted);font-size:.72rem;font-weight:900;margin-top:2px}
      .ssu-login-lock{padding:16px;text-align:center;color:var(--muted);font-weight:900}
      .ssu-preview span{font-family:Arial, sans-serif}
      .yum-hidden-when-logged-out{display:none!important}
      .waiting-upgrade-card{width:min(420px,92vw);border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.055);border-radius:18px;padding:12px;margin:12px 0 8px}
      .waiting-upgrade-title{color:var(--gold);font-family:'Bebas Neue',cursive;letter-spacing:2px;font-size:1.1rem;margin-bottom:8px;text-align:left}
      .wup-player{display:flex;align-items:center;gap:9px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:9px 10px;margin-top:7px}
      .wup-avatar{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--accent),var(--gold));color:#111;font-weight:1000}
      .wup-info{flex:1;min-width:0;text-align:left}.wup-name{color:var(--white);font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wup-meta{color:var(--muted);font-size:.64rem;font-weight:900;margin-top:1px}
      .wup-badge{border-radius:999px;padding:4px 8px;font-size:.6rem;font-weight:1000;letter-spacing:.6px;border:1px solid rgba(245,166,35,.36);color:var(--gold);background:rgba(245,166,35,.10)}
      .wup-badge.ready{border-color:rgba(78,205,196,.4);color:var(--green);background:rgba(78,205,196,.10)}
      .wup-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px}.wup-btn{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.08);color:var(--white);border-radius:999px;padding:8px 11px;font-family:Nunito,sans-serif;font-weight:900;letter-spacing:.5px;cursor:pointer}
      .wup-btn.ready{border-color:rgba(78,205,196,.34);color:var(--green);background:rgba(78,205,196,.10)}.wup-btn.share{border-color:rgba(245,166,35,.4);color:var(--gold);background:rgba(245,166,35,.11)}
    `;
    document.head.appendChild(s);
  }

  function applyClassicColor(bg) {
    const p = PALETTE.find(x => x[1].toLowerCase() === String(bg).toLowerCase()) || PALETTE[0];
    localStorage.setItem(COLOR_KEY, p[1]);
    localStorage.setItem(ACTIVE_KEY, 'classic');
    document.documentElement.style.setProperty('--yum-custom-die-bg', p[1]);
    document.documentElement.style.setProperty('--yum-custom-die-fg', p[2]);
    try { if (typeof renderDice === 'function') renderDice(false); } catch(e) {}
  }

  window.setClassicDiceColor = function(bg) { applyClassicColor(bg); renderFinalSkinStore(); };

  window.equipSkin = function(id) {
    if (id !== 'classic' && !owned().includes(id)) return;
    localStorage.setItem(ACTIVE_KEY, id);
    document.body.classList.remove('skin-classic','skin-gold','skin-neon','skin-ice','skin-fire','skin-galaxy');
    document.body.classList.add(id === 'classic' ? 'skin-classic' : `skin-${id}`);
    try { if (typeof renderDice === 'function') renderDice(false); } catch(e) {}
    renderFinalSkinStore();
    toast(id === 'classic' ? 'Original dice equipped' : 'Skin equipped');
  };

  window.buySkin = function(id) {
    if (!isLoggedIn()) return toast('Sign in with Google or Apple to use the Skin Store');
    const skin = SKINS.find(s => s.id === id);
    if (!skin) return;
    const list = owned();
    if (list.includes(id)) return window.equipSkin(id);
    if (credits() < skin.cost) return toast(`Need ${skin.cost} credits`);
    if (!spend(skin.cost, `skin_${id}`)) return toast('Not enough credits');
    list.push(id);
    setOwned(list);
    window.equipSkin(id);
    toast(`${skin.name} unlocked!`);
  };

  function ensureStoreOverlay() {
    let overlay = document.getElementById('skinStoreUpgradeOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'skinStoreUpgradeOverlay';
      document.body.appendChild(overlay);
    }
    overlay.classList.add('final-store');
    overlay.onclick = e => { if (e.target === overlay) window.closeSkinStore(); };
    return overlay;
  }

  function renderFinalSkinStore() {
    injectStyles();
    const overlay = ensureStoreOverlay();
    if (!isLoggedIn()) {
      overlay.innerHTML = `<div class="ssu-sheet"><div class="ssu-head"><div class="ssu-title">🎨 SKIN STORE</div><button class="ssu-close" onclick="closeSkinStore()">✕</button></div><div class="ssu-login-lock">Sign in with Google or Apple to unlock the Skin Store, Daily Bonus, and Daily Challenge credits.</div></div>`;
      return;
    }
    const c = credits();
    const list = owned();
    const active = activeSkin();
    const currentColor = colorPair()[1].toLowerCase();
    const palette = PALETTE.map(([name,bg]) => `<button class="ssu-swatch ${currentColor === bg.toLowerCase() ? 'active' : ''}" title="${name}" style="background:${bg}" onclick="setClassicDiceColor('${bg}')"></button>`).join('');
    const skins = SKINS.map(skin => {
      const isOwned = list.includes(skin.id);
      const isActive = active === skin.id;
      const preview = DOT_FACES.map(face => `<span style="${skin.style}">${face}</span>`).join('');
      let action = '';
      if (isActive) action = `<button class="ssu-action active" disabled>✓ EQUIPPED</button>`;
      else if (isOwned) action = `<button class="ssu-action" onclick="equipSkin('${skin.id}')">EQUIP</button>`;
      else if (c >= skin.cost) action = `<button class="ssu-action" onclick="buySkin('${skin.id}')">UNLOCK · ${skin.cost} CREDITS</button>`;
      else action = `<button class="ssu-action locked" disabled>LOCKED · NEED ${skin.cost} CREDITS</button>`;
      return `<div class="ssu-card ${isActive ? 'active' : ''}"><div class="ssu-card-top"><div class="ssu-name">${skin.name}</div><div class="ssu-cost">${skin.cost} credits</div></div><div class="ssu-preview">${preview}</div>${action}</div>`;
    }).join('');
    overlay.innerHTML = `<div class="ssu-sheet"><div class="ssu-head"><div class="ssu-title">🎨 SKIN STORE</div><button class="ssu-close" onclick="closeSkinStore()">✕</button></div><div class="ssu-credit"><div><div class="ssu-small">Your credit wallet</div><div class="ssu-wallet-note">Earn credits from Daily Bonus and Daily Challenge</div></div><div class="ssu-credit-num" id="ssuCredits">${c}</div></div><div id="ssuContent"><div class="ssu-section"><div class="ssu-section-title">FREE ORIGINAL DICE COLOR</div><div class="ssu-small">Choose a color from the palette. This stays free.</div><div class="ssu-palette">${palette}</div><button class="ssu-action ${active === 'classic' ? 'active' : ''}" style="margin-top:10px" onclick="equipSkin('classic')">${active === 'classic' ? '✓ USING ORIGINAL DICE' : 'USE ORIGINAL DICE'}</button></div><div class="ssu-section"><div class="ssu-section-title">PREMIUM CREDIT SKINS</div><div class="ssu-skins">${skins}</div></div></div></div>`;
  }

  window.openSkinStore = function() { renderFinalSkinStore(); ensureStoreOverlay().classList.add('open'); };
  window.closeSkinStore = function() { const overlay = document.getElementById('skinStoreUpgradeOverlay'); if (overlay) overlay.classList.remove('open'); };

  const finalClaimDaily = function() {
    if (!isLoggedIn()) return toast('Sign in with Google or Apple to claim daily bonus');
    if (typeof window.addYumCredits !== 'function') return;
    const key = 'yum_daily_bonus_final_date';
    const streakKey = 'yum_daily_bonus_final_streak';
    const today = new Date().toISOString().slice(0,10);
    if (localStorage.getItem(key) === today) return toast('Daily bonus already claimed today');
    const prev = localStorage.getItem(key);
    const diff = prev ? Math.round((new Date(today + 'T00:00:00') - new Date(prev + 'T00:00:00')) / 86400000) : 1;
    const streak = diff === 1 ? (Number(localStorage.getItem(streakKey)) || 0) + 1 : 1;
    localStorage.setItem(key, today);
    localStorage.setItem(streakKey, String(streak));
    const reward = streak % 7 === 0 ? 5 : streak >= 3 ? 2 : 1;
    window.addYumCredits(reward, 'daily_bonus_final');
    toast(`🎁 Daily bonus claimed: +${reward} credits`);
    refreshButtons();
  };

  function refreshButtons() {
    const profileBar = document.getElementById('profileLoginBar');
    if (!profileBar) return;
    const oldReward = document.getElementById('dailyRewardMenuBtn');
    const oldChallenge = document.getElementById('dailyChallengeMenuBtn');
    const store = document.getElementById('mainSkinStoreBtn');
    if (!isLoggedIn()) {
      [oldReward, oldChallenge, store].forEach(el => { if (el) el.remove(); });
      const rewardOverlay = document.getElementById('dailyRewardOverlay');
      if (rewardOverlay) rewardOverlay.classList.remove('open');
      return;
    }
    let storeBtn = store;
    if (!storeBtn) {
      storeBtn = document.createElement('button');
      storeBtn.id = 'mainSkinStoreBtn';
      storeBtn.className = 'main-skin-store-btn';
      storeBtn.type = 'button';
      storeBtn.onclick = window.openSkinStore;
      profileBar.insertAdjacentElement('afterend', storeBtn);
    }
    storeBtn.textContent = `🎨 Skin Store · ${credits()} credits`;

    let bonus = document.getElementById('dailyRewardMenuBtn');
    if (!bonus) {
      bonus = document.createElement('button');
      bonus.id = 'dailyRewardMenuBtn';
      bonus.type = 'button';
      bonus.className = 'yum-login-feature-btn bonus';
      storeBtn.insertAdjacentElement('afterend', bonus);
    }
    bonus.onclick = finalClaimDaily;
    const today = new Date().toISOString().slice(0,10);
    const claimed = localStorage.getItem('yum_daily_bonus_final_date') === today;
    bonus.textContent = claimed ? `🎁 Daily Bonus Claimed · ${credits()} credits` : `🎁 Claim Daily Bonus · ${credits()} credits`;

    let challenge = document.getElementById('dailyChallengeMenuBtn');
    if (!challenge) {
      challenge = document.createElement('button');
      challenge.id = 'dailyChallengeMenuBtn';
      challenge.type = 'button';
      challenge.className = 'yum-login-feature-btn challenge';
      bonus.insertAdjacentElement('afterend', challenge);
    }
    challenge.onclick = window.openDailyChallenge;
  }

  function getPlayers() { try { return allPlayers || {}; } catch(e) { return {}; } }
  function myId() { try { return playerId || ''; } catch(e) { return ''; } }
  function hostId() {
    const players = getPlayers();
    const entries = Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
    return entries[0] ? entries[0][0] : '';
  }
  function currentReady() {
    try { const id = myId(); return !!(id && getPlayers()[id] && getPlayers()[id].ready); }
    catch(e) { return false; }
  }

  window.toggleLobbyReady = function() {
    try { if (!roomRef || !myId()) return; roomRef.child('players/' + myId() + '/ready').set(!currentReady()); }
    catch(e) {}
  };

  window.copyRoomCodeUpgrade = async function() {
    let code = '';
    const display = document.getElementById('displayCode');
    if (display) code = display.textContent.trim();
    if (!code || code.includes('-')) return;
    try { await navigator.clipboard.writeText(code); toast('Room code copied 📋'); }
    catch(e) { toast(code); }
  };

  function renderWaitingUpgrade() {
    const wait = document.getElementById('waitingOverlay');
    if (!wait || wait.style.display === 'none') return;
    let card = document.getElementById('waitingUpgradeCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'waitingUpgradeCard';
      card.className = 'waiting-upgrade-card';
      const playersEl = document.getElementById('waitingPlayers');
      if (playersEl) playersEl.insertAdjacentElement('afterend', card);
      else wait.appendChild(card);
    }
    const players = getPlayers();
    const hId = hostId();
    const rows = Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0)).map(([id, p]) => {
      const initial = String(p.name || '?').charAt(0).toUpperCase();
      const isHost = id === hId;
      const isMe = id === myId();
      const ready = !!p.ready;
      return `<div class="wup-player"><div class="wup-avatar">${initial}</div><div class="wup-info"><div class="wup-name">${p.name || 'Player'}${isMe ? ' · You' : ''}</div><div class="wup-meta">${isHost ? 'Host' : 'Guest'} · ${ready ? 'Ready' : 'Not ready'}</div></div><div class="wup-badge ${ready ? 'ready' : ''}">${isHost ? 'HOST' : ready ? 'READY' : 'WAIT'}</div></div>`;
    }).join('') || '<div class="ssu-small">Waiting for players…</div>';
    card.innerHTML = `<div class="waiting-upgrade-title">LOBBY PLAYERS</div>${rows}<div class="wup-actions"><button class="wup-btn ready" onclick="toggleLobbyReady()">${currentReady() ? '✓ Ready' : 'Mark Ready'}</button><button class="wup-btn" onclick="copyRoomCodeUpgrade()">📋 Copy Code</button><button class="wup-btn share" onclick="shareLobby()">📤 Share Lobby</button></div>`;
  }

  function patchWaitingRender() {
    ['createGame', 'joinGame', 'startGame'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__finalLobbyPatched) return;
      const patched = function(...args) {
        const result = original.apply(this, args);
        setTimeout(renderWaitingUpgrade, 300);
        return result;
      };
      patched.__finalLobbyPatched = true;
      window[name] = patched;
    });
  }

  function listenLobbyPlayers() {
    try {
      if (!roomRef || window.__finalLobbyListening) return;
      window.__finalLobbyListening = true;
      roomRef.child('players').on('value', () => setTimeout(renderWaitingUpgrade, 0));
    } catch(e) {}
  }

  function init() {
    injectStyles();
    window.claimDailyReward = finalClaimDaily;
    window.openDailyReward = finalClaimDaily;
    window.yumRefreshMenuButtons = refreshButtons;
    refreshButtons();
    patchWaitingRender();
    renderWaitingUpgrade();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    refreshButtons();
    patchWaitingRender();
    renderWaitingUpgrade();
    listenLobbyPlayers();
  }, 700);
})();
