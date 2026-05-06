// ─── DAILY REWARDS + MULTIPLAYER LOBBY UPGRADE ───────────────────────
// Keeps the upgraded waiting lobby, but daily rewards are strictly gated:
// no Google / Apple login = no reward button, no modal, no flashing.

(function() {
  const PROFILE_KEY = 'yum_google_profile';

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function isLoggedInUser() {
    const p = loadJSON(PROFILE_KEY, null);
    return !!(p && (p.type === 'google' || p.type === 'apple') && (p.uid || p.email));
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

  function closeLegacyRewardOverlay() {
    const overlay = document.getElementById('dailyRewardOverlay');
    if (overlay) overlay.classList.remove('open');
  }

  function removeLegacyRewardButtonIfSignedOut() {
    if (isLoggedInUser()) return;
    const btn = document.getElementById('dailyRewardMenuBtn');
    if (btn) btn.remove();
    closeLegacyRewardOverlay();
  }

  // This file used to own daily rewards. The newer login-feature-finalizer.js
  // owns rewards now. These wrappers prevent old auto-open behavior.
  const oldOpenDailyReward = window.openDailyReward;
  window.openDailyReward = function() {
    if (!isLoggedInUser()) {
      closeLegacyRewardOverlay();
      return;
    }
    if (typeof oldOpenDailyReward === 'function' && oldOpenDailyReward !== window.openDailyReward) {
      return oldOpenDailyReward.apply(this, arguments);
    }
  };

  const oldClaimDailyReward = window.claimDailyReward;
  window.claimDailyReward = function() {
    if (!isLoggedInUser()) {
      closeLegacyRewardOverlay();
      if (window.showToast) showToast('Sign in with Google or Apple to claim daily bonus');
      return;
    }
    if (typeof oldClaimDailyReward === 'function' && oldClaimDailyReward !== window.claimDailyReward) {
      return oldClaimDailyReward.apply(this, arguments);
    }
  };

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
      if (window.showToast) showToast('Room code copied');
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
        <button class="wup-btn ready" onclick="toggleLobbyReady()">${currentReady() ? '<i class="icn icn-check"></i> Ready' : 'Mark Ready'}</button>
        <button class="wup-btn" onclick="copyRoomCodeUpgrade()"><i class="icn icn-clipboard"></i> Copy Code</button>
        <button class="wup-btn share" onclick="shareLobby()"><i class="icn icn-handshake"></i> Share Lobby</button>
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
    removeLegacyRewardButtonIfSignedOut();
    patchWaitingRender();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    removeLegacyRewardButtonIfSignedOut();
    patchWaitingRender();
    renderWaitingUpgrade();
    listenLobbyPlayers();
  }, 800);
})();
