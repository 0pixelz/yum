// ─── FIREBASE + UI HELPERS ───────────────────────────────────────────
// This file loads after js/app.js. It polishes score labels, keeps achievement
// progress bars, adds a multiplayer Firebase retry fallback, and applies small UI fixes.

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

  function patchMultiplayerFunction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__firebaseRetryPatched) return;

    const patched = async function(...args) {
      await waitForDb();
      return original.apply(this, args);
    };
    patched.__firebaseRetryPatched = true;
    window[name] = patched;
  }

  function polishScoreLabels() {
    document.querySelectorAll('.score-value span').forEach(span => {
      const raw = (span.textContent || '').trim();
      const match = raw.match(/^(\d+)\?$/);
      if (match) span.textContent = `${match[1]} pts`;
    });
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

  function injectAchievementProgressStyles() {
    if (document.getElementById('achievementProgressStyles')) return;
    const style = document.createElement('style');
    style.id = 'achievementProgressStyles';
    style.textContent = `
      .ach-card .ach-mini-progress{width:100%;height:6px;margin-top:9px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.06)}
      .ach-card .ach-mini-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green),var(--gold));transition:width .45s ease}
      .ach-card.locked .ach-mini-fill{background:linear-gradient(90deg,var(--accent),var(--gold))}
      .ach-card .ach-mini-label{margin-top:5px;font-size:.64rem;font-weight:800;color:var(--muted);letter-spacing:.5px}
      .ach-card.unlocked .ach-mini-label{color:var(--green)}
    `;
    document.head.appendChild(style);
  }

  function injectPopupPositionStyles() {
    if (document.getElementById('popupPositionFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'popupPositionFixStyles';
    style.textContent = `
      /* Keep turn/opponent popups above the dice instead of covering the dice row. */
      #yourTurnPop {
        align-items: flex-start !important;
        justify-content: center !important;
        padding-top: calc(env(safe-area-inset-top, 0px) + 92px) !important;
        pointer-events: none !important;
      }
      #yourTurnPop .your-turn-box {
        transform: translateY(0) scale(.96) !important;
        margin: 0 auto !important;
        max-width: min(88vw, 360px) !important;
      }
      #yourTurnPop.show .your-turn-box,
      #yourTurnPop.open .your-turn-box {
        transform: translateY(0) scale(1) !important;
      }
      #botActionPopup {
        align-items: flex-start !important;
        justify-content: center !important;
        padding-top: calc(env(safe-area-inset-top, 0px) + 88px) !important;
        pointer-events: none !important;
      }
      #botActionPopup .bap-box {
        margin: 0 auto !important;
        max-width: min(90vw, 380px) !important;
        transform: translateY(0) scale(.96) !important;
      }
      #botActionPopup.show .bap-box,
      #botActionPopup.open .bap-box {
        transform: translateY(0) scale(1) !important;
      }
      @media (max-height: 720px) {
        #yourTurnPop { padding-top: calc(env(safe-area-inset-top, 0px) + 68px) !important; }
        #botActionPopup { padding-top: calc(env(safe-area-inset-top, 0px) + 64px) !important; }
        #yourTurnPop .your-turn-box,
        #botActionPopup .bap-box { transform: translateY(0) scale(.9) !important; }
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
    let current = 0, target = 1, label = 'progress';
    switch (ach.id) {
      case 'first_game': current = safeNumber(stats.gamesPlayed); target = 1; label = 'games'; break;
      case 'first_win': current = safeNumber(stats.gamesWon); target = 1; label = 'wins'; break;
      case 'first_yum': current = safeNumber(stats.yumCount); target = 1; label = 'YUMs'; break;
      case 'yum_x3': current = safeNumber(stats.yumCount); target = 3; label = 'YUMs'; break;
      case 'yum_x10': current = safeNumber(stats.yumCount); target = 10; label = 'YUMs'; break;
      case 'full_house': current = safeNumber(stats.fullHouseCount); target = 1; label = 'full houses'; break;
      case 'lg_straight': current = safeNumber(stats.lgStraightCount); target = 1; label = 'large straights'; break;
      case 'bonus': current = safeNumber(stats.bonusCount); target = 1; label = 'bonuses'; break;
      case 'perfect_upper': current = safeNumber(stats.perfectUpperCount); target = 1; label = 'perfect uppers'; break;
      case 'score_250': current = safeNumber(stats.highScore); target = 250; label = 'best pts'; break;
      case 'score_300': current = safeNumber(stats.highScore); target = 300; label = 'best pts'; break;
      case 'bot_slayer': current = safeNumber(stats.botWins); target = 5; label = 'bot wins'; break;
      case 'no_scratch': current = safeNumber(stats.noScratchGames); target = 1; label = 'clean games'; break;
      case 'games_10': current = safeNumber(stats.gamesPlayed); target = 10; label = 'games'; break;
      case 'games_25': current = safeNumber(stats.gamesPlayed); target = 25; label = 'games'; break;
    }
    const cap = 500;
    const displayTarget = Math.min(target, cap);
    const displayCurrent = Math.min(current, displayTarget, cap);
    const pct = done ? 100 : Math.min(100, Math.round((displayCurrent / displayTarget) * 100));
    const text = done
      ? `Complete · ${Math.min(current, cap)}/${displayTarget}${current > cap ? '+' : ''} ${label}`
      : `${Math.min(current, cap)}/${displayTarget}${current > cap ? '+' : ''} ${label}`;
    return { pct, text };
  }

  function renderAchievementProgressBars() {
    injectAchievementProgressStyles();
    if (typeof ACHIEVEMENTS === 'undefined' || typeof loadAchStats !== 'function' || typeof loadUnlocked !== 'function') return;
    const grid = document.getElementById('achGrid');
    if (!grid) return;
    const stats = loadAchStats();
    const unlocked = loadUnlocked();
    grid.querySelectorAll('.ach-card').forEach((card, index) => {
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

  function initHelpers() {
    injectPopupPositionStyles();
    patchMultiplayerFunction('createGame');
    patchMultiplayerFunction('joinGame');
    patchMultiplayerFunction('startGame');

    polishScoreLabels();
    ['renderScores','renderDice','rollDice','cycleDie','toggleHold','clearDice','confirmScore','deleteScore'].forEach(name => patchRenderFunction(name, polishScoreLabels));
    patchRenderFunction('renderAchievements', renderAchievementProgressBars);

    const scoreSection = document.getElementById('scoreSection');
    if (scoreSection) new MutationObserver(polishScoreLabels).observe(scoreSection, { childList: true, subtree: true });

    setTimeout(renderAchievementProgressBars, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHelpers);
  else initHelpers();
})();
