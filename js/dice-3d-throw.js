// 3D dice throw overlay — drag-and-flick gesture, Three.js + cannon-es.
// Exposes window.throw3DDie() → Promise<1-6>. Falls back to random on failure.
//
// Also exposes window.throw3DDice({dice, held, rollsLeft}) which runs a full
// in-overlay roll turn (solo/bot only — multiplayer rolls go through the
// server): the player flicks to roll, taps dice to keep them (they fly to a
// side shelf like the 2D roller), can roll again, and taps a suggested score to
// finish. Resolves with {dice:[5], held:[5], rollsUsed, pick:catId|null,
// skipped}. A legacy throw3DDice(count) call still resolves with a face array.
(function () {
  'use strict';

  let THREE, CANNON;
  let scene, camera, renderer;
  let world, dieBody, dieMesh, floorMesh;
  let dieMats = null;          // single-die face materials (themed by active skin)
  let currentThemeKey = null;  // signature of the skin/colour the textures were built for
  let floorPMat = null, diePMat = null;
  let overlay, canvasEl, statusEl, cancelBtn;
  let rafId = null;
  let lastTime = 0;
  let resolveFn = null;
  let dragging = false;
  let throwing = false;
  let pointerSamples = [];
  let lastDragP = null; // previous pointer (x,z) on the drag plane, for tumble-on-drag
  let settleStart = 0;
  let dragPlane;
  let raycaster;
  let pickOffset = { x: 0, z: 0 };

  // ── Multi-die mode state ─────────────────────────────────────────
  // 'single' = drag-and-flick one die (who-goes-first). 'multi' = flick-throw
  // N smaller dice all at once (Pokémon-GO-style swipe). 'spectator' =
  // non-interactive playback of an opponent's throw — meshes are posed from
  // network-streamed transforms, no physics drives them.
  let mode = 'single';
  let _onFrameCb = null, _onOpenCb = null, _onCloseCb = null;
  let _onSpectatorHideCb = null;
  let multiDiceBodies = [];
  let multiDiceMeshes = [];
  let multiThrowing = false;
  let multiReady = false;          // dice are parked, awaiting a flick
  let multiDragging = false;
  let multiPointerSamples = [];
  let multiSettleStart = 0;
  let multiRelaxTries = 0;         // un-stack re-drops performed this throw (capped)
  let multiResolve = null;
  let multiGeom = null;
  let multiMats = null;
  let multiPerDieMats = null;  // per-die material sets when the free colour palette is active
  let multiLanes = [];             // pre-computed {dx,dz} fan offsets per die
  let multiLastDragP = null;
  // Suggestions / kept-shelf state for the in-game multi roll.
  let multiSuggest = false;        // show the "what you can score" strip on settle
  let multiHeldValues = [];        // face values the player is keeping this roll
  let multiSettledResults = null;  // rolled faces after the dice come to rest
  let heldMeshes = [];             // visual-only "kept" dice parked to the side
  let heldTray = null;             // little shelf the kept dice rest on
  let heldGeom = null;
  const HELD_SIZE = 0.5;

  // ── Interactive turn state ───────────────────────────────────────
  // The in-game 3D roll runs the whole turn inside the overlay (solo/bot only —
  // multiplayer rolls go through the server). Five persistent dice live in
  // multiDiceBodies/Meshes; each carries a `_kept` flag. Kept dice park on the
  // side shelf (tap to fly them there) and sit out throws; the rest are flicked.
  let interactiveTurn = false;
  let turnSettled = false;         // dice at rest, awaiting keep / reroll / score
  let turnRollsLeft = 0;           // rolls available when the overlay opened
  let turnRollsUsed = 0;           // physical throws performed this overlay
  let turnPick = null;             // category id the player tapped to score
  let turnResolve = null;          // resolves the interactive-turn promise
  let flyTweens = [];              // {body, fromP, toP, fromQ, toQ, t, dur, onDone}
  let actionsEl = null;            // bottom action row (done)
  let keptEl = null;               // 2D "kept" dice faces shown under the header
  let rerollEl = null;             // floating "Roll again" button on the table
  let scorecardEl = null;          // slide-up scorecard panel (peek / strike a category)
  const TRAY_TOP = 0.16;           // top surface height of the kept shelf
  // SHELF_X depends on WALL_SIDE (declared further down); set after it.

  // Opponent-roll text strip — used by the "who goes first" flow so the
  // player can see what their opponent(s) rolled while throwing their own
  // die. Source of truth lives in first-roll.js; we just render the array.
  let _oppRolls = [];
  function _escOpp(s) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
    return String(s).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function _renderOppRolls() {
    if (!overlay) return;
    const el = overlay.querySelector('#dice3dOppRolls');
    if (!el) return;
    if (!_oppRolls.length) { el.innerHTML = ''; return; }
    el.innerHTML = _oppRolls.map(r =>
      '<div class="d3d-opp-item"><span class="d3d-opp-name">' +
      _escOpp(r.name) + '</span> rolled <b>' + (r.val | 0) + '</b></div>'
    ).join('');
  }

  // BoxGeometry material order: [+X, -X, +Y, -Y, +Z, -Z]
  // Standard die: opposite faces sum to 7.
  const FACE_NUMBERS = [1, 6, 2, 5, 3, 4];
  const FACE_KEYS    = ['+X','-X','+Y','-Y','+Z','-Z'];

  const DIE_SIZE = 1.0;
  const DIE_BEVEL = DIE_SIZE * 0.13; // corner/edge radius — gives a soft "casino die" silhouette
  const FLOOR_Y = 0;
  const DRAG_Y = DIE_SIZE; // hover height while dragging

  // Play-area bounds — sized so the die always stays inside the camera's
  // visible footprint on the floor (see initScene for camera/FOV).
  const WALL_FRONT =  2.6;   // wall closest to camera (max +Z)
  const WALL_BACK  = -5.0;   // wall farthest from camera (min -Z)
  const WALL_SIDE  =  2.4;   // ±X side walls
  const DIE_HALF   =  DIE_SIZE / 2;
  // Pointer-drag bounds: keep the die center safely inside the walls.
  const DRAG_X_LIMIT = WALL_SIDE  - DIE_HALF - 0.05;
  const DRAG_Z_MIN   = WALL_BACK  + DIE_HALF + 0.05;
  const DRAG_Z_MAX   = WALL_FRONT - DIE_HALF - 0.05;
  const clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);

  // X position of the kept-dice shelf (just inside the left wall). Declared here
  // so it resolves WALL_SIDE without hitting its temporal dead zone.
  const SHELF_X = -(WALL_SIDE - 0.42);

  // ── Sound effects ────────────────────────────────────────────────
  // Reuses the global `soundEnabled` flag and yumSound localStorage key set in
  // app.js so the dice overlay obeys the same mute toggle as the rest of the app.
  let _diceAudioCtx = null;
  let _lastTapTime = 0;
  function diceCtx() {
    if (_diceAudioCtx) return _diceAudioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _diceAudioCtx = new AC();
    return _diceAudioCtx;
  }
  function soundOn() {
    if (typeof window.soundEnabled === 'boolean') return window.soundEnabled;
    return localStorage.getItem('yumSound') !== 'off';
  }
  function playThrowClatter() {
    if (!soundOn()) return;
    if (typeof SFX !== 'undefined' && typeof SFX.roll === 'function') { SFX.roll(); return; }
    // Fallback if SFX isn't loaded yet
    const ctx = diceCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.05;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180 + Math.random() * 120, t);
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.08);
    }
  }
  function playImpactTap(speed) {
    if (!soundOn()) return;
    const ctx = diceCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    // Throttle so a single step with multiple contact points doesn't stack.
    if (now - _lastTapTime < 0.035) return;
    _lastTapTime = now;
    const vol = Math.min(0.22, 0.05 + speed * 0.018);
    const baseFreq = 160 + Math.random() * 90;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.06);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.09);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // Yamio brand palette (mirrors :root vars in css/style.css)
  const BRAND = {
    bg:     '#1a1a2e',
    card:   '#16213e',
    panel:  '#0f3460',
    accent: '#e94560',
    gold:   '#f5a623',
    green:  '#4ecdc4',
    white:  '#f0f0f0'
  };

  // ── Dice-skin → 3D theme ─────────────────────────────────────────
  // The 3D die mirrors whatever skin the player has equipped in the 2D game.
  // The equipped skin id lives in localStorage 'yum_active_dice_skin' and, for
  // the Classic skin, an optional custom face colour in 'yum_custom_dice_color'.
  // A theme is { stops:[[pos,color]…] (face radial gradient), pip, glow? }.
  function _hexRGB(h) {
    h = String(h || '').trim();
    if (h[0] === '#') h = h.slice(1);
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n) || h.length < 6) return { r: 248, g: 248, b: 248 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function _toHex(r, g, b) {
    const c = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  }
  function _mixHex(a, b, t) {
    const x = _hexRGB(a), y = _hexRGB(b);
    return _toHex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
  }
  const _lighten = (h, t) => _mixHex(h, '#ffffff', t);
  const _darken  = (h, t) => _mixHex(h, '#000000', t);
  function _lum(h) { const { r, g, b } = _hexRGB(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
  function _rgba(h, a) { const { r, g, b } = _hexRGB(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }
  function _rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h, s, l };
  }
  function _hslToHex(h, s, l) {
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2 = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2(p, q, h + 1 / 3); g = hue2(p, q, h); b = hue2(p, q, h - 1 / 3);
    }
    return _toHex(r * 255, g * 255, b * 255);
  }
  // Punch up saturation a touch so flat dice read vivid, not washed out.
  function _saturate(hex, amt) {
    const { r, g, b } = _hexRGB(hex);
    const hsl = _rgbToHsl(r, g, b);
    return _hslToHex(hsl.h, Math.min(1, hsl.s * (1 + amt)), hsl.l);
  }
  // A single base colour expanded into a shaded face gradient + contrasting pip.
  // Holds the true colour across most of the face (only a soft top-left sheen
  // and a darkened rounded edge for depth) so the dice look rich, not pale.
  function _solidTheme(hex, pip) {
    const base = _saturate(hex, 0.18);
    return {
      stops: [
        [0,    _lighten(base, 0.26)],
        [0.42, base],
        [0.80, _darken(base, 0.16)],
        [1,    _darken(base, 0.40)]
      ],
      pip: pip || (_lum(hex) > 0.55 ? '#141414' : '#f8f8f8')
    };
  }

  // Premium / gradient skins — explicit stops tuned to match each 2D skin.
  const PREMIUM_THEMES = {
    gold:     { stops: [[0,'#fff7cc'],[0.34,'#ffdd80'],[0.72,'#f5a623'],[1,'#9c6206']], pip:'#2a1500' },
    neon:     { stops: [[0,'#1c2c4a'],[0.5,'#101827'],[1,'#070c16']], pip:'#5fe0d6', glow:'#4ecdc4' },
    ice:      { stops: [[0,'#f2fcff'],[0.4,'#c4ecff'],[1,'#7fcdf2']], pip:'#06283d' },
    fire:     { stops: [[0,'#ffe7a0'],[0.4,'#ffc24a'],[0.74,'#ef5a3a'],[1,'#a01029']], pip:'#250203' },
    galaxy:   { stops: [[0,'#c9a4ff'],[0.4,'#8b48f0'],[0.78,'#251049'],[1,'#0c0a20']], pip:'#f3eeff', glow:'#a855f7' },
    candy:    { stops: [[0,'#fff1f8'],[0.45,'#fbcfe8'],[1,'#f487c0']], pip:'#be185d' },
    ocean:    { stops: [[0,'#1f7fb8'],[0.45,'#0a5f96'],[1,'#072f52']], pip:'#cdeeff' },
    midnight: { stops: [[0,'#2c3a55'],[0.5,'#141d31'],[1,'#020617']], pip:'#9fb0c8', glow:'#64748b' },
    lava:     { stops: [[0,'#ffe55c'],[0.4,'#f59e0b'],[0.72,'#dc2626'],[1,'#6f1414']], pip:'#fff0bd', glow:'#f97316' },
    rosegold: { stops: [[0,'#fff0f5'],[0.45,'#f9b8cc'],[1,'#e58aa0']], pip:'#7d1839' },
    emerald:  { stops: [[0,'#86f2c8'],[0.4,'#10b981'],[1,'#064e3b']], pip:'#eafff6' },
    ruby:     { stops: [[0,'#ff9fb2'],[0.4,'#ff3d60'],[1,'#7a1a1a']], pip:'#fff0f3' },
    sapphire: { stops: [[0,'#a3c7ff'],[0.4,'#3b82f6'],[1,'#1b357f']], pip:'#eef4ff' },
    sunset:   { stops: [[0,'#ffd6a3'],[0.4,'#f97316'],[0.78,'#ec4899'],[1,'#921248']], pip:'#fff6ec' },
    aurora:   { stops: [[0,'#a3f7ff'],[0.34,'#22d3ee'],[0.68,'#a855f7'],[1,'#2f9968']], pip:'#f0fdfa', glow:'#22d3ee' },
    obsidian: { stops: [[0,'#3c4965'],[0.45,'#101a30'],[1,'#000000']], pip:'#aab6c8' },
    phantom:  { stops: [[0,'#f0f3f8'],[0.45,'#cbd5e1'],[1,'#46556b']], pip:'#1f2937', glow:'#cbd5e1' },
    toxic:    { stops: [[0,'#dcfb7e'],[0.4,'#84cc16'],[1,'#33500f']], pip:'#f8ffe6', glow:'#bef264' },
    frost:    { stops: [[0,'#f6fcff'],[0.4,'#aae1ff'],[1,'#0ea5e9']], pip:'#072e47' },
    royal:    { stops: [[0,'#ffe39a'],[0.38,'#fbbf24'],[0.78,'#7c3aed'],[1,'#37106e']], pip:'#fff6d4', glow:'#a855f7' },
    cosmic:   { stops: [[0,'#ffdf94'],[0.3,'#fbbf24'],[0.62,'#1e1b4b'],[1,'#020207']], pip:'#fef3c7', glow:'#a855f7' },
    dragon:   { stops: [[0,'#ff6a6a'],[0.38,'#dc2626'],[0.7,'#1c0303'],[1,'#000000']], pip:'#ffe14d', glow:'#ef4444' },
    mythic:   { stops: [[0,'#b06bff'],[0.33,'#22d3ee'],[0.62,'#fbbf24'],[1,'#ec4899']], pip:'#ffffff', glow:'#ffffff' },
    diamond:  { stops: [[0,'#f5fdff'],[0.4,'#dbeafe'],[0.7,'#ede9fe'],[1,'#aeb8f5']], pip:'#241f5c', glow:'#c7d2fe' }
  };
  // Flat colour skins — base colour + pip, expanded into a shaded gradient.
  const SOLID_THEMES = {
    red:    ['#dc2626', '#fff5f5'], blue:  ['#2563eb', '#eef4ff'],
    green:  ['#16a34a', '#effdf3'], purple:['#7c3aed', '#f5efff'],
    orange: ['#ea580c', '#fff4ec'], pink:  ['#db2777', '#fff0f7'],
    black:  ['#1c1c1c', '#eaeaea'], teal:  ['#0d9488', '#eafffb']
  };

  function _activeSkinId() {
    try { return localStorage.getItem('yum_active_dice_skin') || 'classic'; }
    catch (_) { return 'classic'; }
  }
  function _customDieColor() {
    try { return localStorage.getItem('yum_custom_dice_color') || '#f8f8f8'; }
    catch (_) { return '#f8f8f8'; }
  }
  // Identifies the currently-equipped look so we only rebuild textures on change.
  function themeSignature() { return _activeSkinId() + '|' + _customDieColor(); }
  // Resolve the equipped skin to a 3D theme. Classic (the default) honours the
  // custom die colour, which itself defaults to white — so the "original" die
  // is a clean white casino die.
  function resolveDiceTheme() {
    const skin = _activeSkinId();
    if (PREMIUM_THEMES[skin]) return PREMIUM_THEMES[skin];
    if (SOLID_THEMES[skin]) return _solidTheme(SOLID_THEMES[skin][0], SOLID_THEMES[skin][1]);
    return _solidTheme(_customDieColor() || '#f8f8f8');
  }
  // Theme for an explicit skin id (used in spectator mode so an opponent's dice
  // wear *their* equipped skin, not the local player's). Classic/unknown → white.
  function themeForSkin(skinId) {
    if (skinId && PREMIUM_THEMES[skinId]) return PREMIUM_THEMES[skinId];
    if (skinId && SOLID_THEMES[skinId]) return _solidTheme(SOLID_THEMES[skinId][0], SOLID_THEMES[skinId][1]);
    return _solidTheme('#f8f8f8');
  }

  // Rebuild the face textures of the single die + multi dice for the equipped
  // skin. Cheap (six 512² canvases) and only runs when the overlay opens, so a
  // skin change between turns is picked up without reloading the page.
  function applyDiceTheme(force, skinOverride) {
    if (!THREE) return;
    const sig = (skinOverride != null) ? ('opp:' + skinOverride) : themeSignature();
    if (!force && sig === currentThemeKey) return;
    currentThemeKey = sig;
    const theme = (skinOverride != null) ? themeForSkin(skinOverride) : resolveDiceTheme();
    const update = (mats) => {
      if (!mats) return;
      mats.forEach((m, i) => {
        const tex = makeFaceTexture(FACE_NUMBERS[i], theme);
        if (m.map && m.map !== tex) { try { m.map.dispose(); } catch (_) {} }
        m.map = tex;
        m.needsUpdate = true;
      });
    };
    update(dieMats);
    update(multiMats);
  }

  // ── Free per-die colour palette ──────────────────────────────────
  // With the Classic skin equipped the player can give each of the five game
  // dice its own colour (yum_per_die_colors). Pip colours mirror the 2D palette
  // foregrounds so the look matches the flat dice exactly.
  const PER_DIE_PIP = {
    '#f8f8f8': '#111111', '#ef4444': '#ffffff', '#f97316': '#ffffff', '#f5a623': '#251400',
    '#22c55e': '#07130a', '#14b8a6': '#031817', '#3b82f6': '#ffffff', '#8b5cf6': '#ffffff',
    '#ec4899': '#ffffff', '#111827': '#ffffff'
  };
  // Returns an array of five themes (one per die) when the free palette applies,
  // otherwise null so callers fall back to the single shared theme.
  function perDieThemes() {
    if (_activeSkinId() !== 'classic') return null;
    let colors = null;
    try { colors = JSON.parse(localStorage.getItem('yum_per_die_colors') || 'null'); }
    catch (_) { return null; }
    if (!Array.isArray(colors) || colors.length !== 5) return null;
    return colors.map(c => {
      const hex = String(c || '#f8f8f8');
      return _solidTheme(hex, PER_DIE_PIP[hex.toLowerCase()]);
    });
  }

  // Build / dispose a set of six face materials for a theme.
  function buildFaceMatSet(theme) {
    return FACE_NUMBERS.map(n => new THREE.MeshStandardMaterial({
      map: makeFaceTexture(n, theme),
      roughness: 0.32,
      metalness: 0.15,
      envMapIntensity: 0.45,
      color: 0xffffff
    }));
  }
  function disposeMatSet(set) {
    if (!set) return;
    set.forEach(m => { try { if (m.map) m.map.dispose(); m.dispose(); } catch (_) {} });
  }
  function disposePerDieMats() {
    if (!multiPerDieMats) return;
    multiPerDieMats.forEach(disposeMatSet);
    multiPerDieMats = null;
  }

  // Paints one die face for the given number using the supplied theme. The
  // canvas is filled edge to edge so the rounded corners of the geometry show
  // face colour too; pips get a soft drop shadow, a recessed gradient body, an
  // optional themed glow halo, and a small specular highlight.
  function makeFaceTexture(num, theme) {
    theme = theme || resolveDiceTheme();
    const stops = theme.stops || [[0, '#ffffff'], [1, '#dddddd']];
    const pipColor = theme.pip || '#141414';
    const glow = theme.glow || null;
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');

    // Themed face — radial gradient from the highlight to the shadow edge.
    const faceGrad = ctx.createRadialGradient(S * 0.32, S * 0.28, 16, S * 0.5, S * 0.5, S * 0.95);
    stops.forEach(s => faceGrad.addColorStop(s[0], s[1]));
    ctx.fillStyle = faceGrad;
    ctx.fillRect(0, 0, S, S);

    // Soft inset border — reads as the bevelled edge of a casino die.
    ctx.strokeStyle = theme.border || 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 10;
    ctx.strokeRect(28, 28, S - 56, S - 56);
    ctx.strokeStyle = theme.borderInner || 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, S - 80, S - 80);

    const pipHi = _lighten(pipColor, 0.3);
    const pipLo = _darken(pipColor, 0.45);
    const pip = (x, y) => {
      // optional themed glow halo (neon / lava / galaxy …)
      if (glow) {
        const gg = ctx.createRadialGradient(x, y, 6, x, y, 64);
        gg.addColorStop(0, _rgba(glow, 0.5));
        gg.addColorStop(1, _rgba(glow, 0));
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(x, y, 64, 0, Math.PI * 2); ctx.fill();
      }
      // soft drop shadow beneath the pip for depth
      const sh = ctx.createRadialGradient(x, y + 4, 8, x, y + 6, 56);
      sh.addColorStop(0, 'rgba(0,0,0,0.4)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(x, y + 4, 56, 0, Math.PI * 2); ctx.fill();
      // pip — slight gradient for a recessed look
      const pg = ctx.createRadialGradient(x - 14, y - 14, 4, x, y, 44);
      pg.addColorStop(0,   pipHi);
      pg.addColorStop(0.5, pipColor);
      pg.addColorStop(1,   pipLo);
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(x, y, 44, 0, Math.PI * 2); ctx.fill();
      // small specular highlight
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.beginPath(); ctx.arc(x - 14, y - 14, 8, 0, Math.PI * 2); ctx.fill();
    };
    // Standard pip positions, scaled from 256→512 (×2)
    const P = {
      1: [[256,256]],
      2: [[152,152],[360,360]],
      3: [[144,144],[256,256],[368,368]],
      4: [[152,152],[360,152],[152,360],[360,360]],
      5: [[144,144],[368,144],[256,256],[144,368],[368,368]],
      6: [[152,136],[360,136],[152,256],[360,256],[152,376],[360,376]]
    };
    P[num].forEach(([x, y]) => pip(x, y));

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 16;
    return tex;
  }

  // Build a rounded-box geometry: start from a segmented BoxGeometry, then
  // push each vertex outward from the inner box (the cube shrunk by `radius`)
  // along the offset direction so the corners and edges become spherical.
  function makeRoundedBoxGeometry(size, radius, segs) {
    const half = size / 2;
    const inner = half - radius;
    const geo = new THREE.BoxGeometry(size, size, size, segs, segs, segs);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // nearest point on the inner cube
      const cx = Math.max(-inner, Math.min(inner, x));
      const cy = Math.max(-inner, Math.min(inner, y));
      const cz = Math.max(-inner, Math.min(inner, z));
      const dx = x - cx, dy = y - cy, dz = z - cz;
      const len = Math.hypot(dx, dy, dz);
      if (len > 1e-4) {
        const k = radius / len;
        pos.setXYZ(i, cx + dx * k, cy + dy * k, cz + dz * k);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Draws the Yamio brand dice mark (matches the #yum-mark SVG in index.html).
  // Origin = top-left of the mark, size = side length on the canvas.
  function drawYamioMark(ctx, x, y, size) {
    const s = size / 64; // viewBox is 64x64
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    // Warm orange radial glow behind the dice
    const glow = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    glow.addColorStop(0, 'rgba(255,140,30,0.7)');
    glow.addColorStop(1, 'rgba(255,140,30,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();

    // Drop-shadow ellipse beneath
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(32, 58, 22, 3.5, 0, 0, Math.PI * 2); ctx.fill();

    // Rounded-square die face — saturated orange so the small mark reads
    // as "orange" on the floor instead of washing out to beige.
    const dieFace = ctx.createRadialGradient(
      10 + 44 * 0.32, 8 + 44 * 0.28, 2,
      10 + 44 * 0.32, 8 + 44 * 0.28, 44 * 0.95
    );
    dieFace.addColorStop(0,    '#ffd49a');
    dieFace.addColorStop(0.32, '#ffa84a');
    dieFace.addColorStop(0.72, '#ef7a12');
    dieFace.addColorStop(1,    '#a8480a');
    ctx.fillStyle = dieFace;
    roundRect(ctx, 10, 8, 44, 44, 9);
    ctx.fill();
    ctx.strokeStyle = '#4a1f04';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 6 pips arranged 2 cols × 3 rows
    ctx.fillStyle = '#3a1a05';
    const pips = [[21,19],[43,19],[21,30],[43,30],[21,41],[43,41]];
    for (const [px, py] of pips) {
      ctx.beginPath(); ctx.arc(px, py, 2.9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function makeFloorTexture() {
    // 4K canvas — high enough that the YAMIO wordmark stays crisp even when the
    // camera dollies in and views the floor at an angle.
    const S = 4096;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');

    // Dark navy felt — matches the dim band under the header (not light blue).
    const g = ctx.createRadialGradient(S/2, S * 0.40, 80, S/2, S * 0.55, S * 0.72);
    g.addColorStop(0,    '#1b2744');
    g.addColorStop(0.55, '#131c33');
    g.addColorStop(1,    '#0c1226');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Subtle gold accent ring under the throw area
    ctx.strokeStyle = 'rgba(245,166,35,0.15)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(S/2, S * 0.58, S * 0.34, 0, Math.PI * 2); ctx.stroke();

    // ── Yamio brand logo (dice mark + wordmark, like the main lobby) ──
    // Larger on the 4K canvas → more texels per letter → stays sharp when the
    // floor is viewed at a grazing angle.
    const text = 'YAMIO';
    const fontSize = 360;
    const letterSpacing = fontSize * 0.18;            // matches CSS letter-spacing
    ctx.font = `900 ${fontSize}px 'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const widths = text.split('').map(ch => ctx.measureText(ch).width);
    const wordW = widths.reduce((a, b) => a + b, 0) + letterSpacing * (text.length - 1);
    const markSize = fontSize * 1.25;                 // .yum-brand-mark ≈ 1.15em + extra room
    const gap = fontSize * 0.35;                      // .yum-brand-logo gap = 0.4em
    const totalW = markSize + gap + wordW;
    const cy = S * 0.46;                              // mid-floor, around the camera's lookAt — sits visually centered on screen
    const logoX = (S - totalW) / 2;

    // Dice mark on the left
    drawYamioMark(ctx, logoX, cy - markSize / 2, markSize);

    // Wordmark "YAMIO" — orange-biased gold→red gradient. We hold the
    // saturated orange across most of the word and only roll into red at
    // the very end so the wordmark reads "orange" overall on the floor,
    // matching the lobby header's vivid look.
    const wordX = logoX + markSize + gap;
    // Vertical metallic gold gradient — solid fill (no hard black outline) so
    // the letters minify cleanly on the angled floor instead of breaking into
    // stripes / dark fringing.
    const wordGrad = ctx.createLinearGradient(0, cy - fontSize * 0.55, 0, cy + fontSize * 0.55);
    wordGrad.addColorStop(0,    '#ffe7b3');
    wordGrad.addColorStop(0.5,  '#f7a637');
    wordGrad.addColorStop(1,    '#e87a1b');

    const drawWord = () => {
      let x = wordX;
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], x, cy);
        x += widths[i] + letterSpacing;
      }
    };

    // Slightly translucent so it reads as a tasteful watermark and any residual
    // aliasing stays subtle against the felt.
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.lineJoin = 'round';

    // Soft drop shadow for depth (replaces the hard black outline).
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 9;
    ctx.fillStyle = wordGrad;
    drawWord();
    ctx.restore();

    // Clean fill pass on top.
    ctx.fillStyle = wordGrad;
    drawWord();

    // Thin warm-brown edge (not black) for just enough definition.
    ctx.strokeStyle = 'rgba(120,58,10,0.4)';
    ctx.lineWidth = 3;
    let sx = wordX;
    for (let i = 0; i < text.length; i++) {
      ctx.strokeText(text[i], sx, cy);
      sx += widths[i] + letterSpacing;
    }
    ctx.restore();

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 16;
    return tex;
  }

  // Full-screen gradient backdrop for the scene — deep navy with a soft brand
  // glow up top, so the background reads as a lit room instead of flat black.
  function makeBackgroundTexture() {
    const W = 512, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    // Dark navy — matches the dim band under the header.
    g.addColorStop(0,    '#18223e');
    g.addColorStop(0.5,  '#111a31');
    g.addColorStop(1,    '#0a1022');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft teal glow near the top centre
    const teal = ctx.createRadialGradient(W * 0.5, H * 0.26, 18, W * 0.5, H * 0.26, H * 0.55);
    teal.addColorStop(0, 'rgba(78,205,196,0.12)');
    teal.addColorStop(1, 'rgba(78,205,196,0)');
    ctx.fillStyle = teal;
    ctx.fillRect(0, 0, W, H);
    // faint warm gold lift lower-centre, under the dice
    const gold = ctx.createRadialGradient(W * 0.5, H * 0.72, 20, W * 0.5, H * 0.72, H * 0.5);
    gold.addColorStop(0, 'rgba(245,166,35,0.08)');
    gold.addColorStop(1, 'rgba(245,166,35,0)');
    ctx.fillStyle = gold;
    ctx.fillRect(0, 0, W, H);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Equirectangular gradient used only to light/reflect the dice (via PMREM),
  // giving them soft warm + teal highlights without any external HDR file.
  function makeEnvEquirect() {
    const W = 256, H = 128;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0,   '#46588a');
    g.addColorStop(0.5, '#1b2444');
    g.addColorStop(1,   '#0a0e22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const warm = ctx.createRadialGradient(W * 0.68, H * 0.30, 4, W * 0.68, H * 0.30, 66);
    warm.addColorStop(0, 'rgba(255,196,90,0.75)');
    warm.addColorStop(1, 'rgba(255,196,90,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, W, H);
    const teal = ctx.createRadialGradient(W * 0.26, H * 0.34, 4, W * 0.26, H * 0.34, 58);
    teal.addColorStop(0, 'rgba(78,205,196,0.5)');
    teal.addColorStop(1, 'rgba(78,205,196,0)');
    ctx.fillStyle = teal;
    ctx.fillRect(0, 0, W, H);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  // Resolves once 'Bebas Neue' is loaded (or after a short timeout) so the
  // floor texture is painted with the brand font, not the fallback.
  function ensureBrandFont() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.race([
      document.fonts.load("700 64px 'Bebas Neue'").catch(() => null),
      new Promise(res => setTimeout(res, 1200))
    ]);
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'dice3dOverlay';
    overlay.innerHTML =
      '<div class="d3d-title">YAMIO</div>' +
      '<div class="d3d-opp-rolls" id="dice3dOppRolls"></div>' +
      '<div class="d3d-canvas-wrap"><canvas id="dice3dCanvas"></canvas>' +
        '<div class="d3d-kept" id="dice3dKept"></div>' +
        '<div class="d3d-reroll" id="dice3dReroll"></div>' +
        '<div class="d3d-scorecard" id="dice3dScorecard"></div></div>' +
      '<div class="d3d-suggest" id="dice3dSuggest"></div>' +
      '<div class="d3d-actions" id="dice3dActions"></div>' +
      '<div class="d3d-status" id="dice3dStatus">Drag the dice and flick to throw</div>' +
      '<button class="d3d-cancel" id="dice3dCancel">Skip throw</button>';
    document.body.appendChild(overlay);
    canvasEl = overlay.querySelector('#dice3dCanvas');
    statusEl = overlay.querySelector('#dice3dStatus');
    cancelBtn = overlay.querySelector('#dice3dCancel');
    actionsEl = overlay.querySelector('#dice3dActions');
    keptEl = overlay.querySelector('#dice3dKept');
    rerollEl = overlay.querySelector('#dice3dReroll');
    scorecardEl = overlay.querySelector('#dice3dScorecard');
    _renderOppRolls();
    cancelBtn.addEventListener('click', () => {
      if (mode === 'spectator') {
        // "Hide" the live view of an opponent's roll — purely local; the
        // roll continues on their side and the regular post-roll dice update
        // will appear in the roller card via the existing liveDice channel.
        if (_onSpectatorHideCb) { try { _onSpectatorHideCb(); } catch (_) {} }
        closeOverlay();
        return;
      }
      if (interactiveTurn) {
        // After at least one throw the button is a real "Done" (commit the hand
        // as it stands); before any throw it's "Skip" (abort, change nothing).
        if (turnRollsUsed > 0) finalizeTurn(null);
        else finalizeTurn(null, true);
        return;
      }
      if (!resolveFn) return;
      const r = resolveFn; resolveFn = null;
      closeOverlay();
      r(Math.floor(Math.random() * 6) + 1);
    });
  }

  function initScene() {
    scene = new THREE.Scene();
    // Dark-navy fog matching the backdrop.
    scene.fog = new THREE.Fog(0x0c1428, 16, 32);
    scene.background = makeBackgroundTexture();

    const w = canvasEl.clientWidth || 1;
    const h = canvasEl.clientHeight || 1;
    // Slightly wider FOV than before (50°) so the camera covers the full
    // walled play area even on portrait phones.
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 7.5, 7);
    camera.lookAt(0, 0.2, -1.3);

    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Filmic tone mapping for richer, less "flat" colour on the dice + felt.
    // Exposure kept under 1 so the dice don't wash out to pale cream.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    // Image-based lighting from a generated gradient env so the dice pick up
    // soft warm/teal highlights (no external HDR needed). Best-effort.
    let envTex = null;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader && pmrem.compileEquirectangularShader();
      envTex = pmrem.fromEquirectangular(makeEnvEquirect()).texture;
      scene.environment = envTex;
      pmrem.dispose();
    } catch (e) { console.warn('3D env setup skipped', e); }

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 3;
    key.shadow.bias = -0.0004;
    const s = 5;
    key.shadow.camera.left = -s; key.shadow.camera.right = s;
    key.shadow.camera.top = s;   key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 1;  key.shadow.camera.far = 25;
    scene.add(key);
    // Warm gold rim light + teal fill — matches brand accents
    const rim = new THREE.DirectionalLight(0xf5a623, 0.5);
    rim.position.set(-5, 4, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x4ecdc4, 0.2);
    fill.position.set(3, 2, -6);
    scene.add(fill);

    // Branded floor: navy-blue felt + the Yamio logo baked into the texture,
    // with a hint of gloss so it catches the lights.
    const floorTex = makeFloorTexture();
    try {
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      if (maxAniso) floorTex.anisotropy = maxAniso; // keeps the floor logo sharp at grazing angles
    } catch (_) {}
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex, roughness: 0.7, metalness: 0.12, envMapIntensity: 0.5
    });
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Outer surround — dark navy so the table edges blend into the backdrop.
    const surroundMat = new THREE.MeshStandardMaterial({
      color: 0x0a1024, roughness: 0.95, metalness: 0.0
    });
    const surround = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), surroundMat);
    surround.rotation.x = -Math.PI / 2;
    surround.position.y = -0.02;
    surround.receiveShadow = true;
    scene.add(surround);

    const geo = makeRoundedBoxGeometry(DIE_SIZE, DIE_BEVEL, 6);
    const initTheme = resolveDiceTheme();
    dieMats = FACE_NUMBERS.map(n => new THREE.MeshStandardMaterial({
      map: makeFaceTexture(n, initTheme),
      roughness: 0.32,
      metalness: 0.15,
      envMapIntensity: 0.45,
      color: 0xffffff
    }));
    currentThemeKey = themeSignature();
    dieMesh = new THREE.Mesh(geo, dieMats);
    dieMesh.castShadow = true;
    scene.add(dieMesh);

    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.NaiveBroadphase();

    floorPMat = new CANNON.Material('floor');
    diePMat = new CANNON.Material('die');
    world.addContactMaterial(new CANNON.ContactMaterial(floorPMat, diePMat, {
      friction: 0.45, restitution: 0.32
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(diePMat, diePMat, {
      friction: 0.2, restitution: 0.2
    }));

    const floorBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorPMat });
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floorBody);

    // Invisible walls — keep die in the camera-visible play area.
    const walls = [
      { p: [0, 0, WALL_BACK],   r: [0, 0, 0] },
      { p: [0, 0, WALL_FRONT],  r: [0, Math.PI, 0] },
      { p: [-WALL_SIDE, 0, 0],  r: [0,  Math.PI / 2, 0] },
      { p: [ WALL_SIDE, 0, 0],  r: [0, -Math.PI / 2, 0] }
    ];
    walls.forEach(d => {
      const b = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: floorPMat });
      b.position.set(d.p[0], d.p[1], d.p[2]);
      b.quaternion.setFromEuler(d.r[0], d.r[1], d.r[2]);
      world.addBody(b);
    });

    dieBody = new CANNON.Body({
      mass: 1.2,
      shape: new CANNON.Box(new CANNON.Vec3(DIE_SIZE / 2, DIE_SIZE / 2, DIE_SIZE / 2)),
      material: diePMat,
      allowSleep: true,
      sleepSpeedLimit: 0.14,
      sleepTimeLimit: 0.45,
      linearDamping: 0.16,
      angularDamping: 0.16
    });
    world.addBody(dieBody);

    // Tap sound on each meaningful bounce while the throw is in flight.
    dieBody.addEventListener('collide', (e) => {
      if (!throwing) return;
      const c = e && e.contact;
      const v = c && typeof c.getImpactVelocityAlongNormal === 'function'
        ? Math.abs(c.getImpactVelocityAlongNormal())
        : 0;
      if (v >= 1.4) playImpactTap(v);
    });

    dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_Y);
    raycaster = new THREE.Raycaster();
  }

  function resetDie() {
    dieBody.type = CANNON.Body.DYNAMIC;
    dieBody.position.set(0, 0.9, DRAG_Z_MAX - 0.4);
    dieBody.velocity.set(0, 0, 0);
    dieBody.angularVelocity.set(0, 0, 0);
    dieBody.quaternion.setFromEuler(
      Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5
    );
    dieBody.wakeUp();
  }

  function onResize() {
    if (!renderer) return;
    const w = canvasEl.clientWidth || 1;
    const h = canvasEl.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function pointerNDC(ev) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((ev.clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  function pointerOnDragPlane(ev) {
    const ndc = pointerNDC(ev);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(dragPlane, hit)) return null;
    return hit;
  }

  function hitTestDie(ev) {
    const ndc = pointerNDC(ev);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(dieMesh).length > 0;
  }

  function onPointerDown(ev) {
    if (mode === 'multi') return onPointerDownMulti(ev);
    if (throwing) return;
    // Allow grabbing the die, OR starting a flick anywhere if pointer is below die.
    const hitsDie = hitTestDie(ev);
    if (!hitsDie) {
      // Permissive: still let user flick from anywhere — pickup snaps die under finger.
    }
    ev.preventDefault();
    dragging = true;
    dieBody.type = CANNON.Body.KINEMATIC;
    dieBody.velocity.set(0, 0, 0);
    dieBody.angularVelocity.set(0, 0, 0);
    // Fresh random "in-hand" spin axis so the player can't keep a face up
    // by holding still — tick() applies this every frame while dragging.
    {
      const ax = Math.random() * 2 - 1;
      const ay = Math.random() * 2 - 1;
      const az = Math.random() * 2 - 1;
      const al = Math.hypot(ax, ay, az) || 1;
      dieBody._spinAxis = { x: ax / al, y: ay / al, z: az / al };
      dieBody._spinRate = 9 + Math.random() * 5;
    }
    pointerSamples = [];
    try { canvasEl.setPointerCapture(ev.pointerId); } catch (_) {}
    const p = pointerOnDragPlane(ev);
    if (p) {
      if (hitsDie) {
        pickOffset.x = dieBody.position.x - p.x;
        pickOffset.z = dieBody.position.z - p.z;
      } else {
        pickOffset.x = 0; pickOffset.z = 0;
        const cx = clamp(p.x, -DRAG_X_LIMIT, DRAG_X_LIMIT);
        const cz = clamp(p.z, DRAG_Z_MIN, DRAG_Z_MAX);
        dieBody.position.set(cx, DRAG_Y, cz);
      }
      pointerSamples.push({ t: performance.now(), x: p.x, z: p.z });
      lastDragP = { x: p.x, z: p.z };
    } else {
      lastDragP = null;
    }
    statusEl.textContent = 'Flick to throw!';
  }

  // Tumble-on-drag: while a die is being held, finger motion spins it like
  // it's rolling under your fingertip. Angle = distance × SPIN_GAIN (well above
  // the natural arc-length-over-radius rate, so the die spins visibly fast).
  const SPIN_GAIN = 9.0;
  function applyTumbleTo(body, dx, dz, gain) {
    const dist = Math.hypot(dx, dz);
    if (dist < 0.0005) return;
    const ax = -dz / dist;        // roll axis = horizontal perpendicular to motion
    const az =  dx / dist;
    const angle = dist * (gain || SPIN_GAIN);
    const half = angle * 0.5;
    const s = Math.sin(half), cw = Math.cos(half);
    const dqx = ax * s, dqy = 0, dqz = az * s, dqw = cw;
    const q = body.quaternion;
    const cx = q.x, cy = q.y, cz = q.z, cw2 = q.w;
    const nx = dqw * cx + dqx * cw2 + dqy * cz - dqz * cy;
    const ny = dqw * cy - dqx * cz + dqy * cw2 + dqz * cx;
    const nz = dqw * cz + dqx * cy - dqy * cx + dqz * cw2;
    const nw = dqw * cw2 - dqx * cx - dqy * cy - dqz * cz;
    q.set(nx, ny, nz, nw);
  }
  function applyTumble(dx, dz) { applyTumbleTo(dieBody, dx, dz); }

  // Rotate a body's quaternion by `angle` radians around an arbitrary axis
  // (world-space premultiply). Used for the continuous in-hand spin so the
  // player can't keep a die at a chosen face by holding still.
  function spinBodyAroundAxis(body, axis, angle) {
    const half = angle * 0.5;
    const s = Math.sin(half), cw = Math.cos(half);
    const dqx = axis.x * s, dqy = axis.y * s, dqz = axis.z * s, dqw = cw;
    const q = body.quaternion;
    const cx = q.x, cy = q.y, cz = q.z, cw2 = q.w;
    const nx = dqw * cx + dqx * cw2 + dqy * cz - dqz * cy;
    const ny = dqw * cy - dqx * cz + dqy * cw2 + dqz * cx;
    const nz = dqw * cz + dqx * cy - dqy * cx + dqz * cw2;
    const nw = dqw * cw2 - dqx * cx - dqy * cy - dqz * cz;
    q.set(nx, ny, nz, nw);
  }

  function onPointerMove(ev) {
    if (mode === 'multi') return onPointerMoveMulti(ev);
    if (!dragging) return;
    const p = pointerOnDragPlane(ev);
    if (!p) return;
    if (lastDragP) applyTumble(p.x - lastDragP.x, p.z - lastDragP.z);
    lastDragP = { x: p.x, z: p.z };
    const tx = clamp(p.x + pickOffset.x, -DRAG_X_LIMIT, DRAG_X_LIMIT);
    const tz = clamp(p.z + pickOffset.z, DRAG_Z_MIN, DRAG_Z_MAX);
    dieBody.position.set(tx, DRAG_Y, tz);
    const now = performance.now();
    pointerSamples.push({ t: now, x: p.x, z: p.z });
    while (pointerSamples.length > 2 && now - pointerSamples[0].t > 200) {
      pointerSamples.shift();
    }
  }

  function onPointerUp(ev) {
    if (mode === 'multi') return onPointerUpMulti(ev);
    if (!dragging) return;
    dragging = false;
    lastDragP = null;
    try { canvasEl.releasePointerCapture(ev.pointerId); } catch (_) {}

    // Velocity from samples in last ~120ms.
    const now = performance.now();
    while (pointerSamples.length > 2 && now - pointerSamples[0].t > 120) {
      pointerSamples.shift();
    }
    let vx = 0, vz = 0;
    if (pointerSamples.length >= 2) {
      const a = pointerSamples[0];
      const b = pointerSamples[pointerSamples.length - 1];
      const dt = Math.max(0.016, (b.t - a.t) / 1000);
      vx = (b.x - a.x) / dt;
      vz = (b.z - a.z) / dt;
    }

    dieBody.type = CANNON.Body.DYNAMIC;
    dieBody.wakeUp();
    // Stop the in-hand auto-spin now that the die is physics-driven.
    dieBody._spinAxis = null;

    const speed = Math.hypot(vx, vz);
    if (speed < 0.6) {
      // Drop without throw — heavier toss + random spin so the player can't
      // keep a chosen face by releasing softly.
      dieBody.velocity.set(
        (Math.random() - 0.5) * 1.8,
        3.4 + Math.random() * 1.4,
        -1.0 - Math.random() * 1.8
      );
      dieBody.angularVelocity.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 14,
        (Math.random() - 0.5) * 18
      );
    } else {
      const minS = 4, maxS = 22;
      const mag = Math.max(minS, Math.min(maxS, speed * 1.3));
      const k = mag / Math.max(0.01, speed);
      const VX = vx * k;
      const VZ = vz * k;
      const VY = 4.5 + Math.min(7, speed * 0.35);
      dieBody.velocity.set(VX, VY, VZ);
      const spin = 14 + Math.min(26, speed * 1.8);
      dieBody.angularVelocity.set(
        -VZ * 0.7 + (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin * 0.7,
         VX * 0.7 + (Math.random() - 0.5) * spin
      );
    }

    throwing = true;
    settleStart = performance.now();
    statusEl.textContent = 'Rolling…';
    playThrowClatter();
  }

  function topFaceFor(body) {
    const q = new THREE.Quaternion(
      body.quaternion.x, body.quaternion.y,
      body.quaternion.z, body.quaternion.w
    );
    const normals = [
      new THREE.Vector3( 1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3( 0, 1, 0),
      new THREE.Vector3( 0,-1, 0),
      new THREE.Vector3( 0, 0, 1),
      new THREE.Vector3( 0, 0,-1)
    ];
    let bestY = -Infinity, bestIdx = 2;
    for (let i = 0; i < 6; i++) {
      const w = normals[i].clone().applyQuaternion(q);
      if (w.y > bestY) { bestY = w.y; bestIdx = i; }
    }
    return FACE_NUMBERS[bestIdx];
  }

  function topFaceNumber() { return topFaceFor(dieBody); }

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;
    world.step(1 / 60, dt, 3);
    // While the player is holding the dice, spin each one around its own
    // axis so the orientation at release is unpredictable (no cheating).
    if (mode === 'single' && dragging && dieBody._spinAxis) {
      spinBodyAroundAxis(dieBody, dieBody._spinAxis, dieBody._spinRate * dt);
    }
    if (mode === 'multi' && multiDragging) {
      for (let i = 0; i < multiDiceBodies.length; i++) {
        const b = multiDiceBodies[i];
        if (b._kept) continue;
        if (b._spinAxis) spinBodyAroundAxis(b, b._spinAxis, b._spinRate * dt);
      }
    }
    // Advance "fly to shelf / back to floor" tweens (kept-dice animations).
    if (flyTweens.length) advanceFlyTweens(dt);
    if (dieMesh) {
      dieMesh.position.copy(dieBody.position);
      dieMesh.quaternion.copy(dieBody.quaternion);
    }
    for (let i = 0; i < multiDiceMeshes.length; i++) {
      multiDiceMeshes[i].position.copy(multiDiceBodies[i].position);
      multiDiceMeshes[i].quaternion.copy(multiDiceBodies[i].quaternion);
    }
    if ((mode === 'multi' || mode === 'spectator') && _onFrameCb) {
      try { _onFrameCb(); } catch (_) {}
    }
    renderer.render(scene, camera);

    if (mode === 'single' && throwing) {
      const elapsed = now - settleStart;
      const v = dieBody.velocity.length();
      const a = dieBody.angularVelocity.length();
      const settled =
        dieBody.sleepState === CANNON.Body.SLEEPING ||
        (elapsed > 900 && v < 0.06 && a < 0.06);
      if (settled || elapsed > 7500) {
        throwing = false;
        const val = topFaceNumber();
        statusEl.innerHTML = 'You rolled <b style="color:var(--gold)">' + val + '</b>!';
        setTimeout(() => {
          if (!resolveFn) return;
          const r = resolveFn; resolveFn = null;
          closeOverlay();
          r(val);
        }, 750);
      }
    } else if (mode === 'multi' && multiThrowing) {
      const elapsed = now - multiSettleStart;
      // Only the in-play (non-kept) dice need to come to rest; kept dice are
      // parked kinematically on the shelf.
      const inPlay = multiDiceBodies.filter(b => !b._kept);
      const allSettled = inPlay.length === 0 || inPlay.every(b => {
        if (b.sleepState === CANNON.Body.SLEEPING) return true;
        return elapsed > 900 &&
          b.velocity.length() < 0.07 &&
          b.angularVelocity.length() < 0.07;
      });
      if (allSettled || elapsed > 8500) {
        // Before locking in the result, re-drop any die that settled stacked on
        // another or cocked. If we moved any, keep simulating until they rest.
        if (elapsed <= 8500 && relaxStacks()) {
          multiSettleStart = now;   // give the nudged dice a fresh settle window
        } else {
          multiThrowing = false;
          settleTurn();
        }
      }
    }
  }

  function closeOverlay() {
    const closingMode = mode;
    overlay.classList.remove('open');
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      lastTime = 0;
      throwing = false; dragging = false;
      multiThrowing = false; multiReady = false; multiDragging = false;
      multiPointerSamples = [];
      multiLastDragP = null;
      multiLanes = [];
      multiSuggest = false;
      multiHeldValues = [];
      multiSettledResults = null;
      interactiveTurn = false;
      turnSettled = false;
      turnRollsLeft = 0;
      turnRollsUsed = 0;
      turnPick = null;
      turnResolve = null;
      flyTweens = [];
      teardownMultiDice();
      teardownHeld();
      clearSuggest();
      clearActions();
      clearKept();
      if (dieMesh) dieMesh.visible = true;
      // Restore interactive UI for the next non-spectator open.
      if (cancelBtn) cancelBtn.style.display = '';
      if (canvasEl) canvasEl.style.pointerEvents = '';
      if (overlay) {
        const t = overlay.querySelector('.d3d-title');
        if (t) t.textContent = 'YAMIO';
      }
      _oppRolls = [];
      _renderOppRolls();
      mode = 'single';
      if ((closingMode === 'multi' || closingMode === 'spectator') && _onCloseCb) {
        try { _onCloseCb(closingMode); } catch (_) {}
      }
    }, 280);
  }

  function teardownMultiDice() {
    for (const m of multiDiceMeshes) { try { scene && scene.remove(m); } catch (_) {} }
    for (const b of multiDiceBodies) { try { world && world.removeBody(b); } catch (_) {} }
    multiDiceMeshes = [];
    multiDiceBodies = [];
    disposePerDieMats();
  }

  // ── Kept ("held") dice shelf ─────────────────────────────────────
  // Mirrors the 2D roller's two-lane shelf: dice the player is keeping are
  // parked off to the side, value-up, instead of being re-thrown. These are
  // visual-only (no physics body) so a flicked throw never collides with them.
  // BoxGeometry material order [+X,-X,+Y,-Y,+Z,-Z] maps to FACE_NUMBERS, so a
  // given number sits on a known local cube face.
  const NUM_TO_NORMAL = {
    1: [ 1, 0, 0], 6: [-1, 0, 0],
    2: [ 0, 1, 0], 5: [ 0,-1, 0],
    3: [ 0, 0, 1], 4: [ 0, 0,-1]
  };
  function quatForFaceUp(num, yaw) {
    const n = NUM_TO_NORMAL[num] || [0, 1, 0];
    const from = new THREE.Vector3(n[0], n[1], n[2]);
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(from, up);
    if (yaw) {
      const yq = new THREE.Quaternion().setFromAxisAngle(up, yaw);
      q.premultiply(yq);
    }
    return q;
  }

  // Only the tray platform lives outside multiDiceBodies now; the kept dice are
  // the persistent turn dice themselves (parked on the shelf), so they're torn
  // down by teardownMultiDice().
  function teardownHeld() {
    if (heldTray) { try { scene.remove(heldTray); } catch (_) {} heldTray = null; }
  }
  function removeTray() { teardownHeld(); }

  function removeTray() { teardownHeld(); }

  const TURN_DIE_SIZE = 0.62;
  const TURN_DIE_HALF = TURN_DIE_SIZE / 2;

  // ── Kept dice → flat 2D faces under the header ───────────────────
  // Kept dice leave the 3D floor and show as clear 2D faces in the band under
  // the YAMIO header (easier to read than perspective dice). The physics body
  // is parked off-screen; only the in-play dice stay on the felt.
  function keptIndices() {
    const out = [];
    for (let i = 0; i < multiDiceBodies.length; i++) {
      if (multiDiceBodies[i]._kept) out.push(i);
    }
    return out;
  }

  // Hide a kept die's 3D representation and park its body out of the way.
  function parkKeptBody(b, meshIdx) {
    b.type = CANNON.Body.STATIC;
    b.collisionResponse = false;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.position.set(0, -30, 0);
    b._spinAxis = null;
    const m = multiDiceMeshes[meshIdx];
    if (m) m.visible = false;
  }

  // Return a die to the felt (value-up) so it can be re-thrown next roll.
  function placeFloorDie(b, meshIdx) {
    const m = multiDiceMeshes[meshIdx];
    if (m) m.visible = true;
    b.type = CANNON.Body.KINEMATIC;
    b.collisionResponse = true;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    const nonKept = multiDiceBodies.filter(x => !x._kept).length;
    const x = clamp(((nonKept - 1) - 2) * 0.7, -DRAG_X_LIMIT, DRAG_X_LIMIT);
    b.position.set(x, TURN_DIE_HALF, 0.4);
    b.quaternion.copy(quatForFaceUp(b._value || 1, 0));
  }

  // Render the kept dice as 2D faces in the header band. `animateIdx` is the
  // body index that just flew up, so only it plays the fly-in animation.
  function renderKeptRow(animateIdx) {
    if (!keptEl) return;
    const kept = keptIndices();
    if (!kept.length) { keptEl.innerHTML = ''; keptEl.classList.remove('show'); return; }
    const faceHtml = (v) => {
      if (typeof dieIcon === 'function') { try { return dieIcon(v); } catch (_) {} }
      if (typeof window.dieIcon === 'function') { try { return window.dieIcon(v); } catch (_) {} }
      return '<span class="d3d-kept-glyph">' + (['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][v] || '') + '</span>';
    };
    const cells = kept.map(i => {
      const cls = 'd3d-kept-die' + (i === animateIdx ? ' d3d-kept-in' : '');
      return '<button class="' + cls + '" data-idx="' + i + '" title="Tap to release">' +
        faceHtml(multiDiceBodies[i]._value) + '</button>';
    }).join('');
    keptEl.innerHTML = '<span class="d3d-kept-label">KEPT · tap to release</span>' +
      '<div class="d3d-kept-row">' + cells + '</div>';
    keptEl.classList.add('show');
    keptEl.querySelectorAll('.d3d-kept-die').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (!isNaN(idx)) unholdDie(idx);
      });
    });
  }

  function clearKept() {
    if (keptEl) { keptEl.innerHTML = ''; keptEl.classList.remove('show'); }
  }

  // Smoothly move a (kinematic) die body from where it is to a target pose.
  function startFly(body, toP, toQ, onDone) {
    body.type = CANNON.Body.KINEMATIC;
    body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0);
    body._spinAxis = null;
    // Pass through other dice mid-flight so keeping one never nudges another.
    body.collisionResponse = false;
    flyTweens = flyTweens.filter(t => t.body !== body);
    flyTweens.push({
      body: body,
      fromP: new THREE.Vector3(body.position.x, body.position.y, body.position.z),
      toP: new THREE.Vector3(toP.x, toP.y, toP.z),
      fromQ: new THREE.Quaternion(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w),
      toQ: toQ.clone(),
      t: 0, dur: 0.42, onDone: onDone || null
    });
  }

  function advanceFlyTweens(dt) {
    for (let i = flyTweens.length - 1; i >= 0; i--) {
      const tw = flyTweens[i];
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur);
      // easeInOutQuad with a tiny overshoot-free arc
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const p = tw.fromP.clone().lerp(tw.toP, e);
      // lift slightly mid-flight so the die "hops" onto the shelf
      p.y += Math.sin(Math.PI * u) * 0.5;
      tw.body.position.set(p.x, p.y, p.z);
      const q = tw.fromQ.clone().slerp(tw.toQ, e);
      tw.body.quaternion.set(q.x, q.y, q.z, q.w);
      if (u >= 1) {
        tw.body.collisionResponse = true;
        if (tw.onDone) { try { tw.onDone(); } catch (_) {} }
        flyTweens.splice(i, 1);
      }
    }
  }

  function makeTurnDieBody() {
    const body = new CANNON.Body({
      mass: 0.6,
      shape: new CANNON.Box(new CANNON.Vec3(TURN_DIE_HALF, TURN_DIE_HALF, TURN_DIE_HALF)),
      material: diePMat,
      allowSleep: true,
      sleepSpeedLimit: 0.16,
      sleepTimeLimit: 0.45,
      linearDamping: 0.18,
      angularDamping: 0.18
    });
    body.addEventListener('collide', (e) => {
      if (!multiThrowing) return;
      const c = e && e.contact;
      const v = c && typeof c.getImpactVelocityAlongNormal === 'function'
        ? Math.abs(c.getImpactVelocityAlongNormal())
        : 0;
      if (v >= 1.4) playImpactTap(v);
    });
    return body;
  }

  // Build the five persistent turn dice from the incoming game state. Kept dice
  // (held && already rolled) start on the shelf; the rest are parked ready to
  // throw. Body index === die index, so the final dice/held arrays map 1:1.
  function setupTurnDice(diceArr, heldArr) {
    teardownMultiDice();
    removeTray();
    buildMultiAssets(TURN_DIE_SIZE);
    // When the free colour palette is active, give each die its own material
    // set so the five dice can wear five different colours on the felt.
    const pdThemes = perDieThemes();
    multiPerDieMats = pdThemes ? pdThemes.map(buildFaceMatSet) : null;
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(multiGeom, multiPerDieMats ? multiPerDieMats[i] : multiMats);
      mesh.castShadow = true;
      scene.add(mesh);
      multiDiceMeshes.push(mesh);

      const body = makeTurnDieBody();
      const v = (diceArr && diceArr[i]) | 0;
      const kept = !!(heldArr && heldArr[i] && v > 0);
      body._kept = kept;
      body._value = kept ? v : 0;
      body.type = CANNON.Body.KINEMATIC;
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      world.addBody(body);
      multiDiceBodies.push(body);
      if (kept) parkKeptBody(body, i); // already-kept dice show as 2D faces up top
    }
    renderKeptRow();      // paint any kept dice into the header band
    armNonKept();         // park the rest ready to flick
  }

  // Park the in-play (non-kept) dice in a fan near the player, ready to throw.
  function armNonKept() {
    const nk = [];
    for (let i = 0; i < multiDiceBodies.length; i++) {
      if (!multiDiceBodies[i]._kept) nk.push(i);
    }
    const count = nk.length;
    multiLanes = [];
    for (let k = 0; k < count; k++) {
      const lane = count === 1 ? 0 : (k / (count - 1) - 0.5) * 2.0;
      const dz = (k % 2 === 0 ? 0 : 0.35);
      multiLanes.push({ dx: lane, dz: dz });
    }
    for (let k = 0; k < count; k++) {
      const b = multiDiceBodies[nk[k]];
      b.type = CANNON.Body.KINEMATIC;
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);
      b.position.set(multiLanes[k].dx, TURN_DIE_HALF + 0.02, DRAG_Z_MAX - 0.2 + multiLanes[k].dz);
      b.quaternion.setFromEuler(Math.random() * 0.35, Math.random() * 0.35, Math.random() * 0.35);
      const ax = Math.random() * 2 - 1, ay = Math.random() * 2 - 1, az = Math.random() * 2 - 1;
      const al = Math.hypot(ax, ay, az) || 1;
      b._spinAxis = { x: ax / al, y: ay / al, z: az / al };
      b._spinRate = 9 + Math.random() * 5;
    }
    multiReady = count > 0;
    multiThrowing = false;
    multiDragging = false;
    multiPointerSamples = [];
    multiLastDragP = null;
    multiSettleStart = 0;
  }

  function turnSfx(name) {
    try {
      if (typeof SFX !== 'undefined' && typeof SFX[name] === 'function') SFX[name]();
    } catch (_) {}
  }

  // Tap a settled in-play die → keep it: it leaves the felt and pops up as a
  // 2D face in the header band.
  function holdDie(idx) {
    const b = multiDiceBodies[idx];
    if (!b || b._kept) return;
    b._kept = true;
    b._value = topFaceFor(b);
    parkKeptBody(b, idx);
    renderKeptRow(idx);   // animate this die flying up to the row
    turnSfx('hold');
    renderActions();
    updateSettleStatus();
  }

  // Tap a kept face → release it back onto the felt (re-rolls next throw).
  function unholdDie(idx) {
    const b = multiDiceBodies[idx];
    if (!b || !b._kept) return;
    b._kept = false;
    placeFloorDie(b, idx);
    renderKeptRow();
    turnSfx('unhold');
    renderActions();
    updateSettleStatus();
  }

  function handleSettleTap(ev) {
    ev.preventDefault();
    const ndc = pointerNDC(ev);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(multiDiceMeshes, false);
    if (!hits.length) return;
    const idx = multiDiceMeshes.indexOf(hits[0].object);
    if (idx < 0) return;
    if (multiDiceBodies[idx]._kept) return; // kept dice are released via their 2D face
    holdDie(idx);
  }

  function fullHandValues() {
    return multiDiceBodies.map(b => b._kept ? b._value : (b._value || topFaceFor(b)));
  }

  function updateSettleStatus() {
    if (!turnSettled || !statusEl) return;
    const rolled = multiDiceBodies.filter(b => !b._kept).map(b => b._value);
    statusEl.innerHTML = rolled.length
      ? ('Rolled <b style="color:var(--gold)">' + rolled.join(' · ') + '</b> · tap a die to keep it')
      : 'All dice kept — pick a score';
  }

  // Dice have come to rest: lock in the rolled faces, show what the hand can
  // score, and surface the keep / roll-again / done controls.
  // ── Anti-stacking / cocked-die cleanup ───────────────────────────
  // A die that comes to rest on top of another (elevated) or leaning on its
  // side against a die/wall (cocked) doesn't show a clean top face. We don't
  // lock in the result or reveal the "roll again" controls until every die is
  // lying flat: after the throw settles we detect any such die and shove it off
  // so it topples down and re-settles flat, then re-check — bounded so it always
  // terminates.
  const MAX_RELAX_TRIES = 8;
  // Min y of the most-upward face normal to count a die as "lying flat". 1.0 is
  // perfectly flat; 0.97 ≈ within ~14° of flat. Anything less is on its side and
  // gets knocked over before we show the result.
  const FLAT_MIN = 0.97;

  // y-component of the most-upward face normal: ~1.0 when the die lies flat,
  // lower when it's tilted/cocked.
  function topNormalY(body) {
    const q = new THREE.Quaternion(
      body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w
    );
    const normals = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];
    let best = -Infinity;
    for (const n of normals) {
      const y = new THREE.Vector3(n[0], n[1], n[2]).applyQuaternion(q).y;
      if (y > best) best = y;
    }
    return best;
  }

  // Returns true if it nudged at least one stacked/cocked die (caller keeps
  // simulating); false when all in-play dice already lie flat on the felt.
  // Rather than teleporting a stacked die away (which looks like it jumps to the
  // wall), we give it a gentle sideways shove + tumble so it topples off the die
  // it's resting on and falls naturally onto the felt right beside it.
  function relaxStacks() {
    if (multiRelaxTries >= MAX_RELAX_TRIES) return false;
    const HALF = TURN_DIE_HALF;
    const inPlay = multiDiceBodies.filter(b => !b._kept);
    const bad = inPlay.filter(b =>
      b.position.y > HALF * 1.55 ||   // sitting on top of another die
      topNormalY(b) < FLAT_MIN        // on its side / cocked — not lying flat
    );
    if (!bad.length) return false;
    multiRelaxTries++;
    const TABLE_CZ = (DRAG_Z_MIN + DRAG_Z_MAX) / 2;  // table centre (z)
    for (const b of bad) {
      // Find the nearest other in-play die — the one it might be resting on.
      let nx = 0, nz = 0, nd = Infinity;
      for (const o of inPlay) {
        if (o === b) continue;
        const d = Math.hypot(b.position.x - o.position.x, b.position.z - o.position.z);
        if (d < nd) { nd = d; nx = b.position.x - o.position.x; nz = b.position.z - o.position.z; }
      }
      let dx, dz;
      if (nd < TURN_DIE_SIZE * 1.4) {
        // Stacked on / against another die → shove away from it so it slides off.
        dx = nx; dz = nz;
      } else {
        // Cocked on its own (likely against a wall) → roll toward open felt at
        // the table centre, where it has room to land flat.
        dx = -b.position.x; dz = TABLE_CZ - b.position.z;
      }
      let len = Math.hypot(dx, dz);
      if (len < 1e-3) {                 // dead-centre → pick a random heading
        const a = Math.random() * Math.PI * 2;
        dx = Math.cos(a); dz = Math.sin(a); len = 1;
      }
      dx /= len; dz /= len;
      // Don't shove into a nearby wall (would just cock it again) — flip away.
      if (b.position.x >  DRAG_X_LIMIT - 0.4 && dx > 0) dx = -dx;
      if (b.position.x < -DRAG_X_LIMIT + 0.4 && dx < 0) dx = -dx;
      if (b.position.z >  DRAG_Z_MAX  - 0.4 && dz > 0) dz = -dz;
      if (b.position.z <  DRAG_Z_MIN  + 0.4 && dz < 0) dz = -dz;

      b.type = CANNON.Body.DYNAMIC;
      b.collisionResponse = true;
      b._spinAxis = null;
      b.wakeUp();
      // Gentle lift + sideways tip so it topples off and lands right beside the
      // stack — just enough to clear the die below, not a shove across the felt.
      const push = 0.85 + Math.random() * 0.45;
      b.velocity.set(dx * push, 0.6 + Math.random() * 0.35, dz * push);
      // Roll about the axis perpendicular to the push so it tumbles as it goes.
      const spin = 5 + Math.random() * 3;
      b.angularVelocity.set(
        dz * spin + (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        -dx * spin + (Math.random() - 0.5) * 3
      );
    }
    return true;
  }

  function settleTurn() {
    turnSettled = true;
    for (let i = 0; i < multiDiceBodies.length; i++) {
      const b = multiDiceBodies[i];
      if (!b._kept) b._value = topFaceFor(b);
    }
    updateSettleStatus();
    renderKeptRow();
    renderSuggest(fullHandValues());
    renderActions();
  }

  // ── "What you can score" suggestions strip ───────────────────────
  // Reuses possibilities.js's computation against the full hand. Tapping a chip
  // ends the turn with that category as the pick; the toggle writes the dice
  // back and opens its score modal.
  function _escSug(s) {
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(s);
    return String(s).replace(/[&<>"']/g, c =>
      ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  // Self-contained scoring computation so the 3D overlay always shows options,
  // even if possibilities.js hasn't loaded (or a stale copy is cached). Falls
  // back to the shared helper when present, otherwise reads the game globals.
  function turnPossibilities(hand) {
    try {
      if (typeof window.computeDicePossibilities === 'function') {
        const r = window.computeDicePossibilities(hand);
        if (Array.isArray(r) && r.length) return r;
      }
    } catch (_) {}
    try {
      if (typeof categories === 'undefined' || !Array.isArray(categories)) return [];
      if (!hand.every(v => v > 0)) return [];
      const sc = (typeof scores !== 'undefined' && scores) ? scores : {};
      return categories
        .filter(c => sc[c.id] === undefined)
        .map(c => { let p = 0; try { p = c.calc(hand) | 0; } catch (_) {} return { cat: c, points: p }; })
        .filter(o => o.points > 0)
        .sort((a, b) => b.points - a.points || (b.cat.max || 0) - (a.cat.max || 0));
    } catch (_) { return []; }
  }
  function turnStrikes() {
    try {
      if (typeof window.computeStrikeSuggestions === 'function') {
        const r = window.computeStrikeSuggestions();
        if (Array.isArray(r) && r.length) return r;
      }
    } catch (_) {}
    try {
      if (typeof categories === 'undefined' || !Array.isArray(categories)) return [];
      const sc = (typeof scores !== 'undefined' && scores) ? scores : {};
      return categories
        .filter(c => sc[c.id] === undefined)
        .map(c => ({ cat: c }))
        .sort((a, b) => (a.cat.max || 0) - (b.cat.max || 0));
    } catch (_) { return []; }
  }

  function renderSuggest(hand) {
    if (!overlay) return;
    const el = overlay.querySelector('#dice3dSuggest');
    if (!el) return;
    const opts = turnPossibilities(hand) || [];

    if (opts.length) {
      const chips = opts.slice(0, 6).map(({ cat, points }, i) => {
        const best = i === 0 ? ' d3d-sug-best' : '';
        const badge = i === 0 ? '<span class="d3d-sug-badge">Best</span>' : '';
        return '<button class="d3d-sug-chip' + best + '" data-cat="' + _escSug(cat.id) + '">' +
          '<span class="d3d-sug-name">' + _escSug(cat.name) + '</span>' +
          '<span class="d3d-sug-pts">' + (points | 0) + '</span>' + badge +
          '</button>';
      }).join('');
      el.innerHTML = '<div class="d3d-sug-title">Tap to score</div>' +
        '<div class="d3d-sug-list">' + chips + '</div>';
    } else {
      // No category scores this hand — surface the cheapest strike instead.
      const strikes = turnStrikes() || [];
      if (!strikes.length) { el.innerHTML = ''; el.classList.remove('show'); return; }
      const chips = strikes.slice(0, 6).map(({ cat }, i) => {
        const best = i === 0 ? ' d3d-sug-best' : '';
        const badge = i === 0 ? '<span class="d3d-sug-badge">Cheapest</span>' : '';
        return '<button class="d3d-sug-chip d3d-sug-strike' + best + '" data-cat="' +
          _escSug(cat.id) + '"><span class="d3d-sug-name">' + _escSug(cat.name) +
          '</span>' + badge + '</button>';
      }).join('');
      el.innerHTML = '<div class="d3d-sug-title d3d-sug-strike-title">No score — strike one</div>' +
        '<div class="d3d-sug-list">' + chips + '</div>';
    }

    el.classList.add('show');
    el.querySelectorAll('.d3d-sug-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        finalizeTurn(btn.getAttribute('data-cat'));
      });
    });
  }

  function clearSuggest() {
    if (!overlay) return;
    const el = overlay.querySelector('#dice3dSuggest');
    if (el) { el.innerHTML = ''; el.classList.remove('show'); }
  }

  // Bottom row now just owns "Done"; "Roll again" floats on the table.
  function renderActions() {
    if (!actionsEl) return;
    actionsEl.innerHTML =
      '<div class="d3d-act-row">' +
        '<button class="d3d-act-btn d3d-act-card" data-act="card">Scorecard</button>' +
        '<button class="d3d-act-btn d3d-act-done" data-act="done">Done</button>' +
      '</div>';
    actionsEl.classList.add('show');
    if (cancelBtn) cancelBtn.style.display = 'none';
    actionsEl.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.getAttribute('data-act') === 'card') openScorecard();
        else finalizeTurn(null);
      });
    });
    renderReroll();
  }

  function clearActions() {
    if (actionsEl) { actionsEl.innerHTML = ''; actionsEl.classList.remove('show'); }
    clearReroll();
    closeScorecard();
  }

  // Floating "Roll again" button on the table, with reroll dots showing how
  // many rolls are left. Pops in (CSS) so the player notices they can re-roll.
  function renderReroll() {
    if (!rerollEl) return;
    const nonKept = multiDiceBodies.filter(b => !b._kept).length;
    const rollsRemain = turnRollsLeft - turnRollsUsed;
    if (!turnSettled || rollsRemain <= 0 || nonKept === 0) { clearReroll(); return; }
    const lit = Math.max(0, Math.min(3, rollsRemain));
    let pips = '';
    for (let i = 0; i < 3; i++) pips += '<i class="d3d-rr-pip' + (i < lit ? ' on' : '') + '"></i>';
    // Rebuilding the element replays its CSS pop animation each time. A compact
    // "Scorecard" button sits to the right so the player can peek at what's left
    // or strike a category without leaving the roll.
    rerollEl.innerHTML =
      '<div class="d3d-rr-row">' +
        '<button class="d3d-rr-btn" type="button">' +
          '<span class="d3d-rr-top"><span class="d3d-rr-icon">↻</span>' +
          '<span class="d3d-rr-label">ROLL AGAIN</span></span>' +
          '<span class="d3d-rr-pips">' + pips + '</span>' +
        '</button>' +
        '<button class="d3d-rr-card" type="button" title="View scorecard">' +
          '<span class="d3d-rr-card-icon">▤</span>' +
          '<span class="d3d-rr-card-label">SCORE<br>CARD</span>' +
        '</button>' +
      '</div>';
    rerollEl.classList.add('show');
    const btn = rerollEl.querySelector('.d3d-rr-btn');
    if (btn) btn.addEventListener('click', rerollTurn);
    const cardBtn = rerollEl.querySelector('.d3d-rr-card');
    if (cardBtn) cardBtn.addEventListener('click', openScorecard);
  }

  function clearReroll() {
    if (rerollEl) { rerollEl.innerHTML = ''; rerollEl.classList.remove('show'); }
  }

  // ── Scorecard peek panel ─────────────────────────────────────────
  // Slides up over the table so the player can see every category — what's
  // already taken and what each open one would score with the current hand —
  // and tap an open one to score or strike it (opens the regular score modal).
  function scorecardOpen() {
    return !!(scorecardEl && scorecardEl.classList.contains('show'));
  }
  function openScorecard() {
    if (!scorecardEl) return;
    if (scorecardOpen()) { closeScorecard(); return; } // toggle
    renderScorecardPanel();
    scorecardEl.classList.add('show');
    // Don't let taps fall through to the dice while the panel is up.
    if (canvasEl) canvasEl.style.pointerEvents = 'none';
  }
  function closeScorecard() {
    if (!scorecardEl) return;
    scorecardEl.classList.remove('show');
    scorecardEl.innerHTML = '';
    // Re-enable die taps if we're still in the settled interactive state.
    if (canvasEl && mode === 'multi') canvasEl.style.pointerEvents = '';
  }

  function renderScorecardPanel() {
    if (!scorecardEl) return;
    if (typeof categories === 'undefined' || !Array.isArray(categories)) {
      scorecardEl.innerHTML =
        '<div class="d3d-sc-sheet"><div class="d3d-sc-head">' +
        '<span class="d3d-sc-title">Scorecard</span>' +
        '<button class="d3d-sc-close" type="button">✕</button></div>' +
        '<div class="d3d-sc-note">Scorecard unavailable right now.</div></div>';
      scorecardEl.querySelector('.d3d-sc-close').addEventListener('click', closeScorecard);
      return;
    }
    const sc = (typeof scores !== 'undefined' && scores) ? scores : {};
    const hand = fullHandValues();
    const handReady = hand.every(v => v > 0);

    const rowFor = (c) => {
      const taken = sc[c.id] !== undefined;
      if (taken) {
        const val = sc[c.id] | 0;
        const right = val === 0
          ? '<span class="d3d-sc-val struck">✕</span>'
          : '<span class="d3d-sc-val">' + val + '</span>';
        return '<div class="d3d-sc-row taken">' +
          '<span class="d3d-sc-name">' + _escSug(c.name) + '</span>' + right + '</div>';
      }
      let pts = 0;
      try { pts = handReady ? (c.calc(hand) | 0) : 0; } catch (_) { pts = 0; }
      const right = '<span class="d3d-sc-pts' + (pts > 0 ? ' scores' : ' zero') + '">' +
        (handReady ? (pts > 0 ? '+' + pts : 'strike') : '–') + '</span>';
      return '<button class="d3d-sc-row open" type="button" data-cat="' + _escSug(c.id) + '">' +
        '<span class="d3d-sc-name">' + _escSug(c.name) + '</span>' + right + '</button>';
    };

    const section = (title, items) =>
      '<div class="d3d-sc-sec-title">' + title + '</div>' + items.map(rowFor).join('');
    const upper = categories.filter(c => c.section === 'upper');
    const lower = categories.filter(c => c.section === 'lower');

    // Upper-bonus progress hint (mirrors the 2D scorecard's 63-for-35 rule).
    let bonusHint = '';
    try {
      const ids = (typeof UPPER_IDS !== 'undefined' && Array.isArray(UPPER_IDS))
        ? UPPER_IDS : upper.map(c => c.id);
      const target = (typeof BONUS_TARGET !== 'undefined') ? BONUS_TARGET : 63;
      const bonus = (typeof BONUS_POINTS !== 'undefined') ? BONUS_POINTS : 35;
      let sum = 0;
      ids.forEach(id => { if (sc[id] !== undefined) sum += sc[id] | 0; });
      bonusHint = '<div class="d3d-sc-bonus">Upper: <b>' + sum + '</b> / ' + target +
        ' &nbsp;·&nbsp; +' + bonus + ' bonus at ' + target + '</div>';
    } catch (_) {}

    scorecardEl.innerHTML =
      '<div class="d3d-sc-sheet">' +
        '<div class="d3d-sc-head">' +
          '<span class="d3d-sc-title">Scorecard</span>' +
          '<button class="d3d-sc-close" type="button" title="Close">✕</button>' +
        '</div>' +
        '<div class="d3d-sc-note">Tap an open category to score or strike it.</div>' +
        '<div class="d3d-sc-grid">' +
          '<div class="d3d-sc-col">' + section('UPPER', upper) + bonusHint + '</div>' +
          '<div class="d3d-sc-col">' + section('LOWER', lower) + '</div>' +
        '</div>' +
      '</div>';

    scorecardEl.querySelector('.d3d-sc-close').addEventListener('click', closeScorecard);
    scorecardEl.querySelectorAll('.d3d-sc-row.open').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cat');
        if (id) finalizeTurn(id);
      });
    });
  }

  // Re-arm the in-play dice for another flick (keeps the kept dice on the shelf).
  function rerollTurn() {
    if (turnRollsUsed >= turnRollsLeft) return;
    if (multiDiceBodies.filter(b => !b._kept).length === 0) return;
    turnSettled = false;
    clearSuggest();
    clearActions();
    if (cancelBtn) { cancelBtn.style.display = ''; cancelBtn.textContent = 'Skip throw'; }
    armNonKept();
    const keptN = multiDiceBodies.filter(b => b._kept).length;
    statusEl.textContent = keptN ? 'Flick to roll the rest' : 'Grab the dice and flick to throw';
  }

  // End the turn and resolve the promise the toggle is awaiting.
  function finalizeTurn(pick, skipped) {
    if (!turnResolve) return;
    const r = turnResolve; turnResolve = null;
    let result;
    if (skipped) {
      result = { skipped: true, rollsUsed: 0, dice: null, held: null, pick: null };
    } else {
      result = {
        skipped: false,
        rollsUsed: turnRollsUsed,
        dice: multiDiceBodies.map(b => b._kept ? b._value : (b._value || topFaceFor(b))),
        held: multiDiceBodies.map(b => !!b._kept),
        pick: pick || null
      };
    }
    closeOverlay();
    r(result);
  }

  function buildMultiAssets(size) {
    const bevel = size * 0.13;
    if (multiGeom) { try { multiGeom.dispose(); } catch (_) {} }
    multiGeom = makeRoundedBoxGeometry(size, bevel, 6);
    if (!multiMats) {
      const theme = resolveDiceTheme();
      multiMats = FACE_NUMBERS.map(n => new THREE.MeshStandardMaterial({
        map: makeFaceTexture(n, theme),
        roughness: 0.32,
        metalness: 0.15,
        envMapIntensity: 0.45,
        color: 0xffffff
      }));
    }
  }

  function setupMultiDice(count) {
    teardownMultiDice();
    // Smaller dice so all 5 fit in the play area together.
    const SIZE = 0.62;
    const HALF = SIZE / 2;
    buildMultiAssets(SIZE);

    // Pre-compute fan offsets so the dice spread sideways around the finger.
    multiLanes = [];
    for (let i = 0; i < count; i++) {
      const lane = count === 1 ? 0 : (i / (count - 1) - 0.5) * 2.0; // -1..1
      const dz = (i % 2 === 0 ? 0 : 0.35);                          // light zig-zag
      multiLanes.push({ dx: lane, dz: dz });
    }

    // Park the dice in a fan near the player. Kinematic so they don't fall
    // while you line up a flick. On pickup they follow your finger and
    // tumble; on release the swipe vector becomes their velocity.
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(multiGeom, multiMats);
      mesh.castShadow = true;
      scene.add(mesh);
      multiDiceMeshes.push(mesh);

      const body = new CANNON.Body({
        mass: 0.6,
        shape: new CANNON.Box(new CANNON.Vec3(HALF, HALF, HALF)),
        material: diePMat,
        allowSleep: true,
        sleepSpeedLimit: 0.16,
        sleepTimeLimit: 0.45,
        linearDamping: 0.18,
        angularDamping: 0.18
      });
      const lane = multiLanes[i];
      body.position.set(lane.dx, HALF + 0.02, DRAG_Z_MAX - 0.2 + lane.dz);
      body.quaternion.setFromEuler(
        Math.random() * 0.35, Math.random() * 0.35, Math.random() * 0.35
      );
      body.type = CANNON.Body.KINEMATIC;
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      // Per-die "auto spin" axis used while the dice are held in the hand —
      // prevents the player from picking a face by holding still.
      const ax = Math.random() * 2 - 1;
      const ay = Math.random() * 2 - 1;
      const az = Math.random() * 2 - 1;
      const al = Math.hypot(ax, ay, az) || 1;
      body._spinAxis = { x: ax / al, y: ay / al, z: az / al };
      body._spinRate = 9 + Math.random() * 5; // rad/s — ~1.5-2 rotations/sec
      body.addEventListener('collide', (e) => {
        if (!multiThrowing) return;
        const c = e && e.contact;
        const v = c && typeof c.getImpactVelocityAlongNormal === 'function'
          ? Math.abs(c.getImpactVelocityAlongNormal())
          : 0;
        if (v >= 1.4) playImpactTap(v);
      });
      world.addBody(body);
      multiDiceBodies.push(body);
    }
    multiReady = true;
    multiThrowing = false;
    multiDragging = false;
    multiPointerSamples = [];
    multiLastDragP = null;
    multiSettleStart = 0;
  }

  // Move every multi die so it sits at (fingerX + lane.dx, fingerZ + lane.dz),
  // hovering at DRAG_Y. The whole group "tracks" the finger as one handful.
  function placeMultiAtFinger(px, pz) {
    // Only the in-play (non-kept) dice follow the finger; kept dice stay parked
    // on the shelf. Lanes are assigned across the throwable dice in order.
    let li = 0;
    for (let i = 0; i < multiDiceBodies.length; i++) {
      const b = multiDiceBodies[i];
      if (b._kept) continue;
      const lane = multiLanes[li++] || { dx: 0, dz: 0 };
      const tx = clamp(px + lane.dx, -DRAG_X_LIMIT, DRAG_X_LIMIT);
      const tz = clamp(pz + lane.dz, DRAG_Z_MIN, DRAG_Z_MAX);
      b.position.set(tx, DRAG_Y, tz);
    }
  }

  function multiFlick(vx, vz, speed) {
    const minS = 4, maxS = 22;
    const mag = Math.max(minS, Math.min(maxS, speed * 1.3));
    const k = mag / Math.max(0.01, speed);
    const VX = vx * k;
    const VZ = vz * k;
    const VY = 3.8 + Math.min(7, speed * 0.35);
    multiDiceBodies.forEach((b) => {
      if (b._kept) return; // kept dice sit out the throw
      b.type = CANNON.Body.DYNAMIC;
      b.wakeUp();
      b._spinAxis = null;
      const jitter = 1.5;
      b.velocity.set(
        VX + (Math.random() - 0.5) * jitter,
        VY + (Math.random() - 0.5) * 0.8,
        VZ + (Math.random() - 0.5) * jitter
      );
      const spin = 16 + Math.min(28, speed * 2.0);
      b.angularVelocity.set(
        -VZ * 0.7 + (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin * 0.7,
         VX * 0.7 + (Math.random() - 0.5) * spin
      );
    });
  }

  function multiSoftDrop() {
    // Weak / no flick → still toss the dice in the air with heavy spin so
    // they can't be released face-up.
    multiDiceBodies.forEach((b) => {
      if (b._kept) return; // kept dice sit out the throw
      b.type = CANNON.Body.DYNAMIC;
      b.wakeUp();
      b._spinAxis = null;
      b.velocity.set(
        (Math.random() - 0.5) * 2.2,
        3.4 + Math.random() * 1.6,
        -1.2 - Math.random() * 2.4
      );
      const spin = 18;
      b.angularVelocity.set(
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin
      );
    });
  }

  function onPointerDownMulti(ev) {
    // After the dice settle in an interactive turn, taps pick dice to keep
    // (fly to the shelf) or un-keep them — they don't start a new throw.
    if (interactiveTurn && turnSettled) { handleSettleTap(ev); return; }
    if (!multiReady || multiThrowing) return;
    ev.preventDefault();
    multiDragging = true;
    multiPointerSamples = [];
    try { canvasEl.setPointerCapture(ev.pointerId); } catch (_) {}
    const p = pointerOnDragPlane(ev);
    if (p) {
      multiPointerSamples.push({ t: performance.now(), x: p.x, z: p.z });
      multiLastDragP = { x: p.x, z: p.z };
      // Lift the in-play dice off the floor and snap them to the finger.
      multiDiceBodies.forEach(b => {
        if (b._kept) return;
        b.velocity.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
      });
      placeMultiAtFinger(p.x, p.z);
    }
    statusEl.textContent = 'Spin them up — flick to throw!';
  }

  function onPointerMoveMulti(ev) {
    if (!multiDragging) return;
    const p = pointerOnDragPlane(ev);
    if (!p) return;
    if (multiLastDragP) {
      const dx = p.x - multiLastDragP.x;
      const dz = p.z - multiLastDragP.z;
      // Tumble each in-play die under the fingertip. Slightly lower gain than
      // the single-die mode so the cluster doesn't spin as a chaotic blur.
      for (let i = 0; i < multiDiceBodies.length; i++) {
        if (multiDiceBodies[i]._kept) continue;
        applyTumbleTo(multiDiceBodies[i], dx, dz, 7.5);
      }
    }
    multiLastDragP = { x: p.x, z: p.z };
    placeMultiAtFinger(p.x, p.z);
    const now = performance.now();
    multiPointerSamples.push({ t: now, x: p.x, z: p.z });
    while (multiPointerSamples.length > 2 && now - multiPointerSamples[0].t > 200) {
      multiPointerSamples.shift();
    }
  }

  function onPointerUpMulti(ev) {
    if (!multiDragging) return;
    multiDragging = false;
    multiLastDragP = null;
    try { canvasEl.releasePointerCapture(ev.pointerId); } catch (_) {}

    const now = performance.now();
    while (multiPointerSamples.length > 2 && now - multiPointerSamples[0].t > 120) {
      multiPointerSamples.shift();
    }
    let vx = 0, vz = 0;
    if (multiPointerSamples.length >= 2) {
      const a = multiPointerSamples[0];
      const b = multiPointerSamples[multiPointerSamples.length - 1];
      const dt = Math.max(0.016, (b.t - a.t) / 1000);
      vx = (b.x - a.x) / dt;
      vz = (b.z - a.z) / dt;
    }
    const speed = Math.hypot(vx, vz);
    if (speed < 0.6) multiSoftDrop();
    else multiFlick(vx, vz, speed);

    if (interactiveTurn) turnRollsUsed++;
    multiReady = false;
    multiThrowing = true;
    multiRelaxTries = 0;
    multiSettleStart = performance.now();
    statusEl.textContent = 'Rolling…';
    playThrowClatter();
  }

  let libsPromise = null;
  function ensureLibs() {
    if (THREE && CANNON) return Promise.resolve();
    if (libsPromise) return libsPromise;
    libsPromise = Promise.all([
      import('https://unpkg.com/three@0.160.0/build/three.module.js'),
      import('https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js')
    ]).then(([t, c]) => { THREE = t; CANNON = c; });
    return libsPromise;
  }

  window.throw3DDie = function () {
    return Promise.all([ensureLibs(), ensureBrandFont()]).then(() => {
      if (!overlay) buildOverlay();
      if (!renderer) {
        try { initScene(); }
        catch (e) {
          console.warn('3D dice init failed', e);
          return Math.floor(Math.random() * 6) + 1;
        }
      }
      mode = 'single';
      teardownMultiDice();
      teardownHeld();
      clearSuggest();
      clearActions();
      clearKept();
      multiSuggest = false;
      multiSettledResults = null;
      interactiveTurn = false;
      turnSettled = false;
      turnResolve = null;
      if (dieMesh) dieMesh.visible = true;
      applyDiceTheme();
      resetDie();
      statusEl.textContent = 'Drag the dice and flick to throw';
      cancelBtn.textContent = 'Skip throw';
      overlay.style.display = 'flex';
      requestAnimationFrame(() => {
        overlay.classList.add('open');
        onResize();
      });

      if (!canvasEl._d3dBound) {
        canvasEl._d3dBound = true;
        canvasEl.addEventListener('pointerdown', onPointerDown);
        canvasEl.addEventListener('pointermove', onPointerMove);
        canvasEl.addEventListener('pointerup', onPointerUp);
        canvasEl.addEventListener('pointercancel', onPointerUp);
        window.addEventListener('resize', onResize);
      }

      if (!rafId) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }

      return new Promise(res => { resolveFn = res; });
    }).catch(e => {
      console.warn('throw3DDie failed, using random fallback', e);
      return Math.floor(Math.random() * 6) + 1;
    });
  };

  // Run a full in-overlay roll turn (solo/bot only). The player flicks to roll,
  // taps dice to keep them (they fly to the side shelf), can roll again, and
  // taps a suggested score to finish. Resolves with:
  //   { dice:[5], held:[5], rollsUsed, pick: catId|null, skipped: bool }
  //
  // Back-compat: if called the old way — throw3DDice(count) — it still resolves
  // with an array of rolled faces so any legacy caller keeps working.
  window.throw3DDice = function (arg, legacyOpts) {
    const optsIn = (arg && typeof arg === 'object') ? arg : (legacyOpts || {});
    const legacyCount = (typeof arg === 'number') ? Math.max(1, Math.min(5, arg | 0)) : 0;
    const legacy = legacyCount > 0;

    const startDice = Array.isArray(optsIn.dice) ? optsIn.dice.slice(0, 5) : [0, 0, 0, 0, 0];
    const startHeld = Array.isArray(optsIn.held) ? optsIn.held.slice(0, 5) : [false, false, false, false, false];
    while (startDice.length < 5) startDice.push(0);
    while (startHeld.length < 5) startHeld.push(false);
    const rollsLeft = Math.max(1, Math.min(3, (optsIn.rollsLeft | 0) || 1));

    const randomResult = () => {
      const d = [], h = [];
      for (let i = 0; i < 5; i++) {
        h.push(!!startHeld[i] && startDice[i] > 0);
        d.push(h[i] ? startDice[i] : Math.floor(Math.random() * 6) + 1);
      }
      return { dice: d, held: h, rollsUsed: 1, pick: null, skipped: false };
    };
    const legacyRandomArr = () => {
      const a = [];
      const k = startHeld.filter((b, i) => !(b && startDice[i] > 0)).length || legacyCount;
      for (let i = 0; i < (legacy ? legacyCount : k); i++) a.push(Math.floor(Math.random() * 6) + 1);
      return a;
    };

    const activeN = startHeld.filter((b, i) => !(b && startDice[i] > 0)).length;

    return Promise.all([ensureLibs(), ensureBrandFont()]).then(() => {
      if (!overlay) buildOverlay();
      if (!renderer) {
        try { initScene(); }
        catch (e) { console.warn('3D dice init failed', e); return legacy ? legacyRandomArr() : randomResult(); }
      }
      mode = 'multi';
      interactiveTurn = true;
      turnSettled = false;
      turnRollsLeft = rollsLeft;
      turnRollsUsed = 0;
      turnPick = null;
      flyTweens = [];
      // Park the single die out of view so it doesn't share the scene visibly.
      if (dieBody) { dieBody.type = CANNON.Body.STATIC; dieBody.position.set(0, -20, 0); }
      if (dieMesh) dieMesh.visible = false;
      clearSuggest();
      clearActions();
      setupTurnDice(startDice, startHeld);
      applyDiceTheme();
      if (_onOpenCb) { try { _onOpenCb(activeN || 5); } catch (_) {} }
      const keptN = startHeld.filter((b, i) => b && startDice[i] > 0).length;
      statusEl.textContent = keptN
        ? 'Kept dice are on the shelf — flick to roll the rest'
        : 'Grab the dice and flick to throw';
      cancelBtn.textContent = 'Skip throw';
      overlay.style.display = 'flex';
      requestAnimationFrame(() => {
        overlay.classList.add('open');
        onResize();
      });

      if (!canvasEl._d3dBound) {
        canvasEl._d3dBound = true;
        canvasEl.addEventListener('pointerdown', onPointerDown);
        canvasEl.addEventListener('pointermove', onPointerMove);
        canvasEl.addEventListener('pointerup', onPointerUp);
        canvasEl.addEventListener('pointercancel', onPointerUp);
        window.addEventListener('resize', onResize);
      }

      if (!rafId) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }

      return new Promise(res => {
        // For a legacy numeric call, adapt the rich result back to a face array
        // of just the dice that were rolled this turn.
        turnResolve = legacy
          ? (r => {
              if (!r || r.skipped) { res(legacyRandomArr()); return; }
              const arr = [];
              for (let i = 0; i < 5; i++) if (!r.held[i]) arr.push(r.dice[i]);
              res(arr.length ? arr : legacyRandomArr());
            })
          : res;
      });
    }).catch(e => {
      console.warn('throw3DDice failed, using fallback', e);
      return legacy ? legacyRandomArr() : randomResult();
    });
  };

  // ── Spectator mode: render an opponent's live 3D throw ───────────
  // No physics, no pointer input — just pose `count` multi-style dice from
  // network-streamed transforms. Returns { setFrame, close } once ready.
  window.dice3DSpectate = function (opts) {
    const o = opts || {};
    const n = Math.max(1, Math.min(5, (o.count | 0) || 5));
    return Promise.all([ensureLibs(), ensureBrandFont()]).then(() => {
      if (!overlay) buildOverlay();
      if (!renderer) {
        try { initScene(); }
        catch (e) { console.warn('3D dice init failed (spectator)', e); return null; }
      }
      mode = 'spectator';
      multiSuggest = false;
      multiSettledResults = null;
      interactiveTurn = false;
      turnSettled = false;
      turnResolve = null;
      teardownHeld();
      clearSuggest();
      clearActions();
      clearKept();
      if (dieBody) { dieBody.type = CANNON.Body.STATIC; dieBody.position.set(0, -20, 0); }
      if (dieMesh) dieMesh.visible = false;
      setupMultiDice(n);
      // Show the opponent's equipped skin on their streamed dice (defaults to
      // classic white when the broadcast omits a skin id).
      applyDiceTheme(false, o.skin || 'classic');
      // Freeze all bodies — meshes will follow body.position which we slam
      // each frame from the incoming stream.
      multiDiceBodies.forEach(b => {
        b.type = CANNON.Body.STATIC;
        b.velocity.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
        b._spinAxis = null;
      });
      multiReady = false; multiThrowing = false; multiDragging = false;

      const title = overlay.querySelector('.d3d-title');
      if (title) title.textContent = (o.title || 'OPPONENT').toUpperCase();
      statusEl.textContent = o.status || 'Watching opponent…';
      cancelBtn.textContent = 'Hide';
      cancelBtn.style.display = '';
      canvasEl.style.pointerEvents = 'none';
      overlay.style.display = 'flex';
      requestAnimationFrame(() => {
        overlay.classList.add('open');
        onResize();
      });

      if (!rafId) {
        lastTime = 0;
        rafId = requestAnimationFrame(tick);
      }

      return {
        setFrame(transforms) {
          if (mode !== 'spectator' || !transforms) return;
          const len = Math.min(transforms.length, multiDiceBodies.length);
          for (let i = 0; i < len; i++) {
            const t = transforms[i];
            if (!t || !t.p || !t.q) continue;
            multiDiceBodies[i].position.set(t.p[0], t.p[1], t.p[2]);
            multiDiceBodies[i].quaternion.set(t.q[0], t.q[1], t.q[2], t.q[3]);
          }
        },
        setStatus(text) {
          if (statusEl) statusEl.textContent = text || '';
        },
        close() {
          if (mode === 'spectator') closeOverlay();
        }
      };
    }).catch(e => {
      console.warn('dice3DSpectate failed', e);
      return null;
    });
  };

  // ── Public bridge for the multiplayer streaming module ───────────
  window.dice3DBridge = {
    isMultiActive() {
      return mode === 'multi' && (multiReady || multiDragging || multiThrowing);
    },
    isSpectatorActive() { return mode === 'spectator'; },
    getMode() { return mode; },
    getMultiState() {
      if (mode !== 'multi') return null;
      const transforms = [];
      for (let i = 0; i < multiDiceMeshes.length; i++) {
        const m = multiDiceMeshes[i];
        transforms.push({
          p: [m.position.x, m.position.y, m.position.z],
          q: [m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w]
        });
      }
      return {
        n: multiDiceMeshes.length,
        ready: multiReady,
        dragging: multiDragging,
        throwing: multiThrowing,
        transforms: transforms
      };
    },
    setOnFrame(fn) { _onFrameCb = (typeof fn === 'function') ? fn : null; },
    setOnOpen(fn)  { _onOpenCb  = (typeof fn === 'function') ? fn : null; },
    setOnClose(fn) { _onCloseCb = (typeof fn === 'function') ? fn : null; },
    setOnSpectatorHide(fn) {
      _onSpectatorHideCb = (typeof fn === 'function') ? fn : null;
    },
    // Source-of-truth set by first-roll.js: list of {name, val} for every
    // opponent whose roll is already in. Rendered into the overlay strip
    // so the player can see opponents' results while throwing their own die.
    setOpponentRolls(arr) {
      _oppRolls = Array.isArray(arr) ? arr.slice() : [];
      _renderOppRolls();
    }
  };
})();
