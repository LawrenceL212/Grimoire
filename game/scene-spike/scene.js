// scene.js: bootstrap, HUD, floating windows, tweak panel and the scripted story.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { settings as S, SCHEMA, PRESETS, DEFAULTS, get, set, save, resetSettings, applyPreset } from './settings.js';
import { updateTweens, killTweens, tween, wait, ease, setOutlines, setToon, lerp, canvasTex } from './kit.js';
import { buildWorld } from './world.js';
import { Person } from './people.js';
import { Drone } from './drone.js';
import { FX, Ticket } from './fx.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const narrowMQ = matchMedia('(max-width: 760px)');

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(S.camera.fov, 1, 0.5, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false;
controls.minPolarAngle = 0.05; controls.maxPolarAngle = 1.3;
controls.target.set(0, 0, -0.3);

const hemi = new THREE.HemisphereLight(0xffe0b5, 0x2a1d14, S.light.hemi);
scene.add(hemi);
const sun = new THREE.DirectionalLight(S.light.sunColor, S.light.sun);
sun.position.set(-9, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 11, bottom: -11, near: 1, far: 50 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
scene.add(sun);
// cool dusk rim light from behind: catches the tops of walls, heads and the drone (no shadows)
const rim = new THREE.DirectionalLight(0x8f86ff, 0.9);
rim.position.set(7, 9, -14);
scene.add(rim);

const world = buildWorld(scene, S);
const drone = new Drone(scene, S);
drone.camera = camera;
const fx = new FX(scene, S);

// ---------------- camera framing ----------------
let fitDist = 25;
// The code window covers the left edge on desktop, so the diorama is framed in the
// space to its right (a screen-space view offset), like TFWR's editor-beside-the-farm.
function computeFit() {
  const narrow = narrowMQ.matches;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const left = narrow ? 0 : Math.min(410, w * 0.34);
  const vh = Math.tan(THREE.MathUtils.degToRad(S.camera.fov / 2));
  const fracW = narrow ? 0.98 : (w - left - 24) / w, fracH = narrow ? 0.94 : 0.8;
  const fitW = (narrow ? 11.2 : 9.6) / (vh * camera.aspect * fracW), fitH = 8.5 / (vh * fracH);
  fitDist = Math.max(fitW, fitH);
  const shift = left / 2, down = narrow ? 0 : -h * 0.035;
  if (shift || down) camera.setViewOffset(w, h, -shift, down, w, h); else camera.clearViewOffset();
}
function placeCamera() {
  computeFit();
  const p = THREE.MathUtils.degToRad(S.camera.pitch), y = THREE.MathUtils.degToRad(S.camera.yaw);
  const dist = fitDist / S.camera.zoom;
  camera.fov = S.camera.fov;
  camera.position.set(Math.sin(p) * Math.sin(y) * dist, Math.cos(p) * dist, Math.sin(p) * Math.cos(y) * dist).add(controls.target);
  camera.updateProjectionMatrix();
  controls.minDistance = fitDist * 0.35; controls.maxDistance = fitDist * 2.2;
  controls.update();
  updateFog();
}
let userOrbiting = false;
controls.addEventListener('start', () => { userOrbiting = true; });
controls.addEventListener('end', () => { userOrbiting = false; save(); });
controls.addEventListener('change', () => {
  if (!userOrbiting) return;
  const off = camera.position.clone().sub(controls.target), d = off.length();
  S.camera.pitch = +THREE.MathUtils.radToDeg(Math.acos(off.y / d)).toFixed(1);
  S.camera.yaw = +THREE.MathUtils.radToDeg(Math.atan2(off.x, off.z)).toFixed(1);
  S.camera.zoom = +(fitDist / d).toFixed(2);
  syncPanel(['camera.pitch', 'camera.yaw', 'camera.zoom']);
});
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  placeCamera();
}
addEventListener('resize', resize);
narrowMQ.addEventListener('change', () => { resetWindowPositions(); resize(); });

// ---------------- apply settings (live) ----------------
const skyDusk = new THREE.Color(0x5b5f9e), sunDusk = new THREE.Color(0x7c78c8);
function updateFog() {
  if (S.toggles.fog) {
    const d = camera.position.distanceTo(controls.target);
    scene.fog = new THREE.Fog(S.palette.bg, d * 0.8, d * 1.55);
  } else scene.fog = null;
}
function applyLight(t = 0) {
  const d = THREE.MathUtils.clamp(S.light.dusk + Math.sin(t * 0.15) * 0.03, 0, 1);
  sun.color.set(S.light.sunColor).lerp(sunDusk, d * 0.55);
  sun.intensity = S.light.sun * (1 - 0.55 * d);
  hemi.color.set(0xffe0b5).lerp(skyDusk, d * 0.7);
  hemi.intensity = S.light.hemi * (1 - 0.35 * d);
  world.rooms.forEach((r) => { r.baseIntensity = 5 * (0.7 + 0.7 * d); });
  sun.shadow.radius = Math.max(0.01, S.light.shadowSoft);
  renderer.toneMappingExposure = S.light.exposure;
  rim.color.set(S.light.rimColor); rim.intensity = S.light.rim * (0.6 + 0.8 * d);
}
function applyCSS() {
  const r = document.documentElement.style, P = S.palette;
  r.setProperty('--ink', P.ink); r.setProperty('--paper', P.paper); r.setProperty('--text', P.text);
  r.setProperty('--gold', P.gold); r.setProperty('--danger', P.danger); r.setProperty('--ok', P.ok);
  r.setProperty('--bg', P.bg); r.setProperty('--bg-glow', P.bgGlow);
  r.setProperty('--hud-scale', S.ui.hudScale); r.setProperty('--code-opacity', S.ui.codeOpacity);
}
function applyGlow() {
  const on = S.toggles.glow;
  [...world.glows, drone.eyeGlow, drone.tipGlow, drone.cone, drone.spot, drone.trail].forEach((o) => { o.visible = on; });
}
let colorsDirty = false;
function applySettings(path = '') {
  if (!path || path.startsWith('palette')) { applyCSS(); colorsDirty = true; drone.goldMat.color.set(S.palette.gold); drone.goldMat.emissive.set(S.palette.gold); updateFog(); }
  if (!path || path.startsWith('shirts')) people.forEach((p) => p.shirtKey && p.setShirt(S.shirts[p.shirtKey]));
  if (!path || path.startsWith('camera')) placeCamera();
  if (!path || path.startsWith('light')) applyLight();
  if (!path || path.startsWith('world')) world.rebuildTiles();
  if (!path || path.startsWith('ui')) applyCSS();
  if (!path || path.startsWith('toggles')) { setOutlines(S.toggles.outlines); setToon(scene, S.toggles.toon); updateFog(); applyGlow(); }
}

// ---------------- HUD counters ----------------
const counters = {};
function counter(id, value, { bad = false, fmt = (v) => Math.round(v).toString(), quiet = false } = {}) {
  const el = $(id), b = el.querySelector('b');
  const c = counters[id] ??= { v: value, shown: value, fmt };
  c.fmt = fmt;
  const from = c.shown; c.v = value;
  if (quiet) { c.shown = value; b.textContent = fmt(value); return; }
  el.classList.remove('bump', 'bump-bad'); void el.offsetWidth;
  el.classList.add(bad ? 'bump-bad' : 'bump');
  setTimeout(() => el.classList.remove('bump', 'bump-bad'), 900);
  const t0 = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 700), e = 1 - Math.pow(1 - k, 3);
    c.shown = lerp(from, value, e); b.textContent = fmt(c.shown);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const money = (v) => '£' + Math.round(v).toLocaleString('en-GB');
const stars = (v) => v.toFixed(1);
function setXP(xp, quiet) {
  counter('c-xp', xp, { quiet });
  $('xpbar').style.width = `${xp % 100}%`;
  $('lvl').textContent = `Lv ${1 + Math.floor(xp / 100)}`;
}
function warn(on) { $('warn').classList.toggle('on', on); }

// ---------------- code window ----------------
const CODE = [
  "-- the drone runs this, line by line",
  "INSERT INTO bookings (room, guest, slot)",
  "  VALUES (1, 'Ada', '[09:00,10:00)');",
  "",
  "INSERT INTO bookings (room, guest, slot)",
  "  VALUES (1, 'Bea', '[09:00,10:00)');",
  "-- !! two guests, one room, same hour",
  "",
  "-- fix: move the newer guest to a free room",
  "UPDATE bookings SET room = (",
  "  SELECT r.id FROM rooms r",
  "   WHERE NOT EXISTS (",
  "     SELECT 1 FROM bookings b",
  "      WHERE b.room = r.id",
  "        AND b.slot && '[09:00,10:00)')",
  "   ORDER BY r.id LIMIT 1)",
  " WHERE guest = 'Bea';",
  "",
  "-- and make a clash impossible from now on",
  "ALTER TABLE bookings ADD EXCLUDE",
  "  USING gist (room WITH =, slot WITH &&);",
];
const KW = /('[^']*')|\b(INSERT|INTO|VALUES|UPDATE|SET|SELECT|FROM|WHERE|NOT|EXISTS|AND|ORDER|BY|LIMIT|ALTER|TABLE|ADD|EXCLUDE|USING|WITH|gist)\b|\b(\d+)\b/g;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlight(line) {
  const ci = line.indexOf('--');
  const code = ci >= 0 ? line.slice(0, ci) : line, com = ci >= 0 ? line.slice(ci) : '';
  let out = '', last = 0;
  code.replace(KW, (m, str, kw, num, idx) => {
    out += esc(code.slice(last, idx));
    out += str ? `<span class="s">${esc(str)}</span>` : kw ? `<span class="k">${kw}</span>` : `<span class="n">${num}</span>`;
    last = idx + m.length; return m;
  });
  out += esc(code.slice(last));
  if (com) out += `<span class="c${com.includes('!!') ? ' bad' : ''}">${esc(com)}</span>`;
  return out || ' ';
}
const codeEl = $('code');
codeEl.innerHTML = CODE.map((l) => `<li>${highlight(l)}</li>`).join('');
const lis = [...codeEl.children];
function hl(lines = [], cls = 'hl') {
  lis.forEach((li) => li.classList.remove('hl', 'err'));
  lines.forEach((n) => lis[n - 1]?.classList.add(cls));
  const first = lis[(lines[0] || 1) - 1];
  if (first && !narrowMQ.matches) {
    const top = first.offsetTop - codeEl.clientHeight / 2 + 20;
    codeEl.scrollTo({ top, behavior: 'smooth' });
  }
}
function markDone(lines) { lines.forEach((n) => lis[n - 1]?.classList.add('done')); }
function codeStatus(text, cls = '') {
  const s = $('code-status'); s.textContent = text; s.className = 'status ' + cls;
  $('runicon').classList.toggle('on', cls === 'run');
}

