// people.js: the people of the office (clients, colleagues, staff), and the `person` asset.
//
//   new Person({ role, seed, name, prop, reducedMotion, ...overrides })   see people/outfits.js dress()
//     .root                       add it to the world; it stands on its own floor at y = 0 of its parent
//     .walkTo(points) -> Promise  follows the points (Vector3, {x, z} or [x, z]) with smooth turns, keeping
//                                 clear of other people walking nearby; stands up first if seated
//     .sit(seat, i = 0) -> Promise  an object with userData.seats (furniture, parts.js seat()) or a
//                                 { position, facing, height } in the parent's frame: hips on the seat, feet on the floor
//     .stand(to?) -> Promise      gets up and steps forward (or to `to`)
//     .play(state)                one of STATES: idle walk sit type talk celebrate frustrated carry wave
//     .emote(kind, { hold }) -> Promise   a bubble: '!' '?' '…' '✓' '✗' (or bang q dots ok no); sets the face
//     .express(name, hold?)       neutral happy worried frustrated surprised thinking focused
//     .lookAt(vector | null), .face(yaw), .update(dt, t?), .dispose()
//   seatOf(target, i, frame) -> { x, z, floor, height, facing }
//   emoteMaterial(kind)          one shared SpriteMaterial (and texture) per emote kind
//   PEOPLE                       the people updated recently (for separation)
import * as THREE from 'three';
import { register } from './registry.js';
import { liveTex } from './shapes.js';
import { part, damp, dampAngle, lerp } from '../engine/kit.js';
import { C } from './parts.js';
import { chamfer } from './shapes.js';
import { contactShadow } from './materials.js';
import { DIM, PELVIS_Y, FACE, facePoint, buildRig } from './people/rig.js';
import { dress, pieces, ROLES, HAIR_STYLES } from './people/outfits.js';
import {
  STATES, EXPRESSIONS, STATE_FACE, EMOTES, EMOTE_ALIAS, EMOTE_FACE,
  seatedLegs, walkLegs, legExtent, upper, base, mix,
} from './people/anims.js';

export { STATES, ROLES, HAIR_STYLES, EMOTES, EXPRESSIONS };
export const PEOPLE = new Set();
const RM_QUERY = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
let clock = 0;          // advanced by every update (for "recently updated")
let nextId = 1;

