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

  // app.js declares mpMode / roomRef / playerId / isHost / allPlayers with
  // `let` at script scope, so they are NOT exposed on window — they must be
  // read lexically (see the matchmaking.js note on the same gotcha). Reading
  // them as window.* (as this module originally did) always yielded undefined,
  // which silently disabled the entire grace sweeper.
  function L(read) { try { return read(); } catch (e) { return undefined; } }
  const getRoomRef    = () => L(() => (typeof roomRef    !== 'undefined') ? roomRef    : null) || null;
  const getPlayerId   = () => L(() => (typeof playerId   !== 'undefined') ? playerId   : null) || null;
  const getMpMode     = () => L(() => (typeof mpMode     !== 'undefined') ? !!mpMode   : false) || false;
  const getIsHost     = () => L(() => (typeof isHost     !== 'undefined') ? !!isHost   : false) || false;
  const getAllPlayers = () => L(() => (typeof allPlayers !== 'undefined' && allPlayers) ? allPlayers : null) || null;

  function inRoom() {
    try { return !!(getMpMode() && getRoomRef() && getPlayerId()); }
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
      getRoomRef()
        .child('players/' + getPlayerId() + '/disconnectedAt')
        .set(null)
        .catch(function(){});
    } catch(e) {}
  }

  function rewriteOnDisconnect() {
    if (!inRoom()) return;
    try {
      const slotRef = getRoomRef().child('players/' + getPlayerId());
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

  // The sweeper is host-only in the steady state — that keeps stale-slot
  // removal to a single transaction per slot instead of N (one per client).
  // Two safety valves keep the room from stalling when the host itself is the
  // problem:
  //   • If we're offline, skip entirely. Our local view of `allPlayers` /
  //     `disconnectedAt` is stale, so any removal we'd issue is unsafe — we
  //     could cull peers who are actually fine. They'll be re-included once
  //     we reconnect and the snapshot refreshes.
  //   • If the recorded host is missing or has been gone past HOST_STALE_MS,
  //     any live client may sweep. host-migration in multiplayer-fault-fixes
  //     will promote a new host shortly after, but until then we still want
  //     stale-slot cleanup to make progress.
  const HOST_STALE_MS = 20 * 1000;

  function isLocallyConnected() {
    // window.yumFirebaseConnected is wired up in firebase-init.js via
    // .info/connected — `true` means our websocket is up.
    return window.yumFirebaseConnected === true;
  }

  function shouldThisClientSweep(players) {
    if (!isLocallyConnected()) return false;
    const hostId = (typeof window.currentHostId === 'string' && window.currentHostId)
      ? window.currentHostId
      : null;
    // Steady state: host sweeps.
    if (getIsHost() === true) return true;
    // Host vanished or is itself stale → fall back to all-clients-sweep so
    // host migration isn't a prerequisite for cleanup.
    const hostNode = hostId ? players[hostId] : null;
    if (!hostNode) return true;
    const dAt = hostNode.disconnectedAt;
    if (typeof dAt === 'number' && (Date.now() - dAt) > HOST_STALE_MS) return true;
    return false;
  }

  function sweepOnce() {
    if (!inRoom() || !getAllPlayers()) return;
    const players = getAllPlayers();
    const ids = Object.keys(players);
    if (!ids.length) return;
    if (!shouldThisClientSweep(players)) return;

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
      getRoomRef().child('players/' + id).transaction(function(curr) {
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
    if (lastRoomRef === getRoomRef()) return;
    lastRoomRef = getRoomRef();
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
        if (getRoomRef() && getPlayerId()) {
          getRoomRef().child('players/' + getPlayerId() + '/disconnectedAt')
            .onDisconnect().cancel().catch(function(){});
        }
      } catch(e) {}
      return _origLeave.apply(this, arguments);
    };
    window.leaveGame.__yumPresenceWrapped = true;
  }
})();
