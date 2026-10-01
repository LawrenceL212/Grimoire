// intro.js: the story intro of the SISO world, played in the game's own engine and art pack (about 85 s).
//
// A late shift ends at the noodle bar; you walk home in your apron to a tiny room (a single bed, a wobbly desk, an
// old laptop) and say it out loud: "I'm not going to carry plates forever. I'm going to be a software developer."
// You register a company from the bedroom; on the desk sits an old leather book, the Grimoire, every page blank;
// three small drones blink awake one by one (Sequel, Jay, Hex), each saying hello; the doorbell chimes; GRIMOIRE.
//
// One master clock drives everything and the timeline is deterministic (as in the trailer): seek(t) rebuilds the
// actors and steps them from 0 in fixed 1/30 s steps when it goes backwards, and steps forwards otherwise.
// Captions (cues.json lines) are always shown. Voice: the pre-rendered line in voice/<id>.mp3 when it loads, else
// the browser's speechSynthesis (an en-GB voice if there is one, else any English voice), else captions alone.
// Music and effects go through game/engine/sfx.js and music.js when they load (dynamic import; no-ops if not).
//
//   window.__intro = { duration, lines, ready, time, seek(t), play(), pause(), skip(), dispose(), done (Promise -> { skipped }),
//                      voice: { mode, played }, disposed, frames, listening, reducedMotion, cameraPosition }
// Finishing or skipping disposes the page's stage (frame loop, WebGL, listeners, audio, speech); "Watch again" reloads.
// prefers-reduced-motion: no flicker or light pulses, still camera shots joined by cuts.
// URL: ?capture=1 (no autoplay, no sound: record.mjs steps it), ?autoplay=1 (no start card), ?mute=1 (no sound,
// voice attempts still recorded), ?voice=web (ignore the files, use speechSynthesis), ?next=<url> (go there at the end).
import * as THREE from 'three';
import { createStage } from '../engine/renderer.js';
import { theme, DEFAULTS, get as tget } from '../engine/theme.js';
import { make } from '../art/index.js';
import { tileField } from '../art/materials.js';
import { Person, registerCostume } from '../art/people.js';
import { Drone } from '../art/drone.js';
import { C } from '../art/parts.js';
import { chamfer, drum, ball } from '../art/shapes.js';
import { part, glow, floorGlow, canvasTex, ease, lerp } from '../engine/kit.js';

// ---- the Warm dusk preset, in memory only (never written to the viewer's saved theme)
(function warmDusk() {
  const copy = (into, from) => { for (const k of Object.keys(from)) { if (from[k] && typeof from[k] === 'object') copy(into[k] ??= {}, from[k]); else into[k] = from[k]; } };
  copy(theme, JSON.parse(JSON.stringify(DEFAULTS)));
})();

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture'), AUTOPLAY = Q.has('autoplay') || CAPTURE, MUTE = Q.has('mute') || CAPTURE, FORCE_WEB = Q.get('voice') === 'web';
const STEP = 1 / 30;
// prefers-reduced-motion: no flicker or pulsing lights, and still camera shots joined by cuts instead of drifts
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ac = new AbortController(); // every listener this page adds goes through it, so dispose() removes them all
const on = (target, ev, fn, opts = {}) => target.addEventListener(ev, fn, { ...opts, signal: ac.signal });
const $ = (id) => document.getElementById(id);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const k01 = (t, a, b) => clamp01((t - a) / (b - a));
const inOut = (t, a, b, fi = 0.4, fo = 0.4) => Math.min(k01(t, a, a + fi), 1 - k01(t, b - fo, b));
const rad = THREE.MathUtils.degToRad;
const hexC = (path) => new THREE.Color(tget(path));

const cues = await fetch(new URL('./cues.json', import.meta.url)).then((r) => r.json());
let lengths = {};
try { lengths = await fetch(new URL('./voice/lengths.json', import.meta.url)).then((r) => (r.ok ? r.json() : {})); } catch { lengths = {}; }
const DURATION = cues.duration;
const LINES = cues.lines.map((l) => ({ ...l, len: lengths[l.id] ?? Math.max(2.2, l.text.split(/\s+/).length / 2.5) }));

// ================================================================ stage and light
const canvas = $('c');
const stage = createStage(canvas, { reducedMotion: RM });
const { scene, camera, renderer } = stage;
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
const hemi = new THREE.HemisphereLight(0xffe0b5, 0x2a1d14, 1);
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
{ const c = sun.shadow.camera; c.left = c.bottom = -12; c.right = c.top = 12; c.near = 1; c.far = 80; }
const rim = new THREE.DirectionalLight(0x8f86ff, 1); rim.position.set(18, 24, -36);
scene.add(hemi, sun, sun.target, rim);

// ================================================================ the apron (a costume over the waiter)
registerCostume('noodle-apron', {
  forRole() {
    const M = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    return {
      parts: [
        { bone: 'spine', slot: 'apron', geo: chamfer(0.25, 0.2, 0.022, 0.008), m: M(0, 0.12, 0.132), outline: 0.008 },
        { bone: 'pelvis', slot: 'apron', geo: chamfer(0.36, 0.44, 0.022, 0.01), m: M(0, -0.19, 0.152), outline: 0.008 },
        { bone: 'pelvis', slot: 'apronTie', geo: chamfer(0.4, 0.04, 0.03, 0.01), m: M(0, 0.02, 0.15), outline: 0.006 },
        { bone: 'pelvis', slot: 'apronTie', geo: chamfer(0.12, 0.08, 0.02, 0.008), m: M(0.02, -0.06, 0.168), outline: 0.006 },
      ],
      slots: { apron: 'palette.fabricAlt', apronTie: 'palette.sheet' },
    };
  },
});

// ================================================================ helpers
const place = (g, id, x, z, ry = 0, y = 0, opts = {}) => { const o = make(id, opts); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
const box = (g, w, h, d, mat, x, y, z, o = {}) => part(chamfer(w, h, d, Math.min(0.02, w / 4, h / 4, d / 4)), mat, { parent: g, x, y, z, outline: 0.012, ...o });
function signTex(w, h, draw) { return canvasTex(w, h, draw); }
function plane(g, w, h, tex, x, y, z, ry = 0, { glowing = false } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: !glowing, depthWrite: !glowing }));
  m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m;
}
function lamp(g, x, y, z, color, intensity = 6, dist = 7) {
  const l = new THREE.PointLight(color, intensity, dist, 1.6); l.position.set(x, y, z); g.add(l);
  const b = glow(color, 0.9, 0.7); b.position.set(x, y, z); g.add(b);
  return { l, b };
}

