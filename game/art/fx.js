// fx.js: the effects that tell what the learner's code did: sparks, confetti in three shapes, coins with an
// embossed "G" and a rim, shock rings, floating text, ticket cards, scan marks (tick and cross) and emote bubbles.
//
//   const fx = new Effects({ reducedMotion?, seed?, capacity? })   add fx.root to the world (its floor at y = 0);
//                                  call fx.update(dt, t) every frame. Everything is pooled when it is made:
//                                  a burst reuses instances, it never allocates or adds a draw call.
//     .sparks(at, { n, color, speed, up })            glowing chips flying out and fading
//     .confetti(at, { n, spread })                    strips, discs and triangles fluttering down
//     .coins(at, { n })                               gold coins flung up, bouncing and settling
//     .ring(at, { color, from, to, dur })             a shock ring spreading over the floor
//     .burst(at, opts)                                all of the above: a celebration
//     .text(at, string, { color, size })              floating text that rises and fades
//     .mark(at, ok, { hold }) -> sprite               a scan mark (tick or cross) that stays until clearMarks()
//     .emote(at, kind, { hold })                      a bubble (people.js emote kinds, the people's shared textures)
//     .ticket(data) -> TicketCard                     a ticket card (see below), kept in fx.root
//     .shake(strength)                                a camera shake: read fx.shakeOffset each frame
//     .clearMarks(), .reset() (not the tickets), .clearTickets(), .dispose(), .stats()
//   Reduced motion: no confetti, no sparks, no flung coins (they appear resting), no shake, rings glow in
//   place instead of spreading, text fades without rising, marks appear without a bounce. Colour still tells.
//   `at` is a Vector3, [x, y, z] or { x, y, z } in fx.root's frame. Colours are palette paths or CSS colours.
//
//   new TicketCard({ title, line, state })  a card on a canvas: states BOOKED, MOVED, RESOLVED, OPEN
//     .root, .set(patch), .stamp(state) (the state changes with a punch), .update(dt, t), .dispose()
//
// Every colour comes from the theme (palette.fx*, gold, ok, danger) and follows it live.
import * as THREE from 'three';
import { register } from './registry.js';
import { liveTex, lathe, rng, withHull } from './shapes.js';
import { gradientMap, canvasTex, themed } from '../engine/kit.js';
import { get as tget, onThemeChange } from '../engine/theme.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { emoteMaterial } from './people.js';
import { FONT } from './parts.js';

export const TICKET_STATES = ['BOOKED', 'MOVED', 'RESOLVED', 'OPEN'];
export const STATE_COLOUR = { BOOKED: 'palette.gold', MOVED: 'palette.fxMoved', RESOLVED: 'palette.ok', OPEN: 'palette.danger' };
const CONFETTI_KEYS = ['palette.fxConfettiA', 'palette.fxConfettiB', 'palette.fxConfettiC', 'palette.gold', 'palette.ok'];
const RM_QUERY = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

// ---------------------------------------------------------------- theme colours (shared, live)
const COLOURS = new Map();
let colourGen = 0;
export function colour(c) {
  let v = COLOURS.get(c);
  if (!v) { v = new THREE.Color(c.startsWith('palette.') ? tget(c) : c); COLOURS.set(c, v); }
  return v;
}
onThemeChange((p) => {
  if (p && !p.startsWith('palette.')) return;
  for (const [k, v] of COLOURS) if (k.startsWith('palette.') && (!p || p === k)) v.set(tget(k));
  colourGen++;
});

// ---------------------------------------------------------------- scratch (update() allocates nothing)
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();
const C = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const toV = (a, out = new THREE.Vector3()) => (Array.isArray(a) ? out.set(a[0], a[1], a[2]) : out.set(a.x, a.y ?? 0, a.z));

