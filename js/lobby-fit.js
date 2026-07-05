// ─── LOBBY AUTO-FIT ──────────────────────────────────────────────────
// The main menu (#lobbyOverlay) is a fixed, centered flex column. On short
// screens (small phones, landscape) its content grows taller than the
// viewport; with justify-content:center the overflow is clipped on BOTH
// edges and there is no scrollbar, so the title and bottom buttons become
// unreachable. Instead of making the lobby scrollable, scale the whole
// menu down so it always fits the screen exactly.
//
// How: wrap the lobby's children in a single .lobby-fit-wrap element and
// apply transform:scale(min(1, viewport/content)). A transform doesn't
// affect layout, so the flex centering keeps the scaled block centered.
// Observers keep the scale correct when content changes (error text,
// injected pills like #directJoinPill) or the window resizes/rotates.

(function () {
  'use strict';

  const MARGIN = 12;          // breathing room so content never kisses the edges
  let wrap = null;
  let overlay = null;
  let fitQueued = false;

  function fit() {
    fitQueued = false;
    if (!overlay || !wrap) return;
    // While the menu is up the page must not scroll at all — the game UI
    // behind the fixed overlay is taller than the screen, so without this
    // the "main page" still rubber-bands/scrolls under the menu on mobile.
    // Restored the moment the lobby is hidden (in-game screens do scroll).
    const visible = overlay.style.display !== 'none';
    document.body.classList.toggle('lobby-lock', visible);
    if (!visible) return;
    // Don't rescale while the user is typing: on Android the keyboard
    // shrinks window.innerHeight, which would visibly squash the menu
    // mid-keystroke and jump back on blur.
    const ae = document.activeElement;
    if (ae && wrap.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;

    // Natural (unscaled) content size — transforms don't affect these.
    const naturalH = wrap.scrollHeight;
    const naturalW = wrap.scrollWidth;
    if (!naturalH || !naturalW) return;

    const availH = overlay.clientHeight - MARGIN * 2;
    const availW = overlay.clientWidth - MARGIN * 2;
    const scale = Math.min(1, availH / naturalH, availW / naturalW);

    if (scale < 1) {
      wrap.style.transform = 'scale(' + scale.toFixed(4) + ')';
    } else {
      wrap.style.transform = '';
    }
  }

  function queueFit() {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(fit);
  }

  function init() {
    overlay = document.getElementById('lobbyOverlay');
    if (!overlay || overlay.querySelector('.lobby-fit-wrap')) return;

    wrap = document.createElement('div');
    wrap.className = 'lobby-fit-wrap';
    while (overlay.firstChild) wrap.appendChild(overlay.firstChild);
    overlay.appendChild(wrap);

    // Content changes inside the wrapper (error messages, avatar/profile
    // widgets, reward buttons) change its height → refit.
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(queueFit).observe(wrap);
      new ResizeObserver(queueFit).observe(overlay);
    }

    // Other modules append straight into #lobbyOverlay (e.g. the
    // direct-join pill). Move such strays into the wrapper so they scale
    // with everything else, and refit when the lobby is re-shown
    // (scripts toggle style.display to return to the menu).
    new MutationObserver(muts => {
      let changed = false;
      for (const m of muts) {
        if (m.type === 'childList') {
          m.addedNodes.forEach(n => {
            if (n.nodeType === 1 && n !== wrap && n.parentNode === overlay) {
              wrap.appendChild(n);
              changed = true;
            }
          });
        } else if (m.type === 'attributes') {
          changed = true;
        }
      }
      if (changed) queueFit();
    }).observe(overlay, { childList: true, attributes: true, attributeFilter: ['style'] });

    window.addEventListener('resize', queueFit);
    window.addEventListener('orientationchange', queueFit);
    // Bebas Neue/Nunito land after first layout and change text heights.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(queueFit).catch(() => {});
    }
    // Refit once the on-screen keyboard is dismissed (blur restored focus).
    document.addEventListener('focusout', () => setTimeout(queueFit, 150));

    queueFit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
