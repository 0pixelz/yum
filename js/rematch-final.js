// ─── FINAL MULTIPLAYER REMATCH CONTROLLER ────────────────────────────
// One source of truth for multiplayer rematch. Loaded last so it overrides
// the older rematch implementations from app.js / first-roll.js / helper files.

(function() {
  let voteRef = null;
  let commandRef = null;
  let handledCommandId = null;
  let localVote = null;
  let originalRematch = null;

  function hasRoom() {
    try { return !!(mpMode && roomRef && playerId); } catch(e) { return false; }
  }

  function playersObj() {
    try { return allPlayers || {}; } catch(e) { return {}; }
  }

  function ids() {
    return Object.keys(playersObj());
  }

  function playerName(id) {
    const p = playersObj()[id] || {};
    return p.name || 'Player';
  }

  function sortedPlayersForFirstRoll() {
    return Object.entries(playersObj())
      .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
      .map(([id, p]) => ({ id, name: p.name || 'Player', isMe: id === playerId }));
  }

  function showBar() {
    const overlay = document.getElementById('gameOverlay');
    if (overlay) overlay.classList.remove('open');

    const bar = document.getElementById('rematchVoteBar');
    if (bar) bar.style.display = 'block';

    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.display = '';
    });
  }

  function hideBar() {
    const bar = document.getElementById('rematchVoteBar');
    if (bar) bar.style.display = 'none';
    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.display = '';
    });
  }

  function renderVotes(votes) {
    const box = document.getElementById('rvbPlayers');
    if (!box) return;
    const list = ids();
    box.innerHTML = list.map(id => {
      const vote = votes ? votes[id] : undefined;
      const label = vote === true ? '✓' : vote === false ? '✕' : '…';
      return `<div class="rvb-player ${vote !== undefined ? 'voted' : ''}">${playerName(id)} ${label}</div>`;
    }).join('');
  }

  function resetLocalBoard() {
    try { mpGameOverShown = false; } catch(e) {}
    try {
      scores = {};
      prevOpponentScores = {};
      dice = [0, 0, 0, 0, 0];
      held = [false, false, false, false, false];
      rolled = false;
      rollsLeft = 3;
      activeModal = null;
      selectedScore = null;
    } catch(e) {}

    const overlay = document.getElementById('gameOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.style.display = 'none';
    }
    hideBar();

    if (typeof closeModalEl === 'function') {
      try { closeModalEl(); } catch(e) {}
    }
    if (typeof renderDice === 'function') {
      try { renderDice(false); } catch(e) {}
    }
    if (typeof renderScores === 'function') {
      try { renderScores(); } catch(e) {}
    }

    const rollCount = document.getElementById('rollCount');
    if (rollCount) rollCount.textContent = 'Rolls: 0 / 3';
  }

  function hostWriteResetCommand() {
    if (!hasRoom()) return;
    const commandId = 'rm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const updates = {
      gameOver: null,
      firstRoll: null,
      currentTurn: null,
      status: 'playing',
      'rematch2/command': {
        id: commandId,
        createdBy: playerId,
        createdAt: Date.now()
      },
      'rematch2/votes': null,
      rematch: null,
      rematchVotes: null,
      rematchCommand: null
    };

    ids().forEach(id => {
      updates[`players/${id}/scores`] = {};
      updates[`players/${id}/liveDice`] = null;
      updates[`players/${id}/ready`] = true;
    });

    roomRef.update(updates);
  }

  function executeCommand(command) {
    if (!command || !command.id || handledCommandId === command.id) return;
    handledCommandId = command.id;
    localVote = null;

    resetLocalBoard();
    if (typeof showToast === 'function') showToast('🔄 Rematch started! Rolling for first turn…');

    const players = sortedPlayersForFirstRoll();
    setTimeout(() => {
      if (!hasRoom() || !players.length || typeof showFirstRoll !== 'function') return;
      showFirstRoll(players, function(winnerId) {
        try {
          if (isHost && roomRef && winnerId) {
            roomRef.update({ currentTurn: winnerId, status: 'playing' });
          }
        } catch(e) {}
      });
    }, 350);
  }

  function cancelRematch() {
    hideBar();
    localVote = null;
    try {
      if (isHost && roomRef) roomRef.child('rematch2').remove();
    } catch(e) {}
    if (typeof showToast === 'function') showToast('❌ Rematch cancelled');
  }

  function setupListener() {
    if (!hasRoom()) return;

    if (!voteRef) {
      voteRef = roomRef.child('rematch2/votes');
      voteRef.on('value', snap => {
        const votes = snap.val() || {};
        const list = ids();
        if (!list.length) return;

        const hasAnyVote = Object.keys(votes).length > 0;
        if (hasAnyVote) showBar();
        renderVotes(votes);

        if (list.some(id => votes[id] === false)) {
          cancelRematch();
          return;
        }

        const allYes = hasAnyVote && list.length >= 2 && list.every(id => votes[id] === true);
        if (allYes) {
          hideBar();
          if (isHost) hostWriteResetCommand();
        }
      });
    }

    if (!commandRef) {
      commandRef = roomRef.child('rematch2/command');
      commandRef.on('value', snap => executeCommand(snap.val()));
    }
  }

  function startVote() {
    if (!hasRoom()) return;
    setupListener();
    localVote = true;
    showBar();
    renderVotes({ [playerId]: true });
    roomRef.child('rematch2/votes/' + playerId).set(true);
  }

  window.startRematchVote = function startRematchVoteFinal() {
    if (hasRoom()) return startVote();
  };

  window.voteRematch = function voteRematchFinal(yes) {
    if (!hasRoom()) return;
    setupListener();
    localVote = !!yes;
    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.55';
    });
    roomRef.child('rematch2/votes/' + playerId).set(!!yes);
  };

  window.doMpRematch = function doMpRematchFinal() {
    if (!hasRoom()) return;
    startVote();
  };

  function patchRematchButton() {
    if (!originalRematch && typeof window.rematch === 'function') originalRematch = window.rematch;

    window.rematch = function rematchFinal() {
      if (hasRoom()) {
        startVote();
        return;
      }
      if (typeof originalRematch === 'function') return originalRematch.apply(this, arguments);
    };
  }

  function init() {
    patchRematchButton();
    setupListener();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    patchRematchButton();
    setupListener();
  }, 1000);
})();
