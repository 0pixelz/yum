// ─── DICE POSSIBILITIES PANEL ────────────────────────────────────────
// Shows small, live scoring options for the current dice using only unfilled categories.

(function() {
  // Score options for a given hand using only unfilled categories. Defaults to
  // the live global `dice`, but accepts any 5-die array so other surfaces (e.g.
  // the 3D roll overlay) can preview the same suggestions for a hand that isn't
  // written back into the game state yet.
  function getPossibilities(hand) {
    try {
      const d = Array.isArray(hand) ? hand : dice;
      if (!Array.isArray(d) || !d.every(v => v > 0)) return [];
      if (!Array.isArray(categories)) return [];

      return categories
        .filter(cat => scores[cat.id] === undefined)
        .map(cat => ({ cat, points: cat.calc(d) }))
        .filter(item => item.points > 0)
        .sort((a, b) => b.points - a.points || b.cat.max - a.cat.max);
    } catch(e) {
      return [];
    }
  }

  // Rough value you give up by permanently zeroing a category — lower means
  // it's the cheapest to sacrifice when you're forced to strike.
  const STRIKE_COST = {
    ones: 2, twos: 4, threes: 6, fours: 8, fives: 10, sixes: 12,
    yum: 7, lgStraight: 13, fourKind: 15, threeKind: 21,
    fullHouse: 22, chance: 23, smStraight: 25
  };

  function getStrikeSuggestions() {
    try {
      if (!Array.isArray(categories)) return [];
      return categories
        .filter(cat => scores[cat.id] === undefined)
        .map(cat => ({ cat, cost: STRIKE_COST[cat.id] != null ? STRIKE_COST[cat.id] : (cat.max || 0) }))
        .sort((a, b) => a.cost - b.cost || a.cat.max - b.cat.max);
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
      const strikes = getStrikeSuggestions();
      if (!strikes.length) {
        panel.innerHTML = '<div class="dp-empty">No scoring option left for this roll · strike only</div>';
        return;
      }
      const strikeChips = strikes.slice(0, 8).map(({ cat }, i) => {
        const best = i === 0 ? ' dp-strike-best' : '';
        const badge = i === 0 ? '<span class="dp-best-badge">Best</span>' : '';
        return `<div class="dp-chip dp-strike-chip${best}" onclick="openModal('${cat.id}')">
          <span class="dp-icon">${categoryIcon(cat)}</span>
          <span class="dp-name">${cat.name}</span>
          ${badge}
        </div>`;
      }).join('');
      panel.innerHTML = `
        <div class="dp-title dp-strike-title">No score left · strike one (gives up the least first)</div>
        <div class="dp-list">${strikeChips}</div>
      `;
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

    ['renderDice', 'renderScores', 'rollDice', 'toggleHold', 'cycleDie', 'clearDice', 'confirmScore'].forEach(patchFunction);

    // Extra refresh for Firebase/multiplayer and bot turn UI changes.
    setInterval(renderPossibilities, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPossibilities);
  } else {
    initPossibilities();
  }

  // Public helpers so other surfaces (e.g. the 3D roll overlay) can reuse the
  // exact same scoring/strike suggestions for an arbitrary hand.
  window.computeDicePossibilities = function (hand) { return getPossibilities(hand); };
  window.computeStrikeSuggestions = function () { return getStrikeSuggestions(); };
})();
