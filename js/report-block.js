// Report / block a player from the multiplayer opponent viewer.
//
// Required by Google Play's UGC policy for any app where users see other
// users' content (here: usernames and emoji reactions). Block is local to
// the device; report writes a record under /reports/$id for moderation.

(function() {
  const BLOCK_KEY = 'yum_blocked_players_v1';

  function loadBlocked() {
    try { return JSON.parse(localStorage.getItem(BLOCK_KEY) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function saveBlocked(map) {
    try { localStorage.setItem(BLOCK_KEY, JSON.stringify(map)); } catch (e) {}
  }

  function blockKey(target) {
    if (!target) return null;
    if (target.id && target.id !== 'bot') return 'id:' + target.id;
    if (target.name) return 'name:' + String(target.name).toLowerCase().trim();
    return null;
  }

  function isBlocked(target) {
    const k = blockKey(target);
    if (!k) return false;
    return !!loadBlocked()[k];
  }

  function setBlocked(target, on) {
    const k = blockKey(target);
    if (!k) return;
    const map = loadBlocked();
    if (on) map[k] = { at: Date.now(), name: target.name || '' };
    else delete map[k];
    saveBlocked(map);
  }

  window.isYumPlayerBlocked = isBlocked;
  window.getYumBlockedPlayers = loadBlocked;

  function currentTarget() {
    return window._currentOppViewer || null;
  }

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function reportCurrentOpponent() {
    const target = currentTarget();
    if (!target || target.id === 'bot') return;

    const reasons = [
      'Inappropriate username',
      'Harassment / abusive behaviour',
      'Cheating / unfair play',
      'Spam',
      'Other'
    ];
    const choice = window.prompt(
      'Report ' + (target.name || 'this player') + '?\n\n' +
      reasons.map((r, i) => (i + 1) + '. ' + r).join('\n') +
      '\n\nEnter a number (1-' + reasons.length + ') or short description, or Cancel.'
    );
    if (choice == null) return;
    const trimmed = String(choice).trim();
    if (!trimmed) return;
    const idx = parseInt(trimmed, 10);
    const reason = (idx >= 1 && idx <= reasons.length) ? reasons[idx - 1] : trimmed.slice(0, 200);

    const reporterUid = (window.firebase && firebase.auth && firebase.auth().currentUser)
      ? firebase.auth().currentUser.uid
      : null;
    const roomId = window.currentRoom || window.roomId || null;

    const payload = {
      reportedId: target.id || null,
      reportedName: (target.name || '').slice(0, 64),
      reason: reason,
      reporterUid: reporterUid,
      roomId: roomId,
      ts: Date.now(),
      ua: (navigator.userAgent || '').slice(0, 200)
    };

    let wrote = false;
    try {
      if (window.db && window.db.ref && reporterUid) {
        window.db.ref('reports').push(payload).catch(() => {});
        wrote = true;
      }
    } catch (e) {}

    // Always block locally as well — the user clearly does not want to see
    // this player again.
    setBlocked(target, true);
    applyBlockToUI();

    toast(wrote ? 'Report sent · player blocked' : 'Report saved · player blocked');
    if (typeof window.closeOppViewerBtn === 'function') window.closeOppViewerBtn();
  }

  function blockCurrentOpponent() {
    const target = currentTarget();
    if (!target || target.id === 'bot') return;
    setBlocked(target, true);
    applyBlockToUI();
    toast('Blocked ' + (target.name || 'player'));
    if (typeof window.closeOppViewerBtn === 'function') window.closeOppViewerBtn();
  }

  // Replace blocked names in the leaderboard rows and reaction bubbles with
  // a neutral placeholder. We re-run on a short interval because the live
  // multiplayer code re-renders these elements frequently.
  function applyBlockToUI() {
    const blocked = loadBlocked();
    const blockedNames = Object.values(blocked)
      .map(v => (v && v.name) ? String(v.name).toLowerCase() : null)
      .filter(Boolean);
    if (!blockedNames.length) return;

    document.querySelectorAll('.lb-name, .lb-row .lb-name, .reaction-bubble .rb-name').forEach(el => {
      const txt = (el.textContent || '').toLowerCase().trim();
      if (blockedNames.indexOf(txt) !== -1) {
        el.textContent = 'Blocked player';
        const row = el.closest('.lb-row');
        if (row) row.style.opacity = '0.4';
      }
    });
  }

  window.reportCurrentOpponent = reportCurrentOpponent;
  window.blockCurrentOpponent = blockCurrentOpponent;
  window.applyYumBlockToUI = applyBlockToUI;

  setInterval(applyBlockToUI, 1500);
})();
