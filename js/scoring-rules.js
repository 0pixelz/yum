// ─── UPDATED SCORING RULES ───────────────────────────────────────────
// Custom scoring requested:
// Upper bonus = 25 pts
// YUM = 30 pts
// Large Straight = 20 pts
// Small Straight = 15 pts

(function() {
  const RULES = {
    upperBonusPoints: 25,
    yumPoints: 30,
    largeStraightPoints: 20,
    smallStraightPoints: 15
  };

  function patchCategories() {
    if (typeof categories === 'undefined' || !Array.isArray(categories)) return false;

    const sm = categories.find(c => c.id === 'smStraight');
    if (sm) {
      sm.hint = '4 sequential → 15 pts';
      sm.max = RULES.smallStraightPoints;
      sm.calc = d => {
        const u = [...new Set(d)].sort((a, b) => a - b);
        const s = u.join('');
        return ['1234', '2345', '3456'].some(p => s.includes(p)) ? RULES.smallStraightPoints : 0;
      };
    }

    const lg = categories.find(c => c.id === 'lgStraight');
    if (lg) {
      lg.hint = '5 sequential → 20 pts';
      lg.max = RULES.largeStraightPoints;
      lg.calc = d => {
        const u = [...new Set(d)].sort((a, b) => a - b);
        return (u.length === 5 && u[4] - u[0] === 4) ? RULES.largeStraightPoints : 0;
      };
    }

    const yum = categories.find(c => c.id === 'yum');
    if (yum) {
      yum.hint = '5 of a kind → 30 pts';
      yum.max = RULES.yumPoints;
      yum.calc = d => Object.values(counts(d)).some(v => v === 5) ? RULES.yumPoints : 0;
    }

    return true;
  }

  function upperTotalValue() {
    return UPPER_IDS.reduce((s, id) => s + (scores[id] || 0), 0);
  }

  function bonusEarnedValue(upperTotal) {
    return upperTotal >= BONUS_TARGET;
  }

  function patchTotals() {
    window.updateTotals = function updateTotalsCustom(upperTotal, bonusEarned) {
      upperTotal = typeof upperTotal === 'number' ? upperTotal : upperTotalValue();
      bonusEarned = typeof bonusEarned === 'boolean' ? bonusEarned : bonusEarnedValue(upperTotal);

      const lowerTotal = categories
        .filter(c => c.section === 'lower')
        .reduce((s, c) => s + (scores[c.id] || 0), 0);

      const grand = upperTotal + lowerTotal + (bonusEarned ? RULES.upperBonusPoints : 0);
      const filled = Object.keys(scores).length;
      const total = categories.length;
      const pct = Math.round((filled / total) * 100);

      document.getElementById('grandTotal').textContent = grand;
      document.getElementById('totalSub').textContent = `${filled} of ${total} filled`;
      document.getElementById('globalProgress').style.width = pct + '%';
      document.getElementById('progressLabel').textContent = `${pct}% Complete · ${grand} pts`;
    };
  }

  function polishBonusText() {
    document.querySelectorAll('.bonus-sub').forEach(el => {
      el.innerHTML = el.innerHTML.replace('→ +35 bonus', '→ +25 bonus');
    });
    document.querySelectorAll('.bonus-val').forEach(el => {
      if ((el.textContent || '').trim() === '+35') el.textContent = '+25';
    });
  }

  function patchRenderScores() {
    if (typeof renderScores !== 'function' || renderScores.__scoringRulesPatched) return;
    const original = renderScores;
    const patched = function(...args) {
      patchCategories();
      patchTotals();
      const result = original.apply(this, args);
      setTimeout(() => {
        polishBonusText();
        patchTotals();
        const upperTotal = upperTotalValue();
        window.updateTotals(upperTotal, bonusEarnedValue(upperTotal));
      }, 0);
      return result;
    };
    patched.__scoringRulesPatched = true;
    window.renderScores = patched;
  }

  function patchScoreConfirmSounds() {
    if (typeof confirmScore !== 'function' || confirmScore.__yum30Patched) return;
    const original = confirmScore;
    const patched = function(...args) {
      // Original code checks selectedScore === 50 for YUM sound.
      // Keep behavior by playing YUM sound manually for 30-point YUM before original runs.
      if (activeModal === 'yum' && selectedScore === RULES.yumPoints && window.SFX && SFX.yum) {
        try { SFX.yum(); } catch(e) {}
      }
      return original.apply(this, args);
    };
    patched.__yum30Patched = true;
    window.confirmScore = patched;
  }

  function initScoringRules() {
    patchCategories();
    patchTotals();
    patchRenderScores();
    patchScoreConfirmSounds();
    if (typeof renderScores === 'function') renderScores();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScoringRules);
  } else {
    initScoringRules();
  }

  setInterval(() => {
    patchCategories();
    patchTotals();
    patchRenderScores();
    polishBonusText();
  }, 1500);
})();