// ================================================================ set A: the noodle bar (x = 0)
const A = new THREE.Group(); A.name = 'noodle-bar'; scene.add(A);
const AX = 0;
A.position.x = AX;
{
  const cells = []; for (let x = -4.5; x <= 4.5; x++) for (let z = -2.5; z <= 2.5; z++) cells.push([x, z]);
  A.add(tileField('ceramic', cells, { seed: 5 }));
  for (let x = -4.5; x <= 4.5; x++) place(A, x === 2.5 || x === 3.5 ? 'wall-window' : 'wall-segment', x, -3.15);
  for (let z = -2.5; z <= 2.5; z++) place(A, 'wall-segment', -5.15, z, Math.PI / 2);
  place(A, 'plant-tall', -4.5, 2.3, 0.4); place(A, 'plant-small', 4.4, -2.4);
}
// the counter: a long bar with a kitchen pass behind it
const counterTop = C('woodLight'), counterBody = C('woodDark');
box(A, 5.4, 0.98, 0.62, counterBody, -0.3, 0.49, -0.25);
box(A, 5.6, 0.07, 0.8, counterTop, -0.3, 1.0, -0.2);
for (const x of [-2.4, -1.2, 0, 1.2]) { // stools in front of it
  part(drum(0.035, 0.68, 8), C('chrome'), { parent: A, x, y: 0.34, z: 0.55, outline: 0.006 });
  part(drum(0.2, 0.08, 14), C('fabricAlt'), { parent: A, x, y: 0.72, z: 0.55, outline: 0.01 });
  part(drum(0.17, 0.03, 12), C('metal'), { parent: A, x, y: 0.015, z: 0.55, outline: 0.006 });
}
function bowl(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
  part(drum(0.13, 0.09, 16, 0.03), C('plastic'), { parent: g, y: 0.045, outline: 0.008 });
  part(drum(0.11, 0.02, 14), C('bulb'), { parent: g, y: 0.085, outline: 0 });
  part(drum(0.005, 0.26, 4), C('woodLight'), { parent: g, x: 0.03, y: 0.15, rz: 0.5, outline: 0.003 });
  part(drum(0.005, 0.26, 4), C('woodLight'), { parent: g, x: 0.05, y: 0.15, rz: 0.42, outline: 0.003 });
  return g;
}
bowl(A, -2.3, 1.035, -0.15); bowl(A, -1.0, 1.035, -0.3);
const servedBowl = bowl(A, 0, 0, 0); // carried, then set down
// the sign: "noodle bar" in warm neon, over the pass
const neon = signTex(1024, 300, (g) => {
  g.clearRect(0, 0, 1024, 300);
  g.fillStyle = 'rgba(30,14,10,0.92)'; g.beginPath(); g.roundRect(14, 20, 996, 260, 48); g.fill();
  g.strokeStyle = tget('palette.gold'); g.lineWidth = 8; g.stroke();
  g.shadowColor = '#ff7a3c'; g.shadowBlur = 34; g.fillStyle = '#ffd9a0';
  g.font = 'italic 700 150px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('noodle bar', 560, 150);
  g.strokeStyle = '#ffb066'; g.lineWidth = 9; g.beginPath(); g.arc(120, 168, 54, 0, Math.PI); g.stroke(); // a bowl
  g.beginPath(); g.moveTo(84, 108); g.lineTo(152, 60); g.moveTo(104, 112); g.lineTo(168, 72); g.stroke();
});
plane(A, 3.6, 1.05, neon, -0.3, 2.55, -3.0, 0, { glowing: true });
const neonGlow = glow(0xff9a50, 4.2, 0.5); neonGlow.position.set(-0.3, 2.55, -2.8); A.add(neonGlow);
// the OPEN / CLOSED card in the window
const openTex = (word, col) => signTex(256, 110, (g) => { g.fillStyle = '#1b1310'; g.beginPath(); g.roundRect(4, 4, 248, 102, 16); g.fill(); g.fillStyle = col; g.font = '800 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, 128, 58); });
const OPEN_TEX = openTex('OPEN', '#ff8a4a'), CLOSED_TEX = openTex('CLOSED', '#8a7a68');
const openSign = plane(A, 0.62, 0.27, OPEN_TEX, 3.0, 1.6, -3.02, 0, { glowing: true });
const barLamps = [-2.2, -0.3, 1.6].map((x) => {
  part(new THREE.ConeGeometry(0.22, 0.2, 14, 1, true), C('metal'), { parent: A, x, y: 2.35, z: -0.2, outline: 0.008 });
  part(drum(0.006, 0.9, 4), C('metal'), { parent: A, x, y: 2.9, z: -0.2, outline: 0 });
  return lamp(A, x, 2.15, -0.2, 0xffc98a, 7, 6);
});

// ================================================================ set B: the walk home (x = 60)
const B = new THREE.Group(); B.name = 'street'; scene.add(B);
const BX = 60; B.position.x = BX;
{
  const cells = []; for (let x = -8.5; x <= 8.5; x++) for (let z = -0.5; z <= 2.5; z++) cells.push([x, z]);
  B.add(tileField('concrete', cells, { seed: 9 }));
  for (let x = -8.5; x <= 8.5; x++) place(B, x % 3 === 0.5 || x % 4 === -1.5 ? 'wall-window' : 'wall-segment', x, -1.15);
  place(B, 'plant-tall', -2.6, -0.6, 0.3); place(B, 'plant-small', 3.4, -0.6); place(B, 'crate-stack', 6.4, -0.55, 0.2);
}
const streetSign = plane(B, 2.2, 0.64, neon, -6.0, 2.35, -1.0, 0, { glowing: true });
const streetSignGlow = glow(0xff9a50, 3, 0.45); streetSignGlow.position.set(-6.0, 2.35, -0.8); B.add(streetSignGlow);
const streetLamps = [-3.5, 1.5, 6.5].map((x) => {
  part(drum(0.05, 3.0, 8), C('metal'), { parent: B, x, y: 1.5, z: 2.4, outline: 0.008 });
  part(ball(0.13, 10), C('bulb'), { parent: B, x, y: 3.05, z: 2.4, outline: 0.006 });
  return lamp(B, x, 3.0, 2.4, 0xffd9a0, 9, 7);
});
const moon = glow(0xcfd8ff, 3.2, 0.9); moon.position.set(4, 7.5, -6); B.add(moon);

// ================================================================ set C: the tiny room (x = 120)
const Cr = new THREE.Group(); Cr.name = 'room'; scene.add(Cr);
const CX = 120; Cr.position.x = CX;
{
  const cells = []; for (let x = -1.5; x <= 1.5; x++) for (let z = -1.5; z <= 1.5; z++) cells.push([x, z]);
  Cr.add(tileField('wood', cells, { seed: 4 }));
  for (let x = -1.5; x <= 1.5; x++) place(Cr, x === 0.5 ? 'wall-window' : 'wall-segment', x, -2.15);
  for (const z of [-1.5, -0.5, 1.5]) place(Cr, 'wall-segment', -2.15, z, Math.PI / 2);
  place(Cr, 'plant-small', 1.6, 1.6, 0.6);
}
const roomDoor = place(Cr, 'door', -2.15, 0.5, Math.PI / 2);
// the apron hangs on the door once he is home
const apronOnDoor = new THREE.Group(); apronOnDoor.position.set(-2.02, 1.25, 0.82); apronOnDoor.rotation.y = Math.PI / 2; Cr.add(apronOnDoor);
box(apronOnDoor, 0.34, 0.62, 0.02, C('fabricAlt'), 0, -0.18, 0, { outline: 0.006 });
box(apronOnDoor, 0.24, 0.22, 0.02, C('fabricAlt'), 0, 0.22, 0, { outline: 0.006 });
part(drum(0.03, 0.08, 6), C('chrome'), { parent: apronOnDoor, y: 0.36, rx: Math.PI / 2, outline: 0 });
// the single bed
box(Cr, 1.0, 0.32, 2.0, C('woodDark'), 1.42, 0.16, -0.95);
box(Cr, 0.92, 0.16, 1.9, C('sheet'), 1.42, 0.38, -0.95, { outline: 0.008 });
box(Cr, 0.96, 0.12, 1.25, C('fabric'), 1.42, 0.47, -0.6, { outline: 0.008 });
box(Cr, 0.62, 0.12, 0.32, C('plastic'), 1.42, 0.5, -1.72, { outline: 0.008 });
box(Cr, 1.02, 0.72, 0.08, C('woodDark'), 1.42, 0.36, -1.98);
// the wobbly desk: a small top on four thin legs, one of them propped on a folded card
const desk = new THREE.Group(); desk.position.set(-0.85, 0, -1.68); Cr.add(desk);
box(desk, 1.25, 0.05, 0.6, C('woodLight'), 0, 0.74, 0);
for (const [x, z, h] of [[-0.56, -0.24, 0.72], [0.56, -0.24, 0.72], [-0.56, 0.24, 0.72], [0.56, 0.24, 0.69]]) part(chamfer(0.04, h, 0.04, 0.008), C('woodDark'), { parent: desk, x, y: h / 2 + (0.72 - h), z, outline: 0.006 });
box(desk, 0.1, 0.03, 0.08, C('cork'), 0.56, 0.015, 0.24, { outline: 0.004 });
const chair = place(Cr, 'office-chair', -0.9, -1.0, Math.PI);
place(Cr, 'desk-lamp', -1.32, -1.78, 0.5, 0.765);
place(Cr, 'mug', 0.3, -1.6, 0.4, 0.765);
// the old laptop, its screen a live canvas
const laptop = new THREE.Group(); laptop.position.set(-0.85, 0.765, -1.62); desk.parent.add(laptop);
box(laptop, 0.46, 0.025, 0.32, C('metal'), 0, 0.012, 0, { outline: 0.006 });
const lid = new THREE.Group(); lid.position.set(0, 0.02, -0.15); lid.rotation.x = -0.32; laptop.add(lid);
box(lid, 0.46, 0.3, 0.02, C('metal'), 0, 0.15, 0, { outline: 0.006 });
const screenCanvasTex = canvasTex(320, 200, () => {});
const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ map: screenCanvasTex, toneMapped: false }));
screenMesh.position.set(0, 0.15, 0.012); lid.add(screenMesh);
const screenLight = new THREE.PointLight(0xbcd4ff, 0, 2.2, 1.6); screenLight.position.set(-0.85, 1.05, -1.3); Cr.add(screenLight);
// the Grimoire on the desk: an old leather book that opens
const book = new THREE.Group(); book.position.set(-0.2, 0.765, -1.55); book.rotation.y = -0.25; Cr.add(book);
const leather = C('hair2'); // old brown leather (the theme's warm brown)
box(book, 0.3, 0.045, 0.4, C('sheet'), 0, 0.03, 0, { outline: 0.006 });
box(book, 0.31, 0.012, 0.41, leather, 0, 0.006, 0, { outline: 0.006 });
const cover = new THREE.Group(); cover.position.set(-0.155, 0.056, 0); book.add(cover);
box(cover, 0.31, 0.014, 0.41, leather, 0.155, 0, 0, { outline: 0.006 });
const sigilTex = canvasTex(128, 128, (g) => { g.strokeStyle = tget('palette.gold'); g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 46, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(64, 22); g.lineTo(100, 86); g.lineTo(28, 86); g.closePath(); g.stroke(); });
const sigil = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ map: sigilTex, transparent: true, toneMapped: false }));
sigil.rotation.x = -Math.PI / 2; sigil.position.set(0.155, 0.009, 0); cover.add(sigil);
// a gold clasp: a strap over the fore-edge and a little plate on the cover, and gold corners
box(cover, 0.07, 0.018, 0.09, C('gold'), 0.29, 0.004, 0, { outline: 0.004 });
box(book, 0.03, 0.06, 0.07, C('gold'), 0.165, 0.03, 0, { outline: 0.004 });
for (const z of [-0.185, 0.185]) box(cover, 0.045, 0.018, 0.045, C('gold'), 0.285, 0.002, z, { outline: 0.003 });
const bookGlow = glow(0xffd28a, 1.4, 0); bookGlow.position.set(-0.2, 1.0, -1.55); Cr.add(bookGlow);
const bookLight = new THREE.PointLight(0xffd28a, 0, 3, 1.6); bookLight.position.set(-0.2, 1.2, -1.4); Cr.add(bookLight);
// the shelf the drones sleep on
const SHELF_Y = 1.72;
box(Cr, 1.7, 0.05, 0.28, C('woodLight'), -0.85, SHELF_Y, -1.92);
for (const x of [-1.6, -0.1]) box(Cr, 0.04, 0.16, 0.2, C('woodDark'), x, SHELF_Y - 0.1, -1.95, { outline: 0.004 });
// room light: the desk lamp, the window's night, the doorbell's glow
const deskLamp = lamp(Cr, -1.3, 1.25, -1.6, 0xffc98a, 4, 5);
const windowNight = new THREE.PointLight(0x7f8cff, 2, 5, 1.6); windowNight.position.set(0.5, 2, -1.6); Cr.add(windowNight);
const doorGlow = glow(0xffe0a0, 2.4, 0); doorGlow.position.set(-2.0, 1.2, 0.5); Cr.add(doorGlow);
const doorLight = new THREE.PointLight(0xffe0a0, 0, 4, 1.6); doorLight.position.set(-1.8, 1.4, 0.5); Cr.add(doorLight);

