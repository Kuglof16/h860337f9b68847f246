// HIRAKU landing page: one car on one screen, and the scroll is the clock.
// The first scene moves the car like the video's first scene (../intro/intro.html); the times below are its.
// From the first design on, the car moves by the saved records of the run: data/lap.json (see make_data.py).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const CLIP = new URLSearchParams(location.search).has('clip');   // only the 3D, centred, moved by window.LP.go
if (CLIP) document.documentElement.classList.add('clip');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, x) => a + (b - a) * x;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const fixed = (v, dp) => v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const $ = (q) => document.querySelector(q);
const $$ = (q) => [...document.querySelectorAll(q)];
/** 0 outside a..b, 1 inside, with a soft edge of f at each end. */
const band = (p, a, b, f = 0.03) => ease((p - a) / f) * (1 - ease((p - b) / f));
/** Piecewise linear: keys are [x, y]. */
const keyed = (keys, x) => {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) return lerp(keys[i - 1][1], keys[i][1], (x - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
  return keys[keys.length - 1][1];
};

// ---------- links
for (const a of $$('[data-link]')) {
  const url = (window.HIRAKU_LINKS || {})[a.dataset.link];
  if (url) a.href = url;
  else { a.removeAttribute('href'); a.title = '公開の準備中です'; a.style.opacity = a.classList.contains('cta') || a.classList.contains('big') ? '.55' : '.45'; a.style.cursor = 'default'; }
}

const loadBar = $('#load');
async function bin(name, Type, done) {
  const res = await fetch(`data/${name}.bin`);
  const stream = (await res.blob()).stream().pipeThrough(new DecompressionStream('gzip'));
  const out = new Type(await new Response(stream).arrayBuffer());
  done();
  return out;
}

// ---------- the same times as the video's first scene
const A = { start: 0.3, end: 3.228 }, D4 = { start: 11.191, end: 14.688 };
const B_START = 3.578, D3_START = 6.903;
const T_HOLD = 3.15;                  // the car is complete here; the opening stops at this moment
const T_END = D4.end + 0.2;

// ---------- the numbers at the lower right
const hudEl = { box: $('#hud'), big: $('#hBig span'), cap: $('#hCap span'), hand: $('#hHand'), cae: $('#hCae'), state: $('#hState') };
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
function setBig(el, value, unit) {
  const key = `${value}|${unit}`;
  if (el.dataset.k === key) return;
  el.dataset.k = key;
  el.textContent = value;
  if (unit) { const s = document.createElement('small'); s.textContent = unit; el.append(s); }
}
// the four friction circles (brake run, lane change): a circle is mu x the tyre's load, the line is the force the road gives it now
const fcEl = $('#hFc');
let fcParts = null;
/** One SVG element with its attributes, added to parent. */
function svgEl(tag, attrs, parent) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent.append(e);
  return e;
}
function drawFc(fc) {
  if (!fcEl) return;
  fcEl.style.display = fc ? '' : 'none';
  if (!fc) return;
  if (!fcParts) {
    const names = ['前・左', '前・右', '後・左', '後・右'];
    fcEl.replaceChildren();
    const svg = svgEl('svg', { viewBox: '0 0 232 76', 'aria-hidden': 'true' }, fcEl);
    fcParts = names.map((n, i) => {
      const g = svgEl('g', { transform: `translate(${29 + 58 * i},30)` }, svg);
      svgEl('line', { class: 'ax', x1: -28, x2: 28 }, g);
      svgEl('line', { class: 'ax', y1: -28, y2: 28 }, g);
      const rim = svgEl('circle', { class: 'rim', r: 26 }, g), f = svgEl('line', { class: 'f', x2: 0, y2: 0 }, g), dot = svgEl('circle', { class: 'dot', r: 3.6 }, g);
      svgEl('text', { y: 43 }, g).textContent = n;
      return { g, rim, f, dot };
    });
    fcParts.note = document.createElement('p');
    fcEl.append(fcParts.note);
  }
  const k = 26 / fc.max;   // the biggest circle of the run fills its place
  fc.wheels.forEach((w, i) => {
    const q = fcParts[i], x = (-w.fy * k).toFixed(1), y = (-w.fx * k).toFixed(1);   // seen from above, the front up: braking points back (down)
    q.rim.setAttribute('r', (w.lim * k).toFixed(1));
    q.f.setAttribute('x2', x); q.f.setAttribute('y2', y); q.dot.setAttribute('cx', x); q.dot.setAttribute('cy', y);
    q.g.classList.toggle('slide', !!w.slide);
  });
  setText(fcParts.note, fc.note);
}
function hud(o, opacity = 1) {
  hudEl.box.style.opacity = opacity;
  drawFc(o.fc || null);
  setBig(hudEl.big, o.big ?? '', o.unit ?? '');
  hudEl.big.style.display = o.big ? '' : 'none';
  hudEl.big.style.color = o.color || '';
  setText(hudEl.cap, o.cap ?? '');
  hudEl.cap.style.display = o.cap ? '' : 'none';
  if (hudEl.cap.title !== (o.cap ?? '')) hudEl.cap.title = o.cap ?? '';   // the whole caption on hover, when it is cut at four lines
  setText(hudEl.hand, o.hand ? `手計算 ${o.hand}` : '');
  setText(hudEl.cae, o.cae ? `解析 ${o.cae}` : '');
  setText(hudEl.state, o.state ?? '');
  hudEl.state.classList.toggle('ng', !!o.ng);
}

const scene3d = await (async function start() {
  const parts = ['nodes', 'quads', 'member', 'vm', 'disp', 'crash'];
  let got = 0;
  const tick = () => { got++; loadBar.style.width = `${(got / (parts.length + 2)) * 100}%`; };
  const [data, lap] = await Promise.all([fetch('data/scene.json').then((r) => r.json()), fetch('data/lap.json').then((r) => r.json())]);
  tick(); tick();
  let view = null;
  try {
    const [nodes, quads, memIdx, vm, disp, crash] = await Promise.all([
      bin('nodes', Float32Array, tick), bin('quads', Uint32Array, tick), bin('member', Uint16Array, tick), bin('vm', Uint16Array, tick), bin('disp', Int16Array, tick), bin('crash', Int16Array, tick)]);
    view = makeView(data, lap, { nodes, quads, memIdx, vm, disp, crash });
  } catch (e) {
    console.error(e);
    document.documentElement.classList.add('no3d');
  }
  loadBar.style.opacity = 0;
  return { view, data, lap };
})();

