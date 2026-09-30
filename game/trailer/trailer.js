// trailer.js: GRIMOIRE concept trailer, rendered with the game's own engine and art pack.
// One master clock drives everything. The timeline is deterministic: seek(t) replays the (seeded) actors
// from 0 in fixed 1/30 s steps when it goes backwards, and steps forwards otherwise, so a frame at time t
// always looks the same. window.__trailer = { duration, seek(t), play(), pause(), ready, time }.
// ?capture=1 does not auto-play (the recorder seeks frame by frame). Sound cues live in cues.json.
import * as THREE from 'three';
import { createStage } from '../engine/renderer.js';
import { theme, DEFAULTS, get as tget } from '../engine/theme.js';
import { make } from '../art/index.js';
import { tileField } from '../art/materials.js';
import { CORNERS } from '../art/sectors/common.js';
import { Person } from '../art/people.js';
import { part, sphere, torus, toonOwn, glow, floorGlow, canvasTex, ease, lerp } from '../engine/kit.js';

// ---- the Warm dusk preset, in memory only (never written to the viewer's saved theme)
(function warmDusk() {
  const copy = (into, from) => { for (const k of Object.keys(from)) { if (from[k] && typeof from[k] === 'object') copy(into[k] ??= {}, from[k]); else into[k] = from[k]; } };
  copy(theme, JSON.parse(JSON.stringify(DEFAULTS)));
})();

const DURATION = 76, STEP = 1 / 30;
const CAPTURE = new URLSearchParams(location.search).has('capture');
const $ = (id) => document.getElementById(id);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const k01 = (t, a, b) => clamp01((t - a) / (b - a));
const inOut = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(k01(t, a, a + fi), 1 - k01(t, b - fo, b));
const rad = THREE.MathUtils.degToRad;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ================================================================ stage, lights
const canvas = $('c');
const stage = createStage(canvas, { reducedMotion: false });
const { scene, camera, renderer } = stage;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;

const hemi = new THREE.HemisphereLight(0xffe0b5, 0x2a1d14, 1);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
{ const c = sun.shadow.camera; c.left = c.bottom = -24; c.right = c.top = 24; c.near = 1; c.far = 120; }
const sunDir = new THREE.Vector3(-0.5, 0.95, 0.55).normalize();
sun.target.position.set(0, 0, -3); sun.position.copy(sun.target.position).addScaledVector(sunDir, 50);
const rim = new THREE.DirectionalLight(0x8f86ff, 1);
rim.position.set(18, 24, -36);
const lamps = [[-2.5, 3.2, 0.5], [2.5, 3.2, 0.5]].map(([x, y, z]) => { const l = new THREE.PointLight(0xffc98a, 1, 12, 1.6); l.position.set(x, y, z); return l; });
scene.add(hemi, sun, sun.target, rim, ...lamps);
const skyDusk = new THREE.Color(0x5b5f9e), sunDusk = new THREE.Color(0x7c78c8), night = new THREE.Color(0x5a6cc0);

