// ─── MEGA YAM MODE ───────────────────────────────────────────────────
// Alternate scoring mode (vs Bot / solo). Once your YAM! box is filled
// with a real YAM (not a strike), every additional 5-of-a-kind you roll
// earns a +100 MEGA YAM bonus — but, just like the YAM box is already
// used, you must "strike" the extra YAM into another open category
// (joker placement). The bonus stacks on top of your normal scorecard.
// Normal / Power-Up modes are left untouched.
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

  // Real-Yahtzee scoring: the YAM! box is worth 50 (not the app's default
  // 30) in this mode, matching the printed Yahtzee scorecard. We mutate the
  // shared category object while Mega Yam is active and restore it on exit,
  // so the modal, suggestions, bot, and totals all stay consistent.
  const YAM_BOX_SCORE = 50;
  const yumCat = (typeof categories !== 'undefined')
    ? categories.find(c => c.id === 'yum') : null;
  const YUM_ORIG = yumCat
    ? { calc: yumCat.calc, max: yumCat.max, hint: yumCat.hint } : null;

  function applyYahtzeeScoring(on) {
    if (!yumCat || !YUM_ORIG) return;
    if (on) {
      yumCat.calc = d => Object.values(counts(d)).some(v => v === 5) ? YAM_BOX_SCORE : 0;
      yumCat.max  = YAM_BOX_SCORE;
      yumCat.hint = '5 of a kind → 50 pts';
    } else {
      yumCat.calc = YUM_ORIG.calc;
      yumCat.max  = YUM_ORIG.max;
      yumCat.hint = YUM_ORIG.hint;
    }
  }

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

    if (window.megaYamMode &&
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

  // ── Header grand-total hook ──────────────────────────────────────────
  const _megaOrigUpdateTotals = updateTotals;
  updateTotals = function (upperTotal, bonusEarned) {
    _megaOrigUpdateTotals(upperTotal, bonusEarned);
    if (!window.megaYamMode || bonusPlayer <= 0) return;
    const gt = document.getElementById('grandTotal');
    if (gt) {
      const base = parseInt(gt.textContent, 10) || 0;
      gt.textContent = base + bonusPlayer;
    }
    const pl = document.getElementById('progressLabel');
    if (pl) pl.textContent += ` · +${bonusPlayer} Mega Yam`;
  };

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
