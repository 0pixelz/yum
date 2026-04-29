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

// ─── ACHIEVEMENT PROGRESS BARS ───────────────────────────────────────
// Adds a small progress/loading bar to every achievement card.
// Progress is capped visually at 500 for long-term stats.

(function() {
  const MAX_PROGRESS_CAP = 500;

  function injectAchievementProgressStyles() {
    if (document.getElementById('achievementProgressStyles')) return;
    const style = document.createElement('style');
    style.id = 'achievementProgressStyles';
    style.textContent = `
      .ach-card .ach-mini-progress {
        width: 100%;
        height: 6px;
        margin-top: 9px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.06);
      }
      .ach-card .ach-mini-fill {
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--green), var(--gold));
        transition: width 0.45s ease;
      }
      .ach-card.locked .ach-mini-fill {
        background: linear-gradient(90deg, var(--accent), var(--gold));
      }
      .ach-card .ach-mini-label {
        margin-top: 5px;
        font-size: 0.64rem;
        font-weight: 800;
        color: var(--muted);
        letter-spacing: 0.5px;
      }
      .ach-card.unlocked .ach-mini-label {
        color: var(--green);
      }
    `;
    document.head.appendChild(style);
  }

  function safeNumber(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function achievementProgress(ach, stats, unlocked) {
    const done = !!unlocked[ach.id];
    let current = 0;
    let target = 1;
    let label = '';

    switch (ach.id) {
      case 'first_game':
        current = safeNumber(stats.gamesPlayed); target = 1; label = 'games'; break;
      case 'first_win':
        current = safeNumber(stats.gamesWon); target = 1; label = 'wins'; break;
      case 'first_yum':
        current = safeNumber(stats.yumCount); target = 1; label = 'YUMs'; break;
      case 'yum_x3':
        current = safeNumber(stats.yumCount); target = 3; label = 'YUMs'; break;
      case 'yum_x10':
        current = safeNumber(stats.yumCount); target = 10; label = 'YUMs'; break;
      case 'full_house':
        current = safeNumber(stats.fullHouseCount); target = 1; label = 'full houses'; break;
      case 'lg_straight':
        current = safeNumber(stats.lgStraightCount); target = 1; label = 'large straights'; break;
      case 'bonus':
        current = safeNumber(stats.bonusCount); target = 1; label = 'bonuses'; break;
      case 'perfect_upper':
        current = safeNumber(stats.perfectUpperCount); target = 1; label = 'perfect uppers'; break;
      case 'score_250':
        current = safeNumber(stats.highScore); target = 250; label = 'best pts'; break;
      case 'score_300':
        current = safeNumber(stats.highScore); target = 300; label = 'best pts'; break;
      case 'bot_slayer':
        current = safeNumber(stats.botWins); target = 5; label = 'bot wins'; break;
      case 'no_scratch':
        current = safeNumber(stats.noScratchGames); target = 1; label = 'clean games'; break;
      case 'games_10':
        current = safeNumber(stats.gamesPlayed); target = 10; label = 'games'; break;
      case 'games_25':
        current = safeNumber(stats.gamesPlayed); target = 25; label = 'games'; break;
      default:
        current = done ? 1 : 0; target = 1; label = 'progress';
    }

    // Cap the display values at 500 so very large totals do not overwhelm the UI.
    const displayTarget = Math.min(target, MAX_PROGRESS_CAP);
    const displayCurrent = Math.min(current, displayTarget, MAX_PROGRESS_CAP);
    const pct = done ? 100 : Math.min(100, Math.round((displayCurrent / displayTarget) * 100));
    const text = done
      ? `Complete · ${Math.min(current, MAX_PROGRESS_CAP)}/${displayTarget}${current > MAX_PROGRESS_CAP ? '+' : ''} ${label}`
      : `${Math.min(current, MAX_PROGRESS_CAP)}/${displayTarget}${current > MAX_PROGRESS_CAP ? '+' : ''} ${label}`;

    return { pct, text };
  }

  function renderAchievementProgressBars() {
    injectAchievementProgressStyles();

    if (typeof ACHIEVEMENTS === 'undefined' || typeof loadAchStats !== 'function' || typeof loadUnlocked !== 'function') return;

    const grid = document.getElementById('achGrid');
    if (!grid) return;

    const stats = loadAchStats();
    const unlocked = loadUnlocked();
    const cards = grid.querySelectorAll('.ach-card');

    cards.forEach((card, index) => {
      const ach = ACHIEVEMENTS[index];
      if (!ach) return;

      const progress = achievementProgress(ach, stats, unlocked);
      let wrap = card.querySelector('.ach-mini-progress');
      let label = card.querySelector('.ach-mini-label');

      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'ach-mini-progress';
        wrap.innerHTML = '<div class="ach-mini-fill"></div>';
        card.appendChild(wrap);
      }
      if (!label) {
        label = document.createElement('div');
        label.className = 'ach-mini-label';
        card.appendChild(label);
      }

      const fill = wrap.querySelector('.ach-mini-fill');
      if (fill) fill.style.width = `${progress.pct}%`;
      label.textContent = progress.text;
    });
  }

  function patchAchievementsRender() {
    if (typeof window.renderAchievements !== 'function') return;
    if (window.renderAchievements.__progressPatched) return;

    const original = window.renderAchievements;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(renderAchievementProgressBars, 0);
      return result;
    };
    patched.__progressPatched = true;
    window.renderAchievements = patched;
  }

  function initAchievementProgress() {
    injectAchievementProgressStyles();
    patchAchievementsRender();
    setTimeout(renderAchievementProgressBars, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAchievementProgress);
  } else {
    initAchievementProgress();
  }
})();