function makeView(data, lap, { nodes, quads, memIdx, vm, disp, crash }) {
  const F = data.frame, PA = { parts: data.parts, supports: data.supports };
  const nE = F.nE, nN = F.nN, DS = F.disp_scale, HOT = F.hot;
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 200, 200000);
  camera.up.set(0, 0, 1);
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 1.55));
  // a high light for the shadow on the ground; the light that shades the shapes stays with the camera
  const sun = new THREE.DirectionalLight(0xffffff, 0.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 9;
  sun.shadow.blurSamples = 20;
  sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -4200, right: 4200, top: 3600, bottom: -3600, near: 500, far: 14000 });
  scene.add(sun, sun.target);
  const aimSun = (x) => { sun.position.set(x - 500, 1500, 5200); sun.target.position.set(x, 0, 300); sun.target.updateMatrixWorld(); };
  // The shadow catcher writes no depth and is drawn right after the grid. Before, both were sorted by distance, and the
  // grid's 500 mm jumps after the camera swapped their order almost every frame: when the floor came first, its depth
  // hid the grid 1 mm below it, so the grid blinked.
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.26, depthWrite: false });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90000, 40000), floorMat);
  floor.position.z = 1; floor.receiveShadow = true; floor.renderOrder = -1; scene.add(floor);
  const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(0.3, 0.5, 1); camera.add(dl);
  dl.target.position.set(0, 0, -1); camera.add(dl.target);

  // ---------- ground
  const groundMat = new THREE.LineBasicMaterial({ color: 0x1b1a17, transparent: true, opacity: 0.09 });
  const gridPts = [];
  const GX = 30000, GY = 12000, GS = 500;
  for (let x = -GX; x <= GX; x += GS) gridPts.push(x, -GY, 0, x, GY, 0);
  for (let y = -GY; y <= GY; y += GS) gridPts.push(-GX, y, 0, GX, y, 0);
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
  const grid = new THREE.LineSegments(gridGeo, groundMat);
  grid.renderOrder = -2;
  scene.add(grid);

  const story = new THREE.Group(); scene.add(story);
  const STEP_X = 0, STEP_LEN = 500, STEP_H = 100;
  const stepMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4, transparent: true, opacity: 1 });
  const step = new THREE.Mesh(new THREE.BoxGeometry(STEP_LEN, 3400, STEP_H), stepMat);
  step.receiveShadow = true;
  step.position.set(STEP_X + STEP_LEN / 2, 0, STEP_H / 2); story.add(step);

  // ---------- the car of the first scene: the frame's shell mesh and its parts
  const carS = new THREE.Group(); story.add(carS);
  const corner = new THREE.Group(); corner.matrixAutoUpdate = false; story.add(corner);
  const fenderG = new THREE.Group(); fenderG.matrixAutoUpdate = false; story.add(fenderG);
  const fenderC = new THREE.Vector3(); let fenderN = 0;
  const CORNER_MEMBER = /^(tower_post_LB|tower_arm_LB|gusset_LB_)/;
  const CORNER_PART = /(_RL($|_|\d))|gusset_LB/;
  const isCornerPart = (id) => !/fender/.test(id) && CORNER_PART.test(id);
  const nV = nE * 4;
  const pos = new Float32Array(nV * 3), pos0 = new Float32Array(nV * 3), col = new Float32Array(nV * 3);
  for (let v = 0; v < nV; v++) { const n = quads[v]; pos0[3 * v] = nodes[3 * n]; pos0[3 * v + 1] = nodes[3 * n + 1]; pos0[3 * v + 2] = nodes[3 * n + 2]; }
  pos.set(pos0);
  const posAttr = new THREE.BufferAttribute(pos, 3), colAttr = new THREE.BufferAttribute(col, 3);
  const nM = F.members.length, mz = new Float64Array(nM), mc = new Float64Array(nM);
  const isCorner = F.members.map((m) => CORNER_MEMBER.test(m));
  for (let e = 0; e < nE; e++) { const m = memIdx[e]; mz[m] += pos0[12 * e + 2]; mc[m]++; }
  const mainE = [], cornerE = [];
  for (let e = 0; e < nE; e++) (isCorner[memIdx[e]] ? cornerE : mainE).push(e);
  mainE.sort((a, b) => mz[memIdx[a]] / mc[memIdx[a]] - mz[memIdx[b]] / mc[memIdx[b]] || a - b);
  function frameGeo(list) {
    const tri = new Uint32Array(list.length * 6);
    list.forEach((e, i) => { const b = 4 * e; tri.set([b, b + 1, b + 2, b, b + 2, b + 3], 6 * i); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', posAttr); g.setAttribute('color', colAttr);
    g.setIndex(new THREE.BufferAttribute(tri, 1));
    return g;
  }
  const frameMat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide, shininess: 0, specular: 0x000000, transparent: true });
  const mainGeo = frameGeo(mainE), cornerGeo = frameGeo(cornerE);
  const mainMesh = new THREE.Mesh(mainGeo, frameMat), cornerMesh = new THREE.Mesh(cornerGeo, frameMat);
  mainMesh.frustumCulled = cornerMesh.frustumCulled = false;
  carS.add(mainMesh); corner.add(cornerMesh);

  const partMatDark = new THREE.MeshLambertMaterial({ color: 0x55534d, transparent: true, opacity: 1 });
  const partMatMid = new THREE.MeshLambertMaterial({ color: 0x8d8a82, transparent: true, opacity: 1 });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x2b2a27, transparent: true, opacity: 1 });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xa8a59c, transparent: true, opacity: 1 });
  const tyreMat2 = new THREE.MeshLambertMaterial({ color: 0x2b2a27 });
  const hubMat2 = new THREE.MeshLambertMaterial({ color: 0xc4c0b4 });
  const SKIP = /^(occupant|side_net|net_clip|seat_belt|switch|anchor|wheel)/;
  const UNIT = new THREE.BoxGeometry(1, 1, 1);
  const partMeshes = [];
  for (const p of PA.parts) {
    if (SKIP.test(p.kind) || SKIP.test(p.id)) continue;
    const R = p.R, s = p.size.map((v) => Math.max(v, 1));
    const mat = new THREE.Matrix4().set(R[0][0] * s[0], R[0][1] * s[1], R[0][2] * s[2], p.c[0], R[1][0] * s[0], R[1][1] * s[1], R[1][2] * s[2], p.c[1],
      R[2][0] * s[0], R[2][1] * s[1], R[2][2] * s[2], p.c[2], 0, 0, 0, 1);
    const dark = /damper|link|knuckle|caliper|driveshaft|ball_joint|tie_rod|motor|reducer|steering/.test(p.kind);
    const m = new THREE.Mesh(UNIT, dark ? partMatDark : partMatMid);
    m.matrixAutoUpdate = false; m.matrix.copy(mat);
    const isFender = /fender_RL/.test(p.id);
    if (isFender) { fenderC.add(new THREE.Vector3(...p.c)); fenderN++; }
    (isCornerPart(p.id) ? corner : isFender ? fenderG : carS).add(m);
    partMeshes.push(m);
  }
  partMeshes.sort((a, b) => a.matrix.elements[14] - b.matrix.elements[14]);
  const tyres = [];
  const wheelGroup = (s, tm = tyreMat, hm = hubMat) => {
    const g = new THREE.Group(); g.position.set(...s.pos);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.w, 48), tm));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(s.r * 0.56, s.r * 0.56, s.w * 1.02, 32), hm));
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(s.r * 0.08, s.r * 0.08, s.w * 1.05, 12), tm);
      bolt.position.set(Math.cos(a) * s.r * 0.36, 0, Math.sin(a) * s.r * 0.36);
      g.add(bolt);
    }
    return g;
  };
  for (const s of PA.supports) {
    const g = wheelGroup(s);
    (s.id === 'RL' ? corner : carS).add(g);
    tyres.push({ g, r: s.r, rl: s.id === 'RL' });
  }

  // ---------- soft shadows and the bits that come off
  const blobCanvas = document.createElement('canvas'); blobCanvas.width = blobCanvas.height = 256;
  { const g = blobCanvas.getContext('2d'), r = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    r.addColorStop(0, 'rgba(27,26,23,.42)'); r.addColorStop(.6, 'rgba(27,26,23,.2)'); r.addColorStop(1, 'rgba(27,26,23,0)');
    g.fillStyle = r; g.fillRect(0, 0, 256, 256); }
  const blobTex = new THREE.CanvasTexture(blobCanvas);
  const makeBlob = (w, h, parent = story) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
    parent.add(m); return m;
  };
  const carBlob = makeBlob(4300, 2500), cornerBlob = makeBlob(1300, 1200);
  let seed = 48271;
  const rnd = (a, b) => { seed = (seed * 16807) % 2147483647; return a + (b - a) * (seed / 2147483647); };
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0x3a3833, transparent: true, opacity: 1 });
  for (let i = 0; i < 40; i++) rnd(0, 1);
  const debris = Array.from({ length: 18 }, () => {
    const m = new THREE.Mesh(UNIT, debrisMat); m.scale.set(rnd(20, 70), rnd(12, 40), rnd(12, 40)); story.add(m);
    return { m, v: [rnd(-1300, 1500), rnd(-600, 1500), rnd(300, 2500)], w: [rnd(-14, 14), rnd(-14, 14), rnd(-14, 14)] };
  });

  // ---------- colours
  function turbo(x) {
    x = clamp(x);
    const r = 0.13572138 + x * (4.61539260 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))));
    const g = 0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))));
    const b = 0.10667330 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))));
    return [clamp(r), clamp(g), clamp(b)];
  }
  const LUT = []; for (let i = 0; i <= 3000; i++) LUT.push(turbo(i / 3000));
  const GREY = [0.46, 0.46, 0.44];
  const ecx = new Float32Array(nE), ecy = new Float32Array(nE), ecz = new Float32Array(nE);
  for (let e = 0; e < nE; e++) { const j = 12 * e; ecx[e] = pos0[j]; ecy[e] = pos0[j + 1]; ecz[e] = pos0[j + 2]; }
  const hotP = new THREE.Vector3(...HOT.pos);
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let n = 0; n < nN; n++) for (let a = 0; a < 3; a++) { const v = nodes[3 * n + a]; if (v < lo[a]) lo[a] = v; if (v > hi[a]) hi[a] = v; }
  const centre = new THREE.Vector3((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, 650);
  const radius = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2;

  let lastPaint = '';
  function paint(wave) {
    const key = wave.toFixed(3);
    if (key === lastPaint) return;
    lastPaint = key;
    const R = radius * 2.2 * wave, soft = radius * 0.35;
    for (let e = 0; e < nE; e++) {
      const dx = ecx[e] - hotP.x, dy = ecy[e] - hotP.y, dz = ecz[e] - hotP.z;
      const a = wave <= 0 ? 0 : clamp((R - Math.sqrt(dx * dx + dy * dy + dz * dz)) / soft) * clamp((vm[e] - 150) / 500);
      const c = LUT[Math.min(3000, vm[e])];
      const r = lerp(GREY[0], c[0], a), g = lerp(GREY[1], c[1], a), b = lerp(GREY[2], c[2], a);
      for (let k = 0; k < 4; k++) { const j = 3 * (4 * e + k); col[j] = r; col[j + 1] = g; col[j + 2] = b; }
    }
    colAttr.needsUpdate = true;
  }
  let lastDeform = -1;
  function deform(f) {
    if (Math.abs(f - lastDeform) < 0.01) return;
    lastDeform = f;
    if (f <= 0) { pos.set(pos0); posAttr.needsUpdate = true; return; }
    const s = f * DS;
    for (let v = 0; v < nV; v++) {
      const d = 3 * quads[v], j = 3 * v;
      pos[j] = pos0[j] + s * disp[d]; pos[j + 1] = pos0[j + 1] + s * disp[d + 1]; pos[j + 2] = pos0[j + 2] + s * disp[d + 2];
    }
    posAttr.needsUpdate = true;
  }

  // ---------- marks
  const spots = [
    { p: new THREE.Vector3(-2020, 400, 520), g: corner },
    { p: hotP.clone(), g: carS },
    { p: new THREE.Vector3(-2020, 300, 230), g: corner },
  ];
  const marks = $('#marks');
  const qs = spots.map(() => { const d = document.createElement('div'); d.className = 'q'; d.textContent = '?'; marks.append(d); return d; });
  const ng = $('#ng'), ring = $('#ring'), flash = $('#flash'), note = $('#note');
  let W = 1, H = 1;
  function place(el, p) {
    const v = p.clone().project(camera);
    el.style.left = `${(v.x + 1) / 2 * W}px`;
    el.style.top = `${(1 - v.y) / 2 * H}px`;
  }
  // places on the car are written after the camera has moved
  let after = [];
  const later = (fn) => after.push(fn);

  /** Labels that point at places. Any label not asked for in a frame hides. */
  const pinned = new Map();
  let frameNo = 0;
  function pin(key, text, at, opacity = 1, { up = 64, cls = '' } = {}) {
    let a = pinned.get(key);
    if (!a) {
      const el = document.createElement('div'); el.className = `ann ${cls} ${up < 0 ? 'down' : ''}`; el.style.setProperty('--up', `${Math.abs(up)}px`);
      const line = document.createElement('i'), b = document.createElement('b');
      el.append(line, b); marks.append(el);
      a = { el, b, text: null };
      pinned.set(key, a);
    }
    if (a.text !== text) { a.text = text; a.b.textContent = text; }
    a.frame = frameNo;
    a.el.style.opacity = opacity;
    a.at = at;
  }

  // ---------- motion of the first scene (see ../intro/intro.html)
  const V = 2778, AXLE = 2020, TAU = 0.42;
  const T_GO = B_START - 0.25, T_BREAK = D3_START + 0.05;
  const X_BREAK = STEP_X + AXLE - 110, T_START = 0.35;
  const RUN = (d) => V * (d - T_START * (1 - Math.exp(-d / T_START)));
  const X_GO = X_BREAK - RUN(T_BREAK - T_GO);
  const carX = (t) => (t < T_GO ? X_GO : t < T_BREAK ? X_GO + RUN(t - T_GO) : X_BREAK + V * TAU * (1 - Math.exp(-(t - T_BREAK) / TAU)));
  const bump = (x) => STEP_H * ease((x - STEP_X + 224) / 224) * (1 - ease((x - STEP_X - STEP_LEN) / 224));
  function poseCar(t, heal) {
    const x = carX(t);
    const zF = bump(x), zR = bump(x - AXLE);
    const tau = Math.max(0, t - T_BREAK), after2 = Math.max(0, tau - 0.28);
    const rumble = t > T_GO ? 5 * Math.sin((t - T_GO) * 17) * Math.exp(-tau * 2) : 0;
    const D = 170 * (ease(tau / 0.28) + 0.1 * Math.sin(after2 * 16) * Math.exp(-after2 * 5) + 0.2 * Math.sin(after2 * 5.5) * Math.exp(-after2 * 0.42)) * (1 - heal);
    carS.position.set(x, 0, zF + D / 2 + rumble);
    carS.rotation.set(-D / 1220, -((zF - zR) / AXLE + D / AXLE), 0, 'YXZ');
    carS.updateMatrixWorld(true);
    const coast = 7 * (1 - Math.exp(-tau / 7));
    for (const y of tyres) y.g.rotation.y = y.rl ? (Math.min(x, X_BREAK) - X_BREAK + V * coast) / y.r : (x - X_BREAK) / y.r;
  }
  poseCar(T_BREAK, 0);
  const M_BREAK = carS.matrixWorld.clone();
  const WHEEL_BREAK = new THREE.Vector3(-2020, 610, 300).applyMatrix4(M_BREAK);
  const HOT_BREAK = hotP.clone().applyMatrix4(M_BREAK);
  const LAND = 0.5, REST_Z = 322;
  const mTorn = new THREE.Matrix4(), pA = new THREE.Vector3(), qA = new THREE.Quaternion(), sA = new THREE.Vector3(), pB = new THREE.Vector3(), qB = new THREE.Quaternion(), sB = new THREE.Vector3();
  const pivoted = (pos2, q, piv) => new THREE.Matrix4().makeTranslation(pos2.x, pos2.y, pos2.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(q))
    .multiply(new THREE.Matrix4().makeTranslation(-piv.x, -piv.y, -piv.z)).multiply(M_BREAK);
  function tornMatrix(tau) {
    const fw = 1 - Math.exp(-tau / 0.2);
    const k = ease(tau / LAND), rock = Math.max(0, tau - LAND);
    const hop = 280 * Math.sin(Math.PI * clamp(tau / LAND)) + 42 * Math.sin(Math.PI * clamp(rock / 0.22));
    const p = new THREE.Vector3(WHEEL_BREAK.x - 330 * fw, WHEEL_BREAK.y + 120 * fw, lerp(WHEEL_BREAK.z, REST_Z, k) + hop);
    const phi = 0.35 * k + 0.05 * Math.sin(rock * 13) * Math.exp(-rock * 5) + 0.07 * Math.sin(rock * 4.6) * Math.exp(-rock * 0.4);
    return pivoted(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(phi, 0, 1.7 * k, 'ZYX')), WHEEL_BREAK);
  }
  const FENDER_BREAK = fenderC.clone().divideScalar(fenderN).applyMatrix4(M_BREAK);
  function tornFender(tau) {
    const k = ease(tau / 0.55), fw = 1 - Math.exp(-tau / 0.3);
    const p = new THREE.Vector3(FENDER_BREAK.x + 950 * fw, FENDER_BREAK.y + 520 * fw, lerp(FENDER_BREAK.z, 215, k) + 110 * Math.sin(Math.PI * clamp(tau / 0.55)));
    const sway = Math.max(0, tau - 0.55);
    return pivoted(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22 * k + 0.14 * Math.sin(sway * 6.2) * Math.exp(-sway * 0.42), 0.12 * k, -0.55 * k, 'ZYX')), FENDER_BREAK);
  }
  function poseLoose(g, torn, t, heal) {
    if (t <= T_BREAK || heal >= 1) g.matrix.copy(carS.matrixWorld);
    else {
      mTorn.copy(torn(t - T_BREAK));
      if (heal > 0) {
        mTorn.decompose(pA, qA, sA); carS.matrixWorld.decompose(pB, qB, sB);
        mTorn.compose(pA.lerp(pB, heal), qA.slerp(qB, heal), sA);
      }
      g.matrix.copy(mTorn);
    }
    g.matrixWorldNeedsUpdate = true;
  }
  function poseGroundBits(t, fade, built) {
    const tau = t - T_BREAK, torn = tau > 0 && fade > 0.01;
    carBlob.visible = fade > 0.01 && built > 0.95;
    carBlob.position.set(carS.position.x - 1010, 0, 2);
    carBlob.material.opacity = 0.55 * fade * ease((built - 0.95) / 0.05);
    cornerBlob.visible = torn;
    if (torn) {
      const w = new THREE.Vector3(-2020, 610, 300).applyMatrix4(corner.matrix);
      const onStep = w.x > STEP_X - 150 && w.x < STEP_X + STEP_LEN + 150;
      cornerBlob.position.set(w.x, w.y, onStep ? STEP_H + 2 : 2);
      cornerBlob.material.opacity = fade * ease(tau / 0.3);
    }
    debrisMat.opacity = fade;
    for (const d of debris) {
      d.m.visible = torn;
      if (!torn) continue;
      const g = 9810, land = (d.v[2] + Math.sqrt(d.v[2] * d.v[2] + 2 * g * (HOT_BREAK.z - 14))) / g, s = Math.min(tau, land);
      d.m.position.set(HOT_BREAK.x + d.v[0] * s, HOT_BREAK.y + d.v[1] * s, HOT_BREAK.z + d.v[2] * s - g * s * s / 2);
      d.m.rotation.set(d.w[0] * s, d.w[1] * s, d.w[2] * s);
    }
  }

  // ---------- camera
  const fitZoom = () => Math.max(1, 1.05 / (W / H));
  const wideNow = () => W / H > 1.15;
  const tmpLook = new THREE.Vector3();
  function applyShot(s) {
    const a = s.az * Math.PI / 180, e = s.el * Math.PI / 180, dist = s.dist * fitZoom();
    tmpLook.set(s.look[0], s.look[1], s.look[2]);
    camera.position.set(tmpLook.x + dist * Math.cos(e) * Math.cos(a), tmpLook.y + dist * Math.cos(e) * Math.sin(a), tmpLook.z + dist * Math.sin(e));
    camera.lookAt(tmpLook);
    camera.updateMatrixWorld();
    const wide = wideNow() && !CLIP;
    camera.setViewOffset(W, H, -(wide ? s.sx ?? 0 : 0) * W, -(wide ? s.sy ?? -0.07 : s.my ?? -0.13) * H, W, H);
    camera.updateMatrixWorld();
    // the ground follows the camera
    grid.position.x = Math.round(s.look[0] / GS) * GS;
    floor.position.x = s.look[0];
    aimSun(s.look[0]);
  }
  const mixShot = (a, b, k) => ({ az: lerp(a.az, b.az, k), el: lerp(a.el, b.el, k), dist: lerp(a.dist, b.dist, k),
    look: [lerp(a.look[0], b.look[0], k), lerp(a.look[1], b.look[1], k), lerp(a.look[2], b.look[2], k)], sx: lerp(a.sx ?? 0, b.sx ?? 0, k), sy: lerp(a.sy ?? -0.07, b.sy ?? -0.07, k), my: lerp(a.my ?? -0.13, b.my ?? -0.13, k) });

  /** The first scene at a moment of its own; returns where the camera should be. */
  function storyAt(t, sideX, fadeAll = 1) {
    story.visible = true;
    const built = ease((t - A.start + 0.1) / (A.end - A.start));
    mainGeo.setDrawRange(0, Math.floor(mainE.length * clamp(built / 0.7)) * 6);
    cornerMesh.visible = built > 0.7;
    partMeshes.forEach((m, i) => { m.visible = built > 0.68 + 0.27 * (i / partMeshes.length); });
    tyres.forEach((y) => { y.g.visible = built > 0.95; });
    const heal = ease((t - D4.start) / 0.45);
    const fade = 1 - ease((t - D4.start - 0.2) / 0.55);
    for (const m of [partMatDark, partMatMid, tyreMat, hubMat]) { m.opacity = fade; m.depthWrite = fade > 0.5; }
    frameMat.opacity = fadeAll;
    frameMat.depthWrite = fadeAll > 0.5;
    const showParts = fade > 0.01;
    partMeshes.forEach((m) => { m.visible = m.visible && showParts; });
    tyres.forEach((y) => { y.g.visible = y.g.visible && showParts; });
    stepMat.opacity = fade; step.visible = showParts;
    poseCar(t, heal);
    poseLoose(corner, tornMatrix, t, heal);
    poseLoose(fenderG, tornFender, t, heal);
    poseGroundBits(t, fade, built);
    floorMat.opacity = 0.26 * lerp(0.35, 1, fade) * ease((built - 0.7) / 0.3);
    const zoom = ease((t - D4.start - 0.25) / (D4.end - D4.start));
    const settle = ease((t - T_BREAK) / 1.1);
    const inspect = ease((t - T_BREAK - 0.7) / 1.5);
    const az = lerp(lerp(lerp(55, 112, ease((t - A.start) / (T_BREAK - A.start))), 118, inspect), 128, zoom);
    const dist = lerp(lerp(radius * (t < T_GO ? 3.75 : lerp(3.75, 3.3, ease((t - T_GO) / 1.2))) + radius * 0.25 * settle, radius * 2.5, inspect), radius * 2.0, zoom);
    const w = carS.localToWorld(centre.clone());
    w.x -= 640 * settle;
    w.z = lerp(650, 520, settle);
    const stump = carS.localToWorld(hotP.clone());
    const close = new THREE.Vector3((stump.x + WHEEL_BREAK.x - 330) / 2, (stump.y + WHEEL_BREAK.y) / 2, 480);
    const look = w.lerp(close, inspect).lerp(stump, zoom);
    const shot = { az, el: lerp(lerp(lerp(16, 20, settle), 17, inspect), 42, zoom), dist, look: [look.x, look.y, look.z], sx: sideX, sy: wideNow() ? -0.03 : -0.12 };

    paint(ease((t - D4.start - 0.35) / 1.5));
    deform(30 * ease((t - D4.start - 0.5) / 1.8));

    const ngIn = ease((t - T_BREAK - 0.1) / 0.16), ngOut = 1 - ease((t - D4.start) / 0.3);
    ng.style.opacity = ngIn * ngOut;
    ng.style.transform = `scale(${lerp(1.5, 1, ngIn)})`;
    const fl = clamp((t - T_BREAK + 0.02) / 0.34);
    flash.style.opacity = t < T_BREAK - 0.02 ? 0 : 1 - fl;
    flash.style.transform = `scale(${lerp(0.4, 2.4, fl)})`;
    later(() => place(flash, HOT_BREAK));
    qs.forEach((q, i) => {
      const on = lerp(T_BREAK + 1.05, D4.start - 0.55, i / (qs.length - 1));
      const inn = ease((t - on) / 0.16), out = 1 - ease((t - D4.start) / 0.25);
      q.style.opacity = inn * out;
      const hop = clamp((t - on) / 0.5);
      q.style.transform = `scale(${lerp(.4, 1, inn) + 0.28 * Math.sin(Math.PI * hop) * (1 - hop)}) translateY(${-22 * Math.sin(Math.PI * hop) * (1 - hop)}px)`;
      later(() => place(q, spots[i].p.clone().applyMatrix4(spots[i].g === carS ? carS.matrixWorld : corner.matrix)));
    });
    return shot;
  }
  function ringMark(t, opacity) {
    ring.style.opacity = opacity * ease((t - D4.start - 1.1) / 0.5);
    ring.style.transform = `scale(${lerp(1.7, 1, ease((t - D4.start - 1.1) / 0.5))})`;
    const dv = 30 * ease((t - D4.start - 0.5) / 1.8) * DS, h = 3 * HOT.node;
    const at = carS.localToWorld(new THREE.Vector3(HOT.pos[0] + dv * disp[h], HOT.pos[1] + dv * disp[h + 1], HOT.pos[2] + dv * disp[h + 2]));
    later(() => place(ring, at));
    note.style.opacity = opacity * ease((t - D4.start - 0.3) / 0.4);
    pin('hot', '応力が集まる所', at, ring.style.opacity * 1, { up: 120, cls: 'red' });
  }

  // ---------- the car from the first design on: each version's own members and parts
  const D = data.designs;
  const rig = new THREE.Group(); scene.add(rig);      // moves and tilts everything standing on the road
  const body = new THREE.Group(); rig.add(body);
  const matRect = new THREE.MeshLambertMaterial({ color: 0xffffff }), matRound = new THREE.MeshLambertMaterial({ color: 0xffffff }), matBox = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const maxM = 300, maxB = Math.max(...D.map((d) => d.boxes.length)) + 60;
  const rect = new THREE.InstancedMesh(UNIT, matRect, maxM), round = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 12), matRound, maxM), boxI = new THREE.InstancedMesh(UNIT, matBox, maxB);
  for (const m of [rect, round, boxI]) { m.frustumCulled = false; m.castShadow = true; m.setColorAt(0, new THREE.Color(0xffffff)); body.add(m); }
  const wheels = D[0].wheels.map(() => { const g = wheelGroup({ pos: [0, 0, 0], r: 300, w: 200 }, tyreMat2, hubMat2); g.rotation.order = 'ZXY'; g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); rig.add(g); return g; });
  const byId = (list) => new Map(list.map((x) => [x.id, x]));
  const maps = D.map((d) => ({ m: byId(d.members), b: byId(d.boxes) }));
  const C_MEM = new THREE.Color(0x9b9990), C_BOX = new THREE.Color(0x8d8a82), C_DARK = new THREE.Color(0x4f4d47), C_PANEL = new THREE.Color(0xd9d6cb), C_PERSON = new THREE.Color(0xe3ab3c), C_RED = new THREE.Color(0xc8402a), tc = new THREE.Color();
  const baseColor = (b) => {
    if (b.k === 'o') return C_PERSON;
    if (/^(front_body|bulkhead|deck|floor|cargo|fender)/.test(b.id)) return C_PANEL;
    if (/^(damper|lca_|uca_|knuckle|caliper|toe_link|bj_|tie_rod|motor|reducer|steering|driveshaft|side_net|pedal|brake_master|seat)/.test(b.id)) return C_DARK;
    return C_BOX;
  };
  const netCanvas = document.createElement('canvas'); netCanvas.width = netCanvas.height = 64;
  { const g = netCanvas.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(0, 0, 64, 64); }
  const netTex = new THREE.CanvasTexture(netCanvas); netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.anisotropy = 4;
  const netGeo = new THREE.PlaneGeometry(1, 1); netGeo.rotateX(Math.PI / 2);
  const nets = new Map(['side_net_L', 'side_net_R', 'side_open_net_L', 'side_open_net_R'].map((id) => {
    const t = netTex.clone(); t.needsUpdate = true;
    const m = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ color: 0x4f4d47, alphaMap: t, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.visible = false; body.add(m); return [id, m];
  }));
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vD = new THREE.Vector3(), vX = new THREE.Vector3(), vZ = new THREE.Vector3(), vM = new THREE.Vector3(), ZUP = new THREE.Vector3(0, 0, 1), XF = new THREE.Vector3(1, 0, 0);
  const M4 = new THREE.Matrix4(), QB = new THREE.Quaternion(), SB = new THREE.Vector3(), EB = new THREE.Euler();
  let nRect = 0, nRound = 0;
  function beam(ax, ay, az, bx, by, bz, w, h, rd, color) {
    vA.set(ax, ay, az); vB.set(bx, by, bz);
    vD.subVectors(vB, vA); const len = vD.length() || 1; vD.divideScalar(len);
    vM.addVectors(vA, vB).multiplyScalar(0.5);
    vX.crossVectors(vD, ZUP); if (vX.lengthSq() < 1e-6) vX.crossVectors(vD, XF); vX.normalize();
    vZ.crossVectors(vX, vD);
    const mesh = rd ? round : rect, n = rd ? nRound++ : nRect++;
    if (n >= maxM) return;
    M4.makeBasis(vX.multiplyScalar(w), vD.multiplyScalar(len), vZ.multiplyScalar(h)); M4.setPosition(vM);
    mesh.setMatrixAt(n, M4); mesh.setColorAt(n, color);
  }
  function beamsDone() {
    rect.count = Math.min(nRect, maxM); round.count = Math.min(nRound, maxM);
    for (const m of [rect, round]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    nRect = nRound = 0;
  }
  /**
   * Draws the design at `at` (0 to 4; between whole numbers it moves to the next version).
   * o.mem(id) and o.box(id, b) may return a colour; o.red is a Set of ids in red, o.redK how red;
   * o.grow(id, b) scales a part (0 hides it); o.shift(id) moves one, [dx, dy, dz].
   */
  function drawCar(at, o = {}) {
    const i = Math.min(D.length - 1, Math.floor(at)), j = Math.min(D.length - 1, i + 1), f = at - i, k = ease(f);
    const redK = o.redK ?? 1;
    if (!o.noBeams) {
      for (const id of new Set([...maps[i].m.keys(), ...maps[j].m.keys()])) {
        const P = maps[i].m.get(id), Q = maps[j].m.get(id);
        const grow = !P ? k : !Q ? 1 - k : 1;
        if (grow <= 0.001) continue;
        const u = P || Q, w = Q || P;
        let c = o.mem?.(id) || C_MEM;
        if (o.red?.has(id)) c = tc.copy(c).lerp(C_RED, redK);
        const off = o.shiftM?.(id);
        const dx = off ? off[0] : 0, dy = off ? off[1] : 0, dz = off ? off[2] : 0;
        // a new member grows out of its midpoint
        const mx = (lerp(u.a[0], w.a[0], k) + lerp(u.b[0], w.b[0], k)) / 2, my = (lerp(u.a[1], w.a[1], k) + lerp(u.b[1], w.b[1], k)) / 2, mz2 = (lerp(u.a[2], w.a[2], k) + lerp(u.b[2], w.b[2], k)) / 2;
        const ax = mx + (lerp(u.a[0], w.a[0], k) - mx) * grow + dx, ay = my + (lerp(u.a[1], w.a[1], k) - my) * grow + dy, az = mz2 + (lerp(u.a[2], w.a[2], k) - mz2) * grow + dz;
        const bx = mx + (lerp(u.b[0], w.b[0], k) - mx) * grow + dx, by = my + (lerp(u.b[1], w.b[1], k) - my) * grow + dy, bz = mz2 + (lerp(u.b[2], w.b[2], k) - mz2) * grow + dz;
        beam(ax, ay, az, bx, by, bz, lerp(u.w, w.w, k) * grow, lerp(u.h, w.h, k) * grow, w.rd, c);
      }
      beamsDone();
    }
    let nb = 0;
    for (const m of nets.values()) m.visible = false;
    if (!o.noBoxes) {
      for (const id of new Set([...maps[i].b.keys(), ...maps[j].b.keys()])) {
        const P = maps[i].b.get(id), Q = maps[j].b.get(id);
        let grow = !P ? k : !Q ? 1 - k : 1;
        const u = P || Q, w = Q || P;
        if (o.grow) grow *= o.grow(id, w);
        if (grow <= 0.001 || nb >= maxB) continue;
        const off = o.shift?.(id);
        vM.set(lerp(u.c[0], w.c[0], k) + (off ? off[0] : 0), lerp(u.c[1], w.c[1], k) + (off ? off[1] : 0), lerp(u.c[2], w.c[2], k) + (off ? off[2] : 0));
        SB.set(Math.max(1, lerp(u.s[0], w.s[0], k)) * grow, Math.max(1, lerp(u.s[1], w.s[1], k)) * grow, Math.max(1, lerp(u.s[2], w.s[2], k)) * grow);
        const net = nets.get(id);
        if (net) {
          net.visible = true; net.position.copy(vM); net.scale.set(SB.x, 1, SB.z);
          net.material.alphaMap.repeat.set(SB.x / 62, SB.z / 62);
          const nc = o.box?.(id, w);
          net.material.color.copy(nc || C_DARK);
          continue;
        }
        if (w.r) { EB.set(w.r[0] * Math.PI / 180, w.r[1] * Math.PI / 180, w.r[2] * Math.PI / 180, 'ZYX'); QB.setFromEuler(EB); } else QB.identity();
        boxI.setMatrixAt(nb, M4.compose(vM, QB, SB));
        let c = o.box?.(id, w) || baseColor(w);
        if (o.red?.has(id)) c = tc.copy(c).lerp(C_RED, redK);
        boxI.setColorAt(nb, c);
        nb++;
      }
    }
    boxI.count = nb; boxI.instanceMatrix.needsUpdate = true; if (boxI.instanceColor) boxI.instanceColor.needsUpdate = true;
  }
  const dd = (at) => { const i = Math.min(D.length - 1, Math.floor(at)), j = Math.min(D.length - 1, i + 1); return [D[i], D[j], ease(at - i)]; };
  /** The car standing on the road: wheels where the design has them. */
  function poseStill(x, at, { steer = 0, spin = 0, wheelGrow = 1, wheelShift = null } = {}) {
    rig.position.set(x, 0, 0); rig.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
    const [P, Q, k] = dd(at);
    Q.wheels.forEach((w, n) => {
      const from = P.wheels[n] || w, off = wheelShift?.(n);
      wheels[n].position.set(lerp(from.c[0], w.c[0], k) + (off ? off[0] : 0), lerp(from.c[1], w.c[1], k) + (off ? off[1] : 0), lerp(from.c[2], w.c[2], k) + (off ? off[2] : 0));
      wheels[n].rotation.set(0, spin, n < 2 ? steer : 0);
      wheels[n].scale.setScalar(Math.max(wheelGrow, 0.0001));
      wheels[n].visible = wheelGrow > 0.001;
    });
    rig.updateMatrixWorld(true);
  }
  const WHEELS = ['FL', 'FR', 'RL', 'RR'];
  function recAt(R, t) {
    const n = R.t.length, u = clamp((t - R.t[0]) / (R.t[n - 1] - R.t[0])) * (n - 1), i = Math.min(n - 2, Math.floor(u)), f = u - i;
    const g = (a) => a[i] + (a[i + 1] - a[i]) * f;
    return { t, x: g(R.x), y: g(R.y), z: g(R.z), r: g(R.r), p: g(R.p), h: g(R.h), v: g(R.v), table: R.table ? g(R.table) : 0,
      w: WHEELS.map((w) => ({ x: g(R.w[w].x), y: g(R.w[w].y), z: g(R.w[w].z), s: g(R.w[w].s), a: g(R.w[w].a) })) };
  }
  const DEG = Math.PI / 180;
  /** The car as a record says. baseX moves the run along the road so that the tests follow on from one another. */
  function poseRec(rec, baseX) {
    rig.rotation.set(0, 0, 0);
    if (rec.table) {   // the record is in the table's frame: the table turns about its low edge
      const a = rec.table * DEG, hinge = -1210;
      rig.rotation.x = a;
      rig.position.set(baseX, hinge - hinge * Math.cos(a), -hinge * Math.sin(a));
    } else rig.position.set(baseX, 0, 0);
    body.position.set(rec.x, rec.y, rec.z);
    body.rotation.set(rec.r * DEG, rec.p * DEG, rec.h * DEG, 'ZYX');
    rec.w.forEach((w, n) => {
      wheels[n].position.set(w.x, w.y, w.z);
      wheels[n].rotation.set(rec.r * DEG, w.a * DEG, (rec.h + w.s) * DEG);
      wheels[n].scale.setScalar(1);
      wheels[n].visible = true;
    });
    rig.updateMatrixWorld(true);
  }
  const onCar = (x, y, z) => body.localToWorld(new THREE.Vector3(x, y, z));

  // ---------- things in the tests, at the positions the records give
  const props = new THREE.Group(); rig.add(props);
  const propMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4, transparent: true });
  const stepBox = new THREE.Mesh(UNIT, propMat);
  { const s = lap.step.scene[0]; stepBox.position.set(...s.position_mm); stepBox.scale.set(...s.size_mm); stepBox.receiveShadow = true; props.add(stepBox); }
  const tableBox = new THREE.Mesh(UNIT, propMat);
  { const s = lap.tilt.scene.find((x) => x.kind === 'tilt_table'); tableBox.position.set(...s.position_mm); tableBox.scale.set(...s.size_mm); tableBox.receiveShadow = true; props.add(tableBox); }
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xa8a294, transparent: true });
  const wallBox = new THREE.Mesh(UNIT, wallMat);
  { const s = lap.crash.wall; wallBox.position.set(...s.position_mm); wallBox.scale.set(...s.size_mm); wallBox.castShadow = true; props.add(wallBox); }
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xc8402a, transparent: true });
  const stopLine = new THREE.Mesh(UNIT, lineMat);
  { const s = lap.brake.scene.find((x) => x.kind === 'gate'); stopLine.position.set(s.position_mm[0], 0, 4); stopLine.scale.set(90, s.size_mm[1], 4); props.add(stopLine); }
  // where the brake was pressed: the stop line is 14 m on from it (the record's gate: the front tyre's front edge stops by then)
  const pressLine = new THREE.Mesh(UNIT, new THREE.MeshBasicMaterial({ color: 0x2a2824, transparent: true }));
  { const s = lap.brake.scene.find((x) => x.kind === 'gate'); pressLine.position.set(s.position_mm[0] - lap.brake.limit * 1000, 0, 4); pressLine.scale.set(60, s.size_mm[1], 4); props.add(pressLine); }
  // the force each tyre takes from the road: an arrow on the ground from its contact, red while the tyre slides
  const arrowMat = [new THREE.MeshBasicMaterial({ color: 0x2a2824 }), new THREE.MeshBasicMaterial({ color: 0xc8402a })];
  const shaftGeo = new THREE.CylinderGeometry(24, 24, 1, 10); shaftGeo.rotateZ(-Math.PI / 2); shaftGeo.translate(0.5, 0, 0);
  const headGeo = new THREE.ConeGeometry(70, 160, 14); headGeo.rotateZ(-Math.PI / 2); headGeo.translate(80, 0, 0);
  const tyreArrows = [0, 1, 2, 3].map(() => {
    const g = new THREE.Group(), shaft = new THREE.Mesh(shaftGeo, arrowMat[0]), head = new THREE.Mesh(headGeo, arrowMat[0]);
    g.add(shaft, head); g.visible = false; props.add(g); return { g, shaft, head };
  });
  /** f: per wheel { x, y, fx, fy, slide } (mm, N), k mm per N. Returns where each arrow ends, or null for one too short to draw. */
  function tyreForces(f, k = 0.6) {
    return f.map((w, n) => {
      const a = tyreArrows[n], F = Math.hypot(w.fx, w.fy), L = F * k;
      a.g.visible = L > 60;
      if (!a.g.visible) return null;
      const shaftL = Math.max(1, L - 160);
      a.shaft.scale.set(shaftL, 1, 1); a.head.position.x = shaftL;
      a.shaft.material = a.head.material = arrowMat[w.slide ? 1 : 0];
      const y = w.y + Math.sign(w.y) * 190;   // beside the tyre on its outer side, so the tyre does not hide it
      a.g.position.set(w.x, y, 90); a.g.rotation.set(0, 0, Math.atan2(w.fy, w.fx));
      return rig.localToWorld(new THREE.Vector3(w.x + (w.fx / F) * L, y + (w.fy / F) * L, 90));
    });
  }
  const coneMat = new THREE.MeshLambertMaterial({ color: 0xd2522f });
  const coneGeo = new THREE.ConeGeometry(120, 420, 16); coneGeo.rotateX(Math.PI / 2); coneGeo.translate(0, 0, 210);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, lap.dlc.cones.length);
  cones.frustumCulled = false; cones.castShadow = true;
  lap.dlc.cones.forEach((c, i) => { M4.makeTranslation(c[0], c[1], c[2]); cones.setMatrixAt(i, M4); });
  props.add(cones);
  const trailPts = [], trailIdx = [];
  { const r = lap.dlc.run, n = r.x.length;
    for (let i = 0; i < n; i++) {
      const a = i < n - 1 ? Math.atan2(r.y[i + 1] - r.y[i], r.x[i + 1] - r.x[i]) : 0, cx = r.x[i] - 1010 * Math.cos(r.h[i] * Math.PI / 180), cy = r.y[i] - 1010 * Math.sin(r.h[i] * Math.PI / 180);
      trailPts.push(cx - Math.sin(a) * 32, cy + Math.cos(a) * 32, 6, cx + Math.sin(a) * 32, cy - Math.cos(a) * 32, 6);
      if (i < n - 1) { const b = i * 2; trailIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    } }
  const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.Float32BufferAttribute(trailPts, 3)); trailGeo.setIndex(trailIdx);
  const trail = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: 0xc8402a, side: THREE.DoubleSide }));
  trail.frustumCulled = false; props.add(trail);
  const allProps = [stepBox, tableBox, wallBox, stopLine, pressLine, cones, trail];

  // ---------- real motion: the frame in the crash, the shape of the vibration, the parts going on
  const CR = lap.crash, cN = CR.nN, cF = CR.nF;
  const memberOf = (id) => maps[4].m.get(id);
  const segs = CR.segs.map(([a, b, id]) => ({ a, b, id, m: memberOf(id) || { w: 30, h: 30, rd: 0 }, t: CR.broken[id] ?? null }));
  function crashFrame(u, runIn) {
    // u: 0 to cF - 1. The colour shows how far each piece has turned from where it began.
    const i = Math.min(cF - 2, Math.floor(u)), f = u - i, off = (i * cN) * 3, off2 = ((i + 1) * cN) * 3;
    const tNow = lerp(CR.t[i], CR.t[i + 1], f);
    const P = (n, a) => lerp(crash[off + n * 3 + a], crash[off2 + n * 3 + a], f);
    for (const s of segs) {
      const ax = P(s.a, 0), ay = P(s.a, 1), az = P(s.a, 2), bx = P(s.b, 0), by = P(s.b, 1), bz = P(s.b, 2);
      const a0 = [crash[s.a * 3], crash[s.a * 3 + 1], crash[s.a * 3 + 2]], b0 = [crash[s.b * 3], crash[s.b * 3 + 1], crash[s.b * 3 + 2]];
      const dx0 = b0[0] - a0[0], dy0 = b0[1] - a0[1], dz0 = b0[2] - a0[2], dx = bx - ax, dy = by - ay, dz = bz - az;
      const cos = (dx0 * dx + dy0 * dy + dz0 * dz) / (Math.hypot(dx0, dy0, dz0) * Math.hypot(dx, dy, dz) || 1);
      const ang = Math.acos(clamp(cos, -1, 1));
      const broke = s.t !== null && tNow >= s.t;
      const c = broke ? C_RED : tc.setRGB(...turbo(0.12 + clamp(ang / 0.35) * 0.78));
      beam(ax + runIn, ay, az, bx + runIn, by, bz, s.m.w, s.m.h, s.m.rd, c);
    }
    beamsDone();
    return tNow;
  }
  const modeN = lap.mode.nodes;
  const ZERO3 = [0, 0, 0];
  function drawMode(amp) {
    for (const m of D[4].members) {
      const sa = modeN[m.na] || ZERO3, sb = modeN[m.nb] || ZERO3;
      const mag = (Math.hypot(...sa) + Math.hypot(...sb)) / 2;
      beam(m.a[0] + sa[0] * amp, m.a[1] + sa[1] * amp, m.a[2] + sa[2] * amp, m.b[0] + sb[0] * amp, m.b[1] + sb[1] * amp, m.b[2] + sb[2] * amp, m.w, m.h, m.rd, tc.setRGB(...turbo(0.12 + mag * 0.8)));
    }
    beamsDone();
  }

  /** The real order and the real paths. */
  const steps = lap.build.list.map((s, i) => ({ ...s, i, end: s.path.length ? s.path[s.path.length - 1] : null }));
  const stepOf = new Map(steps.filter((s) => s.end && !s.part.startsWith('corner:')).map((s) => [s.part, s]));
  const N_STEPS = steps.length;
  const along = (path, k) => {
    if (path.length < 2) return path[0];
    let total = 0; const seg = [];
    for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]); seg.push(l); total += l; }
    let d = k * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) { const f = seg[i] ? d / seg[i] : 1; return [lerp(path[i][0], path[i + 1][0], f), lerp(path[i][1], path[i + 1][1], f), lerp(path[i][2], path[i + 1][2], f)]; }
      d -= seg[i];
    }
    return path[path.length - 1];
  };
  /** explode: 0 assembled, 1 every part at the start of its path. done: how many steps have gone back on. */
  function buildOffset(s, explode, done) {
    const k = ease((done - s.i) / 6);
    const out = k >= 1 ? 1 : k;
    const atStart = [(s.path[0][0] - s.end[0]) * explode, (s.path[0][1] - s.end[1]) * explode, (s.path[0][2] - s.end[2]) * explode];
    if (out <= 0) return atStart;
    if (out >= 1) return null;
    const q = along(s.path, out);
    return [q[0] - s.end[0], q[1] - s.end[1], q[2] - s.end[2]];
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  }
  story.traverse((o) => { if (o.isMesh && o.material.isMeshBasicMaterial !== true) o.castShadow = o !== step; });
  resize();

  // ---------- each frame starts from nothing
  function reset() {
    frameNo++;
    after = [];
    story.visible = false;
    rig.visible = false; rig.rotation.set(0, 0, 0);
    for (const p of allProps) p.visible = false;
    for (const a of tyreArrows) a.g.visible = false;
    petGroup.visible = false;
    floorMat.opacity = 0.26;
    groundMat.opacity = 0.09;
    for (const el of [ng, ring, flash, note, ...qs]) el.style.opacity = 0;
    for (const m of [matRect, matRound, matBox]) { m.opacity = 1; m.transparent = false; m.depthWrite = true; }
    frameMat.opacity = 1;
  }
  function finish(shot) {
    applyShot(shot);
    for (const fn of after) fn();
    for (const a of pinned.values()) {
      if (a.frame !== frameNo) a.el.style.opacity = 0;
      else if (a.at) {
        place(a.el, a.at);
        if (a.el.style.opacity > 0) a.el.classList.toggle('left', parseFloat(a.el.style.left) + a.b.offsetWidth + 24 > W);
      }
    }
    renderer.render(scene, camera);
  }
  function carOpacity(x) {
    for (const m of [matRect, matRound, matBox]) { m.transparent = x < 1; m.opacity = x; m.depthWrite = x > 0.5; }
  }
  const prop = (mesh, opacity = 1) => { mesh.visible = opacity > 0.01; if (mesh.material.transparent) mesh.material.opacity = opacity; };

  // ---------- HIRAKU's pets, one per role (pets/pet3d.js), standing round the car
  const HP = window.HirakuPets;
  const petGroup = new THREE.Group(); petGroup.visible = false; rig.add(petGroup);
  const PET_MM = 290;                                 // pet units to millimetres: about 0.75 m tall beside the car
  const PET_CX = -1010, PET_RX = 2500, PET_RY = 1750; // the ring round the car's middle, mm
  // role, and where round the car it stands (degrees, 0 = ahead of the car)
  const PET_AT = [['cae.aero', 0], ['cae.crash', 34], ['cae.handling', 70], ['cae.strength', 106], ['cae.nvh', 142],
    ['cae.powertrain', 180], ['cae.thermal', 216], ['packager', 252], ['designer', 288], ['lead', 324]];
  const pets = [];
  if (HP) {
    const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    let i = 0;
    const next = () => {   // one at a time after the page is up, so building them never holds the page
      if (i >= PET_AT.length) return;
      const [role, deg] = PET_AT[i++];
      try {
        const pet = HP.create(THREE, { role, lite: true });
        pet.group.traverse((o) => { for (const m of [].concat(o.material || [])) if (m.isMeshStandardMaterial) { m.envMap = env; m.envMapIntensity = 0.75; } });
        const yaw = new THREE.Group(), up = new THREE.Group();
        up.rotation.x = Math.PI / 2;                    // the pets are built y-up; the road here is z-up
        up.add(pet.group); yaw.add(up); petGroup.add(yaw);
        const a = deg * Math.PI / 180;
        yaw.position.set(PET_CX + PET_RX * Math.cos(a), PET_RY * Math.sin(a), 0);
        pets.push({ pet, yaw, up, name: HP.ROLES.find((r) => r.id === role).name.replace(/役$/, ''), phase: i * 0.37 });   // まとめ・設計・パッケージ: with 「役」 the names sounded like someone playing a part
      } catch (e) { console.warn('pet', role, e); }
      setTimeout(next, 40);
    };
    setTimeout(next, 500);
  }
  const petHead = new THREE.Vector3(), petAt = new THREE.Vector3();
  /** The pets in this frame: k(i) is how far pet i has come in (0..1). Returns where each one's name goes. */
  function showPets(t, k) {
    petGroup.visible = pets.length > 0;
    const out = pets.map((q, i) => {
      const g = clamp(k(i));
      q.up.scale.setScalar(Math.max(0.0001, PET_MM * ease(g)));
      q.yaw.visible = g > 0.001;
      return { name: q.name, k: g, head: rig.localToWorld(petHead.copy(q.yaw.position).setZ(PET_MM * 2.75 * ease(g))).clone() };
    });
    later(() => {   // after the camera has moved: each pet turns to face it, then moves as it does at work
      for (const q of pets) {
        if (!q.yaw.visible) continue;
        q.yaw.getWorldPosition(petAt);
        q.yaw.rotation.z = Math.atan2(camera.position.x - petAt.x, -(camera.position.y - petAt.y));
        q.pet.update(t + q.phase, 'working', camera, { mark: false });
      }
    });
    return out;
  }

  return { pets: showPets, radius, T_END, carX, reset, finish, storyAt, ringMark, pin, onCar, later, drawCar, poseStill, poseRec, recAt, onWheel: (n) => wheels[n].getWorldPosition(new THREE.Vector3()),
    resize, mixShot, turbo, tc, carOpacity, prop, rig, wheels, props: { stepBox, tableBox, wallBox, stopLine, pressLine, cones, trail }, tyreForces, trailTo: (k) => { trailGeo.setDrawRange(0, Math.floor(k * (lap.dlc.run.x.length - 1)) * 6); }, crashFrame, drawMode, steps, stepOf, buildOffset, N_STEPS, memberOf, maps,
    tint: (x) => { groundMat.opacity = x; }, shadow: (x) => { floorMat.opacity = x; }, frameFade: (x) => { frameMat.opacity = x; }, carS };
}

