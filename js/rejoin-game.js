// ─── REJOIN GAME + OPPONENT-RECONNECTING INDICATOR ──────────────────────
// Two user-facing pieces layered on top of the existing presence machinery:
//
//   (A) Rejoin popup — when a player closes the tab / browser mid-match and
//       comes back to the site, offer a "Rejoin game?" prompt that drops them
//       straight back into the room (reusing joinGame's existing rejoin path)
//       as long as the room is still in progress and an opponent is still in it.
//       The active room (code + auth uid) is mirrored to localStorage so it
//       survives a full reload / fresh container, and cleared on leave / game
//       over.
//
//   (B) "Opponent reconnecting…" banner — during the soft-disconnect grace
//       window (matched to presence-grace's GRACE_MS) the opponent's slot
//       carries a `disconnectedAt` server-timestamp. We surface that as a
//       non-blocking banner with a live countdown instead of leaving the other
//       player staring at a frozen board. If they come back the banner clears
//       (+ a "reconnected" toast); if the grace window elapses we surface the
//       existing PLAYER LEFT result.
//
// IMPORTANT: app.js declares roomRef / playerId / roomCode / playerName /
// mpMode with `let` at script scope, so they are NOT exposed on window — they
// must be read lexically (see the matchmaking.js note on the same gotcha).
// Functions like joinGame / leaveGame / showPlayerLeftPopup ARE on window.

