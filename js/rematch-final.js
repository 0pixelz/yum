// ─── FINAL MULTIPLAYER REMATCH CONTROLLER ────────────────────────────
// One source of truth for multiplayer rematch. Loaded last so it overrides
// the older rematch implementations from app.js / first-roll.js / helper files.

(function() {
  let voteRef = null;
  let commandRef = null;
  let handledCommandId = null;
  let localVote = null;
  let originalRematch = null;
  let cancelling = false;
  let voteTimer = null;
  let countdownInterval = null;
  let voteCountdown = 15;

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

  function clearVoteTimer() {
    if (voteTimer) { clearTimeout(voteTimer); voteTimer = null; }
    if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
  }

  // Starts the 15-second acceptance window. When it expires, the local player's
  // vote is written as false, triggering the normal cancellation flow for all clients.
  function startVoteTimer() {
    if (voteTimer) return;
    voteCountdown = 15;
    countdownInterval = setInterval(() => {
      voteCountdown--;
      const cdEl = document.querySelector('.rvb-countdown');
      if (cdEl) cdEl.textContent = '⏱ ' + voteCountdown + 's remaining';
    }, 1000);
    voteTimer = setTimeout(() => {
      clearVoteTimer();
      if (!cancelling && hasRoom()) {
        roomRef.child('rematch2/votes/' + playerId).set(false);
      }
    }, 15000);
  }

  function showBar() {
    const overlay = document.getElementById('gameOverlay');
    if (overlay) overlay.classList.remove('open');

    const bar = document.getElementById('rematchVoteBar');
    if (bar) bar.style.display = 'block';

    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.disabled = localVote !== null;
      btn.style.opacity = localVote !== null ? '0.55' : '1';
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

  function renderVotes(votes, message) {
    const box = document.getElementById('rvbPlayers');
    if (!box) return;
    const list = ids();
    const rows = list.map(id => {
      const vote = votes ? votes[id] : undefined;
      const label = vote === true ? '✓ YES' : vote === false ? '✕ NO' : '… waiting';
      return '<div class="rvb-player ' + (vote !== undefined ? 'voted' : '') + '">' + playerName(id) + ' ' + label + '</div>';
    }).join('');
    const countdownHtml = voteTimer
      ? '<div class="rvb-player rvb-countdown" style="width:100%;margin-top:4px;color:var(--muted)">⏱ ' + voteCountdown + 's remaining</div>'
      : '';
    box.innerHTML = rows + countdownHtml + (message ? '<div class="rvb-player voted" style="width:100%;margin-top:8px">' + message + '</div>' : '');
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
      updates['players/' + id + '/scores'] = {};
      updates['players/' + id + '/liveDice'] = null;
      updates['players/' + id + '/ready'] = true;
    });

    roomRef.update(updates);
  }

  function executeCommand(command) {
    if (!command || !command.id || handledCommandId === command.id) return;
    handledCommandId = command.id;
    localVote = null;
    cancelling = false;
    clearVoteTimer();

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

  function cancelRematch(cancelledBy) {
    if (cancelling) return;
    cancelling = true;
    localVote = null;
    clearVoteTimer();

    const name = cancelledBy ? playerName(cancelledBy) : 'A player';
    const votesMsg = '❌ ' + name + ' declined — returning to lobby…';
    showBar();
    renderVotes({}, votesMsg);
    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.45';
    });

    try {
      if (isHost && roomRef) roomRef.child('rematch2').remove();
    } catch(e) {}

    if (typeof showToast === 'function') showToast(votesMsg);

    setTimeout(() => {
      hideBar();
      try { if (typeof leaveGame === 'function') leaveGame(); } catch(e) {}
    }, 2200);
  }

  function setupListener() {
    if (!hasRoom()) return;

    if (!voteRef) {
      voteRef = roomRef.child('rematch2/votes');
      voteRef.on('value', snap => {
        const votes = snap.val() || {};
        const list = ids();
        if (!list.length || cancelling) return;

        const hasAnyVote = Object.keys(votes).length > 0;
        if (hasAnyVote) {
          showBar();
          startVoteTimer();
        }
        renderVotes(votes, localVote !== null ? 'Waiting for other player…' : 'Choose YES or NO');

        const noId = list.find(id => votes[id] === false);
        if (noId) {
          cancelRematch(noId);
          return;
        }

        const allYes = hasAnyVote && list.length >= 2 && list.every(id => votes[id] === true);
        if (allYes) {
          clearVoteTimer();
          renderVotes(votes, '✅ Both players accepted — starting rematch…');
          document.querySelectorAll('.rvb-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.55';
          });
          setTimeout(() => hideBar(), 600);
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
    startVoteTimer();
    renderVotes({ [playerId]: true }, 'Waiting for other player…');
    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.55';
    });
    roomRef.child('rematch2/votes/' + playerId).set(true);
  }

  window.startRematchVote = function startRematchVoteFinal() {
    if (hasRoom()) return startVote();
  };

  window.voteRematch = function voteRematchFinal(yes) {
    if (!hasRoom()) return;
    setupListener();
    localVote = !!yes;
    showBar();
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
