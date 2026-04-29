// ─── DICE POSSIBILITIES PANEL ────────────────────────────────────────
// Shows small, live scoring options for the current dice using only unfilled categories.

(function() {
  function getPossibilities() {
    try {
      if (!Array.isArray(dice) || !dice.every(v => v > 0)) return [];
      if (!Array.isArray(categories)) return [];

      return categories
        .filter(cat => scores[cat.id] === undefined)
        .map(cat => ({ cat, points: cat.calc(dice) }))
        .filter(item => item.points > 0)
        .sort((a, b) => b.points - a.points || b.cat.max - a.cat.max);
    } catch(e) {
      return [];
    }
  }

  function ensurePossibilitiesPanel() {
    let panel = document.getElementById('dicePossibilities');
    if (panel) return panel;

    const rollCount = document.getElementById('rollCount');
    if (!rollCount) return null;

    panel = document.createElement('div');
    panel.id = 'dicePossibilities';
    panel.className = 'dice-possibilities';
    rollCount.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function categoryIcon(cat) {
    try {
      if (typeof renderIcon === 'function') return renderIcon(cat.icon);
    } catch(e) {}
    return cat.icon || '';
  }

  function renderPossibilities() {
    const panel = ensurePossibilitiesPanel();
    if (!panel) return;

    const hasDice = Array.isArray(dice) && dice.every(v => v > 0);
    if (!hasDice) {
      panel.innerHTML = '<div class="dp-empty">Roll all dice to see possible scores left</div>';
      return;
    }

    const options = getPossibilities();
    if (!options.length) {
      panel.innerHTML = '<div class="dp-empty">No scoring option left for this roll · strike only</div>';
      return;
    }

    const chips = options.slice(0, 8).map(({ cat, points }) => {
      const pct = cat.max ? Math.round((points / cat.max) * 100) : 0;
      return `<div class="dp-chip" onclick="openModal('${cat.id}')">
        <span class="dp-icon">${categoryIcon(cat)}</span>
        <span class="dp-name">${cat.name}</span>
        <span class="dp-points">${points} pts</span>
        <span class="dp-pct">${pct}%</span>
      </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="dp-title">Possible scores left</div>
      <div class="dp-list">${chips}</div>
    `;
  }

  function patchFunction(name) {
    const original = window[name] || (typeof globalThis !== 'undefined' ? globalThis[name] : null);
    if (typeof original !== 'function') return;
    if (original.__possibilitiesPatched) return;

    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(renderPossibilities, 0);
      return result;
    };
    patched.__possibilitiesPatched = true;
    window[name] = patched;
  }

  function initPossibilities() {
    ensurePossibilitiesPanel();
    renderPossibilities();

    ['renderDice', 'renderScores', 'rollDice', 'toggleHold', 'cycleDie', 'clearDice', 'confirmScore', 'deleteScore'].forEach(patchFunction);

    // Extra refresh for Firebase/multiplayer and bot turn UI changes.
    setInterval(renderPossibilities, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPossibilities);
  } else {
    initPossibilities();
  }
})();