// ---------- the timeline
const { view, data, lap } = scene3d;
const V = view;
const stageEl = $('#stage');
const R = V ? V.radius : 1785;
const NUM = (x, dp = 0) => fixed(x, dp);
const CARDS = new Map(data.solvers.cards.map((c) => [c.label.replace(' *', ''), c.lines]));
const X = {};   // where the car stands in each part of the page

const lookAt = (x, dz = 640, dy = 0) => [x - 1010, dy, dz];

function stressColor(value, limit) {
  const c = V.turbo(0.1 + 0.82 * clamp(value / limit));
  return V.tc.setRGB(c[0], c[1], c[2]).clone();
}

// hidden when only the frame and what is being looked at should show
const NET_RED = new THREE.Color(0xc8402a);
const NOT_FRAME = /^(occupant|seat|floor|deck|bulkhead|front_body|side_net|side_open_net|fender|cargo|aux|pedal|brake_master|main_switch|steering)/;

const RUN_L = lap.launch.run, RUN_S = lap.step.run, RUN_B = lap.brake.run, RUN_D = lap.dlc.run, RUN_T = lap.tilt.run;
const last = (a) => a[a.length - 1];
const speedAt = (t) => { const r = RUN_L; const n = r.t.length, u = clamp(t / last(r.t)) * (n - 1), i = Math.min(n - 2, Math.floor(u)); return lerp(r.v[i], r.v[i + 1], u - i); };
const brakeStart = last(RUN_B.x) - lap.brake.pair.cae * 1000;
// Before the record starts the car runs at the record's first speed, 35 km/h, so the turning wheels are seen before they lock.
const PRE_B = 1.4;
const B_DT = RUN_B.t[1] - RUN_B.t[0], B_V0 = (RUN_B.x[1] - RUN_B.x[0]) / B_DT;
const B_W0 = ['FL', 'FR', 'RL', 'RR'].map((w) => (RUN_B.w[w].a[1] - RUN_B.w[w].a[0]) / B_DT);
const brakeT = (p) => lerp(-PRE_B, last(RUN_B.t), clamp(p / 0.48));
const B_TY = lap.brake.tyre, B_WN = ['FL', 'FR', 'RL', 'RR'];
const B_GATE = lap.brake.scene.find((x) => x.kind === 'gate').position_mm[0];
const B_R = RUN_B.w.FL.z[0];
const B_FRONT = RUN_B.w.FL.x.map(((m) => (x) => (m = Math.max(m, x)))(-Infinity));   // the furthest the front wheel has come so far   // the front tyre's radius: its front edge is the centre plus this
/** The record at time t (t < 0: still at the starting speed): each tyre's force, friction limit and sliding, and the front edge. */
function brakeAt(t) {
  const T = RUN_B.t, n = T.length, u = clamp((Math.max(0, t) - T[0]) / (T[n - 1] - T[0])) * (n - 1), i = Math.min(n - 2, Math.floor(u)), f = u - i;
  const g = (a) => a[i] + (a[i + 1] - a[i]) * f;
  return { tyres: B_WN.map((w) => ({ fx: g(B_TY[w].fx), fy: g(B_TY[w].fy), lim: g(B_TY[w].lim), slide: B_TY[w].slide[f < 0.5 ? i : i + 1] })),
    front: (t < 0 ? RUN_B.w.FL.x[0] + B_V0 * t : g(B_FRONT)) + B_R };
}
const B_LIMMAX = Math.max(...B_WN.flatMap((w) => B_TY[w].lim));
// while all four slide at speed: how much of the circle a locked tyre still gives (the hand calculation took all of it, mu 0.6)
const B_SLIDE = (() => { const u = []; RUN_B.t.forEach((_, i) => { if (RUN_B.v[i] > 3 && B_WN.every((w) => B_TY[w].slide[i])) for (const w of B_WN) u.push(Math.abs(B_TY[w].fx[i]) / B_TY[w].lim[i]); });
  return u.reduce((a, b) => a + b, 0) / u.length; })();