// ---------------------------------------------------------------- shared geometry
let GEO = null;
function geos() {
  if (GEO) return GEO;
  const tri = new THREE.BufferGeometry();
  const r = 0.055;
  tri.setAttribute('position', new THREE.Float32BufferAttribute([0, r, 0, -r * 0.87, -r * 0.5, 0, r * 0.87, -r * 0.5, 0], 3));
  tri.computeVertexNormals();
  const ring = new THREE.RingGeometry(0.9, 1, 48); ring.rotateX(-Math.PI / 2);
  GEO = {
    spark: new THREE.OctahedronGeometry(0.034, 0),
    strip: new THREE.PlaneGeometry(0.14, 0.05),
    disc: new THREE.CircleGeometry(0.042, 8),
    tri,
    coin: coinGeometry(),
    ring,
  };
  return GEO;
}
// a coin: a lathe with a raised rim round a recessed face, and a "G" embossed on both faces (about 420 triangles)
function coinGeometry() {
  const R = 0.09, T = 0.011;
  const body = lathe('fx-coin', [[0, -T * 0.55], [R * 0.78, -T * 0.55], [R * 0.84, -T], [R, -T], [R, T], [R * 0.84, T], [R * 0.78, T * 0.55], [0, T * 0.55]], 14, { flat: true });
  const ro = 0.052, ri = 0.033, a0 = Math.PI * 0.26;
  const arc = new THREE.Shape();
  arc.absarc(0, 0, ro, a0, Math.PI * 2, false);
  arc.lineTo(ri, 0);
  arc.absarc(0, 0, ri, Math.PI * 2, a0, true);
  arc.closePath();
  const bar = new THREE.Shape();
  bar.moveTo(0.006, 0); bar.lineTo(ro, 0); bar.lineTo(ro, -0.016); bar.lineTo(0.006, -0.016); bar.closePath();
  const one = (flip) => [arc, bar].map((s) => {
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 6 });
    g.rotateX(-Math.PI / 2); // lie on the face, reading from above (+Y)
    g.translate(0, T * 0.55 - 0.001, 0);
    if (flip) g.rotateZ(Math.PI); // the back face reads correctly from below
    return g;
  });
  const parts = [body, ...one(false), ...one(true)].map((g) => {
    const c = g.index ? g.toNonIndexed() : g.clone();
    for (const n of Object.keys(c.attributes)) if (n !== 'position') c.deleteAttribute(n);
    return c;
  });
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return withHull(g);
}

// ---------------------------------------------------------------- a pool of instanced particles
// Pool-level physics: gravity, drag, bounce on the floor, flutter (confetti), additive (colour fades to black).
class Particles {
  constructor(name, geo, mat, n, cfg) {
    this.n = n; this.cfg = cfg;
    const mesh = this.mesh = new THREE.InstancedMesh(geo, mat, n);
    mesh.name = name; mesh.frustumCulled = false; mesh.castShadow = !!cfg.shadow; mesh.receiveShadow = false;
    mesh.userData.pool = true;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, white); }
    mesh.count = 0; mesh.visible = false;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3); this.spin = new Float32Array(n * 3);
    this.age = new Float32Array(n); this.life = new Float32Array(n); this.size = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.key = new Uint8Array(n); this.alive = new Uint8Array(n); this.rest = new Uint8Array(n);
    this.keys = []; this.cursor = 0; this.live = 0; this.gen = colourGen;
  }
  keyOf(c) { let j = this.keys.indexOf(c); if (j < 0) { j = this.keys.length; this.keys.push(c); } return j; }
  spawn(at, colourKey) {
    let i = -1;
    for (let k = 0; k < this.n; k++) { const j = (this.cursor + k) % this.n; if (!this.alive[j]) { i = j; break; } }
    if (i < 0) i = this.cursor; // full: the oldest slot is recycled
    this.cursor = (i + 1) % this.n;
    if (!this.alive[i]) this.live++;
    this.alive[i] = 1; this.rest[i] = 0; this.age[i] = 0;
    this.vel.fill(0, i * 3, i * 3 + 3); this.spin.fill(0, i * 3, i * 3 + 3); this.rot.fill(0, i * 3, i * 3 + 3);
    this.pos[i * 3] = at.x; this.pos[i * 3 + 1] = at.y; this.pos[i * 3 + 2] = at.z;
    this.key[i] = this.keyOf(colourKey);
    this.mesh.setColorAt(i, colour(colourKey));
    this.mesh.instanceColor.needsUpdate = true;
    return i;
  }
  kill(i) { if (this.alive[i]) { this.alive[i] = 0; this.live--; this.mesh.setMatrixAt(i, ZERO); } }
  clear() { for (let i = 0; i < this.n; i++) this.kill(i); this.mesh.count = 0; this.mesh.visible = false; this.mesh.instanceMatrix.needsUpdate = true; }
  update(dt) {
    const { gravity = 0, drag = 0, bounce = 0, flutter = 0, additive = false, floor = 0.02, flat = 0 } = this.cfg;
    const recolour = this.gen !== colourGen; this.gen = colourGen;
    let hi = -1;
    const fall = Math.exp(-drag * dt);
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      const a = this.age[i] += dt;
      if (a >= this.life[i]) { this.kill(i); continue; }
      hi = i;
      const p = i * 3;
      if (!this.rest[i]) {
        this.vel[p + 1] -= gravity * dt;
        this.vel[p] *= fall; this.vel[p + 2] *= fall;
        if (flutter) {
          this.vel[p + 1] = Math.max(this.vel[p + 1], -flutter);
          this.pos[p] += Math.sin(a * 5 + this.phase[i]) * dt * 0.45;
          this.pos[p + 2] += Math.cos(a * 4 + this.phase[i]) * dt * 0.3;
        } else this.vel[p + 1] *= drag ? fall : 1;
        for (let k = 0; k < 3; k++) { this.pos[p + k] += this.vel[p + k] * dt; this.rot[p + k] += this.spin[p + k] * dt; }
        if (this.pos[p + 1] < floor && this.vel[p + 1] < 0) {
          this.pos[p + 1] = floor;
          if (bounce && Math.abs(this.vel[p + 1]) > 1.1) {
            this.vel[p + 1] *= -bounce; this.vel[p] *= 0.55; this.vel[p + 2] *= 0.55;
            for (let k = 0; k < 3; k++) this.spin[p + k] *= 0.5;
          } else if (gravity) {
            this.rest[i] = 1; // lie flat where it landed
            this.rot[p] = flat; this.rot[p + 2] = 0;
          }
        }
      }
      const left = this.life[i] - a, fade = Math.min(1, left / 0.45, a / 0.06);
      P.set(this.pos[p], this.pos[p + 1], this.pos[p + 2]);
      Q.setFromEuler(E.set(this.rot[p], this.rot[p + 1], this.rot[p + 2]));
      S.setScalar(this.size[i] * (additive ? 0.4 + 0.6 * fade : fade));
      this.mesh.setMatrixAt(i, M.compose(P, Q, S));
      if (additive) { this.mesh.setColorAt(i, C.copy(colour(this.keys[this.key[i]])).multiplyScalar(fade * fade)); }
      else if (recolour) this.mesh.setColorAt(i, colour(this.keys[this.key[i]]));
    }
    this.mesh.count = hi + 1;
    this.mesh.visible = hi >= 0;
    if (hi >= 0 || recolour) {
      this.mesh.instanceMatrix.needsUpdate = true;
      if (additive || recolour) this.mesh.instanceColor.needsUpdate = true;
    }
  }
}

