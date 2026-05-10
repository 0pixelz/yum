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
  const PREMIUM_SKIN_IDS = [
    'gold','neon','ice','fire','galaxy',
    'emerald','ruby','sapphire','sunset','aurora',
    'obsidian','phantom','toxic','lava','frost',
    'royal','cosmic','dragon','mythic','diamond'
  ];

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
      body.skin-emerald .dice-section .die { background:linear-gradient(135deg,#10b981,#064e3b)!important;color:#ecfdf5!important;border:1px solid rgba(16,185,129,.7)!important;box-shadow:0 0 16px rgba(16,185,129,.25)!important; }
      body.skin-ruby .dice-section .die { background:linear-gradient(135deg,#ff4d6d,#7f1d1d)!important;color:#fff1f3!important;border:1px solid rgba(244,63,94,.7)!important;box-shadow:0 0 16px rgba(244,63,94,.28)!important; }
      body.skin-sapphire .dice-section .die { background:linear-gradient(135deg,#3b82f6,#1e3a8a)!important;color:#dbeafe!important;border:1px solid rgba(96,165,250,.7)!important;box-shadow:0 0 16px rgba(59,130,246,.28)!important; }
      body.skin-sunset .dice-section .die { background:linear-gradient(135deg,#f97316,#ec4899)!important;color:#fff7ed!important;box-shadow:0 0 16px rgba(236,72,153,.25)!important; }
      body.skin-aurora .dice-section .die { background:linear-gradient(135deg,#22d3ee,#a855f7,#10b981)!important;color:#f0fdfa!important;border:1px solid rgba(167,139,250,.6)!important;box-shadow:0 0 18px rgba(34,211,238,.3)!important; }
      body.skin-obsidian .dice-section .die { background:linear-gradient(135deg,#0f172a,#000)!important;color:#94a3b8!important;border:1px solid rgba(148,163,184,.5)!important;box-shadow:0 0 14px rgba(148,163,184,.25)!important; }
      body.skin-phantom .dice-section .die { background:radial-gradient(circle,#cbd5e1,#475569 70%)!important;color:#f1f5f9!important;border:1px solid rgba(203,213,225,.5)!important;box-shadow:0 0 18px rgba(203,213,225,.35)!important; }
      body.skin-toxic .dice-section .die { background:linear-gradient(135deg,#84cc16,#365314)!important;color:#f7fee7!important;border:1px solid rgba(132,204,22,.7)!important;box-shadow:inset 0 0 8px rgba(132,204,22,.5),0 0 16px rgba(132,204,22,.3)!important; }
      body.skin-lava .dice-section .die { background:radial-gradient(circle at 30% 30%,#fde047,#dc2626 60%,#7f1d1d)!important;color:#fef9c3!important;box-shadow:0 0 20px rgba(220,38,38,.4)!important; }
      body.skin-frost .dice-section .die { background:linear-gradient(135deg,#f0f9ff,#0ea5e9)!important;color:#082f49!important;border:1px solid rgba(125,211,252,.8)!important;box-shadow:0 0 16px rgba(14,165,233,.35)!important; }
      body.skin-royal .dice-section .die { background:linear-gradient(135deg,#fbbf24,#7c3aed)!important;color:#fef3c7!important;border:1px solid rgba(251,191,36,.7)!important;box-shadow:0 0 18px rgba(124,58,237,.35)!important; }
      body.skin-cosmic .dice-section .die { background:radial-gradient(circle at 25% 25%,#fbbf24 0%,#1e1b4b 35%,#000 80%)!important;color:#fef3c7!important;border:1px solid rgba(168,85,247,.6)!important;box-shadow:0 0 20px rgba(168,85,247,.4)!important; }
      body.skin-dragon .dice-section .die { background:linear-gradient(135deg,#dc2626,#000,#dc2626)!important;color:#fde047!important;border:1px solid rgba(220,38,38,.8)!important;box-shadow:inset 0 0 10px rgba(220,38,38,.4),0 0 18px rgba(220,38,38,.45)!important; }
      body.skin-mythic .dice-section .die { background:conic-gradient(from 45deg,#a855f7,#22d3ee,#fbbf24,#ec4899,#a855f7)!important;color:#fff!important;border:1px solid rgba(255,255,255,.6)!important;box-shadow:0 0 22px rgba(255,255,255,.4)!important; }
      body.skin-diamond .dice-section .die { background:linear-gradient(135deg,#e0f7ff,#fff,#fce7f3,#dbeafe,#fff)!important;color:#0f172a!important;border:1px solid rgba(255,255,255,.8)!important;box-shadow:0 0 22px rgba(255,255,255,.7),inset 0 0 12px rgba(186,230,253,.6)!important; }
      body.skin-classic .dice-section .die,
      body:not(.skin-gold):not(.skin-neon):not(.skin-ice):not(.skin-fire):not(.skin-galaxy):not(.skin-emerald):not(.skin-ruby):not(.skin-sapphire):not(.skin-sunset):not(.skin-aurora):not(.skin-obsidian):not(.skin-phantom):not(.skin-toxic):not(.skin-lava):not(.skin-frost):not(.skin-royal):not(.skin-cosmic):not(.skin-dragon):not(.skin-mythic):not(.skin-diamond) .dice-section .die {
        background: var(--yum-custom-die-bg, #f8f8f8) !important;
        color: var(--yum-custom-die-fg, #111) !important;
      }
      body[class*="skin-"] .dice-section .die.held,
      .dice-section .die.held {
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
    const skinClasses = ['skin-classic', ...PREMIUM_SKIN_IDS.map(id => `skin-${id}`)];
    document.body.classList.remove(...skinClasses);
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