// ---------------------------------------------------------------- emotes (shared textures)
const EMOTE_DRAW = {
  bang: { col: 'palette.danger', glyph: '!', ink: '#fff' },
  q: { col: 'palette.gold', glyph: '?', ink: '#fff' },
  dots: { col: 'palette.text', glyph: '…', ink: '#14110f' },
  ok: { col: 'palette.ok', glyph: '✓', ink: '#fff' },
  no: { col: 'palette.danger', glyph: '✗', ink: '#fff' },
};
const emoteMats = new Map();
export function emoteTexture(kind) {
  const k = EMOTE_ALIAS[kind];
  if (!k) throw new Error(`unknown emote "${kind}"`);
  const d = EMOTE_DRAW[k];
  return liveTex(`emote-${k}`, 128, 128, (g, w, h, get) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(10,8,7,0.92)';
    g.beginPath(); g.arc(64, 58, 50, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(50, 98); g.lineTo(64, 125); g.lineTo(78, 98); g.fill();
    g.fillStyle = get(d.col);
    g.beginPath(); g.arc(64, 58, 43, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(55, 95); g.lineTo(64, 114); g.lineTo(73, 95); g.fill();
    g.fillStyle = d.ink;
    g.font = `900 ${k === 'dots' ? 60 : 64}px "Segoe UI", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(d.glyph, 64, k === 'dots' ? 50 : 62);
  });
}
export function emoteMaterial(kind) {
  const k = EMOTE_ALIAS[kind];
  if (!emoteMats.has(k)) emoteMats.set(k, new THREE.SpriteMaterial({ map: emoteTexture(k), transparent: true, depthWrite: false, depthTest: false }));
  return emoteMats.get(k);
}

// ---------------------------------------------------------------- seats
const V = new THREE.Vector3(), F = new THREE.Vector3(), INV = new THREE.Matrix4();
export function seatOf(target, i = 0, frame = null) {
  if (target && target.isObject3D) {
    const s = (target.userData.seats || [])[i] || target.userData.seat;
    if (!s || typeof s !== 'object') throw new Error(`${target.name || 'that object'} has no seat`);
    target.updateWorldMatrix(true, false);
    V.set(...s.position).applyMatrix4(target.matrixWorld);
    F.set(Math.sin(s.facing), 0, Math.cos(s.facing)).transformDirection(target.matrixWorld);
    if (frame) {
      frame.updateWorldMatrix(true, false);
      INV.copy(frame.matrixWorld).invert();
      V.applyMatrix4(INV); F.transformDirection(INV);
    }
    return { x: V.x, z: V.z, floor: V.y - s.height, height: s.height, facing: Math.atan2(F.x, F.z) };
  }
  const p = Array.isArray(target.position) ? target.position : [target.position.x, target.position.y, target.position.z];
  const height = target.height ?? p[1];
  return { x: p[0], z: p[2], floor: p[1] - height, height, facing: target.facing ?? 0 };
}
const toXZ = (p) => (Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z });

// ---------------------------------------------------------------- props held in the hands
function propMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'clipboard') {
    part(chamfer(0.19, 0.25, 0.014, 0.005), C('cork'), { parent: g, outline: 0.006 });
    part(chamfer(0.15, 0.19, 0.004, 0.001), C('sheet'), { parent: g, z: 0.009, y: -0.012, outline: 0 });
    part(chamfer(0.07, 0.025, 0.014, 0.004), C('chrome'), { parent: g, y: 0.12, z: 0.008, outline: 0.004 });
  } else if (kind === 'laptop') {
    part(chamfer(0.26, 0.19, 0.022, 0.007), C('metal'), { parent: g, outline: 0.006 });
    part(chamfer(0.05, 0.05, 0.004, 0.002), C('chrome'), { parent: g, z: 0.012, outline: 0 });
  } else if (kind === 'box') {
    part(chamfer(0.36, 0.26, 0.28, 0.012), C('cork'), { parent: g, outline: 0.008 });
    part(chamfer(0.08, 0.005, 0.285, 0.001), C('sheet'), { parent: g, y: 0.131, outline: 0 });
    part(chamfer(0.12, 0.07, 0.004, 0.001), C('sheet'), { parent: g, x: 0.08, y: 0.02, z: 0.141, outline: 0 });
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- the person
const JOINTS = ['pelvis', 'spine', 'head', 'hipL', 'kneeL', 'ankleL', 'hipR', 'kneeR', 'ankleR', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR'];
const UPPER_KEYS = ['spine.x', 'spine.y', 'spine.z', 'head.x', 'head.y', 'head.z',
  ...['L', 'R'].flatMap((k) => [`sh${k}.x`, `sh${k}.y`, `sh${k}.z`, `el${k}.x`, `el${k}.z`, `hand${k}.x`, `hand${k}.z`])];
const HOLD_PROP_IN = new Set(['idle', 'walk', 'sit', 'talk']);

export class Person {
  constructor(opts = {}) {
    this.id = nextId++;
    this.name = opts.name || `person-${this.id}`;
    this.spec = dress(opts);
    this.role = this.spec.role; this.seedNo = this.spec.seed;
    this.reducedMotion = opts.reducedMotion ?? !!(RM_QUERY && RM_QUERY.matches);
    this.root = new THREE.Group();
    this.root.name = this.name;
    this.root.userData.person = this;
    const rig = buildRig(this.spec.sig, pieces(this.spec), this.spec.slots);
    this.rig = rig; this.bones = rig.bones; this.meshes = rig.meshes; this.soles = rig.soles;
    this.root.add(rig.group);
    for (const n of ['spine', 'head']) this.bones[n].rotation.order = 'YXZ';
    // props: the one in hand (clipboard or laptop), and a box for carrying
    this.handProp = null;
    if (this.spec.prop) {
      this.handProp = propMesh(this.spec.prop);
      this.handProp.position.set(0.02, -0.1, 0.07);
      this.handProp.rotation.set(-0.15, Math.PI / 2 - 0.2, 0);
      this.bones.handL.add(this.handProp);
    }
    this.box = propMesh('box');
    this.box.position.set(0, 0.12, 0.29);
    this.box.visible = false;
    this.bones.spine.add(this.box);
    // contact shadow and emote bubble
    contactShadow(this.root, { footprint: [0.62, 0.5] });
    this.bubble = new THREE.Sprite(emoteMaterial('bang'));
    this.bubble.visible = false; this.bubble.renderOrder = 20; this.bubble.scale.setScalar(0);
    this.root.add(this.bubble);
    this.emoteKind = null; this.bubbleK = 0; this.bubbleHold = 0;

    // motion state
    this.speed = opts.speed ?? 1.4;
    this.path = []; this.vel = new THREE.Vector2(); this.yaw = 0; this.targetYaw = 0;
    this.phase = 0; this.walkW = 0;
    this.state = 'idle';
    this.w = Object.fromEntries(STATES.map((s) => [s, s === 'idle' ? 1 : 0]));
    this.seat = null; this.sitB = 0; this.hop = 0; this.tr = null;
    this.sq = 0; this.sqV = 0; this.t = 0;
    this.seed = (this.spec.seed * 1.37 + this.id * 0.71) % 10;
    this.blinkT = 1 + (this.seed % 3);
    this.look = null; this.lookW = 0; this.lookYaw = 0; this.lookPitch = 0;
    this.faceName = 'neutral'; this.faceHold = 0; this.faceNow = { ...flatFace(EXPRESSIONS.neutral) };
    this.talk = 0;
    this._seen = -1;
    this._settle();
  }

  // ------------------------------------------------ commands
  play(state) {
    if (!STATES.includes(state)) throw new Error(`unknown state "${state}" (one of ${STATES.join(', ')})`);
    this.state = state;
    const seatedState = state === 'sit' || state === 'type';
    if (seatedState && !this.seat && !this.tr) this.sit({ position: [this.root.position.x, this.root.position.y + 0.5, this.root.position.z], facing: this.yaw, height: 0.5, virtual: true });
    if (!seatedState && this.seat?.virtual && ['idle', 'walk', 'carry', 'wave'].includes(state) && !this.tr) this.stand(this.root.position.clone());
    return this;
  }
  face(yaw) { this.targetYaw = yaw; return this; }
  lookAt(v) { this.look = v ? v.clone() : null; return this; }
  express(name, hold = Infinity) {
    if (!EXPRESSIONS[name]) throw new Error(`unknown expression "${name}"`);
    this.faceName = name; this.faceHold = hold;
    return this;
  }
  walkTo(points) {
    const pts = (Array.isArray(points) && points.length && !Array.isArray(points[0]) && typeof points[0] === 'number' ? [points] : points).map(toXZ);
    if (this.seat || this.tr) return this._afterTr().then(() => (this.seat ? this.stand() : null)).then(() => this.walkTo(pts));
    if (this._arrive) { const r = this._arrive; this._arrive = null; r(false); }
    this.path = pts;
    return new Promise((res) => { this._arrive = res; if (!pts.length) { this._arrive = null; res(true); } });
  }
  sit(target, i = 0) {
    const s = target.virtual ? { ...seatOf(target), virtual: true } : seatOf(target, i, this.root.parent);
    this.path = []; this.vel.set(0, 0);
    if (this._arrive) { const r = this._arrive; this._arrive = null; r(false); }
    this.seat = s;
    const from = this.root.position.clone(), fromYaw = this.yaw;
    this.targetYaw = s.facing;
    return this._transition(0.6, (k, raw) => {
      this.root.position.set(lerp(from.x, s.x, k), lerp(from.y, s.floor, k), lerp(from.z, s.z, k));
      this.yaw = fromYaw + angleTo(fromYaw, s.facing) * k;
      this.sitB = k; this.hop = Math.sin(raw * Math.PI) * 0.09;
    }, () => { this.sqV = -2.6; });
  }
  stand(to) {
    if (!this.seat) return Promise.resolve();
    const s = this.seat, from = this.root.position.clone();
    const dest = to ? toXZ(to) : { x: s.x + Math.sin(s.facing) * 0.5, z: s.z + Math.cos(s.facing) * 0.5 };
    this.sqV = 2.2;
    return this._transition(0.5, (k, raw) => {
      this.root.position.set(lerp(from.x, dest.x, k), from.y, lerp(from.z, dest.z, k));
      this.sitB = 1 - k; this.hop = Math.sin(raw * Math.PI) * 0.07;
    }, () => { this.seat = null; if (this.state === 'sit' || this.state === 'type') this.state = 'idle'; });
  }
  emote(kind, { hold = 2.4 } = {}) {
    const k = EMOTE_ALIAS[kind];
    if (!k) throw new Error(`unknown emote "${kind}"`);
    this.emoteKind = k;
    this.bubble.material = emoteMaterial(k);
    this.bubble.visible = true; this.bubbleK = 0; this.bubbleHold = hold;
    this.express(EMOTE_FACE[k], hold);
    return new Promise((res) => { this._popped = res; });
  }
  hideEmote() { this.bubbleHold = 0; return Promise.resolve(); }
  bounce() { this.sqV = 4; }
  dispose() { PEOPLE.delete(this); this.root.removeFromParent(); }

  // ------------------------------------------------ transitions (driven by update, so no global tweens)
  _transition(dur, fn, done) {
    if (this.tr) { this.tr.fn(1, 1); this.tr.done?.(); this.tr.res(); }
    return new Promise((res) => { this.tr = { t: 0, dur, fn, done, res }; });
  }
  _afterTr() { return this.tr ? new Promise((r) => { const tr = this.tr, old = tr.res; tr.res = () => { old(); r(); }; }) : Promise.resolve(); }
  _settle() { for (let i = 0; i < 3; i++) this.update(1 / 30); PEOPLE.delete(this); }

  // ------------------------------------------------ the frame
  update(dt, t) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.t += dt; t = t ?? this.t;
    clock += dt; this._seen = clock;
    if (this.root.parent) PEOPLE.add(this);
    const rm = this.reducedMotion;
    if (this.tr) {
      const tr = this.tr; tr.t += dt;
      const raw = Math.min(1, tr.t / tr.dur), k = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2;
      tr.fn(k, raw);
      if (raw >= 1) { this.tr = null; this.hop = 0; tr.done?.(); tr.res(); }
    }
    const speed = this._move(dt);
    const walkInPlace = this.state === 'walk' && !this.seat && !this.path.length;
    this.walkW = damp(this.walkW, walkInPlace ? 1 : Math.min(1, speed / this.speed), 10, dt);
    if (!this.tr) this.yaw = dampAngle(this.yaw, this.targetYaw, 8, dt);
    this.root.rotation.y = this.yaw;
    this.phase += dt * (2 * Math.PI / 1.3) * Math.max(speed, walkInPlace ? this.speed * 0.8 : 0);
    for (const s of STATES) this.w[s] = damp(this.w[s], s === this.state ? 1 : 0, 9, dt);
    this.box.visible = this.w.carry > 0.4;
    if (this.handProp) this.handProp.visible = HOLD_PROP_IN.has(this.state) && this.w.carry < 0.3;

    // ---- legs and hips
    const c = { t, sit: this.sitB, walk: this.walkW, phase: this.phase, rm, seed: this.seed };
    const legs = walkLegs(this.phase, this.walkW);
    const fr = this.w.frustrated * (1 - this.sitB) * (1 - this.walkW);
    if (fr > 0.01) { // a stamp of the foot
      const st = Math.max(0, Math.sin(t * 6.5)) * fr;
      legs['hipR.x'] += -0.35 * st; legs['kneeR.x'] += 0.7 * st;
    }
    let pelvisY = Math.max(legExtent(legs['hipL.x'], legs['kneeL.x']), legExtent(legs['hipR.x'], legs['kneeR.x'])) + DIM.hipDrop;
    if (!rm) pelvisY += Math.max(0, Math.sin(t * 7)) * 0.12 * this.w.celebrate * (1 - this.sitB);
    let L = legs, dangle = false;
    if (this.sitB > 0 && this.seat) {
      const sl = seatedLegs(this.seat.height, t, rm);
      dangle = !!sl.dangle;
      L = mix(legs, sl, this.sitB);
      pelvisY = lerp(pelvisY, this.seat.height + DIM.seatDrop, this.sitB);
    }
    pelvisY += this.hop;
    const b = this.bones;
    b.pelvis.position.y = pelvisY;
    for (const k of ['L', 'R']) {
      const s = k === 'L' ? 1 : -1;
      b[`hip${k}`].rotation.set(L[`hip${k}.x`], 0, s * 0.05 * this.sitB);
      b[`knee${k}`].rotation.x = L[`knee${k}.x`];
      // keep the foot flat on the floor (a little toe-off while walking; pointed when dangling)
      b[`ankle${k}`].rotation.x = -(L[`hip${k}.x`] + L[`knee${k}.x`]) * (dangle ? 0.6 : 1 - 0.3 * this.walkW);
    }
    b.pelvis.rotation.set(0, 0, 0);

    // ---- upper body: the base pose, blended toward each playing state by its weight
    let U = base(c);
    for (const s of STATES) if (this.w[s] > 0.002 && s !== 'idle' && s !== 'walk' && s !== 'sit') U = mix(U, { ...U, ...upper(s, c) }, this.w[s]);
    // look-at
    this._look(dt, U);
    for (const key of UPPER_KEYS) {
      const [bone, ax] = key.split('.');
      b[bone].rotation[ax] = U[key] ?? 0;
    }
    // breathing and squash-and-stretch on the upper body
    const k = 120, cc = 9;
    this.sqV += (-k * this.sq - cc * this.sqV) * dt;
    this.sq += this.sqV * dt;
    const sq = THREE.MathUtils.clamp(this.sq, -0.25, 0.25) * (rm ? 0.4 : 1);
    const br = Math.sin(t * 2.3 + this.seed) * (rm ? 0.004 : 0.012);
    b.spine.scale.set(1 - sq * 0.4 + br * 0.5, 1 + sq + br, 1 - sq * 0.4 + br * 0.5);
    b.root.position.x = 0;

    this._face(dt, t);
    this._bubble(dt, t, pelvisY);
    return this;
  }

  _move(dt) {
    const p = this.root.position;
    if (!this.path.length || this.tr) { this.vel.multiplyScalar(Math.exp(-12 * dt)); return 0; }
    const tg = this.path[0], last = this.path.length === 1;
    let dx = tg.x - p.x, dz = tg.z - p.z;
    const d = Math.hypot(dx, dz);
    const others = neighbours(this);
    // arrive: close enough, or the spot is taken and we are near it
    const taken = last && d < 0.7 && others.some((o) => Math.hypot(o.root.position.x - tg.x, o.root.position.z - tg.z) < 0.45);
    if (d < (last ? 0.03 : 0.3) || taken) {
      this.path.shift();
      if (!this.path.length) { this.vel.set(0, 0); if (this._arrive) { const r = this._arrive; this._arrive = null; r(true); } }
      return this.vel.length();
    }
    dx /= d; dz /= d;
    let slow = last ? Math.min(1, 0.25 + d / 0.6) : 1;
    let px = 0, pz = 0;
    const R = 0.8;
    for (const o of others) {
      let ox = p.x - o.root.position.x, oz = p.z - o.root.position.z;
      let od = Math.hypot(ox, oz);
      if (od > R) continue;
      if (od < 1e-4) { ox = this.id > o.id ? -dz : dz; oz = this.id > o.id ? dx : -dx; od = 1e-4; }
      else { ox /= od; oz /= od; }
      const ahead = -(ox * dx + oz * dz); // cos of the angle to the other person, from my heading
      const ov = o.vel.length(), oncoming = ov > 0.1 && (o.vel.x * dx + o.vel.y * dz) / ov < -0.3;
      const push = (R - od) / R;
      if (oncoming) { // coming towards me: both keep to their right and pass
        if (ahead > 0) { px += -dz * push * 1.6; pz += dx * push * 1.6; }
      } else if (ahead > 0.35 && (o.path.length === 0 || ahead > 0.9 || this.id > o.id)) { // queue behind
        slow = Math.min(slow, THREE.MathUtils.clamp((od - 0.5) / 0.35, 0, 1));
      }
      px += ox * push * 1.2; pz += oz * push * 1.2;
    }
    const tvx = dx * this.speed * slow + px, tvz = dz * this.speed * slow + pz;
    this.vel.x = damp(this.vel.x, tvx, 9, dt); this.vel.y = damp(this.vel.y, tvz, 9, dt);
    p.x += this.vel.x * dt; p.z += this.vel.y * dt;
    // never closer than MIN to anyone (the mover gives way)
    const MIN = 0.42;
    for (const o of others) {
      const ox = p.x - o.root.position.x, oz = p.z - o.root.position.z, od = Math.hypot(ox, oz);
      if (od < MIN && od > 1e-6) { p.x += ox / od * (MIN - od); p.z += oz / od * (MIN - od); }
    }
    const sp = this.vel.length();
    if (sp > 0.05) this.targetYaw = Math.atan2(this.vel.x, this.vel.y);
    return sp;
  }

  _look(dt, U) {
    let want = 0;
    if (this.look) {
      this.root.updateWorldMatrix(true, false);
      const hp = new THREE.Vector3(0, this.bones.pelvis.position.y + 0.6, 0).applyMatrix4(this.root.matrixWorld);
      const dir = this.look.clone().sub(hp).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()).invert());
      this.lookYaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -1.2, 1.2);
      this.lookPitch = THREE.MathUtils.clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.5, 0.45);
      want = 1;
    }
    this.lookW = damp(this.lookW, want, 6, dt);
    if (this.lookW > 0.001) {
      U['head.y'] = lerp(U['head.y'] ?? 0, this.lookYaw * 0.7, this.lookW);
      U['head.x'] = lerp(U['head.x'] ?? 0, this.lookPitch, this.lookW);
      U['spine.y'] = lerp(U['spine.y'] ?? 0, this.lookYaw * 0.3, this.lookW);
    }
  }

  _face(dt, t) {
    if (this.faceHold !== Infinity) {
      this.faceHold -= dt;
      if (this.faceHold <= 0) { this.faceName = null; this.faceHold = Infinity; }
    }
    const name = this.faceName || STATE_FACE[this.state] || 'neutral';
    const want = flatFace(EXPRESSIONS[name]);
    const f = this.faceNow;
    for (const k of Object.keys(want)) f[k] = damp(f[k], want[k], 12, dt);
    // talking: the mouth opens and closes
    this.talk = damp(this.talk, this.state === 'talk' ? 1 : 0, 10, dt);
    const chatter = this.talk * (0.25 + 0.75 * Math.abs(Math.sin(t * 9.5) * Math.sin(t * 5.3 + 1)));
    // blink
    this.blinkT -= dt;
    if (this.blinkT < 0) this.blinkT = 1.8 + ((this.seed * 7.3 + t) % 3.2);
    const blink = this.blinkT < 0.12 ? 0.1 : 1;
    const b = this.bones;
    for (const [k, s] of [['L', 1], ['R', -1]]) {
      const eye = b[`eye${k}`], e = eye.userData.face;
      const open = 1 - f.happy;
      const { pos } = facePoint(e.el + f.gUp, e.az + f.gSide, e.out);
      eye.position.copy(pos);
      eye.scale.set(Math.max(1e-3, f.ex * open), Math.max(1e-3, f.ey * blink * open), Math.max(1e-3, open));
      b[`happy${k}`].scale.setScalar(Math.max(1e-3, f.happy));
      const brow = b[`brow${k}`], bf = brow.userData.face;
      const raise = f.bRaise + (s > 0 ? f.bOne : 0);
      const bp = facePoint(bf.el + raise / DIM.headR, bf.az, bf.out);
      brow.position.copy(bp.pos);
      brow.rotation.set(bp.rot.x, bp.rot.y, -s * f.bTilt, 'YXZ');
    }
    const talkK = 1 - this.talk;
    b.mSmile.scale.setScalar(Math.max(1e-3, f.smile * talkK));
    b.mGrin.scale.setScalar(Math.max(1e-3, f.grin * talkK));
    b.mFrown.scale.setScalar(Math.max(1e-3, f.frown * talkK));
    b.mFlat.scale.setScalar(Math.max(1e-3, f.flat * talkK));
    const o = Math.max(f.o * talkK, chatter);
    b.mO.scale.set(Math.max(1e-3, Math.min(1, o + this.talk * 0.1)), Math.max(1e-3, o), 1);
  }

  _bubble(dt, t, pelvisY) {
    if (!this.bubble.visible) return;
    if (this.bubbleHold !== Infinity) this.bubbleHold -= dt;
    const showing = this.bubbleHold > 0;
    const k0 = this.bubbleK;
    this.bubbleK = showing ? Math.min(1, k0 + dt / 0.45) : Math.max(0, k0 - dt / 0.2);
    const e = showing ? elastic(this.bubbleK) : this.bubbleK ** 3;
    this.bubble.scale.setScalar(0.62 * e);
    this.bubble.position.set(0, pelvisY + 1.28 + (this.reducedMotion ? 0 : Math.sin(t * 4) * 0.035), 0);
    if (showing && this.bubbleK >= 1 && this._popped) { const r = this._popped; this._popped = null; r(); }
    if (!showing && this.bubbleK <= 0) { this.bubble.visible = false; this.emoteKind = null; if (this._popped) { const r = this._popped; this._popped = null; r(); } }
  }
}

function flatFace(x) {
  const m = x.mouth;
  return { ex: x.eye[0], ey: x.eye[1], happy: x.happy, bRaise: x.brow[0], bTilt: x.brow[1], bOne: x.brow[2], gUp: x.glance[0], gSide: x.glance[1],
    smile: m.smile || 0, grin: m.grin || 0, o: m.o || 0, frown: m.frown || 0, flat: m.flat || 0 };
}
function angleTo(a, b) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return d; }
const elastic = (k) => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
function neighbours(me) {
  const out = [];
  for (const o of PEOPLE) {
    if (o === me) continue;
    if (clock - o._seen > 0.5 || !o.root.parent) { PEOPLE.delete(o); continue; }
    if (o.root.parent === me.root.parent) out.push(o);
  }
  return out;
}

// ---------------------------------------------------------------- the registered asset
const posed = (state) => (obj, t) => {
  const p = obj.userData.person;
  if (!p) return;
  const dt = p._animT === undefined ? 1 / 60 : t - p._animT;
  p._animT = t;
  if (p.state !== state) p.play(state);
  p.update(dt > 0 ? dt : 1 / 60, t);
};
register('person', {
  category: 'character', tiles: [1, 1],
  build({ role = 'office', seed = 1, state = 'idle', ...rest } = {}) {
    const p = new Person({ role, seed, reducedMotion: true, ...rest });
    p.play(state);
    for (let i = 0; i < 30; i++) p.update(1 / 30);
    PEOPLE.delete(p);
    p.reducedMotion = rest.reducedMotion ?? !!(RM_QUERY && RM_QUERY.matches);
    return p.root;
  },
  anims: Object.fromEntries(STATES.map((s) => [s, posed(s)])),
});
