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
    // Turning 3D off mid-game: end any lingering live broadcast so an opponent
    // isn't left watching my 3D stream.
    if (!next && typeof window.__yum3dEndBroadcast === 'function') {
      try { window.__yum3dEndBroadcast(); } catch (e) {}
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
      /* Anchor the corner toggle to the dice-roller card. */
      .dice-section { position: relative; }
      .d3d-inline-wrap {
        position: absolute;
        top: 12px; right: 12px;
        margin: 0; text-align: right;
        z-index: 5;
      }
      .d3d-inline-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 11px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(255,255,255,0.05);
        color: var(--muted, #aab);
        font-family: 'Bebas Neue', cursive;
        font-size: 0.7rem;
        letter-spacing: 1.5px;
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
        width: 7px; height: 7px;
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
    const section = document.querySelector('.dice-section');
    if (!section) return;
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
    // Pin it to the card's top-right corner (over the "DICE ROLLER" header row).
    section.appendChild(wrap);
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
      if (!window.is3DRollEnabled()) return original();
      if (typeof window.throw3DDice !== 'function') return original();
      // Power-up "Yam or Strike" rerolls a single die with bespoke, client-side
      // logic in powerup-mode.js (not a server/physics roll). Never take it over
      // — defensive in case wrapper ordering puts this ahead of that handler.
      if (typeof yamOrStrikeActive !== 'undefined' && yamOrStrikeActive) return original();

      // Power-up multiplayer is client-authoritative — the dice are decided by
      // the local physics sim, not the server. So it uses the same LOCAL 3D path
      // as vs-bot (below), not the server-round-trip MP branch that would clobber
      // the local roll count Extra Roll depends on. The live-stream module still
      // broadcasts the tumble to the opponent, and the settled values are synced
      // into liveDice in the local branch's resolve.
      const isPowerupMP = (typeof powerupMode !== 'undefined' && powerupMode &&
                           typeof mpMode !== 'undefined' && mpMode);

      // Non-power-up multiplayer dice are decided by the server, not the physics
      // sim. The MP branch (below) runs the 3D overlay for the animation + live
      // stream, but re-faces the dice to the server's authoritative values.
      const isMP = (typeof mpMode !== 'undefined' && mpMode &&
                    typeof roomRef !== 'undefined' && roomRef &&
                    window.YumCloud &&
                    typeof roomCode !== 'undefined' && roomCode &&
                    !isPowerupMP);

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

      // ── Multiplayer: same turn-owning 3D overlay as vs-bot, but each throw's
      // dice come from the server (anti-cheat) and settle naturally. The player
      // keeps dice, rolls again, and picks a score all inside the 3D overlay —
      // scoring routes through confirmScore3D → the MP-aware 2D confirmScore →
      // server submitScore, so it "just works" like solo.
      if (isMP) {
        if (typeof window.__yumMpServerRoll !== 'function') return original();
        window.__yum3dRollInFlight = true;
        let lastRoll = 0;
        window.throw3DDice({
          dice: dice.slice(),
          held: held.slice(),
          rollsLeft: rollsLeft,
          authRoll: (heldArr, physicsDice) => window.__yumMpServerRoll(heldArr, physicsDice).then(r => {
            if (r && typeof r.roll !== 'undefined') lastRoll = Number(r.roll) || lastRoll;
            return r;
          })
        }).then(res => {
          window.__yum3dRollInFlight = false;
          if (!res) return;
          if (res.fallback) { original(); return; }   // WebGL unavailable → 2D roll
          if (res.authError) {
            const msg = String((res.authError && res.authError.message) || '');
            if (typeof showToast === 'function') {
              if (/not your turn/i.test(msg)) showToast("It's not your turn!");
              else if (/no rolls left/i.test(msg)) showToast('No rolls left');
              else showToast("Couldn't roll — check your connection");
            }
            return;
          }
          if (res.skipped) return;
          // Reflect the latest server roll into the 2D card so the dice + roll
          // count are correct there.
          if (Array.isArray(res.dice) && typeof window.__yumApplyMpRoll === 'function') {
            window.__yumApplyMpRoll({ dice: res.dice, roll: lastRoll }, false);
          }
          // A score picked in the overlay: open the 2D score modal for that
          // category so it commits through the normal (reliable) MP submit.
          if (res.pick && typeof openModal === 'function') {
            setTimeout(() => { try { openModal(res.pick); } catch (e) {} }, 360);
          }
        }).catch(err => {
          window.__yum3dRollInFlight = false;
          console.warn('3D MP turn error', err);
        });
        return;
      }

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

        // Power-up multiplayer (client-authoritative): mirror the settled dice
        // into liveDice so the opponent's card shows them. The 3D stream already
        // shows the tumble live; this syncs the final values. Harmless no-op in
        // solo / vs-bot (guarded on mpMode).
        if (typeof mpMode !== 'undefined' && mpMode &&
            typeof roomRef !== 'undefined' && roomRef &&
            typeof playerId !== 'undefined' && playerId) {
          try {
            const _skinId = (typeof window.getActiveDiceSkinId === 'function') ? window.getActiveDiceSkinId() : 'classic';
            let _pdc = null; try { _pdc = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); } catch (e) {}
            roomRef.child('players/' + playerId + '/liveDice').set({
              dice: dice, held: held,
              roll: Math.max(0, Math.min(3, 3 - rollsLeft)),
              skin: _skinId, perDieColors: _pdc, ts: Date.now()
            });
          } catch (e) {}
        }

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