// ================================================================ the laptop screen (a sign-up page)
const NAME = 'Siso Bookings Ltd', DIRECTOR = 'You', OFFICE = 'A tiny bedroom';
const typed = (s, T, a, b) => s.slice(0, Math.floor(k01(T, a, b) * s.length));
let screenKey = '';
function drawScreen(T) {
  const n = typed(NAME, T, 31.0, 33.0), d = typed(DIRECTOR, T, 33.3, 33.9), o = typed(OFFICE, T, 34.1, 35.2), done = T >= 36.2, on = T >= 28.6;
  const key = `${on}|${n}|${d}|${o}|${done}`;
  if (key === screenKey) return;
  screenKey = key;
  const g = screenCanvasTex.userData.canvas.getContext('2d');
  g.fillStyle = on ? '#f4efe4' : '#0c0d12'; g.fillRect(0, 0, 320, 200);
  if (on) {
    g.fillStyle = '#2a221b'; g.fillRect(0, 0, 320, 24);
    g.fillStyle = '#3a2a1c'; g.font = '700 20px system-ui, sans-serif'; g.fillText('Register your company', 16, 50);
    [['Company name', n], ['Director', d], ['Office', o]].forEach(([l, v], i) => {
      g.fillStyle = '#7a6a58'; g.font = '600 11px system-ui, sans-serif'; g.fillText(l.toUpperCase(), 16, 72 + i * 36);
      g.strokeStyle = '#c9bba3'; g.lineWidth = 2; g.strokeRect(16, 77 + i * 36, 288, 20);
      g.fillStyle = '#1d1915'; g.font = '600 14px system-ui, sans-serif'; g.fillText(v, 22, 92 + i * 36);
    });
    g.fillStyle = done ? '#6fbf8b' : '#3a2a1c'; g.fillRect(16, 178, 288, 18);
    g.fillStyle = done ? '#10200f' : '#f3e3bd'; g.font = '700 12px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(done ? 'Registered ✓' : 'Register', 160, 191); g.textAlign = 'left';
  }
  screenCanvasTex.needsUpdate = true;
}

