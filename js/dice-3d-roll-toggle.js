// "Roll dice in 3D" preference + rollDice() interceptor.
// When the toggle is on and the multi-die 3D overlay is available, the in-game
// roll button opens the 3D scene and tosses one die per unheld slot, then
// writes the settled face values back into the regular dice state.
(function () {
  'use strict';

  const STORAGE_KEY = 'yum_3d_roll';

  window.is3DRollEnabled = function () {
    try { return localStorage.getItem(STORAGE_KEY) === 'on'; }
    catch (e) { return false; }
  };

  window.toggle3DRoll = function () {
    const next = !window.is3DRollEnabled();
    try { localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off'); } catch (e) {}
    if (typeof window.showToast === 'function') {
      window.showToast(next ? '3D dice roll enabled' : '3D dice roll disabled');
    }
    refreshInlineToggle();
    return next;
  };

  // ── Inline in-game toggle ────────────────────────────────────────
  // The Profile Settings sheet is hidden during a match, so we also drop a
  // compact pill into the dice-roller card. One tap flips the same flag.
  function injectToggleStyles() {
    if (document.getElementById('d3dInlineToggleStyles')) return;
    const s = document.createElement('style');
    s.id = 'd3dInlineToggleStyles';
    s.textContent = `
      .d3d-inline-wrap {
        text-align: center;
        margin: 4px 0 2px;
      }
      .d3d-inline-btn {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 5px 14px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.05);
        color: var(--muted, #aab);
        font-family: 'Bebas Neue', cursive;
        font-size: 0.78rem;
        letter-spacing: 2px;
        cursor: pointer;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      .d3d-inline-btn:hover { background: rgba(255,255,255,0.1); }
      .d3d-inline-btn.on {
        background: linear-gradient(135deg, rgba(78,205,196,0.22), rgba(245,166,35,0.18));
        border-color: rgba(78,205,196,0.6);
        color: var(--green, #4ecdc4);
        text-shadow: 0 0 8px rgba(78,205,196,0.35);
      }
      .d3d-inline-dot {
        display: inline-block;
        width: 8px; height: 8px;
        border-radius: 50%;
        background: rgba(255,255,255,0.25);
      }
      .d3d-inline-btn.on .d3d-inline-dot {
        background: var(--green, #4ecdc4);
        box-shadow: 0 0 10px rgba(78,205,196,0.7);
      }
    `;
    document.head.appendChild(s);
  }

  function ensureInlineToggle() {
    if (document.getElementById('d3dInlineBtn')) {
      refreshInlineToggle();
      return;
    }
    const controls = document.querySelector('.dice-section .dice-controls');
    const rollCount = document.getElementById('rollCount');
    if (!controls || !rollCount) return;
    injectToggleStyles();
    const wrap = document.createElement('div');
    wrap.className = 'd3d-inline-wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'd3dInlineBtn';
    btn.className = 'd3d-inline-btn';
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', () => { window.toggle3DRoll(); });
    wrap.appendChild(btn);
    rollCount.parentNode.insertBefore(wrap, rollCount);
    refreshInlineToggle();
  }

  function refreshInlineToggle() {
    const btn = document.getElementById('d3dInlineBtn');
    if (!btn) return;
    const on = window.is3DRollEnabled();
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.innerHTML = '<span class="d3d-inline-dot"></span>3D ROLL · ' + (on ? 'ON' : 'OFF');
  }

  function scheduleInlineInject() {
    ensureInlineToggle();
    if (document.getElementById('d3dInlineBtn')) return;
    // The dice-roller markup may not be in the DOM yet at script-load.
    let tries = 0;
    const iv = setInterval(() => {
      ensureInlineToggle();
      if (document.getElementById('d3dInlineBtn') || ++tries > 40) clearInterval(iv);
    }, 100);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInlineInject);
  } else {
    scheduleInlineInject();
  }

  // Wrap the existing rollDice (which app.js already wraps for bot-mode
  // guarding). When the toggle is on, open the 3D overlay for the unheld dice
  // instead of resolving the roll synchronously.
  function install() {
    if (typeof rollDice !== 'function') return false;
    if (rollDice.__yum3dPatched) return true;

    const original = rollDice;

    function rollDice3D() {
      // Multiplayer dice must come from the server, not from the 3D physics
      // simulation. Fall through to the original (async) rollDice which
      // routes to Cloud Functions.
      if (typeof mpMode !== 'undefined' && mpMode) return original();
      if (!window.is3DRollEnabled()) return original();
      if (typeof window.throw3DDice !== 'function') return original();

      // Mirror the original's pre-roll guards so the 3D overlay never opens
      // on a turn the player can't actually roll on.
      if (typeof mpMode !== 'undefined' && mpMode &&
          typeof currentTurnId !== 'undefined' && currentTurnId !== playerId) {
        if (typeof showToast === 'function') showToast("It's not your turn!");
        return;
      }
      if (typeof botMode !== 'undefined' && botMode &&
          typeof playerTurn !== 'undefined' && !playerTurn) {
        if (typeof showToast === 'function') showToast('Wait for the bot!');
        return;
      }
      if (typeof rollsLeft !== 'undefined' && rollsLeft <= 0) return;

      // Need at least one die to roll.
      let anyUnheld = false;
      for (let i = 0; i < dice.length; i++) { if (!held[i]) { anyUnheld = true; break; } }
      if (!anyUnheld) return original();

      if (window.__yum3dRollInFlight) return;
      window.__yum3dRollInFlight = true;

      // Hand the whole turn to the 3D overlay: it rolls, lets the player tap
      // dice to keep (they fly to the side shelf), roll again, and pick a
      // suggested score. It resolves once with the final state.
      window.throw3DDice({
        dice: dice.slice(),
        held: held.slice(),
        rollsLeft: rollsLeft
      }).then(res => {
        window.__yum3dRollInFlight = false;
        if (!res || res.skipped || !Array.isArray(res.dice)) return; // aborted — no change
        const used = Math.max(1, Math.min(rollsLeft, res.rollsUsed | 0));

        for (let i = 0; i < dice.length && i < res.dice.length; i++) {
          dice[i] = res.dice[i];
          if (Array.isArray(res.held)) held[i] = !!res.held[i];
        }
        rolled = true;
        rollsLeft = Math.max(0, rollsLeft - used);
        if (typeof renderDice === 'function') renderDice(true);
        if (typeof renderScores === 'function') renderScores();
        const rcEl = document.getElementById('rollCount');
        if (rcEl) rcEl.textContent = 'Rolls: ' + (3 - rollsLeft) + ' / 3';

        // The player tapped a suggested score in the overlay — open its modal
        // now that the final dice are in game state.
        if (res.pick && typeof openModal === 'function') {
          // Wait for the overlay fade-out (~280ms) so the score modal isn't
          // briefly hidden behind it.
          setTimeout(() => { try { openModal(res.pick); } catch (e) {} }, 340);
        }
      }).catch(err => {
        window.__yum3dRollInFlight = false;
        console.warn('3D roll failed, falling back', err);
        original();
      });
    }

    rollDice3D.__yum3dPatched = true;
    rollDice = rollDice3D;
    window.rollDice = rollDice3D;
    return true;
  }

  // app.js's own rollDice wrapper runs at script-load. Retry briefly in case
  // this file lands before the patch.
  if (!install()) {
    let tries = 0;
    const iv = setInterval(() => {
      if (install() || ++tries > 40) clearInterval(iv);
    }, 50);
  }
})();
