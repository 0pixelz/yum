// ─── MULTIPLAYER REMATCH SYNC FIX ────────────────────────────────────
// Makes rematch/restart reset correctly for every player in the room.
// This overrides the older rematch functions from js/first-roll.js.

(function() {
  let rematchVoteRefLocal = null;
  let rematchCommandRefLocal = null;
  let handledRematchId = null;

  function safePlayers() {
    try { return allPlayers || {}; } catch(e) { return {}; }
  }

  function playerIds() {
    return Object.keys(safePlayers());
  }

  function sortedFirstRollPlayers() {
    return Object.entries(safePlayers())
      .sort((a, b) => (a[1].joined || 0) - (b[1].joined || 0))
      .map(([id, p]) => ({ id, name: p.name || 'Player', isMe: id === playerId }));
  }

  function hideEndGameUi() {
    const gameOverlay = document.getElementById('gameOverlay');
    if (gameOverlay) {
      gameOverlay.classList.remove('open');
      gameOverlay.style.display = 'none';
    }

    const voteBar = document.getElementById('rematchVoteBar');
    if (voteBar) voteBar.style.display = 'none';

    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.style.display = '';
      btn.disabled = false;
    });
  }

  function resetLocalBoardForRematch() {
    scores = {};
    dice = [0, 0, 0, 0, 0];
    held = [false, false, false, false, false];
    rolled = false;
    rollsLeft = 3;
    activeModal = null;
    selectedScore = null;

    hideEndGameUi();
    if (typeof closeModalEl === 'function') closeModalEl();
    if (typeof renderDice === 'function') renderDice(false);
    if (typeof renderScores === 'function') renderScores();

    const rollCount = document.getElementById('rollCount');
    if (rollCount) rollCount.textContent = 'Rolls: 0 / 3';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function writeRoomReset(rematchId) {
    if (!roomRef) return;

    const updates = {
      rematchVotes: null,
      firstRoll: null,
      gameOver: null,
      status: 'playing',
      currentTurn: null,
      rematchCommand: {
        id: rematchId,
        createdBy: playerId,
        createdAt: Date.now()
      }
    };

    playerIds().forEach(id => {
      updates[`players/${id}/scores`] = {};
      updates[`players/${id}/liveDice`] = null;
      updates[`players/${id}/ready`] = true;
    });

    roomRef.update(updates);
  }

  function beginSyncedRematch(rematchId) {
    if (!rematchId || handledRematchId === rematchId) return;
    handledRematchId = rematchId;

    resetLocalBoardForRematch();
    if (typeof showToast === 'function') showToast('🔄 Rematch! Rolling for who goes first…');

    const players = sortedFirstRollPlayers();
    setTimeout(() => {
      if (!players.length) return;
      showFirstRoll(players, function(winnerId) {
        if (isHost && roomRef && winnerId) {
          roomRef.update({ currentTurn: winnerId, status: 'playing' });
        }
      });
    }, 450);
  }

  function ensureRematchCommandListener() {
    if (!roomRef || rematchCommandRefLocal) return;
    rematchCommandRefLocal = roomRef.child('rematchCommand');
    rematchCommandRefLocal.on('value', snap => {
      const cmd = snap.val();
      if (cmd && cmd.id) beginSyncedRematch(cmd.id);
    });
  }

  window.startRematchVote = function startRematchVote() {
    if (!roomRef) return;

    ensureRematchCommandListener();
    myRematchVote = null;
    rematchVoteRef = roomRef.child('rematchVotes');
    rematchVoteRefLocal = rematchVoteRef;

    const bar = document.getElementById('rematchVoteBar');
    if (bar) bar.style.display = 'block';
    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.style.display = '';
      btn.disabled = false;
    });

    rematchVoteRef.off();
    rematchVoteRef.on('value', snap => {
      const votes = snap.val() || {};
      const ids = playerIds();
      const total = ids.length;
      const yesVotes = ids.filter(id => votes[id] === true).length;
      const noVotes = ids.filter(id => votes[id] === false).length;

      const rvbPlayers = document.getElementById('rvbPlayers');
      if (rvbPlayers) {
        rvbPlayers.innerHTML = ids.map(id => {
          const p = safePlayers()[id] || {};
          const vote = votes[id];
          const label = vote === true ? '✓' : vote === false ? '✕' : '…';
          const voted = vote !== undefined;
          return `<div class="rvb-player ${voted ? 'voted' : ''}">${p.name || 'Player'} ${label}</div>`;
        }).join('');
      }

      if (noVotes > 0) {
        rematchVoteRef.off();
        roomRef.child('rematchVotes').remove();
        if (bar) bar.style.display = 'none';
        if (typeof showToast === 'function') showToast('❌ Rematch cancelled — returning to lobby');
        setTimeout(() => typeof leaveGame === 'function' && leaveGame(), 1200);
        return;
      }

      if (total > 0 && yesVotes === total) {
        rematchVoteRef.off();
        if (bar) bar.style.display = 'none';

        // Only host writes the reset command. Everyone listens and resets from that command.
        if (isHost) {
          const rematchId = 'rematch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
          writeRoomReset(rematchId);
        }
      }
    });
  };

  window.voteRematch = function voteRematch(yes) {
    if (!roomRef) return;
    if (!rematchVoteRef) {
      rematchVoteRef = roomRef.child('rematchVotes');
      rematchVoteRefLocal = rematchVoteRef;
    }
    myRematchVote = yes;
    rematchVoteRef.child(playerId).set(!!yes);

    document.querySelectorAll('.rvb-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.55';
    });
  };

  window.doMpRematch = function doMpRematch() {
    if (!roomRef) return;
    ensureRematchCommandListener();

    if (isHost) {
      const rematchId = 'rematch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      writeRoomReset(rematchId);
    } else {
      startRematchVote();
      voteRematch(true);
    }
  };

  function initRematchFix() {
    ensureRematchCommandListener();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRematchFix);
  } else {
    initRematchFix();
  }
})();
