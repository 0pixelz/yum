// 3D dice throw overlay — drag-and-flick gesture, Three.js + cannon-es.
// Exposes window.throw3DDie() → Promise<1-6>. Falls back to random on failure.
(function () {
  'use strict';

  let THREE, CANNON;
  let scene, camera, renderer;
  let world, dieBody, dieMesh, floorMesh;
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

  // The 3D die's faces are styled after the brand dice mark (#yum-mark):
  // warm gold radial face with dark-brown pips. The canvas is filled edge to
  // edge so the rounded corners of the geometry show face color too.
  function makeFaceTexture(num) {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');

    // Saturated orange face — punchier than the SVG brand mark so the die
    // doesn't average down to beige at game scale.
    const faceGrad = ctx.createRadialGradient(S * 0.32, S * 0.28, 16, S * 0.5, S * 0.5, S * 0.95);
    faceGrad.addColorStop(0,    '#ffd49a');
    faceGrad.addColorStop(0.32, '#ffa84a');
    faceGrad.addColorStop(0.72, '#ef7a12');
    faceGrad.addColorStop(1,    '#a8480a');
    ctx.fillStyle = faceGrad;
    ctx.fillRect(0, 0, S, S);

    // Soft inset border — looks like the bevel edge from the brand mark
    ctx.strokeStyle = 'rgba(70,30,5,0.55)';
    ctx.lineWidth = 10;
    ctx.strokeRect(28, 28, S - 56, S - 56);
    ctx.strokeStyle = 'rgba(255,210,138,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 40, S - 80, S - 80);

    // Dark-brown pips (match the brand mark color, larger radius for the higher-res canvas)
    const pip = (x, y) => {
      // soft drop shadow beneath the pip for depth
      const sh = ctx.createRadialGradient(x, y + 4, 8, x, y + 6, 56);
      sh.addColorStop(0, 'rgba(58,26,5,0.45)');
      sh.addColorStop(1, 'rgba(58,26,5,0)');
      ctx.fillStyle = sh;
      ctx.beginPath(); ctx.arc(x, y + 4, 56, 0, Math.PI * 2); ctx.fill();
      // pip — slight gradient for a recessed look
      const pg = ctx.createRadialGradient(x - 14, y - 14, 4, x, y, 44);
      pg.addColorStop(0,    '#5a2a08');
      pg.addColorStop(0.5,  '#3a1a05');
      pg.addColorStop(1,    '#1a0a02');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(x, y, 44, 0, Math.PI * 2); ctx.fill();
      // small specular highlight
      ctx.fillStyle = 'rgba(255,210,138,0.34)';
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

    // Very dark blue background — matches the main lobby (almost black with a
    // faint navy lift in the upper center).
    const g = ctx.createRadialGradient(S/2, S * 0.40, 80, S/2, S * 0.55, S * 0.72);
    g.addColorStop(0,    '#10132e');
    g.addColorStop(0.55, '#0a0c1f');
    g.addColorStop(1,    '#05061a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    // Subtle gold accent ring under the throw area
    ctx.strokeStyle = 'rgba(245,166,35,0.15)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(S/2, S * 0.58, S * 0.34, 0, Math.PI * 2); ctx.stroke();

    // ── Yamio brand logo (dice mark + wordmark, like the main lobby) ──
    const text = 'YAMIO';
    const fontSize = 280;
    const letterSpacing = fontSize * 0.18;            // matches CSS letter-spacing
    ctx.font = `900 ${fontSize}px 'Bebas Neue', 'Impact', 'Arial Narrow', sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const widths = text.split('').map(ch => ctx.measureText(ch).width);
    const wordW = widths.reduce((a, b) => a + b, 0) + letterSpacing * (text.length - 1);
    const markSize = fontSize * 1.25;                 // .yum-brand-mark ≈ 1.15em + extra room
    const gap = fontSize * 0.35;                      // .yum-brand-logo gap = 0.4em
    const totalW = markSize + gap + wordW;
    const cy = S * 0.30;                              // upper-third of the floor
    const logoX = (S - totalW) / 2;

    // Dice mark on the left
    drawYamioMark(ctx, logoX, cy - markSize / 2, markSize);

    // Wordmark "YAMIO" — orange-biased gold→red gradient. We hold the
    // saturated orange across most of the word and only roll into red at
    // the very end so the wordmark reads "orange" overall on the floor,
    // matching the lobby header's vivid look.
    const wordX = logoX + markSize + gap;
    const wordGrad = ctx.createLinearGradient(
      wordX, cy - fontSize * 0.5,
      wordX + wordW, cy + fontSize * 0.5
    );
    wordGrad.addColorStop(0,    '#ffb347');
    wordGrad.addColorStop(0.55, '#f5871a');
    wordGrad.addColorStop(1,    BRAND.accent);

    // Warm orange glow pass under the letters — tighter blur so the
    // saturated color isn't diluted into a beige halo.
    ctx.save();
    ctx.shadowColor = 'rgba(239,122,18,0.55)';
    ctx.shadowBlur = 36;
    ctx.fillStyle = wordGrad;
    let x = wordX;
    for (let i = 0; i < text.length; i++) {
      ctx.fillText(text[i], x, cy);
      x += widths[i] + letterSpacing;
    }
    ctx.restore();

    // Two crisp gradient passes for extra punch (no shadow)
    ctx.fillStyle = wordGrad;
    for (let pass = 0; pass < 2; pass++) {
      x = wordX;
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], x, cy);
        x += widths[i] + letterSpacing;
      }
    }
    // Dark outline so the letters pop against the very dark floor
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    x = wordX;
    for (let i = 0; i < text.length; i++) {
      ctx.strokeText(text[i], x, cy);
      x += widths[i] + letterSpacing;
    }

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 16;
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
      '<div class="d3d-canvas-wrap"><canvas id="dice3dCanvas"></canvas></div>' +
      '<div class="d3d-status" id="dice3dStatus">Drag the dice and flick to throw</div>' +
      '<button class="d3d-cancel" id="dice3dCancel">Skip throw</button>';
    document.body.appendChild(overlay);
    canvasEl = overlay.querySelector('#dice3dCanvas');
    statusEl = overlay.querySelector('#dice3dStatus');
    cancelBtn = overlay.querySelector('#dice3dCancel');
    cancelBtn.addEventListener('click', () => {
      if (!resolveFn) return;
      const r = resolveFn; resolveFn = null;
      closeOverlay();
      r(Math.floor(Math.random() * 6) + 1);
    });
  }

  function initScene() {
    scene = new THREE.Scene();
    // Very dark navy — matches the main lobby background
    scene.fog = new THREE.Fog(0x08091a, 12, 26);
    scene.background = new THREE.Color(0x0d0f24);

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const s = 5;
    key.shadow.camera.left = -s; key.shadow.camera.right = s;
    key.shadow.camera.top = s;   key.shadow.camera.bottom = -s;
    key.shadow.camera.near = 1;  key.shadow.camera.far = 25;
    scene.add(key);
    // Warm gold rim light + teal fill — matches brand accents
    const rim = new THREE.DirectionalLight(0xf5a623, 0.45);
    rim.position.set(-5, 4, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0x4ecdc4, 0.18);
    fill.position.set(3, 2, -6);
    scene.add(fill);

    // Branded floor: dark navy + the Yamio main-screen logo baked into the texture
    const floorTex = makeFloorTexture();
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex, roughness: 0.88, metalness: 0.04
    });
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Outer near-black surround so the play area sits in deep darkness
    const surroundMat = new THREE.MeshStandardMaterial({
      color: 0x07081a, roughness: 0.98, metalness: 0.0
    });
    const surround = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), surroundMat);
    surround.rotation.x = -Math.PI / 2;
    surround.position.y = -0.02;
    surround.receiveShadow = true;
    scene.add(surround);

    const geo = makeRoundedBoxGeometry(DIE_SIZE, DIE_BEVEL, 6);
    const mats = FACE_NUMBERS.map(n => new THREE.MeshStandardMaterial({
      map: makeFaceTexture(n),
      roughness: 0.28,
      metalness: 0.12,
      color: 0xffffff
    }));
    dieMesh = new THREE.Mesh(geo, mats);
    dieMesh.castShadow = true;
    scene.add(dieMesh);

    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -32, 0) });
    world.allowSleep = true;
    world.broadphase = new CANNON.NaiveBroadphase();

    const floorPMat = new CANNON.Material('floor');
    const diePMat = new CANNON.Material('die');
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

  // Tumble-on-drag: while the die is being held, finger motion spins it like
  // it's rolling under your fingertip. Angle = distance × SPIN_GAIN (well above
  // the natural arc-length-over-radius rate, so the die spins visibly fast).
  const SPIN_GAIN = 9.0;
  function applyTumble(dx, dz) {
    const dist = Math.hypot(dx, dz);
    if (dist < 0.0005) return;
    const ax = -dz / dist;        // roll axis = horizontal perpendicular to motion
    const az =  dx / dist;
    const angle = dist * SPIN_GAIN;
    const half = angle * 0.5;
    const s = Math.sin(half), cw = Math.cos(half);
    // delta quaternion = rotation by `angle` around (ax, 0, az)
    const dqx = ax * s, dqy = 0, dqz = az * s, dqw = cw;
    // new_q = delta * current  (world-space rotation premultiply)
    const q = dieBody.quaternion;
    const cx = q.x, cy = q.y, cz = q.z, cw2 = q.w;
    const nx = dqw * cx + dqx * cw2 + dqy * cz - dqz * cy;
    const ny = dqw * cy - dqx * cz + dqy * cw2 + dqz * cx;
    const nz = dqw * cz + dqx * cy - dqy * cx + dqz * cw2;
    const nw = dqw * cw2 - dqx * cx - dqy * cy - dqz * cz;
    q.set(nx, ny, nz, nw);
  }

  function onPointerMove(ev) {
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

    const speed = Math.hypot(vx, vz);
    if (speed < 0.6) {
      // Drop without throw — small bounce, random spin to ensure a roll.
      dieBody.velocity.set(0, 1.5, -0.5);
      dieBody.angularVelocity.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 12
      );
    } else {
      const minS = 4, maxS = 22;
      const mag = Math.max(minS, Math.min(maxS, speed * 1.3));
      const k = mag / Math.max(0.01, speed);
      const VX = vx * k;
      const VZ = vz * k;
      const VY = 4.5 + Math.min(7, speed * 0.35);
      dieBody.velocity.set(VX, VY, VZ);
      const spin = 8 + Math.min(22, speed * 1.6);
      dieBody.angularVelocity.set(
        -VZ * 0.7 + (Math.random() - 0.5) * spin,
        (Math.random() - 0.5) * spin * 0.5,
         VX * 0.7 + (Math.random() - 0.5) * spin
      );
    }

    throwing = true;
    settleStart = performance.now();
    statusEl.textContent = 'Rolling…';
  }

  function topFaceNumber() {
    const q = new THREE.Quaternion(
      dieBody.quaternion.x, dieBody.quaternion.y,
      dieBody.quaternion.z, dieBody.quaternion.w
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

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;
    world.step(1 / 60, dt, 3);
    dieMesh.position.copy(dieBody.position);
    dieMesh.quaternion.copy(dieBody.quaternion);
    renderer.render(scene, camera);

    if (throwing) {
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
    }
  }

  function closeOverlay() {
    overlay.classList.remove('open');
    setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      lastTime = 0;
      throwing = false; dragging = false;
    }, 280);
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
      resetDie();
      statusEl.textContent = 'Drag the dice and flick to throw';
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
})();
