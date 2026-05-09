// ─── 1V1 MATCHMAKING ─────────────────────────────────────────────────
// Uses two Firebase nodes:
//   /matchmaking/queue/$uid   — players who tapped "Find Match" and are waiting
//   /matchmaking/offers/$uid  — pending match invitations addressed to $uid
//
// Flow:
//   1. Newcomer reads the queue and tries to claim the oldest waiter via a
//      transaction on /matchmaking/offers/$waiterUid (write only if empty).
//   2. On success the newcomer becomes the host: createGame() spins up a room,
//      then the room code is written into the offer.
//   3. The waiter is listening on /matchmaking/offers/$myUid; once roomCode
//      appears it calls joinGame().
//   4. Host auto-starts the match when the second player is in the room.

(function () {
  'use strict';

  const QUEUE_PATH         = 'matchmaking/queue';
  const OFFERS_PATH        = 'matchmaking/offers';
  const STALE_MS           = 90 * 1000;        // queue entries older than this are ignored
  const SEARCH_TIMEOUT_MS  = 5 * 60 * 1000;    // give up after 5 minutes
  const AUTO_START_DELAY_MS = 1500;            // small delay so opponent UI settles

  let mmActive = false;
  let mmRole   = null;            // 'seeker' | 'waiter' | null
  let mmDb     = null;
  let mmUid    = null;
  let mmName   = null;
  let mmMode   = 'normal';        // 'normal' | 'powerup'
  let mmOfferRef = null;
  let mmOfferListener = null;
  let mmRoomRef = null;
  let mmRoomListener = null;
  let mmQueueCountRef = null;
  let mmQueueCountListener = null;
  let mmTimeoutTimer = null;
  let mmAutoStartScheduled = false;
  let mmStartTs = 0;
  let mmElapsedTimer = null;

  function el(id) { return document.getElementById(id); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function showSearchOverlay() {
    const o = el('mmSearchOverlay');
    if (o) o.classList.add('mm-show');
  }

  function hideSearchOverlay() {
    const o = el('mmSearchOverlay');
    if (o) o.classList.remove('mm-show');
  }

  function setSearchText(title, subHtml) {
    const t = el('mmSearchTitle');
    const s = el('mmSearchSub');
    if (title && t) t.textContent = title;
    if (subHtml != null && s) s.innerHTML = subHtml;
  }

  function setModeBadge(mode) {
    const badge = el('mmModeBadge');
    const text  = el('mmModeBadgeText');
    if (!badge || !text) return;
    if (mode === 'powerup') {
      badge.classList.add('mm-mode-powerup');
      badge.innerHTML = '<i class="icn icn-bolt"></i> <span id="mmModeBadgeText">POWER-UP 1V1</span>';
    } else {
      badge.classList.remove('mm-mode-powerup');
      badge.innerHTML = '<i class="icn icn-gamepad"></i> <span id="mmModeBadgeText">CLASSIC 1V1</span>';
    }
  }

  function setMyName(name) {
    const n = el('mmMyName');
    if (n) n.textContent = name || 'You';
  }

  function resetOpponentCard() {
    const card = el('mmOppCard');
    const name = el('mmOppName');
    if (card) card.classList.remove('mm-found');
    if (card) {
      const tag = card.querySelector('.mm-card-tag');
      if (tag) {
        tag.textContent = 'WAITING';
        tag.classList.add('mm-card-tag-pending');
      }
      const av = card.querySelector('.mm-card-avatar');
      if (av) {
        av.classList.add('mm-card-avatar-mystery');
        av.innerHTML = '<span class="mm-q">?</span>';
      }
    }
    if (name) name.textContent = 'Searching…';
  }

  function revealOpponent(oppName) {
    const card = el('mmOppCard');
    const name = el('mmOppName');
    if (card) {
      card.classList.add('mm-found');
      const tag = card.querySelector('.mm-card-tag');
      if (tag) {
        tag.textContent = 'FOUND';
        tag.classList.remove('mm-card-tag-pending');
      }
      const av = card.querySelector('.mm-card-avatar');
      if (av) {
        av.classList.remove('mm-card-avatar-mystery');
        av.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#yum-mark"/></svg>';
      }
    }
    if (name) name.textContent = oppName || 'Opponent';
  }

  function fmtElapsed(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return mm + ':' + (ss < 10 ? '0' : '') + ss;
  }

  function startElapsedTicker() {
    stopElapsedTicker();
    mmStartTs = Date.now();
    const tick = () => {
      const e = el('mmElapsed');
      if (e) e.textContent = fmtElapsed(Date.now() - mmStartTs);
    };
    tick();
    mmElapsedTimer = setInterval(tick, 1000);
  }

  function stopElapsedTicker() {
    if (mmElapsedTimer) { clearInterval(mmElapsedTimer); mmElapsedTimer = null; }
  }

  function lobbyErr(msg) {
    if (typeof window.showLobbyErr === 'function') {
      window.showLobbyErr(msg);
      return;
    }
    const e = el('lobbyErr');
    if (e) e.textContent = msg;
  }

  function getLobbyName() {
    if (typeof window.getLobbyName === 'function') return window.getLobbyName();
    const v = el('playerName');
    return (v && v.value && v.value.trim()) || null;
  }

  async function ensureDb() {
    if (window.db) return window.db;
    if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    for (let i = 0; i < 12 && !window.db; i++) {
      await new Promise(r => setTimeout(r, 250));
      if (typeof window.ensureFirebaseDb === 'function') window.ensureFirebaseDb();
    }
    return window.db || null;
  }

  async function ensureAuth() {
    if (typeof window.ensureFirebaseAuth !== 'function') return null;
    try {
      return await Promise.race([
        window.ensureFirebaseAuth(),
        new Promise(r => setTimeout(() => r(null), 7000))
      ]);
    } catch (e) { return null; }
  }

  async function findMatch(mode) {
    if (mmActive) return;

    const name = getLobbyName();
    if (!name) return;

    const chosenMode = (mode === 'powerup') ? 'powerup' : 'normal';

    lobbyErr('<i class="icn icn-dice"></i> Connecting…');

    const db = await ensureDb();
    if (!db) {
      lobbyErr('Multiplayer not available — check your internet and reload.');
      return;
    }
    const user = await ensureAuth();
    if (!user) {
      lobbyErr('Sign-in failed — check your internet and reload.');
      return;
    }

    mmDb     = db;
    mmUid    = user.uid;
    mmName   = name;
    mmMode   = chosenMode;
    mmActive = true;
    mmRole   = null;
    mmAutoStartScheduled = false;

    const modeLabel = chosenMode === 'powerup' ? 'Power-Up' : 'Classic';
    setSearchText('LOOKING FOR PLAYER',
      'Searching for a ' + modeLabel + ' opponent<span class="mm-dots"><span>.</span><span>.</span><span>.</span></span>');
    setModeBadge(chosenMode);
    setMyName(name);
    resetOpponentCard();
    startElapsedTicker();
    showSearchOverlay();
    lobbyErr('');

    const lobby = el('lobbyOverlay');
    if (lobby) lobby.style.display = 'none';

    // Wipe any stale entries from a previous session and watch our own offer slot.
    try { await db.ref(QUEUE_PATH  + '/' + mmUid).remove(); } catch (e) {}
    try { await db.ref(OFFERS_PATH + '/' + mmUid).remove(); } catch (e) {}

    mmOfferRef = db.ref(OFFERS_PATH + '/' + mmUid);
    mmOfferListener = mmOfferRef.on('value', onMyOfferChanged, () => {});

    attachQueueCounter();
    armSearchTimeout();

    // Try to claim someone already waiting; if no claim succeeds, queue ourselves.
    const claimed = await tryClaimAny();
    if (!mmActive) return;
    if (!claimed) await joinQueue();
  }

  function armSearchTimeout() {
    if (mmTimeoutTimer) clearTimeout(mmTimeoutTimer);
    mmTimeoutTimer = setTimeout(() => {
      if (!mmActive) return;
      cancelFindMatch();
      const lobby = el('lobbyOverlay');
      if (lobby) lobby.style.display = 'flex';
      lobbyErr('No opponent found — try again later.');
    }, SEARCH_TIMEOUT_MS);
  }

  function attachQueueCounter() {
    const c = el('mmQueueCount');
    if (!c || !mmDb) return;
    detachQueueCounter();
    mmQueueCountRef = mmDb.ref(QUEUE_PATH);
    mmQueueCountListener = mmQueueCountRef.on('value', snap => {
      if (!snap.exists()) { c.textContent = '0'; return; }
      const all = snap.val() || {};
      const now = Date.now();
      const live = Object.entries(all).filter(([uid, info]) =>
        uid !== mmUid &&
        info &&
        typeof info.ts === 'number' &&
        (now - info.ts) < STALE_MS &&
        ((info.mode || 'normal') === mmMode)
      ).length;
      c.textContent = String(live);
    }, () => { c.textContent = '0'; });
  }

  function detachQueueCounter() {
    if (mmQueueCountRef && mmQueueCountListener) {
      try { mmQueueCountRef.off('value', mmQueueCountListener); } catch (e) {}
    }
    mmQueueCountRef = null;
    mmQueueCountListener = null;
  }

  async function tryClaimAny() {
    let snap;
    try { snap = await mmDb.ref(QUEUE_PATH).once('value'); }
    catch (e) { return false; }
    if (!snap || !snap.exists()) return false;
    const all = snap.val() || {};
    const now = Date.now();
    const candidates = Object.entries(all)
      .filter(([uid, info]) =>
        uid !== mmUid &&
        info &&
        typeof info.ts === 'number' &&
        (now - info.ts) < STALE_MS &&
        ((info.mode || 'normal') === mmMode)
      )
      .sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));

    for (const [oppUid, oppInfo] of candidates) {
      if (!mmActive) return false;
      const claimed = await tryClaimOne(oppUid, oppInfo);
      if (claimed) return true;
    }
    return false;
  }

  async function tryClaimOne(oppUid, oppInfo) {
    if (!mmActive) return false;

    const offerRef   = mmDb.ref(OFFERS_PATH + '/' + oppUid);
    const placeholder = { from: mmUid, fromName: mmName, ts: Date.now() };

    let won = false;
    try {
      const result = await offerRef.transaction(curr => {
        if (curr) return undefined;     // already claimed by someone else
        return placeholder;
      });
      won = !!(result && result.committed);
    } catch (e) {
      won = false;
    }
    if (!won || !mmActive) return false;

    setSearchText('MATCH FOUND',
      'Connecting to <b>' + escapeHtml(oppInfo.name || 'Opponent') + '</b>…');
    revealOpponent(oppInfo.name);

    mmRole = 'seeker';

    // Once we hold the offer, drop our own offer-slot listener so an incoming
    // offer never bumps us into "waiter" mode after we've already won a claim.
    detachOfferListener();

    let code = null;
    try { code = await createSeekerRoom(); }
    catch (e) { console.warn('[matchmaking] room create failed:', e); }

    if (!code || !mmActive) {
      // Release the offer so the waiter can be claimed again
      try { await offerRef.remove(); } catch (e) {}
      mmRole = null;
      return false;
    }

    try { await offerRef.update({ roomCode: code }); }
    catch (e) {
      console.warn('[matchmaking] roomCode broadcast failed:', e);
      try { await offerRef.remove(); } catch (e2) {}
      // Tear the room down — the waiter has no way to join us
      try { if (typeof window.leaveGame === 'function') window.leaveGame(); } catch (e2) {}
      mmRole = null;
      return false;
    }

    // Tag the room so reviewers can spot matchmaking-created rooms in Firebase,
    // and set the agreed-upon gameMode so the joiner gets the right experience.
    try {
      // eslint-disable-next-line no-undef
      if (typeof roomRef !== 'undefined' && roomRef) {
        await roomRef.update({ mode: 'matchmaking', gameMode: mmMode });
      }
    } catch (e) {}

    // Make sure no stray queue entry survives for the seeker.
    try { await mmDb.ref(QUEUE_PATH + '/' + mmUid).remove(); } catch (e) {}

    watchRoomForAutoStart(code);
    return true;
  }

  async function createSeekerRoom() {
    if (typeof window.createGame !== 'function') return null;

    await window.createGame();

    let code = null;
    try {
      // app.js declares roomCode at script scope, so it is reachable lexically
      // from this sibling classic script.
      // eslint-disable-next-line no-undef
      code = (typeof roomCode !== 'undefined' && roomCode) ? roomCode : null;
    } catch (e) {}

    if (!code) {
      const dc = el('displayCode');
      const txt = dc ? (dc.textContent || '').trim() : '';
      if (txt && txt !== '----') code = txt;
    }
    return code;
  }

  function watchRoomForAutoStart(code) {
    detachRoomListener();
    mmRoomRef = mmDb.ref('rooms/' + code);
    mmRoomListener = mmRoomRef.on('value', snap => {
      if (!snap.exists()) return;
      const data = snap.val();

      if (data.started) { finishMatchmaking(); return; }

      const players = data.players || {};
      const ids = Object.keys(players).filter(id => !players[id]?.disconnectedAt);
      const isMeHost = data.host === mmUid;

      if (isMeHost && ids.length >= 2 && !mmAutoStartScheduled) {
        mmAutoStartScheduled = true;
        setSearchText('MATCH FOUND',
          'Starting match<span class="mm-dots"><span>.</span><span>.</span><span>.</span></span>');
        setTimeout(() => {
          if (typeof window.startGame === 'function') {
            try { window.startGame(); } catch (e) { console.warn('startGame failed:', e); }
          }
        }, AUTO_START_DELAY_MS);
      }
    }, () => {});
  }

  function watchRoomForGameStart(code) {
    detachRoomListener();
    mmRoomRef = mmDb.ref('rooms/' + code);
    mmRoomListener = mmRoomRef.on('value', snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      if (data.started) finishMatchmaking();
    }, () => {});
  }

  async function joinQueue() {
    if (!mmActive) return;

    const modeLabel = mmMode === 'powerup' ? 'Power-Up' : 'Classic';
    setSearchText('LOOKING FOR PLAYER',
      'Waiting for a ' + modeLabel + ' opponent<span class="mm-dots"><span>.</span><span>.</span><span>.</span></span>');

    const queueRef = mmDb.ref(QUEUE_PATH + '/' + mmUid);
    const entry = { uid: mmUid, name: mmName, ts: Date.now(), mode: mmMode };
    try {
      await queueRef.set(entry);
    } catch (e) {
      console.warn('[matchmaking] join queue failed:', e);
      cancelFindMatch();
      const lobby = el('lobbyOverlay');
      if (lobby) lobby.style.display = 'flex';
      lobbyErr('Could not join queue — try again.');
      return;
    }

    try { await queueRef.onDisconnect().remove(); } catch (e) {}
    if (mmOfferRef) {
      try { await mmOfferRef.onDisconnect().remove(); } catch (e) {}
    }
  }

  function onMyOfferChanged(snap) {
    if (!mmActive) return;
    if (mmRole === 'seeker') return;     // already won a claim — ignore inbound offers
    if (!snap.exists()) return;

    const offer = snap.val() || {};
    if (!offer.from || offer.from === mmUid) return;
    if (!offer.roomCode) return;          // claim placeholder, room not created yet

    mmRole = 'waiter';
    setSearchText('MATCH FOUND',
      'Joining <b>' + escapeHtml(offer.fromName || 'opponent') + '</b>…');
    revealOpponent(offer.fromName);
    detachOfferListener();

    if (mmDb && mmUid) {
      mmDb.ref(QUEUE_PATH + '/' + mmUid).remove().catch(() => {});
      try { mmDb.ref(QUEUE_PATH + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
      try { mmDb.ref(OFFERS_PATH + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
    }

    const codeEl = el('joinCode');
    if (codeEl) codeEl.value = offer.roomCode;

    if (typeof window.joinGame !== 'function') {
      console.warn('[matchmaking] joinGame missing');
      cleanupMatchmakingState();
      return;
    }

    Promise.resolve().then(() => window.joinGame()).then(() => {
      watchRoomForGameStart(offer.roomCode);
      if (mmDb && mmUid) {
        mmDb.ref(OFFERS_PATH + '/' + mmUid).remove().catch(() => {});
      }
    }).catch(e => {
      console.warn('[matchmaking] joinGame failed:', e);
      cleanupMatchmakingState();
      const lobby = el('lobbyOverlay');
      if (lobby) lobby.style.display = 'flex';
      lobbyErr('Failed to join match.');
    });
  }

  function detachOfferListener() {
    if (mmOfferListener && mmOfferRef) {
      try { mmOfferRef.off('value', mmOfferListener); } catch (e) {}
    }
    mmOfferListener = null;
  }

  function detachRoomListener() {
    if (mmRoomListener && mmRoomRef) {
      try { mmRoomRef.off('value', mmRoomListener); } catch (e) {}
    }
    mmRoomRef = null;
    mmRoomListener = null;
  }

  async function cancelFindMatch() {
    if (!mmActive) {
      hideSearchOverlay();
      return;
    }
    const wasSeeker = mmRole === 'seeker';

    mmActive = false;
    detachOfferListener();
    detachRoomListener();
    detachQueueCounter();
    if (mmTimeoutTimer) { clearTimeout(mmTimeoutTimer); mmTimeoutTimer = null; }
    stopElapsedTicker();

    if (mmDb && mmUid) {
      try { await mmDb.ref(QUEUE_PATH  + '/' + mmUid).remove(); } catch (e) {}
      try { await mmDb.ref(OFFERS_PATH + '/' + mmUid).remove(); } catch (e) {}
      try { mmDb.ref(QUEUE_PATH  + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
      try { mmDb.ref(OFFERS_PATH + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
    }

    hideSearchOverlay();

    // If we already created a room as the seeker, leaveGame tears it down
    // and returns the user to the lobby for us.
    if (wasSeeker && typeof window.leaveGame === 'function') {
      try { window.leaveGame(); } catch (e) {}
    } else {
      const lobby = el('lobbyOverlay');
      if (lobby) lobby.style.display = 'flex';
    }

    cleanupMatchmakingState();
  }

  function finishMatchmaking() {
    mmActive = false;
    detachOfferListener();
    detachRoomListener();
    detachQueueCounter();
    if (mmTimeoutTimer) { clearTimeout(mmTimeoutTimer); mmTimeoutTimer = null; }
    stopElapsedTicker();
    hideSearchOverlay();
    if (mmDb && mmUid) {
      mmDb.ref(QUEUE_PATH  + '/' + mmUid).remove().catch(() => {});
      mmDb.ref(OFFERS_PATH + '/' + mmUid).remove().catch(() => {});
      try { mmDb.ref(QUEUE_PATH  + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
      try { mmDb.ref(OFFERS_PATH + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
    }
    cleanupMatchmakingState();
  }

  function cleanupMatchmakingState() {
    mmRole   = null;
    mmDb     = null;
    mmUid    = null;
    mmName   = null;
    mmMode   = 'normal';
    mmOfferRef = null;
    mmAutoStartScheduled = false;
  }

  function openFindMatchModeChoice() {
    const nameEl = el('playerName');
    const name = (nameEl && nameEl.value && nameEl.value.trim()) || '';
    if (!name) {
      lobbyErr('Enter your name first!');
      return;
    }
    if (typeof window.yumValidateUsername === 'function') {
      const check = window.yumValidateUsername(name);
      if (!check.ok) { lobbyErr(check.reason); return; }
    }
    lobbyErr('');
    const m = el('findMatchModeModal');
    if (m) m.classList.add('open');
  }

  function closeFindMatchModeChoice() {
    const m = el('findMatchModeModal');
    if (m) m.classList.remove('open');
  }

  function chooseFindMatchMode(mode) {
    const m = el('findMatchModeModal');
    if (m) m.classList.remove('open');
    findMatch(mode);
  }

  window.findMatch                 = findMatch;
  window.cancelFindMatch           = cancelFindMatch;
  window.openFindMatchModeChoice   = openFindMatchModeChoice;
  window.closeFindMatchModeChoice  = closeFindMatchModeChoice;
  window.chooseFindMatchMode       = chooseFindMatchMode;
})();
