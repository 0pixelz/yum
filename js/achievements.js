// ─── ACHIEVEMENTS ────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  { id: 'first_game',    icon: '🎮', name: 'First Roll',    desc: 'Complete your first game',                    check: s => s.gamesPlayed >= 1 },
  { id: 'first_win',     icon: '🏆', name: 'First Victory', desc: 'Win a game vs bot or multiplayer',             check: s => s.gamesWon >= 1 },
  { id: 'first_yum',     icon: '🎲', name: 'YUM!',          desc: 'Score a YUM! (5 of a kind)',                   check: s => s.yumCount >= 1 },
  { id: 'yum_x3',        icon: '🎯', name: 'Triple YUM',    desc: 'Score YUM! 3 times',                          check: s => s.yumCount >= 3 },
  { id: 'yum_x10',       icon: '🌟', name: 'YUM Master',    desc: 'Score YUM! 10 times',                         check: s => s.yumCount >= 10 },
  { id: 'full_house',    icon: '🏠', name: 'Home Comforts', desc: 'Score a Full House',                          check: s => s.fullHouseCount >= 1 },
  { id: 'lg_straight',   icon: '📐', name: 'Full Straight', desc: 'Score a Large Straight',                      check: s => s.lgStraightCount >= 1 },
  { id: 'bonus',         icon: '⭐', name: 'Bonus Earner',  desc: 'Earn the upper section bonus (63+ pts)',       check: s => s.bonusCount >= 1 },
  { id: 'perfect_upper', icon: '💫', name: 'Perfect Upper', desc: 'Max out all 6 upper categories in one game',  check: s => s.perfectUpperCount >= 1 },
  { id: 'score_250',     icon: '🥇', name: 'High Roller',   desc: 'Score 250+ points in a game',                 check: s => s.highScore >= 250 },
  { id: 'score_300',     icon: '💎', name: 'Yahtzee Pro',   desc: 'Score 300+ points in a game',                 check: s => s.highScore >= 300 },
  { id: 'bot_slayer',    icon: '🤖', name: 'Bot Slayer',    desc: 'Beat the bot 5 times',                        check: s => s.botWins >= 5 },
  { id: 'no_scratch',    icon: '✨', name: 'Clean Sheet',   desc: 'Finish a game without any scratches (zeros)', check: s => s.noScratchGames >= 1 },
  { id: 'games_10',      icon: '🎖️',  name: 'Dedicated',    desc: 'Play 10 games',                               check: s => s.gamesPlayed >= 10 },
  { id: 'games_25',      icon: '🏅', name: 'Die-Hard',      desc: 'Play 25 games',                               check: s => s.gamesPlayed >= 25 },
];

function loadAchStats() {
  try { return JSON.parse(localStorage.getItem('yum_stats') || '{}'); } catch(e) { return {}; }
}
function saveAchStats(s) {
  localStorage.setItem('yum_stats', JSON.stringify(s));
}
function loadUnlocked() {
  try { return JSON.parse(localStorage.getItem('yum_achievements') || '{}'); } catch(e) { return {}; }
}
function saveUnlocked(u) {
  localStorage.setItem('yum_achievements', JSON.stringify(u));
}

let _achNotifTimer = null;
let _achNotifQueue = [];
let _achNotifBusy = false;

function _drainAchQueue() {
  if (_achNotifBusy || _achNotifQueue.length === 0) return;
  _achNotifBusy = true;
  const ach = _achNotifQueue.shift();
  document.getElementById('achNotifIcon').textContent = ach.icon;
  document.getElementById('achNotifName').textContent = ach.name;
  document.getElementById('achNotifDesc').textContent = ach.desc;
  const el = document.getElementById('achNotif');
  el.classList.add('show');
  if (typeof SFX !== 'undefined') SFX.score();
  if (_achNotifTimer) clearTimeout(_achNotifTimer);
  _achNotifTimer = setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { _achNotifBusy = false; _drainAchQueue(); }, 450);
  }, 3800);
}

function showAchievementNotif(ach) {
  _achNotifQueue.push(ach);
  _drainAchQueue();
}

function checkAchievements() {
  const stats = loadAchStats();
  const unlocked = loadUnlocked();
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (!unlocked[ach.id] && ach.check(stats)) {
      unlocked[ach.id] = { unlockedAt: Date.now() };
      newlyUnlocked.push(ach);
    }
  }
  if (newlyUnlocked.length > 0) {
    saveUnlocked(unlocked);
    for (const ach of newlyUnlocked) showAchievementNotif(ach);
  }
}

function achOnScore(catId, scored) {
  const stats = loadAchStats();
  if (catId === 'yum' && scored === 50)          stats.yumCount        = (stats.yumCount        || 0) + 1;
  if (catId === 'fullHouse' && scored === 25)    stats.fullHouseCount  = (stats.fullHouseCount  || 0) + 1;
  if (catId === 'lgStraight' && scored === 40)   stats.lgStraightCount = (stats.lgStraightCount || 0) + 1;
  saveAchStats(stats);
  checkAchievements();
}

