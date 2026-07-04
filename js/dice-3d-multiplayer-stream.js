// Live 3D-roll spectating for multiplayer games.
//
// Two halves:
//  1. Broadcast — when *I* roll in 3D mode, write the current die transforms
//     (position + quaternion) to RTDB at ~15 Hz so my opponents can watch
//     the tumble in real time.
//  2. Spectate — when an opponent has the 3D toggle on and starts a roll,
//     mirror their stream into a non-interactive 3D overlay on my screen.
//
// The toggle is per-player: each player's `is3DRollEnabled()` only controls
// whether THEIR rolls broadcast. Anyone in the room sees a roller's 3D
// stream when that roller has 3D on — independent of the viewer's setting.
(function () {
  'use strict';

  const STREAM_HZ = 15;
  const STREAM_INTERVAL_MS = 1000 / STREAM_HZ;
  const ROUND = v => Math.round(v * 1000) / 1000;

  // ── Broadcast (this player rolling) ──────────────────────────────
  let lastBroadcastTs = 0;
  let broadcastActive = false;
  let broadcastN = 0;

  function inMP() {
    return typeof mpMode !== 'undefined' && mpMode &&
           typeof roomRef !== 'undefined' && roomRef &&
           typeof playerId !== 'undefined' && playerId;
  }
  function myLive3dRef() {
    return roomRef.child('players/' + playerId + '/live3d');
  }

  function onOpen(n) {
    if (!inMP()) return;
    broadcastActive = true;
    broadcastN = n | 0;
    lastBroadcastTs = 0;
    let skinId = 'classic';
    try {
      if (typeof window.getActiveDiceSkinId === 'function') {
        skinId = window.getActiveDiceSkinId();
      }
    } catch (_) {}
    let pdc = null;
    try { pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); }
    catch (_) {}
    myLive3dRef().set({
      active: true,
      n: broadcastN,
      skin: skinId,
      perDieColors: pdc,
      ph: 'open',
      ts: Date.now()
    });
  }

  function onFrame() {
    if (!inMP() || !broadcastActive) return;
    const now = Date.now();
    if (now - lastBroadcastTs < STREAM_INTERVAL_MS) return;
    const state = window.dice3DBridge && window.dice3DBridge.getMultiState();
    if (!state || !state.transforms || !state.transforms.length) return;
    lastBroadcastTs = now;
    // Flatten to a tight numeric array: [px,py,pz,qx,qy,qz,qw, ...]. 7 floats
    // per die × 5 dice = 35 floats per frame — small enough at 15 Hz.
    const flat = [];
    for (const t of state.transforms) {
      flat.push(ROUND(t.p[0]), ROUND(t.p[1]), ROUND(t.p[2]),
                ROUND(t.q[0]), ROUND(t.q[1]), ROUND(t.q[2]), ROUND(t.q[3]));
    }
    const ph = state.throwing ? 'throw'
      : state.dragging ? 'drag'
      : state.ready ? 'ready'
      : 'settle';
    // Stream which dice we're holding (values, 0 = not kept) so the opponent's
    // spectator view can show our kept dice. null when nothing is kept so the
    // opponent's kept row clears.
    const kept = Array.isArray(state.kept) && state.kept.some(v => v) ? state.kept : null;
    // Server face values (only present once the roller's resting dice were
    // re-skinned) — lets the spectator show the same final faces.
    const faces = Array.isArray(state.faces) ? state.faces : null;
    myLive3dRef().update({ f: flat, ph: ph, k: kept, v: faces, ts: now });
  }

  function onClose(closingMode) {
    if (closingMode === 'spectator') {
      // The spectator overlay closed (auto-end after roll, or user clicked
      // Hide — distinguished by onSpectatorHide). Drop our local handle.
      spectator = null;
      spectatorOpening = false;
      return;
    }
    if (!inMP()) { broadcastActive = false; return; }
    if (!broadcastActive) return;
    broadcastActive = false;
    // Mark inactive — the opponent's spectator will fade out. Use update so we
    // keep the final `ts` ordering and don't race with the liveDice write that
    // dice-3d-roll-toggle.js issues right after.
    myLive3dRef().update({ active: false, ph: 'done', ts: Date.now() });
  }

  function onSpectatorHide() {
    // User clicked the "Hide" button mid-roll. Suppress reopen until the
    // opponent's current roll ends (active=false), then resume on next roll.
    hideUntilNextActive = true;
  }

  // ── Spectate (opponent rolling) ──────────────────────────────────
  // We attach a narrow listener on `players/{turnId}/live3d` and follow whoever
  // is currently rolling. The room-level listener in app.js still owns the
  // rest of the game state; we only consume the stream node.
  let watchedRoomRef = null;
  let watchedTurnId = null;
  let liveRef = null;
  let liveHandler = null;
  let turnRef = null;
  let turnHandler = null;
  let spectator = null;        // { setFrame, setStatus, close } or null
  let spectatorOpening = false;
  let hideUntilNextActive = false;
  let lastActiveTs = 0;
  let closeTimer = null;

  function detachLiveListener() {
    if (liveRef && liveHandler) {
      try { liveRef.off('value', liveHandler); } catch (_) {}
    }
    liveRef = null;
    liveHandler = null;
  }

  function watchPlayer(oppId) {
    if (oppId === watchedTurnId) return;
    detachLiveListener();
    // Any open spectator was for the previous turn-holder; drop it so the
    // next active=true opens fresh with the new player's name and dice.
    closeSpectator(true);
    watchedTurnId = oppId;
    if (!oppId || oppId === playerId) return;
    liveRef = roomRef.child('players/' + oppId + '/live3d');
    liveHandler = function (snap) { handleLiveSnap(snap.val()); };
    liveRef.on('value', liveHandler);
  }

  function handleLiveSnap(data) {
    if (!data) {
      hideUntilNextActive = false;
      closeSpectator(false);
      return;
    }
    const isActive = !!data.active;
    if (data.ts && data.ts < lastActiveTs - 1500) return; // stale snapshot
    if (isActive) {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      lastActiveTs = data.ts || Date.now();
      if (hideUntilNextActive) return;
      if (!spectator && !spectatorOpening) {
        spectatorOpening = true;
        const n = data.n || (data.f ? Math.floor(data.f.length / 7) : 5);
        const title = (allPlayersName(watchedTurnId) || 'OPPONENT');
        const startedAt = lastActiveTs;
        window.dice3DSpectate({ count: n, title: title, status: 'Watching live…', skin: data.skin })
          .then(handle => {
            spectatorOpening = false;
            // If the opponent already settled while we were spinning up the
            // scene, skip showing a stale overlay.
            if (!handle) return;
            if (!watchedTurnId || startedAt < lastActiveTs - 4000) {
              try { handle.close(); } catch (_) {}
              return;
            }
            spectator = handle;
            if (data.f) spectator.setFrame(unflatten(data.f));
            if (data.ph) spectator.setStatus(statusText(data.ph));
            if (spectator.setKept) spectator.setKept(data.k || null);
            if (spectator.setFaces) spectator.setFaces(data.v || null);
          })
          .catch(() => { spectatorOpening = false; });
      } else if (spectator) {
        if (data.f) spectator.setFrame(unflatten(data.f));
        if (data.ph) spectator.setStatus(statusText(data.ph));
        if (spectator.setKept) spectator.setKept(data.k || null);
        if (spectator.setFaces) spectator.setFaces(data.v || null);
      }
    } else {
      // The roll is over. Re-enable spectator for the next roll (the user
      // may have hidden this one), then close after a short tail so the
      // final settled frame can render.
      hideUntilNextActive = false;
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(() => { closeSpectator(false); }, 900);
    }
  }

  function unflatten(flat) {
    const out = [];
    for (let i = 0; i + 6 < flat.length; i += 7) {
      out.push({
        p: [flat[i], flat[i+1], flat[i+2]],
        q: [flat[i+3], flat[i+4], flat[i+5], flat[i+6]]
      });
    }
    return out;
  }

  function statusText(ph) {
    switch (ph) {
      case 'open':   return 'Lining up the dice…';
      case 'ready':  return 'About to throw…';
      case 'drag':   return 'Spinning them up…';
      case 'throw':  return 'Rolling!';
      case 'settle': return 'Settling…';
      case 'done':   return 'Settled.';
      default:       return 'Watching live…';
    }
  }

  function allPlayersName(id) {
    try {
      if (typeof allPlayers !== 'undefined' && allPlayers && allPlayers[id]) {
        return allPlayers[id].name;
      }
    } catch (_) {}
    return null;
  }

  function closeSpectator(immediate) {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    spectatorOpening = false;
    const s = spectator;
    spectator = null;
    if (s) {
      try { s.close(); } catch (_) {}
    }
    if (immediate) {
      hideUntilNextActive = false;
      lastActiveTs = 0;
      detachLiveListener();
    }
  }

  function attachTurnListener() {
    if (turnRef) return;
    if (!inMP()) return;
    watchedRoomRef = roomRef;
    turnRef = roomRef.child('currentTurn');
    turnHandler = function (snap) {
      const t = snap.val();
      watchPlayer(t || null);
    };
    turnRef.on('value', turnHandler);
  }

  function detachAll() {
    if (turnRef && turnHandler) {
      try { turnRef.off('value', turnHandler); } catch (_) {}
    }
    turnRef = null;
    turnHandler = null;
    watchedTurnId = null;
    watchedRoomRef = null;
    detachLiveListener();
    closeSpectator(true);
  }

  // ── Init: hook the dice-3d-throw bridge once available, then poll for ─
  // ── multiplayer state so we attach/detach listeners as games come ─────
  // ── and go. Mirrors the retry pattern used by skin-sync.js. ───────────
  function trySetupBridge() {
    if (!window.dice3DBridge) return false;
    if (window.__yum3dStreamBridged) return true;
    window.__yum3dStreamBridged = true;
    window.dice3DBridge.setOnOpen(onOpen);
    window.dice3DBridge.setOnFrame(onFrame);
    window.dice3DBridge.setOnClose(onClose);
    if (typeof window.dice3DBridge.setOnSpectatorHide === 'function') {
      window.dice3DBridge.setOnSpectatorHide(onSpectatorHide);
    }
    return true;
  }

  function tick() {
    trySetupBridge();
    if (inMP()) {
      // (Re)attach the turn listener whenever roomRef changes (rematch, etc.)
      if (watchedRoomRef !== roomRef) {
        detachAll();
        attachTurnListener();
      }
    } else if (watchedRoomRef) {
      // Left the game — clean up listeners and any in-flight spectator.
      // The room teardown in app.js calls onDisconnect().remove() on the
      // whole player node, so our live3d sub-tree is removed by Firebase.
      detachAll();
    }
  }

  function init() {
    if (window.__yum3dStreamInit) return;
    window.__yum3dStreamInit = true;
    tick();
    // Steady poll to pick up game start / room swap / leave events.
    setInterval(tick, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