// ---------------- ticket window ----------------
function avatarCanvas(p) {
  const shirt = S.shirts[p.shirtKey] || '#888', hair = '#' + p.hairHex.toString(16).padStart(6, '0');
  const t = canvasTex(80, 80, (g) => {
    g.fillStyle = '#2a221c'; g.fillRect(0, 0, 80, 80);
    g.fillStyle = shirt; g.beginPath(); g.ellipse(40, 86, 30, 24, 0, 0, 7); g.fill();
    g.fillStyle = '#f2c9a2'; g.beginPath(); g.arc(40, 40, 22, 0, 7); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(40, 36, 23, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    g.fillStyle = '#1a1210'; g.beginPath(); g.arc(32, 43, 3, 0, 7); g.arc(48, 43, 3, 0, 7); g.fill();
    g.fillStyle = '#f09a86'; g.beginPath(); g.arc(27, 49, 3.5, 0, 7); g.arc(53, 49, 3.5, 0, 7); g.fill();
    g.strokeStyle = '#1a1210'; g.lineWidth = 2; g.beginPath(); g.arc(40, 48, 5, 0.2, Math.PI - 0.2); g.stroke();
  });
  return t.userData.canvas;
}
function showTicket({ n, who, person, text, chip, reply = '' }) {
  $('ticket-title').textContent = `ticket #${n}`;
  $('ticket-from').textContent = who;
  $('ticket-text').textContent = text;
  $('ticket-reply').textContent = reply;
  const chipEl = $('ticket-chip'); chipEl.textContent = chip; chipEl.className = 'chip ' + chip;
  const av = $('ticket-avatar'); av.innerHTML = '';
  if (person) av.appendChild(avatarCanvas(person));
  const w = $('win-ticket'); w.classList.remove('collapsed', 'arrive'); void w.offsetWidth; w.classList.add('arrive');
}
function quietInbox() {
  $('ticket-title').textContent = 'ticket #0'; $('ticket-from').textContent = 'Inbox';
  $('ticket-text').textContent = 'No open tickets. The office is quiet.'; $('ticket-reply').textContent = '';
  $('ticket-chip').textContent = 'none'; $('ticket-chip').className = 'chip'; $('ticket-avatar').innerHTML = '';
}

// ---------------- windows: drag + minimise ----------------
function resetWindowPositions() {
  const pos = { 'win-code': 'left:18px; top:96px; width:372px', 'win-ticket': 'left:18px; bottom:34px; width:372px', 'win-tweak': 'right:18px; top:96px; width:312px' };
  for (const [id, css] of Object.entries(pos)) $(id).setAttribute('style', css);
}
document.querySelectorAll('.win').forEach((win) => {
  const bar = win.querySelector('.titlebar');
  win.addEventListener('pointerdown', () => { document.querySelectorAll('.win').forEach((w) => { w.style.zIndex = w === win ? 5 : 1; }); });
  win.querySelector('.min:not(.close)')?.addEventListener('click', () => win.classList.toggle('collapsed'));
  bar.addEventListener('pointerdown', (e) => {
    if (narrowMQ.matches || e.target.closest('button')) return;
    const r = win.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    win.style.right = 'auto'; win.style.left = r.left + 'px'; win.style.top = r.top + 'px';
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      win.style.left = Math.max(-r.width + 80, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px';
      win.style.top = Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy)) + 'px';
    };
    const up = () => { bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up); };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
  });
});