// ================================================================ actors (rebuilt on every rewind)
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function along(pts, d) {
  if (d <= 0) return { x: pts[0][0], z: pts[0][1], dx: pts[1][0] - pts[0][0], dz: pts[1][1] - pts[0][1], done: false };
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], l = Math.hypot(bx - ax, bz - az);
    if (d <= l) { const k = d / l; return { x: lerp(ax, bx, k), z: lerp(az, bz, k), dx: bx - ax, dz: bz - az, done: false }; }
    d -= l;
  }
  const n = pts.length - 1;
  return { x: pts[n][0], z: pts[n][1], dx: pts[n][0] - pts[n - 1][0], dz: pts[n][1] - pts[n - 1][1], done: true };
}
let actors = [], drones = [], events = [], evIdx = 0, you = null, diner = null;
class Actor {
  constructor(opts, { parent, x, z, yaw = 0, show = [0, 1e9], segs = [] }) {
    this.p = new Person({ reducedMotion: RM, ...opts });
    this.p.root.position.set(x, 0, z); this.p.yaw = this.p.targetYaw = yaw;
    parent.add(this.p.root);
    Object.assign(this, { show, segs, ctrl: 'kin' });
    actors.push(this);
  }
  segAt(T) { let s = null; for (const g of this.segs) if (g.t0 <= T) s = g; return s; }
  step(T) {
    const p = this.p;
    if (this.ctrl === 'kin') {
      const s = this.segAt(T);
      if (s) {
        const a = along(s.pts, (T - s.t0) * s.speed);
        p.root.position.set(a.x, 0, a.z); p.speed = s.speed;
        if (!a.done) { p.targetYaw = Math.atan2(a.dx, a.dz); if (p.state !== 'walk') p.play('walk'); }
        else { if (s.face !== undefined) p.targetYaw = s.face; if (p.state === 'walk') p.play(s.rest || 'idle'); }
      }
    }
    p.root.visible = T >= this.show[0] && T < this.show[1];
  }
}
// a drone asleep on the shelf until it wakes (wake: the time its screen flickers on)
const DS = 0.42; // the drones are small in the room
const lensDrop = 0.16 * 1.4; // the lens hangs this far below the body's centre (rig units, at drone.scale)
class Sleeper {
  constructor(persona, x, wake, hover) {
    this.d = new Drone({ persona, reducedMotion: RM });
    this.d.root.scale.setScalar(DS);
    this.d.root.position.set(x, 0, -1.92);
    this.rest = (SHELF_Y + 0.025) / DS + lensDrop + 0.04;
    this.d.alt = this.rest;
    this.d.faceCamera(camera);
    if (this.d.label) { this.d.label.scale.multiplyScalar(2.1); this.d.label.position.y = 0.66; } // the name stays readable on a small drone
    Cr.add(this.d.root);
    Object.assign(this, { persona, wake, hover, x });
    drones.push(this);
  }
  power(T) { // 0 asleep .. 1 awake, with a flicker as the screen comes on
    if (T < this.wake) return 0;
    const k = k01(T, this.wake, this.wake + 0.7);
    return k < 1 ? (RM ? k : k * (0.55 + 0.45 * Math.abs(Math.sin((T - this.wake) * 38)))) : 1;
  }
  step(T, dt) {
    const d = this.d, on = this.power(T), awake = T >= this.wake;
    if (awake && !this.flying && T >= this.wake + 0.5) { // lift off the shelf to its place in the room
      this.flying = true; d.express('happy', 2.5);
      d.flyTo([this.hover[0], this.hover[2]], { alt: this.hover[1] / DS });
    }
    d.update(dt, T);
    if (!awake || !this.flying) { // asleep: still, dark, resting on the shelf
      d.body.position.y = this.rest; d.tilt.rotation.set(0, 0, 0);
      for (const a of d.arms) { a.blade.rotation.y = 0.7; a.disc.visible = false; }
    } else for (const a of d.arms) a.disc.visible = true;
    d.faceMesh.material.color.setScalar(0.04 + 0.96 * on);
    d.ringMat.color.multiplyScalar(0.12 + 0.88 * on);
    if (d.label) d.label.visible = T >= this.wake + 0.9;
    d.blob.visible = awake && this.flying;
  }
}
function buildActors() {
  for (const a of actors) a.p.dispose();
  for (const s of drones) s.d.dispose();
  actors = []; drones = []; evIdx = 0;
  servedBowl.removeFromParent();
  // set A: you, in an apron, carrying the last bowl; the last diner at the counter
  you = new Actor({ role: 'office', seed: 21, name: 'You', hairStyle: 'short', hair: 'hair1', skin: 'skin3', glasses: false, beard: false, prop: null, costume: 'noodle-apron' }, {
    parent: A, x: -4.2, z: 1.7, yaw: Math.PI / 2, show: [0, 14.8],
    segs: [
      { t0: 0.9, pts: [[-4.2, 1.7], [-1.3, 1.35], [-0.6, 0.8]], speed: 1.2, face: Math.PI },
      { t0: 6.4, pts: [[-0.6, 0.8], [-1.5, 1.7]], speed: 0.9, face: 0.5 },
    ],
  });
  diner = new Actor({ role: 'office', seed: 8, name: 'Diner', prop: null }, { parent: A, x: 0, z: 0.55, yaw: Math.PI, show: [0, 11.3],
    segs: [{ t0: 9.4, pts: [[0, 1.0], [2.0, 1.8], [3.6, 2.4]], speed: 1.3, face: 0 }] });
  diner.ctrl = 'free';
  diner.p.sit({ position: [0, 0.76, 0.55], facing: Math.PI, height: 0.76 });
  you.p.hold(servedBowl, 'R');
  // set B: the same you, walking home
  const walker = new Actor({ role: 'office', seed: 21, name: 'You', hairStyle: 'short', hair: 'hair1', skin: 'skin3', glasses: false, beard: false, prop: null, costume: 'noodle-apron' }, {
    parent: B, x: -6.2, z: 0.2, yaw: Math.PI / 2, show: [14.6, 21.8],
    segs: [{ t0: 15.2, pts: [[-6.2, 0.2], [-5.6, 0.9], [6.8, 0.9]], speed: 1.55, face: Math.PI / 2 }],
  });
  // set C: home
  const home = new Actor({ role: 'office', seed: 21, name: 'You', hairStyle: 'short', hair: 'hair1', skin: 'skin3', glasses: false, beard: false, prop: null, costume: 'noodle-apron' }, {
    parent: Cr, x: -2.6, z: 0.5, yaw: Math.PI / 2, show: [21.8, 1e9],
    segs: [
      { t0: 22.0, pts: [[-2.6, 0.5], [-1.6, 0.5], [-0.7, 0.35]], speed: 1.2, face: 0.35 },
      { t0: 27.9, pts: [[-0.7, 0.35], [-0.9, -0.45]], speed: 1.1, face: Math.PI },
      { t0: 73.0, pts: [[-0.9, -0.3], [-1.2, 0.3]], speed: 1.1, face: -Math.PI / 2 },
    ],
  });
  const sequel = new Sleeper('sequel', -1.42, 52.4, [-1.6, 1.75, -0.7]);
  const jay = new Sleeper('jay', -0.85, 59.6, [-0.75, 2.0, -0.3]);
  const hex = new Sleeper('hex', -0.28, 65.2, [0.2, 1.7, -0.75]);
  events = [
    [4.3, () => { you.p.release('R'); servedBowl.position.set(-0.12, 1.035, -0.05); servedBowl.rotation.set(0, 0, 0); A.add(servedBowl); }],
    [4.5, () => { diner.p.express('happy', 3); you.p.play('talk'); you.p.express('happy', 2); }],
    [6.0, () => you.p.play('idle')],
    [8.6, () => { you.p.play('idle'); you.p.express('happy', 2); }],
    [8.8, () => { diner.p.stand(); }],
    [9.4, () => { diner.ctrl = 'kin'; }],
    [9.5, () => you.p.play('wave')],
    [11.0, () => you.p.play('idle')],
    [12.2, () => you.p.express('thinking', 2.4)],
    [17.0, () => walker.p.express('thinking', 3.2)],
    [22.5, () => { home.p.setCostume('none'); }],
    [22.6, () => { home.p.play('talk'); home.p.express('focused', 5.2); }],
    [27.5, () => { home.p.play('idle'); home.p.express('happy', 1.2); }],
    [28.6, () => { home.ctrl = 'free'; home.p.sit(chair); }],
    [30.6, () => home.p.play('type')],
    [35.6, () => home.p.play('sit')],
    [36.3, () => { home.p.play('celebrate'); home.p.express('happy', 2); }],
    [37.6, () => home.p.play('sit')],
    [38.3, () => { home.p.express('surprised', 2.2); home.p.lookAt(new THREE.Vector3(CX - 0.2, 0.8, -1.55)); }],
    [52.6, () => { home.p.express('surprised', 1.6); home.p.lookAt(new THREE.Vector3(CX - 1.6, 1.8, -1.2)); }],
    [55.4, () => home.p.express('happy', 3)],
    [59.8, () => { home.p.lookAt(new THREE.Vector3(CX - 0.6, 2.0, -0.6)); home.p.express('surprised', 1.2); }],
    [61.4, () => home.p.express('happy', 3)],
    [65.4, () => { home.p.lookAt(new THREE.Vector3(CX + 0.3, 1.7, -0.8)); }],
    [67.0, () => home.p.express('happy', 4)],
    [71.9, () => { home.p.lookAt(null); home.p.express('surprised', 1.4); }],
    [72.4, () => { home.p.stand(); }],
    [73.0, () => { home.ctrl = 'kin'; }],
    [73.6, () => { home.p.express('happy', 6); }],
    [72.6, () => sequel.d.flyTo([-1.75, 0.15], { alt: 2.2 / DS })],
    [72.9, () => jay.d.flyTo([-0.7, 0.95], { alt: 2.5 / DS })],
    [73.2, () => hex.d.flyTo([-0.2, -0.25], { alt: 2.25 / DS })],
    [74.6, () => { for (const s of drones) s.d.express('happy', 4); }],
  ].sort((a, b) => a[0] - b[0]);
}

