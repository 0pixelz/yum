// ─── SCORECARD REMAINING-WORK VISIBILITY ─────────────────────────────
// Makes it obvious which categories the player still has to fill on the
// scorecard under the dice-rolling area. Adds:
//   • A "X LEFT" header per section with a slim progress bar.
//   • A bright left-edge accent + pulsing "TO DO" dot on unfilled rows.
//   • A muted ✓ on filled rows so they visibly recede.

(function() {
  const UPPER = ['ones','twos','threes','fours','fives','sixes'];
  const LOWER_BY_TEXT = ['three of a kind','four of a kind','full house','small straight','large straight','yahtzee','yum','chance'];

  function injectStyles() {
    if (document.getElementById('scorecardRemainingStyles')) return;
    const style = document.createElement('style');
    style.id = 'scorecardRemainingStyles';
    style.textContent = `
      .section-remaining {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .section-remaining .sr-count {
        font-family: 'Bebas Neue', cursive;
        font-size: 1.05rem;
        letter-spacing: 2px;
        color: var(--gold);
        white-space: nowrap;
      }
      .section-remaining .sr-count.done {
        color: var(--green);
      }
      .section-remaining .sr-bar {
        flex: 1;
        height: 6px;
        background: rgba(255,255,255,0.08);
        border-radius: 999px;
        overflow: hidden;
      }
      .section-remaining .sr-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--accent), var(--gold));
        border-radius: 999px;
        transition: width .35s ease;
      }
      .section-remaining .sr-fill.done {
        background: var(--green);
      }
      .section-remaining .sr-icon {
        font-size: 1rem;
        color: var(--gold);
      }
      .section-remaining .sr-icon.done { color: var(--green); }

      /* Make unfilled rows POP so it's obvious what's left */
      .score-row:not(.filled) {
        position: relative;
        background: rgba(245,166,35,0.04);
      }
      .score-row:not(.filled)::before {
        content: '';
        position: absolute;
        left: 0; top: 6px; bottom: 6px;
        width: 3px;
        border-radius: 0 3px 3px 0;
        background: var(--gold);
        box-shadow: 0 0 8px rgba(245,166,35,0.5);
      }
      .score-row.suggested:not(.filled)::before {
        background: var(--green);
        box-shadow: 0 0 10px rgba(78,205,196,0.6);
      }

      /* Pulsing "TO DO" dot tucked next to the score-name */
      .todo-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--gold);
        margin-right: 6px;
        vertical-align: middle;
        box-shadow: 0 0 6px rgba(245,166,35,0.6);
        animation: todoDotPulse 1.6s ease-in-out infinite;
      }
      .score-row.suggested .todo-dot {
        background: var(--green);
        box-shadow: 0 0 8px rgba(78,205,196,0.7);
      }
      @keyframes todoDotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: .35; transform: scale(.7); }
      }

      /* Filled rows: visibly DONE so they recede */
      .score-row.filled {
        opacity: 0.55;
        background: rgba(255,255,255,0.015);
      }
      .score-row.filled .score-name::before {
        content: '\\2713';
        display: inline-block;
        margin-right: 6px;
        color: var(--green);
        font-weight: 900;
        font-size: 0.85em;
        opacity: .85;
      }
      .score-row.filled.scratched .score-name::before {
        content: '\\2715';
        color: var(--accent);
      }
    `;
    document.head.appendChild(style);
  }

  function safeScores() {
    try { return scores || {}; } catch(e) { return {}; }
  }

  function rowCategoryId(row) {
    const text = (row.textContent || '').toLowerCase();
    for (const id of UPPER) if (text.includes(id)) return id;
    if (text.includes('three of a kind')) return 'threeOfAKind';
    if (text.includes('four of a kind'))  return 'fourOfAKind';
    if (text.includes('full house'))      return 'fullHouse';
    if (text.includes('small straight'))  return 'smallStraight';
    if (text.includes('large straight'))  return 'largeStraight';
    if (text.includes('yahtzee') || text.includes('yum')) return 'yum';
    if (text.includes('chance'))          return 'chance';
    return null;
  }

  function isFilled(row) {
    if (row.classList.contains('filled')) return true;
    const id = rowCategoryId(row);
    if (!id) return false;
    const s = safeScores();
    return s[id] !== undefined && s[id] !== null;
  }

  function addTodoDots() {
    document.querySelectorAll('.score-row').forEach(row => {
      const name = row.querySelector('.score-name');
      if (!name) return;
      const existing = name.querySelector('.todo-dot');
      if (isFilled(row)) {
        if (existing) existing.remove();
      } else if (!existing) {
        const dot = document.createElement('span');
        dot.className = 'todo-dot';
        dot.setAttribute('aria-label', 'unfilled');
        name.insertBefore(dot, name.firstChild);
      }
    });
  }

  function addSectionRemaining() {
    document.querySelectorAll('.score-section .score-card').forEach(card => {
      const rows = card.querySelectorAll('.score-row');
      if (rows.length === 0) return;
      const total = rows.length;
      let filled = 0;
      rows.forEach(r => { if (isFilled(r)) filled++; });
      const remaining = total - filled;
      const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
      const done = remaining === 0;

      let bar = card.querySelector('.section-remaining');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'section-remaining';
        // Insert right after the section title block (first child div)
        const firstChild = card.firstElementChild;
        if (firstChild && firstChild.nextSibling) {
          card.insertBefore(bar, firstChild.nextSibling);
        } else {
          card.insertBefore(bar, card.firstChild);
        }
      }

      const label = done
        ? `<i class="icn icn-check"></i> ALL DONE`
        : `${remaining} LEFT`;
      bar.innerHTML = `
        <span class="sr-count ${done ? 'done' : ''}">${label}</span>
        <div class="sr-bar"><div class="sr-fill ${done ? 'done' : ''}" style="width:${pct}%"></div></div>
        <span class="sr-icon ${done ? 'done' : ''}" title="${filled} of ${total} filled">${filled}/${total}</span>
      `;
    });
  }

  function refresh() {
    injectStyles();
    addSectionRemaining();
    addTodoDots();
  }

  function patchFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__scorecardRemainingPatched) return;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(refresh, 0);
      return result;
    };
    patched.__scorecardRemainingPatched = true;
    window[name] = patched;
  }

  function init() {
    injectStyles();
    ['renderScores', 'confirmScore', 'rollDice', 'clearDice', 'cycleDie', 'toggleHold'].forEach(patchFunction);
    setTimeout(refresh, 0);

    const section = document.getElementById('scoreSection');
    if (section) {
      const observer = new MutationObserver(() => {
        // Avoid feedback loop: only re-render if our markers are missing
        const card = section.querySelector('.score-card');
        if (!card) return;
        if (!card.querySelector('.section-remaining') ||
            section.querySelector('.score-row:not(.filled):not(:has(.todo-dot))')) {
          refresh();
        }
      });
      observer.observe(section, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
