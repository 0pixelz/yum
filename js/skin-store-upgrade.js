// ─── SKIN STORE VISUALS ──────────────────────────────────────────────
// Applies dice skin visuals and keeps dice faces as dots.
// Menu buttons and store purchases are owned by login-feature-finalizer.js
// to avoid multiple scripts redrawing the same UI and causing flashing.

(function() {
  const ACTIVE_KEY = 'yum_active_dice_skin';
  const COLOR_KEY = 'yum_custom_dice_color';

  const PALETTE = [
    ['white', '#f8f8f8', '#111'],
    ['red', '#ef4444', '#fff'],
    ['orange', '#f97316', '#fff'],
    ['gold', '#f5a623', '#251400'],
    ['green', '#22c55e', '#07130a'],
    ['teal', '#14b8a6', '#031817'],
    ['blue', '#3b82f6', '#fff'],
    ['purple', '#8b5cf6', '#fff'],
    ['pink', '#ec4899', '#fff'],
    ['black', '#111827', '#fff']
  ];

  const DOT_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
  const PREMIUM_SKIN_IDS = ['gold','neon','ice','fire','galaxy'];

  function getActive() {
    return localStorage.getItem(ACTIVE_KEY) || 'classic';
  }

  function colorPair() {
    const saved = localStorage.getItem(COLOR_KEY) || '#f8f8f8';
    return PALETTE.find(p => p[1].toLowerCase() === saved.toLowerCase()) || PALETTE[0];
  }

  function keepDiceDots() {
    if (!Array.isArray(window.DICE_FACES)) return;
    DOT_FACES.forEach((face, i) => { window.DICE_FACES[i] = face; });
  }

  function injectStyles() {
    if (document.getElementById('skinStoreUpgradeStyles')) return;
    const style = document.createElement('style');
    style.id = 'skinStoreUpgradeStyles';
    style.textContent = `
      .main-skin-store-btn {
        width: min(520px, 100%);
        border: 1px solid rgba(245,166,35,.42);
        background: rgba(245,166,35,.13);
        color: var(--gold);
        border-radius: 999px;
        padding: 10px 14px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: 1px;
        cursor: pointer;
        box-shadow: 0 8px 28px rgba(245,166,35,.12);
      }
      #skinStoreUpgradeOverlay {
        position: fixed;
        inset: 0;
        z-index: 980;
        display: none;
        align-items: flex-end;
        justify-content: center;
        background: rgba(0,0,0,.72);
      }
      #skinStoreUpgradeOverlay.open { display: flex; }
      .ssu-sheet {
        width: 100%;
        max-width: 520px;
        max-height: 84vh;
        overflow-y: auto;
        border-radius: 24px 24px 0 0;
        background: var(--panel);
        border: 1px solid rgba(245,166,35,.22);
        box-shadow: 0 -16px 50px rgba(0,0,0,.55);
        padding: 18px 16px 28px;
      }
      .ssu-head { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px; }
      .ssu-title { font-family:'Bebas Neue',cursive;font-size:1.55rem;letter-spacing:3px;color:var(--gold); }
      .ssu-close { border:none;background:rgba(255,255,255,.08);color:var(--muted);border-radius:999px;padding:8px 12px;font-weight:900; }
      .ssu-credit { display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:15px;padding:11px 13px;margin-bottom:12px; }
      .ssu-small { color:var(--muted);font-size:.72rem;font-weight:800; }
      .ssu-credit-num { font-family:'Bebas Neue',cursive;font-size:1.7rem;letter-spacing:2px;color:var(--gold); }
      .ssu-section { background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px;margin-bottom:12px; }
      .ssu-section-title { font-weight:1000;color:var(--green);letter-spacing:1px;margin-bottom:8px; }
      .ssu-palette { display:flex;flex-wrap:wrap;gap:8px;margin-top:9px; }
      .ssu-swatch { width:38px;height:38px;border-radius:10px;border:2px solid rgba(255,255,255,.14);box-shadow:0 3px 10px rgba(0,0,0,.25);cursor:pointer; }
      .ssu-swatch.active { border-color:var(--gold);box-shadow:0 0 0 3px rgba(245,166,35,.18); }
      .ssu-skins { display:grid;gap:10px; }
      .ssu-card { background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px; }
      .ssu-card.active { border-color:rgba(78,205,196,.55);box-shadow:0 0 18px rgba(78,205,196,.16); }
      .ssu-card-top { display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px; }
      .ssu-name { font-weight:1000;color:var(--white); }
      .ssu-cost { color:var(--gold);font-size:.76rem;font-weight:1000;white-space:nowrap; }
      .ssu-preview { display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px; }
      .ssu-preview span { width:30px;height:30px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:1000;line-height:1; }
      .ssu-action { width:100%;border:none;border-radius:999px;padding:9px 12px;font-family:Nunito,sans-serif;font-weight:1000;letter-spacing:.7px;cursor:pointer;background:linear-gradient(135deg,var(--green),#2ecc71);color:#111; }
      .ssu-action.locked { background:rgba(255,255,255,.08);color:var(--muted);border:1px solid rgba(255,255,255,.1); }
      .ssu-action.active { background:rgba(78,205,196,.12);color:var(--green);border:1px solid rgba(78,205,196,.35); }
      body.skin-gold .dice-section .die { background:linear-gradient(135deg,#fff7cc,#f5a623)!important;color:#251400!important; }
      body.skin-neon .dice-section .die { background:#101827!important;color:#4ecdc4!important;border:1px solid rgba(78,205,196,.6)!important;box-shadow:0 0 18px rgba(78,205,196,.25)!important; }
      body.skin-ice .dice-section .die { background:linear-gradient(135deg,#e0f7ff,#8fd8ff)!important;color:#06283d!important; }
      body.skin-fire .dice-section .die { background:linear-gradient(135deg,#ffd166,#e94560)!important;color:#180004!important; }
      body.skin-galaxy .dice-section .die { background:radial-gradient(circle at 30% 20%,#a855f7,#0f172a 68%)!important;color:#f8fafc!important;border:1px solid rgba(168,85,247,.7)!important;box-shadow:0 0 20px rgba(168,85,247,.28)!important; }
      body.skin-classic .dice-section .die,
      body:not(.skin-gold):not(.skin-neon):not(.skin-ice):not(.skin-fire):not(.skin-galaxy) .dice-section .die {
        background: var(--yum-custom-die-bg, #f8f8f8) !important;
        color: var(--yum-custom-die-fg, #111) !important;
      }
      body.skin-classic .dice-section .die.held,
      body.skin-gold .dice-section .die.held,
      body.skin-neon .dice-section .die.held,
      body.skin-ice .dice-section .die.held,
      body.skin-fire .dice-section .die.held,
      body.skin-galaxy .dice-section .die.held,
      body:not(.skin-gold):not(.skin-neon):not(.skin-ice):not(.skin-fire):not(.skin-galaxy) .dice-section .die.held {
        background: var(--gold) !important;
        color: #111 !important;
        border: none !important;
        box-shadow: 0 0 14px rgba(245,166,35,0.6) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applySkinAndColor() {
    keepDiceDots();
    const active = getActive();
    document.body.classList.remove('skin-classic','skin-gold','skin-neon','skin-ice','skin-fire','skin-galaxy');
    document.body.classList.add(PREMIUM_SKIN_IDS.includes(active) ? `skin-${active}` : 'skin-classic');
    const pair = colorPair();
    document.documentElement.style.setProperty('--yum-custom-die-bg', pair[1]);
    document.documentElement.style.setProperty('--yum-custom-die-fg', pair[2]);
  }

  function init() {
    injectStyles();
    applySkinAndColor();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(applySkinAndColor, 1200);
})();
