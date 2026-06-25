// Auto-roll after first-roll — multiplayer only. When the who-goes-first
// roll concludes and the local player is the winner, give them 10 seconds
// to tap "Roll". If they don't, fire rollDice() for them so the game
// doesn't stall before it even starts. Subsequent turns are still gated
// only by the existing 60s turn-timeout (js/turn-timeout.js).

(function() {
  'use strict';

  const AUTO_ROLL_SECONDS = 10;

  let pending = false;       // armed for the next first-roll
  let startedAt = 0;          // Date.now() of countdown start
  let active = false;         // countdown currently visible
  let badge = null;

  function isMpInRoom() {
    return typeof mpMode !== 'undefined' && mpMode &&
           typeof roomRef !== 'undefined' && roomRef;
  }

  function isPlayerTurn() {
    if (!isMpInRoom()) return false;
    return typeof currentTurnId !== 'undefined' &&
           typeof playerId !== 'undefined' &&
           currentTurnId === playerId;
  }

  function notYetRolled() {
    return typeof rollsLeft !== 'undefined' && rollsLeft === 3 &&
           typeof dice !== 'undefined' && dice.every(v => v === 0 || v === undefined);
  }

  function ensureBadge() {
    if (badge && badge.isConnected) return badge;
    badge = document.createElement('div');
    badge.id = 'firstRollAutoRoll';
    badge.innerHTML =
      '<i class="icn icn-bolt"></i> Auto-roll dans <span id="frArSec">' +
      AUTO_ROLL_SECONDS + '</span>s';
    document.body.appendChild(badge);
    return badge;
  }

  function showBadge(secs) {
    ensureBadge();
    const secEl = document.getElementById('frArSec');
    if (secEl) secEl.textContent = secs;
    badge.classList.add('fr-ar-show');
    if (secs <= 3) badge.classList.add('fr-ar-warn');
    else badge.classList.remove('fr-ar-warn');
  }

  function hideBadge() {
    if (badge) {
      badge.classList.remove('fr-ar-show');
      badge.classList.remove('fr-ar-warn');
    }
  }

  function startCountdown() {
    active = true;
    startedAt = Date.now();
    showBadge(AUTO_ROLL_SECONDS);
  }

  function endCountdown() {
    active = false;
    pending = false;
    hideBadge();
  }

  // Single 250ms poll handles all transitions: turn ownership changing,
  // dice arriving from the server, the player clicking Roll, etc.
  setInterval(() => {
    if (!pending) {
      if (active) endCountdown();
      return;
    }
    if (!isMpInRoom() || !isPlayerTurn() || !notYetRolled()) {
      endCountdown();
      return;
    }
    if (!active) startCountdown();
    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = AUTO_ROLL_SECONDS - elapsed;
    if (remaining <= 0) {
      // One-shot: clear `pending` first so the rollDice we trigger here
      // doesn't bounce back into another countdown if for some reason the
      // server reply leaves rollsLeft at 3 momentarily.
      endCountdown();
      if (typeof rollDice === 'function') {
        try { rollDice(); } catch (e) { /* swallow — server-side errors surface via the usual toast */ }
      }
    } else {
      showBadge(Math.ceil(remaining));
    }
  }, 250);

  // Hook closeFirstRoll: arm the countdown immediately after the first-roll
  // overlay closes, but only for the player who actually won the opening
  // roll. The 1.3s delay matches the 900ms closeFirstRoll transition +
  // ~350ms "YOUR TURN" pop so the badge doesn't pop on top of those.
  function patchCloseFirstRoll() {
    if (typeof window.closeFirstRoll !== 'function') return;
    if (window.closeFirstRoll.__autoRollFirstPatched) return;
    const orig = window.closeFirstRoll;
    const patched = function() {
      const result = orig.apply(this, arguments);
      setTimeout(() => {
        // Only arm if we're the freshly-elected first player. If we lost
        // the first-roll, the opponent goes first; our own first turn
        // arrives later and is handled by the standard 60s turn-timeout.
        if (isMpInRoom() && isPlayerTurn() && notYetRolled()) {
          pending = true;
        }
      }, 1300);
      return result;
    };
    patched.__autoRollFirstPatched = true;
    window.closeFirstRoll = patched;
  }

  function injectStyles() {
    if (document.getElementById('firstRollAutoRollStyles')) return;
    const s = document.createElement('style');
    s.id = 'firstRollAutoRollStyles';
    s.textContent = `
      #firstRollAutoRoll {
        position: fixed;
        bottom: 110px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(20, 20, 40, 0.95);
        border: 2px solid rgba(245, 166, 35, 0.7);
        border-radius: 999px;
        padding: 9px 18px;
        color: var(--gold, #f5a623);
        font-family: 'Bebas Neue', cursive;
        font-size: 1rem;
        letter-spacing: 2px;
        z-index: 9000;
        display: none;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.55);
        pointer-events: none;
        white-space: nowrap;
      }
      #firstRollAutoRoll.fr-ar-show { display: inline-flex; }
      #firstRollAutoRoll.fr-ar-warn {
        border-color: rgba(233, 69, 96, 0.95);
        color: var(--accent, #e94560);
        background: rgba(60, 20, 30, 0.95);
        animation: frArPulse 0.6s ease-in-out infinite;
      }
      @keyframes frArPulse {
        0%, 100% { transform: translateX(-50%) scale(1); }
        50%      { transform: translateX(-50%) scale(1.08); }
      }
      @media (max-width: 480px) {
        #firstRollAutoRoll { bottom: 90px; font-size: 0.9rem; padding: 7px 14px; }
      }
    `;
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    patchCloseFirstRoll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Other modules (rematch flows, etc.) may rewrap closeFirstRoll after us;
  // re-apply the patch so the auto-roll keeps firing on rematches too.
  setInterval(patchCloseFirstRoll, 1500);
})();