// ---------------- tweak panel ----------------
const fieldsEl = $('tweak-fields');
const inputs = {};
const fmtVal = (v) => (typeof v === 'number' ? (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2)) : '');
for (const [group, rows] of SCHEMA) {
  const h = document.createElement('h4'); h.textContent = group; fieldsEl.appendChild(h);
  for (const [path, type, label, min, max, step] of rows) {
    const row = document.createElement('div'); row.className = 'tw';
    const id = 'tw-' + path.replace('.', '-');
    row.innerHTML = `<label for="${id}" title="${path}">${label}</label>`;
    const inp = document.createElement('input'); inp.id = id;
    const out = document.createElement('output');
    if (type === 'color') inp.type = 'color';
    else if (type === 'bool') inp.type = 'checkbox';
    else Object.assign(inp, { type: 'range', min, max, step });
    inp.addEventListener('input', () => {
      const v = type === 'bool' ? inp.checked : type === 'range' ? parseFloat(inp.value) : inp.value;
      set(path, v); out.textContent = fmtVal(v);
      applySettings(path);
    });
    row.appendChild(inp); row.appendChild(out); fieldsEl.appendChild(row);
    inputs[path] = { inp, out, type };
  }
}
function syncPanel(paths = Object.keys(inputs)) {
  for (const p of paths) {
    const f = inputs[p]; if (!f) continue; const v = get(p);
    if (f.type === 'bool') f.inp.checked = v; else f.inp.value = v;
    f.out.textContent = fmtVal(v);
  }
}
const presetEl = $('preset');
presetEl.innerHTML = '<option value="">Preset…</option>' + Object.keys(PRESETS).map((n) => `<option>${n}</option>`).join('');
presetEl.addEventListener('change', () => { if (!presetEl.value) return; applyPreset(presetEl.value); syncPanel(); applySettings(); });
$('reset-settings').addEventListener('click', () => { resetSettings(); presetEl.value = ''; syncPanel(); applySettings(); });
$('copy-settings').addEventListener('click', async () => {
  const txt = JSON.stringify(S, null, 2), btn = $('copy-settings');
  try { await navigator.clipboard.writeText(txt); btn.textContent = 'Copied!'; }
  catch {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); btn.textContent = 'Copied!'; } catch { btn.textContent = 'Copy failed'; }
    ta.remove();
  }
  setTimeout(() => { btn.textContent = 'Copy settings'; }, 1400);
});
function toggleTweak(force) {
  const w = $('win-tweak'); const show = force ?? w.hidden;
  w.hidden = !show; if (show) { syncPanel(); w.style.zIndex = 6; }
}
$('btn-tweak').addEventListener('click', () => toggleTweak());
$('tweak-close').addEventListener('click', () => toggleTweak(false));
addEventListener('keydown', (e) => { if ((e.key === 't' || e.key === 'T') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) toggleTweak(); });
syncPanel();

