// ─── ACHIEVEMENTS ────────────────────────────────────────────────────

// Achievements use the custom icon set (icn-* class names)
const ACHIEVEMENTS = [
  { id: 'first_game',    icon: 'icn-gamepad',  name: 'First Roll',    desc: 'Complete your first game',                    check: s => s.gamesPlayed >= 1 },
  { id: 'first_win',     icon: 'icn-trophy',   name: 'First Victory', desc: 'Win a game vs bot or multiplayer',             check: s => s.gamesWon >= 1 },
  { id: 'first_yum',     icon: 'icn-dice',     name: 'YAM!',          desc: 'Score a YAM! (5 of a kind)',                   check: s => s.yumCount >= 1 },
  { id: 'yum_x3',        icon: 'icn-target',   name: 'Triple YAM',    desc: 'Score YAM! 3 times',                          check: s => s.yumCount >= 3 },
  { id: 'yum_x10',       icon: 'icn-star',     name: 'YAM Master',    desc: 'Score YAM! 10 times',                         check: s => s.yumCount >= 10 },
  { id: 'full_house',    icon: 'icn-home',     name: 'Home Comforts', desc: 'Score a Full House',                          check: s => s.fullHouseCount >= 1 },
  { id: 'lg_straight',   icon: 'icn-bolt',     name: 'Full Straight', desc: 'Score a Large Straight',                      check: s => s.lgStraightCount >= 1 },
  { id: 'bonus',         icon: 'icn-gift',     name: 'Bonus Earner',  desc: 'Earn the upper section bonus (63+ pts)',       check: s => s.bonusCount >= 1 },
  { id: 'perfect_upper', icon: 'icn-sparkle',  name: 'Perfect Upper', desc: 'Max out all 6 upper categories in one game',  check: s => s.perfectUpperCount >= 1 },
  { id: 'score_250',     icon: 'icn-medal',    name: 'High Roller',   desc: 'Score 250+ points in a game',                 check: s => s.highScore >= 250 },
  { id: 'score_300',     icon: 'icn-gem',      name: 'Yahtzee Pro',   desc: 'Score 300+ points in a game',                 check: s => s.highScore >= 300 },
  { id: 'bot_slayer',    icon: 'icn-bot',      name: 'Bot Slayer',    desc: 'Beat the bot 5 times',                        check: s => s.botWins >= 5 },
  { id: 'no_scratch',    icon: 'icn-flame',    name: 'Clean Sheet',   desc: 'Finish a game without any scratches (zeros)', check: s => s.noScratchGames >= 1 },
  { id: 'games_10',      icon: 'icn-flag',     name: 'Dedicated',     desc: 'Play 10 games',                               check: s => s.gamesPlayed >= 10 },
  { id: 'games_25',      icon: 'icn-volcano',  name: 'Die-Hard',      desc: 'Play 25 games',                               check: s => s.gamesPlayed >= 25 },
];

function _achIconHtml(icon) {
  if (typeof icon === 'string' && icon.startsWith('icn-')) {
    return '<i class="icn ' + icon + ' icn-gold"></i>';
  }
  return icon || '';
}

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
  document.getElementById('achNotifIcon').innerHTML = _achIconHtml(ach.icon);
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
    for (const ach of newlyUnlocked) {
      showAchievementNotif(ach);
      // Ask the server to credit the achievement reward. The server keeps
      // a no-replay record under /users/$uid/achievements; a second call
      // for the same id no-ops.
      if (window.YumCloud && typeof window.YumCloud.grantAchievementCredits === 'function') {
        window.YumCloud.grantAchievementCredits({ achievementId: ach.id })
          .then(() => {
            if (typeof window.hydrateYumCreditsFromFirebase === 'function') {
              window.hydrateYumCreditsFromFirebase();
            }
          })
          .catch(() => {});
      }
    }
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
      <div class="ach-icon">${_achIconHtml(ach.icon)}</div>
      <div class="ach-name">${ach.name}</div>
      <div class="ach-desc">${ach.desc}</div>
      ${u ? `<div class="ach-date"><i class="icn icn-check"></i> ${dateStr}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Patch confirmScore: track per-score achievements ──────────────────
(function() {
  const _orig = confirmScore;
  confirmScore = function() {
    const catId    = activeModal;
    const hadScore = catId ? scores.hasOwnProperty(catId) : true;
    _orig.apply(this, arguments);
    if (catId && !hadScore && scores.hasOwnProperty(catId)) {
      achOnScore(catId, scores[catId]);
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
      .dp-strike-title { color: var(--accent); }
      .dp-strike-chip {
        background: rgba(233,69,96,0.09);
        border-color: rgba(233,69,96,0.28);
      }
      .dp-strike-best {
        background: rgba(233,69,96,0.18);
        border-color: rgba(233,69,96,0.6);
      }
      .dp-best-badge {
        font-size: 0.56rem;
        font-weight: 900;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--accent);
        background: rgba(233,69,96,0.18);
        border-radius: 999px;
        padding: 1px 5px;
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

  // Rough value you give up by permanently zeroing a category — lower means
  // it's the cheapest to sacrifice when you're forced to strike. Upper boxes
  // are ordered by face value; lower boxes by how realistically they fill.
  const STRIKE_COST = {
    ones: 2, twos: 4, threes: 6, fours: 8, fives: 10, sixes: 12,
    yum: 7, lgStraight: 13, fourKind: 15, threeKind: 21,
    fullHouse: 22, chance: 23, smStraight: 25
  };

  // When no category can score this roll the player must strike one. Rank the
  // still-open categories so the one you can best afford to throw away is first.
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

    // Yam or Strike power-up locks the turn to Yum — no other category is scorable.
    if (typeof yamOrStrikeActive !== 'undefined' && yamOrStrikeActive) {
      panel.innerHTML = '<div class="dp-empty">YAM OR STRIKE — only Yum can be scored this turn</div>';
      return;
    }

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

    ['renderDice', 'renderScores', 'rollDice', 'toggleHold', 'cycleDie', 'clearDice', 'confirmScore'].forEach(patchFunction);

    // Extra refresh for Firebase/multiplayer and bot turn UI changes.
    setInterval(renderPossibilities, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPossibilities);
  } else {
    initPossibilities();
  }
})();
