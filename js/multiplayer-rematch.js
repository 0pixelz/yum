// Multiplayer rematch voting — extends app.js without modifying it

let inRematchVote = false;
let myVoteCast = false;
let _rematchRef = null;

// Wrap listenRoom so every client also watches the rematch Firebase node
(function () {
  const _orig = window.listenRoom;
  window.listenRoom = function () {
    _orig();
    _setupRematchListener();
  };
})();

function _setupRematchListener() {
  if (_rematchRef || !roomRef) return;
  _rematchRef = roomRef.child('rematch');
  _rematchRef.on('value', function (snap) {
    var votes = snap.val();
    if (!votes || !mpMode) return;

    if (!inRematchVote) showRematchVoteBar();
    renderRematchVotes(votes);

    var noEntry = Object.entries(votes).find(function (e) { return e[1] === 'no'; });
    if (noEntry) {
      var name = (allPlayers[noEntry[0]] || {}).name || 'A player';
      cancelRematch(name + ' declined the rematch.');
      return;
    }

    var ids = Object.keys(allPlayers);
    if (ids.length > 0 && ids.every(function (id) { return votes[id] === 'yes'; })) {
      executeRematch();
    }
  });
}

function startRematchVote() {
  if (!roomRef) return;
  _setupRematchListener();
  showRematchVoteBar();
  roomRef.child('rematch/' + playerId).set('yes');
  myVoteCast = true;
}

function showRematchVoteBar() {
  if (inRematchVote) return;
  inRematchVote = true;
  document.getElementById('gameOverlay').classList.remove('open');
  document.getElementById('rematchVoteBar').style.display = 'block';
  renderRematchVotes({});
}

function renderRematchVotes(votes) {
  var container = document.getElementById('rvbPlayers');
  if (!container) return;
  container.innerHTML = Object.entries(allPlayers).map(function (e) {
    var id = e[0], p = e[1];
    var voted = votes[id] === 'yes';
    return '<span class="rvb-player' + (voted ? ' voted' : '') + '">' + (voted ? '✓' : '…') + ' ' + p.name + '</span>';
  }).join('');
  if (myVoteCast) {
    document.querySelectorAll('.rvb-btn').forEach(function (b) { b.disabled = true; });
  }
}

function voteRematch(yes) {
  if (!inRematchVote || myVoteCast || !roomRef) return;
  myVoteCast = true;
  document.querySelectorAll('.rvb-btn').forEach(function (b) { b.disabled = true; });
  roomRef.child('rematch/' + playerId).set(yes ? 'yes' : 'no');
}

function cancelRematch(reason) {
  if (_rematchRef) { _rematchRef.off(); _rematchRef = null; }
  inRematchVote = false;
  myVoteCast = false;
  document.getElementById('rematchVoteBar').style.display = 'none';
  if (isHost && roomRef) roomRef.child('rematch').remove();
  showToast(reason || 'Rematch cancelled');
  setTimeout(function () { leaveGame(); }, 1500);
}

function executeRematch() {
  if (_rematchRef) { _rematchRef.off(); _rematchRef = null; }
  inRematchVote = false;
  myVoteCast = false;
  document.getElementById('rematchVoteBar').style.display = 'none';

  scores = {};
  prevOpponentScores = {};
  dice = [0, 0, 0, 0, 0];
  held = [false, false, false, false, false];
  rolled = false;
  rollsLeft = 3;
  renderDice(false);
  renderScores();
  document.getElementById('rollCount').textContent = 'Rolls: 0 / 3';

  var sortedPlayers = Object.entries(allPlayers)
    .sort(function (a, b) { return a[1].joined - b[1].joined; })
    .map(function (e) { return { name: e[1].name, isMe: e[0] === playerId, id: e[0] }; });

  if (isHost && roomRef) {
    var updates = { rematch: null, currentTurn: null, firstRoll: null };
    Object.keys(allPlayers).forEach(function (id) {
      updates['players/' + id + '/scores'] = null;
      updates['players/' + id + '/liveDice'] = null;
    });
    roomRef.update(updates).then(function () {
      showFirstRoll(sortedPlayers, function (winnerId) {
        roomRef.update({ currentTurn: winnerId });
      });
    });
  } else {
    showFirstRoll(sortedPlayers, function () {});
  }
}
