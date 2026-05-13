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
//   4. Once both are in the room, watchRoomForReady() shows a ready-check
//      overlay and waits for both players to set players/$uid/ready=true.
//   5. The host calls startGame() once both have accepted. Decline / timeout /
//      disconnect writes rooms/$id/status='matchCanceled', which both clients
//      pick up to leave the room and return to the lobby.

(function () {
  'use strict';

  const QUEUE_PATH         = 'matchmaking/queue';
  const OFFERS_PATH        = 'matchmaking/offers';
  const STALE_MS           = 90 * 1000;        // queue entries older than this are ignored
  const READY_TIMEOUT_MS   = 15000;            // both players must accept within this window
  const READY_START_DELAY_MS = 3000;           // brief pause after both accept before kickoff

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
  let mmRoomCode = null;
  let mmQueueRef = null;
  let mmQueueWatcher = null;
  let mmInQueue = false;
  let mmClaimInFlight = false;
  let mmAutoStartScheduled = false;
  let mmStartTs = 0;
  let mmElapsedTimer = null;
  let mmReadyShown = false;
  let mmReadyHandled = false;
  let mmReadyDeadline = 0;
  let mmReadyTickTimer = null;
  // Set true on the waiter side once we observe an addressed-to-us offer.
  // Used to distinguish "offer never arrived" (no-op) from "offer arrived
  // then was removed before we got a roomCode" (seeker bailed → notify).
  let mmOfferSeen = false;

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

  function showReadyOverlay() {
    const o = el('mmReadyOverlay');
    if (o) o.classList.add('mm-show');
  }

  function hideReadyOverlay() {
    const o = el('mmReadyOverlay');
    if (o) o.classList.remove('mm-show');
  }

  function setReadyMode(mode) {
    const badge = el('mmReadyModeBadge');
    if (!badge) return;
    if (mode === 'powerup') {
      badge.classList.add('mm-mode-powerup');
      badge.innerHTML = '<i class="icn icn-bolt"></i> <span id="mmReadyModeText">POWER-UP 1V1</span>';
    } else {
      badge.classList.remove('mm-mode-powerup');
      badge.innerHTML = '<i class="icn icn-gamepad"></i> <span id="mmReadyModeText">CLASSIC 1V1</span>';
    }
  }

  function setReadyTag(side, state) {
    const tag = el(side === 'me' ? 'mmReadyMeTag' : 'mmReadyOppTag');
    if (!tag) return;
    tag.classList.remove('mm-card-tag-pending', 'mm-tag-ready');
    if (state === 'ready') {
      tag.textContent = 'READY';
      tag.classList.add('mm-tag-ready');
    } else if (state === 'declined') {
      tag.textContent = 'DECLINED';
      tag.classList.add('mm-card-tag-pending');
    } else {
      tag.textContent = 'PENDING';
      tag.classList.add('mm-card-tag-pending');
    }
  }

  function setAvatarStatus(side, state) {
    const badge = el(side === 'me' ? 'mmReadyMeStatus' : 'mmReadyOppStatus');
    if (!badge) return;
    badge.classList.remove('accepted', 'declined', 'show');
    badge.innerHTML = '';
    if (state === 'accepted') {
      badge.innerHTML = '<i class="icn icn-arrow-up"></i>';
      badge.classList.add('accepted', 'show');
    } else if (state === 'declined') {
      badge.innerHTML = '<i class="icn icn-close"></i>';
      badge.classList.add('declined', 'show');
    }
  }

  function setReadySub(html) {
    const s = el('mmReadySub');
    if (s) s.innerHTML = html;
  }

  function setReadyButtonsState(state) {
    const acceptBtn  = el('mmReadyAcceptBtn');
    const declineBtn = el('mmReadyDeclineBtn');
    if (state === 'waiting') {
      if (acceptBtn) acceptBtn.disabled = true;
    } else {
      if (acceptBtn) acceptBtn.disabled = false;
      if (declineBtn) declineBtn.disabled = false;
    }
  }

  function startReadyCountdown() {
    stopReadyCountdown();
    mmReadyDeadline = Date.now() + READY_TIMEOUT_MS;
    const tick = () => {
      if (!mmReadyShown) return;
      const left = Math.max(0, mmReadyDeadline - Date.now());
      const cd = el('mmReadyCountdown');
      if (cd) {
        const s = Math.ceil(left / 1000);
        cd.textContent = '0:' + (s < 10 ? '0' : '') + s;
      }
      const bar = el('mmReadyProgressBar');
      if (bar) {
        const frac = Math.max(0, Math.min(1, left / READY_TIMEOUT_MS));
        bar.style.transform = 'scaleX(' + frac + ')';
      }
      if (left <= 0) {
        stopReadyCountdown();
        handleReadyTimeout();
      }
    };
    tick();
    mmReadyTickTimer = setInterval(tick, 250);
  }

  function stopReadyCountdown() {
    if (mmReadyTickTimer) { clearInterval(mmReadyTickTimer); mmReadyTickTimer = null; }
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
    paintMyMatchmakingAvatars();
  }

  function paintMyMatchmakingAvatars() {
    if (!window.YumAvatars) return;
    const myMarkup = window.YumAvatars.markupForProfile();
    document.querySelectorAll('.mm-card-me .mm-card-avatar').forEach(av => {
      // Preserve any status badge (the small accept/decline pill).
      const status = av.querySelector('.mm-avatar-status');
      av.innerHTML = myMarkup;
      if (status) av.appendChild(status);
    });
  }

  function setOppMatchmakingAvatar(avatarId, oppName) {
    if (!avatarId || !window.YumAvatars) return;
    const oppMarkup = window.YumAvatars.markup(avatarId, oppName);
    document.querySelectorAll('.mm-card-opp .mm-card-avatar').forEach(av => {
      const status = av.querySelector('.mm-avatar-status');
      av.classList.remove('mm-card-avatar-mystery');
      av.innerHTML = oppMarkup;
      if (status) av.appendChild(status);
    });
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

  function revealOpponent(oppName, oppAvatar) {
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
        if (oppAvatar && window.YumAvatars) {
          av.innerHTML = window.YumAvatars.markup(oppAvatar, oppName);
        } else {
          av.innerHTML = '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#yum-mark"/></svg>';
        }
      }
    }
    if (name) name.textContent = oppName || 'Opponent';
    if (oppAvatar) setOppMatchmakingAvatar(oppAvatar, oppName);
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

  function updateOnlineCount(snap) {
    const out = el('mmOnline');
    if (!out) return;
    let count = 0;
    if (snap && snap.exists()) {
      const all = snap.val() || {};
      const now = Date.now();
      for (const uid in all) {
        const info = all[uid];
        if (info && typeof info.ts === 'number' && (now - info.ts) < STALE_MS) {
          count++;
        }
      }
    }
    out.textContent = String(count);
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

  function myAvatarId() {
    try {
      if (window.YumAvatars && typeof window.YumAvatars.getCurrentId === 'function') {
        return window.YumAvatars.getCurrentId();
      }
    } catch(e) {}
    return null;
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
    mmInQueue = false;
    mmClaimInFlight = false;
    mmAutoStartScheduled = false;
    mmOfferSeen = false;

    const modeLabel = chosenMode === 'powerup' ? 'Power-Up' : 'Classic';
    setSearchText('LOOKING FOR PLAYER',
      'Searching for a ' + modeLabel + ' opponent<span class="mm-dots"><span>.</span><span>.</span><span>.</span></span>');
    setModeBadge(chosenMode);
    setMyName(name);
    resetOpponentCard();
    const onlineEl = el('mmOnline');
    if (onlineEl) onlineEl.textContent = '…';
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

    attachQueueWatcher();

    // Try to claim someone already waiting; if no claim succeeds, queue ourselves.
    const claimed = await tryClaimAny();
    if (!mmActive) return;
    if (!claimed) await joinQueue();
  }

  // Listen on the queue so we re-attempt claiming whenever entries change.
  // This handles the race where two players hit Find Match at the same time:
  // both see an empty queue, both joinQueue, then this listener fires for
  // each side with the other's fresh entry. A UID tie-break ensures only one
  // side actually performs the claim.
  function attachQueueWatcher() {
    if (!mmDb) return;
    detachQueueWatcher();
    mmQueueRef = mmDb.ref(QUEUE_PATH);
    mmQueueWatcher = mmQueueRef.on('value', onQueueChange, () => {});
  }

  function detachQueueWatcher() {
    if (mmQueueRef && mmQueueWatcher) {
      try { mmQueueRef.off('value', mmQueueWatcher); } catch (e) {}
    }
    mmQueueRef = null;
    mmQueueWatcher = null;
  }

  async function onQueueChange(snap) {
    updateOnlineCount(snap);
    if (!mmActive || mmRole) return;
    if (!mmInQueue) return;            // only re-claim once our own entry is committed
    if (mmClaimInFlight) return;
    if (!snap || !snap.exists()) return;

    const all = snap.val() || {};
    const now = Date.now();
    const candidates = Object.entries(all)
      .filter(([uid, info]) =>
        uid !== mmUid &&
        // Tie-break: only the player with the smaller UID claims, so when
        // both players see each other in the queue we don't both become host.
        uid > mmUid &&
        info &&
        typeof info.ts === 'number' &&
        (now - info.ts) < STALE_MS &&
        ((info.mode || 'normal') === mmMode)
      )
      .sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));

    if (candidates.length === 0) return;

    mmClaimInFlight = true;
    try {
      for (const [oppUid, oppInfo] of candidates) {
        if (!mmActive || mmRole) break;
        const claimed = await tryClaimOne(oppUid, oppInfo);
        if (claimed) break;
      }
    } finally {
      mmClaimInFlight = false;
    }
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
    const placeholder = { from: mmUid, fromName: mmName, fromAvatar: myAvatarId() || null, ts: Date.now() };

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
    revealOpponent(oppInfo.name, oppInfo.avatar || null);

    mmRole = 'seeker';

    // Once we hold the offer, drop our own offer-slot listener so an incoming
    // offer never bumps us into "waiter" mode after we've already won a claim.
    detachOfferListener();

    let code = null;
    try { code = await createSeekerRoom(); }
    catch (e) { console.warn('[matchmaking] room create failed:', e); }

    if (!code || !mmActive) {
      // Release the offer so the waiter can be claimed again. Removing the
      // offer is also the signal the waiter relies on to leave their search
      // screen (see onMyOfferChanged's snap.exists() branch).
      try { await offerRef.remove(); } catch (e) {}
      mmRole = null;
      if (mmActive) {
        // createGame surfaced its own lobby error, but the search overlay
        // is on top hiding it. Bail back to the lobby so the user actually
        // sees the failure instead of staring at "MATCH FOUND, Connecting…"
        // forever.
        cancelFindMatch();
      } else if (window.roomRef && typeof window.leaveGame === 'function') {
        // Matchmaking was cancelled while createGame was still awaiting.
        // createGame finished after cancelFindMatch already ran (and saw an
        // empty roomRef), so the host is now stranded inside the room's
        // waitingOverlay while their opponent is back at the main menu.
        // Tear the half-built room down so we end up where cancelFindMatch
        // had tried to leave us.
        try { window.leaveGame(); } catch (e) {}
      }
      return false;
    }

    // Record the room code now so cancelFindMatch can tear our slot down via
    // leaveGame on any failure below — and notify the waiter via the room's
    // status='matchCanceled' marker so they don't sit on their own search
    // screen waiting for a host that's already gone.
    mmRoomCode = code;

    try { await offerRef.update({ roomCode: code }); }
    catch (e) {
      console.warn('[matchmaking] roomCode broadcast failed:', e);
      try { await offerRef.remove(); } catch (e2) {}
      // Bail back to the lobby — cancelFindMatch tears down our room slot
      // (via leaveGame, since mmRole is still 'seeker'), hides the search
      // overlay, and restores the lobby. Without this the seeker hangs on
      // "MATCH FOUND, Connecting…" forever while the waiter sees the offer
      // disappear and bails out separately.
      if (mmActive) cancelFindMatch();
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

    watchRoomForReady(code, 'seeker');
    return true;
  }

  async function createSeekerRoom() {
    if (typeof window.createGame !== 'function') return null;

    await window.createGame();

    // createGame leaves roomCode set to the last *attempted* code even when
    // the transaction failed (e.g. permission_denied, network drop), so the
    // global by itself isn't enough to know we actually have a room. roomRef
    // is nulled on failure, so use it as the success signal.
    if (!window.roomRef) return null;

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

  // Unified room watcher used by both seeker and waiter once they share a room.
  // Shows the ready-check overlay when both players are present, then:
  //   - host (seeker) calls startGame() when both have set ready=true
  //   - any side that declines / times out / disconnects writes status='matchCanceled',
  //     which the listener picks up and tears the match down
  function watchRoomForReady(code, role) {
    detachRoomListener();
    mmReadyShown = false;
    mmReadyHandled = false;
    mmRoomRef = mmDb.ref('rooms/' + code);

    mmRoomListener = mmRoomRef.on('value', snap => {
      if (!mmActive) return;

      if (!snap.exists()) {
        if (mmReadyShown && !mmReadyHandled) {
          mmReadyHandled = true;
          handleRemoteCancel('Match canceled — opponent left.');
        }
        return;
      }
      const data = snap.val();

      if (data.started) { finishMatchmaking(); return; }

      if (data.status === 'matchCanceled') {
        if (mmReadyHandled) return;
        mmReadyHandled = true;
        handleRemoteCancel('Match canceled by opponent.');
        return;
      }

      const players = data.players || {};
      const activeIds = Object.keys(players).filter(id => !players[id] || !players[id].disconnectedAt);

      if (activeIds.length < 2) {
        if (mmReadyShown && !mmReadyHandled) {
          mmReadyHandled = true;
          handleRemoteCancel('Match canceled — opponent disconnected.');
        }
        return;
      }

      const oppId = activeIds.find(id => id !== mmUid) || null;
      const oppName = (oppId && players[oppId] && players[oppId].name) || 'Opponent';
      const oppAvatar = (oppId && players[oppId] && players[oppId].avatar) || null;
      if (oppAvatar) setOppMatchmakingAvatar(oppAvatar, oppName);
      const meReady    = !!(players[mmUid] && players[mmUid].ready);
      const oppReady   = !!(oppId && players[oppId] && players[oppId].ready);
      const meDeclined  = !!(players[mmUid] && players[mmUid].declined);
      const oppDeclined = !!(oppId && players[oppId] && players[oppId].declined);

      if (!mmReadyShown) {
        mmReadyShown = true;

        const meNameEl  = el('mmReadyMeName');
        const oppNameEl = el('mmReadyOppName');
        if (meNameEl)  meNameEl.textContent  = mmName || 'You';
        if (oppNameEl) oppNameEl.textContent = oppName;
        setReadyMode(mmMode);
        setReadyTag('me', 'pending');
        setReadyTag('opp', 'pending');
        setAvatarStatus('me', null);
        setAvatarStatus('opp', null);
        setReadyButtonsState('idle');
        setReadySub('Both players must tap <b>Accept</b> within 15 seconds');
        hideSearchOverlay();
        showReadyOverlay();
        startReadyCountdown();
      } else {
        const oppNameEl = el('mmReadyOppName');
        if (oppNameEl && oppName) oppNameEl.textContent = oppName;
      }

      setReadyTag('me',  meDeclined  ? 'declined' : meReady  ? 'ready' : 'pending');
      setReadyTag('opp', oppDeclined ? 'declined' : oppReady ? 'ready' : 'pending');
      setAvatarStatus('me',  meDeclined  ? 'declined' : meReady  ? 'accepted' : null);
      setAvatarStatus('opp', oppDeclined ? 'declined' : oppReady ? 'accepted' : null);
      if (meReady) {
        setReadyButtonsState('waiting');
        if (!oppReady && !oppDeclined) {
          setReadySub('Waiting for <b>' + escapeHtml(oppName) + '</b><span class="mm-dots"><span>.</span><span>.</span><span>.</span></span>');
        }
      }

      if (meReady && oppReady && !mmAutoStartScheduled) {
        stopReadyCountdown();
        setReadySub('Starting match<span class="mm-dots"><span>.</span><span>.</span><span>.</span></span>');
        if (role === 'seeker') {
          mmAutoStartScheduled = true;
          setTimeout(() => {
            if (typeof window.startGame === 'function') {
              try { window.startGame(); } catch (e) { console.warn('startGame failed:', e); }
            }
          }, READY_START_DELAY_MS);
        }
      }
    }, () => {});
  }

  async function mmAcceptMatch() {
    if (!mmReadyShown || mmReadyHandled || !mmDb || !mmUid || !mmRoomCode) return;
    setReadyButtonsState('waiting');
    setReadyTag('me', 'ready');
    setAvatarStatus('me', 'accepted');
    try {
      await mmDb.ref('rooms/' + mmRoomCode + '/players/' + mmUid + '/ready').set(true);
    } catch (e) {
      console.warn('[matchmaking] accept failed:', e);
      setReadyButtonsState('idle');
      setReadyTag('me', 'pending');
      setAvatarStatus('me', null);
      setReadySub('Could not send accept — try again.');
    }
  }

  async function mmDeclineMatch() {
    if (mmReadyHandled) return;
    mmReadyHandled = true;
    setReadyButtonsState('waiting');
    setReadyTag('me', 'declined');
    setAvatarStatus('me', 'declined');
    stopReadyCountdown();
    if (mmDb && mmUid && mmRoomCode) {
      try { await mmDb.ref('rooms/' + mmRoomCode + '/players/' + mmUid + '/declined').set(true); } catch (e) {}
    }
    setTimeout(() => {
      cancelFindMatch().then(() => {
        lobbyErr('You declined the match.');
      });
    }, 3000);
  }

  function handleReadyTimeout() {
    if (mmReadyHandled) return;
    mmReadyHandled = true;
    cancelFindMatch().then(() => {
      lobbyErr('Match canceled — accept timed out.');
    });
  }

  function handleRemoteCancel(message) {
    cancelFindMatch().then(() => {
      if (message) lobbyErr(message);
    });
  }

  async function joinQueue() {
    if (!mmActive) return;

    const modeLabel = mmMode === 'powerup' ? 'Power-Up' : 'Classic';
    setSearchText('LOOKING FOR PLAYER',
      'Waiting for a ' + modeLabel + ' opponent<span class="mm-dots"><span>.</span><span>.</span><span>.</span></span>');

    const queueRef = mmDb.ref(QUEUE_PATH + '/' + mmUid);
    const entry = { uid: mmUid, name: mmName, ts: Date.now(), mode: mmMode, avatar: myAvatarId() || null };
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

    mmInQueue = true;

    try { await queueRef.onDisconnect().remove(); } catch (e) {}
    if (mmOfferRef) {
      try { await mmOfferRef.onDisconnect().remove(); } catch (e) {}
    }

    // The queue watcher may have fired with our snapshot before mmInQueue
    // flipped — kick off one explicit re-scan so we don't miss the
    // simultaneous-join race in that timing window.
    if (mmActive && !mmRole) {
      try {
        const snap = await mmDb.ref(QUEUE_PATH).once('value');
        if (mmActive && !mmRole) await onQueueChange(snap);
      } catch (e) {}
    }
  }

  function onMyOfferChanged(snap) {
    if (!mmActive) return;
    if (mmRole === 'seeker') return;     // already won a claim — ignore inbound offers

    if (!snap.exists()) {
      // The offer was removed before we got a roomCode. That means the
      // seeker bailed (their createGame failed, they cancelled, or their
      // browser crashed). Without this branch the waiter sits on the
      // "MATCH FOUND, Connecting…" screen forever and the Accept overlay
      // never appears for either side.
      if (mmOfferSeen && !mmRole) {
        mmOfferSeen = false;
        handleRemoteCancel('Match canceled — opponent dropped.');
      }
      return;
    }

    const offer = snap.val() || {};
    if (!offer.from || offer.from === mmUid) return;
    mmOfferSeen = true;
    if (!offer.roomCode) return;          // claim placeholder, room not created yet

    mmRole = 'waiter';
    setSearchText('MATCH FOUND',
      'Joining <b>' + escapeHtml(offer.fromName || 'opponent') + '</b>…');
    revealOpponent(offer.fromName, offer.fromAvatar || null);
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
      handleRemoteCancel('Match canceled — multiplayer unavailable.');
      return;
    }

    // Set mmRoomCode before kicking off joinGame so cancelFindMatch can
    // notify the seeker via rooms/CODE/status='matchCanceled' if anything
    // goes wrong. Without this the seeker hangs in their waiting room
    // forever while the waiter bounces back to the main menu.
    mmRoomCode = offer.roomCode;

    Promise.resolve().then(() => window.joinGame()).then(() => {
      // joinGame doesn't throw on a missing room — it just shows a lobby
      // error and returns. Verify we actually landed in the seeker's room
      // before attaching the ready-check listener; otherwise we'd silently
      // watch an empty path and never show the Accept button.
      if (!window.roomRef || window.roomRef.key !== offer.roomCode) {
        handleRemoteCancel('Match canceled — opponent room unavailable.');
        return;
      }
      watchRoomForReady(offer.roomCode, 'waiter');
      if (mmDb && mmUid) {
        mmDb.ref(OFFERS_PATH + '/' + mmUid).remove().catch(() => {});
      }
    }).catch(e => {
      console.warn('[matchmaking] joinGame failed:', e);
      handleRemoteCancel('Failed to join match.');
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
      hideReadyOverlay();
      stopReadyCountdown();
      return;
    }
    const wasSeeker = mmRole === 'seeker';
    const wasInRoom = wasSeeker || mmRole === 'waiter';
    const code = mmRoomCode;

    mmActive = false;
    mmReadyHandled = true;
    mmReadyShown = false;
    detachOfferListener();
    detachRoomListener();
    detachQueueWatcher();
    stopElapsedTicker();
    stopReadyCountdown();

    // Signal the opponent that the match is off so they leave the room too.
    if (wasInRoom && code && mmDb) {
      try { await mmDb.ref('rooms/' + code + '/status').set('matchCanceled'); } catch (e) {}
    }

    if (mmDb && mmUid) {
      try { await mmDb.ref(QUEUE_PATH  + '/' + mmUid).remove(); } catch (e) {}
      try { await mmDb.ref(OFFERS_PATH + '/' + mmUid).remove(); } catch (e) {}
      try { mmDb.ref(QUEUE_PATH  + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
      try { mmDb.ref(OFFERS_PATH + '/' + mmUid).onDisconnect().cancel(); } catch (e) {}
    }

    hideSearchOverlay();
    hideReadyOverlay();

    // leaveGame tears down the room slot and returns to the lobby for us.
    // Fall back to roomRef so a path that reset mmRole before reaching here
    // (e.g. createSeekerRoom's failure cleanup) still surrenders the room.
    if ((wasInRoom || window.roomRef) && typeof window.leaveGame === 'function') {
      try { window.leaveGame(); } catch (e) {}
    }

    // Defensive: leaveGame normally hides waitingOverlay and shows
    // lobbyOverlay, but if it threw or wasn't applicable the host can be
    // left staring at their matchmaking room's waiting lobby while the
    // opponent is already back at the main menu. Force the matchmaking
    // lobby to be visible so both sides end up in the same place.
    const waiting = el('waitingOverlay');
    if (waiting) waiting.style.display = 'none';
    const lobby = el('lobbyOverlay');
    if (lobby) lobby.style.display = 'flex';

    cleanupMatchmakingState();
  }

  function finishMatchmaking() {
    mmActive = false;
    mmReadyHandled = true;
    mmReadyShown = false;
    detachOfferListener();
    detachRoomListener();
    detachQueueWatcher();
    stopElapsedTicker();
    stopReadyCountdown();
    hideSearchOverlay();
    hideReadyOverlay();
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
    mmRoomCode = null;
    mmInQueue = false;
    mmClaimInFlight = false;
    mmAutoStartScheduled = false;
    mmReadyShown = false;
    mmReadyHandled = false;
    mmOfferSeen = false;
  }

  function openFindMatchModeChoice() {
    const nameEl = el('playerName');
    const name = (nameEl && nameEl.value && nameEl.value.trim()) || '';
    if (!name) {
      if (typeof window.promptForUsername === 'function') window.promptForUsername();
      else lobbyErr('Enter your name first!');
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
  window.mmAcceptMatch             = mmAcceptMatch;
  window.mmDeclineMatch            = mmDeclineMatch;
})();
