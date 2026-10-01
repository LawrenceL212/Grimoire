// catalogue.js: the turntable review page for every registered asset.
//
// Grid: ONE shared offscreen WebGL renderer draws each visible card into that card's own 2D canvas,
// round-robin inside a fixed per-frame time budget, so the page stays fast however many assets exist
// (hidden or off-screen cards cost nothing; with many visible cards each turns at a lower rate).
// Close-up: a fresh canvas + createStage (orbit, zoom) for every open, disposed on close.
import * as THREE from 'three';
import { list, make, measure, check, get } from './index.js';
import { theme, DEFAULTS, get as tget, PRESETS, applyPreset, onThemeChange } from '../engine/theme.js';
import { createStage } from '../engine/renderer.js';
import { mountTweakPanel } from '../engine/tweak-panel.js';
import { setOutlines, setToon, toonOwn } from '../engine/kit.js';
import { FLOOR_KINDS, tileField, contactShadow } from './materials.js';
import { CORNERS } from './sectors/common.js';
import { buildPeopleScene } from './people/sheet.js';
import { buildDroneScene } from './drone-scene.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORK_BUDGET_MS = 6;     // grid rendering per animation frame
const SPIN = 0.5;             // turntable speed, radians per second
const ELEVATION = 45;         // thumbnail camera, degrees above the floor (the plan's 45-degree view)
const YAW = 35;               // thumbnail camera, degrees round from the front
const FOV = 28;
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('en-GB');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- lights: the office scene's recipe, driven by the theme ----------
const skyDusk = new THREE.Color(0x5b5f9e), sunDusk = new THREE.Color(0x7c78c8);
function makeLights() {
  const group = new THREE.Group();
  const hemi = new THREE.HemisphereLight(0xffe0b5, 0x2a1d14, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const rim = new THREE.DirectionalLight(0x8f86ff, 1);
  // the office's room lamps, reduced to one warm lamp over the front of the asset (strong in Night lab)
  const lamp = new THREE.PointLight(0xffc98a, 1, 0, 2);
  group.add(hemi, sun, sun.target, rim, lamp);
  let lampR = 1;
  const sunDir = new THREE.Vector3(-0.5, 0.95, 0.55).normalize(), rimDir = new THREE.Vector3(0.45, 0.6, -0.9).normalize();
  function sync() {
    const d = tget('light.dusk');
    sun.color.set(tget('light.sunColor')).lerp(sunDusk, d * 0.55); sun.intensity = tget('light.sun') * (1 - 0.55 * d);
    hemi.color.set(0xffe0b5).lerp(skyDusk, d * 0.7); hemi.intensity = tget('light.hemi') * (1 - 0.35 * d);
    rim.color.set(tget('light.rimColor')); rim.intensity = tget('light.rim') * (0.6 + 0.8 * d);
    sun.shadow.radius = Math.max(0.01, tget('light.shadowSoft'));
    lamp.intensity = tget('light.lamps') * 1.5 * lampR * lampR;
  }
  function fit(center, radius) { // aim the lights and the shadow camera at a sphere
    sun.target.position.copy(center);
    sun.position.copy(center).addScaledVector(sunDir, radius * 3 + 2);
    rim.position.copy(center).addScaledVector(rimDir, radius * 3 + 2);
    lampR = radius * 1.6 + 0.8;
    lamp.position.set(center.x + radius * 0.4, center.y + radius * 1.1 + 0.6, center.z + radius * 1.2 + 0.5);
    lamp.intensity = tget('light.lamps') * 1.5 * lampR * lampR;
    const c = sun.shadow.camera;
    c.left = c.bottom = -radius * 1.25; c.right = c.top = radius * 1.25; c.near = 0.05; c.far = radius * 6 + 4;
    c.updateProjectionMatrix();
  }
  sync();
  return { group, sync, fit };
}

// ---------- the footprint plate: one cell per floor tile, so size reads at a glance ----------
const plateMat = toonOwn(tget('palette.tileB'));
const lineMat = new THREE.LineBasicMaterial({ color: tget('palette.gold'), transparent: true, opacity: 0.5 });
function syncPlate() { plateMat.color.set(tget('palette.tileB')); lineMat.color.set(tget('palette.gold')); }
function makePlate([w, d]) {
  const g = new THREE.Group();
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, d + 0.1), plateMat);
  slab.position.y = -0.026; slab.receiveShadow = true;
  const pts = [];
  const xs = new Set([-w / 2, w / 2]), zs = new Set([-d / 2, d / 2]);
  for (let x = -w / 2 + 1; x < w / 2 - 1e-6; x++) xs.add(x);
  for (let z = -d / 2 + 1; z < d / 2 - 1e-6; z++) zs.add(z);
  for (const x of xs) pts.push(x, 0.002, -d / 2, x, 0.002, d / 2);
  for (const z of zs) pts.push(-w / 2, 0.002, z, w / 2, 0.002, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.add(slab, new THREE.LineSegments(geo, lineMat));
  g.userData.catalogue = true;
  return g;
}

