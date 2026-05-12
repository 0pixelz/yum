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
  let settleStart = 0;
  let dragPlane;
  let raycaster;
  let pickOffset = { x: 0, z: 0 };

  // BoxGeometry material order: [+X, -X, +Y, -Y, +Z, -Z]
  // Standard die: opposite faces sum to 7.
  const FACE_NUMBERS = [1, 6, 2, 5, 3, 4];
  const FACE_KEYS    = ['+X','-X','+Y','-Y','+Z','-Z'];

  const DIE_SIZE = 1.4;
  const FLOOR_Y = 0;
  const DRAG_Y = DIE_SIZE; // hover height while dragging

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  function makeFaceTexture(num) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fafbfc';
    roundRect(ctx, 6, 6, 244, 244, 38);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = 3;
    ctx.stroke();
    const pip = (x, y) => {
      const grad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, 22);
      grad.addColorStop(0, '#3a4252');
      grad.addColorStop(1, '#0b0f17');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    };
    const P = {
      1: [[128,128]],
      2: [[76,76],[180,180]],
      3: [[72,72],[128,128],[184,184]],
      4: [[76,76],[180,76],[76,180],[180,180]],
      5: [[72,72],[184,72],[128,128],[72,184],[184,184]],
      6: [[76,68],[180,68],[76,128],[180,128],[76,188],[180,188]]
    };
    P[num].forEach(([x, y]) => pip(x, y));
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    return tex;
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'dice3dOverlay';
    overlay.innerHTML =
      '<div class="d3d-title">THROW THE DIE</div>' +
      '<div class="d3d-canvas-wrap"><canvas id="dice3dCanvas"></canvas></div>' +
      '<div class="d3d-status" id="dice3dStatus">Drag the die and flick to throw</div>' +
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
    scene.fog = new THREE.Fog(0x0b1220, 12, 24);

    const w = canvasEl.clientWidth || 1;
    const h = canvasEl.clientHeight || 1;
    camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 7.5, 7);
    camera.lookAt(0, 0.4, -0.8);

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
    const rim = new THREE.DirectionalLight(0xf5a623, 0.35);
    rim.position.set(-5, 4, -3);
    scene.add(rim);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2030, roughness: 0.95, metalness: 0.02
    });
    floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const ringGeo = new THREE.RingGeometry(2.4, 2.55, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf5a623, side: THREE.DoubleSide,
      transparent: true, opacity: 0.18
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = FLOOR_Y + 0.01;
    scene.add(ring);

    const geo = new THREE.BoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 2, 2, 2);
    const mats = FACE_NUMBERS.map(n => new THREE.MeshStandardMaterial({
      map: makeFaceTexture(n),
      roughness: 0.32,
      metalness: 0.08,
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

    // Invisible walls — keep die in play area.
    const walls = [
      { p: [0, 0, -6.5], r: [0, 0, 0] },
      { p: [0, 0,  6.5], r: [0, Math.PI, 0] },
      { p: [-5.5, 0, 0], r: [0,  Math.PI / 2, 0] },
      { p: [ 5.5, 0, 0], r: [0, -Math.PI / 2, 0] }
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
    dieBody.position.set(0, 0.9, 2.6);
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
        dieBody.position.set(p.x, DRAG_Y, p.z);
      }
      pointerSamples.push({ t: performance.now(), x: p.x, z: p.z });
    }
    statusEl.textContent = 'Flick to throw!';
  }

  function onPointerMove(ev) {
    if (!dragging) return;
    const p = pointerOnDragPlane(ev);
    if (!p) return;
    dieBody.position.set(p.x + pickOffset.x, DRAG_Y, p.z + pickOffset.z);
    const now = performance.now();
    pointerSamples.push({ t: now, x: p.x, z: p.z });
    while (pointerSamples.length > 2 && now - pointerSamples[0].t > 200) {
      pointerSamples.shift();
    }
  }

  function onPointerUp(ev) {
    if (!dragging) return;
    dragging = false;
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
    return ensureLibs().then(() => {
      if (!overlay) buildOverlay();
      if (!renderer) {
        try { initScene(); }
        catch (e) {
          console.warn('3D dice init failed', e);
          return Math.floor(Math.random() * 6) + 1;
        }
      }
      resetDie();
      statusEl.textContent = 'Drag the die and flick to throw';
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