function achOnGameEnd(myScores, iWon, isBotGame) {
  const stats = loadAchStats();
  const myTotal = calcTotal(myScores);

  stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
  stats.highScore   = Math.max(stats.highScore || 0, myTotal);

  if (iWon) {
    stats.gamesWon = (stats.gamesWon || 0) + 1;
    if (isBotGame) stats.botWins = (stats.botWins || 0) + 1;
  }

  // Upper bonus
  const upperIds = ['ones','twos','threes','fours','fives','sixes'];
  const upperTotal = upperIds.reduce((s, id) => s + (myScores[id] || 0), 0);
  if (upperTotal >= 63) stats.bonusCount = (stats.bonusCount || 0) + 1;

  // Perfect upper (max all 6)
  const maxUpper = { ones:5, twos:10, threes:15, fours:20, fives:25, sixes:30 };
  if (upperIds.every(id => myScores[id] === maxUpper[id])) {
    stats.perfectUpperCount = (stats.perfectUpperCount || 0) + 1;
  }

  // Clean sheet: all 13 filled and no zeros
  const allFilled = categories.every(c => myScores.hasOwnProperty(c.id));
  const noZeros   = Object.values(myScores).every(v => v > 0);
  if (allFilled && noZeros) stats.noScratchGames = (stats.noScratchGames || 0) + 1;

  saveAchStats(stats);
  checkAchievements();
}

function openAchievements() {
  renderAchievements();
  const ov = document.getElementById('achOverlay');
  ov.style.display = 'flex';
  requestAnimationFrame(() => ov.classList.add('open'));
}

function closeAchievements() {
  const ov = document.getElementById('achOverlay');
  ov.classList.remove('open');
  setTimeout(() => { ov.style.display = 'none'; }, 350);
}

function closeAchievementsOverlay(e) {
  if (e.target === document.getElementById('achOverlay')) closeAchievements();
}

function renderAchievements() {
  const unlocked  = loadUnlocked();
  const unlockedN = Object.keys(unlocked).length;
  const total     = ACHIEVEMENTS.length;

  document.getElementById('achProgressFill').style.width =
    `${Math.round(unlockedN / total * 100)}%`;
  document.getElementById('achProgressLabel').textContent =
    `${unlockedN} / ${total} unlocked`;

  document.getElementById('achGrid').innerHTML = ACHIEVEMENTS.map(ach => {
    const u = unlocked[ach.id];
    const dateStr = u ? new Date(u.unlockedAt).toLocaleDateString() : '';
    return `<div class="ach-card ${u ? 'unlocked' : 'locked'}">
      <div class="ach-icon">${ach.icon}</div>
      <div class="ach-name">${ach.name}</div>
      <div class="ach-desc">${ach.desc}</div>
      ${u ? `<div class="ach-date">✓ ${dateStr}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Patch confirmScore: track per-score achievements ──────────────────
(function() {
  const _orig = confirmScore;
  let _soloAchFired = false;
  confirmScore = function() {
    const catId    = activeModal;
    const hadScore = catId ? scores.hasOwnProperty(catId) : true;
    _orig.apply(this, arguments);
    if (catId && !hadScore && scores.hasOwnProperty(catId)) {
      achOnScore(catId, scores[catId]);
      // Solo/practice game completion detection
      if (!mpMode && !botMode) {
        const filled = Object.keys(scores).length;
        if (filled === 1) _soloAchFired = false; // first score of a new game
        if (filled === categories.length && !_soloAchFired) {
          _soloAchFired = true;
          setTimeout(() => achOnGameEnd({...scores}, false, false), 300);
        }
      }
    }
  };
})();

// ── Patch showGameOver: track end-of-game achievements ───────────────
(function() {
  const _orig = showGameOver;
  showGameOver = function(players) {
    _orig.apply(this, arguments);
    const me = players.find(p => p.isMe);
    if (me) {
      const iWon = players[0].isMe;
      setTimeout(() => achOnGameEnd({...scores}, iWon, botMode === true), 300);
    }
  };
})();

// ─── DICE POSSIBILITIES PANEL ────────────────────────────────────────
(function() {
  function injectPossibilityStyles() {
    if (document.getElementById('dicePossibilityStyles')) return;
    const style = document.createElement('style');
    style.id = 'dicePossibilityStyles';
    style.textContent = `
      .dice-possibilities {
        margin-top: 8px;
        font-size: 0.72rem;
        color: var(--muted);
      }
      .dp-title {
        text-align: center;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 1.4px;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .dp-list {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
      }
      .dp-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 7px;
        border-radius: 999px;
        background: rgba(78,205,196,0.09);
        border: 1px solid rgba(78,205,196,0.22);
        color: var(--white);
        cursor: pointer;
        max-width: 100%;
      }
      .dp-chip:active { transform: scale(0.97); }
      .dp-icon { font-size: 0.82rem; line-height: 1; }
      .dp-name {
        font-weight: 800;
        white-space: nowrap;
        color: var(--white);
      }
      .dp-points {
        color: var(--green);
        font-weight: 900;
        white-space: nowrap;
      }
      .dp-pct {
        color: var(--muted);
        font-size: 0.62rem;
        font-weight: 800;
      }
      .dp-empty {
        text-align: center;
        color: var(--muted);
        font-size: 0.68rem;
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

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
    const original = window[name];
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
    injectPossibilityStyles();
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