// A rotation-invariant framing sphere around the asset and its plate (so turning never clips).
function framing(meta, m) {
  const [w, d] = meta.tiles;
  let rH = Math.hypot(w / 2 + 0.05, d / 2 + 0.05), y0 = -0.05, y1 = 0.3;
  if (m && m.bounds) {
    const { min, max } = m.bounds;
    for (const x of [min[0], max[0]]) for (const z of [min[2], max[2]]) rH = Math.max(rH, Math.hypot(x, z));
    y0 = Math.min(y0, min[1]); y1 = Math.max(y1, max[1]);
  }
  const plateY = m && m.bounds ? Math.min(0, m.bounds.min[1]) : 0;
  return { center: new THREE.Vector3(0, (y0 + y1) / 2, 0), radius: Math.hypot(rH, (y1 - y0) / 2), plateY };
}

// ---------- page state ----------
const cells = [];               // { meta, card, canvas, ctx, obj, m, problems, frame, plate, visible, dirty }
let spinning = !reducedMotion;
let size = 256;                 // thumbnail resolution (px, square)
let thumbs = null;              // { renderer, scene, camera, lights, pivot } or null without WebGL
let glLost = false;

function initThumbs() {
  try {
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = tget('light.exposure');
    renderer.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glLost = true; summary(); });
    canvas.addEventListener('webglcontextrestored', () => { glLost = false; cells.forEach((c) => { c.dirty = true; }); summary(); });
    const scene = new THREE.Scene();
    const lights = makeLights();
    const pivot = new THREE.Group();
    scene.add(lights.group, pivot);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 400);
    thumbs = { renderer, scene, camera, lights, pivot };
  } catch (e) {
    console.warn('catalogue: no WebGL for thumbnails', e);
    thumbs = null;
  }
}

