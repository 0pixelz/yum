// ─── MULTIPLAYER FAULT-TOLERANCE FIXES ───────────────────────────────
// Loaded after the rest of the multiplayer code so it can layer on top of
// app.js / multiplayer-rematch.js / rematch-final.js without modifying them.
//
// Fixes:
//   1. Stale rooms — when the last player leaves the room (via leaveGame OR
//      a hard disconnect), the entire room node is removed instead of being
//      orphaned in Firebase.
//   2. Graceful-leave cancels any pending onDisconnect handlers so they
//      don't fire later against the wrong room.
//   3. Turn watchdog — if the current player doesn't act within
//      TURN_TIMEOUT_MS, their turn is auto-advanced (transaction-protected
//      so concurrent watchdogs can't double-skip).
//   4. Host migration — if the recorded host is no longer in the players
//      map (e.g. host bailed in the lobby), the earliest-joined remaining
//      player claims the host slot via transaction.
//   5. Heartbeat — the local player periodically writes lastActiveAt so the
//      watchdog can distinguish "thinking" from "ghosted".

(function() {
  if (window.__yumMpFaultFixesLoaded) return;
  window.__yumMpFaultFixesLoaded = true;

  // 120s gives the per-player 60s autopick (turn-timeout.js) a comfortable
  // margin to land its score and advance currentTurn before the host watchdog
  // tries to skip the same turn. The watchdog transaction is also a no-op when
  // currentTurn has already moved, so the bump is belt-and-suspenders.
  const TURN_TIMEOUT_MS  = 120 * 1000;
  const HEARTBEAT_MS     = 15 * 1000;
  const WATCHDOG_TICK_MS = 5 * 1000;

  let hookedRef           = null;
  let roomDisconnectHandle = null;
  let turnWatchdogTimer    = null;
  let heartbeatTimer       = null;
  let watchedTurnId        = null;
  let watchedTurnStartedAt = 0;

  // app.js declares mpMode / roomRef / playerId / isHost / allPlayers /
  // currentTurnId with `let` at script scope, so they are NOT exposed on
  // window — they must be read lexically (see the matchmaking.js note on the
  // same gotcha). Reading them as window.* (as this module originally did)
  // always yielded undefined, which silently disabled the watchdog, host
  // migration and room cleanup.
  function L(read) { try { return read(); } catch (e) { return undefined; } }
  const getRoomRef      = () => L(() => (typeof roomRef      !== 'undefined') ? roomRef      : null) || null;
  const getPlayerId     = () => L(() => (typeof playerId     !== 'undefined') ? playerId     : null) || null;
  const getMpMode       = () => L(() => (typeof mpMode       !== 'undefined') ? !!mpMode     : false) || false;
  const getIsHost       = () => L(() => (typeof isHost       !== 'undefined') ? !!isHost     : false) || false;
  const getCurrentTurnId = () => L(() => (typeof currentTurnId !== 'undefined') ? currentTurnId : null) || null;
  const getAllPlayers   = () => L(() => (typeof allPlayers   !== 'undefined' && allPlayers) ? allPlayers : null) || null;

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

  // ── 1+2: room cleanup ──────────────────────────────────────────────
  function refreshRoomDisconnect() {
    if (!inRoom()) return;
    try {
      // Cancel the prior handle — we'll re-arm it based on current state.
      if (roomDisconnectHandle) {
        try { roomDisconnectHandle.cancel(); } catch(e) {}
        roomDisconnectHandle = null;
      }

      const players = getAllPlayers() || {};
      const ids = Object.keys(players);
      const aloneOrLast = ids.length <= 1 && ids[0] === getPlayerId();

      if (aloneOrLast) {
        // Last player in the room: if I drop, the whole room should go too.
        roomDisconnectHandle = getRoomRef().onDisconnect();
        roomDisconnectHandle.remove();
      }
    } catch(e) {
      console.warn('refreshRoomDisconnect failed:', e);
    }
  }

  function deleteRoomIfEmpty(ref) {
    if (!ref) return Promise.resolve();
    return ref.child('players').once('value').then(snap => {
      if (snap.numChildren() === 0) {
        return ref.remove();
      }
      return null;
    }).catch(e => console.warn('deleteRoomIfEmpty failed:', e));
  }

  // ── 3: turn watchdog ──────────────────────────────────────────────
  function startTurnWatchdog() {
    if (turnWatchdogTimer) return;
    turnWatchdogTimer = setInterval(tickTurnWatchdog, WATCHDOG_TICK_MS);
  }

  function stopTurnWatchdog() {
    if (turnWatchdogTimer) { clearInterval(turnWatchdogTimer); turnWatchdogTimer = null; }
    watchedTurnId = null;
    watchedTurnStartedAt = 0;
  }

  function lastActivityAt(playerNode) {
    if (!playerNode) return 0;
    const liveTs = (playerNode.liveDice && playerNode.liveDice.ts) || 0;
    const beat   = playerNode.lastActiveAt || 0;
    return Math.max(liveTs, beat);
  }

  function tickTurnWatchdog() {
    if (!inRoom() || !getAllPlayers()) return;
    // Only the host advances stale turns — keeps server-side rules tight
    // (currentTurn is host-or-self writeable) and avoids transaction storms.
    if (!getIsHost()) return;
    // Honor the lobby's "no timer" toggle — when disabled, never auto-skip.
    if (window.__yumTurnTimerEnabled === false) return;
    const turn = getCurrentTurnId();
    if (!turn) return;

    const players = getAllPlayers();
    const ids = Object.keys(players);
    if (ids.length < 2) return;

    if (turn !== watchedTurnId) {
      watchedTurnId = turn;
      watchedTurnStartedAt = Date.now();
      return;
    }

    const turnNode = players[turn];
    const lastAct = lastActivityAt(turnNode);
    const elapsed = Date.now() - Math.max(watchedTurnStartedAt, lastAct);
    if (elapsed < TURN_TIMEOUT_MS) return;

    // Use a transaction so two clients can't both skip the same turn.
    getRoomRef().child('currentTurn').transaction(function(curr) {
      if (curr !== turn) return undefined; // already advanced
      const order = Object.entries(getAllPlayers() || {})
        .sort(function(a, b) { return (a[1].joined || 0) - (b[1].joined || 0); })
        .map(function(e) { return e[0]; });
      const idx = order.indexOf(turn);
      if (idx < 0) return undefined;
      return order[(idx + 1) % order.length];
    }).then(function(res) {
      if (res && res.committed) {
        try { getRoomRef().child('players/' + turn + '/liveDice').remove(); } catch(e) {}
        watchedTurnStartedAt = Date.now();
        const name = (getAllPlayers()[turn] || {}).name || 'Player';
        if (typeof window.showToast === 'function') {
          var esc = (window.escapeHtml || function(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); });
          window.showToast(esc(name) + ' timed out — turn skipped');
        }
      }
    }).catch(function(){});
  }

  // ── 4: host migration ─────────────────────────────────────────────
  // Host needs to migrate in two cases:
  //   1. The host slot is no longer in the players map (hard removal).
  //   2. The host slot is still there but soft-disconnected past
  //      HOST_STALE_MS — without this, a host that drops mid-match would
  //      block the match for the full disconnect grace window.
  const HOST_STALE_MS = 20 * 1000;

  function isHostStale(data) {
    const players = getAllPlayers() || {};
    const hostId = data && data.host;
    if (!hostId) return true;                  // no host recorded
    if (!players[hostId]) return true;          // host removed
    const dAt = players[hostId].disconnectedAt;
    if (typeof dAt === 'number' && (Date.now() - dAt) > HOST_STALE_MS) return true;
    return false;
  }

  function liveCandidates(players) {
    return Object.keys(players).filter(function(id) {
      const dAt = players[id].disconnectedAt;
      // Treat a player who's been gone briefly as still eligible — only
      // strict ghosts get demoted from the candidate list.
      return !(typeof dAt === 'number' && (Date.now() - dAt) > HOST_STALE_MS);
    });
  }

  // Runs on every snapshot — both in the lobby (data.started === false) and
  // in-game. This is the only mechanism that recovers from a host that bails
  // before pressing START, so the gating must stay snapshot-driven and not
  // depend on data.started.
  function migrateHostIfNeeded(data) {
    if (!data || !inRoom()) return;
    const players = getAllPlayers() || {};
    const ids = Object.keys(players);
    if (!ids.length) return;

    if (!isHostStale(data)) return;

    const live = liveCandidates(players);
    if (!live.length) return;

    // Only the earliest-joined live player tries to claim — keeps the
    // transaction race contention low.
    const order = live.slice().sort(function(a, b) {
      return (players[a].joined || 0) - (players[b].joined || 0);
    });
    const candidate = order[0];
    if (candidate !== getPlayerId()) return;

    getRoomRef().child('host').transaction(function(curr) {
      // Someone else already migrated to a healthy host — back off.
      const cur = getAllPlayers() || {};
      if (curr && cur[curr]) {
        const dAt = cur[curr] && cur[curr].disconnectedAt;
        if (!(typeof dAt === 'number' && (Date.now() - dAt) > HOST_STALE_MS)) {
          return undefined;
        }
      }
      return getPlayerId();
    }).then(function(res) {
      if (res && res.committed) {
        // Update the lexical binding app.js gates on (host-only writes,
        // watchdog, etc.), and mirror to window for any external reader.
        try { isHost = true; } catch (e) {}
        window.isHost = true;
        if (typeof window.showToast === 'function') {
          window.showToast('You are now the host');
        }
      }
    }).catch(function(){});
  }

  // ── 5: heartbeat ──────────────────────────────────────────────────
  function startHeartbeat() {
    if (heartbeatTimer) return;
    writeHeartbeat();
    heartbeatTimer = setInterval(writeHeartbeat, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  function writeHeartbeat() {
    if (!inRoom()) return;
    try {
      getRoomRef()
        .child('players/' + getPlayerId() + '/lastActiveAt')
        .set(serverNow());
    } catch(e) {}
  }

  // ── snapshot hook ─────────────────────────────────────────────────
  function installSnapshotHook() {
    if (!inRoom()) return;
    if (hookedRef === getRoomRef()) return;

    // New roomRef detected — reset state and attach.
    hookedRef = getRoomRef();
    stopTurnWatchdog();
    stopHeartbeat();
    if (roomDisconnectHandle) {
      try { roomDisconnectHandle.cancel(); } catch(e) {}
      roomDisconnectHandle = null;
    }

    hookedRef.on('value', function(snap) {
      if (!snap || !snap.exists()) {
        if (hookedRef === getRoomRef()) {
          stopTurnWatchdog();
          stopHeartbeat();
        }
        return;
      }
      const data = snap.val() || {};
      const _players = data.players || getAllPlayers() || {};
      // Keep the lexical binding app.js shares fresh, and mirror to window for
      // any external reader.
      try { allPlayers = _players; } catch (e) {}
      getAllPlayers() = _players;
      // Expose current host id so other modules (presence sweeper) can decide
      // whether to defer cleanup work to the host.
      window.currentHostId = (typeof data.host === 'string') ? data.host : null;

      refreshRoomDisconnect();
      migrateHostIfNeeded(data);

      // Heartbeat runs in the lobby too — host migration uses lastActiveAt to
      // tell "thinking" from "ghosted", and a host that bails before
      // data.started would otherwise leave the room with stale presence data.
      startHeartbeat();

      if (data.started) {
        startTurnWatchdog();
      } else {
        stopTurnWatchdog();
      }
    });
  }

  // ── leaveGame wrapper: clean teardown + room sweep ────────────────
  const _origLeaveGame = window.leaveGame;
  window.leaveGame = function patchedLeaveGame() {
    const ref = getRoomRef();
    const myId = getPlayerId();

    stopTurnWatchdog();
    stopHeartbeat();

    if (ref && myId) {
      // Cancel scheduled onDisconnect cleanups before they can fire later.
      try { ref.child('players/' + myId).onDisconnect().cancel(); } catch(e) {}
      if (roomDisconnectHandle) {
        try { roomDisconnectHandle.cancel(); } catch(e) {}
        roomDisconnectHandle = null;
      }

      // Remove our slot, then sweep the room if nobody's left.
      ref.child('players/' + myId).remove()
        .then(function() { return deleteRoomIfEmpty(ref); })
        .catch(function() {});
    }

    hookedRef = null;
    if (typeof _origLeaveGame === 'function') {
      return _origLeaveGame.apply(this, arguments);
    }
  };

  // ── listenRoom wrapper: install our hook every time a new room is joined ──
  function wrapListenRoom() {
    if (typeof window.listenRoom !== 'function') return;
    if (window.listenRoom.__yumFaultFixWrapped) return;

    const original = window.listenRoom;
    const wrapped = function() {
      const r = original.apply(this, arguments);
      installSnapshotHook();
      return r;
    };
    wrapped.__yumFaultFixWrapped = true;
    window.listenRoom = wrapped;
  }

  // listenRoom is reassigned by other modules at load time, so re-wrap on a
  // short interval until everyone has finished registering.
  let wrapAttempts = 0;
  const wrapInterval = setInterval(function() {
    wrapListenRoom();
    if (inRoom()) installSnapshotHook();
    if (++wrapAttempts > 60) clearInterval(wrapInterval);
  }, 500);
  wrapListenRoom();
  if (inRoom()) installSnapshotHook();
})();
