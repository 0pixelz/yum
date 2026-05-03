// ─── UPPER BONUS NEEDED HELPER ───────────────────────────────────────
// Shows, on the right side of each upper row, how many more dice/points are
// needed to stay on track for the 63-point upper bonus.

(function() {
  const UPPER_TARGET = 63;
  const UPPER_IDS_LOCAL = ['ones', 'twos', 'threes', 'fours', 'fives', 'sixes'];
  const FACE_BY_ID = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };

  function injectStyles() {
    if (document.getElementById('upperBonusHelperStyles')) return;
    const style = document.createElement('style');
    style.id = 'upperBonusHelperStyles';
    style.textContent = `
      .upper-needed-helper {
        min-width: 52px;
        text-align: right;
        font-size: .68rem;
        line-height: 1.05;
        font-weight: 900;
        letter-spacing: .4px;
        color: var(--muted);
      }
      .upper-needed-helper .need-main {
        display: block;
        color: var(--green);
        font-size: .78rem;
      }
      .upper-needed-helper.warning .need-main { color: var(--gold); }
      .upper-needed-helper.danger .need-main { color: var(--accent); }
      .upper-needed-helper.done .need-main { color: var(--green); }
      .upper-needed-helper .need-sub {
        display: block;
        margin-top: 2px;
        opacity: .75;
        font-size: .58rem;
      }
    `;
    document.head.appendChild(style);
  }

  function safeScores() {
    try { return scores || {}; } catch(e) { return {}; }
  }

  function currentUpperTotal() {
    const s = safeScores();
    return UPPER_IDS_LOCAL.reduce((sum, id) => sum + (Number(s[id]) || 0), 0);
  }

  function isFilled(id) {
    const s = safeScores();
    return s[id] !== undefined && s[id] !== null;
  }

  function possibleRemainingMax(excludeId) {
    return UPPER_IDS_LOCAL.reduce((sum, id) => {
      if (id === excludeId || isFilled(id)) return sum;
      return sum + FACE_BY_ID[id] * 5;
    }, 0);
  }

  function helperFor(id) {
    const face = FACE_BY_ID[id];
    const totalNow = currentUpperTotal();
    const already = Number(safeScores()[id]) || 0;
    const filled = isFilled(id);
    const otherRemainingMax = possibleRemainingMax(id);

    if (totalNow >= UPPER_TARGET) {
      return { main: '✓', sub: 'bonus', state: 'done' };
    }

    if (filled) {
      const stillNeed = Math.max(0, UPPER_TARGET - totalNow);
      return { main: `+${stillNeed}`, sub: 'pts left', state: stillNeed > 18 ? 'danger' : stillNeed > 8 ? 'warning' : '' };
    }

    const neededFromThisCategory = Math.max(0, UPPER_TARGET - totalNow - otherRemainingMax);
    const diceNeeded = Math.ceil(neededFromThisCategory / face);

    if (neededFromThisCategory <= 0) {
      const totalNeed = Math.max(0, UPPER_TARGET - totalNow);
      return { main: `+${totalNeed}`, sub: 'total need', state: '' };
    }

    const cappedDice = Math.min(5, Math.max(0, diceNeeded));
    return {
      main: `${cappedDice}×${face}`,
      sub: `need ${neededFromThisCategory}`,
      state: cappedDice >= 5 ? 'danger' : cappedDice >= 4 ? 'warning' : ''
    };
  }

  function findUpperRows() {
    const rows = [];
    document.querySelectorAll('.score-row').forEach(row => {
      const title = row.querySelector('.score-title, .score-name, h3, strong');
      const text = (row.textContent || '').toLowerCase();
      let id = null;
      if (text.includes('ones')) id = 'ones';
      else if (text.includes('twos')) id = 'twos';
      else if (text.includes('threes')) id = 'threes';
      else if (text.includes('fours')) id = 'fours';
      else if (text.includes('fives')) id = 'fives';
      else if (text.includes('sixes')) id = 'sixes';
      if (id) rows.push({ row, id });
    });
    return rows;
  }

  function renderHelpers() {
    injectStyles();
    findUpperRows().forEach(({ row, id }) => {
      let helper = row.querySelector('.upper-needed-helper');
      if (!helper) {
        helper = document.createElement('div');
        helper.className = 'upper-needed-helper';
        const scoreValue = row.querySelector('.score-value');
        if (scoreValue) scoreValue.insertAdjacentElement('beforebegin', helper);
        else row.appendChild(helper);
      }

      const info = helperFor(id);
      helper.className = `upper-needed-helper ${info.state || ''}`.trim();
      helper.innerHTML = `<span class="need-main">${info.main}</span><span class="need-sub">${info.sub}</span>`;
    });
  }

  function patchFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__upperBonusHelperPatched) return;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(renderHelpers, 0);
      return result;
    };
    patched.__upperBonusHelperPatched = true;
    window[name] = patched;
  }

  function init() {
    injectStyles();
    ['renderScores', 'confirmScore', 'deleteScore', 'rollDice', 'clearDice'].forEach(patchFunction);
    setTimeout(renderHelpers, 0);

    const section = document.getElementById('scoreSection');
    if (section) new MutationObserver(renderHelpers).observe(section, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