function placeThumbCamera(cam, f) {
  const el = THREE.MathUtils.degToRad(ELEVATION), yaw = THREE.MathUtils.degToRad(YAW);
  const dist = (f.radius / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.04;
  cam.position.set(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(dist).add(f.center);
  cam.near = Math.max(0.01, dist - f.radius * 1.5); cam.far = dist + f.radius * 1.5;
  cam.lookAt(f.center);
  cam.updateProjectionMatrix();
}

function draw(cell, angle) {
  const t = thumbs;
  if (!cell.obj) { cell.ctx.clearRect(0, 0, size, size); cell.dirty = false; return; }
  cell.plate.position.y = cell.frame.plateY;
  t.pivot.add(cell.obj, cell.plate);
  t.pivot.rotation.y = angle;
  placeThumbCamera(t.camera, cell.frame);
  t.lights.fit(cell.frame.center, cell.frame.radius);
  t.renderer.render(t.scene, t.camera);
  t.pivot.remove(cell.obj, cell.plate);
  cell.ctx.clearRect(0, 0, size, size);
  cell.ctx.drawImage(t.renderer.domElement, 0, 0, size, size);
  cell.dirty = false;
}

// ---------- GPU resources: free what a rebuild or a closed close-up no longer uses ----------
// Kit caches share geometry and materials between builds, so only resources that no live
// object still references are disposed (the rest are reused by the new builds).
const TEX_KEYS = ['map', 'emissiveMap', 'alphaMap', 'gradientMap', 'normalMap', 'roughnessMap'];
function resources(root, out = new Set()) {
  root?.traverse?.((o) => {
    if (o.geometry) out.add(o.geometry);
    for (const mt of [].concat(o.material || [])) {
      out.add(mt);
      for (const k of TEX_KEYS) if (mt[k]) out.add(mt[k]);
    }
  });
  return out;
}
function disposeUnused(oldRoots) {
  const old = new Set();
  for (const r of oldRoots) resources(r, old);
  if (!old.size) return 0;
  const live = new Set();
  for (const c of cells) { resources(c.obj, live); resources(c.plate, live); }
  if (cu) { resources(cu.obj, live); resources(cu.plate, live); }
  let n = 0;
  for (const x of old) if (!live.has(x) && typeof x.dispose === 'function') { x.dispose(); n++; }
  return n;
}

// ---------- building and measuring ----------
function buildCell(cell) {
  const { meta } = cell;
  try {
    cell.obj = make(meta.id, {});
    cell.m = measure(cell.obj);
    cell.problems = check(meta, cell.m);
    setToon(cell.obj, tget('toggles.toon'));
  } catch (e) {
    console.error(`catalogue: ${meta.id} failed to build`, e);
    cell.obj = null; cell.m = null;
    cell.problems = [`build failed: ${e && e.message || e}`];
  }
  cell.frame = framing(meta, cell.m);
  cell.plate ||= makePlate(meta.tiles);
  cell.dirty = true;
  label(cell);
}

function label(cell) {
  const { meta, m, card } = cell;
  const tris = m ? m.triangles - m.outlineTriangles : 0; // the budget excludes outline hulls (ruling P2-4)
  const ratio = m ? tris / meta.budget : 0;
  card.querySelector('[data-tris]').textContent = `${fmt(tris)} / ${fmt(meta.budget)}`;
  card.querySelector('[data-tris]').title = (m ? `${m.drawables} draw calls` : '') + (meta.budgetReason ? ` · budget raised: ${meta.budgetReason}` : '');
  card.querySelector('[data-outline]').textContent = m ? `+ ${fmt(m.outlineTriangles)}` : '—';
  const bar = card.querySelector('.bar');
  bar.className = 'bar' + (ratio > 1 ? ' over' : ratio > 0.8 ? ' warm' : '');
  bar.firstElementChild.style.width = `${Math.min(100, ratio * 100).toFixed(1)}%`;
  const b = m ? m.bbox : { w: 0, h: 0, d: 0 };
  card.querySelector('[data-foot]').textContent = `${meta.tiles[0]}×${meta.tiles[1]} tiles`;
  card.querySelector('[data-size]').textContent = `${b.w.toFixed(2)}×${b.d.toFixed(2)}×${b.h.toFixed(2)}`;
  card.querySelector('.problems').textContent = cell.problems.join(' · ');
  const warn = card.querySelector('.warn');
  warn.hidden = cell.problems.length === 0;
  warn.textContent = cell.problems.length === 1 ? '1 issue' : `${cell.problems.length} issues`;
  card.classList.toggle('bad', cell.problems.length > 0);
}

function makeCard(meta) {
  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.asset = meta.id;
  card.innerHTML = `
    <button class="open" type="button" aria-label="Open ${esc(meta.id)} close up"><canvas width="${size}" height="${size}"></canvas><span class="warn" hidden></span></button>
    <div class="meta">
      <h3>${esc(meta.id)}</h3>
      <div class="chips"><span class="chip cat">${esc(meta.category)}</span><span class="chip">${esc(meta.sector)}</span></div>
      <dl class="nums">
        <dt>Triangles</dt><dd data-tris></dd>
        <span class="bar"><i></i></span>
        <dt title="outline hull triangles: drawn, but outside the asset budget">Outline tris</dt><dd data-outline></dd>
        <dt>Footprint</dt><dd data-foot></dd>
        <dt title="width × depth × height, in tiles">Size</dt><dd data-size></dd>
      </dl>
      <p class="problems"></p>
    </div>`;
  const canvas = card.querySelector('canvas');
  const cell = { meta, card, canvas, ctx: canvas.getContext('2d'), obj: null, m: null, problems: [], frame: null, plate: null, visible: false, dirty: true };
  card.querySelector('.open').addEventListener('click', () => openCloseup(meta.id));
  return cell;
}

// ---------- filters and summary ----------
function applyFilters() {
  const cat = $('category').value, sec = $('sector').value, q = $('search').value.trim().toLowerCase();
  let shown = 0;
  for (const c of cells) {
    const hide = (cat && c.meta.category !== cat) || (sec && c.meta.sector !== sec) || (q && !c.meta.id.includes(q));
    c.card.hidden = !!hide;
    if (!hide) { shown++; c.dirty = true; }
  }
  $('empty').hidden = shown > 0;
  summary(shown);
}
function summary(shown = cells.filter((c) => !c.card.hidden).length) {
  const bad = cells.filter((c) => c.problems.length).length;
  const cats = new Set(cells.map((c) => c.meta.category)).size;
  const parts = [`<b>${cells.length}</b> assets in ${cats} ${cats === 1 ? 'category' : 'categories'}`];
  if (shown !== cells.length) parts.push(`${shown} shown`);
  parts.push(bad ? `<span class="attn">${bad} need${bad === 1 ? 's' : ''} attention</span>` : 'all within budget and footprint');
  if (!thumbs) parts.push('<span class="attn">3D previews unavailable (no WebGL)</span>');
  else if (glLost) parts.push('<span class="attn">3D previews paused (graphics context lost)</span>');
  $('summary').innerHTML = parts.join(' · ');
}
function fillSelect(sel, values) {
  for (const v of values) { const o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o); }
}

// ---------- the grid loop ----------
const work = [], gaps = [], counts = [];
let lastNow = 0, rr = 0;
const keep = (arr, v) => { arr.push(v); if (arr.length > 240) arr.shift(); };
function loop(now) {
  requestAnimationFrame(loop);
  const t0 = performance.now();
  let rendered = 0;
  if (thumbs && !glLost) {
    const vis = cells.filter((c) => c.visible && !c.card.hidden);
    const angle = spinning ? (now / 1000) * SPIN : 0;
    for (const c of vis) {
      if (!c.dirty) continue;
      draw(c, angle); rendered++;
      if (performance.now() - t0 > WORK_BUDGET_MS) break;
    }
    if (spinning && vis.length) {
      for (let k = 0; k < vis.length && performance.now() - t0 < WORK_BUDGET_MS; k++) {
        const c = vis[rr++ % vis.length];
        if (c.drawnAt === now) continue;
        c.drawnAt = now;
        draw(c, angle); rendered++;
      }
    }
  }
  keep(work, performance.now() - t0);
  if (lastNow) keep(gaps, now - lastNow);
  keep(counts, rendered);
  lastNow = now;
}
const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
function stats() {
  const r = (v) => Math.round(v * 100) / 100;
  return {
    frames: work.length,
    workP50: r(pct(work, 0.5)), workP95: r(pct(work, 0.95)), workMax: r(Math.max(0, ...work)),
    frameGapP50: r(pct(gaps, 0.5)), frameGapP95: r(pct(gaps, 0.95)),
    renderedPerFrame: r(counts.reduce((a, b) => a + b, 0) / Math.max(1, counts.length)),
    visible: cells.filter((c) => c.visible && !c.card.hidden).length, total: cells.length,
  };
}
function showPerf() {
  const s = stats();
  $('perf').textContent = `grid ${s.workP50.toFixed(1)} ms/frame (p95 ${s.workP95.toFixed(1)}) · ${s.visible} of ${s.total} in view`;
}

// ---------- close-up ----------
let cu = null;
const dlg = $('closeup');
function teardown() {
  if (!cu) return;
  cu.ro.disconnect();
  cu.obj?.traverse?.((o) => { if (o.isInstancedMesh) o.dispose(); });
  cu.people?.dispose();
  cu.stage.dispose();
  cu.canvas.remove();
  const gone = [cu.obj, cu.plate];
  cu = null;
  disposeUnused(gone);
  window.__catalogue.closeup = null;
}
function openCloseup(id) {
  teardown();
  const meta = get(id);
  if (!meta) return;
  if (!dlg.open) dlg.showModal();
  const canvas = document.createElement('canvas');
  $('cu-stage').prepend(canvas);
  const stage = createStage(canvas, { reducedMotion });
  const lights = makeLights();
  const pivot = new THREE.Group();
  let obj = null, m = null, problems;
  try {
    obj = make(id, {});
    setToon(obj, tget('toggles.toon'));
    m = measure(obj);
    problems = check(meta, m);
  } catch (e) { problems = [`build failed: ${e && e.message || e}`]; }
  const f = framing(meta, m);
  const plate = makePlate(meta.tiles);
  plate.position.y = f.plateY;
  pivot.add(plate);
  if (obj) pivot.add(obj);
  stage.scene.add(lights.group, pivot);
  lights.fit(f.center, f.radius);
  // frameAll is tight: pull back a little so the asset has room to turn
  const fit = () => { stage.frameAll(); stage.focus(f.center, { zoom: tget('camera.zoom') * 0.8 }); };
  fit();
  // The stage only listens to window resizes; the dialog can lay out after the first frame
  // (or change size on rotation), so tell it and re-frame when the canvas itself changes size.
  let seen = `${canvas.clientWidth}x${canvas.clientHeight}`;
  const ro = new ResizeObserver(() => {
    const now = `${canvas.clientWidth}x${canvas.clientHeight}`;
    if (now === seen || !canvas.clientWidth) return;
    seen = now;
    dispatchEvent(new Event('resize'));
    fit();
  });
  ro.observe(canvas);
  cu = { mode: 'asset', id, canvas, stage, ro, plate, camera: stage.camera, frames: 0, lights, pivot, obj, meta, spin: false, anim: null };
  window.__catalogue.closeup = cu;
  stage.frame((dt, t) => {
    cu.frames++;
    if (cu.spin) pivot.rotation.y += dt * SPIN;
    if (cu.anim && obj) { try { meta.anims[cu.anim](obj, t); } catch (e) { console.error(e); cu.anim = null; } }
  });

  showSections('asset');
  $('cu-title').textContent = id;
  $('cu-chips').innerHTML = `<span class="chip cat">${esc(meta.category)}</span><span class="chip">${esc(meta.sector)}</span>`;
  const b = m ? m.bbox : { w: 0, h: 0, d: 0 };
  $('cu-nums').innerHTML = [
    ['Triangles', m ? `${fmt(m.triangles - m.outlineTriangles)} of ${fmt(meta.budget)}` : '—'],
    ['Outline hulls', m ? `+ ${fmt(m.outlineTriangles)} (not budgeted)` : '—'],
    ['Draw calls', m ? m.drawables : '—'],
    ['Footprint', `${meta.tiles[0]} × ${meta.tiles[1]} tiles`],
    ['Width × depth', `${b.w.toFixed(2)} × ${b.d.toFixed(2)}`],
    ['Height', b.h.toFixed(2)],
  ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('cu-problems').innerHTML = (problems.length
    ? problems.map((p) => `<p class="problems">${esc(p)}</p>`).join('')
    : '<p class="ok-note">Within budget, footprint and height; no broken geometry.</p>')
    + (meta.budgetReason ? `<p class="reason" data-reason>Budget raised above the ${esc(meta.category)} default: ${esc(meta.budgetReason)}</p>` : '');
  const anims = meta.anims ? Object.keys(meta.anims) : [];
  $('cu-anims-wrap').hidden = anims.length === 0;
  $('cu-anims').innerHTML = anims.map((a) => `<button class="btn" type="button" data-anim="${esc(a)}" aria-pressed="false">${esc(a)}</button>`).join('');
  $('cu-spin').setAttribute('aria-pressed', 'false');
}
function showSections(mode) {
  $('cu-asset').hidden = mode !== 'asset';
  $('cu-nav').hidden = mode !== 'asset';
  $('cu-patch').hidden = mode !== 'patch';
  $('cu-people').hidden = mode !== 'people';
  $('people').setAttribute('aria-pressed', String(mode === 'people'));
  if (mode !== 'asset') $('cu-anims-wrap').hidden = true;
  $('patch').setAttribute('aria-pressed', String(mode === 'patch'));
}

// ---------- floor patch: 6x6 tiles of one kind (or one row per kind) with props on them ----------
// 'sector:<name>' lays out that sector's corner (sectors/common.js CORNERS) on its own floor instead.
// The game frames its office so it fills 80% of the view height: 8.5 units half-height at the
// theme's field of view (the scene spike's framing), divided by the theme zoom.
const gameDistance = () => 8.5 / (Math.tan(THREE.MathUtils.degToRad(tget('camera.fov') / 2)) * 0.8);
const PATCH_KINDS = [...Object.keys(FLOOR_KINDS), 'mixed', ...Object.keys(CORNERS).map((s) => `sector:${s}`)];
const sectorOf = (kind) => (kind.startsWith('sector:') ? CORNERS[kind.slice(7)] : null);
// a furnished office corner: [id, x, z, turn, height] (height for things standing on the desk)
const PATCH_PROPS = [
  ...[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((x) => [x === 0.5 || x === 1.5 ? 'wall-window' : 'wall-segment', x, -2.9, 0]),
  ...[-1.5, -0.5, 0.5, 1.5, 2.5].map((z) => ['wall-segment', -2.9, z, Math.PI / 2]),
  ['bookshelf', -1.2, -2.35, 0], ['plant-tall', -2.3, -2.25, 0.4], ['filing-cabinet', 2.4, -2.3, 0],
  ['rug', -1.05, 0.4, Math.PI / 2],
  ['desk', 0.8, -1.35, 0], ['office-chair', 0.75, -0.55, Math.PI + 0.25],
  ['monitor', 0.75, -1.58, 0, 0.62], ['desk-lamp', 1.5, -1.55, -0.6, 0.62], ['mug', 0.1, -1.2, 0.4, 0.62], ['paper-stack', 1.25, -1.15, 0.2, 0.62],
  ['plant-small', -2.3, 1.7, 0], ['sofa', -1.9, 0.3, Math.PI / 2], ['coffee-table', -0.7, 0.35, Math.PI / 2],
];
function buildPatch(kind, shadows) {
  const g = new THREE.Group();
  g.name = 'floor-patch';
  const cells = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) cells.push([i - 2.5, j - 2.5]);
  const sector = sectorOf(kind);
  if (kind === 'mixed') Object.keys(FLOOR_KINDS).forEach((k, row) => g.add(tileField(k, cells.filter(([, z]) => z === row - 2.5), { seed: row + 1 })));
  else g.add(tileField(sector ? sector.floor : kind, cells));
  for (const [id, x, z, ry = 0, y = 0] of sector ? sector.props : PATCH_PROPS) {
    const o = make(id, {});
    o.position.set(x, y, z); o.rotation.y = ry;
    if (shadows) contactShadow(o);
    g.add(o);
  }
  setToon(g, tget('toggles.toon'));
  return g;
}
function setPatchDistance(which) {
  if (!cu || cu.mode !== 'patch') return;
  cu.dist = which;
  cu.stage.resetView();
  cu.stage.setDistance(gameDistance() * (which === 'close' ? 0.38 : 1), { x: 0, y: 0, z: 0 });
  for (const b of $('cu-patch').querySelectorAll('[data-dist]')) b.setAttribute('aria-pressed', String(b.dataset.dist === which));
}
function setPatch(kind, shadows = cu.shadows) {
  if (!cu || cu.mode !== 'patch') return;
  const old = cu.obj;
  if (old) { cu.pivot.remove(old); old.traverse((o) => { if (o.isInstancedMesh) o.dispose(); }); }
  cu.kind = kind; cu.shadows = shadows;
  cu.obj = buildPatch(kind, shadows);
  cu.pivot.add(cu.obj);
  if (old) disposeUnused([old]);
  $('patch-kind').value = kind;
  $('patch-shadows').setAttribute('aria-pressed', String(shadows));
  const sector = sectorOf(kind);
  $('cu-title').textContent = kind === 'mixed' ? 'Floor patch: all six' : sector ? `Sector corner: ${kind.slice(7)} (${sector.floor})` : `Floor patch: ${kind}`;
}
function openPatch(kind = 'wood') {
  teardown();
  if (!PATCH_KINDS.includes(kind)) kind = 'wood';
  if (!dlg.open) dlg.showModal();
  const canvas = document.createElement('canvas');
  $('cu-stage').prepend(canvas);
  const stage = createStage(canvas, { reducedMotion });
  const lights = makeLights();
  const pivot = new THREE.Group();
  stage.scene.add(lights.group, pivot);
  lights.fit(new THREE.Vector3(0, 0.4, 0), 4.6);
  let seen = `${canvas.clientWidth}x${canvas.clientHeight}`;
  const ro = new ResizeObserver(() => {
    const now = `${canvas.clientWidth}x${canvas.clientHeight}`;
    if (now === seen || !canvas.clientWidth) return;
    seen = now;
    dispatchEvent(new Event('resize'));
  });
  ro.observe(canvas);
  cu = { mode: 'patch', id: null, canvas, stage, ro, plate: null, camera: stage.camera, frames: 0, lights, pivot, obj: null, meta: null, spin: false, anim: null, kind, shadows: true, dist: 'game' };
  window.__catalogue.closeup = cu;
  stage.frame((dt) => { cu.frames++; if (cu.spin) pivot.rotation.y += dt * SPIN; });
  showSections('patch');
  $('cu-chips').innerHTML = '';
  $('cu-spin').setAttribute('aria-pressed', 'false');
  setPatch(kind, true);
  setPatchDistance('game');
}

// ---------- people: the character sheet and the office corner at work (people/sheet.js) ----------
function setPeopleDistance(which) {
  if (!cu || cu.mode !== 'people') return;
  cu.dist = which;
  cu.stage.resetView();
  const p = cu.people;
  const d = p.distance ?? (p.kind === 'sheet' ? p.radius * 3.4 : gameDistance());
  cu.stage.setDistance(d * (which === 'close' ? 0.42 : 1), p.center);
  for (const b of $('cu-people').querySelectorAll('[data-pdist]')) b.setAttribute('aria-pressed', String(b.dataset.pdist === which));
}
function setPeople(kind) {
  if (!cu || cu.mode !== 'people') return;
  const old = cu.obj;
  if (old) { cu.people.dispose(); cu.pivot.remove(old); }
  cu.people = kind.startsWith('drone') ? buildDroneScene(kind) : buildPeopleScene(kind);
  cu.people.kind = kind;
  cu.people.camera?.(cu.stage.camera);
  cu.obj = cu.people.group;
  setToon(cu.obj, tget('toggles.toon'));
  cu.pivot.add(cu.obj);
  cu.lights.fit(cu.people.center, cu.people.radius);
  if (old) disposeUnused([old]);
  $('people-kind').value = kind;
  $('cu-title').textContent = { sheet: 'People: character sheet', office: 'People: the office corner at work', 'drone-rooms': 'Drone: escort and scan three rooms', 'drone-faces': 'Drone: faces and ticket states', 'drone-personas': 'Drones: Sequel, Jay and Hex' }[kind] || kind;
  setPeopleDistance(cu.dist || 'game');
}
function openPeople(kind = 'sheet') {
  teardown();
  if (!dlg.open) dlg.showModal();
  const canvas = document.createElement('canvas');
  $('cu-stage').prepend(canvas);
  const stage = createStage(canvas, { reducedMotion });
  const lights = makeLights();
  const pivot = new THREE.Group();
  stage.scene.add(lights.group, pivot);
  let seen = `${canvas.clientWidth}x${canvas.clientHeight}`;
  const ro = new ResizeObserver(() => {
    const now = `${canvas.clientWidth}x${canvas.clientHeight}`;
    if (now === seen || !canvas.clientWidth) return;
    seen = now;
    dispatchEvent(new Event('resize'));
  });
  ro.observe(canvas);
  cu = { mode: 'people', id: null, canvas, stage, ro, plate: null, camera: stage.camera, frames: 0, lights, pivot, obj: null, meta: null, spin: false, anim: null, people: null, dist: 'game' };
  window.__catalogue.closeup = cu;
  stage.frame((dt, t) => { cu.frames++; if (cu.spin) pivot.rotation.y += dt * SPIN; cu.people?.update(dt, t); });
  showSections('people');
  $('cu-chips').innerHTML = '';
  $('cu-spin').setAttribute('aria-pressed', 'false');
  setPeople(kind);
}

function step(dir) {
  if (!cu || cu.mode !== 'asset') return;
  const vis = cells.filter((c) => !c.card.hidden);
  const i = vis.findIndex((c) => c.meta.id === cu.id);
  const next = vis[(i + dir + vis.length) % vis.length];
  if (next) openCloseup(next.meta.id);
}

// Which preset is the theme showing? (none after a hand tweak: the select then says "Custom")
function currentPreset() {
  const same = (want, have) => Object.keys(want).every((k) => (want[k] && typeof want[k] === 'object'
    ? have && typeof have[k] === 'object' && same(want[k], have[k]) : have && have[k] === want[k]));
  const merged = (name) => {
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    const walk = (into, from) => { for (const k of Object.keys(from)) { if (from[k] && typeof from[k] === 'object') walk(into[k] ??= {}, from[k]); else into[k] = from[k]; } };
    walk(out, PRESETS[name]);
    return out;
  };
  return Object.keys(PRESETS).find((n) => same(merged(n), theme)) || '';
}
function syncPresetSelect() { $('preset').value = currentPreset(); }

// ---------- wiring ----------
function applyStageCss() {
  const r = document.documentElement.style;
  r.setProperty('--stage-bg', tget('palette.bg'));
  r.setProperty('--stage-glow', tget('palette.bgGlow'));
}

function boot() {
  const assets = list();
  initThumbs();
  applyStageCss();
  setOutlines(tget('toggles.outlines'));
  $('preset').innerHTML = '<option value="" disabled>Custom (tweaked)</option>';
  fillSelect($('preset'), Object.keys(PRESETS));
  syncPresetSelect();
  fillSelect($('category'), [...new Set(assets.map((a) => a.category))].sort());
  fillSelect($('sector'), [...new Set(assets.map((a) => a.sector))].sort());

  const grid = $('grid');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const c = cells.find((x) => x.card === e.target);
      if (c) { c.visible = e.isIntersecting; if (c.visible) c.dirty = true; }
    }
  }, { rootMargin: '160px 0px' });
  for (const meta of assets) {
    const cell = makeCard(meta);
    cells.push(cell);
    grid.appendChild(cell.card);
    io.observe(cell.card);
    buildCell(cell);
  }

  // thumbnail resolution follows the card width
  const resize = () => {
    const w = cells.find((c) => !c.card.hidden)?.canvas.clientWidth || 240;
    const s = Math.max(128, Math.min(420, Math.round(w * Math.min(devicePixelRatio || 1, 2))));
    if (s === size) return;
    size = s;
    thumbs?.renderer.setSize(size, size, false);
    for (const c of cells) { c.canvas.width = c.canvas.height = size; c.dirty = true; }
  };
  new ResizeObserver(resize).observe(grid);
  resize();

  $('preset').addEventListener('change', (e) => applyPreset(e.target.value));
  for (const id of ['category', 'sector']) $(id).addEventListener('change', applyFilters);
  $('search').addEventListener('input', applyFilters);
  const spinBtn = $('spin');
  spinBtn.setAttribute('aria-pressed', String(spinning));
  spinBtn.addEventListener('click', () => {
    spinning = !spinning;
    spinBtn.setAttribute('aria-pressed', String(spinning));
    cells.forEach((c) => { c.dirty = true; });
  });

  onThemeChange((path) => {
    applyStageCss();
    syncPresetSelect();
    syncPlate();
    thumbs?.lights.sync();
    cu?.lights.sync();
    if (cu?.mode === 'patch' && (!path || path.startsWith('camera'))) setPatchDistance(cu.dist);
    if (cu?.mode === 'people' && (!path || path.startsWith('camera'))) setPeopleDistance(cu.dist);
    if (thumbs) thumbs.renderer.toneMappingExposure = tget('light.exposure');
    if (!path || path.startsWith('toggles')) {
      setOutlines(tget('toggles.outlines'));
      const on = tget('toggles.toon');
      cells.forEach((c) => c.obj && setToon(c.obj, on));
      if (cu?.obj) setToon(cu.obj, on);
    }
    if (!path) { const old = cells.map((c) => c.obj); cells.forEach(buildCell); disposeUnused(old); summary(); } // a preset or a reset: rebuild, in case a build reads the theme
    cells.forEach((c) => { c.dirty = true; });
  });

  // 'close' is dispatched as a task: by then a new close-up may already be open, so keep that one
  dlg.addEventListener('close', () => { if (!dlg.open) teardown(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('cu-close').addEventListener('click', () => dlg.close());
  $('cu-reset').addEventListener('click', () => { if (!cu) return; cu.pivot.rotation.y = 0; if (cu.mode === 'patch') setPatchDistance(cu.dist); else if (cu.mode === 'people') setPeopleDistance(cu.dist); else cu.stage.resetView(); });
  fillSelect($('patch-kind'), PATCH_KINDS);
  for (const o of $('patch-kind').options) {
    if (o.value === 'mixed') o.textContent = 'all six (one per row)';
    const sec = sectorOf(o.value);
    if (sec) o.textContent = `${o.value.slice(7)} corner (${sec.floor})`;
  }
  $('patch-kind').addEventListener('change', (e) => setPatch(e.target.value));
  $('patch-shadows').addEventListener('click', () => { if (cu?.mode === 'patch') setPatch(cu.kind, !cu.shadows); });
  $('cu-patch').addEventListener('click', (e) => { const b = e.target.closest('[data-dist]'); if (b) setPatchDistance(b.dataset.dist); });
  $('patch').addEventListener('click', () => openPatch(cu?.mode === 'patch' ? cu.kind : 'wood'));
  $('people').addEventListener('click', () => openPeople(cu?.mode === 'people' ? cu.people.kind : 'sheet'));
  $('drone').addEventListener('click', () => openPeople('drone-rooms'));
  $('people-kind').addEventListener('change', (e) => setPeople(e.target.value));
  $('cu-people').addEventListener('click', (e) => { const b = e.target.closest('[data-pdist]'); if (b) setPeopleDistance(b.dataset.pdist); });
  dlg.addEventListener('close', () => { if (!dlg.open) { $('patch').setAttribute('aria-pressed', 'false'); $('people').setAttribute('aria-pressed', 'false'); } });
  $('cu-spin').addEventListener('click', (e) => { if (!cu) return; cu.spin = !cu.spin; e.target.setAttribute('aria-pressed', String(cu.spin)); });
  $('cu-anims').addEventListener('click', (e) => {
    const b = e.target.closest('[data-anim]');
    if (!b || !cu) return;
    cu.anim = cu.anim === b.dataset.anim ? null : b.dataset.anim;
    for (const x of $('cu-anims').children) x.setAttribute('aria-pressed', String(x.dataset.anim === cu.anim));
  });
  $('cu-prev').addEventListener('click', () => step(-1));
  $('cu-next').addEventListener('click', () => step(1));
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  });

  mountTweakPanel($('tweak-root'));
  applyFilters();
  requestAnimationFrame(loop);
  setInterval(showPerf, 500);
  window.__catalogue.ready = true;
}

window.__catalogue = { ready: false, closeup: null, stats, open: (id) => openCloseup(id), patch: (kind) => openPatch(kind), people: (kind) => openPeople(kind), drone: (kind = 'drone-rooms') => openPeople(kind), close: () => dlg.close(),
  gpuMemory: () => thumbs && { ...thumbs.renderer.info.memory } };

// Test-only fixtures, loaded only when the URL asks: ?test-bad=1 (three broken assets), ?stress=N (N clones).
const params = new URLSearchParams(location.search);
if (params.has('test-bad') || params.has('stress')) {
  const fx = await import('./test-fixtures.js');
  if (params.has('test-bad')) { fx.registerBad(); fx.registerRaised(); }
  const n = Math.min(500, Number(params.get('stress')) || 0);
  if (n > 0) fx.registerStress(n);
}
boot();