// ---------------------------------------------------------------- sprites made at pool time
function textSprite() {
  const tex = canvasTex(512, 128, () => {});
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.renderOrder = 30; s.visible = false; s.center.set(0.5, 0);
  s.userData = { k: 0, age: 0, life: 0, base: new THREE.Vector3(), size: 1 };
  return s;
}
function drawText(s, str, col) {
  const tex = s.material.map, cv = tex.userData.canvas, g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.font = `900 72px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  let w = g.measureText(str).width;
  const fit = Math.min(1, 480 / Math.max(1, w + 28));
  g.save(); g.translate(256, 64); g.scale(fit, fit);
  g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = 'rgba(16,12,10,0.95)'; g.strokeText(str, 0, 2);
  g.fillStyle = col; g.fillText(str, 0, 0);
  g.restore();
  tex.needsUpdate = true;
  return fit;
}
const markTexture = (ok) => liveTex(ok ? 'fx-mark-tick' : 'fx-mark-cross', 128, 128, (g, w, h, get) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(10,8,7,0.92)'; g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = get(ok ? 'palette.ok' : 'palette.danger'); g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.ellipse(52, 40, 30, 16, -0.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 15; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
  if (ok) { g.moveTo(36, 66); g.lineTo(56, 86); g.lineTo(93, 44); } else { g.moveTo(42, 42); g.lineTo(86, 86); g.moveTo(86, 42); g.lineTo(42, 86); }
  g.stroke();
});
const elastic = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
const back = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

// ---------------------------------------------------------------- the effects layer
export class Effects {
  constructor({ reducedMotion, seed = 7, capacity = {} } = {}) {
    this.reducedMotion = reducedMotion ?? !!(RM_QUERY && RM_QUERY.matches);
    this.rand = rng(seed);
    this.root = new THREE.Group(); this.root.name = 'fx';
    const G = geos();
    const cap = { sparks: 160, confetti: 80, coins: 36, rings: 8, texts: 6, marks: 16, emotes: 8, ...capacity };
    this.capacity = cap;
    const add = (name, geo, mat, n, cfg) => { const p = new Particles(name, geo, mat, n, cfg); this.root.add(p.mesh); return p; };
    const glowMat = new THREE.MeshBasicMaterial({ blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false });
    const paperMat = new THREE.MeshToonMaterial({ gradientMap, side: THREE.DoubleSide });
    this._mats = [glowMat, paperMat];
    this.pools = {
      sparks: add('fx-sparks', G.spark, glowMat, cap.sparks, { gravity: 5, drag: 1.6, additive: true }),
      strips: add('fx-confetti-strips', G.strip, paperMat, cap.confetti, { gravity: 4.2, drag: 1.5, flutter: 1.05, flat: -Math.PI / 2 }),
      discs: add('fx-confetti-discs', G.disc, paperMat, cap.confetti, { gravity: 4.2, drag: 1.5, flutter: 0.95, flat: -Math.PI / 2 }),
      tris: add('fx-confetti-triangles', G.tri, paperMat, cap.confetti, { gravity: 4.2, drag: 1.5, flutter: 1.15, flat: -Math.PI / 2 }),
      coins: add('fx-coins', G.coin, themed('palette.fxCoin'), cap.coins, { gravity: 9.5, bounce: 0.42, shadow: true, floor: 0.012 }),
      rings: add('fx-rings', G.ring, glowMat, cap.rings, { additive: true }),
    };
    this.pools.rings.mesh.renderOrder = 5;
    this.ringState = Array.from({ length: cap.rings }, () => ({ from: 0, to: 1, dur: 1 }));
    // sprites, made now and reused
    this.texts = Array.from({ length: cap.texts }, () => { const s = textSprite(); this.root.add(s); return s; });
    this.marks = Array.from({ length: cap.marks }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTexture(true), transparent: true, depthTest: false, depthWrite: false }));
      s.renderOrder = 25; s.visible = false; s.center.set(0.5, 0.15);
      s.userData = { k: 0, age: 0, hold: Infinity, base: new THREE.Vector3(), ok: true, born: 0 };
      this.root.add(s); return s;
    });
    this.emotes = Array.from({ length: cap.emotes }, () => {
      const s = new THREE.Sprite(emoteMaterial('ok'));
      s.renderOrder = 26; s.visible = false; s.center.set(0.5, 0.1);
      s.userData = { k: 0, age: 0, hold: 2, base: new THREE.Vector3() };
      this.root.add(s); return s;
    });
    this.tickets = new Set();
    this.shakeAmt = 0; this.shakeOffset = new THREE.Vector3(); this.t = 0; this.markN = 0;
  }

  // ------------------------------------------------ bursts
  sparks(at, { n = 18, color = 'palette.fxSpark', speed = 2.4, up = 2.2, size = 1 } = {}) {
    if (this.reducedMotion) return 0;
    const pool = this.pools.sparks, v = toV(at, P.clone()), R = this.rand;
    for (let k = 0; k < n; k++) {
      const i = pool.spawn(v, color), p = i * 3, a = R() * Math.PI * 2, r = (0.3 + R() * 0.7) * speed;
      pool.vel[p] = Math.cos(a) * r; pool.vel[p + 1] = up * (0.4 + R() * 0.8); pool.vel[p + 2] = Math.sin(a) * r;
      pool.spin[p] = R() * 20; pool.spin[p + 1] = R() * 20; pool.spin[p + 2] = 0;
      pool.life[i] = 0.45 + R() * 0.5; pool.size[i] = size * (0.6 + R() * 0.8);
    }
    return n;
  }
  confetti(at, { n = 60, spread = 1, power = 1 } = {}) {
    if (this.reducedMotion) return 0;
    const v = toV(at, P.clone()), R = this.rand, shapes = [this.pools.strips, this.pools.discs, this.pools.tris];
    for (let k = 0; k < n; k++) {
      const pool = shapes[k % 3];
      const i = pool.spawn(v, CONFETTI_KEYS[(k * 7 + (k >> 2)) % CONFETTI_KEYS.length]), p = i * 3;
      const a = R() * Math.PI * 2, r = (0.6 + R() * 1.8) * spread;
      pool.vel[p] = Math.cos(a) * r; pool.vel[p + 1] = (3 + R() * 3.2) * power; pool.vel[p + 2] = Math.sin(a) * r;
      pool.rot[p] = R() * 6; pool.rot[p + 1] = R() * 6; pool.rot[p + 2] = R() * 6;
      pool.spin[p] = 4 + R() * 10; pool.spin[p + 1] = R() * 8; pool.spin[p + 2] = 3 + R() * 8;
      pool.phase[i] = R() * 6.3; pool.life[i] = 2.6 + R() * 1.4; pool.size[i] = 0.85 + R() * 0.4;
    }
    return n;
  }
  coins(at, { n = 10 } = {}) {
    const pool = this.pools.coins, v = toV(at, P.clone()), R = this.rand, rm = this.reducedMotion;
    for (let k = 0; k < n; k++) {
      const i = pool.spawn(v, 'palette.fxCoin'), p = i * 3, a = R() * Math.PI * 2;
      if (rm) { // no flinging: they appear resting in a little heap, and fade
        const r = 0.08 + 0.13 * Math.sqrt(k / Math.max(1, n));
        pool.pos[p] = v.x + Math.cos(a) * r; pool.pos[p + 1] = 0.012 + (k % 3) * 0.02; pool.pos[p + 2] = v.z + Math.sin(a) * r;
        pool.rest[i] = 1; pool.rot[p] = 0; pool.rot[p + 1] = a; pool.rot[p + 2] = 0;
      } else {
        const r = 0.7 + R() * 1.5;
        pool.vel[p] = Math.cos(a) * r; pool.vel[p + 1] = 4 + R() * 2.4; pool.vel[p + 2] = Math.sin(a) * r;
        pool.rot[p] = R() * 6; pool.rot[p + 1] = 0; pool.rot[p + 2] = R() * 6;
        pool.spin[p] = 9 + R() * 8; pool.spin[p + 1] = 0; pool.spin[p + 2] = 3 + R() * 5;
      }
      pool.life[i] = 3.2 + R(); pool.size[i] = 1;
    }
    return n;
  }
  ring(at, { color = 'palette.gold', from = 0.2, to = 2.2, dur = 0.8, y = 0.03 } = {}) {
    const pool = this.pools.rings, v = toV(at, P.clone());
    v.y = Math.max(v.y, y);
    const i = pool.spawn(v, color);
    const rs = this.ringState[i];
    rs.from = this.reducedMotion ? to * 0.6 : from; rs.to = this.reducedMotion ? to * 0.6 : to; rs.dur = this.reducedMotion ? dur * 1.4 : dur;
    pool.life[i] = rs.dur; pool.size[i] = rs.from; pool.rot.fill(0, i * 3, i * 3 + 3);
    return i;
  }
  burst(at, { confetti = 60, coins = 10, sparks = 24, ring = true } = {}) {
    const v = toV(at, P.clone());
    if (ring) this.ring([v.x, 0.03, v.z], { color: 'palette.gold', to: 2 });
    this.sparks(v, { n: sparks });
    this.confetti(v, { n: confetti });
    this.coins(v, { n: coins });
    this.shake(0.12);
  }
  shake(strength = 0.1) { if (!this.reducedMotion) this.shakeAmt = Math.max(this.shakeAmt, strength); }

  // ------------------------------------------------ sprites
  text(at, str, { color = 'palette.gold', size = 1 } = {}) {
    const s = this.texts.reduce((a, b) => (!a.visible ? a : !b.visible ? b : a.userData.age > b.userData.age ? a : b));
    const fit = drawText(s, String(str), color.startsWith('palette.') ? tget(color) : color);
    Object.assign(s.userData, { age: 0, life: 1.9, size: size * (0.6 + 0.4 * fit) });
    toV(at, s.userData.base);
    s.visible = true; s.material.opacity = 0;
    return s;
  }
  mark(at, ok, { hold = Infinity, size = 0.62 } = {}) {
    const s = this.marks.find((m) => !m.visible) || this.marks.reduce((a, b) => (a.userData.born < b.userData.born ? a : b));
    s.material.map = markTexture(!!ok); s.material.needsUpdate = true;
    Object.assign(s.userData, { k: 0, age: 0, hold, ok: !!ok, size, born: ++this.markN, out: false });
    toV(at, s.userData.base); s.position.copy(s.userData.base);
    s.visible = true; s.scale.setScalar(this.reducedMotion ? size : 0.001);
    return s;
  }
  clearMarks() { for (const s of this.marks) if (s.visible) { s.userData.out = true; if (this.reducedMotion) s.visible = false; } }
  emote(at, kind, { hold = 2 } = {}) {
    const s = this.emotes.find((m) => !m.visible) || this.emotes[0];
    s.material = emoteMaterial(kind);
    Object.assign(s.userData, { k: 0, age: 0, hold });
    toV(at, s.userData.base); s.position.copy(s.userData.base);
    s.visible = true; s.scale.setScalar(0.001);
    return s;
  }
  ticket(data) { const c = new TicketCard({ reducedMotion: this.reducedMotion, ...data }); this.tickets.add(c); this.root.add(c.root); c._fx = this; return c; }

  // ------------------------------------------------ the frame
  update(dt, t) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.t += dt; t = t ?? this.t;
    const rm = this.reducedMotion;
    for (const k in this.pools) this.pools[k].update(dt);
    // rings: spread (or glow in place), fading
    const rp = this.pools.rings;
    for (let i = 0; i < rp.n; i++) {
      if (!rp.alive[i]) continue;
      const rs = this.ringState[i], k = Math.min(1, rp.age[i] / rs.dur), e = 1 - (1 - k) ** 3;
      const s = rs.from + (rs.to - rs.from) * e, f = rm ? Math.sin(k * Math.PI) : 1 - k;
      P.set(rp.pos[i * 3], rp.pos[i * 3 + 1], rp.pos[i * 3 + 2]);
      rp.mesh.setMatrixAt(i, M.compose(P, Q.identity(), S.set(s, 1, s)));
      rp.mesh.setColorAt(i, C.copy(colour(rp.keys[rp.key[i]])).multiplyScalar(f * 0.8));
    }
    // floating text
    for (const s of this.texts) {
      if (!s.visible) continue;
      const u = s.userData; u.age += dt;
      const k = u.age / u.life;
      if (k >= 1) { s.visible = false; continue; }
      const pop = rm ? 1 : k < 0.14 ? back(k / 0.14) : 1;
      s.position.copy(u.base); if (!rm) s.position.y += (1 - (1 - k) ** 2) * 1.1;
      s.scale.set(2.2 * u.size * pop, 0.55 * u.size * pop, 1);
      s.material.opacity = k < 0.08 ? k / 0.08 : k > 0.72 ? (1 - k) / 0.28 : 1;
    }
    // scan marks: pop in, bob, stay until held time or clearMarks()
    for (const s of this.marks) {
      if (!s.visible) continue;
      const u = s.userData; u.age += dt;
      if (u.age > u.hold) u.out = true;
      u.k = u.out ? Math.max(0, u.k - dt / 0.25) : Math.min(1, u.k + dt / 0.55);
      if (u.out && u.k <= 0) { s.visible = false; continue; }
      const e = rm ? (u.out ? u.k : 1) : u.out ? u.k ** 2 : elastic(u.k);
      s.scale.setScalar(Math.max(0.001, u.size * e));
      s.position.copy(u.base); if (!rm) s.position.y += Math.sin(t * 2.2 + u.born) * 0.03;
    }
    for (const s of this.emotes) {
      if (!s.visible) continue;
      const u = s.userData; u.age += dt;
      const showing = u.age < u.hold;
      u.k = showing ? Math.min(1, u.k + dt / 0.45) : Math.max(0, u.k - dt / 0.2);
      if (!showing && u.k <= 0) { s.visible = false; continue; }
      s.scale.setScalar(Math.max(0.001, 0.62 * (rm ? (showing ? 1 : u.k) : showing ? elastic(u.k) : u.k ** 3)));
      s.position.copy(u.base); if (!rm) s.position.y += Math.sin(t * 4) * 0.035;
    }
    for (const c of this.tickets) c.update(dt, t);
    // shake: a decaying jitter the page adds to its camera
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 0.5);
    const a = this.shakeAmt;
    this.shakeOffset.set(a ? Math.sin(t * 61) * a : 0, a ? Math.sin(t * 47 + 1) * a * 0.6 : 0, a ? Math.cos(t * 53) * a : 0);
    return this;
  }
  stats() {
    const live = Object.fromEntries(Object.entries(this.pools).map(([k, p]) => [k, p.live]));
    return { live, texts: this.texts.filter((s) => s.visible).length, marks: this.marks.filter((s) => s.visible).length,
      emotes: this.emotes.filter((s) => s.visible).length, tickets: this.tickets.size };
  }
  // clears every burst, text, mark and bubble (tickets stay: they are the page's; clearTickets() removes them)
  reset() {
    for (const k in this.pools) this.pools[k].clear();
    for (const s of [...this.texts, ...this.marks, ...this.emotes]) s.visible = false;
    this.shakeAmt = 0; this.shakeOffset.set(0, 0, 0);
  }
  clearTickets() { for (const c of [...this.tickets]) c.dispose(); }
  dispose() {
    this.reset(); this.clearTickets();
    this.root.removeFromParent();
    for (const k in this.pools) this.pools[k].mesh.dispose();
    for (const s of this.texts) { s.material.map.dispose(); s.material.dispose(); }
    for (const s of this.marks) s.material.dispose();
    for (const m of this._mats) m.dispose();
  }
}

// ---------------------------------------------------------------- ticket cards
const CARD_W = 512, CARD_H = 300;
function drawTicket(g, { title, line, state }) {
  const W = CARD_W, H = CARD_H, get = tget;
  g.clearRect(0, 0, W, H);
  const paper = get('palette.fxTicket'), ink = get('palette.fxTicketInk'), sc = get(STATE_COLOUR[state] || 'palette.gold');
  // shadow, card with notches, coloured band
  g.save();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.roundRect(14, 20, W - 24, H - 28, 26); g.fill();
  g.beginPath(); g.roundRect(8, 8, W - 24, H - 28, 26); g.fillStyle = paper; g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (const x of [8, W - 16]) { g.beginPath(); g.arc(x, 8 + (H - 28) * 0.62, 20, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.save(); g.beginPath(); g.roundRect(8, 8, W - 24, H - 28, 26); g.clip();
  g.fillStyle = sc; g.fillRect(8, 8, W - 24, 58);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(8, 8, W - 24, 14);
  g.restore();
  g.lineWidth = 6; g.strokeStyle = 'rgba(10,8,7,0.85)'; g.beginPath(); g.roundRect(8, 8, W - 24, H - 28, 26); g.stroke();
  // perforation
  g.setLineDash([10, 9]); g.lineWidth = 3; g.strokeStyle = 'rgba(40,30,20,0.35)';
  g.beginPath(); g.moveTo(30, 8 + (H - 28) * 0.62); g.lineTo(W - 38, 8 + (H - 28) * 0.62); g.stroke(); g.setLineDash([]);
  // band text, title, detail
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#fff'; g.font = `800 30px ${FONT}`; g.fillText('TICKET', 30, 38);
  g.fillStyle = ink;
  g.font = `800 50px ui-monospace, Consolas, monospace`;
  fitText(g, title || '', 30, 116, W - 70);
  g.font = `600 30px ${FONT}`; g.fillStyle = ink; g.globalAlpha = 0.75;
  fitText(g, line || '', 32, 170, W - 70); g.globalAlpha = 1;
  // the stamp
  g.save(); g.translate(W * 0.63, 226); g.rotate(-0.12);
  g.strokeStyle = sc; g.fillStyle = sc; g.lineWidth = 7;
  g.font = `900 40px ${FONT}`; g.textAlign = 'center';
  const tw = g.measureText(state).width + 44;
  g.globalAlpha = 0.92; g.beginPath(); g.roundRect(-tw / 2, -30, tw, 60, 10); g.stroke();
  g.fillText(state, 0, 3);
  g.restore();
  // badge
  g.fillStyle = 'rgba(10,8,7,0.9)'; g.beginPath(); g.arc(W - 62, 37, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.font = `900 30px ${FONT}`; g.textAlign = 'center';
  g.fillText({ BOOKED: '●', MOVED: '⇄', RESOLVED: '✓', OPEN: '!' }[state] || '?', W - 62, 39);
}
function fitText(g, s, x, y, max) {
  const w = g.measureText(s).width;
  if (w <= max) { g.fillText(s, x, y); return; }
  g.save(); g.translate(x, y); g.scale(max / w, 1); g.fillText(s, 0, 0); g.restore();
}
export class TicketCard {
  constructor({ title = '', line = '', state = 'OPEN', width = 1.05, reducedMotion } = {}) {
    if (!TICKET_STATES.includes(state)) throw new Error(`unknown ticket state "${state}" (one of ${TICKET_STATES.join(', ')})`);
    this.data = { title, line, state };
    this.reducedMotion = reducedMotion ?? !!(RM_QUERY && RM_QUERY.matches);
    this.tex = canvasTex(CARD_W, CARD_H, (g) => drawTicket(g, this.data));
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false }));
    this.sprite.renderOrder = 12;
    this.width = width;
    this.root = new THREE.Group(); this.root.name = 'ticket';
    this.root.add(this.sprite);
    this.root.userData.ticket = this;
    this.pop = this.reducedMotion ? 1 : 0; this.punch = 0; this.seed = Math.random() * 6; this.t = 0;
    this._off = onThemeChange((p) => { if (!p || p.startsWith('palette.')) this._redraw(); });
    this.update(0);
  }
  get state() { return this.data.state; }
  _redraw() { drawTicket(this.tex.userData.canvas.getContext('2d'), this.data); this.tex.needsUpdate = true; }
  set(patch) {
    if (patch.state && !TICKET_STATES.includes(patch.state)) throw new Error(`unknown ticket state "${patch.state}"`);
    Object.assign(this.data, patch); this._redraw(); return this;
  }
  stamp(state) { this.set({ state }); this.punch = 1; return this; }
  update(dt = 0, t) {
    this.t += dt; t = t ?? this.t;
    const rm = this.reducedMotion;
    this.pop = Math.min(1, this.pop + dt / 0.45);
    this.punch = Math.max(0, this.punch - dt * 2.6);
    const s = this.width * (rm ? 1 : back(this.pop)) * (1 + (rm ? 0 : Math.sin(this.punch * Math.PI) * 0.22));
    this.sprite.scale.set(s, s * CARD_H / CARD_W, 1);
    this.sprite.position.y = rm ? 0 : Math.sin(t * 1.8 + this.seed) * 0.04;
    this.sprite.material.rotation = rm ? 0 : Math.sin(t * 1.1 + this.seed) * 0.03 + this.punch * Math.sin(t * 38) * 0.08;
  }
  dispose() {
    this._off(); this.root.removeFromParent();
    this.tex.dispose(); this.sprite.material.dispose();
    this._fx?.tickets.delete(this);
  }
}

// ---------------------------------------------------------------- catalogue entries: each effect with a looping demo
// build() returns a still frame of the effect (the grid thumbnail); anims.loop plays it over and over.
function fxAsset(id, { tiles, every = 2.6, freeze = 0.5, capacity, setup, fire }) {
  const demo = (g, fx) => (tt) => fire(fx, g, tt);
  register(id, {
    category: 'fx', tiles,
    build() {
      const g = new THREE.Group();
      const fx = new Effects({ reducedMotion: false, seed: 11, capacity });
      g.add(fx.root);
      setup?.(fx, g);
      g.userData.fx = fx; g.userData.fire = demo(g, fx);
      g.userData.fire(0);
      for (let t = 0; t < freeze; t += 1 / 60) fx.update(1 / 60);
      return g;
    },
    anims: {
      loop(obj, t) {
        const u = obj.userData, fx = u.fx;
        if (u.lastT === undefined || t < u.lastT) { u.lastT = t; u.nextFire = t; }
        const dt = Math.min(0.1, t - u.lastT); u.lastT = t;
        if (t >= u.nextFire) { u.fire(t); u.nextFire = t + every; }
        fx.update(dt, t);
      },
    },
  });
}
const SMALL = { sparks: 40, confetti: 30, coins: 6, rings: 3, texts: 2, marks: 2, emotes: 2 };
fxAsset('fx-sparks', { tiles: [2, 2], freeze: 0.22, every: 1.4, capacity: SMALL, fire: (fx) => fx.sparks([0, 0.6, 0], { n: 30, speed: 2.2, up: 2 }) });
fxAsset('fx-confetti', { tiles: [3, 3], freeze: 0.5, every: 3.2, capacity: SMALL, fire: (fx) => fx.confetti([0, 0.4, 0], { n: 60, spread: 0.7, power: 0.6 }) });
fxAsset('fx-coins', { tiles: [3, 3], freeze: 0.35, every: 3.2, capacity: SMALL, fire: (fx) => fx.coins([0, 0.4, 0], { n: 6 }) });
fxAsset('fx-shock-ring', { tiles: [3, 3], freeze: 0.3, every: 1.4, capacity: SMALL, fire: (fx) => fx.ring([0, 0.03, 0], { to: 1.4 }) });
fxAsset('fx-float-text', { tiles: [3, 1], freeze: 0.5, every: 2.2, capacity: SMALL, fire: (fx) => fx.text([0, 0.4, 0], '+40 G', { color: 'palette.gold' }) });
fxAsset('fx-scan-marks', { tiles: [2, 1], freeze: 0.8, every: 3, capacity: SMALL, fire: (fx) => { fx.clearMarks(); fx.update(0.3); fx.mark([-0.45, 0.5, 0], true); fx.mark([0.45, 0.5, 0], false); } });
fxAsset('fx-emote', { tiles: [2, 1], freeze: 0.6, every: 2.8, capacity: SMALL, fire: (fx, g, t) => { const k = ['ok', 'no', 'q', 'bang', 'dots']; const i = Math.round(t / 2.8) % 5; fx.emote([-0.45, 0.4, 0], k[i], { hold: 2 }); fx.emote([0.45, 0.4, 0], k[(i + 2) % 5], { hold: 2 }); } });
fxAsset('fx-ticket', {
  tiles: [2.4, 1.2], freeze: 0.6, every: 1.6, capacity: SMALL,
  setup(fx, g) {
    g.userData.cards = TICKET_STATES.map((state, i) => {
      const c = fx.ticket({ title: ['09:30', '11:00', '14:15', '16:45'][i], line: ['Room 2 · Ada', 'Room 3 · Bea', 'Room 1 · Cy', 'Room 4 · Dev'][i], state, width: 1.05 });
      c.root.position.set(i % 2 ? 0.58 : -0.58, i < 2 ? 1.25 : 0.55, 0);
      return c;
    });
    g.userData.turn = 0;
  },
  fire(fx, g, t) { const u = g.userData; if (!u.cards || !t) return; const c = u.cards[u.turn++ % 4]; c.stamp(TICKET_STATES[(TICKET_STATES.indexOf(c.state) + 1) % 4]); },
});