const B_T_SLIDE = 1.2;   // a moment while all four slide, for the circles after the stop
// the lane change: the same four friction circles, from its own record (mu 0.8 there)
const D_TY = lap.dlc.tyre;
const D_LIMMAX = Math.max(...B_WN.flatMap((w) => D_TY[w].lim));
const D_USE = Math.max(...B_WN.flatMap((w) => D_TY[w].lim.map((l, i) => Math.hypot(D_TY[w].fx[i], D_TY[w].fy[i]) / l)));   // the most of a circle any tyre used
const D_SLID = B_WN.some((w) => D_TY[w].slide.some(Boolean));
function dlcTyres(t) {
  const T = RUN_D.t, n = T.length, u = clamp((t - T[0]) / (T[n - 1] - T[0])) * (n - 1), i = Math.min(n - 2, Math.floor(u)), f = u - i;
  const g = (a) => a[i] + (a[i + 1] - a[i]) * f;
  return B_WN.map((w) => ({ fx: g(D_TY[w].fx), fy: g(D_TY[w].fy), lim: g(D_TY[w].lim), slide: D_TY[w].slide[f < 0.5 ? i : i + 1] }));
}

const beats = [];
const add = (id, len, o = {}) => { beats.push({ id, len, ...o }); };

add('hero', 110, {
  act(p, now) {
    const t = lerp(0.2, T_HOLD, ease(now.intro));
    const shot = V.storyAt(t, 0.17);
    const on = now.wide ? ease((now.intro - 0.86) / 0.14) * (1 - ease(p / 0.5)) : 0;
    if (on > 0) {
      const m = (id) => V.memberOf(id);
      const topBar = m('rollbar_post_L'), rail = m('rail_L_S1S2');
      const top = topBar.a[2] > topBar.b[2] ? topBar.a : topBar.b;
      V.pin('h1', 'ロールバー', V.carS.localToWorld(new THREE.Vector3(...top)), on, { up: 40 });
      V.pin('h2', 'はしご形フレーム 82 部材', V.carS.localToWorld(new THREE.Vector3((rail.a[0] + rail.b[0]) / 2, (rail.a[1] + rail.b[1]) / 2, (rail.a[2] + rail.b[2]) / 2)), on, { up: -120 });
      V.pin('h3', '車輪 直径 600 mm', V.carS.localToWorld(new THREE.Vector3(-2020, 720, 20)), on, { up: -70 });
    }
    return shot;
  },
});
add('story', 430, {
  chapter: '作ってみても分からない',
  act(p) {
    const keys = [[0, T_HOLD], [0.26, 6.75], [0.42, 8.1], [0.66, D4.start], [1, T_END]];
    const t = keyed(keys, p);
    const shot = V.storyAt(t, lerp(0.17, 0.06, ease(p / 0.2)));
    V.ringMark(t, 1);
    return shot;
  },
});
add('check', 190, {
  chapter: '手計算と CAE の二重チェック',
  act(p) {
    const s0 = V.storyAt(T_END, 0.06);
    const look = V.carS.localToWorld(new THREE.Vector3(-1100, 0, 560));
    const s1 = { az: 128, el: 25, dist: R * 2.55, look: [look.x, look.y, look.z], sx: 0.06, sy: -0.06 };
    V.ringMark(T_END, 1 - ease(p / 0.22));
    const k = ease((p - 0.34) / 0.16);
    if (k > 0) {
      const c = (v, dp) => NUM(v * clamp(k / 0.7), dp);
      V.pin('c1', `段差 100 mm、前輪 1 輪の水平の力\n手計算 ${c(1092.9, 1)} N\n解析　 ${c(1103.7, 1)} N`, V.carS.localToWorld(new THREE.Vector3(-60, 400, 470)), k, { up: 170, cls: 'keep lg' });
      const k2 = ease((p - 0.46) / 0.16);
      V.pin('c2', `フレームの最大応力\n手計算 ${NUM(40 * k2, 1)}（単純はり）〜 ${NUM(77.09 * k2, 2)} MPa\n解析　 ${NUM(61.15 * k2, 2)} MPa`, V.carS.localToWorld(new THREE.Vector3(-1500, -350, 400)), k2, { up: -120, cls: 'keep lg' });
    }
    return V.mixShot(s0, s1, ease(p / 0.34));
  },
});

