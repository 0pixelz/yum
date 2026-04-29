let firstRollPlayers = [];
let firstRollCallback = null;
let firstRollWinnerId = null;
let frResults = [];
let frMyIdx = 0;
let frMyRolled = false;

function showFirstRoll(players, onDone) {
  firstRollPlayers = players;
  firstRollCallback = onDone;
  frResults = players.map(() => null);
  frMyIdx = players.findIndex(p => p.isMe);
  frMyRolled = false;

  const container = document.getElementById('frPlayers');
  container.innerHTML = '';
  players.forEach((p, i) => {
    const col = document.createElement('div');
    col.className = 'fr-player';
    col.innerHTML = `
      <div class="fr-name">${p.name}${p.isMe?' (you)':''}</div>
      <div class="fr-die" id="frDie${i}">–</div>
      <div class="fr-score" id="frScore${i}"></div>`;
    if(i < players.length - 1) {
      const vs = document.createElement('div');
      vs.className = 'fr-vs'; vs.textContent = 'VS';
      container.appendChild(col);
      container.appendChild(vs);
    } else {
      container.appendChild(col);
    }
  });

  document.getElementById('frStatus').textContent = '';
  document.getElementById('frSub').textContent = 'Tap your die to roll!';
  document.getElementById('frBtn').style.display = 'none';

  // Make player's die tappable
  const myDie = document.getElementById('frDie' + frMyIdx);
  if(myDie) {
    myDie.style.cursor = 'pointer';
    myDie.style.border = '3px solid var(--green)';
    myDie.classList.add('tap-me');
    myDie.onclick = () => frPlayerRoll();
  }

  // In MP mode, listen for opponent rolls via Firebase
  if(mpMode && roomRef) {
    roomRef.child('firstRoll').on('value', snap => {
      const data = snap.val() || {};
      firstRollPlayers.forEach((p, i) => {
        if(!p.isMe && data[p.id] !== undefined && frResults[i] === null) {
          frResults[i] = data[p.id];
          frRevealDie(i, data[p.id]);
        }
      });
      frCheckAllRolled();
    });
  }

  const ov = document.getElementById('firstRollOverlay');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));

  // In BOT mode only: auto-roll non-human players
  // In MULTIPLAYER: every player taps their own die — results sync via Firebase
  if(!mpMode) {
    firstRollPlayers.forEach((p, i) => {
      if(!p.isMe) {
        const delay = 800 + Math.random() * 800;
        setTimeout(() => {
          if(frResults[i] !== null) return;
          const val = Math.floor(Math.random()*6)+1;
          frResults[i] = val;
          frRevealDie(i, val);
          frCheckAllRolled();
        }, delay);
      }
    });
  }
}

function frPlayerRoll() {
  if(frMyRolled) return;
  frMyRolled = true;
  const myDie = document.getElementById('frDie' + frMyIdx);
  if(myDie) {
    myDie.style.cursor = 'default';
    myDie.style.border = '';
    myDie.classList.remove('tap-me');
    myDie.onclick = null;
    myDie.classList.add('rolling');
  }
  document.getElementById('frSub').textContent = 'Rolling…';

  setTimeout(() => {
    const val = Math.floor(Math.random()*6)+1;
    frResults[frMyIdx] = val;
    // Push to Firebase for MP
    if(mpMode && roomRef) {
      roomRef.child('firstRoll/' + firstRollPlayers[frMyIdx].id).set(val);
    }
    frRevealDie(frMyIdx, val);
    frCheckAllRolled();
  }, 500);
}

function frRevealDie(i, val) {
  const die = document.getElementById('frDie' + i);
  const sc  = document.getElementById('frScore' + i);
  if(!die) return;
  die.classList.remove('rolling');
  die.textContent = FACES[val - 1];
  if(sc) sc.textContent = val;
}