// ---------------- story ----------------
let epoch = 0;
const A = (p) => { const e = epoch; return Promise.resolve(p).then((v) => (e === epoch ? v : new Promise(() => {}))); };
let people = [], tickets = [];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const R = world.rooms;
const CAST = {
  ada: { name: 'Ada', shirtKey: 'ada', hair: 0x2a1a12, style: 'bun', skin: 0, pants: 0x3a2e4a },
  bea: { name: 'Bea', shirtKey: 'bea', hair: 0xb5672f, style: 'long', skin: 3, pants: 0x2b2522 },
  cy: { name: 'Cy', shirtKey: 'cy', hair: 0x1b1310, style: 'tuft', skin: 2, pants: 0x2f3a45 },
  dev: { name: 'Dev', shirtKey: 'dev', hair: 0x5a3a22, style: 'cap', skin: 1, pants: 0x4a3a2a },
  mo: { name: 'Mo', shirtKey: 'mo', hair: 0x2b1d14, style: 'short', skin: 1, pants: 0x2b2522 },
};
function spawn(key) {
  const c = CAST[key];
  const p = new Person({ ...c, shirt: S.shirts[c.shirtKey], P: S.palette });
  p.shirtKey = c.shirtKey; p.hairHex = c.hair; p.spawnK = 1;
  scene.add(p.root); people.push(p);
  return p;
}
function seatAt(p, room) { p.root.position.set(room.seat.x, room.seatY, room.seat.z); p.sit = 1; p.yaw = p.targetYaw = room.seatYaw; }
async function enterDoor(p) {
  p.root.position.copy(world.door.spawn); p.yaw = p.targetYaw = Math.PI; p.spawnK = 0;
  fx.sparksAt(V(world.door.spawn.x, 0.9, world.door.spawn.z), 24, { color: 0xffd08a, speed: 1.2, up: 0.8, life: 0.8 });
  tween(0.5, (k) => { p.spawnK = k; }, ease.back);
}
function newTicket(data, room) {
  const t = new Ticket(scene, data, S.palette); t.place(room.ticketAnchor); tickets.push(t); return t;
}
const above = (v, y = 0.62) => v.clone().add(V(0, y, 0));

