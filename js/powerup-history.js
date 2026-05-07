// ─── POWER-UP HISTORY ────────────────────────────────────────────────────────
// Tracks each player's earned + used power-ups and surfaces them in the
// opponent viewer (tap a name in the leaderboard) and via toasts when an
// opponent earns a new power-up after rolling 5-of-a-kind.
//
// Loaded after powerup-mode.js and bot-powerups.js so it can wrap them.

(function () {
  if (typeof POWERUPS === 'undefined') return;

  // Flat history per actor — entries: { id, ts, source }
  window.playerPowerupHistory = { earned: [], used: [] };
  window.botPowerupHistory    = { earned: [], used: [] };

  function _now() { return Date.now(); }
  function _resetPlayerHistory() {
    playerPowerupHistory.earned.length = 0;
    playerPowerupHistory.used.length   = 0;
  }
  function _resetBotHistory() {
    botPowerupHistory.earned.length = 0;
    botPowerupHistory.used.length   = 0;
  }

  // ── PLAYER WRAPPERS ────────────────────────────────────────────────────────
  // selectPowerup(id, 'start'|'earn') — game start picks reset history first
  const _origSelectPowerup = window.selectPowerup;
  window.selectPowerup = function (id, context) {
    if (context === 'start') _resetPlayerHistory();
    playerPowerupHistory.earned.push({ id, ts: _now(), source: context || 'earn' });
    _origSelectPowerup(id, context);
  };

  // consumePowerup is called for every player power-up use (including freezeDie
  // and luckyDice via tryPowerupDieClick).
  const _origConsumePowerup = window.consumePowerup;
  window.consumePowerup = function (id) {
    if (playerPowerups.indexOf(id) >= 0) {
      playerPowerupHistory.used.push({ id, ts: _now() });
    }
    _origConsumePowerup(id);
  };

  // Sync history along with the rest of the live power-up state.
  const _origSyncPowerupsToDb = window.syncPowerupsToDb;
  window.syncPowerupsToDb = function () {
    if (!mpMode || !powerupMode || !roomRef) { _origSyncPowerupsToDb(); return; }
    roomRef.child('players/' + playerId + '/livePowerups').set({
      inventory: playerPowerups.slice(),
      pending: pendingPowerup || null,
      doubleActive: doublePointsActive,
      history: {
        earned: playerPowerupHistory.earned.slice(),
        used:   playerPowerupHistory.used.slice(),
      },
      ts: _now(),
    });
  };

  // ── BOT WRAPPERS ───────────────────────────────────────────────────────────
  if (typeof _botPickStarterPowerup === 'function') {
    const _orig = _botPickStarterPowerup;
    window._botPickStarterPowerup = function () {
      const p = _orig();
      botPowerupHistory.earned.push({ id: p.id, ts: _now(), source: 'start' });
      return p;
    };
  }
  if (typeof _botPickEarnedPowerup === 'function') {
    const _orig = _botPickEarnedPowerup;
    window._botPickEarnedPowerup = function () {
      const p = _orig();
      botPowerupHistory.earned.push({ id: p.id, ts: _now(), source: 'yum' });
      return p;
    };
  }
  if (typeof _botConsumePowerup === 'function') {
    const _orig = _botConsumePowerup;
    window._botConsumePowerup = function (id) {
      if (botPowerups.indexOf(id) >= 0) {
        botPowerupHistory.used.push({ id, ts: _now() });
      }
      _orig(id);
    };
  }
  if (typeof _botResetPowerups === 'function') {
    const _orig = _botResetPowerups;
    window._botResetPowerups = function () {
      _orig();
      _resetBotHistory();
    };
  }

  // ── MP: detect when an opponent earned a new power-up ──────────────────────
  // app.js already toasts when an opponent uses one (inventory shrunk).
  // Mirror that with an "earned" toast when their earned-history grows.
  const _earnPrev = {};
  function _checkOppEarn() {
    if (!mpMode || typeof powerupMode === 'undefined' || !powerupMode) return;
    if (typeof allPlayers !== 'object') return;
    Object.entries(allPlayers).forEach(([id, p]) => {
      if (id === playerId) return;
      const lp = p.livePowerups || {};
      const earnedHist = (lp.history && lp.history.earned) || [];
      const earnedTotal = earnedHist.length;
      const prev = _earnPrev[id];
      if (typeof prev === 'number' && earnedTotal > prev) {
        for (let i = prev; i < earnedTotal; i++) {
          const e = earnedHist[i];
          const pid = e && e.id;
          if (!pid) continue;
          const icon = POWERUP_ICONS[pid] || '<i class="icn icn-bolt"></i>';
          const def  = POWERUPS.find(x => x.id === pid);
          const pName = def ? def.name : pid;
          const label = (e.source === 'start') ? 'picked' : 'earned';
          showToast(`<i class="icn icn-bolt icn-gold"></i> ${p.name} ${label} ${icon} ${pName}!`);
        }
      }
      _earnPrev[id] = earnedTotal;
    });
  }
  if (typeof renderLeaderboard === 'function') {
    const _origRenderLb = window.renderLeaderboard;
    window.renderLeaderboard = function () {
      _origRenderLb();
      _checkOppEarn();
    };
  }

  // ── OPPONENT VIEWER: power-up section ──────────────────────────────────────
  function _resolvePups(targetId) {
    const own = (typeof playerId !== 'undefined' && targetId === playerId) || targetId === 'me';
    if (own) {
      return {
        inventory: (typeof playerPowerups !== 'undefined' ? playerPowerups : []).slice(),
        history: {
          earned: playerPowerupHistory.earned.slice(),
          used:   playerPowerupHistory.used.slice(),
        },
      };
    }
    if (targetId === 'bot') {
      return {
        inventory: (typeof botPowerups !== 'undefined' ? botPowerups : []).slice(),
        history: {
          earned: botPowerupHistory.earned.slice(),
          used:   botPowerupHistory.used.slice(),
        },
      };
    }
    if (typeof allPlayers === 'object' && allPlayers[targetId]) {
      const lp = allPlayers[targetId].livePowerups || {};
      return {
        inventory: (lp.inventory || []).slice(),
        history: {
          earned: ((lp.history && lp.history.earned) || []).slice(),
          used:   ((lp.history && lp.history.used) || []).slice(),
        },
      };
    }
    return { inventory: [], history: { earned: [], used: [] } };
  }

  function _renderPupChips(list) {
    if (!list.length) return '<div class="opp-pup-empty-row">— none —</div>';
    const counts = {};
    list.forEach(it => {
      const id = (typeof it === 'string') ? it : it.id;
      counts[id] = (counts[id] || 0) + 1;
    });
    return Object.entries(counts).map(([id, cnt]) => {
      const icon = POWERUP_ICONS[id] || '<i class="icn icn-bolt"></i>';
      const def  = POWERUPS.find(p => p.id === id);
      const name = def ? def.name : id;
      const color = def ? def.color : '#999';
      return `<span class="opp-pup-chip" style="--opc:${color}">
        <span class="opp-pup-chip-icon">${icon}</span>
        <span class="opp-pup-chip-name">${name}</span>
        ${cnt > 1 ? `<span class="opp-pup-chip-cnt">×${cnt}</span>` : ''}
      </span>`;
    }).join('');
  }

  const _origOpenOppViewer = window.openOppViewer;
  window.openOppViewer = function (targetId, targetName, targetScores, targetScoreDice) {
    _origOpenOppViewer(targetId, targetName, targetScores, targetScoreDice);
    if (typeof powerupMode === 'undefined' || !powerupMode) return;

    const data = _resolvePups(targetId);
    const totalEarned = data.history.earned.length;
    const totalUsed   = data.history.used.length;
    const totalInv    = data.inventory.length;

    if (totalEarned === 0 && totalInv === 0 && totalUsed === 0) return;

    const html = `
      <div class="opp-section-title">
        <i class="icn icn-bolt"></i> POWER-UPS
        <span class="opp-pup-summary">${totalEarned} earned · ${totalInv} left · ${totalUsed} used</span>
      </div>
      <div class="opp-pup-section">
        <div class="opp-pup-row">
          <div class="opp-pup-row-label">IN HAND</div>
          <div class="opp-pup-chips">${_renderPupChips(data.inventory)}</div>
        </div>
        <div class="opp-pup-row">
          <div class="opp-pup-row-label">USED</div>
          <div class="opp-pup-chips">${_renderPupChips(data.history.used)}</div>
        </div>
      </div>`;
    const content = document.getElementById('oppSheetContent');
    if (content) content.insertAdjacentHTML('afterbegin', html);
  };

  // ── Make own row tappable in bot+powerup mode so the player can review
  //    their own picks/uses without dipping into the inventory bar.
  if (typeof renderBotLeaderboard === 'function') {
    const _origRenderBotLb = window.renderBotLeaderboard;
    window.renderBotLeaderboard = function () {
      _origRenderBotLb();
      if (typeof powerupMode === 'undefined' || !powerupMode) return;
      if (!botMode) return;
      const lbRows = document.getElementById('lbRows');
      if (!lbRows) return;
      const meRow = lbRows.querySelector('.lb-row.me');
      if (!meRow) return;
      meRow.style.cursor = 'pointer';
      meRow.onclick = () => openOppViewer('me', playerName, scores, typeof playerScoreDice !== 'undefined' ? playerScoreDice : {});
      const nameEl = meRow.querySelector('.lb-name');
      if (nameEl && !nameEl.querySelector('.lb-self-tap-hint')) {
        const hint = document.createElement('span');
        hint.className = 'lb-self-tap-hint';
        hint.innerHTML = ' <i class="icn icn-eye"></i> tap';
        nameEl.appendChild(hint);
      }
    };
  }
})();
