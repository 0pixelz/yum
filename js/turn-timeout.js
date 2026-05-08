// Turn inactivity timeout — gives the active player 60 seconds to choose a
// score. The countdown resets on each interaction (rolling, holding, opening
// the score modal, etc.). When time runs out we auto-pick the best available
// scoring category for them, or strike the lowest-value unfilled category if
// none of the dice would score.
(function() {
  'use strict';

  const TURN_TIMEOUT_SECONDS = 60;
  const WARN_AT = 10;

  let timerInterval = null;
  let remaining = 0;
  let active = false;
  let timerEl = null;
  let secEl = null;

  function ensureTimerEl() {
    if (timerEl) return timerEl;
    timerEl = document.createElement('div');
    timerEl.id = 'turnTimer';
    timerEl.innerHTML =
      '<i class="icn icn-bolt"></i>' +
      '<span id="turnTimerSec">60</span>' +
      '<span class="tt-unit">s</span>';
    document.body.appendChild(timerEl);
    secEl = document.getElementById('turnTimerSec');
    return timerEl;
  }

  function isPlayerTurn() {
    if (typeof botMode !== 'undefined' && botMode) {
      return typeof playerTurn !== 'undefined' && playerTurn === true;
    }
    if (typeof mpMode !== 'undefined' && mpMode) {
      return typeof currentTurnId !== 'undefined' &&
             typeof playerId !== 'undefined' &&
             currentTurnId === playerId;
    }
    return false;
  }

  function gameInProgress() {
    if (typeof categories === 'undefined' || typeof scores === 'undefined') return false;
    if (Object.keys(scores).length >= categories.length) return false;
    return (typeof botMode !== 'undefined' && botMode) ||
           (typeof mpMode !== 'undefined' && mpMode);
  }

  function updateUI() {
    ensureTimerEl();
    if (!secEl) return;
    secEl.textContent = remaining;
    if (remaining <= WARN_AT) {
      timerEl.classList.add('tt-warn');
    } else {
      timerEl.classList.remove('tt-warn');
    }
  }

  function show() { ensureTimerEl().classList.add('tt-show'); }
  function hide() { if (timerEl) timerEl.classList.remove('tt-show'); }

  function start() {
    stop();
    if (!isPlayerTurn() || !gameInProgress()) return;
    active = true;
    remaining = TURN_TIMEOUT_SECONDS;
    updateUI();
    show();
    timerInterval = setInterval(tick, 1000);
  }

  function tick() {
    remaining--;
    updateUI();
    if (remaining <= 0) {
      stop();
      onTimeout();
    }
  }

  function reset() {
    if (!active) return;
    remaining = TURN_TIMEOUT_SECONDS;
    updateUI();
  }

  function stop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    active = false;
    hide();
  }

  function onTimeout() {
    if (!isPlayerTurn() || !gameInProgress()) return;
    if (typeof showToast === 'function') {
      showToast('<i class="icn icn-bolt"></i> Time\'s up — auto-picking a score');
    }
    autoPickScore();
  }

  function autoPickScore() {
    const unfilled = categories.filter(c => scores[c.id] === undefined);
    if (unfilled.length === 0) return;

    let pickId = null;
    let pickScore = 0;
    const allSet = dice.every(v => v > 0);

    if (allSet) {
      let best = { id: null, score: -1 };
      unfilled.forEach(c => {
        const s = c.calc(dice);
        if (s > best.score) best = { id: c.id, score: s };
      });
      if (best.score > 0) {
        pickId = best.id;
        pickScore = best.score;
      } else {
        const sorted = unfilled.slice().sort((a, b) => a.max - b.max);
        pickId = sorted[0].id;
        pickScore = 0;
      }
    } else {
      const sorted = unfilled.slice().sort((a, b) => a.max - b.max);
      pickId = sorted[0].id;
      pickScore = 0;
    }

    if (typeof closeModalEl === 'function') closeModalEl();
    activeModal = pickId;
    selectedScore = pickScore;
    if (typeof confirmScore === 'function') confirmScore();
  }

  function wrap(name) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function() {
      const result = orig.apply(this, arguments);
      if (active && isPlayerTurn()) reset();
      return result;
    };
  }

  function patchFunctions() {
    ['rollDice', 'toggleHold', 'cycleDie', 'openModal', 'selectScore'].forEach(wrap);
  }

  // Poll the turn state and start/stop the timer when ownership changes.
  // App.js, multiplayer-* and bot-* files all mutate playerTurn / currentTurnId
  // imperatively, so polling is the simplest reliable hook.
  function watchTurn() {
    setInterval(() => {
      const isTurn = isPlayerTurn();
      const inProgress = gameInProgress();
      if (isTurn && inProgress && !active) {
        start();
      } else if ((!isTurn || !inProgress) && active) {
        stop();
      }
    }, 400);
  }

  function injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
      #turnTimer {
        position: fixed;
        top: 70px;
        left: 12px;
        z-index: 500;
        background: rgba(20, 20, 40, 0.92);
        border: 1.5px solid rgba(245, 166, 35, 0.5);
        border-radius: 22px;
        padding: 6px 14px;
        color: var(--gold);
        font-family: 'Bebas Neue', cursive;
        font-size: 1rem;
        letter-spacing: 1.5px;
        display: none;
        align-items: center;
        gap: 6px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        transition: color 0.2s, border-color 0.2s, background 0.2s;
        pointer-events: none;
      }
      #turnTimer.tt-show { display: inline-flex; }
      #turnTimer .tt-unit { opacity: 0.7; font-size: 0.85em; }
      #turnTimer.tt-warn {
        border-color: rgba(233, 69, 96, 0.8);
        color: var(--accent);
        background: rgba(60, 20, 30, 0.95);
        animation: ttPulse 0.7s ease-in-out infinite;
      }
      @keyframes ttPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      @media (max-width: 480px) {
        #turnTimer { top: 60px; left: 8px; font-size: 0.9rem; padding: 5px 12px; }
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    injectCSS();
    patchFunctions();
    watchTurn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
