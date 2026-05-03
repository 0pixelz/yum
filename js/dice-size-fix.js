// ─── BIGGER ROLLER DICE ──────────────────────────────────────────────
// Makes only the main dice rolling area larger. Scoreboard dice icons are untouched.

(function() {
  function injectDiceSizeStyles() {
    if (document.getElementById('diceSizeFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'diceSizeFixStyles';
    style.textContent = `
      .dice-section .dice-row {
        gap: 12px;
        margin-bottom: 14px;
      }

      .dice-section .die {
        width: 64px !important;
        height: 64px !important;
        border-radius: 14px !important;
        font-size: 2.15rem !important;
      }

      .dice-section .die-hold-btn {
        font-size: 0.68rem !important;
        padding: 4px 10px !important;
      }

      @media (max-width: 380px) {
        .dice-section .dice-row {
          gap: 8px;
        }
        .dice-section .die {
          width: 58px !important;
          height: 58px !important;
          font-size: 2rem !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectDiceSizeStyles);
  } else {
    injectDiceSizeStyles();
  }
})();