function frCheckAllRolled() {
  if(frResults.some(r => r === null)) {
    // Update sub text
    const waiting = firstRollPlayers.filter((p,i) => frResults[i] === null);
    const waitingNames = waiting.filter(p=>!p.isMe).map(p=>p.name);
    if(!frMyRolled) {
      document.getElementById('frSub').textContent = mpMode
        ? 'Tap your die to roll!'
        : 'Tap your die to roll!';
    } else {
      document.getElementById('frSub').textContent = waitingNames.length
        ? 'Waiting for ' + waitingNames.join(', ') + ' to roll…'
        : 'All rolled!';
    }
    return;
  }

  // All rolled — find winner
  const max = Math.max(...frResults);
  const winners = frResults.reduce((acc,v,i) => v===max?[...acc,i]:acc, []);

  if(winners.length > 1) {
    // Show tie with dice values still visible
    document.getElementById('frStatus').textContent = '🤝 TIE!';
    document.getElementById('frSub').textContent = 'Tap your die to re-roll!';

    // Wait 2s so players can see the tied values, then reset
    setTimeout(() => {
      frResults = firstRollPlayers.map(() => null);
      frMyRolled = false;
      if(mpMode && roomRef) roomRef.child('firstRoll').remove();
      firstRollPlayers.forEach((p,i) => {
        const die = document.getElementById('frDie'+i);
        if(die) { die.classList.remove('winner','loser','rolling'); die.textContent='–'; }
        const sc = document.getElementById('frScore'+i);
        if(sc) sc.textContent='';
      });
      document.getElementById('frStatus').textContent = '🎲 ROLL AGAIN!';
      // Re-enable player die
      const myDie = document.getElementById('frDie' + frMyIdx);
      if(myDie) {
        myDie.style.cursor = 'pointer';
        myDie.style.border = '3px solid var(--green)';
        myDie.classList.add('tap-me');
        myDie.onclick = () => frPlayerRoll();
      }
      // Re-roll bots after short delay (MP players roll themselves)
      if(!mpMode) {
        firstRollPlayers.forEach((p,i) => {
          if(!p.isMe) {
            setTimeout(() => {
              const val = Math.floor(Math.random()*6)+1;
              frResults[i] = val;
              frRevealDie(i, val);
              frCheckAllRolled();
            }, 600 + Math.random()*800);
          }
        });
      }
    }, 2000);
    return;
  }

  // Winner!
  const winIdx = winners[0];
  firstRollPlayers.forEach((p,i) => {
    const die = document.getElementById('frDie'+i);
    if(die) die.classList.add(i===winIdx?'winner':'loser');
  });
  const winner = firstRollPlayers[winIdx];
  firstRollWinnerId = winner.id;
  document.getElementById('frStatus').textContent =
    winner.isMe ? '🏆 YOU GO FIRST!' : `🎲 ${winner.name} GOES FIRST!`;
  document.getElementById('frSub').textContent = '';
  const btn = document.getElementById('frBtn');
  btn.style.display = 'block';
  if(mpMode && roomRef) roomRef.child('firstRoll').remove();
}

function closeFirstRoll() {
  const ov = document.getElementById('firstRollOverlay');
  const winnerIsMe = firstRollPlayers.some(p => p.id === firstRollWinnerId && p.isMe);

  ov.classList.add('closing');
  ov.classList.remove('open');

  if(mpMode && roomRef) roomRef.child('firstRoll').off();

  // Smoothly bring the player back to the dice roller before the turn starts.
  setTimeout(() => {
    smoothFocusDiceRoller();
  }, 250);

  setTimeout(() => {
    ov.style.display = 'none';
    ov.classList.remove('closing');

    if(firstRollCallback) firstRollCallback(firstRollWinnerId);

    // If the player won the opening roll, make the transition feel like a real turn start.
    if(winnerIsMe && typeof showYourTurnPop === 'function') {
      setTimeout(() => showYourTurnPop('ROLL THE DICE'), 350);
    }
  }, 900);
}

function smoothFocusDiceRoller() {
  const diceSection = document.querySelector('.dice-section');
  if(!diceSection) return;

  diceSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  diceSection.classList.remove('focus-transition');
  void diceSection.offsetWidth; // restart animation if needed
  diceSection.classList.add('focus-transition');

  setTimeout(() => {
    diceSection.classList.remove('focus-transition');
  }, 1600);
}

// ─── API KEY MANAGEMENT ──────────────────────────────────────────────
function getApiKey() {
  return localStorage.getItem('yum_api_key') || '';
}

function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if(key) {
    localStorage.setItem('yum_api_key', key);
    document.getElementById('apiKeyWrap').classList.remove('show');
    setStatus('ok', '✅ API key saved! Try scanning again.');
  }
}