// the first version
add('chain1', 120, {
  chapter: '設計 → 評価 → 設計修正', ver: (p) => (p > 0.97 ? 1 : 0),
  act(p) {
    const morph = ease((p - 0.84) / 0.14);
    const fadeIn = ease(p / 0.12);
    if (fadeIn < 1) { V.storyAt(T_END, 0.06, 1 - fadeIn); }
    const steerK = ease((p - 0.55) / 0.18), steerBack = 1 - ease((p - 0.8) / 0.08);
    const steer = lap.steer.free.value * steerK * steerBack * Math.PI / 180;
    const redKnee = band(p, 0.27, 0.52), redRail = ease((p - 0.68) / 0.05) * steerBack;
    const red = redRail > redKnee ? new Set(['rail_L_LAp1_LAu1', 'rail_L_LAu1_LA']) : new Set(['steering_column', 'steering_wheel', 'occupant_R.thigh_L', 'occupant_R.thigh_R', 'occupant_R.shank_L', 'occupant_R.shank_R']);
    V.rig.visible = true;
    V.poseStill(X.chain1, morph, { steer });
    V.drawCar(morph, { red, redK: Math.max(redKnee, redRail) });
    V.carOpacity(fadeIn);
    if (redKnee > 0) V.pin('knee', `膝とハンドルのすき間 ${NUM(lap.steer.knee.value, 0)} mm`, V.onCar(-720, -300, 900), redKnee, { up: 90, cls: 'red keep lg' });
    if (redRail > 0) V.pin('rail', `レールに当たる\n必要なのは ${NUM(lap.steer.free.limit, 0)}°`, V.onCar(-300, 400, 500), redRail, { up: 120, cls: 'red keep lg' });
    const c = lookAt(X.chain1);
    const a = { az: 62, el: 18, dist: R * 3.5, look: c, sx: 0.08 };
    const b = { az: -58, el: 12, dist: R * 2.05, look: [X.chain1 - 760, -300, 800], sx: 0.14, sy: -0.09 };
    const w = { az: 40, el: 34, dist: R * 1.7, look: [X.chain1 - 180, 400, 420], sx: 0.1, sy: -0.09 };
    const e = { az: 70, el: 16, dist: R * 3.1, look: c, sx: 0.1 };
    const s = keyed([[0, 0], [0.2, 0], [0.32, 1], [0.5, 1], [0.6, 2], [0.8, 2], [0.92, 3], [1, 3]], p);
    const list = [a, b, w, e], i = Math.min(2, Math.floor(s));
    return V.mixShot(list[i], list[i + 1], ease(s - i));
  },
  hud(p) {
    const k = ease((p - 0.55) / 0.18);
    if (p < 0.55 || p > 0.84) return null;
    return { big: NUM(lap.steer.free.value * k, 1), unit: '°', cap: '前輪を切れる角度', state: k >= 1 ? 'NG' : '', ng: true, color: k >= 1 ? 'var(--red)' : '' };
  },
});
add('chain2', 80, {
  ver: (p) => (p > 0.9 ? 2 : 1),
  act(p) {
    const morph = 1 + ease((p - 0.62) / 0.3);
    const redK = ease(p / 0.1) * (1 - ease((p - 0.6) / 0.08));
    V.rig.visible = true;
    V.poseStill(X.chain1, morph);
    V.drawCar(morph, { red: new Set(['side_bar_L1', 'side_bar_L2']), redK, box: (id) => (id === 'side_net_L' && redK > 0.5 ? NET_RED : null) });
    if (redK > 0) V.pin('open', `開口をふさぐ物 ${NUM(lap.entry.blocked, 0)} つ`, V.onCar(-1230, 640, 1150), redK, { up: 150, cls: 'red keep lg' });
    return { az: 84, el: 11, dist: R * 2.7, look: [X.chain1 - 1050, 300, 760], sx: 0.08, sy: -0.09 };
  },
});
add('chain3', 150, {
  ver: (p) => (p > 0.92 ? 3 : 2),
  act(p) {
    const T = last(RUN_L.t), t = T * clamp((p - 0.04) / 0.56);
    const rec = V.recAt(RUN_L, t);
    const morph = 2 + ease((p - 0.72) / 0.2);
    V.rig.visible = true;
    V.poseRec(rec, X.chain3);
    V.drawCar(morph, { red: new Set(['motor']), redK: ease((p - 0.7) / 0.05) });
    const x = X.chain3 + rec.x, lag = rec.v * 26;
    if (p > 0.7) V.pin('motor', 'モーター 10 → 17 kW', V.onCar(-1815, 0, 300), ease((p - 0.72) / 0.06), { up: 210, cls: 'red keep lg' });
    return { az: 104, el: 7, dist: R * lerp(3.1, 2.6, ease((p - 0.68) / 0.2)), look: [x - 1010 - lag * (1 - ease((p - 0.6) / 0.1)), 0, 600], sx: 0.02, sy: -0.09 };
  },
  hud(p) {
    const T = last(RUN_L.t), t = T * clamp((p - 0.04) / 0.56);
    const limit = lap.launch.verdict.value;
    if (p > 0.72) return { big: NUM(lap.launch.after, 2), unit: '秒', cap: '17 kW で 40 km/h まで（基準 6 秒）', state: 'OK', color: '' };
    const at = Math.min(t, limit);
    return { big: NUM(Math.min(speedAt(at), 40), 1), unit: 'km/h', cap: `発進から ${NUM(at, 2)} 秒（基準は 6 秒で 40 km/h）`, state: t >= 6 ? 'NG' : '', ng: true, color: t >= 6 ? 'var(--red)' : '' };
  },
});
let newGussets = null;
add('chain4', 120, {
  lines: ['シェルの静解析', '有限要素の共通の核', '梁の静解析'],
  ver: (p) => (p > 0.8 ? 4 : 3),
  act(p) {
    const morph = 3 + ease((p - 0.56) / 0.3);
    const k = ease((p - 0.56) / 0.3);
    const S = lap.shell, lim = S.limit;
    V.rig.visible = true;
    V.poseStill(X.chain4, morph);
    const on = ease(p / 0.1);
    const mem = (id) => { const v = lerp(S.v4[id] ?? 0, S.v5[id] ?? S.v4[id] ?? 0, k); return on > 0 ? stressColor(v, lim).lerp(new THREE.Color(0x9b9990), 1 - on) : null; };
    newGussets ||= new Set([...V.maps[4].b.keys()].filter((i) => /gusset/.test(i) && !V.maps[3].b.has(i)));
    V.drawCar(morph, { mem, grow: (id) => (NOT_FRAME.test(id) ? 1 - on : 1), red: newGussets, redK: band(p, 0.6, 0.92) });
    const at = V.onCar(...S.at), v = lerp(S.max4, S.max5, k);
    V.pin('joint', `つなぎ目 ${NUM(v, 0)} MPa`, at, on, { up: 150, cls: `keep lg ${k < 0.6 ? 'red' : ''}` });
    return V.mixShot({ az: 120, el: 20, dist: R * 3.0, look: lookAt(X.chain4), sx: 0.08 }, { az: 148, el: 30, dist: R * 1.75, look: [X.chain4 + S.at[0] + 620, S.at[1] - 230, S.at[2] + 60], sx: 0.06, sy: -0.09 }, ease(p / 0.22));
  },
  hud(p) {
    const S = lap.shell, k = ease((p - 0.56) / 0.3), v = lerp(S.max4, S.max5, k);
    return { big: NUM(v, 0), unit: 'MPa', cap: `つなぎ目の応力（限界 ${NUM(S.limit, 0)} MPa）`, state: v <= S.limit ? 'OK' : 'NG', ng: v > S.limit, color: v > S.limit ? 'var(--red)' : '' };
  },
});
add('team', 110, {
  ver: () => 4,
  act(p) {
    V.rig.visible = true;
    V.poseStill(X.chain4, 4);
    V.drawCar(4);
    // the pets, one per role, come in one by one and stand round the car; each one's name above it
    const shown = V.pets(performance.now() / 1000, (i) => band(p, 0.03 + i * 0.045, 1.2));
    shown.forEach((q, i) => { if (q.k > 0.05) V.pin(`r${i}`, q.name, q.head, q.k, { up: 34, cls: 'lg' }); });
    if (!shown.length) {   // without the pets' file: the roles' names on the car, as before
      const roles = [
        ['組み立て', -720, -300, 1250, 60], ['操安', 0, 620, 620, 70], ['動力', -1815, 0, 300, 180], ['空力', 220, 0, 720, 110],
        ['衝突', 400, 0, 400, -80], ['強度信頼性', ...lap.shell.at, -100], ['音振', -1525, 0, 1770, 50], ['熱', -1170, 0, 330, -130],
      ];
      roles.forEach((r, i) => {
        const k = band(p, 0.04 + i * 0.05, 1.2);
        if (k > 0) V.pin(`r${i}`, r[0], V.onCar(r[1], r[2], r[3]), k, { up: r[4], cls: 'lg' });
      });
    }
    return { az: 150 + 280 * p, el: lerp(17, 24, Math.sin(p * Math.PI)), dist: R * (shown.length ? 4.3 : 3.5), look: lookAt(X.chain4, 560), sx: 0.1, sy: -0.09 };
  },
});

