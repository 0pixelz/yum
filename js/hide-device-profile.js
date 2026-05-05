// ─── HIDE DEVICE PROFILE LABEL ───────────────────────────────────────
// Keeps the local device profile logic working, but hides the visible
// "Device profile: Player ..." line from the main menu.

(function() {
  function hideDeviceProfileLabel() {
    const bar = document.getElementById('profileLoginBar');
    if (!bar) return;

    const first = bar.querySelector('div');
    if (!first) return;

    const text = (first.textContent || '').trim();
    if (/Device profile:/i.test(text)) {
      first.style.display = 'none';
      first.setAttribute('aria-hidden', 'true');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideDeviceProfileLabel);
  } else {
    hideDeviceProfileLabel();
  }

  setInterval(hideDeviceProfileLabel, 500);
})();