function setButtons(state) {
  const c = $('btn-clash'), f = $('btn-fix'), r = $('btn-reset');
  c.disabled = state !== 'ready'; f.disabled = state !== 'clashed';
  c.classList.toggle('ready', state === 'ready'); f.classList.toggle('ready', state === 'clashed'); r.classList.toggle('ready', state === 'fixed');
}

function resetStory() {
  epoch++; killTweens();
  people.forEach((p) => scene.remove(p.root)); people = [];
  tickets.forEach((t) => t.dispose()); tickets = [];
  fx.reset();
  R.forEach((r) => world.setRoomState(r, 'idle'));
  drone.setPos(world.droneHome);
  lis.forEach((li) => li.classList.remove('hl', 'err', 'done')); codeEl.scrollTo({ top: 0 });
  codeStatus('idle');
  counter('c-bookings', 1, { quiet: true }); counter('c-revenue', 40, { fmt: money, quiet: true });
  counter('c-rep', 4.6, { fmt: stars, quiet: true }); counter('c-tickets', 0, { quiet: true }); setXP(120, true);
  warn(false); quietInbox();
  // the office before the story: Cy already booked in Room 2, Dev reading on the bench
  const cy = spawn('cy'); seatAt(cy, R[1]);
  newTicket({ slot: '09:00–10:00', who: 'Cy', room: 2, state: 'booked' }, R[1]).pop = 1;
  const dev = spawn('dev'); dev.root.position.copy(world.bench.seat); dev.root.position.y = 0.08; dev.sit = 1; dev.yaw = dev.targetYaw = world.bench.yaw; dev.read = 1;
  const mo = spawn('mo'); mo.root.position.set(-5.9, 0, 2.95); mo.typing = true;
  setButtons('busy');
  intro();
}

