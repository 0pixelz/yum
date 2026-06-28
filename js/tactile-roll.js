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
     2. Drops held dice below a dashed divider into a labelled
        "kept" lane (pure CSS :has(); falls back to the current
        single-row look on browsers without :has()). The die
        elements never leave #diceRow, so renderDice's
        querySelector logic, skins and the 3D overlay all keep
        working untouched.
     3. Adds haptic feedback (navigator.vibrate) on tap, hold,
        roll, and a celebratory buzz on a YAM.
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
      /* two-lane "kept" shelf — only splits when dice are held, so the
         default single row enforced by dice-size-fix.js is preserved.
         :has() outranks that rule's plain selector, so wrap wins here. */
      '.dice-section .dice-row:has(.die.held){flex-wrap:wrap !important;}',
      '.tr-shelf-break{display:none;order:1;flex:0 0 100%;min-width:100%;width:100%;height:0;}',
      '.dice-section .dice-row .die-wrap:has(.die.held){order:2;}',
      '.dice-section .dice-row:has(.die.held) .tr-shelf-break{display:flex;align-items:center;justify-content:center;height:auto;margin:8px 0 2px;border-top:1px dashed rgba(245,166,35,.35);}',
      '.dice-section .dice-row:has(.die.held) .tr-shelf-break::before{content:"\\270B KEPT \\2014 tap to roll the rest";font:800 .6rem "Nunito",sans-serif;letter-spacing:1px;color:var(--gold);opacity:.85;text-transform:uppercase;padding-top:6px;}',
      /* No rolls left: collapse back to one row so the whole hand is
         visible together for scoring (overrides the shelf split above). */
      '.dice-section .dice-row.tr-no-rolls:has(.die.held){flex-wrap:nowrap !important;}',
      '.dice-section .dice-row.tr-no-rolls .die-wrap:has(.die.held){order:0 !important;}',
      '.dice-section .dice-row.tr-no-rolls .tr-shelf-break{display:none !important;}',
      '.dice-section .dice-row.tr-no-rolls .die.held{transform:none !important;}'
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
    var row = document.getElementById('diceRow');
    var txt = rc ? rc.textContent.trim() : '';
    var m = txt.match(/Rolls:\s*(\d)\s*\/\s*3/);

    if (m) {
      var used = Math.max(0, Math.min(3, parseInt(m[1], 10)));
      var left = 3 - used;
      pips.forEach(function (p, idx) { p.classList.toggle('spent', idx >= left); });
      label.textContent = left === 3 ? 'ROLL' : (left > 0 ? 'ROLL AGAIN' : 'NO ROLLS');
      btn.classList.toggle('tr-empty', left === 0);
      if (left === 0) btn.setAttribute('disabled', '');
      else btn.removeAttribute('disabled');
      if (rc) rc.classList.add('tr-hide'); // pips replace the redundant count
      // No rolls left → collapse the kept shelf so the whole hand is on
      // one line and easy to read before scoring.
      if (row) row.classList.toggle('tr-no-rolls', left === 0);
    } else {
      // Non-standard status ("Waiting for X to roll…", scanning, etc.)
      // Leave the button neutral and let the status text show through.
      label.textContent = 'ROLL';
      pips.forEach(function (p) { p.classList.remove('spent'); });
      btn.classList.remove('tr-empty');
      btn.removeAttribute('disabled');
      if (rc) rc.classList.remove('tr-hide');
      if (row) row.classList.remove('tr-no-rolls');
    }
  }

  /* ---- two-lane shelf divider -------------------------------- */
  function insertShelfBreak() {
    var row = document.getElementById('diceRow');
    if (row && !row.querySelector('.tr-shelf-break')) {
      var b = document.createElement('div');
      b.className = 'tr-shelf-break';
      b.setAttribute('aria-hidden', 'true');
      row.appendChild(b); // order:1 places it between rolling (0) and kept (2)
    }
  }

  /* ---- init -------------------------------------------------- */
  function init() {
    insertShelfBreak();
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