// ================================================================ the office
const office = new THREE.Group(); office.name = 'office'; scene.add(office);
const place = (g, id, x, z, ry = 0, y = 0, opts = {}) => { const o = make(id, opts); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
const inRoom1 = (x, z) => x <= -1.5 && z >= 0.5, inRoom2 = (x, z) => x >= 1.5 && z >= 0.5;
{
  const hall = [], carpet = [];
  for (let x = -4.5; x <= 4.5; x++) for (let z = -3.5; z <= 3.5; z++) ((inRoom1(x, z) || inRoom2(x, z)) ? carpet : hall).push([x, z]);
  office.add(tileField('wood', hall, { seed: 2 }), tileField('carpet', carpet, { seed: 3 }));
}
for (let x = -4.5; x <= 4.5; x++) if (x !== -2.5) place(office, x === 0.5 || x === 1.5 ? 'wall-window' : 'wall-segment', x, -4.15);
const door = place(office, 'door', -2.5, -4.15);
for (let z = -3.5; z <= 3.5; z++) place(office, 'wall-segment', -5.15, z, Math.PI / 2);
place(office, 'bookshelf', -0.6, -3.6); place(office, 'plant-tall', -4.5, -3.5, 0.4); place(office, 'water-cooler', -4.5, -1.6, Math.PI / 2);
place(office, 'whiteboard', 3.2, -3.65); place(office, 'plant-tall', 4.6, -0.6, 1.2); place(office, 'coat-rack', -1.5, -3.6);
place(office, 'rug', 0.3, -0.9);
// your desk: the monitor shows code; the drone (your code) rests above it
const codeScreen = (ctx, w, h) => {
  ctx.fillStyle = '#0f1420'; ctx.fillRect(0, 0, w, h);
  const cols = ['#d9a441', '#6fbf8b', '#86c4e0', '#e2574c', '#efe6d2'];
  for (let i = 0; i < 9; i++) { ctx.fillStyle = cols[(i * 3) % 5]; ctx.fillRect(10 + (i % 3) * 12, 10 + i * 12, 40 + ((i * 37) % 90), 6); }
};
place(office, 'desk', 3.3, -2.5); place(office, 'monitor', 3.25, -2.73, 0, 0.62, { draw: codeScreen });
place(office, 'desk-lamp', 3.95, -2.7, -0.5, 0.62); place(office, 'mug', 2.7, -2.35, 0.3, 0.62); place(office, 'office-chair', 3.08, -2.0, Math.PI);
// Room 1: sofa corner. Room 2: a desk and a chair facing the camera
place(office, 'sofa', -4.3, 1.9, Math.PI / 2); place(office, 'coffee-table', -3.0, 1.9, Math.PI / 2); place(office, 'plant-small', -4.5, 3.5);
place(office, 'desk', 3.0, 2.35, Math.PI); const room2Chair = place(office, 'office-chair', 3.22, 1.85, 0);
place(office, 'paper-stack', 2.6, 2.3, 0.3, 0.62); place(office, 'mug', 3.5, 2.45, 1, 0.62); place(office, 'plant-small', 4.5, 0.6);

function floorLabel(text, x, z, w = 1.9) {
  const tex = canvasTex(512, 128, (g) => {
    g.fillStyle = 'rgba(20,16,13,0.7)'; g.beginPath(); g.roundRect(8, 12, 496, 104, 30); g.fill();
    g.strokeStyle = '#d9a441'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#efe6d2'; g.font = '800 64px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 66);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); office.add(m);
}
floorLabel('ROOM 1', -3.0, 3.55); floorLabel('ROOM 2', 3.0, 3.55);

// soft rounded-square decal: rows being read, and the room turning green
const squareTex = canvasTex(256, 256, (g) => {
  for (let i = 0; i < 18; i++) { g.strokeStyle = `rgba(255,255,255,${0.06 + (i / 18) * 0.5})`; g.lineWidth = 3; g.beginPath(); g.roundRect(10 + i * 2, 10 + i * 2, 236 - i * 4, 236 - i * 4, 34); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.roundRect(46, 46, 164, 164, 18); g.fill();
});
function decal(color, w, d, x, z) {
  const m = floorGlow(color, w, d, 0, squareTex); m.material.blending = THREE.NormalBlending; m.position.set(x, 0.03, z); office.add(m);
  const b = glow(color, 2.2, 0); b.position.set(x, 1.1, z); office.add(b);
  return { m, b };
}
const ROWS = [{ at: 20.6, x: -4.1, z: 1.9, w: 1.4, d: 2.4, bad: false }, { at: 21.1, x: 3.1, z: 2.0, w: 2.6, d: 1.9, bad: true }, { at: 21.6, x: -2.4, z: 2.9, w: 1.1, d: 1.1, bad: false }]
  .map((r) => ({ ...r, ...decal(0xffc862, r.w, r.d, r.x, r.z) }));
const roomTex = canvasTex(256, 256, (g) => {
  for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(255,255,255,${0.1 + (i / 14) * 0.7})`; g.lineWidth = 3; g.beginPath(); g.roundRect(8 + i * 2, 8 + i * 2, 240 - i * 4, 240 - i * 4, 30); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.roundRect(36, 36, 184, 184, 16); g.fill();
});
const room2Glow = floorGlow(0x3fe070, 4.2, 3.9, 0, roomTex); room2Glow.material.blending = THREE.NormalBlending; room2Glow.position.set(3.0, 0.035, 2.0); office.add(room2Glow);
const GOLD = new THREE.Color(0xffc862), RED = new THREE.Color(0xff4a3a), GREEN = new THREE.Color(0x6fdf8b);

// ================================================================ confetti (ballistic, a function of time)
const CONF_T = 35.9, confOrigin = new THREE.Vector3(3.1, 1.3, 2.0);
const confetti = [];
{
  const R = rng(99), cols = [0xd9a441, 0x6fbf8b, 0xe2574c, 0x86c4e0, 0xefe6d2, 0xe45b8f];
  const geo = new THREE.PlaneGeometry(0.09, 0.14);
  for (let i = 0; i < 110; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true }));
    const a = R() * Math.PI * 2, s = 0.6 + R() * 1.6;
    m.userData = { v: new THREE.Vector3(Math.cos(a) * s, 3.2 + R() * 2.6, Math.sin(a) * s), spin: new THREE.Vector3(R() * 9, R() * 9, R() * 9), delay: R() * 0.15 };
    m.visible = false; scene.add(m); confetti.push(m);
  }
}

// ================================================================ the drone (a placeholder)
const drone = new THREE.Group(); scene.add(drone);
const droneRig = new THREE.Group(); drone.add(droneRig);
part(sphere(0.3, 24, 16), toonOwn(0xefe6d2, { emissive: 0xffd28a, ei: 0.35 }), { parent: droneRig, outline: 0.02 });
const droneRing = part(torus(0.46, 0.035, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffc862 }), { parent: droneRig, outline: 0, cast: false });
for (const s of [-1, 1]) part(sphere(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0x14110f }), { parent: droneRig, x: s * 0.1, y: 0.05, z: 0.275, outline: 0, cast: false });
const droneGlow = glow(0xffc862, 1.9, 0.55); droneRig.add(droneGlow);
const droneLight = new THREE.PointLight(0xffd28a, 2.2, 5, 1.6); droneLight.position.y = -0.3; drone.add(droneLight);
const droneSpot = floorGlow(0xffcf80, 1.6, 1.6, 0.4); scene.add(droneSpot);

// ================================================================ districts (scene 6)
const DISTRICTS = [
  { sector: 'lab', name: 'Lab', at: [-12, 0, 0], t: 52.5 },
  { sector: 'gym', name: 'Gym', at: [12, 0, 0], t: 54.5 },
  { sector: 'school', name: 'School', at: [0, 0, -11.5], t: 56.5 },
];
const pops = []; // { obj, t, s0 }
for (const d of DISTRICTS) {
  const g = new THREE.Group(); g.position.set(...d.at); scene.add(g); d.group = g;
  const corner = CORNERS[d.sector];
  const cells = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) cells.push([i - 2.5, j - 2.5]);
  const floor = tileField(corner.floor, cells, { seed: d.sector.length }); g.add(floor);
  pops.push({ obj: floor, t: d.t });
  d.items = [];
  corner.props.forEach(([id, x, z, ry = 0, y = 0], i) => {
    const o = place(g, id, x, z, ry, y);
    d.items.push({ id, o });
    pops.push({ obj: o, t: d.t + 0.2 + i * 0.06 });
  });
}
// paths between the districts: concrete tiles rippling out from the office
{
  const set = new Map();
  const addCell = (x, z) => set.set(`${x},${z}`, [x, z]);
  for (let x = -14.5; x <= 14.5; x++) addCell(x, 5.5);
  for (let z = -7.5; z <= 4.5; z++) { addCell(-7, z); addCell(7, z); }
  for (let x = -6; x <= 6; x++) addCell(x, -6);
  for (const [x, z] of set.values()) {
    const f = tileField('concrete', [[0, 0]], { seed: Math.abs(x * 13 + z * 7) | 0 });
    f.position.set(x, -0.02, z); scene.add(f);
    pops.push({ obj: f, t: 50.8 + Math.hypot(x, z * 1.3) * 0.07 });
  }
}
for (const p of pops) p.obj.visible = false;
const LOOP = [[-7, 5.5], [7, 5.5], [7, -6], [-7, -6]];

// ================================================================ actors (rebuilt on every rewind)
function makePerson(opts, fallback) {
  try { return new Person({ reducedMotion: false, ...opts }); } catch (e) { console.warn('person options', e); return new Person({ reducedMotion: false, ...fallback }); }
}
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function along(pts, d, loop = false) {
  const P = loop ? [...pts, pts[0]] : pts;
  const L = polyLen(P);
  if (loop) d = ((d % L) + L) % L;
  if (d <= 0) return { x: P[0][0], z: P[0][1], dx: P[1][0] - P[0][0], dz: P[1][1] - P[0][1], done: false };
  for (let i = 1; i < P.length; i++) {
    const [ax, az] = P[i - 1], [bx, bz] = P[i], l = Math.hypot(bx - ax, bz - az);
    if (d <= l) { const k = d / l; return { x: lerp(ax, bx, k), z: lerp(az, bz, k), dx: bx - ax, dz: bz - az, done: false }; }
    d -= l;
  }
  const n = P.length - 1;
  return { x: P[n][0], z: P[n][1], dx: P[n][0] - P[n - 1][0], dz: P[n][1] - P[n - 1][1], done: true };
}
let actors = [], events = [], evIdx = 0, priya, omar;
class Actor {
  constructor(opts, fallback, { parent, x, z, yaw = 0, show = [0, 1e9], segs = [], loop = null, pop = null }) {
    this.p = makePerson(opts, fallback);
    this.p.root.position.set(x, 0, z); this.p.yaw = this.p.targetYaw = yaw;
    parent.add(this.p.root);
    Object.assign(this, { show, segs, loop, pop, ctrl: 'kin', rest: 'idle' });
    actors.push(this);
  }
  segAt(T) { let s = null; for (const g of this.segs) if (g.t0 <= T) s = g; return s; }
  posAt(T) {
    const s = this.segAt(T);
    if (!s) return new THREE.Vector3(this.p.root.position.x, 0, this.p.root.position.z);
    const a = along(s.pts, (T - s.t0) * s.speed);
    return new THREE.Vector3(a.x, 0, a.z);
  }
  step(T) {
    const p = this.p;
    if (this.ctrl === 'kin') {
      if (this.loop) {
        const l = this.loop, a = along(l.pts, (T - l.t0) * l.speed + l.phase, true);
        p.root.position.set(a.x + l.off[0], 0, a.z + l.off[1]);
        p.targetYaw = Math.atan2(a.dx, a.dz); p.speed = l.speed;
        if (p.state !== 'walk') p.play('walk');
      } else {
        const s = this.segAt(T);
        if (s) {
          const a = along(s.pts, (T - s.t0) * s.speed);
          p.root.position.set(a.x, 0, a.z); p.speed = s.speed;
          if (!a.done) { p.targetYaw = Math.atan2(a.dx, a.dz); if (p.state !== 'walk') p.play('walk'); }
          else { if (s.face !== undefined) p.targetYaw = s.face; if (p.state === 'walk') p.play(s.rest || 'idle'); }
        }
      }
    }
    p.root.visible = T >= this.show[0] && T < this.show[1];
    if (this.pop !== null) p.root.scale.setScalar(Math.max(1e-3, ease.back(k01(T, this.pop, this.pop + 0.4))));
  }
}
function buildActors() {
  for (const a of actors) a.p.dispose();
  actors = []; evIdx = 0;
  priya = new Actor({ role: 'lab', seed: 3, name: 'Priya', hairStyle: 'long', hair: 'hair1', skin: 'skin3', goggles: false, glasses: false, prop: null }, { role: 'lab', seed: 3 }, {
    parent: office, x: -2.5, z: -4.7, show: [6.55, 42.9],
    segs: [
      { t0: 6.6, pts: [[-2.5, -4.7], [-2.5, -3.2], [-1.2, -1.2]], speed: 1.5, face: 0.35 },
      { t0: 31.7, pts: [[-1.2, -1.2], [0.8, 0.3], [3.22, 1.25]], speed: 1.5, face: 0 },
    ],
  });
  omar = new Actor({ role: 'gym', seed: 4, name: 'Omar', hairStyle: 'short', skin: 'skin4', beard: true, prop: null }, { role: 'gym', seed: 4 }, {
    parent: office, x: -2.5, z: -4.7, show: [46.65, 1e9],
    segs: [{ t0: 46.7, pts: [[-2.5, -4.7], [-2.5, -3.2], [-0.4, -1.5]], speed: 1.5, face: 0.2 }],
  });
  events = [
    [9.2, () => priya.p.emote('bang', { hold: 3.2 })],
    [9.35, () => priya.p.play('frustrated')],
    [10.6, () => priya.p.play('talk')],
    [15.0, () => { priya.p.play('idle'); priya.p.express('worried', 16); }],
    [31.2, () => priya.p.express('surprised', 1.2)],
    [35.1, () => { priya.ctrl = 'free'; priya.p.sit(room2Chair); }],
    [35.9, () => { priya.p.emote('ok', { hold: 2.2 }); priya.p.play('celebrate'); }],
    [38.2, () => { priya.p.play('sit'); priya.p.express('happy', 5); }],
    [47.4, () => omar.p.emote('bang', { hold: 3 })],
    [49.3, () => omar.p.play('frustrated')],
    [52.0, () => omar.p.play('idle')],
  ];
  // district locals
  const [lab, gym, school] = DISTRICTS;
  const local = (d, role, seed, x, z, yaw, state, dt = 0.9) => {
    const a = new Actor({ role, seed }, { role, seed }, { parent: d.group, x, z, yaw, show: [d.t + dt, 1e9], pop: d.t + dt });
    a.ctrl = 'free'; events.push([d.t + dt, () => a.p.play(state)]);
    return a;
  };
  local(lab, 'lab', 11, -0.8, -1.4, Math.PI, 'idle'); local(lab, 'lab', 12, 0.5, 1.15, Math.PI + 0.3, 'talk'); local(lab, 'office', 13, 1.8, -0.6, -1.2, 'wave', 1.2);
  local(gym, 'gym', 21, -1.2, 1.6, 0, 'celebrate'); local(gym, 'gym', 22, 1.1, -0.7, 0.2, 'wave'); local(gym, 'gym', 23, 0.0, 1.6, -0.3, 'celebrate', 1.1);
  local(school, 'school', 31, -0.3, -1.75, 0, 'talk');
  school.items.filter((it) => it.id === 'student-desk').slice(0, 4).forEach((it, i) => {
    const s = it.o.userData.seat, sx = it.o.position.x + s.position[0], sz = it.o.position.z + s.position[2];
    const a = local(school, 'school', 40 + i, sx, sz, Math.PI, 'idle', 1.0 + i * 0.1);
    events.push([school.t + 1.6 + i * 0.1, () => a.p.sit(it.o)]);
  });
  // bustle between the districts
  const LL = polyLen([...LOOP, LOOP[0]]);
  ['office', 'lab', 'clinic', 'school', 'council', 'gym', 'office', 'lab'].forEach((role, i) => {
    const cw = i % 2 === 0, pts = cw ? LOOP : [...LOOP].reverse();
    const a = new Actor({ role, seed: 60 + i }, { role, seed: 60 + i }, { parent: scene, x: 0, z: 0, show: [52 + i * 0.7, 1e9], pop: 52 + i * 0.7 });
    a.loop = { pts, t0: 52, speed: 1.25 + (i % 3) * 0.1, phase: (i / 8) * LL, off: cw ? [0.22, 0.22] : [-0.22, -0.22] };
  });
  events.sort((a, b) => a[0] - b[0]);
}

// ================================================================ camera keys (t, target xyz, distance, pitch, yaw)
const CAM = [
  [0, -0.2, 0, 0.6, 27, 30, 0], [6, 0, 0, 0.2, 21.5, 32, 4], [10, -1.3, 0.5, -1.2, 14.5, 36, 6], [16.3, -1.0, 0.5, -1.0, 15.5, 36, 6],
  [18, -4.2, 0, 0.1, 22.5, 34, 6], [29.5, -4.0, 0, 0.3, 22, 34, 7], [31.5, 0.2, 0.4, 0.2, 15.5, 36, 4], [35.2, 2.4, 0.4, 1.4, 12.5, 38, 0],
  [39.8, 2.2, 0.4, 1.2, 12.8, 38, 0], [41.2, -3.0, 0, 0.2, 21.5, 33, 4], [46.3, -2.8, 0, 0.0, 21, 33, 4], [48, -1.6, 0.4, -1.2, 16.5, 35, 4],
  [50, -1.4, 0.4, -1.2, 17, 35, 4], [55, 0.6, 0, -2.6, 47, 40, 8], [64.5, 0.6, 0, -2.6, 49, 42, 14], [76, 0.6, 0, -2.6, 53, 44, 20],
];
function cameraAt(T) {
  let i = 0; while (i < CAM.length - 2 && CAM[i + 1][0] <= T) i++;
  const a = CAM[i], b = CAM[i + 1], k = ease.inOut(k01(T, a[0], b[0]));
  const v = a.map((x, j) => lerp(x, b[j], k));
  const [, tx, ty, tz, d, pitch, yaw] = v;
  const p = rad(pitch), y = rad(yaw);
  camera.fov = 30;
  camera.aspect = (canvas.clientWidth || 1280) / (canvas.clientHeight || 720);
  camera.position.set(tx + Math.sin(p) * Math.sin(y) * d, ty + Math.cos(p) * d, tz + Math.sin(p) * Math.cos(y) * d);
  camera.lookAt(tx, ty, tz);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

// ================================================================ drone path
const DESK = new THREE.Vector3(3.3, 1.9, -2.2);
function bez(a, b, k, lift = 0.8) { const v = new THREE.Vector3().lerpVectors(a, b, k); v.y += Math.sin(Math.PI * k) * lift; return v; }
function droneAt(T) {
  const priyaHead = (t) => priya.posAt(t).add(new THREE.Vector3(0.35, 2.15, 0.35));
  if (T < 30.2) return DESK.clone();
  if (T < 31.7) return bez(DESK, priyaHead(31.7), ease.inOut(k01(T, 30.2, 31.7)));
  if (T < 35.1) return priyaHead(Math.min(T + 0.45, 35.1));
  const R2 = new THREE.Vector3(1.9, 2.3, 1.5);
  if (T < 36.0) return bez(priyaHead(35.1), R2, ease.inOut(k01(T, 35.1, 36.0)), 0.3);
  if (T < 38.6) return R2;
  if (T < 40.0) return bez(R2, DESK, ease.inOut(k01(T, 38.6, 40.0)));
  const O = new THREE.Vector3(0.1, 2.2, -1.0);
  if (T < 47.8) return DESK.clone();
  if (T < 49.4) return bez(DESK, O, ease.inOut(k01(T, 47.8, 49.4)));
  if (T < 51.0) return O;
  const orbit = (t) => { const a = (t - 53) * 0.32; return new THREE.Vector3(Math.sin(a) * 8.5, 3.4, -2 + Math.cos(a) * 7.5); };
  if (T < 53) return bez(O, orbit(53), ease.inOut(k01(T, 51, 53)), 1.2);
  return orbit(T);
}

// ================================================================ overlays
const els = Object.fromEntries(['ticket', 'code', 'skill', 'skillmap', 'xp', 'caption', 'title', 'fade', 'sky', 'day', 'warn', 'src', 'res', 'run', 'tags',
  't-id', 't-who', 't-said', 't-reply', 't-pill', 's-bar', 's-feel', 's-kept'].map((id) => [id, $(id)]));
const CAPTIONS = [
  [1.2, 5.7, "You're the only developer."],
  [11.0, 15.9, 'Problems arrive as tickets.<br>Symptoms, not instructions.'],
  [17.2, 29.7, 'You investigate and fix it with real code:<br>SQL, JavaScript, PHP.'],
  [30.8, 39.7, 'Your code runs for real.<br>The world shows what it changed.'],
  [40.6, 49.9, 'Skills fade. Old problems come back<br>just before you forget.'],
  [51.0, 64.6, 'Solve with proven skills. Win clients.<br>Grow the company.'],
];
const Q1 = "SELECT id, room, day, status\nFROM bookings\nWHERE person = 'Priya';";
const Q2 = "UPDATE bookings\nSET status = 'confirmed'\nWHERE id = 57;";
const KW = /^(SELECT|FROM|WHERE|UPDATE|SET)$/;
function tokens(src) { return src.match(/'[^']*'?|\d+|[A-Za-z_]+|\s+|./g) || []; }
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function highlight(src, n, caret) {
  let out = '', used = 0;
  for (const tk of tokens(src)) {
    if (used >= n) break;
    const s = tk.slice(0, n - used); used += s.length;
    const cls = KW.test(tk) ? 'k' : tk[0] === "'" ? 's' : /^\d/.test(tk) ? 'n' : '';
    out += cls ? `<span class="${cls}">${esc(s)}</span>` : esc(s);
  }
  return out + (caret ? '<span class="caret"></span>' : '');
}
const ROWDATA = [['41', 'Room 1', 'Mon', 'confirmed'], ['57', 'Room 2', 'Tomorrow', 'cancelled'], ['63', 'Room 1', 'Fri', 'confirmed']];
const tagEls = new Map();
function tag(key, text, cls, world, op, dy = 0) {
  let el = tagEls.get(key);
  if (!el) { el = document.createElement('div'); el.className = `tag ${cls || ''}`; el.textContent = text; els.tags.appendChild(el); tagEls.set(key, el); }
  if (op <= 0.001) { el.style.opacity = 0; return; }
  const v = world.clone().project(camera);
  el.style.opacity = op;
  el.style.left = `${(v.x * 0.5 + 0.5) * canvas.clientWidth}px`;
  el.style.top = `${(-v.y * 0.5 + 0.5) * canvas.clientHeight - dy}px`;
}
const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`;
const pulseAt = (T, times) => { let b = 0; for (const t of times) b = Math.max(b, Math.sin(Math.PI * k01(T, t, t + 0.6)) * (T >= t ? 1 : 0)); return b; };
function setCtr(id, text, bump) {
  const el = $(id); el.querySelector('b').textContent = text;
  el.style.transform = `scale(${1 + 0.08 * bump})`;
  el.style.boxShadow = bump > 0.01 ? `0 0 0 1px rgba(217,164,65,${bump}), 0 0 ${22 * bump}px rgba(217,164,65,${0.6 * bump})` : 'none';
}
const lastHTML = new Map();
const html = (el, s) => { if (lastHTML.get(el) !== s) { el.innerHTML = s; lastHTML.set(el, s); } };

function nightAt(T) { // the time-lapse: three nights between 42.3 s and 46.2 s
  if (T < 42.3 || T > 46.2) return 0;
  const n = (T - 42.3) / 1.3; return Math.pow(Math.sin(Math.PI * n), 2) * 0.85;
}

function applyOverlays(T) {
  // captions
  const cap = CAPTIONS.find(([a, b]) => T >= a && T < b);
  if (cap) { const o = inOut(T, cap[0], cap[1], 0.35, 0.35); els.caption.style.opacity = o; els.caption.style.transform = `translateX(-50%) translateY(${(1 - o) * 12}px)`; html(els.caption, cap[2]); }
  else els.caption.style.opacity = 0;
  // HUD
  const hudOn = k01(T, 2.2, 3.2) * (1 - k01(T, 64.8, 65.4));
  $('hud').style.opacity = hudOn;
  const growK = ease.inOut(k01(T, 52, 64));
  setCtr('c-book', String(Math.round((T >= 36.2 ? 13 : 12) + 35 * growK)), pulseAt(T, [36.2, 58, 62]));
  setCtr('c-rev', money(1240 + 45 * ease.out(k01(T, 36.2, 37.2)) + 3675 * growK), pulseAt(T, [36.3, 60]));
  setCtr('c-rep', `★ ${(4.1 + 0.2 * ease.out(k01(T, 36.4, 37.4)) + 0.3 * growK).toFixed(1)}`, pulseAt(T, [36.4]));
  setCtr('c-cli', String(1 + (T >= 52.9) + (T >= 54.9) + (T >= 56.9)), pulseAt(T, [52.9, 54.9, 56.9]));
  const day = T < 42.95 ? 1 : T < 44.25 ? 2 : T < 45.55 ? 3 : 4 + Math.floor(26 * k01(T, 51, 64));
  html(els.day, `Day ${day}`);
  els.day.style.transform = `scale(${1 + 0.12 * pulseAt(T, [42.95, 44.25, 45.55])})`;
  const alarm = (T >= 9.2 && T < 35.8) || (T >= 47.4 && T < 51);
  const w = alarm ? 0.5 + 0.5 * Math.sin((T - 9.2) * Math.PI * 2.2) : 0;
  const lamp = els.warn.firstElementChild;
  lamp.style.background = alarm ? `rgb(${Math.round(lerp(120, 240, w))},${Math.round(lerp(40, 80, w))},${Math.round(lerp(36, 60, w))})` : (T >= 35.8 && T < 40 ? '#6fbf8b' : '#3a3026');
  els.warn.style.boxShadow = alarm ? `0 0 ${10 + 26 * w}px rgba(226,87,76,${0.4 + 0.5 * w})` : 'none';
  els.warn.style.transform = `scale(${1 + (alarm ? 0.1 * w : 0)})`;
  els.warn.style.borderColor = alarm ? '#e2574c' : '';

  // ticket window
  const tk1 = inOut(T, 10.0, 40.3, 0.45, 0.4), tk2 = inOut(T, 47.4, 50.6, 0.4, 0.4);
  const tk = Math.max(tk1, tk2);
  els.ticket.style.opacity = tk; els.ticket.style.transform = `translateX(${(1 - ease.out(tk)) * 60}px)`;
  if (tk2 > 0) {
    html(els['t-id'], 'TICKET #104 · REOPENED'); html(els['t-who'], 'Omar (Gym client)'); html(els['t-said'], '“My booking vanished too!”');
    html(els['t-reply'], ''); els['t-reply'].style.display = 'none';
    els['t-pill'].className = 'pill open'; html(els['t-pill'], 'REOPENED');
  } else {
    html(els['t-id'], 'TICKET #104'); html(els['t-who'], 'Priya (Lab client)'); html(els['t-said'], '“I booked Room 2 for tomorrow and it’s vanished!”');
    const done = T >= 36.6;
    els['t-pill'].className = done ? 'pill done' : 'pill open'; html(els['t-pill'], done ? 'RESOLVED ✓' : 'OPEN');
    els['t-pill'].style.transform = `scale(${1 + 0.25 * pulseAt(T, [36.6])})`;
    const reply = 'You: Sorted. Room 2 is yours tomorrow.';
    const n = Math.floor(k01(T, 36.8, 37.9) * reply.length);
    els['t-reply'].style.display = n > 0 ? '' : 'none';
    html(els['t-reply'], esc(reply.slice(0, n)) + (T >= 38.1 ? '<br><em>+10 XP · full credit (solved unaided)</em>' : ''));
  }

  // code window
  const cw = inOut(T, 16.5, 30.4, 0.45, 0.45);
  els.code.style.opacity = cw; els.code.style.transform = `translateX(${-(1 - ease.out(cw)) * 60}px)`;
  if (cw > 0) {
    const second = T >= 23.2;
    const src = second ? Q2 : Q1, a = second ? 23.4 : 17.0, b = second ? 26.9 : 19.9;
    const n = Math.floor(k01(T, a, b) * src.length);
    const caret = (T < b + 0.2) && Math.floor(T * 2.5) % 2 === 0 || (T >= a && T < b);
    html(els.src, highlight(src, n, caret));
    els.run.className = (T >= 20.3 && T < 20.8) || (T >= 27.3 && T < 27.8) ? 'run hot' : 'run';
    let r = '';
    if (T >= 20.55) {
      r += '<div class="row hdr"><span>id</span><span>room</span><span>day</span><span>status</span></div>';
      ROWDATA.forEach((row, i) => {
        if (T < ROWS[i].at) return;
        const fixed = i === 1 && T >= 27.4;
        const st = i === 1 ? (fixed ? '<span class="good">confirmed ✓</span>' : '<span class="bad">cancelled ✗</span>') : row[3];
        r += `<div class="row"><span>${row[0]}</span><span>${row[1]}</span><span>${row[2]}</span>${st}</div>`;
      });
      if (T >= 27.4) r += '<div class="status">✓ 1 row updated</div>';
      else if (T >= 22.0) r += '<div class="status" style="color:#e2574c">Booking 57 was cancelled by mistake.</div>';
    }
    html(els.res, r);
  }

  // skill card, then the skill map
  const sk = inOut(T, 40.3, 50.2, 0.45, 0.45);
  els.skill.style.opacity = sk; els.skill.style.transform = `translateX(${-(1 - ease.out(sk)) * 60}px)`;
  const fadeK = ease.inOut(k01(T, 45.5, 46.4));
  els['s-bar'].style.width = `${lerp(100, 32, fadeK)}%`;
  els['s-bar'].style.opacity = lerp(1, 0.55, fadeK);
  html(els['s-feel'], fadeK < 0.5 ? 'Feels: <b>fresh</b>' : 'Feels: <b style="color:#e0a060">fading</b> · review by Thursday');
  html(els['s-kept'], 'Kept: <b>3 days</b>');
  const sm = inOut(T, 58.2, 64.6, 0.45, 0.4);
  els.skillmap.style.opacity = sm; els.skillmap.style.transform = `translateX(${-(1 - ease.out(sm)) * 60}px)`;

  // floating labels
  const head = (a, h = 2.35) => a.p.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, h, 0));
  tag('priya', 'Priya · Lab client', '', head(priya), inOut(T, 7.4, 16.2, 0.3, 0.3) + inOut(T, 31.5, 35.0, 0.3, 0.3));
  tag('omar', 'Omar · Gym client', '', head(omar), inOut(T, 47.2, 50.8, 0.3, 0.3));
  tag('drone', 'Your fix, running', '', drone.position.clone().add(new THREE.Vector3(0, 0.55, 0)), inOut(T, 30.4, 34.6, 0.3, 0.3));
  for (const d of DISTRICTS) tag(d.sector, `New client: ${d.name}`, 'new', new THREE.Vector3(d.at[0], 3.2, d.at[2]), inOut(T, d.t + 0.3, 64.6, 0.3, 0.4), 0);
  const xp = inOut(T, 36.0, 38.2, 0.2, 0.5);
  els.xp.style.opacity = xp;
  if (xp > 0) { const v = new THREE.Vector3(3.4, 2.9, 1.9).project(camera); els.xp.style.left = `${(v.x * 0.5 + 0.5) * canvas.clientWidth}px`; els.xp.style.top = `${(-v.y * 0.5 + 0.5) * canvas.clientHeight - 60 * ease.out(k01(T, 36.0, 38.2))}px`; els.xp.style.transform = `translate(-50%,-50%) scale(${0.6 + 0.4 * ease.back(k01(T, 36.0, 36.4))})`; }

  // title, fades, sky
  const ti = k01(T, 65.0, 66.2);
  els.title.style.opacity = ti;
  els.title.querySelector('h1').style.transform = `scale(${lerp(0.92, 1, ease.out(ti))})`;
  els.title.querySelector('h2').style.opacity = k01(T, 65.6, 66.4);
  els.title.querySelector('p').style.opacity = k01(T, 66.6, 67.4);
  els.title.querySelector('small').style.opacity = k01(T, 68.2, 69.0);
  els.fade.style.opacity = Math.max(1 - ease.inOut(k01(T, 0, 2.6)), k01(T, 74.6, 76));
}

function applyWorld(T) {
  // light: dusk fades up, then the time-lapse nights
  const up = ease.inOut(k01(T, 0.2, 3.4)), nt = nightAt(T);
  const d = tget('light.dusk');
  sun.color.set(tget('light.sunColor')).lerp(sunDusk, d * 0.55).lerp(night, nt);
  sun.intensity = tget('light.sun') * (1 - 0.55 * d) * lerp(0.08, 1, up) * (1 - 0.92 * nt);
  hemi.color.set(0xffe0b5).lerp(skyDusk, d * 0.7 + nt * 0.3); hemi.intensity = tget('light.hemi') * (1 - 0.35 * d) * lerp(0.15, 1, up) * (1 - 0.8 * nt);
  rim.color.set(tget('light.rimColor')); rim.intensity = tget('light.rim') * (0.6 + 0.8 * d) * up;
  for (const l of lamps) l.intensity = (3 + 6 * nt) * up;
  renderer.toneMappingExposure = tget('light.exposure') * lerp(0.5, 1, up) * (1 - 0.35 * nt);
  sun.shadow.radius = Math.max(0.01, tget('light.shadowSoft'));
  const glowC = new THREE.Color(tget('palette.bgGlow')).lerp(new THREE.Color(0x1b2436), nt).multiplyScalar(lerp(0.3, 1, up));
  const bgC = new THREE.Color(tget('palette.bg')).lerp(new THREE.Color(0x06080d), nt);
  canvas.style.filter = nt > 0.001 ? `brightness(${1 - 0.55 * nt}) saturate(${1 - 0.3 * nt}) hue-rotate(${-12 * nt}deg)` : '';
  els.sky.style.background = `radial-gradient(ellipse 80% 70% at 50% 42%, #${glowC.getHexString()} 0%, #${bgC.getHexString()} 62%, #0a0806 100%)`;

  // door
  const open = Math.max(inOut(T, 6.2, 9.3, 0.7, 0.8), inOut(T, 46.3, 49.2, 0.7, 0.8));
  door.open(ease.inOut(open));

  // rows being read, and the fix
  ROWS.forEach((r, i) => {
    const o = inOut(T, r.at, 30.0, 0.2, 1.0) * (0.75 + 0.25 * Math.sin((T - r.at) * 6));
    const c = r.bad ? RED.clone().lerp(GREEN, k01(T, 27.4, 27.9)) : GOLD;
    r.m.material.opacity = Math.min(1, o * 1.15); r.m.material.color.copy(c);
    r.b.material.opacity = o * 0.55 * (1 + 0.8 * Math.max(0, 1 - (T - r.at) / 0.4)); r.b.material.color.copy(c);
    r.m.visible = r.b.visible = o > 0.001;
  });
  const g = k01(T, 35.8, 36.2) * (1 - k01(T, 42.0, 42.8));
  room2Glow.material.opacity = g * (0.6 + 0.4 * Math.exp(-Math.max(0, T - 35.8) * 1.2) + 0.08 * Math.sin(T * 4));
  room2Glow.visible = g > 0;

  // confetti
  for (const m of confetti) {
    const tau = T - CONF_T - m.userData.delay;
    m.visible = tau > 0 && tau < 4.5;
    if (!m.visible) continue;
    const { v, spin } = m.userData;
    const drag = (1 - Math.exp(-tau * 1.1)) / 1.1;
    m.position.set(confOrigin.x + v.x * drag, Math.max(0.02, confOrigin.y + v.y * drag - 4.9 * tau * tau * 0.55), confOrigin.z + v.z * drag);
    const landed = m.position.y <= 0.021;
    if (!landed) m.rotation.set(spin.x * tau, spin.y * tau, spin.z * tau); else m.rotation.set(-Math.PI / 2, 0, spin.z);
    m.material.opacity = 1 - k01(tau, 3.5, 4.5);
  }

  // drone
  const p = droneAt(T), p2 = droneAt(T + 0.08);
  drone.position.copy(p).add(new THREE.Vector3(0, Math.sin(T * 2.4) * 0.07, 0));
  const vx = p2.x - p.x, vz = p2.z - p.z, moving = Math.hypot(vx, vz) > 0.004;
  droneRig.rotation.y = moving ? Math.atan2(vx, vz) : 0.15 * Math.sin(T * 0.7);
  droneRig.rotation.x = moving ? 0.18 : 0;
  droneRing.rotation.set(Math.PI / 2 + 0.3 * Math.sin(T * 1.3), 0, T * 2.2);
  const hot = Math.max(pulseAt(T, [20.3, 27.3]), inOut(T, 35.8, 38.6, 0.2, 0.6));
  droneGlow.material.color.set(hot > 0 && T > 35 ? 0x8fffae : 0xffc862);
  droneGlow.material.opacity = 0.5 + 0.4 * hot;
  droneGlow.scale.setScalar(1.9 + 0.8 * hot);
  droneSpot.position.set(drone.position.x, 0.04, drone.position.z);
  drone.visible = droneSpot.visible = T > 1.0;
  droneRig.scale.setScalar(ease.back(k01(T, 1.0, 1.6)) || 1e-3);

  // districts and paths pop in
  for (const it of pops) {
    const k = k01(T, it.t, it.t + 0.38);
    it.obj.visible = k > 0;
    if (k > 0) it.obj.scale.setScalar(Math.max(1e-3, ease.back(k)));
  }
}

// ================================================================ the clock
let T = 0, playing = !CAPTURE;
function step(dt) {
  T += dt;
  while (evIdx < events.length && events[evIdx][0] <= T + 1e-9) { try { events[evIdx][1](); } catch (e) { console.error(e); } evIdx++; }
  for (const a of actors) a.step(T);
  for (const a of actors) a.p.update(dt, T);
}
function reset() { buildActors(); T = 0; for (const a of actors) a.step(0); }
function seek(t, render = true) {
  t = Math.max(0, Math.min(DURATION, t));
  if (t < T - 1e-6) reset();
  while (t - T > 1e-6) step(Math.min(STEP, t - T));
  applyWorld(T); cameraAt(T); applyOverlays(T);
  if (render) renderer.render(scene, camera);
  return T;
}
reset();
seek(0);
stage.frame((dt) => {
  if (!playing) { cameraAt(T); return; }
  let t = T + dt;
  if (t >= DURATION) { reset(); t = 0; }
  seek(t, false);
});
window.__trailer = {
  duration: DURATION,
  seek: (t) => seek(t),
  play() { playing = true; },
  pause() { playing = false; },
  get time() { return T; },
  ready: true,
};
