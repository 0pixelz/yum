// ─── SOUND EFFECTS ──────────────────────────────────────────────────
let soundEnabled = localStorage.getItem('yumSound') !== 'off';
let _audioCtx = null;

function _ctx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('yumSound', soundEnabled ? 'on' : 'off');
  const btn = document.getElementById('soundToggle');
  btn.textContent = soundEnabled ? '🔊' : '🔇';
  btn.classList.toggle('muted', !soundEnabled);
}