// everything the last version goes through, by the records
add('step', 90, {
  chapter: '確かめられること', lines: ['車両の動力学', 'サスペンションの K&C'],
  act(p) {
    const rec = V.recAt(RUN_S, last(RUN_S.t) * clamp(p / 0.9));
    V.rig.visible = true;
    V.poseRec(rec, X.step);
    V.drawCar(4);
    V.prop(V.props.stepBox, ease(p / 0.08) * (1 - ease((p - 0.94) / 0.06)));
    return { az: 60, el: 9, dist: R * 3.25, look: [X.step + rec.x - 880, 0, 640], sx: 0.02, sy: -0.07 };
  },
  hud(p) {
    // climb_time belongs to another of the tool's two runs, so the number here is the one on the screen: how high the wheel has gone
    const P = lap.step.pair, t = last(RUN_S.t) * clamp(p / 0.9), r = RUN_S.w.FL.z;
    const u = clamp(t / last(RUN_S.t)) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(u));
    const rise = Math.max(0, lerp(r[i], r[i + 1], u - i) - r[0]), done = rise >= 90;
    return { big: `+${NUM(rise, 0)}`, unit: 'mm', cap: done ? '前輪が上がった高さ。下の数字は、前輪を押し上げる力' : '前輪が上がった高さ（段差 100 mm）', hand: done ? `${NUM(P.hand, 0)} N` : '', cae: done ? `${NUM(P.cae, 0)} N` : '', state: done ? 'OK' : '' };
  },
});
add('brake', 150, {
  lines: ['手計算の式'],
  act(p) {
    const t = brakeT(p), rec = V.recAt(RUN_B, Math.max(0, t));
    if (t < 0) { rec.x += B_V0 * t; rec.w.forEach((w, n) => { w.x += B_V0 * t; w.a += B_W0[n] * t; }); }
    V.rig.visible = true;
    V.poseRec(rec, X.brake);
    V.drawCar(4);
    const shown = ease(p / 0.08) * (1 - ease((p - 0.95) / 0.05)), at = brakeAt(t);
    V.prop(V.props.stopLine, shown); V.prop(V.props.pressLine, shown);
    V.pin('line', `停止線まで ${NUM(Math.max(0, (B_GATE - at.front) / 1000), 2)} m`, V.rig.localToWorld(V.props.stopLine.position.clone()), ease(p / 0.08), { up: 90, cls: 'red lg keep' });
    V.pin('press', 'ブレーキ開始', V.rig.localToWorld(V.props.pressLine.position.clone()), ease(p / 0.08), { up: 56, cls: 'lg keep' });
    V.pin('speed', `${NUM(Math.max(0, rec.v), 0)} km/h`, V.onCar(-1010, 0, 2250), ease(p / 0.06), { up: 22, cls: 'sign keep' });
    if (p < 0.5) {
      const tips = V.tyreForces(at.tyres.map((w, n) => ({ ...w, x: rec.w[n].x, y: rec.w[n].y })));
      if (tips[1]) V.pin('force', 'タイヤの止める力', tips[1], 1, { up: -46, cls: 'red keep' });
    }
    return { az: 92, el: 11, dist: R * 4.7, look: [X.brake + rec.x + 1300, 0, 560], sx: 0, sy: -0.09 };
  },
  hud(p) {
    const B = lap.brake, t = brakeT(p), rec = recIn(RUN_B, Math.max(0, t)), at = brakeAt(t);
    rec.x += B_V0 * Math.min(0, t);
    const d = clamp((rec.x - brakeStart) / 1000, 0, B.pair.cae);
    const circles = `摩擦円 (μ ${NUM(B.mu, 1)} × 荷重) と、いまタイヤが路面から受ける力。赤は滑っている`;
    const slid = { wheels: brakeAt(B_T_SLIDE).tyres, max: B_LIMMAX, note: `ロックして滑ると、止める力は円の ${NUM(B_SLIDE * 10, 0)} 割ほどしか出ない` };
    if (p < 0.5) return { big: NUM(d, 2), unit: 'm', cap: `いま ${NUM(Math.max(0, rec.v), 0)} km/h・停止線まで ${NUM(Math.max(0, (B_GATE - at.front) / 1000), 2)} m (ブレーキ開始から ${NUM(B.limit, 0)} m)`, fc: { wheels: at.tyres, max: B_LIMMAX, note: circles } };
    if (p < 0.77) return { big: NUM(B.pair.cae, 2), unit: 'm', cap: '止まるまでの距離', hand: `${NUM(B.pair.hand, 2)} m`, cae: `${NUM(B.pair.cae, 2)} m`, state: '合わない', ng: true, fc: slid };
    return { big: NUM(B.pair.cae, 2), unit: 'm', cap: '原因を書き残し、手計算をやり直す', hand: `${NUM(B.pair2.hand, 2)} m`, cae: `${NUM(B.pair2.cae, 2)} m`, state: 'OK', fc: slid };
  },
});
add('dlc', 100, {
  act(p) {
    const rec = V.recAt(RUN_D, last(RUN_D.t) * clamp(p));
    V.rig.visible = true;
    V.poseRec(rec, X.dlc);
    V.drawCar(4);
    V.prop(V.props.cones, 1);
    V.prop(V.props.trail, 1);
    V.trailTo(clamp(p));
    // from the front: the car comes toward the camera through the cones, its line behind it
    return { az: 8, el: 22, dist: R * 5.4, look: [X.dlc + rec.x - 200, rec.y * 0.85, 750], sx: 0, sy: -0.05 };
  },
  hud(p) {
    const t = last(RUN_D.t) * clamp(p), rec = recIn(RUN_D, t), P = lap.dlc.pair;
    // the circles are seen from above with the car's front up (the camera here looks from the front, so they are mirrored)
    const note = `上から見た摩擦円 (μ ${NUM(lap.dlc.mu, 1)} × 荷重) と、いまタイヤが路面から受ける力。いちばん使ったときで円の ${NUM(D_USE * 10, 0)} 割${D_SLID ? '' : '、どのタイヤも滑らない'}`;
    return { big: NUM(Math.abs(rec.r), 2), unit: '°', cap: `車体の傾き（最大 ${NUM(lap.dlc.max_roll, 2)}°、40 km/h で車線変更）`, hand: p > 0.3 ? `${NUM(P.hand, 3)} g` : '', cae: p > 0.3 ? `${NUM(P.cae, 3)} g` : '', state: p > 0.3 ? 'OK' : '',
      fc: { wheels: dlcTyres(t), max: D_LIMMAX, note } };
  },
});
add('tilt', 150, {
  act(p) {
    const t = keyed([[0, 0], [0.5, RUN_T.t[0] + 18.4], [0.74, 20.4], [0.86, last(RUN_T.t)], [0.9, last(RUN_T.t)], [1, 0]], p);
    const rec = V.recAt(RUN_T, t);
    V.rig.visible = true;
    V.poseRec(rec, X.tilt);
    V.drawCar(4);
    V.prop(V.props.tableBox, ease(p / 0.06) * (1 - ease((p - 0.96) / 0.04)));
    if (t > lap.tilt.contact_time && p < 0.9) V.pin('bar', 'ロールバーが地面に当たる', V.onCar(-1525, -630, 1760), ease((t - lap.tilt.contact_time) / 0.3), { up: 80, cls: 'keep lg' });
    return { az: 6, el: 7, dist: R * 3.9, look: [X.tilt - 1010, -900, 950], sx: 0.1, sy: 0 };
  },
  hud(p) {
    const t = keyed([[0, 0], [0.5, 18.4], [0.74, 20.4], [0.86, last(RUN_T.t)], [0.9, last(RUN_T.t)], [1, 0]], p);
    const rec = recIn(RUN_T, t), P = lap.tilt.pair;
    if (p > 0.92) return null;
    const a = Math.min(rec.table, P.cae);
    const done = rec.table >= P.cae;
    return { big: NUM(a, 1), unit: '°', cap: `傾斜台の角度（基準 ${NUM(lap.tilt.limit, 0)}°）`, hand: done ? `${NUM(P.hand, 1)}°` : '', cae: done ? `${NUM(P.cae, 1)}°` : '', state: done ? 'OK' : '' };
  },
});
add('heat', 100, {
  lines: ['電力と熱'],
  act(p) {
    const H2 = lap.heat, k = p < 0.55 ? clamp(p / 0.5) : clamp((p - 0.58) / 0.34), series = p < 0.55 ? H2.t40 : H2.t52;
    const n = series.battery.length, u = k * (n - 1), i = Math.min(n - 2, Math.floor(u));
    const T = (name) => lerp(series[name][i], series[name][i + 1], u - i);
    const hot = { battery: T('battery'), motor: T('motor'), controller: T('controller') };
    const on = ease(p / 0.08) * (1 - ease((p - 0.95) / 0.05));
    V.rig.visible = true;
    V.poseStill(X.heat, 4);
    V.drawCar(4, { grow: (id) => (NOT_FRAME.test(id) ? 1 - on : 1), box: (id) => (hot[id] != null ? stressColor(hot[id] - 30, H2.limit - 30) : null) });
    V.pin('b', `電池 ${NUM(hot.battery, 1)} ℃`, V.onCar(-1170, 0, 430), on, { up: 200, cls: 'keep lg' });
    V.pin('m', `モーター ${NUM(hot.motor, 1)} ℃`, V.onCar(-1815, 0, 395), on, { up: 130, cls: 'lg' });
    V.pin('c', `制御器 ${NUM(hot.controller, 1)} ℃`, V.onCar(-1555, 0, 340), on, { up: -100, cls: 'lg' });
    return { az: 66, el: 34, dist: R * 2.5, look: [X.heat - 1450, 0, 330], sx: 0.02, sy: -0.13 };
  },
  hud(p) {
    const H2 = lap.heat;
    if (p < 0.55) return { cap: `気温 40 ℃、林道を 20 km（${NUM(H2.time / 60, 0)} 分）走る。電池の限界 ${NUM(H2.limit, 0)} ℃`, hand: `${NUM(H2.pair.hand, 1)} ℃`, cae: `${NUM(H2.pair.cae, 1)} ℃`, state: 'OK' };
    return { cap: `気温 52 ℃（仕様の外）。電池の限界 ${NUM(H2.limit, 0)} ℃`, big: NUM(H2.max52, 1), unit: '℃', state: 'NG', ng: true, color: 'var(--red)' };
  },
});
const CRASH_T = lap.crash.t;
add('crash', 110, {
  lines: ['衝突'],
  act(p) {
    const contact = 0.2, end = 0.72;
    const run = keyed([[0, 0], [0.07, 4200], [contact, 0]], p);
    const parts = 1 - ease((p - 0.08) / 0.1) + ease((p - 0.9) / 0.1);
    const u = (lap.crash.nF - 1) * (p < 0.88 ? clamp((p - contact) / (end - contact)) : clamp(1 - (p - 0.88) / 0.1));
    V.rig.visible = true;
    V.poseStill(X.crash, 4, { wheelGrow: Math.min(1, parts) });
    V.drawCar(4, { noBeams: true, grow: () => Math.min(1, parts), shift: () => [-run, 0, 0] });
    V.wheels.forEach((w) => { w.position.x -= run; });
    V.crashFrame(u, -run);
    V.prop(V.props.wallBox, ease(p / 0.06) * (1 - ease((p - 0.94) / 0.06)));
    return { az: lerp(112, 98, p), el: 14, dist: R * 2.55, look: [X.crash - 760 - run * 0.8, 0, 720], sx: 0.02, sy: -0.09 };
  },
  hud(p) {
    const contact = 0.2, end = 0.72, C = lap.crash;
    if (p < contact) return { big: '40', unit: 'km/h', cap: '壁に当たるまで' };
    const k = clamp((p - contact) / (end - contact));
    if (p < end) return { big: NUM(last(CRASH_T) * k, 3), unit: '秒', cap: '壁に当たってからの時間' };
    return { big: NUM(C.crush, 0), unit: 'mm', cap: 'つぶれた長さ', hand: `${NUM(C.hand_crush, 0)} mm`, cae: `${NUM(C.crush, 0)} mm` };
  },
});
add('shake', 70, {
  lines: ['固有値と座屈'],
  act(p) {
    const on = ease(p / 0.14) * (1 - ease((p - 0.86) / 0.14));
    const amp = 150 * on * Math.sin(p * Math.PI * 2 * 5);
    V.rig.visible = true;
    V.poseStill(X.crash, 4);
    V.drawCar(4, { noBeams: true, grow: (id) => (NOT_FRAME.test(id) ? 1 - on : 1 - on) });
    V.drawMode(amp);
    return { az: 134, el: 19, dist: R * 3.1, look: lookAt(X.crash), sx: 0.02, sy: -0.09 };
  },
  hud() {
    const M = lap.mode;
    return { big: NUM(M.hz, 2), unit: 'Hz', cap: 'フレームの最初の固有振動（形は誇張）', hand: `${NUM(M.pair.hand, 2)} Hz`, cae: `${NUM(M.pair.cae, 2)} Hz`, state: 'OK' };
  },
});
const BUILD_N = lap.build.list.length;
const buildDone = (p) => clamp((p - 0.16) / 0.74) * (BUILD_N + 6);
add('build', 150, {
  lines: ['組み立ての順番', '幾何と干渉'],
  act(p) {
    const explode = ease(p / 0.14), done = buildDone(p);
    const person = 1 - ease(p / 0.06) + ease((p - 0.93) / 0.07);
    V.rig.visible = true;
    const wheelIds = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'];
    V.poseStill(X.crash, 4, { wheelShift: (n) => { const s = V.stepOf.get(wheelIds[n]); return s ? V.buildOffset(s, explode, done) : null; } });
    V.drawCar(4, { grow: (id, b) => (b.k === 'o' ? Math.min(1, person) : 1), shift: (id) => { const s = V.stepOf.get(id); return s ? V.buildOffset(s, explode, done) : null; } });
    return { az: lerp(40, 98, p), el: lerp(30, 18, p), dist: R * lerp(4.5, 3.4, ease((p - 0.5) / 0.4)), look: lookAt(X.crash, 780), sx: 0.02, sy: -0.08 };
  },
  hud(p) {
    const done = Math.floor(buildDone(p)), list = lap.build.list;
    if (p < 0.14) return null;
    const i = clamp(done, 0, BUILD_N - 1);
    const n = list.slice(0, i + 1).filter((s) => !s.part.startsWith('corner:')).length;
    return { big: `${n}`, unit: `/ ${NUM(lap.build.steps, 0)} 手順`, cap: list[i].text, state: p > 0.9 ? '詰まる部品 0' : '' };
  },
});

