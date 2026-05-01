// ─── FIREBASE + UI HELPERS ───────────────────────────────────────────
// Score label polish, achievement progress bars, popup position fixes,
// multiplayer Firebase retry, and win-diamond player badges.

(function() {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBl1XezlXttwyQLBsEJJV0nkxomzL0uhZw",
    authDomain: "yum-game.firebaseapp.com",
    databaseURL: "https://yum-game-default-rtdb.firebaseio.com",
    projectId: "yum-game",
    storageBucket: "yum-game.firebasestorage.app",
    messagingSenderId: "418931435506",
    appId: "1:418931435506:web:1f37261a6bf89c596b2d6b"
  };

  const DIAMOND_MILESTONES = [50, 100, 200, 500];

  function ensureFirebaseDb() {
    try {
      if (!window.firebase || !firebase.database) return null;
      if (!firebase.apps || firebase.apps.length === 0) firebase.initializeApp(FIREBASE_CONFIG);
      window.db = firebase.database();
      try { window.eval('var db = window.db;'); } catch(e) {}
      return window.db;
    } catch(e) {
      console.warn('Firebase unavailable:', e);
      window.db = null;
      return null;
    }
  }
  window.ensureFirebaseDb = window.ensureFirebaseDb || ensureFirebaseDb;
  ensureFirebaseDb();

  async function waitForDb() {
    let database = ensureFirebaseDb();
    if (database) return database;
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      database = ensureFirebaseDb();
      if (database) return database;
    }
    return null;
  }

  function patchAsyncFunction(name, before) {
    const original = window[name];
    if (typeof original !== 'function' || original[`__${before.name}Patched`]) return;
    const patched = async function(...args) {
      await before();
      return original.apply(this, args);
    };
    patched[`__${before.name}Patched`] = true;
    window[name] = patched;
  }

  function patchRenderFunction(name, callback) {
    const original = window[name];
    if (typeof original !== 'function' || original[`__${callback.name}Patched`]) return;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(callback, 0);
      return result;
    };
    patched[`__${callback.name}Patched`] = true;
    window[name] = patched;
  }

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function safeNumber(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function getStats() {
    if (typeof loadAchStats === 'function') return loadAchStats();
    return loadJSON('yum_stats', {});
  }

  function getUnlocked() {
    if (typeof loadUnlocked === 'function') return loadUnlocked();
    return loadJSON('yum_achievements', {});
  }

  function winCount() {
    return safeNumber(getStats().gamesWon);
  }

  function diamondCountFromWins(wins) {
    return DIAMOND_MILESTONES.filter(n => wins >= n).length;
  }

  function diamondString(wins = winCount()) {
    return '💎'.repeat(diamondCountFromWins(wins));
  }

  function stripDiamondSuffix(name) {
    return String(name || '').replace(/\s*💎+\s*$/g, '').trim();
  }

  function nameWithDiamonds(name, wins = winCount()) {
    const clean = stripDiamondSuffix(name || 'Player');
    const diamonds = diamondString(wins);
    return diamonds ? `${clean} ${diamonds}` : clean;
  }

  function applyDiamondsToNameInput() {
    const input = document.getElementById('playerName');
    if (!input) return;
    const clean = stripDiamondSuffix(input.value || input.placeholder || 'Player');
    if (input.value && clean) input.value = nameWithDiamonds(clean);
  }

  async function beforeMultiplayerStart() {
    await waitForDb();
    applyDiamondsToNameInput();
  }

  function beforeLocalStart() {
    applyDiamondsToNameInput();
    return Promise.resolve();
  }

  function injectHelperStyles() {
    if (document.getElementById('helperExtraStyles')) return;
    const style = document.createElement('style');
    style.id = 'helperExtraStyles';
    style.textContent = `
      .ach-card .ach-mini-progress{width:100%;height:6px;margin-top:9px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.06)}
      .ach-card .ach-mini-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green),var(--gold));transition:width .45s ease}
      .ach-card.locked .ach-mini-fill{background:linear-gradient(90deg,var(--accent),var(--gold))}
      .ach-card .ach-mini-label{margin-top:5px;font-size:.64rem;font-weight:800;color:var(--muted);letter-spacing:.5px}
      .ach-card.unlocked .ach-mini-label{color:var(--green)}
      .diamond-badge{display:inline-flex;align-items:center;margin-left:5px;font-size:.78em;letter-spacing:1px;filter:drop-shadow(0 0 5px rgba(91,199,255,.55))}
      #yourTurnPop{align-items:flex-start!important;justify-content:center!important;padding-top:calc(env(safe-area-inset-top,0px) + 92px)!important;pointer-events:none!important}
      #yourTurnPop .your-turn-box{transform:translateY(0) scale(.96)!important;margin:0 auto!important;max-width:min(88vw,360px)!important}
      #yourTurnPop.show .your-turn-box,#yourTurnPop.open .your-turn-box{transform:translateY(0) scale(1)!important}
      #botActionPopup{align-items:flex-start!important;justify-content:center!important;padding-top:calc(env(safe-area-inset-top,0px) + 88px)!important;pointer-events:none!important}
      #botActionPopup .bap-box{margin:0 auto!important;max-width:min(90vw,380px)!important;transform:translateY(0) scale(.96)!important}
      #botActionPopup.show .bap-box,#botActionPopup.open .bap-box{transform:translateY(0) scale(1)!important}
      @media (max-height:720px){#yourTurnPop{padding-top:calc(env(safe-area-inset-top,0px) + 68px)!important}#botActionPopup{padding-top:calc(env(safe-area-inset-top,0px) + 64px)!important}#yourTurnPop .your-turn-box,#botActionPopup .bap-box{transform:translateY(0) scale(.9)!important}}
    `;
    document.head.appendChild(style);
  }

  function addDiamondAchievements() {
    if (!Array.isArray(window.ACHIEVEMENTS || (typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS : null))) return;
    const list = window.ACHIEVEMENTS || ACHIEVEMENTS;
    const additions = [
      { id:'wins_50_diamond',  icon:'💎', name:'Diamond Winner I',   desc:'Win 50 games to add 1 diamond beside your name',   check:s=>safeNumber(s.gamesWon)>=50 },
      { id:'wins_100_diamond', icon:'💎', name:'Diamond Winner II',  desc:'Win 100 games to add 2 diamonds beside your name', check:s=>safeNumber(s.gamesWon)>=100 },
      { id:'wins_200_diamond', icon:'💎', name:'Diamond Winner III', desc:'Win 200 games to add 3 diamonds beside your name', check:s=>safeNumber(s.gamesWon)>=200 },
      { id:'wins_500_diamond', icon:'💎', name:'Diamond Legend',     desc:'Win 500 games to add 4 diamonds beside your name', check:s=>safeNumber(s.gamesWon)>=500 }
    ];
    additions.forEach(ach => {
      if (!list.some(existing => existing.id === ach.id)) list.push(ach);
    });
  }

  function progressForAchievement(ach, stats, unlocked) {
    const done = !!unlocked[ach.id];
    let current = 0, target = 1, label = 'progress';
    switch (ach.id) {
      case 'first_game': current=safeNumber(stats.gamesPlayed); target=1; label='games'; break;
      case 'first_win': current=safeNumber(stats.gamesWon); target=1; label='wins'; break;
      case 'wins_50_diamond': current=safeNumber(stats.gamesWon); target=50; label='wins'; break;
      case 'wins_100_diamond': current=safeNumber(stats.gamesWon); target=100; label='wins'; break;
      case 'wins_200_diamond': current=safeNumber(stats.gamesWon); target=200; label='wins'; break;
      case 'wins_500_diamond': current=safeNumber(stats.gamesWon); target=500; label='wins'; break;
      case 'first_yum': current=safeNumber(stats.yumCount); target=1; label='YUMs'; break;
      case 'yum_x3': current=safeNumber(stats.yumCount); target=3; label='YUMs'; break;
      case 'yum_x10': current=safeNumber(stats.yumCount); target=10; label='YUMs'; break;
      case 'full_house': current=safeNumber(stats.fullHouseCount); target=1; label='full houses'; break;
      case 'lg_straight': current=safeNumber(stats.lgStraightCount); target=1; label='large straights'; break;
      case 'bonus': current=safeNumber(stats.bonusCount); target=1; label='bonuses'; break;
      case 'perfect_upper': current=safeNumber(stats.perfectUpperCount); target=1; label='perfect uppers'; break;
      case 'score_250': current=safeNumber(stats.highScore); target=250; label='best pts'; break;
      case 'score_300': current=safeNumber(stats.highScore); target=300; label='best pts'; break;
      case 'bot_slayer': current=safeNumber(stats.botWins); target=5; label='bot wins'; break;
      case 'no_scratch': current=safeNumber(stats.noScratchGames); target=1; label='clean games'; break;
      case 'games_10': current=safeNumber(stats.gamesPlayed); target=10; label='games'; break;
      case 'games_25': current=safeNumber(stats.gamesPlayed); target=25; label='games'; break;
    }
    const displayCurrent = Math.min(current, target);
    const pct = done ? 100 : Math.min(100, Math.round((displayCurrent / target) * 100));
    const text = done ? `Complete · ${current}/${target} ${label}` : `${current}/${target} ${label}`;
    return { pct, text };
  }

  function renderAchievementProgressBars() {
    injectHelperStyles();
    addDiamondAchievements();
    const list = window.ACHIEVEMENTS || (typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS : []);
    if (!list.length) return;
    const grid = document.getElementById('achGrid');
    if (!grid) return;
    const stats = getStats();
    const unlocked = getUnlocked();
    grid.querySelectorAll('.ach-card').forEach((card, index) => {
      const ach = list[index];
      if (!ach) return;
      const progress = progressForAchievement(ach, stats, unlocked);
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

  function polishScoreLabels() {
    document.querySelectorAll('.score-value span').forEach(span => {
      const raw = (span.textContent || '').trim();
      const match = raw.match(/^(\d+)\?$/);
      if (match) span.textContent = `${match[1]} pts`;
    });
  }

  function decorateDisplayedNames() {
    const wins = winCount();
    const diamonds = diamondString(wins);
    if (!diamonds) return;

    document.querySelectorAll('.lb-name, .opp-hname, .bap-name, .mp-turn-badge, .rvb-player').forEach(el => {
      if (!el || el.querySelector('.diamond-badge')) return;
      const txt = el.textContent || '';
      if (txt.includes('💎')) return;
      if (txt.toLowerCase().includes('bot')) return;
      const badge = document.createElement('span');
      badge.className = 'diamond-badge';
      badge.textContent = diamonds;
      el.appendChild(badge);
    });
  }

  function checkDiamondAchievementsNow() {
    addDiamondAchievements();
    if (typeof checkAchievements === 'function') checkAchievements();
    renderAchievementProgressBars();
    decorateDisplayedNames();
  }

  function initHelpers() {
    injectHelperStyles();
    addDiamondAchievements();

    patchAsyncFunction('createGame', beforeMultiplayerStart);
    patchAsyncFunction('joinGame', beforeMultiplayerStart);
    patchAsyncFunction('startGame', beforeMultiplayerStart);
    patchAsyncFunction('startVsBot', beforeLocalStart);
    patchAsyncFunction('startSolo', beforeLocalStart);

    polishScoreLabels();
    ['renderScores','renderDice','rollDice','cycleDie','toggleHold','clearDice','confirmScore','deleteScore'].forEach(name => patchRenderFunction(name, polishScoreLabels));
    ['renderLeaderboard','renderBotLeaderboard','showBotActionPopup','showYourTurn'].forEach(name => patchRenderFunction(name, decorateDisplayedNames));
    patchRenderFunction('renderAchievements', renderAchievementProgressBars);
    patchRenderFunction('checkAchievements', checkDiamondAchievementsNow);

    const scoreSection = document.getElementById('scoreSection');
    if (scoreSection) new MutationObserver(polishScoreLabels).observe(scoreSection, { childList: true, subtree: true });

    setTimeout(() => {
      checkDiamondAchievementsNow();
      applyDiamondsToNameInput();
      decorateDisplayedNames();
    }, 0);

    setInterval(() => {
      addDiamondAchievements();
      decorateDisplayedNames();
    }, 1500);
  }

  window.getYumDiamondCount = () => diamondCountFromWins(winCount());
  window.getYumDiamonds = () => diamondString(winCount());
  window.formatYumNameWithDiamonds = nameWithDiamonds;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHelpers);
  else initHelpers();
})();
