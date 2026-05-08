// ─── PRESENCE GRACE WINDOW ──────────────────────────────────────────
// Soft-disconnect handling. Replaces the original
// `onDisconnect().remove()` with a `disconnectedAt` server-timestamp marker
// and runs a sweeper that only removes a slot once the player has stayed
// gone past GRACE_MS. This way a temporary network drop (subway, lockscreen,
// app backgrounded long enough for the websocket to drop) doesn't cancel
// the match instantly.
//
// On reconnect the marker is cleared by a heartbeat write so other clients
// see the player as live again.

(function() {
  if (window.__yumPresenceGraceLoaded) return;
  window.__yumPresenceGraceLoaded = true;

  const GRACE_MS         = 35 * 1000;  // grace window before actually removing
  const SWEEP_TICK_MS    = 5  * 1000;
  const HEARTBEAT_MS     = 10 * 1000;

  let sweepTimer    = null;
  let heartbeatTimer = null;
  let lastRoomRef   = null;

  function inRoom() {
    try { return !!(window.mpMode && window.roomRef && window.playerId); }
    catch(e) { return false; }
  }

  function serverNow() {
    try {
      if (window.firebase && firebase.database && firebase.database.ServerValue) {
        return firebase.database.ServerValue.TIMESTAMP;
      }
    } catch(e) {}
    return Date.now();
  }

  function clearMyDisconnect() {
    if (!inRoom()) return;
    try {
      window.roomRef
        .child('players/' + window.playerId + '/disconnectedAt')
        .set(null)
        .catch(function(){});
    } catch(e) {}
  }

  function rewriteOnDisconnect() {
    if (!inRoom()) return;
    try {
      const slotRef = window.roomRef.child('players/' + window.playerId);
      // Cancel any prior handlers from createGame/joinGame, then re-register a
      // soft-disconnect handler that just stamps disconnectedAt.
      slotRef.onDisconnect().cancel().catch(function(){});
      slotRef.child('disconnectedAt').onDisconnect().set(serverNow()).catch(function(){});
    } catch(e) {}
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    clearMyDisconnect();
    heartbeatTimer = setInterval(clearMyDisconnect, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  function startSweeper() {
    if (sweepTimer) return;
    sweepTimer = setInterval(sweepOnce, SWEEP_TICK_MS);
  }

  function stopSweeper() {
    if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
  }

  // The sweeper runs on every client; the per-player transaction makes it
  // safe — only one client wins the remove per stale slot.
  function sweepOnce() {
    if (!inRoom() || !window.allPlayers) return;
    const players = window.allPlayers;
    const ids = Object.keys(players);
    if (!ids.length) return;

    // Use the server's own time-of-last-write as the reference. We
    // approximate "now" with Date.now(); the disconnectedAt was written via
    // ServerValue.TIMESTAMP, so client clock skew is bounded by the round
    // trip, which is fine for a 35s grace window.
    const now = Date.now();

    ids.forEach(function(id) {
      const p = players[id] || {};
      const dAt = p.disconnectedAt;
      if (!dAt || typeof dAt !== 'number') return;
      const elapsed = now - dAt;
      if (elapsed < GRACE_MS) return;

      // Race-safe removal: transaction reads current state and removes only
      // if the player is still flagged disconnected (and past the window).
      window.roomRef.child('players/' + id).transaction(function(curr) {
        if (!curr) return undefined;          // already gone
        if (!curr.disconnectedAt) return undefined; // came back
        if ((Date.now() - curr.disconnectedAt) < GRACE_MS) return undefined;
        return null; // remove
      }).catch(function(){});
    });
  }

  function reattachIfNeeded() {
    if (!inRoom()) {
      stopSweeper();
      stopHeartbeat();
      lastRoomRef = null;
      return;
    }
    if (lastRoomRef === window.roomRef) return;
    lastRoomRef = window.roomRef;
    rewriteOnDisconnect();
    startHeartbeat();
    startSweeper();
  }

  // Re-attach on every value snapshot (other code may swap roomRef).
  // Polling is cheap and guarantees we hook every new room.
  setInterval(reattachIfNeeded, 1000);

  // Also clear the disconnect marker as soon as Firebase reports we're
  // reconnected so other clients see us live again without waiting for the
  // next heartbeat.
  try {
    if (window.firebase && firebase.database) {
      firebase.database().ref('.info/connected').on('value', function(snap) {
        if (snap.val() === true && inRoom()) {
          clearMyDisconnect();
          rewriteOnDisconnect();
        }
      });
    }
  } catch(e) {}

  // Cancel handlers on graceful leave (in addition to the cancel inside
  // leaveGame itself, which guards the unhappy path of stale refs).
  const _origLeave = window.leaveGame;
  if (typeof _origLeave === 'function' && !_origLeave.__yumPresenceWrapped) {
    window.leaveGame = function presenceWrappedLeave() {
      stopSweeper();
      stopHeartbeat();
      try {
        if (window.roomRef && window.playerId) {
          window.roomRef.child('players/' + window.playerId + '/disconnectedAt')
            .onDisconnect().cancel().catch(function(){});
        }
      } catch(e) {}
      return _origLeave.apply(this, arguments);
    };
    window.leaveGame.__yumPresenceWrapped = true;
  }
})();