// the two films, then back to the light
add('film', 170, {
  lines: ['流体'], dark: (p) => ease(p / 0.08) * (1 - ease((p - 0.96) / 0.04) * 0),
  act(p) {
    V.rig.visible = true;
    V.poseStill(X.crash, 4);
    V.drawCar(4);
    V.tint(0.09 * (1 - ease(p / 0.06)));
    V.shadow(0.26 * (1 - ease(p / 0.06)));
    return { az: 74, el: 8, dist: R * 2.15, look: [X.crash - 1040, 0, 700], sx: 0, sy: -0.01 };
  },
});
add('credit', 110, {
  chapter: 'Claude Code と書いた CAE ツール', lines: ['ソリッドの静解析', '疲労', '感度解析', 'rest'], dark: (p) => 1 - ease(p / 0.14),
  act(p) {
    V.rig.visible = true;
    V.poseStill(X.crash, 4);
    V.drawCar(4);
    V.tint(0.09 * ease(p / 0.14));
    V.shadow(0.26 * ease(p / 0.14));
    return V.mixShot({ az: 74, el: 8, dist: R * 2.15, look: [X.crash - 1040, 0, 700], sx: 0, sy: -0.01 }, { az: 124, el: 15, dist: R * 3.35, look: lookAt(X.crash), sx: 0.26, sy: -0.02, my: 0.3 }, ease(p / 0.25));
  },
});
add('ask', 110, {
  chapter: '',
  act(p) {
    V.rig.visible = true;
    V.poseStill(X.crash, 4);
    V.drawCar(4);
    return { az: 124 + p * 20, el: 15, dist: R * 3.35, look: lookAt(X.crash), sx: 0.24, sy: -0.02, my: 0.3 };
  },
});

// each test starts where the last one ended
function recIn(r, t) {
  const n = r.t.length, u = clamp((t - r.t[0]) / (last(r.t) - r.t[0])) * (n - 1), i = Math.min(n - 2, Math.floor(u)), f = u - i;
  const g = (a) => lerp(a[i], a[i + 1], f);
  return { x: g(r.x), r: g(r.r), v: g(r.v), table: r.table ? g(r.table) : 0 };
}
{
  let x = V ? V.carX(T_END) : 0;
  X.chain1 = x;
  X.chain3 = x;
  x += last(RUN_L.x);
  X.chain4 = x;
  X.step = x - RUN_S.x[0];
  x = X.step + last(RUN_S.x);
  X.brake = x - RUN_B.x[0];
  x = X.brake + last(RUN_B.x);
  X.dlc = x - RUN_D.x[0];
  x = X.dlc + last(RUN_D.x);
  X.tilt = x;
  X.heat = x;
  X.crash = x;
}