async function intro() {
  const ada = spawn('ada');
  await A(wait(0.6));
  codeStatus('running', 'run'); hl([2, 3]);
  enterDoor(ada);
  const walk = ada.walkTo([world.door.inside, ...R[0].entry]);
  await A(wait(0.5));
  await A(drone.flyTo(above(R[0].ticketAnchor)));
  await A(walk);
  await A(ada.sitDown(R[0].seat, R[0].seatYaw, R[0].seatY));
  const t = newTicket({ slot: '09:00–10:00', who: 'Ada', room: 1, state: 'new' }, R[0]);
  await A(t.appear());
  await A(drone.stamp(() => {
    t.set({ state: 'booked' }); t.punch();
    fx.sparksAt(R[0].ticketAnchor, 30, { color: S.palette.gold, speed: 1.8, up: 1.4 });
    fx.ring(R[0].seat, S.palette.gold, { to: 1.6 });
  }));
  markDone([2, 3]);
  counter('c-bookings', 2); counter('c-revenue', 80, { fmt: money });
  ada.bounce();
  await A(wait(0.4));
  hl([]); codeStatus('idle');
  await A(drone.flyTo(world.droneHome));
  setButtons('ready');
}

async function runClash() {
  setButtons('busy');
  const bea = spawn('bea');
  codeStatus('running', 'run'); hl([5, 6]);
  enterDoor(bea);
  const walk = bea.walkTo([world.door.inside, V(R[0].cx + 0.95, 0, -1.9), R[0].clashSpot]);
  await A(wait(0.8));
  await A(drone.flyTo(above(R[0].ticketAnchor, 0.9)));
  await A(walk);
  bea.face(Math.PI);
  const t = newTicket({ slot: '09:00–10:00', who: 'Bea', room: 1, state: 'new' }, R[0]);
  t.offset.set(0.35, 0.28, 0.2);
  await A(t.appear());
  // the drone blindly runs the INSERT: stamps a second booking for the same slot
  await A(drone.stamp(() => { t.set({ state: 'booked' }); t.punch(); fx.sparksAt(above(R[0].ticketAnchor, 0.3), 20, { color: S.palette.gold }); }));
  counter('c-bookings', 3); counter('c-revenue', 120, { fmt: money });
  markDone([5, 6]);
  await A(wait(0.35));
  // the clash
  hl([7], 'err'); codeStatus('conflict!', 'err');
  const ada = people.find((p) => p.name === 'Ada');
  world.setRoomState(R[0], 'alarm');
  tickets.filter((x) => x.data.room === 1).forEach((x) => { x.set({ state: 'clash' }); x.wobble = 1; x.punch(); });
  drone.flash(S.palette.danger);
  fx.ring(R[0].seat, S.palette.danger, { to: 2.8, dur: 0.9 });
  fx.sparksAt(above(R[0].ticketAnchor, 0.2), 26, { color: S.palette.danger, speed: 2.2 });
  bea.emote('bang'); ada.emote('bang'); bea.shake = 1.6; ada.shake = 1.6;
  bea.sqV = 3; ada.sqV = 3;
  counter('c-rep', 4.3, { fmt: stars, bad: true }); counter('c-tickets', 1, { bad: true });
  warn(true);
  showTicket({ n: 42, who: 'Bea · Room 1 · 09:00', person: bea, text: "Hi! I booked Room 1 for 09:00, but someone is already sitting in it. Can you sort this out?", chip: 'open' });
  await A(wait(1.2));
  await A(drone.flyTo(above(R[0].ticketAnchor, 1.3), { arc: 0.2 }));
  tickets.forEach((x) => { x.wobble = 0.25; });
  setButtons('clashed');
}

