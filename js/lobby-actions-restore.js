// ─── WAITING LOBBY ACTIONS RESTORE ──────────────────────────────────
// Restores the upgraded waiting lobby card: player list, Mark Ready,
// Copy Code, Share Lobby, plus a large Share Lobby button under the card.
// This file intentionally does not touch Daily Rewards.

(function() {
  function toast(msg) {
    if (window.showToast) showToast(msg);
    else if (window.mpToast) {
      const el = document.getElementById('mpToast');
      if (el) {
        el.textContent = msg;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1800);
      }
    }
  }

  function injectStyles() {
    if (document.getElementById('lobbyActionsRestoreStyles')) return;
    const style = document.createElement('style');
    style.id = 'lobbyActionsRestoreStyles';
    style.textContent = `
      .lar-card {
        width: min(560px, 92vw);
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06);
        border-radius: 22px;
        padding: 16px;
        margin: 18px auto 12px;
        box-shadow: 0 14px 36px rgba(0,0,0,.24);
      }
      .lar-title {
        color: var(--gold);
        font-family: 'Bebas Neue', cursive;
        letter-spacing: 3px;
        font-size: 1.25rem;
        margin-bottom: 10px;
        text-align: left;
      }
      .lar-player {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(0,0,0,.18);
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 16px;
        padding: 10px 12px;
      }
      .lar-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #111;
        font-weight: 1000;
        font-size: 1.05rem;
        background: linear-gradient(135deg, var(--accent), var(--gold));
        flex: 0 0 auto;
      }
      .lar-info { flex: 1; min-width: 0; text-align: left; }
      .lar-name { color: var(--white); font-weight: 1000; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .lar-meta { color: var(--muted); font-size: .72rem; font-weight: 900; margin-top: 2px; }
      .lar-badge {
        border-radius: 999px;
        padding: 6px 10px;
        font-size: .68rem;
        font-weight: 1000;
        letter-spacing: .8px;
        border: 1px solid rgba(245,166,35,.38);
        color: var(--gold);
        background: rgba(245,166,35,.10);
      }
      .lar-badge.ready { border-color: rgba(78,205,196,.45); color: var(--green); background: rgba(78,205,196,.10); }
      .lar-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
      .lar-btn {
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.09);
        color: var(--white);
        border-radius: 999px;
        padding: 10px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 1000;
        letter-spacing: .4px;
        cursor: pointer;
        min-width: 130px;
      }
      .lar-btn.ready { border-color: rgba(78,205,196,.4); color: var(--green); background: rgba(78,205,196,.12); }
      .lar-btn.share { border-color: rgba(245,166,35,.45); color: var(--gold); background: rgba(245,166,35,.12); }
      .lar-share-large {
        width: min(460px, 78vw);
        margin: 18px auto 6px;
        border-radius: 999px;
        border: 1px solid rgba(245,166,35,.45);
        background: rgba(245,166,35,.10);
        color: var(--gold);
        padding: 13px 18px;
        font-family: Nunito, sans-serif;
        font-weight: 1000;
        letter-spacing: 1.3px;
        cursor: pointer;
        display: block;
      }
      .lar-share-hint {
        color: var(--muted);
        font-size: .74rem;
        font-weight: 900;
        margin: 0 auto 8px;
        text-align: center;
      }
    `;
    document.head.appendChild(style);
  }

  function getPlayers() {
    try {
      if (typeof allPlayers !== 'undefined' && allPlayers && Object.keys(allPlayers).length) return allPlayers;
    } catch(e) {}

    const nameInput = document.getElementById('playerName');
    const fallbackName = (nameInput && nameInput.value && nameInput.value.trim()) || 'Player';
    return {
      local: {
        name: fallbackName,
        joined: Date.now(),
        ready: false
      }
    };
  }

  function myId() {
    try { if (typeof playerId !== 'undefined' && playerId) return playerId; } catch(e) {}
    return 'local';
  }

  function hostId() {
    const players = getPlayers();
    const entries = Object.entries(players).sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0));
    return entries[0] ? entries[0][0] : myId();
  }

  function currentReady() {
    const players = getPlayers();
    const id = myId();
    return !!(players[id] && players[id].ready);
  }

  window.toggleLobbyReady = function toggleLobbyReadyRestored() {
    try {
      if (typeof roomRef !== 'undefined' && roomRef && myId()) {
        roomRef.child('players/' + myId() + '/ready').set(!currentReady());
        setTimeout(renderLobbyActions, 150);
        return;
      }
    } catch(e) {}
    toast('Ready status updates when room connection is active');
  };

  function roomCode() {
    const display = document.getElementById('displayCode');
    if (display && display.textContent) return display.textContent.trim().toUpperCase();
    const join = document.getElementById('joinCode');
    if (join && join.value) return join.value.trim().toUpperCase();
    return '';
  }

  window.copyRoomCodeUpgrade = async function copyRoomCodeUpgradeRestored() {
    const code = roomCode();
    if (!code || code.includes('-')) return;
    try {
      await navigator.clipboard.writeText(code);
      toast('Room code copied');
    } catch(e) {
      toast(code);
    }
  };

  function ensureShareLobby() {
    if (typeof window.shareLobby === 'function') return;
    window.shareLobby = async function shareLobbyFallback() {
      const code = roomCode();
      if (!code || code.includes('-')) return toast('Create a room first');
      const url = location.origin + location.pathname.replace(/index\.html$/i, '') + '?room=' + encodeURIComponent(code);
      const text = `Join my YAM IO game lobby. Room code: ${code}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: 'Join my YAM IO lobby', text, url });
          return;
        }
      } catch(e) { return; }
      try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        toast('Lobby link copied');
      } catch(e) {
        toast(url);
      }
    };
  }

  function renderLobbyActions() {
    injectStyles();
    ensureShareLobby();

    const wait = document.getElementById('waitingOverlay');
    if (!wait) return;
    const visible = wait.style.display !== 'none' && getComputedStyle(wait).display !== 'none';
    if (!visible) return;

    const playersEl = document.getElementById('waitingPlayers');
    if (!playersEl) return;

    let card = document.getElementById('lobbyActionsRestoreCard');
    if (!card) {
      card = document.createElement('div');
      card.id = 'lobbyActionsRestoreCard';
      card.className = 'lar-card';
      playersEl.insertAdjacentElement('afterend', card);
    }

    const players = getPlayers();
    const hId = hostId();
    const idMe = myId();
    const rows = Object.entries(players)
      .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
      .map(([id, p]) => {
        const name = p.name || 'Player';
        const initial = String(name).trim().charAt(0).toUpperCase() || '?';
        const isHost = id === hId;
        const isMe = id === idMe || id === 'local';
        const ready = !!p.ready;
        return `<div class="lar-player"><div class="lar-avatar">${initial}</div><div class="lar-info"><div class="lar-name">${name}${isMe ? ' · You' : ''}</div><div class="lar-meta">${isHost ? 'Host' : 'Guest'} · ${ready ? 'Ready' : 'Not ready'}</div></div><div class="lar-badge ${ready ? 'ready' : ''}">${isHost ? 'HOST' : ready ? 'READY' : 'WAIT'}</div></div>`;
      }).join('');

    card.innerHTML = `<div class="lar-title">LOBBY PLAYERS</div>${rows}<div class="lar-actions"><button class="lar-btn ready" onclick="toggleLobbyReady()">${currentReady() ? '<i class="icn icn-check"></i> Ready' : 'Mark Ready'}</button><button class="lar-btn" onclick="copyRoomCodeUpgrade()"><i class="icn icn-clipboard"></i> Copy Code</button><button class="lar-btn share" onclick="shareLobby()"><i class="icn icn-handshake"></i> Share Lobby</button></div>`;

    let shareBlock = document.getElementById('lobbyActionsLargeShareBlock');
    if (!shareBlock) {
      shareBlock = document.createElement('div');
      shareBlock.id = 'lobbyActionsLargeShareBlock';
      const modeSelector = document.getElementById('mpModeSelector');
      if (modeSelector) modeSelector.insertAdjacentElement('afterend', shareBlock);
      else card.insertAdjacentElement('afterend', shareBlock);
    }
    shareBlock.innerHTML = `<button class="lar-share-large" onclick="shareLobby()"><i class="icn icn-handshake"></i> SHARE LOBBY</button><div class="lar-share-hint">Send by Messenger, text, email, etc.</div>`;
  }

  function patchRoomFunctions() {
    ['createGame', 'joinGame', 'startGame'].forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__lobbyActionsRestorePatched) return;
      const patched = function(...args) {
        const result = original.apply(this, args);
        setTimeout(renderLobbyActions, 200);
        setTimeout(renderLobbyActions, 800);
        return result;
      };
      patched.__lobbyActionsRestorePatched = true;
      window[name] = patched;
    });
  }

  function listenPlayers() {
    try {
      if (typeof roomRef === 'undefined' || !roomRef || window.__lobbyActionsRestoreListening) return;
      window.__lobbyActionsRestoreListening = true;
      roomRef.child('players').on('value', () => setTimeout(renderLobbyActions, 0));
    } catch(e) {}
  }

  function init() {
    injectStyles();
    patchRoomFunctions();
    renderLobbyActions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    patchRoomFunctions();
    renderLobbyActions();
    listenPlayers();
  }, 500);
})();