const SECTION_MODE = !!document.querySelector('[data-scene]');
if (!SECTION_MODE) {
// ---------- the words and the fixed things
const says = $$('[data-beat]').map((el) => ({ el, beat: el.dataset.beat, a: +el.dataset.a, b: +el.dataset.b, foot: el.classList.contains('foot') }));
const h1Lines = $$('#h1 em'), h1 = $('#h1'), hsub = $('#hsub'), cue = $('#cue');
const vnum = $('#vnum'), vtext = $('#vtext'), vticks = $$('#vticks i');
const linesBox = $('#lines'), linesNum = $('#lines b'), linesNow = $('#lines i');
const films = $('#films'), f1 = $('#f1'), f2 = $('#f2');
const credit = $('#credit'), askBox = $('#ask');
const sectB = $('#sect b'), sectT = $('#sect span'), sect = $('#sect'), rail = $('#rail');
$('#cTotal').textContent = '';
for (const c of data.solvers.cards) {
  const li = document.createElement('li');
  const a = document.createElement('span'); a.textContent = c.label.replace(' *', '');
  const b = document.createElement('b'); b.textContent = fmt(c.lines);
  li.append(a, b); $('#cList').append(li);
}
{
  const S = data.solvers, rest = S.total - S.cards.reduce((a, b) => a + b.lines, 0);
  $('#cFoot').textContent = `hiraku/solvers と hiraku/cfd の ${S.files} ファイル（コメントと空行を含む。ツールの共通部 ${fmt(rest)} 行も合計に含む）。数値計算は NumPy・SciPy ほか、骨組みと固有値の一部は PyNite を使用。流体の精度は確かめていません。`;
}
function setCount(el, n) {
  const k = fmt(n);
  if (el.dataset.k === k) return;
  el.dataset.k = k;
  el.textContent = k;
  const s = document.createElement('small'); s.textContent = '行'; el.append(s);
}

// lengths in vh; the page is as long as the story
const SCROLL = 0.56;   // how much scroll each part takes; the motion and the words stay in step at any value
let total = 0;
for (const b of beats) { b.len *= SCROLL; b.start = total; total += b.len; }
stageEl.style.height = `calc(${total}vh + 100vh)`;
const beatById = new Map(beats.map((b) => [b.id, b]));
const chapters = beats.filter((b) => b.chapter !== undefined);
const ticks = chapters.map((b) => {
  const a = document.createElement('a'); a.title = b.chapter || 'デモへ';
  a.addEventListener('click', () => window.scrollTo({ top: (b.start + 1) / 100 * window.innerHeight, behavior: 'smooth' }));
  rail.append(a); return a;
});
// how many lines are counted when each beat is done
const REST = data.solvers.total - data.solvers.cards.reduce((a, b) => a + b.lines, 0);
const lineSum = (b) => (b.lines || []).reduce((a, n) => a + (n === 'rest' ? REST : CARDS.get(n) || 0), 0);
{ let run = 0; for (const b of beats) { b.linesBefore = run; run += lineSum(b); b.linesAfter = run; } }

// first frames of the camera's blend: where the last beat left it
const NEEDS_BLEND = 0.18;

const introStart = performance.now();
const reduce = CLIP || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let intro = 0, vh = window.innerHeight, shownY = window.scrollY, lastKey = '';
function frame(now) {
  const y = window.scrollY;
  shownY += (y - shownY) * (reduce ? 1 : 0.16);
  if (Math.abs(y - shownY) < 0.3) shownY = y;
  intro = window.LP_INTRO ?? (reduce ? 1 : clamp((now - introStart) / 2600));
  const key = `${shownY.toFixed(1)}|${intro.toFixed(3)}|${window.innerWidth}x${window.innerHeight}`;
  if (key !== lastKey) { lastKey = key; draw(shownY); }
  requestAnimationFrame(frame);
}
function locate(y) {
  const at = y / vh * 100;
  let b = beats[0];
  for (const x of beats) if (at >= x.start) b = x;
  return { b, p: clamp((at - b.start) / b.len) };
}
const ctx = { intro: 0, wide: true };
const endShots = new Map();
function draw(y) {
  vh = window.innerHeight;
  const { b, p } = locate(y);
  ctx.intro = intro; ctx.wide = window.innerWidth > 900;

  // the first screen
  const hf = b.id === 'hero' ? 1 - ease((p - 0.28) / 0.5) : 0;
  h1Lines.forEach((el, i) => { el.style.transform = `translateY(${(1 - ease((intro - 0.5 - i * 0.07) / 0.3)) * 112}%)`; });
  h1.style.opacity = hf; h1.style.visibility = hf > 0 ? 'visible' : 'hidden';
  for (const el of [hsub, cue]) el.style.opacity = hf * ease((intro - 0.78) / 0.2);

  // the words
  for (const s of says) {
    const o = s.beat === b.id ? band(p, s.a, s.b, s.b > 1 ? 0.03 : 0.035) : 0;
    s.el.style.opacity = o;
    if (!s.foot) s.el.style.transform = o > 0 ? `translateY(${(1 - o) * 18}px)` : '';
  }

  // the numbers
  const o = b.hud ? b.hud(p) : null;
  if (o) hud(o, band(p, 0.0, 1.2, 0.05));
  else hudEl.box.style.opacity = 0;

  // which version
  const chain = ['chain1', 'chain2', 'chain3', 'chain4', 'team'].includes(b.id);
  vnum.style.opacity = chain ? ((b.id === 'chain1' ? ease(p / 0.1) : 1) * (b.id === 'team' ? 1 - ease((p - 0.9) / 0.1) : 1) * (b.id === 'chain4' ? 1 : 1)) : 0;
  if (chain) {
    const v = b.ver ? b.ver(p) : 0;
    setText(vtext, `v${v + 1}`);
    vticks.forEach((t, i) => t.classList.toggle('on', i <= v));
  }

  // the count of what was written
  const inLap = beats.indexOf(b) >= beats.indexOf(beatById.get('step')) && beats.indexOf(b) <= beats.indexOf(beatById.get('film'));
  const k = lineSum(b) ? ease(p / 0.7) : 0;
  const count = b.linesBefore + (b.linesAfter - b.linesBefore) * k;
  linesBox.style.opacity = inLap ? 1 : 0;
  if (inLap) {
    setCount(linesNum, count);
    setText(linesNow, b.lines ? `+ ${b.lines.filter((n) => n !== 'rest').join('、')}` : '');
  }

  // dark for the films
  const dark = b.dark ? b.dark(p) : 0;
  const mix = (a, c, x) => Math.round(a + (c - a) * x);
  const bg = `rgb(${mix(244, 20, dark)},${mix(241, 19, dark)},${mix(234, 17, dark)})`;
  if (V) {   // without the 3D the page keeps its still picture
    document.body.style.background = bg;
    document.documentElement.style.background = bg;
  }
  document.body.dataset.tone = dark > 0.5 ? 'dark' : 'paper';

  // films
  const isFilm = b.id === 'film';
  const fo = isFilm ? band(p, 0.07, 0.95, 0.05) : 0;
  films.style.opacity = fo;
  const f2o = isFilm ? ease((p - 0.5) / 0.06) : 0;
  f1.style.opacity = 1; f2.style.opacity = f2o;
  for (const [v, want] of [[f1, fo > 0.01 && f2o < 1], [f2, f2o > 0.01 && fo > 0.01]]) {
    if (want && v.paused) v.play().catch(() => {});
    if (!want && !v.paused) v.pause();
  }

  // credit and the way out
  const co = b.id === 'credit' ? band(p, 0.16, 1.1, 0.08) : 0;
  credit.style.opacity = co;
  if (co > 0) setCount($('#cTotal'), data.solvers.total * ease((p - 0.16) / 0.3));
  const ao = b.id === 'ask' ? ease(p / 0.12) : 0;
  askBox.style.opacity = ao; askBox.style.visibility = ao > 0.01 ? 'visible' : 'hidden';

  // where we are
  let ch = -1;
  chapters.forEach((c, i) => { if (y / vh * 100 + 40 >= c.start) ch = i; });
  ticks.forEach((t, i) => t.classList.toggle('on', i === ch));
  const named = ch >= 0 && chapters[ch].chapter;
  sect.style.opacity = named ? 1 : 0;
  if (named) { setText(sectB, String(ch + 1).padStart(2, '0')); setText(sectT, chapters[ch].chapter); }

  // the 3D
  if (!V) return;
  V.reset();
  const cur = b.act(p, ctx);
  let shot = cur;
  const i = beats.indexOf(b);
  if (i > 0 && p < NEEDS_BLEND && b.id !== 'check' && b.id !== 'story') {
    const prev = endShots.get(beats[i - 1].id);
    if (prev) shot = V.mixShot(prev, cur, ease(p / NEEDS_BLEND));
  }
  V.finish(shot);
}

function onResize() { if (V) V.resize(); vh = window.innerHeight; lastKey = ''; }
window.addEventListener('resize', onResize);
window.addEventListener('load', onResize);
if (V) {
  // where each part ends, for the camera to start from in the next one
  for (const b of beats) {
    V.reset();
    endShots.set(b.id, b.act(1, { intro: 1, wide: true }));
  }
  V.reset();
}
// the page plays by itself; touching the scroll takes back control
const AUTO_SECONDS = 130;
const autoBtn = $('#auto');
let autoOn = false, autoLast = 0, autoY = 0;
function autoEnd() { const b = beatById.get('ask'); return (b.start + b.len * 0.5) / 100 * window.innerHeight; }
function setAuto(on) {
  autoOn = on;
  autoBtn.dataset.on = on ? '1' : '0';
  autoBtn.textContent = on ? '■ 止める' : window.innerWidth <= 900 ? '▶ 再生' : '▶ 自動で見る';
  if (on) {
    if (window.scrollY >= autoEnd() - 2) window.scrollTo(0, 0);
    autoY = window.scrollY; autoLast = performance.now();
    requestAnimationFrame(autoStep);
  }
}
function autoStep(now) {
  if (!autoOn) return;
  const dt = Math.min(60, now - autoLast); autoLast = now;
  autoY += (total / 100 * window.innerHeight) / AUTO_SECONDS / 1000 * dt;
  if (autoY >= autoEnd()) { window.scrollTo(0, autoEnd()); setAuto(false); return; }
  window.scrollTo(0, autoY);
  requestAnimationFrame(autoStep);
}
autoBtn.addEventListener('click', () => setAuto(!autoOn));
setAuto(false);
window.addEventListener('resize', () => { if (!autoOn) setAuto(false); });
for (const ev of ['wheel', 'touchstart', 'keydown']) window.addEventListener(ev, () => { if (autoOn) setAuto(false); }, { passive: true });
requestAnimationFrame(frame);
window.LP = { beats, go: (id, p = 0) => { const b = beatById.get(id); const y = (b.start + b.len * p) / 100 * window.innerHeight; window.scrollTo(0, y); return y; } };
} else {
  // ---------- a plain page: each section plays its part of the story by the clock while it is on the screen
  // [beat, p from, p to, seconds, 'intro' for the opening build]
  const SEQ = {
    hero: [['hero', 0, 0, 2.9, 'intro'], ['story', 0, 0.62, 6.5], ['story', 0.62, 0.62, 2.5]],
    why: [['story', 0.6, 1, 5.5], ['story', 1, 1, 3]],
    team: [['team', 0, 1, 9]],
    check: [['check', 0.3, 0.98, 6], ['check', 0.98, 0.98, 4]],
    revise: [['chain1', 0.02, 1, 7.5], ['chain2', 0, 1, 4.5], ['chain3', 0, 1, 8], ['chain4', 0, 1, 7], ['chain4', 1, 1, 1.5]],
    tests: [['step', 0, 0.95, 5], ['brake', 0, 1, 14], ['dlc', 0, 1, 6.5], ['tilt', 0, 0.9, 9], ['heat', 0, 1, 6.5], ['crash', 0.02, 0.9, 7], ['shake', 0.05, 0.95, 4], ['build', 0.02, 1, 8.5]],
    ask: [['ask', 0, 1, 12]],
  };
  const beatById = new Map(beats.map((x) => [x.id, x]));
  const sections = $$('[data-scene]').map((el) => {
    const seq = SEQ[el.dataset.scene].map(([id, a, z, sec, mode]) => ({ beat: beatById.get(id), a, z, sec, mode }));
    let at = 0; for (const g of seq) { g.start = at; at += g.sec; }
    return { el, seq, total: at, slot: el.querySelector('.hudslot') };
  });
  const canvasEl = $('#gl'), marksEl = $('#marks');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = { intro: 1, wide: true };
  let active = null, since = 0, offset = 0, lastShot = null, fromShot = null, switchedAt = 0, lastDraw = 0;
  const mark = (sel, on, cls = 'on') => { for (const el of $$(sel)) el.classList.toggle(cls, on(el)); };
  function whichSection() {
    const mid = window.innerHeight * 0.5;
    for (const s of sections) { const r = s.el.getBoundingClientRect(); if (r.top <= mid && r.bottom >= mid) return s; }
    return null;
  }
  function jump(s, beatId) {
    const g = s.seq.find((x) => x.beat.id === beatId);
    if (!g) return;
    since = performance.now(); offset = g.start;
  }
  for (const s of sections) {
    for (const el of s.el.querySelectorAll('[data-go]')) el.addEventListener('click', () => { if (active !== s) { active = s; } jump(s, el.dataset.go); });
  }
  // The part of the screen the section's words leave free. Wide (the camera's own rule): the room right of the panel,
  // measured in screen heights so that a squarer screen (an iPad held sideways) stands the camera back as much as it
  // needs; 0.93 is that room on a 1440 x 900 screen, where the shots were made. Tall: the room below the panel.
  const ROOM_WIDE = 0.93, ROOM_TALL = 0.6, HEADER = 60;
  function freeRoom(sec) {
    const Wv = window.innerWidth, Hv = window.innerHeight, r = sec.el.querySelector('.panel')?.getBoundingClientRect();
    const seen = r && r.bottom > HEADER && r.top < Hv;
    if (Wv / Hv > 1.15) {
      const left = seen ? Math.max(0, r.right) : 0, free = Math.max(160, Wv - left);
      return { sx: (left + free / 2) / Wv - 0.5, my: 0.2, k: clamp(ROOM_WIDE / (free / Hv), 1, 1.8) };
    }
    // a phone: the words fill most of the screen, so the camera stands back only a little (or the car gets too small)
    const top = seen ? clamp(r.bottom, HEADER, Hv - 180) : HEADER, free = Hv - top;
    return { sx: 0.2, my: (top + free / 2) / Hv - 0.5, k: clamp(ROOM_TALL / (free / Hv), 1, Wv < 600 ? 1.25 : 1.8) };
  }
  // The words under a section's text change while its beats play: a build step's caption runs from one line to four
  // (cut there; the four corner groups list ten parts each), and the friction circles come and go with the tabs.
  // The slot grew and shrank with them, so everything below the section, the dark film band too, shook up and down.
  // The slot keeps the tallest the words get in its section instead: measured once on a hidden copy of the box, one
  // measure per different text (every digit has one width), and again when the width changes.
  function holdSlot(sec) {
    const w = sec.slot.clientWidth;
    if (!w || sec.slotW === w) return;
    sec.slotW = w;
    const outs = [];
    for (const g of sec.seq) {
      if (!g.beat.hud) continue;
      for (let i = 0; i <= 240; i++) { const o = g.beat.hud(g.mode === 'intro' ? 0 : lerp(g.a, g.z, i / 240)); if (o) outs.push(o); }
    }
    const withFc = outs.find((o) => o.fc);
    if (withFc && !fcParts) { drawFc(withFc.fc); drawFc(null); }   // the circles' drawing is made on first use; make it before copying
    const pr = hudEl.box.cloneNode(true);
    Object.assign(pr.style, { position: 'absolute', left: '-10000px', top: '0', width: `${w}px`, visibility: 'hidden', transition: 'none' });
    sec.slot.append(pr);
    const q = (sel) => pr.querySelector(sel);
    const big = q('#hBig span'), cap = q('#hCap span'), hand = q('#hHand'), cae = q('#hCae'), state = q('#hState'), fc = q('#hFc'), note = fc && fc.querySelector('p');
    const seen = new Set();
    let tallest = 0;
    for (const o of outs) {
      const key = JSON.stringify([o.big, o.unit, o.cap, o.hand, o.cae, o.state, !!o.fc, o.fc?.note]).replace(/\d/g, '0');
      if (seen.has(key)) continue;
      seen.add(key);
      setBig(big, o.big ?? '', o.unit ?? ''); big.style.display = o.big ? '' : 'none';
      cap.textContent = o.cap ?? ''; cap.style.display = o.cap ? '' : 'none';
      hand.textContent = o.hand ? `手計算 ${o.hand}` : ''; cae.textContent = o.cae ? `解析 ${o.cae}` : ''; state.textContent = o.state ?? '';
      if (fc) fc.style.display = o.fc ? '' : 'none';
      if (note) note.textContent = o.fc?.note ?? '';
      tallest = Math.max(tallest, pr.offsetHeight);
    }
    pr.remove();
    sec.slot.style.minHeight = `${Math.ceil(tallest)}px`;
  }
  window.addEventListener('resize', () => { for (const s of sections) s.slotW = 0; });
  function tick(now) {
    requestAnimationFrame(tick);
    const s = whichSection();
    if (s !== active) {
      active = s; since = now; offset = 0; fromShot = lastShot; switchedAt = now;
      if (s && s.slot) s.slot.append(hudEl.box);
    }
    const show = !!(V && active);
    canvasEl.style.visibility = show ? 'visible' : 'hidden';
    marksEl.style.visibility = show ? 'visible' : 'hidden';
    if (!active) return;
    if (active.slot) holdSlot(active);
    let t = reduceMotion ? active.total * 0.7 : ((now - since) / 1000 + offset) % active.total;
    const g = active.seq.find((x) => t >= x.start && t < x.start + x.sec) || active.seq[active.seq.length - 1];
    if (g.beat.id !== 'brake' && now - lastDraw < 30) return;   // about 30 frames a second is enough for the rest of the page
    lastDraw = now;
    const k = clamp((t - g.start) / g.sec);
    const p = g.mode === 'intro' ? 0 : lerp(g.a, g.z, k);
    ctx.intro = g.mode === 'intro' ? k : 1;
    ctx.wide = window.innerWidth > 900;
    const b = g.beat;
    // what is on now, for the lists beside the car
    mark(`[data-scene="${active.el.dataset.scene}"] [data-go]`, (el) => el.dataset.go === b.id);
    if (b.ver) { const v = b.ver(p); mark(`[data-scene="${active.el.dataset.scene}"] [data-ver]`, (el) => +el.dataset.ver === v, 'now'); }
    const o = b.hud ? b.hud(p) : null;
    if (o && active.slot) hud(o, 1); else hudEl.box.style.opacity = 0;
    if (!V) return;
    V.reset();
    let shot = b.act(p, ctx);
    // the words are on the left, so the brake run is seen from the other side: the car drives to the right, toward its stop line
    if (b.id === 'brake') {
      const w = window.innerWidth / window.innerHeight > 1.15;   // wide: room on the right for the stop line; narrow: the car in the middle
      shot = { ...shot, az: shot.az - 180, dist: shot.dist * (w ? 2 : 1), look: [shot.look[0] - 1300 + (w ? 900 : -1000), shot.look[1], shot.look[2]], sx: w ? 0.08 : shot.sx };
    }
    // the words sit on the left: the car stands in the room right of them (on a tall screen, below them),
    // and the camera stands back when that room is small, so the words never cover much of the car
    const room = freeRoom(active);
    shot = { ...shot, dist: shot.dist * room.k, sx: room.sx + (Math.min(0.24, (shot.sx ?? 0) + 0.12) - 0.2), sy: -0.04, my: room.my };
    if (fromShot && now - switchedAt < 900) shot = V.mixShot(fromShot, shot, ease((now - switchedAt) / 900));
    lastShot = shot;
    V.finish(shot);
  }
  window.addEventListener('resize', () => { if (V) V.resize(); });
  // the list of the tools, and films that play only while they are seen
  const totalEl = $('#total'), listEl = $('#solvers'), noteEl = $('#tnote');
  if (totalEl && listEl) {
    const S = data.solvers, rest = S.total - S.cards.reduce((x, c) => x + c.lines, 0);
    totalEl.textContent = fmt(S.total);
    const u = document.createElement('small'); u.textContent = '行'; totalEl.append(u);
    if (noteEl) noteEl.textContent = `解析ツールの ${S.files} ファイルの行数（コメントと空行を含む。共通部 ${fmt(rest)} 行も合計に含む）。数値計算には NumPy・SciPy ほか、骨組みと固有値の一部に PyNite を使っています。`;
    for (const c of S.cards) {
      const li = document.createElement('li');
      const x = document.createElement('span'); x.textContent = c.label.replace(' *', '');
      const y = document.createElement('span'); y.textContent = `${fmt(c.lines)} 行`;
      li.append(x, y); listEl.append(li);
    }
  }
  const watch = new IntersectionObserver((es) => { for (const e of es) { if (e.isIntersecting && !reduceMotion) e.target.play().catch(() => {}); else e.target.pause(); } }, { threshold: 0.2 });
  for (const v of $$('video')) watch.observe(v);
  window.LP = { sections: () => sections.map((x) => x.el.dataset.scene) };
  requestAnimationFrame(tick);
  for (const a of $$('[data-link]')) if (!a.href) a.style.opacity = '.5';
}
window.READY = true;