async function runFix() {
  setButtons('busy');
  const bea = people.find((p) => p.name === 'Bea'), ada = people.find((p) => p.name === 'Ada');
  const bt = tickets.find((x) => x.data.who === 'Bea');
  codeStatus('running', 'run'); hl([10]);
  await A(drone.flyTo(above(bea.root.position, 1.75), { arc: 0.3 }));
  bea.hideEmote(); await A(bea.emote('q'));
  await A(wait(0.3));
  // scan the rooms: the subquery, visibly evaluated row by row
  hl([11, 12, 13, 14, 15]);
  const verdict = [false, false, true];
  for (let i = 0; i < 3; i++) {
    const r = R[i];
    await A(drone.flyTo(above(r.ticketAnchor, 0.9), { arc: 0.4 }));
    drone.flash(verdict[i] ? S.palette.ok : S.palette.danger);
    world.setRoomState(r, i === 0 ? 'alarm' : verdict[i] ? 'scan-good' : 'scan-bad');
    fx.ring(r.seat, verdict[i] ? S.palette.ok : S.palette.danger, { to: 2.4, dur: 0.7 });
    fx.mark(above(r.markAnchor, 0), verdict[i]);
    await A(wait(0.45));
  }
  hl([16]); await A(wait(0.35));
  // escort Bea to room 3 (the UPDATE)
  hl([10, 17]);
  await A(drone.flyTo(above(bea.root.position, 1.75), { arc: 0.5 }));
  bea.hideEmote(); ada.hideEmote(); bea.shake = 0; ada.shake = 0;
  await A(bea.emote('dots'));
  const route = [V(R[0].cx + 0.95, 0, -1.9), V(R[0].cx + 1.8, 0, -1.2), V(R[2].cx - 0.2, 0, -1.2), ...R[2].entry];
  // the drone leads, a little ahead and above
  const lead = (async () => {
    let from = bea.root.position.clone();
    for (const wp of route) {
      const d = from.distanceTo(wp), T = d / bea.speed;
      await A(drone.flyTo(V(wp.x, 1.8, wp.z), { dur: T, arc: 0.05, e: ease.linear }));
      from = wp;
    }
  })();
  bt.wobble = 0; bt.offset.set(0, 0, 0);
  const tMove = A(wait(0.4)).then(() => bt.moveTo(R[2].ticketAnchor, 2.4));
  await A(wait(0.25));
  bea.hideEmote();
  await A(bea.walkTo(route));
  await A(bea.sitDown(R[2].seat, R[2].seatYaw, R[2].seatY));
  await A(lead); await A(tMove);
  await A(drone.flyTo(above(R[2].ticketAnchor), { arc: 0.2 }));
  await A(drone.stamp(() => {
    bt.set({ room: 3, state: 'moved' }); bt.punch();
    fx.sparksAt(R[2].ticketAnchor, 36, { color: S.palette.ok, speed: 2 });
    fx.ring(R[2].seat, S.palette.ok, { to: 2.2 });
  }));
  markDone([10, 11, 12, 13, 14, 15, 16, 17]);
  fx.clearTransients();
  world.setRoomState(R[0], 'idle'); world.setRoomState(R[2], 'ok');
  tickets.filter((x) => x.data.who === 'Ada').forEach((x) => { x.set({ state: 'booked' }); x.wobble = 0; x.punch(); });
  bea.bounce(); await A(bea.emote('ok'));
  ada.bounce();
  await A(wait(0.5));
  // the constraint: a gold shock ring over every room, then the reward
  hl([20, 21]);
  const centre = V(0, 2.7, -2.4);
  await A(drone.flyTo(centre, { arc: 0.6 }));
  await A(drone.stamp());
  fx.ring(V(0, 0, -3.2), S.palette.gold, { from: 0.5, to: 11, dur: 1.3 });
  R.forEach((r) => { r.after = r.id === 3 ? 'ok' : 'idle'; world.setRoomState(r, 'shield'); });
  await A(wait(0.35));
  fx.burst(V(0, 2.6, -2.4));
  fx.sparksAt(V(0, 2.6, -2.4), 60, { color: S.palette.gold, speed: 3.5, up: 2 });
  fx.floatText(V(0, 3.1, -2.2), '+10 XP', S.palette.gold);
  markDone([20, 21]);
  codeStatus('✓ committed', 'run');
  counter('c-tickets', 0); counter('c-rep', 4.8, { fmt: stars }); setXP(130);
  warn(false);
  showTicket({ n: 42, who: 'Bea · Room 3 · 09:00', person: bea, text: "Hi! I booked Room 1 for 09:00, but someone is already sitting in it. Can you sort this out?", chip: 'resolved', reply: 'Moved you to Room 3, same time. Sorry about that! Double bookings are now blocked.' });
  await A(wait(1.4));
  bea.hideEmote();
  hl([]); codeStatus('idle');
  await A(drone.flyTo(world.droneHome));
  setButtons('fixed');
}

