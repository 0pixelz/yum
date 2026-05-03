// ─── DAILY REWARDS + MULTIPLAYER LOBBY UPGRADE ───────────────────────
// Adds a daily login reward modal and improves the waiting room lobby UI.

(function() {
  const REWARD_KEY = 'yum_daily_reward_state';
  const STORE_OWNED_KEY = 'yum_store_owned_skins';
  const DAILY_SKIN_ID = 'daily-rainbow';

  const REWARDS = [
    { day: 1, credits: 1, label: '+1 credit' },
    { day: 2, credits: 1, label: '+1 credit' },
    { day: 3, credits: 2, label: '+2 credits' },
    { day: 4, credits: 2, label: '+2 credits' },
    { day: 5, credits: 3, label: '+3 credits' },
    { day: 6, credits: 3, label: '+3 credits' },
    { day: 7, credits: 5, skin: DAILY_SKIN_ID, label: '+5 credits + rare skin' }
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getRewardState() {
    return loadJSON(REWARD_KEY, { lastClaimDate: '', streak: 0, credits: 0, claimedTotal: 0 });
  }

  function setRewardState(state) {
    saveJSON(REWARD_KEY, state);
  }

  function dateDiffDays(a, b) {
    const da = new Date(a + 'T00:00:00');
    const db = new Date(b + 'T00:00:00');
    return Math.round((db - da) / 86400000);
  }

  function addOwnedSkin(id) {
    if (!id) return;
    const owned = loadJSON(STORE_OWNED_KEY, ['classic']);
    if (!owned.includes(id)) owned.push(id);
    saveJSON(STORE_OWNED_KEY, owned);
  }

  function injectStyles() {
    if (document.getElementById('dailyRewardsLobbyStyles')) return;
    const style = document.createElement('style');
    style.id = 'dailyRewardsLobbyStyles';
    style.textContent = `
      #dailyRewardOverlay {
        position: fixed;
        inset: 0;
        z-index: 990;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.74);
        padding: 18px;
      }
      #dailyRewardOverlay.open { display: flex; }
      .dr-card {
        width: min(440px, 94vw);
        border-radius: 26px;
        border: 1px solid rgba(245,166,35,.36);
        background: linear-gradient(145deg, rgba(15,52,96,.98), rgba(22,22,62,.98));
        box-shadow: 0 24px 70px rgba(0,0,0,.58), 0 0 45px rgba(245,166,35,.14);
        padding: 18px;
        text-align: center;
      }
      .dr-title {
        font-family: 'Bebas Neue', cursive;
        font-size: 2rem;
        letter-spacing: 4px;
        color: var(--gold);
        line-height: 1;
      }
      .dr-sub { color: var(--muted); font-weight: 800; font-size: .78rem; margin: 6px 0 14px; }
      .dr-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin: 12px 0 14px; }
      .dr-day {
        border-radius: 13px;
        background: rgba(255,255,255,.07);
        border: 1px solid rgba(255,255,255,.10);
        padding: 8px 4px;
        min-height: 62px;
        display:flex;
        flex-direction:column;
        justify-content:center;
        gap:3px;
      }
      .dr-day.claimed { border-color: rgba(78,205,196,.45); background: rgba(78,205,196,.12); }
      .dr-day.today { border-color: rgba(245,166,35,.65); background: rgba(245,166,35,.15); transform: translateY(-2px); }
      .dr-num { font-family:'Bebas Neue',cursive; color:var(--white); letter-spacing:1px; font-size:1rem; }
      .dr-label { color:var(--muted); font-size:.54rem; font-weight:900; line-height:1.05; }
      .dr-day.today .dr-label { color:var(--gold); }
      .dr-claim {
        width: 100%;
        border: none;
        border-radius: 999px;
        padding: 12px 16px;
        font-family: Nunito, sans-serif;
        font-weight: 1000;
        letter-spacing: 1px;
        background: linear-gradient(135deg, var(--gold), #ffd166);
        color: #251400;
        cursor: pointer;
      }
      .dr-close {
        margin-top: 9px;
        border: none;
        background: transparent;
        color: var(--muted);
        font-weight: 900;
        padding: 8px 12px;
      }
      .daily-reward-menu-btn {
        width: min(520px, 100%);
        border: 1px solid rgba(78,205,196,.34);
        background: rgba(78,205,196,.10);
        color: var(--green);
        border-radius: 999px;
        padding: 10px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: 1px;
        cursor: pointer;
        margin-top: 8px;
      }
      .waiting-upgrade-card {
        width: min(420px, 92vw);
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.055);
        border-radius: 18px;
        padding: 12px;
        margin: 12px 0 8px;
      }
      .waiting-upgrade-title {
        color: var(--gold);
        font-family:'Bebas Neue',cursive;
        letter-spacing:2px;
        font-size:1.1rem;
        margin-bottom:8px;
      }
      .wup-player {
        display:flex;
        align-items:center;
        gap:9px;
        background: rgba(0,0,0,.18);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 14px;
        padding: 9px 10px;
        margin-top: 7px;
      }
      .wup-avatar {
        width:34px;
        height:34px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        background:linear-gradient(135deg,var(--accent),var(--gold));
        color:#111;
        font-weight:1000;
      }
      .wup-info { flex:1; min-width:0; text-align:left; }
      .wup-name { color:var(--white); font-weight:1000; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .wup-meta { color:var(--muted); font-size:.64rem; font-weight:900; margin-top:1px; }
      .wup-badge {
        border-radius:999px;
        padding:4px 8px;
        font-size:.6rem;
        font-weight:1000;
        letter-spacing:.6px;
        border:1px solid rgba(245,166,35,.36);
        color:var(--gold);
        background:rgba(245,166,35,.10);
      }
      .wup-badge.ready { border-color:rgba(78,205,196,.4); color:var(--green); background:rgba(78,205,196,.10); }
      .wup-actions { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin-top:10px; }
      .wup-btn {
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.08);
        color:var(--white);
        border-radius:999px;
        padding:8px 11px;
        font-family:Nunito,sans-serif;
        font-weight:900;
        letter-spacing:.5px;
      }
      .wup-btn.ready { border-color:rgba(78,205,196,.34); color:var(--green); background:rgba(78,205,196,.10); }
      .wup-btn.share { border-color:rgba(245,166,35,.4); color:var(--gold); background:rgba(245,166,35,.11); }
    `;
    document.head.appendChild(style);
  }

  function ensureRewardOverlay() {
    let overlay = document.getElementById('dailyRewardOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'dailyRewardOverlay';
    overlay.onclick = e => { if (e.target === overlay) closeDailyReward(); };
    document.body.appendChild(overlay);
    return overlay;
  }

  function rewardDayIndex(state) {
    return Math.min(7, Math.max(1, ((state.streak || 0) % 7) + 1));
  }

  function renderRewardOverlay(canClaim) {
    const state = getRewardState();
    const dayIndex = canClaim ? rewardDayIndex(state) : Math.min(7, Math.max(1, state.streak || 1));
    const overlay = ensureRewardOverlay();
    const grid = REWARDS.map(r => {
      const claimed = !canClaim && r.day <= dayIndex;
      const today = canClaim && r.day === dayIndex;
      return `<div class="dr-day ${claimed ? 'claimed' : ''} ${today ? 'today' : ''}"><div class="dr-num">DAY ${r.day}</div><div class="dr-label">${r.label}</div></div>`;
    }).join('');
    overlay.innerHTML = `<div class="dr-card">
      <div class="dr-title">🎁 DAILY REWARD</div>
      <div class="dr-sub">Keep your streak to unlock more credits and a rare skin on day 7.</div>
      <div class="dr-grid">${grid}</div>
      <button class="dr-claim" onclick="claimDailyReward()">${canClaim ? 'CLAIM TODAY REWARD' : 'ALREADY CLAIMED TODAY'}</button>
      <button class="dr-close" onclick="closeDailyReward()">Close</button>
    </div>`;
    const claimBtn = overlay.querySelector('.dr-claim');
    if (claimBtn && !canClaim) {
      claimBtn.disabled = true;
      claimBtn.style.opacity = '.55';
    }
  }

  function canClaimToday() {
    return getRewardState().lastClaimDate !== todayKey();
  }

  window.openDailyReward = function openDailyReward() {
    injectStyles();
    renderRewardOverlay(canClaimToday());
    ensureRewardOverlay().classList.add('open');
  };

  window.closeDailyReward = function closeDailyReward() {
    const overlay = document.getElementById('dailyRewardOverlay');
    if (overlay) overlay.classList.remove('open');
  };

  window.claimDailyReward = function claimDailyReward() {
    const state = getRewardState();
    const today = todayKey();
    if (state.lastClaimDate === today) return;

    const diff = state.lastClaimDate ? dateDiffDays(state.lastClaimDate, today) : 1;
    const newStreak = diff === 1 ? (state.streak || 0) + 1 : 1;
    const day = Math.min(7, ((newStreak - 1) % 7) + 1);
    const reward = REWARDS.find(r => r.day === day) || REWARDS[0];

    state.lastClaimDate = today;
    state.streak = newStreak;
    state.credits = (Number(state.credits) || 0) + reward.credits;
    state.claimedTotal = (Number(state.claimedTotal) || 0) + 1;
    setRewardState(state);
    if (reward.skin) addOwnedSkin(reward.skin);

    renderRewardOverlay(false);
    addDailyRewardMenuButton();
    if (window.showToast) showToast(`🎁 Claimed ${reward.label}!`);
  };

  function addDailyRewardMenuButton() {
    const lobby = document.getElementById('lobbyOverlay');
    if (!lobby) return;
    let btn = document.getElementById('dailyRewardMenuBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'dailyRewardMenuBtn';
      btn.type = 'button';
      btn.className = 'daily-reward-menu-btn';
      btn.onclick = window.openDailyReward;
      const skinBtn = document.getElementById('mainSkinStoreBtn');
      if (skinBtn) skinBtn.insertAdjacentElement('afterend', btn);
      else {
        const profileBar = document.getElementById('profileLoginBar');
        if (profileBar) profileBar.insertAdjacentElement('afterend', btn);
        else lobby.insertAdjacentElement('afterbegin', btn);
      }
    }
    const state = getRewardState();
    btn.textContent = canClaimToday()
      ? '🎁 Daily Reward Available'
      : `🎁 Daily Reward · Streak ${state.streak || 1}`;
  }

  function getPlayers() {
    try { return allPlayers || {}; } catch(e) { return {}; }
  }

  function myId() {
    try { return playerId || ''; } catch(e) { return ''; }
  }

  function hostId() {
    const players = getPlayers();
    const entries = Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
    return entries[0] ? entries[0][0] : '';
  }

  function currentReady() {
    try {
      const id = myId();
      return !!(id && getPlayers()[id] && getPlayers()[id].ready);
    } catch(e) { return false; }
  }

  window.toggleLobbyReady = function toggleLobbyReady() {
    try {
      if (!roomRef || !myId()) return;
      roomRef.child('players/' + myId() + '/ready').set(!currentReady());
    } catch(e) {}
  };

  async function copyRoomCodeUpgrade() {
    let code = '';
    const display = document.getElementById('displayCode');
    if (display) code = display.textContent.trim();
    if (!code || code.includes('-')) return;
    try {
      await navigator.clipboard.writeText(code);
      if (window.showToast) showToast('Room code copied 📋');
    } catch(e) {
      if (window.showToast) showToast(code);
    }
  }

  window.copyRoomCodeUpgrade = copyRoomCodeUpgrade;

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
    const rows = Object.entries(players)
      .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
      .map(([id, p]) => {
        const initial = String(p.name || '?').charAt(0).toUpperCase();
        const isHost = id === hId;
        const isMe = id === myId();
        const ready = !!p.ready;
        return `<div class="wup-player">
          <div class="wup-avatar">${initial}</div>
          <div class="wup-info"><div class="wup-name">${p.name || 'Player'}${isMe ? ' · You' : ''}</div><div class="wup-meta">${isHost ? 'Host' : 'Guest'} · ${ready ? 'Ready' : 'Not ready'}</div></div>
          <div class="wup-badge ${ready ? 'ready' : ''}">${isHost ? 'HOST' : ready ? 'READY' : 'WAIT'}</div>
        </div>`;
      }).join('') || '<div class="ssu-small">Waiting for players…</div>';

    card.innerHTML = `<div class="waiting-upgrade-title">LOBBY PLAYERS</div>${rows}
      <div class="wup-actions">
        <button class="wup-btn ready" onclick="toggleLobbyReady()">${currentReady() ? '✓ Ready' : 'Mark Ready'}</button>
        <button class="wup-btn" onclick="copyRoomCodeUpgrade()">📋 Copy Code</button>
        <button class="wup-btn share" onclick="shareLobby()">📤 Share Lobby</button>
      </div>`;
  }

  function patchWaitingRender() {
    ['createGame', 'joinGame', 'startGame'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__dailyLobbyPatched) return;
      const patched = function(...args) {
        const result = original.apply(this, args);
        setTimeout(renderWaitingUpgrade, 300);
        return result;
      };
      patched.__dailyLobbyPatched = true;
      window[name] = patched;
    });
  }

  function listenLobbyPlayers() {
    try {
      if (!roomRef || window.__waitingUpgradeListening) return;
      window.__waitingUpgradeListening = true;
      roomRef.child('players').on('value', () => setTimeout(renderWaitingUpgrade, 0));
    } catch(e) {}
  }

  function init() {
    injectStyles();
    ensureRewardOverlay();
    addDailyRewardMenuButton();
    patchWaitingRender();
    setTimeout(() => { if (canClaimToday()) window.openDailyReward(); }, 900);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    addDailyRewardMenuButton();
    patchWaitingRender();
    renderWaitingUpgrade();
    listenLobbyPlayers();
  }, 1200);
})();
