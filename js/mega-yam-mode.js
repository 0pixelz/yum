// ─── MEGA YAM MODE ───────────────────────────────────────────────────
// Alternate scoring mode (vs Bot and multiplayer). The YAM! box is worth
// 50 (real-Yahtzee value). Once a real YAM is banked, every additional
// 5-of-a-kind you roll earns a +100 MEGA YAM bonus — but, just like the
// YAM box is already used, you must "strike" the extra YAM into another
// open category (joker placement). The bonus stacks on top of the normal
// scorecard. Normal / Power-Up modes are left untouched.
//
// vs Bot: the bonus is tracked client-side here (bonusPlayer / bonusBot).
// Multiplayer: scoring is server-authoritative — the submitScore Cloud
// Function writes YAM=50 and increments /players/$uid/megaYamBonus, which
// every client reads off the room snapshot (see app.js leaderboard/total
// sites). This module only handles the vs Bot path + the shared 50-pt
// YAM scoring toggle and the local header total.
(function () {
  'use strict';

  const MEGA_YAM_BONUS = 100;

  // Per-game running bonus totals (not part of the scorecard, so they
  // never affect the 13-category "filled" / game-over counts).
  let bonusPlayer = 0;
  let bonusBot    = 0;

  window.megaYamMode = false;
  window.megaYamPlayerBonus = function () { return bonusPlayer; };
  window.megaYamBotBonus    = function () { return bonusBot; };

  function resetMegaYam() { bonusPlayer = 0; bonusBot = 0; }
  window.resetMegaYam = resetMegaYam;

  // True 5-of-a-kind on a fully-rolled set of dice.
  function isYam(d) {
    if (!d || d.length !== 5 || !d.every(v => v > 0)) return false;
    return Object.values(counts(d)).some(v => v === 5);
  }

  // Category point values (YAM=50, straights 30/40, upper bonus 35 in this
  // mode) are owned by scoring-rules.js, which is mode-aware and re-applies
  // them on an interval. applyYahtzeeScoring just forces an immediate
  // re-render so the switch takes effect without waiting for that interval.
  function applyYahtzeeScoring(on) {
    if (typeof renderScores === 'function') renderScores();
  }
  window.applyYahtzeeScoring = applyYahtzeeScoring;

  // The local player's current Mega Yam bonus. In vs Bot it's tracked
  // client-side (bonusPlayer); in multiplayer the Cloud Function is
  // authoritative and the value rides on the room snapshot. scoring-rules.js
  // reads this to fold the bonus into the grand total.
  function selfBonus() {
    if (typeof mpMode !== 'undefined' && mpMode) {
      return (typeof allPlayers !== 'undefined' && typeof playerId !== 'undefined'
        && allPlayers[playerId] && allPlayers[playerId].megaYamBonus) || 0;
    }
    return bonusPlayer;
  }
  window.megaYamSelfBonus = selfBonus;

  function celebrate(isPlayer, total) {
    try { if (window.SFX && typeof SFX.yum === 'function') SFX.yum(); } catch (e) {}
    const who = isPlayer ? 'You' : (typeof botName !== 'undefined' ? botName : 'Bot');
    if (typeof showToast === 'function') {
      showToast(`MEGA YAM! ${who} +${MEGA_YAM_BONUS} bonus (total +${total})`);
    }
  }

  // ── Player scoring hook ──────────────────────────────────────────────
  const _megaOrigConfirmScore = confirmScore;
  confirmScore = function () {
    // Capture state BEFORE the original runs — it clears the dice and
    // closes the modal.
    const id   = activeModal;
    const dSet = dice.slice();
    const sel  = selectedScore;
    const hadYam = scores.yum !== undefined && scores.yum > 0;

    _megaOrigConfirmScore();

    // Multiplayer scoring is server-authoritative (the Cloud Function awards
    // the bonus and the MP confirmScore path celebrates it), so only run the
    // client-side award in vs Bot / solo here.
    const isMp = (typeof mpMode !== 'undefined' && mpMode);
    if (!isMp && window.megaYamMode &&
        sel !== null && sel !== undefined &&
        id && id !== 'yum' &&
        hadYam && isYam(dSet)) {
      bonusPlayer += MEGA_YAM_BONUS;
      celebrate(true, bonusPlayer);
      if (typeof renderScores === 'function') renderScores();
    }
  };

  // ── Bot scoring hook ─────────────────────────────────────────────────
  if (typeof finishBotTurn === 'function') {
    const _megaOrigFinishBotTurn = finishBotTurn;
    finishBotTurn = function (move) {
      const hadYam = (typeof botScores !== 'undefined') &&
                     botScores.yum !== undefined && botScores.yum > 0;
      const dSet = (typeof botDice !== 'undefined' && botDice) ? botDice.slice() : null;

      _megaOrigFinishBotTurn(move);

      if (window.megaYamMode &&
          move && move.cat && move.cat.id !== 'yum' &&
          hadYam && isYam(dSet)) {
        bonusBot += MEGA_YAM_BONUS;
        celebrate(false, bonusBot);
        if (typeof renderBotLeaderboard === 'function') renderBotLeaderboard();
      }
    };
  }

  // Header grand-total: scoring-rules.js owns updateTotals (it re-installs
  // its own on every render) and folds in window.megaYamSelfBonus(), so we
  // don't wrap updateTotals here — it would just be overwritten.

  // ── Bot leaderboard hook (fix both rows + ranks for the bonus) ───────
  if (typeof renderBotLeaderboard === 'function') {
    const _megaOrigRenderBotLeaderboard = renderBotLeaderboard;
    renderBotLeaderboard = function () {
      _megaOrigRenderBotLeaderboard();
      if (!window.megaYamMode || (bonusPlayer <= 0 && bonusBot <= 0)) return;
      if (typeof botMode === 'undefined' || !botMode) return;

      const pTotal = calcTotal(scores) + bonusPlayer;
      const bTotal = calcTotal(botScores) + bonusBot;

      const meRow  = document.querySelector('#lbRows .lb-row.me');
      const botRow = document.querySelector('#lbRows .lb-row:not(.me)');
      const meScore  = meRow  ? meRow.querySelector('.lb-score')  : null;
      const botScoreEl = botRow ? botRow.querySelector('.lb-score') : null;
      if (meScore)    meScore.textContent    = pTotal;
      if (botScoreEl) botScoreEl.textContent = bTotal;

      const meRank  = meRow  ? meRow.querySelector('.lb-rank')  : null;
      const botRank = botRow ? botRow.querySelector('.lb-rank') : null;
      if (meRank && botRank) {
        const pLead = pTotal >= bTotal;
        meRank.textContent  = pLead ? '1' : '2';
        botRank.textContent = pLead ? '2' : '1';
      }
    };
  }

  // ── Final results hook (fold the bonus into the win/lose totals) ─────
  if (typeof showBotGameOver === 'function') {
    showBotGameOver = function () {
      const pTotal = calcTotal(scores)    + (window.megaYamMode ? bonusPlayer : 0);
      const bTotal = calcTotal(botScores) + (window.megaYamMode ? bonusBot    : 0);
      const players = [
        { name: playerName, score: pTotal, isMe: true },
        { name: botName,    score: bTotal, isMe: false }
      ].sort((a, b) => b.score - a.score);
      setTimeout(() => showGameOver(players), 600);
    };
  }

  // ── Mode selection / lifecycle hooks ─────────────────────────────────
  // chooseBotMode('megayam') → startVsBot('megayam'); flag set here.
  if (typeof startVsBot === 'function') {
    const _megaOrigStartVsBot = startVsBot;
    startVsBot = function (mode) {
      window.megaYamMode = (mode === 'megayam');
      resetMegaYam();
      applyYahtzeeScoring(window.megaYamMode);
      _megaOrigStartVsBot(mode);
    };
  }

  // Rematch keeps the same mode but starts the bonus fresh.
  if (typeof rematch === 'function') {
    const _megaOrigRematch = rematch;
    rematch = function () {
      if (window.megaYamMode) resetMegaYam();
      _megaOrigRematch();
    };
  }

  // Leaving a game clears Mega Yam so it never leaks into another mode.
  if (typeof quitGame === 'function') {
    const _megaOrigQuitGame = quitGame;
    quitGame = function () {
      window.megaYamMode = false;
      resetMegaYam();
      applyYahtzeeScoring(false);
      _megaOrigQuitGame();
    };
  }
  if (typeof leaveGame === 'function') {
    const _megaOrigLeaveGame = leaveGame;
    leaveGame = function () {
      window.megaYamMode = false;
      resetMegaYam();
      applyYahtzeeScoring(false);
      _megaOrigLeaveGame();
    };
  }
})();