// ================================================================ camera keys (t, target xyz, distance, pitch, yaw)
const CAM = [
  [0, AX - 1.2, 1.0, 0.6, 12, 58, -16], [6, AX - 0.6, 1.0, 0.5, 9.5, 60, -8], [14.6, AX - 0.6, 1.1, 0.6, 7.6, 62, 6],
  [14.61, BX - 5.0, 1.0, 0.8, 11, 66, 8], [21.7, BX + 5.0, 1.0, 0.8, 11, 66, -4],
  [21.71, CX - 0.9, 1.0, -0.2, 8.2, 56, 18], [27.5, CX - 0.6, 1.1, -0.3, 6.6, 58, 12],
  [29.0, CX - 0.8, 1.0, -1.1, 4.8, 54, 4], [37.4, CX - 0.6, 1.0, -1.2, 4.4, 52, -6],
  [40.5, CX - 0.25, 0.8, -1.5, 2.4, 36, 38], [51.0, CX - 0.2, 0.8, -1.5, 2.2, 34, 42],
  [53.5, CX - 1.0, 1.5, -0.9, 5.4, 64, 4], [66.5, CX - 0.6, 1.5, -0.8, 5.9, 66, 0],
  [71.5, CX - 0.7, 1.3, -0.4, 6.8, 62, 14], [76.0, CX - 0.9, 1.2, 0.0, 7.4, 60, 22], [85, CX - 0.9, 1.2, 0.0, 8.2, 58, 26],
];
// reduced motion: a few still shots (the keys where a shot starts), cut from one to the next
const CAM_RM = CAM.filter((c) => [0, 14.61, 21.71, 29.0, 40.5, 53.5, 71.5].includes(c[0]));
function cameraAt(T) {
  const keys = RM ? CAM_RM : CAM;
  let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= T) i++;
  if (RM && keys[i + 1][0] <= T) i++;
  const a = keys[i], b = RM ? keys[i] : keys[i + 1], k = RM ? 0 : ease.inOut(k01(T, a[0], b[0]));
  const v = a.map((x, j) => lerp(x, b[j], k));
  const [, tx, ty, tz, d, pitch, yaw] = v;
  const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720, portrait = h > w;
  const dist = d * (portrait ? 1.5 : 1);
  const p = rad(pitch), y = rad(yaw);
  camera.fov = 32;
  camera.aspect = w / h;
  camera.position.set(tx + Math.sin(p) * Math.sin(y) * dist, ty + Math.cos(p) * dist, tz + Math.sin(p) * Math.cos(y) * dist);
  camera.lookAt(tx, ty, tz);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  sun.target.position.set(tx, 0, tz); sun.position.copy(sun.target.position).add(new THREE.Vector3(-0.5, 0.95, 0.55).normalize().multiplyScalar(40));
}

