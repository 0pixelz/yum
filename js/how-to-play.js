(function () {
  function open() {
    const ov = document.getElementById('howToPlayOverlay');
    if (!ov) return;
    ov.style.display = 'flex';
    requestAnimationFrame(() => ov.classList.add('open'));
    document.addEventListener('keydown', onKey);
  }

  function close() {
    const ov = document.getElementById('howToPlayOverlay');
    if (!ov) return;
    ov.classList.remove('open');
    setTimeout(() => { ov.style.display = 'none'; }, 350);
    document.removeEventListener('keydown', onKey);
  }

  function onOverlayClick(e) {
    if (e.target === document.getElementById('howToPlayOverlay')) close();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  window.openHowToPlay = open;
  window.closeHowToPlay = close;
  window.closeHowToPlayOverlay = onOverlayClick;
})();
