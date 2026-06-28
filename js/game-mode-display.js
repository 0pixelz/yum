// ─── GAME MODE DISPLAY ───────────────────────────────────────────────
// Two jobs:
//   1. Show a badge in the in-game header naming the active mode
//      (Classic / Power-Up / Mega Yam) whenever a vs-Bot or multiplayer
//      game is running. Hidden in the lobby.
//   2. Tailor the "How to Play" overlay to the active mode — a "now
//      playing" banner up top, plus highlighting / focusing the matching
//      mode section so the instructions match the gameplay in front of you.
//
// Mode state is read from the same flags the rest of the app uses:
//   window.megaYamMode (mega-yam-mode.js) and powerupMode (powerup-mode.js).
(function () {
  'use strict';

  const MODES = {
    normal:  { key: 'normal',  label: 'CLASSIC',  icon: 'icn-gamepad', cls: 'gm-classic',  desc: 'Standard rules, no power-ups.' },
    powerup: { key: 'powerup', label: 'POWER-UP', icon: 'icn-bolt',    cls: 'gm-powerup',  desc: 'Earn and spend power-ups during the match.' },
    megayam: { key: 'megayam', label: 'MEGA YAM', icon: 'icn-trophy',  cls: 'gm-megayam',  desc: 'Yahtzee scoring — YAM 50 pts, +100 for each extra YAM.' }
  };

  function currentMode() {
    if (typeof window.megaYamMode !== 'undefined' && window.megaYamMode) return MODES.megayam;
    if (typeof powerupMode !== 'undefined' && powerupMode) return MODES.powerup;
    return MODES.normal;
  }

  // A game is on the board when we're vs Bot or in a multiplayer room.
  function gameActive() {
    const bot = (typeof botMode !== 'undefined' && botMode);
    const mp  = (typeof mpMode  !== 'undefined' && mpMode);
    return !!(bot || mp);
  }

  // ── Header badge ─────────────────────────────────────────────────────
  function updateBadge() {
    const badge = document.getElementById('gameModeBadge');
    if (!badge) return;
    if (!gameActive()) { badge.style.display = 'none'; return; }

    const m = currentMode();
    if (badge.__mode !== m.key) {
      badge.__mode = m.key;
      badge.className = 'game-mode-badge ' + m.cls;
      badge.innerHTML = '<i class="icn ' + m.icon + '"></i> <span id="gameModeBadgeText">' + m.label + '</span>';
    }
    badge.style.display = 'inline-flex';
  }
  window.updateGameModeBadge = updateBadge;

  // ── How to Play, tailored to the active mode ─────────────────────────
  function tailorHowTo() {
    const m = currentMode();
    const active = gameActive();

    const banner = document.getElementById('howtoModeBanner');
    if (banner) {
      if (active) {
        banner.className = 'howto-mode-banner ' + m.cls;
        banner.innerHTML =
          '<span class="howto-mode-banner-label">NOW PLAYING</span>' +
          '<span class="howto-mode-banner-mode"><i class="icn ' + m.icon + '"></i> ' + m.label + ' MODE</span>' +
          '<span class="howto-mode-banner-desc">' + m.desc + '</span>';
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }

    const pu = document.getElementById('howtoPowerupSection');
    const my = document.getElementById('howtoMegaYamSection');
    [pu, my].forEach(s => { if (s) s.classList.remove('howto-section-active', 'howto-section-dim'); });

    if (active && m.key === 'powerup' && pu) {
      pu.classList.add('howto-section-active');
      if (my) my.classList.add('howto-section-dim');
    } else if (active && m.key === 'megayam' && my) {
      my.classList.add('howto-section-active');
      if (pu) pu.classList.add('howto-section-dim');
    }

    // When a special mode is live, bring its section into view so the
    // relevant rules are the first thing the player sees.
    if (active && (m.key === 'powerup' || m.key === 'megayam')) {
      const target = m.key === 'powerup' ? pu : my;
      if (target) setTimeout(() => {
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      }, 380);
    }
  }

  // Wrap openHowToPlay so the overlay reflects the current mode every time
  // it opens (the mode can change between games).
  function wrapOpen() {
    if (typeof window.openHowToPlay !== 'function' || window.openHowToPlay.__gmWrapped) return;
    const orig = window.openHowToPlay;
    const wrapped = function () {
      tailorHowTo();
      return orig.apply(this, arguments);
    };
    wrapped.__gmWrapped = true;
    window.openHowToPlay = wrapped;
  }

  function init() {
    wrapOpen();
    updateBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // The mode changes through several paths (start vs Bot, MP room snapshot,
  // quit / leave). A light poll keeps the badge honest without having to
  // hook every one of them, mirroring how scoring-rules.js stays in sync.
  setInterval(function () {
    wrapOpen(); // in case how-to-play.js finished loading after us
    updateBadge();
  }, 700);
})();