// ================================================================ overlays
const els = Object.fromEntries(['caption', 'cap-who', 'cap-text', 'signup', 'f-name', 'f-dir', 'f-office', 'f-submit', 'page', 'page-ink', 'title', 'fade', 'sky'].map((id) => [id, $(id)]));
const WHO = { narrator: null, you: { label: 'You', col: 'palette.gold' }, sequel: { label: 'Sequel · SQL', col: 'palette.droneSequelRing' }, jay: { label: 'Jay · JavaScript', col: 'palette.droneJayRing' }, hex: { label: 'Hex · PHP', col: 'palette.droneHexRing' } };
const lineAt = (T) => LINES.find((l) => T >= l.at - 0.15 && T < l.at + l.len + 0.4) || null;
const lastText = new Map();
const text = (el, s) => { if (lastText.get(el) !== s) { el.textContent = s; lastText.set(el, s); } };
const INK_LINE = 'Every spell you truly learn will be written in here. Stop using it, and the ink fades.';
function applyOverlays(T) {
  const l = lineAt(T);
  if (l) {
    const o = inOut(T, l.at - 0.15, l.at + l.len + 0.4, 0.25, 0.3);
    els.caption.style.opacity = o;
    els.caption.style.translate = `0 ${(1 - o) * 10}px`;
    const who = WHO[l.who];
    text(els['cap-who'], who ? who.label : '');
    if (who) els.caption.style.setProperty('--who', tget(who.col));
    text(els['cap-text'], l.who === 'you' ? `“${l.text}”` : l.text);
    els['cap-text'].classList.toggle('quote', l.who === 'you');
    els.caption.dataset.line = l.id;
  } else { els.caption.style.opacity = 0; els.caption.dataset.line = ''; }
  // the laptop's sign-up page
  const su = inOut(T, 30.0, 37.8, 0.45, 0.45);
  els.signup.style.opacity = su; els.signup.style.translate = `${(1 - ease.out(su)) * 40}px 0`;
  if (su > 0) {
    const n = typed(NAME, T, 31.0, 33.0), d = typed(DIRECTOR, T, 33.3, 33.9), o = typed(OFFICE, T, 34.1, 35.2);
    text(els['f-name'], n); text(els['f-dir'], d); text(els['f-office'], o);
    els['f-name'].classList.toggle('on', T >= 30.8 && T < 33.1); els['f-dir'].classList.toggle('on', T >= 33.1 && T < 34.0); els['f-office'].classList.toggle('on', T >= 34.0 && T < 35.3);
    const done = T >= 36.2;
    text(els['f-submit'], done ? 'Registered ✓  Company No. 00000001' : 'Register');
    els['f-submit'].classList.toggle('done', done);
    els['f-submit'].style.transform = `scale(${T >= 35.6 && T < 35.9 ? 0.96 : 1})`;
  }
  // the blank page, then the ink: written in, then fading
  const pg = inOut(T, 44.6, 52.0, 0.6, 0.6);
  els.page.style.opacity = pg;
  if (pg > 0) {
    text(els['page-ink'], INK_LINE.slice(0, Math.floor(k01(T, 45.6, 49.6) * INK_LINE.length)));
    els['page-ink'].style.opacity = 1 - 0.75 * ease.inOut(k01(T, 50.0, 51.6));
  }
  // title and fades
  const ti = k01(T, 76.8, 78.2);
  els.title.style.opacity = ti;
  els.title.querySelector('h1').style.transform = `scale(${lerp(0.94, 1, ease.out(ti))})`;
  els.title.querySelector('p').style.opacity = k01(T, 78.4, 79.4);
  const cut = (a, b) => Math.min(k01(T, a - 0.6, a), 1 - k01(T, b, b + 0.8)); // to black at a, back by b + 0.8
  els.fade.style.opacity = Math.max(1 - ease.inOut(k01(T, 0, 2.2)), cut(14.6, 14.6), cut(21.8, 21.8), k01(T, 83.6, 85));
}

