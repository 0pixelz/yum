/* ============================================================
   Tactile Roll — makes the dice roller feel physical.

   Self-contained enhancement layer. It does NOT modify the core
   dice state, renderDice(), multiplayer sync, skins or the 3D
   engine — it only:
     1. Turns the ROLL button into a "hero" button whose three
        pips deplete as rolls are used, with an adaptive label.
        It stays in sync by observing the existing #rollCount text,
        so none of the ~12 places that update roll state need to
        change.
     2. Adds haptic feedback (navigator.vibrate) on tap, hold,
        roll, and a celebratory buzz on a YAM.

   The dice themselves are left in their natural single row at all
   times (owned by dice-size-fix.js) — holding a die only highlights
   it in place, it never moves to a separate lane.
   ============================================================ */
(function () {
  'use strict';

  /* ---- styles ------------------------------------------------ */
  if (!document.getElementById('tactile-roll-style')) {
    var st = document.createElement('style');
    st.id = 'tactile-roll-style';
    st.textContent = [
      /* hero roll button */
      '.btn-roll.tr-roll-btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;}',
      '.tr-roll-label{font-family:"Bebas Neue",cursive;letter-spacing:2px;}',
      '.tr-roll-pips{display:inline-flex;gap:5px;}',
      '.tr-roll-pips i{width:9px;height:9px;border-radius:50%;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.7);transition:transform .2s,background .2s,box-shadow .2s;}',
      '.tr-roll-pips i.spent{background:rgba(255,255,255,.22);box-shadow:none;transform:scale(.8);}',
      '.btn-roll.tr-empty{filter:grayscale(.5) brightness(.82);opacity:.85;}',
      '.roll-count.tr-hide{display:none;}',
      /* Pulsing red glow to draw the eye to the ROLL button while it is the
         local player\'s turn and a roll is available. Removed the moment rolls
         run out or it becomes the opponent\'s turn (handled in syncRollUI). */
      '@keyframes trAttnPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0);transform:scale(1);}50%{box-shadow:0 0 20px 5px rgba(239,68,68,.8),0 0 34px 10px rgba(239,68,68,.35);transform:scale(1.04);}}',
      '.btn-roll.tr-attention:not([disabled]){animation:trAttnPulse 1.15s ease-in-out infinite;}',
      '@media (prefers-reduced-motion: reduce){.btn-roll.tr-attention:not([disabled]){animation:none;box-shadow:0 0 16px 3px rgba(239,68,68,.7);}}'
      /* The dice stay in their natural single row at all times — held dice
         keep their position (they're just highlighted), so nothing re-flows
         into a separate "kept" lane and nothing collapses after the last
         roll. The single-row layout is owned by dice-size-fix.js. */
    ].join('');
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---- haptics ----------------------------------------------- */
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  function checkYam() {
    var faces = [];
    for (var i = 0; i < 5; i++) {
      var el = document.querySelector('#diceRow .die[data-i="' + i + '"]');
      if (el) faces.push(el.textContent.trim());
    }
    if (faces.length === 5 && faces.every(function (v) { return v && v !== '–' && v === faces[0]; })) {
      buzz([0, 45, 55, 45, 55]); // YAM!
    }
  }

  // Capture-phase so it fires even if a handler stops propagation.
  document.addEventListener('click', function (e) {
    if (e.target.closest('#diceRow .die, #diceRow .die-hold-btn')) { buzz(8); return; }
    var roll = e.target.closest('.btn-roll');
    if (roll && !roll.hasAttribute('disabled')) { buzz(16); setTimeout(checkYam, 720); }
  }, true);

  /* ---- hero ROLL button -------------------------------------- */
  function ensureBtnStructure(btn) {
    if (btn.querySelector('.tr-roll-label')) return;
    btn.classList.add('tr-roll-btn');
    btn.innerHTML =
      '<span class="tr-roll-label">ROLL</span>' +
      '<span class="tr-roll-pips" aria-hidden="true"><i></i><i></i><i></i></span>';
  }

  function syncRollUI() {
    var btn = document.querySelector('.btn-roll');
    if (!btn) return;
    ensureBtnStructure(btn);
    var label = btn.querySelector('.tr-roll-label');
    var pips = btn.querySelectorAll('.tr-roll-pips i');
    var rc = document.getElementById('rollCount');
    var txt = rc ? rc.textContent.trim() : '';
    var m = txt.match(/Rolls:\s*(\d)\s*\/\s*3/);
    // Opponent's turn shows "<Name> — Roll N / 3" (N = the roll they're on).
    // Checked only if the "Rolls: x/3" (my-turn) form didn't match.
    var opp = m ? null : txt.match(/Roll\s*(\d)\s*\/\s*3/);

    if (m) {
      var used = Math.max(0, Math.min(3, parseInt(m[1], 10)));
      var left = 3 - used;
      pips.forEach(function (p, idx) { p.classList.toggle('spent', idx >= left); });
      label.textContent = left === 3 ? 'ROLL' : (left > 0 ? 'ROLL AGAIN' : 'NO ROLLS');
      btn.classList.toggle('tr-empty', left === 0);
      // It's my turn (the "Rolls: x/3" status only shows on my own turn) — flash
      // the button while a roll is still available; stop once rolls run out.
      btn.classList.toggle('tr-attention', left > 0);
      if (left === 0) btn.setAttribute('disabled', '');
      else btn.removeAttribute('disabled');
      if (rc) rc.classList.add('tr-hide'); // pips replace the redundant count
    } else if (opp) {
      // Opponent's turn — deplete the pips to mirror each roll they take so the
      // three dots don't just sit static. The button isn't ours: keep it
      // disabled, unflashing, and let the "<Name> — Roll N / 3" status show.
      var oUsed = Math.max(0, Math.min(3, parseInt(opp[1], 10)));
      var oLeft = 3 - oUsed;
      pips.forEach(function (p, idx) { p.classList.toggle('spent', idx >= oLeft); });
      label.textContent = 'ROLL';
      btn.classList.remove('tr-empty');
      btn.classList.remove('tr-attention');
      btn.setAttribute('disabled', '');
      if (rc) rc.classList.remove('tr-hide');
    } else {
      // Non-standard status ("Waiting for X to roll…", etc.) — leave the
      // button neutral and let the status text show through.
      label.textContent = 'ROLL';
      pips.forEach(function (p) { p.classList.remove('spent'); });
      btn.classList.remove('tr-empty');
      btn.classList.remove('tr-attention'); // not my turn / waiting — no flashing
      btn.removeAttribute('disabled');
      if (rc) rc.classList.remove('tr-hide');
    }
  }

  /* ---- init -------------------------------------------------- */
  function init() {
    syncRollUI();
    var rc = document.getElementById('rollCount');
    if (rc) {
      new MutationObserver(syncRollUI)
        .observe(rc, { childList: true, characterData: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
