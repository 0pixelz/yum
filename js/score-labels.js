// ─── SCORE LABEL POLISH ──────────────────────────────────────────────
// Replaces suggested scoreboard labels like "12?" with "12 pts".

(function() {
  function polishScoreLabels() {
    document.querySelectorAll('.score-value span').forEach(span => {
      const raw = (span.textContent || '').trim();
      const match = raw.match(/^(\d+)\?$/);
      if (match) span.textContent = `${match[1]} pts`;
    });
  }

  function patchFunction(name) {
    const original = window[name];
    if (typeof original !== 'function') return;
    if (original.__scoreLabelPatched) return;

    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(polishScoreLabels, 0);
      return result;
    };
    patched.__scoreLabelPatched = true;
    window[name] = patched;
  }

  function initScoreLabels() {
    polishScoreLabels();
    ['renderScores', 'renderDice', 'rollDice', 'cycleDie', 'toggleHold', 'clearDice', 'confirmScore', 'deleteScore'].forEach(patchFunction);

    const observer = new MutationObserver(() => polishScoreLabels());
    const scoreSection = document.getElementById('scoreSection');
    if (scoreSection) observer.observe(scoreSection, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScoreLabels);
  } else {
    initScoreLabels();
  }
})();