function applyWorld(T, dt) {
  // the sky behind each set
  const set = T < 14.6 ? 'A' : T < 21.8 ? 'B' : 'C';
  const sky = { A: ['#4a3322', '#16120f'], B: ['#26325a', '#0a0d1a'], C: ['#3a2a3a', '#120e14'] }[set];
  els.sky.style.background = `radial-gradient(ellipse 80% 70% at 50% 40%, ${sky[0]} 0%, ${sky[1]} 65%, #050404 100%)`;
  const d = tget('light.dusk');
  if (set === 'A') {
    const dim = ease.inOut(k01(T, 12.0, 14.2));
    sun.color.set(tget('light.sunColor')).lerp(new THREE.Color(0x7c78c8), 0.6); sun.intensity = tget('light.sun') * 0.35 * (1 - 0.5 * dim);
    hemi.color.set(0xffe0b5).lerp(new THREE.Color(0x5b5f9e), 0.5); hemi.intensity = tget('light.hemi') * 0.7 * (1 - 0.4 * dim);
    barLamps.forEach((b, i) => { b.l.intensity = 7 * (1 - dim * (i === 1 ? 0.3 : 0.85)); b.b.material.opacity = 0.7 * (1 - dim * (i === 1 ? 0.3 : 0.85)); });
    openSign.material.map = T >= 11.6 ? CLOSED_TEX : OPEN_TEX;
    neonGlow.material.opacity = 0.5 * (RM ? 1 : 0.9 + 0.1 * Math.sin(T * 9));
  } else if (set === 'B') {
    sun.color.set(0x8ea6ff); sun.intensity = 0.55; hemi.color.set(0x6a7ac8); hemi.intensity = tget('light.hemi') * 0.45;
    for (const s of streetLamps) s.l.intensity = 9;
  } else {
    sun.color.set(0x8ea6ff); sun.intensity = 0.35; hemi.color.set(0xffd8b0).lerp(new THREE.Color(0x5b5f9e), 0.5); hemi.intensity = tget('light.hemi') * 0.5;
    deskLamp.l.intensity = 4.2;
    const bk = inOut(T, 38.6, 53.0, 0.8, 1.6), pulse = RM ? 1 : 0.85 + 0.15 * Math.sin(T * 3.2);
    bookGlow.material.opacity = 0.45 * bk * pulse; bookLight.intensity = 1.2 * bk * pulse; bookGlow.scale.setScalar(1.2 + 0.4 * bk);
    cover.rotation.z = Math.PI * 0.94 * ease.inOut(k01(T, 41.2, 42.6));
    screenLight.intensity = T >= 28.6 ? 1.4 : 0;
    drawScreen(T);
    desk.rotation.z = T >= 30.6 && T < 35.6 ? 0.012 * Math.sin(T * 17) : 0; // wobbly
    const ring = inOut(T, 71.8, 76.6, 0.2, 1.2), flick = RM ? 1 : 0.75 + 0.25 * Math.abs(Math.sin(T * 9));
    doorGlow.material.opacity = 0.8 * ring * flick; doorLight.intensity = 4 * ring;
    roomDoor.open(0.12 * ease.inOut(k01(T, 74.4, 76.0)));
    apronOnDoor.visible = T >= 22.5;
  }
  rim.color.set(tget('light.rimColor')); rim.intensity = tget('light.rim') * (0.6 + 0.8 * d);
  renderer.toneMappingExposure = tget('light.exposure');
}

// ================================================================ sound: engine hooks (no-ops until the modules load)
const sound = { sfx: null, music: null };
if (!CAPTURE) {
  import('../engine/sfx.js').then((m) => { sound.sfx = m; }).catch(() => { /* not built yet: the hooks stay no-ops */ });
  import('../engine/music.js').then((m) => { sound.music = m; }).catch(() => {});
}
const SFX_MAP = { clatter: 'ui-click', bell: 'door-chime', door: 'window-close', clicks: 'type-click', ping: 'success', shimmer: 'level-up', page: 'window-open', blink: 'ticket-pop', chime: 'door-chime', sting: 'level-up' };
function hookSfx(name) { if (MUTE || !sound.sfx) return; try { sound.sfx.play(SFX_MAP[name] || name); } catch { /* an unknown effect is not fatal */ } }
function hookMusic(on) { if (MUTE || !sound.music) return; try { if (on) { sound.music.setDistrict?.('office'); sound.music.start(); } else sound.music.stop(); } catch { /* ignore */ } }
const SFX_EVENTS = cues.sfx.flatMap(([name, t0, t1]) => (name === 'clicks' ? Array.from({ length: Math.floor((t1 - t0) / 0.14) }, (_, i) => [t0 + i * 0.14, name]) : name === 'steps' ? [] : [[t0, name]]));