function showApiKeyPrompt() {
  const wrap = document.getElementById('apiKeyWrap');
  wrap.classList.add('show');
  const saved = getApiKey();
  if(saved) document.getElementById('apiKeyInput').value = saved;
  wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Load saved key on startup
window.addEventListener('DOMContentLoaded', () => {
  const saved = getApiKey();
  if(saved) document.getElementById('apiKeyInput').value = saved;
});


// ─── MULTIPLAYER REMATCH VOTING ──────────────────────────────────────
let rematchVoteRef = null;
let myRematchVote = null;

function startRematchVote() {
  // Push my vote request to Firebase
  if(!roomRef) return;
  myRematchVote = null;
  rematchVoteRef = roomRef.child('rematchVotes');
  // Clear old votes first
  rematchVoteRef.set({});
  // Listen for all votes
  rematchVoteRef.on('value', snap => {
    const votes = snap.val() || {};
    const playerCount = Object.keys(allPlayers).length;
    const yesVotes = Object.values(votes).filter(v=>v===true).length;
    const noVotes  = Object.values(votes).filter(v=>v===false).length;

    // Update vote bar UI
    const bar = document.getElementById('rematchVoteBar');
    bar.style.display = 'block';
    const rvbPlayers = document.getElementById('rvbPlayers');
    rvbPlayers.innerHTML = Object.entries(allPlayers).map(([id,p]) => {
      const vote = votes[id];
      const label = vote === true ? '✓' : vote === false ? '✕' : '…';
      const voted = vote !== undefined;
      return `<div class="rvb-player ${voted?'voted':''}">${p.name} ${label}</div>`;
    }).join('');

    // All voted yes → start rematch
    if(yesVotes === playerCount) {
      rematchVoteRef.off();
      rematchVoteRef.set({});
      bar.style.display = 'none';
      doMpRematch();
      return;
    }
    // Someone voted no → cancel
    if(noVotes > 0) {
      rematchVoteRef.off();
      rematchVoteRef.set({});
      bar.style.display = 'none';
      showToast('❌ Rematch cancelled — returning to lobby');
      setTimeout(leaveGame, 1500);
    }
  });
}

function voteRematch(yes) {
  if(!rematchVoteRef || myRematchVote !== null) return;
  myRematchVote = yes;
  rematchVoteRef.child(playerId).set(yes);
  if(!yes) {
    // Immediately hide my buttons
    document.querySelectorAll('.rvb-btn').forEach(b => b.style.display='none');
  }
}

function doMpRematch() {
  const updates = {};
  Object.keys(allPlayers).forEach(id => {
    updates['players/' + id + '/scores'] = {};
    updates['players/' + id + '/liveDice'] = null;
  });
  roomRef.update(updates);
  scores = {};
  rollsLeft = 3; rolled = false;
  dice = [0,0,0,0,0]; held = [false,false,false,false,false];
  renderDice(false);
  renderScores();
  document.getElementById('rollCount').textContent = 'Rolls: 0 / 3';
  showToast('🔄 Rematch! Rolling for who goes first…');
  // First roll
  const sortedPlayers = Object.entries(allPlayers)
    .sort((a,b) => a[1].joined - b[1].joined)
    .map(([id, p]) => ({ name: p.name, isMe: id === playerId, id }));
  setTimeout(() => {
    if(isHost) {
      showFirstRoll(sortedPlayers, function(winnerId) {
        roomRef.update({ currentTurn: winnerId });
      });
    } else {
      showFirstRoll(sortedPlayers, function() {});
    }
  }, 500);
}


// ─── PLAYER LEFT DETECTION ───────────────────────────────────────────
let plCountdownTimer = null;

function showPlayerLeftPopup(name) {
  document.getElementById('plMsg').textContent =
    `${name} has left the game. The match has been cancelled.`;
  document.getElementById('plCountdown').textContent = '10';
  const ov = document.getElementById('playerLeftOverlay');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));

  let secs = 10;
  if(plCountdownTimer) clearInterval(plCountdownTimer);
  plCountdownTimer = setInterval(() => {
    secs--;
    const el = document.getElementById('plCountdown');
    if(el) el.textContent = secs;
    if(secs <= 0) {
      clearInterval(plCountdownTimer);
      plGoLobby();
    }
  }, 1000);
}

function plGoLobby() {
  clearInterval(plCountdownTimer);
  const ov = document.getElementById('playerLeftOverlay');
  ov.classList.remove('open');
  ov.style.display = 'none';
  leaveGame();
}

function plViewScores() {
  clearInterval(plCountdownTimer);
  const ov = document.getElementById('playerLeftOverlay');
  ov.classList.remove('open');
  ov.style.display = 'none';
  // Build a summary from current allPlayers scores
  const players = Object.entries(allPlayers).map(([id, p]) => {
    const sc = id === playerId ? scores : (p.scores || {});
    return { name: p.name, score: calcTotal(sc), isMe: id === playerId, scores: sc };
  }).sort((a,b) => b.score - a.score);
  saveGameToSession(players);
  sessionTab = 'game' + sessionGames.length;
  openSession();
}

// Init
renderScores();