(function () {
  if (window.__yumRejoinLoaded) return;
  window.__yumRejoinLoaded = true;

  const GRACE_MS     = 35 * 1000;        // must match presence-grace's grace window
  const STORE_KEY    = 'yum_active_room';
  const STORE_TTL_MS = 30 * 60 * 1000;   // only offer rejoin within 30 min
  const HEARTBEAT_MS = 10 * 1000;
  const POLL_MS      = 1000;

  // ── lexical global accessors (these app.js vars are `let`, not on window) ──
  function L(read) { try { return read(); } catch (e) { return undefined; } }
  const getRoomRef    = () => L(() => (typeof roomRef    !== 'undefined') ? roomRef    : null) || null;
  const getPlayerId   = () => L(() => (typeof playerId   !== 'undefined') ? playerId   : null) || null;
  const getRoomCode   = () => L(() => (typeof roomCode   !== 'undefined') ? roomCode   : null) || null;
  const getPlayerName = () => L(() => (typeof playerName !== 'undefined') ? playerName : null) || null;
  const getMpMode     = () => L(() => (typeof mpMode     !== 'undefined') ? !!mpMode   : false) || false;

  function serverNow() {
    try {
      if (window.firebase && firebase.database && firebase.database.ServerValue) {
        return firebase.database.ServerValue.TIMESTAMP;
      }
    } catch (e) {}
    return Date.now();
  }

  function esc(s) {
    const fn = window.escapeHtml || function (x) {
      return String(x == null ? '' : x)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
    return fn(s);
  }

  // ── room listener: single source of truth for started + players ──────────
  let watchedRef = null;
  let lastData   = null;

  function onRoomValue(snap) {
    lastData = (snap && snap.exists()) ? (snap.val() || null) : null;
    persistIfParticipant();
  }

  function ensureWatch() {
    const ref = getRoomRef();
    if (ref === watchedRef) return;
    if (watchedRef) { try { watchedRef.off('value', onRoomValue); } catch (e) {} }
    watchedRef = ref;
    lastData = null;
    if (ref) { try { ref.on('value', onRoomValue); } catch (e) {} }
  }

  // ── (A) persistence ──────────────────────────────────────────────────────
  function persistIfParticipant() {
    const code = getRoomCode();
    const uid  = getPlayerId();
    if (!code || !uid || !lastData) return;
    const players = lastData.players || {};
    if (!players[uid]) return; // not actually in this room's player list
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        code: code,
        uid: uid,
        name: getPlayerName() || (players[uid] && players[uid].name) || '',
        started: !!lastData.started,
        ts: Date.now()
      }));
    } catch (e) {}
  }

  function clearPersist() { try { localStorage.removeItem(STORE_KEY); } catch (e) {} }

  // Clear the saved room whenever the player intentionally leaves or the match
  // ends. Both are function declarations, so they live on window and bare
  // callers (e.g. listenRoom's leaveGame()) resolve to the wrapped version.
  function wrapClearers() {
    ['leaveGame', 'showMpGameOver'].forEach(function (name) {
      const orig = window[name];
      if (typeof orig === 'function' && !orig.__yumRejoinWrapped) {
        const wrapped = function () { clearPersist(); return orig.apply(this, arguments); };
        wrapped.__yumRejoinWrapped = true;
        window[name] = wrapped;
      }
    });
  }

  // ── (B) opponent-reconnecting banner ─────────────────────────────────────
  // Owns only the 0–GRACE_MS "reconnecting…" indicator. Once the grace window
  // elapses the presence-grace sweeper removes the stale slot, which drops the
  // player count and lets app.js's existing path show PLAYER LEFT — so this
  // module deliberately does NOT surface that result itself (avoids a
  // double-trigger).
  let banner      = null;
  let bannerFor   = null;   // playerId currently shown as reconnecting

  function ensureBanner() {
    if (banner) return banner;
    banner = document.createElement('div');
    banner.id = 'reconnectBanner';
    banner.style.cssText =
      'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:870;' +
      'display:none;align-items:center;gap:8px;max-width:92vw;' +
      'padding:9px 16px;border-radius:50px;' +
      'background:linear-gradient(135deg,#1a1a5e,#23234f);' +
      'border:1px solid rgba(245,166,35,0.45);' +
      'box-shadow:0 6px 22px rgba(0,0,0,0.45);' +
      "color:#fff;font-family:'Nunito',sans-serif;font-weight:800;font-size:0.9rem;" +
      'white-space:nowrap;';
    banner.innerHTML =
      '<i class="icn icn-refresh icn-gold" style="animation:rcbSpin 1.1s linear infinite"></i>' +
      '<span id="rcbText"></span>';
    document.body.appendChild(banner);
    if (!document.getElementById('rcbSpinStyle')) {
      const st = document.createElement('style');
      st.id = 'rcbSpinStyle';
      st.textContent = '@keyframes rcbSpin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    return banner;
  }

  function showBanner(html) {
    const b = ensureBanner();
    const t = b.querySelector('#rcbText');
    if (t) t.innerHTML = html;
    b.style.display = 'flex';
  }

  function hideBanner() {
    if (banner) banner.style.display = 'none';
    bannerFor = null;
  }

  function updateReconnectUI() {
    const uid = getPlayerId();
    if (!lastData || !uid || !lastData.started) { hideBanner(); return; }

    const players = lastData.players || {};
    const others  = Object.keys(players).filter(function (id) { return id !== uid; });

    let reconnecting = null;   // { id, secsLeft }
    others.forEach(function (id) {
      const dAt = players[id] && players[id].disconnectedAt;
      if (typeof dAt !== 'number') return;
      const elapsed = Date.now() - dAt;
      if (elapsed < GRACE_MS && !reconnecting) {
        reconnecting = { id: id, secsLeft: Math.max(1, Math.ceil((GRACE_MS - elapsed) / 1000)) };
      }
    });

    // Was showing a reconnecting opponent who is now back and live again.
    if (bannerFor && bannerFor !== (reconnecting && reconnecting.id)) {
      const back = players[bannerFor];
      if (back && typeof back.disconnectedAt !== 'number') {
        if (typeof window.showToast === 'function') {
          window.showToast('<i class="icn icn-check icn-gold"></i> ' +
            esc(back.name || 'Opponent') + ' reconnected');
        }
      }
    }

    if (reconnecting) {
      const name = (players[reconnecting.id] && players[reconnecting.id].name) || 'Opponent';
      bannerFor = reconnecting.id;
      showBanner(esc(name) + ' reconnecting… ' + reconnecting.secsLeft + 's');
    } else {
      hideBanner();
    }
  }

  // ── self heartbeat: clear my own disconnect marker once reconnected ───────
  function selfHeartbeat() {
    const ref = getRoomRef();
    const uid = getPlayerId();
    if (!ref || !uid || !lastData) return;
    if (window.yumFirebaseConnected === false) return; // offline → stale view, skip
    const me = (lastData.players || {})[uid];
    if (me && typeof me.disconnectedAt === 'number') {
      try { ref.child('players/' + uid + '/disconnectedAt').set(null).catch(function () {}); } catch (e) {}
    }
  }

  // ── (A) rejoin popup ──────────────────────────────────────────────────────
  let pending = null; // { code, uid, name }

  function buildRejoinOverlay() {
    if (document.getElementById('rejoinOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'rejoinOverlay';
    ov.style.cssText =
      'position:fixed;inset:0;z-index:895;background:rgba(0,0,0,0.85);' +
      'display:none;align-items:center;justify-content:center;padding:24px;';
    // Reuse the PLAYER LEFT card styling (.pl-box / .pl-btn*) for consistency.
    ov.innerHTML =
      '<div class="pl-box">' +
        '<span class="pl-icon"><i class="icn icn-dice icn-gold"></i></span>' +
        '<div class="pl-title">REJOIN GAME?</div>' +
        '<div class="pl-msg" id="rejoinMsg">Your match is still in progress.</div>' +
        '<div class="pl-btns">' +
          '<button class="pl-btn pl-btn-scores" id="rejoinYes"><i class="icn icn-dice"></i> REJOIN</button>' +
          '<button class="pl-btn pl-btn-lobby" id="rejoinNo"><i class="icn icn-close"></i> DISMISS</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#rejoinNo').addEventListener('click', function () { clearPersist(); hideRejoin(); });
    ov.querySelector('#rejoinYes').addEventListener('click', doRejoin);
  }

  function showRejoin(info) {
    pending = info;
    buildRejoinOverlay();
    const msg = document.getElementById('rejoinMsg');
    if (msg) msg.innerHTML = 'Your match (room <b>' + esc(info.code) + '</b>) is still in progress.';
    const ov = document.getElementById('rejoinOverlay');
    if (ov) ov.style.display = 'flex';
  }

  function hideRejoin() {
    const ov = document.getElementById('rejoinOverlay');
    if (ov) ov.style.display = 'none';
    pending = null;
  }

  function doRejoin() {
    if (!pending) { hideRejoin(); return; }
    const info = pending;
    hideRejoin();
    // Feed joinGame the room code + name it expects, then reuse its existing
    // rejoin branch (keeps scores, clears the disconnect marker).
    const nameEl = document.getElementById('playerName');
    const codeEl = document.getElementById('joinCode');
    if (nameEl && info.name) nameEl.value = info.name;
    if (codeEl) codeEl.value = info.code;
    if (typeof window.joinGame === 'function') window.joinGame();
  }

  // ── on-load: decide whether to offer a rejoin ────────────────────────────
  function waitForDb() {
    return new Promise(function (resolve) {
      let tries = 0;
      (function spin() {
        if (window.db) return resolve(window.db);
        if (typeof window.ensureFirebaseDb === 'function') { try { window.ensureFirebaseDb(); } catch (e) {} }
        if (++tries > 40) return resolve(window.db || null); // ~10s
        setTimeout(spin, 250);
      })();
    });
  }

  function waitForAuthUid() {
    return new Promise(function (resolve) {
      let settled = false;
      const done = function (u) { if (!settled) { settled = true; resolve(u && u.uid ? u.uid : null); } };
      try {
        if (typeof window.ensureFirebaseAuth === 'function') {
          window.ensureFirebaseAuth().then(done).catch(function () { done(null); });
        }
      } catch (e) {}
      setTimeout(function () { done(null); }, 8000);
    });
  }

  async function maybeOfferRejoin() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}
    if (!saved || !saved.code || !saved.uid) return;
    if (Date.now() - (saved.ts || 0) > STORE_TTL_MS) { clearPersist(); return; }
    if (getMpMode()) return; // already in a game

    const db = await waitForDb();
    if (!db) return;

    const uid = await waitForAuthUid();
    if (!uid) return;
    if (uid !== saved.uid) { clearPersist(); return; } // different account signed in

    let snap;
    try { snap = await db.ref('rooms/' + saved.code).once('value'); }
    catch (e) { return; }
    if (!snap.exists()) { clearPersist(); return; }

    const room    = snap.val() || {};
    const players = room.players || {};
    if (!room.started) { if (!players[uid]) clearPersist(); return; } // not an in-progress match

    const others = Object.keys(players).filter(function (id) { return id !== uid; });
    const liveOthers = others.filter(function (id) {
      const d = players[id] && players[id].disconnectedAt;
      return !(typeof d === 'number' && (Date.now() - d) >= GRACE_MS);
    });
    if (!liveOthers.length) { clearPersist(); return; } // opponent already gone

    if (getMpMode()) return; // re-check: we may have joined while awaiting
    let name = saved.name;
    if (!name) { try { name = localStorage.getItem('yum_last_username') || ''; } catch (e) {} }
    showRejoin({ code: saved.code, uid: uid, name: name });
  }

  // ── tick + boot ──────────────────────────────────────────────────────────
  function tick() {
    ensureWatch();
    updateReconnectUI();
  }

  function start() {
    wrapClearers();
    buildRejoinOverlay();
    setInterval(tick, POLL_MS);
    setInterval(selfHeartbeat, HEARTBEAT_MS);
    // Clear the disconnect marker the instant Firebase reports we're back, so
    // the opponent's banner resolves without waiting for the next heartbeat.
    try {
      if (window.firebase && firebase.database) {
        firebase.database().ref('.info/connected').on('value', function (s) {
          if (s && s.val() === true) selfHeartbeat();
        });
      }
    } catch (e) {}
    maybeOfferRejoin();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