// ================================================================ voice: files first, then speechSynthesis, else captions only
const voice = { mode: 'none', played: [], files: new Map(), sources: [] };
for (const l of LINES) { // preload the pre-rendered lines
  if (CAPTURE || FORCE_WEB) break;
  const a = new Audio(); a.preload = 'auto';
  on(a, 'canplaythrough', () => { voice.files.set(l.id, a); voice.mode = 'files'; }, { once: true });
  on(a, 'error', () => {}, { once: true });
  voice.sources.push(a);
  a.src = new URL(`./voice/${l.id}.mp3`, import.meta.url).href;
}
// the browser's voices arrive late (voiceschanged): ask once at start, and wait for them before the first line
let voicesReady = null;
function voicesLoaded() {
  if (!('speechSynthesis' in window)) return Promise.resolve([]);
  if (speechSynthesis.getVoices().length) return Promise.resolve(speechSynthesis.getVoices());
  return (voicesReady ??= new Promise((res) => {
    on(speechSynthesis, 'voiceschanged', () => res(speechSynthesis.getVoices()), { once: true });
    setTimeout(() => res(speechSynthesis.getVoices()), 1500); // some browsers never fire it
  }));
}
if (!CAPTURE) voicesLoaded();
function pickVoice(male) {
  if (!('speechSynthesis' in window)) return null;
  const all = speechSynthesis.getVoices().filter((v) => /^en\b|^en-/i.test(v.lang));
  const gb = all.filter((v) => /en-GB/i.test(v.lang));
  const prefer = (list) => (male ? list.find((v) => /male|david|george|ryan|daniel|arthur|guy/i.test(v.name) && !/female/i.test(v.name)) : list.find((v) => /female|zira|hazel|libby|sonia|susan|serena|kate|martha/i.test(v.name))) || list[0];
  return prefer(gb) || prefer(all) || null;
}
function speak(l) {
  voice.played.push(l.id);
  if (MUTE) return;
  const a = voice.files.get(l.id);
  if (a) { try { a.currentTime = 0; a.play().catch(() => speakWeb(l)); return; } catch { /* fall through */ } }
  speakWeb(l);
}
function speakWeb(l) {
  if (finished || !playing || disposed || !('speechSynthesis' in window)) return; // never after a skip or a pause
  voicesLoaded().then(() => speakNow(l));
}
function speakNow(l) {
  if (finished || !playing || disposed) return;
  try {
    const w = cues.voices[l.who]?.web || {};
    const u = new SpeechSynthesisUtterance(l.text);
    const v = pickVoice(!!w.male);
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-GB';
    u.pitch = w.pitch ?? 1; u.rate = w.rate ?? 1;
    speechSynthesis.speak(u);
    if (voice.mode !== 'files') voice.mode = 'speech';
  } catch { /* captions carry it */ }
}
function hush() {
  for (const a of voice.files.values()) { try { a.pause(); } catch { /* ignore */ } }
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch { /* ignore */ }
}

// ================================================================ the clock
let T = 0, playing = false, finished = false, disposed = false, frames = 0;
function step(dt) {
  T += dt;
  while (evIdx < events.length && events[evIdx][0] <= T + 1e-9) { try { events[evIdx][1](); } catch (e) { console.error(e); } evIdx++; }
  cameraAt(T); // the drones turn their faces to the camera as it is at this moment, even on a long seek
  for (const a of actors) a.step(T);
  for (const a of actors) a.p.update(dt, T);
  for (const s of drones) s.step(T, dt);
}
function reset() { buildActors(); T = 0; for (const a of actors) a.step(0); for (const s of drones) s.step(0, 0); }
function render() { applyWorld(T); cameraAt(T); applyOverlays(T); renderer.render(scene, camera); }
function seek(t, draw = true) {
  if (disposed) return T;
  t = Math.max(0, Math.min(DURATION, t));
  if (t < T - 1e-6) reset();
  while (t - T > 1e-6) step(Math.min(STEP, t - T));
  applyWorld(T); cameraAt(T); applyOverlays(T);
  if (draw) renderer.render(scene, camera);
  return T;
}

let resolveDone;
const done = new Promise((res) => { resolveDone = res; });
const endCard = $('end'), startCard = $('start');
function finish(skipped) {
  if (finished) return;
  finished = true; playing = false;
  hush(); hookMusic(false);
  if (skipped) seek(DURATION - 4.2); // rest on the title
  else seek(DURATION - 0.01);
  // keep the last frame as a still behind the title, then tear the stage down
  try { els.sky.style.background = `url(${canvas.toDataURL('image/jpeg', 0.85)}) center / cover, #050404`; } catch { /* a lost context: the sky stays */ }
  dispose();
  resolveDone({ skipped: !!skipped, time: T });
  const next = Q.get('next'); // only a path on this site: "/..." or "./...", never "//host"
  if (next && /^(\/(?!\/)|\.\/)[\w./?=&#-]*$/.test(next)) { location.href = next; return; }
  if (!CAPTURE) endCard.hidden = false;
}
// dispose(): stop the frame loop and the stage, drop every listener, stop and release the voices and the music
function dispose() {
  if (disposed) return;
  disposed = true; playing = false;
  hush(); hookMusic(false);
  for (const a of voice.sources) { try { a.pause(); a.removeAttribute('src'); a.load(); } catch { /* ignore */ } }
  voice.files.clear(); voice.sources.length = 0;
  ac.abort();
  offFrame();
  for (const a of actors) a.p.dispose();
  for (const s of drones) s.d.dispose();
  actors = []; drones = [];
  stage.dispose();
}
function play() {
  if (disposed) { location.reload(); return; } // the stage is gone: watching again starts afresh
  startCard.hidden = true;
  playing = true;
  hookMusic(true);
}
function skip() { finish(true); }
reset();
seek(0);
const offFrame = stage.frame((dt) => {
  frames++;
  if (!playing) { cameraAt(T); return; }
  const from = T, to = Math.min(DURATION, T + Math.min(dt, 0.1));
  for (const l of LINES) if (l.at > from && l.at <= to) speak(l);
  for (const [t0, name] of SFX_EVENTS) if (t0 > from && t0 <= to) hookSfx(name);
  seek(to, false);
  if (T >= DURATION - 1e-6) finish(false);
});

on($('skip'), 'click', skip);
on($('start-btn'), 'click', play);
$('replay').addEventListener('click', () => location.reload()); // kept after dispose: it is how you watch again
on(window, 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); skip(); } });
if (CAPTURE) { $('skip').hidden = true; }
if (AUTOPLAY && !CAPTURE) play();
else if (!CAPTURE) startCard.hidden = false;

window.__intro = {
  duration: DURATION,
  lines: LINES.map(({ id, at, len, who, text: tx }) => ({ id, at, len, who, text: tx })),
  seek: (t) => seek(t),
  play, skip, dispose,
  pause() { playing = false; hush(); },
  get disposed() { return disposed; },
  get frames() { return frames; },
  get listening() { return !ac.signal.aborted; },
  reducedMotion: RM,
  get cameraPosition() { return camera.position.toArray(); },
  get time() { return T; },
  get playing() { return playing; },
  done,
  voice,
  ready: true,
};
