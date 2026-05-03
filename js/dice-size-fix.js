// ─── ROLLER DICE SIZE FIX ────────────────────────────────────────────
// Keeps the 5 main roller dice on one horizontal line while staying larger
// than the original dice. Scoreboard dice icons are untouched.

(function() {
  function injectDiceSizeStyles() {
    if (document.getElementById('diceSizeFixStyles')) return;

    const style = document.createElement('style');
    style.id = 'diceSizeFixStyles';
    style.textContent = `
      .dice-section .dice-row {
        display: flex !important;
        flex-wrap: nowrap !important;
        justify-content: center !important;
        align-items: flex-start !important;
        gap: 8px !important;
        margin-bottom: 14px !important;
      }

      .dice-section .die-wrap {
        flex: 0 0 auto !important;
        min-width: 0 !important;
      }

      .dice-section .die {
        width: 56px !important;
        height: 56px !important;
        border-radius: 12px !important;
        font-size: 1.95rem !important;
      }

      .dice-section .die-hold-btn {
        font-size: 0.66rem !important;
        padding: 4px 8px !important;
        min-width: 0 !important;
      }

      @media (max-width: 380px) {
        .dice-section .dice-row {
          gap: 6px !important;
        }

        .dice-section .die {
          width: 52px !important;
          height: 52px !important;
          border-radius: 11px !important;
          font-size: 1.75rem !important;
        }

        .dice-section .die-hold-btn {
          font-size: 0.62rem !important;
          padding: 3px 7px !important;
        }
      }

      @media (max-width: 340px) {
        .dice-section .dice-row {
          gap: 5px !important;
        }

        .dice-section .die {
          width: 48px !important;
          height: 48px !important;
          font-size: 1.6rem !important;
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