$('btn-clash').addEventListener('click', () => runClash());
$('btn-fix').addEventListener('click', () => runFix());
$('btn-reset').addEventListener('click', () => resetStory());

// ---------------- loop + perf ----------------
const clock = new THREE.Clock();
const perfEl = $('perf');
const perf = { frames: [], calls: 0, tris: 0 };
window.__perf = perf;
window.__measure = (sec = 5) => new Promise((res) => { perf.frames = []; setTimeout(() => {
  const f = perf.frames.slice(1), avg = f.reduce((a, b) => a + b, 0) / f.length;
  const sorted = [...f].sort((a, b) => a - b);
  res({ frames: f.length, avgMs: +avg.toFixed(2), fps: +(1000 / avg).toFixed(1), p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(2), calls: perf.calls, tris: perf.tris, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), size: [canvas.width, canvas.height], bake: world.bakeInfo });
}, sec * 1000); });
let acc = 0, n = 0, last = performance.now(), cpuAcc = 0, simTime = 0;
function frame() {
  const now = performance.now(); perf.frames.push(now - last); last = now;
  const raw = Math.min(clock.getDelta(), 0.05);
  step(raw);
  cpuAcc += performance.now() - now;
  perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles;
  acc += raw; n++;
  if (acc > 0.5) { perfEl.textContent = `${(acc / n * 1000).toFixed(1)} ms/frame · cpu ${(cpuAcc / n).toFixed(1)} ms · ${perf.calls} draw calls · ${(perf.tris / 1000).toFixed(0)}k tris`; acc = 0; n = 0; cpuAcc = 0; }
  requestAnimationFrame(frame);
}
// debug: advance the simulation deterministically (used for screenshots when rAF is throttled)
async function advance(sec, fps = 30) {
  for (let i = 0; i < sec * fps; i++) { step(1 / fps); for (let k = 0; k < 10; k++) await null; }
}
function step(raw) {
  const dt = raw * S.anim.speed; simTime += dt; const t = simTime;
  if (colorsDirty) { world.applyColors(); colorsDirty = false; }
  updateTweens(dt);
  world.update(dt, t);
  people.forEach((p) => { p.update(dt, t); p.root.scale.setScalar(S.chars.scale * (p.spawnK ?? 1)); });
  tickets.forEach((tk) => tk.update(dt, t));
  drone.update(dt, t);
  drone.trailMat.uniforms.px.value = canvas.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / 300;
  fx.update(dt, camera, canvas.height);
  applyLight(t);
  controls.update();
  renderer.render(scene, camera);
}

window.__spike = { S, scene, camera, controls, drone, world, get people() { return people; }, applySettings, renderer, advance };
resetWindowPositions();
resize();
applySettings();
resetStory();
$('loading').classList.add('gone');
setTimeout(() => $('loading').remove(), 700);
requestAnimationFrame(frame);
