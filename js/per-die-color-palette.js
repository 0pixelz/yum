// ─── PER-DIE COLOR PALETTE ───────────────────────────────────────────
// Lets the user choose a free color for each individual classic/original die.

(function() {
  const PER_DIE_COLORS_KEY = 'yum_per_die_colors';
  const ACTIVE_KEY = 'yum_active_dice_skin';

  const PALETTE = [
    ['White', '#f8f8f8', '#111'],
    ['Red', '#ef4444', '#fff'],
    ['Orange', '#f97316', '#fff'],
    ['Gold', '#f5a623', '#251400'],
    ['Green', '#22c55e', '#07130a'],
    ['Teal', '#14b8a6', '#031817'],
    ['Blue', '#3b82f6', '#fff'],
    ['Purple', '#8b5cf6', '#fff'],
    ['Pink', '#ec4899', '#fff'],
    ['Black', '#111827', '#fff']
  ];

  const DOT_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];

  let selectedDieIndex = null;

  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch(e) { return fallback; }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getColors() {
    const saved = loadJSON(PER_DIE_COLORS_KEY, null);
    if (!Array.isArray(saved) || saved.length !== 5) return ['#f8f8f8','#f8f8f8','#f8f8f8','#f8f8f8','#f8f8f8'];
    return saved.map(c => PALETTE.some(p => p[1].toLowerCase() === String(c).toLowerCase()) ? c : '#f8f8f8');
  }

  function setColors(colors) {
    saveJSON(PER_DIE_COLORS_KEY, colors);
  }

  function pairForColor(color) {
    return PALETTE.find(p => p[1].toLowerCase() === String(color).toLowerCase()) || PALETTE[0];
  }

  function isClassicActive() {
    const active = localStorage.getItem(ACTIVE_KEY) || 'classic';
    return active === 'classic';
  }

  function keepDiceDots() {
    if (!Array.isArray(window.DICE_FACES)) return;
    DOT_FACES.forEach((face, i) => { window.DICE_FACES[i] = face; });
  }

  function injectStyles() {
    if (document.getElementById('perDieColorPaletteStyles')) return;
    const style = document.createElement('style');
    style.id = 'perDieColorPaletteStyles';
    style.textContent = `
      .per-die-color-section {
        background: rgba(255,255,255,.055);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .per-die-color-title {
        font-weight: 1000;
        color: var(--green);
        letter-spacing: 1px;
        margin-bottom: 5px;
      }
      .per-die-color-preview {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin: 12px 0 8px;
      }
      .per-die-color-slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        cursor: pointer;
      }
      .per-die-color-face {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 1000;
        font-size: 1.45rem;
        line-height: 1;
        border: 2px solid transparent;
        box-shadow: 0 4px 10px rgba(0,0,0,.28);
      }
      .per-die-color-slot.active .per-die-color-face {
        border-color: var(--gold);
        box-shadow: 0 0 0 3px rgba(245,166,35,.16), 0 4px 10px rgba(0,0,0,.28);
        transform: translateY(-2px);
      }
      .per-die-color-label {
        color: var(--muted);
        font-size: .58rem;
        font-weight: 900;
        letter-spacing: .5px;
      }
      .per-die-color-palette {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
        padding-top: 10px;
        margin-top: 10px;
        border-top: 1px solid rgba(255,255,255,.08);
      }
      .per-die-color-swatch {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        border: 2px solid rgba(255,255,255,.14);
        box-shadow: 0 3px 10px rgba(0,0,0,.25);
        cursor: pointer;
      }
      .per-die-color-swatch.selected {
        border-color: var(--gold);
        box-shadow: 0 0 0 3px rgba(245,166,35,.18);
      }
      .per-die-color-reset {
        width: 100%;
        margin-top: 10px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.07);
        color: var(--muted);
        border-radius: 999px;
        padding: 8px 12px;
        font-family: Nunito, sans-serif;
        font-weight: 900;
        letter-spacing: .6px;
      }
    `;
    document.head.appendChild(style);
  }

  function applyPerDieColors() {
    if (!isClassicActive()) return;
    keepDiceDots();
    const colors = getColors();
    document.querySelectorAll('.dice-section .die[data-i]').forEach(el => {
      if (el.classList.contains('held')) {
        el.style.removeProperty('background');
        el.style.removeProperty('color');
        el.style.removeProperty('border');
        return;
      }
      const i = Number(el.getAttribute('data-i'));
      const pair = pairForColor(colors[i]);
      el.style.setProperty('background', pair[1], 'important');
      el.style.setProperty('color', pair[2], 'important');
      el.style.setProperty('border', 'none', 'important');
    });
  }

  function clearInlinePerDieColorsForPremium() {
    if (isClassicActive()) return;
    document.querySelectorAll('.dice-section .die[data-i]').forEach(el => {
      el.style.removeProperty('background');
      el.style.removeProperty('color');
      el.style.removeProperty('border');
    });
  }

  function applyColors() {
    keepDiceDots();
    clearInlinePerDieColorsForPremium();
    applyPerDieColors();
  }

  function renderSection() {
    const colors = getColors();
    const slots = colors.map((color, i) => {
      const pair = pairForColor(color);
      return `<div class="per-die-color-slot ${selectedDieIndex === i ? 'active' : ''}" onclick="selectDieColorSlot(${i})">
        <div class="per-die-color-face" style="background:${pair[1]};color:${pair[2]}">${DOT_FACES[i]}</div>
        <div class="per-die-color-label">DIE ${i + 1}</div>
      </div>`;
    }).join('');

    const palette = selectedDieIndex === null ? '' : `<div class="per-die-color-palette">
      ${PALETTE.map(([name, bg]) => `<button class="per-die-color-swatch ${colors[selectedDieIndex].toLowerCase() === bg.toLowerCase() ? 'selected' : ''}" title="${name}" style="background:${bg}" onclick="setDieColor(${selectedDieIndex}, '${bg}')"></button>`).join('')}
    </div>`;

    return `<div class="per-die-color-section" id="perDieColorSection">
      <div class="per-die-color-title">FREE COLOR PALETTE FOR EACH DIE</div>
      <div class="ssu-small">Tap a die, then choose its color. This is free for the original dice.</div>
      <div class="per-die-color-preview">${slots}</div>
      ${palette || '<div class="ssu-small" style="text-align:center;margin-top:6px">Tap one die above to customize it.</div>'}
      <button class="per-die-color-reset" onclick="resetDieColors()">Reset all dice to white</button>
    </div>`;
  }

  function insertIntoStore() {
    const content = document.getElementById('ssuContent');
    if (!content) return;

    let section = document.getElementById('perDieColorSection');
    const html = renderSection();
    if (section) {
      section.outerHTML = html;
      return;
    }

    content.insertAdjacentHTML('afterbegin', html);
  }

  window.selectDieColorSlot = function selectDieColorSlot(i) {
    selectedDieIndex = selectedDieIndex === i ? null : i;
    insertIntoStore();
  };

  window.setDieColor = function setDieColor(i, color) {
    const colors = getColors();
    colors[i] = color;
    setColors(colors);
    localStorage.setItem(ACTIVE_KEY, 'classic');
    applyColors();
    insertIntoStore();
    if (typeof renderDice === 'function') setTimeout(() => { renderDice(false); applyColors(); }, 0);
  };

  window.resetDieColors = function resetDieColors() {
    setColors(['#f8f8f8','#f8f8f8','#f8f8f8','#f8f8f8','#f8f8f8']);
    localStorage.setItem(ACTIVE_KEY, 'classic');
    selectedDieIndex = null;
    applyColors();
    insertIntoStore();
    if (typeof renderDice === 'function') setTimeout(() => { renderDice(false); applyColors(); }, 0);
  };

  function patchOpenStore() {
    const original = window.openSkinStore;
    if (typeof original !== 'function' || original.__perDieColorPatched) return;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(() => {
        injectStyles();
        insertIntoStore();
        applyColors();
      }, 40);
      return result;
    };
    patched.__perDieColorPatched = true;
    window.openSkinStore = patched;
  }

  function patchRenderDice() {
    const original = window.renderDice;
    if (typeof original !== 'function' || original.__perDieColorPatched) return;
    const patched = function(...args) {
      const result = original.apply(this, args);
      setTimeout(applyColors, 0);
      return result;
    };
    patched.__perDieColorPatched = true;
    window.renderDice = patched;
  }

  function init() {
    injectStyles();
    patchOpenStore();
    patchRenderDice();
    applyColors();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  setInterval(() => {
    patchOpenStore();
    patchRenderDice();
    applyColors();
    if (document.getElementById('skinStoreUpgradeOverlay')?.classList.contains('open')) insertIntoStore();
  }, 1200);
})();
