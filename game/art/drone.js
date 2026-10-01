// drone.js: the player's avatar. It acts out, in the world, what the learner's code changed: it flies to a
// person, scans a room (the beam turns green or red and a mark stays over the room), stamps a ticket, escorts
// a person to a seat, carries things, celebrates, or shrugs when the code changed nothing.
//
//   const d = new Drone({ reducedMotion?, fx? })   add d.root to the world (it stands on that floor, y = 0 of its
//                                  parent, and hovers above it); call d.update(dt, t) every frame
//     .flyTo(point, { alt })        -> Promise   point: Vector3, [x, z], [x, y, z], { x, z } or an Object3D
//     .scan(target, verdict)        -> Promise   verdict: true / 'pass' / 'ok' (green) or false / 'fail' (red)
//     .stamp(target, state?)        -> Promise   a TicketCard (fx.js) takes the state (default BOOKED), or any point
//     .escort(person, seat, i = 0)  -> Promise   flies to the person, who walks beside it and sits on the seat
//                                                (an object with userData.seats / seat, people.js seat convention)
//     .carry(object)                -> Promise   picks the object up (out of a person's hands too); d.carried
//     .drop(point?)                 -> Promise   sets what it carries down on the floor (at point, or here)
//     .celebrate()                  -> Promise   a loop and a burst of confetti (reduced motion: a proud glow)
//     .shrug()                      -> Promise   "your code changed nothing": a worried wobble and a '…' bubble
//     .express(name, hold?)         neutral happy focus worried proud (the face on its screen; it blinks)
//     .cancel()                     every pending action resolves (false) and motion stops; the drone is idle
//     .reset()                      cancel(), clear its marks and effects
//     .faceCamera(camera | null)    when idle, turn the face towards this camera
//     .dispose()
//   Every action resolves true when it finishes and false when cancelled (or replaced by a newer action).
//   d.state: 'idle' or the running action; d.faceName: the expression showing; d.fx: its Effects layer.
//
// Colours: palette.drone* (and ok / danger for verdicts) from the theme, live. Size, speed and trail: drone.*.
import * as THREE from 'three';
import { register } from './registry.js';
import { C } from './parts.js';
import { chamfer, drum, ball, lathe, merged, mat4, rng } from './shapes.js';
import { part, canvasTex, glowTex, blobTex, damp, dampAngle, lerp } from '../engine/kit.js';
import { get as tget, onThemeChange } from '../engine/theme.js';
import { Effects, colour, STATE_COLOUR } from './fx.js';
import { seatOf, letGo } from './people.js';

export const EXPRESSIONS = {
  //         open  happy focus worried mouth  wide blush sparkle lookY
  neutral: { open: 1, happy: 0, focus: 0, worried: 0, mouth: 0.35, wide: 0.2, blush: 0.15, sparkle: 0, lookY: 0 },
  happy: { open: 1, happy: 1, focus: 0, worried: 0, mouth: 0.95, wide: 0.6, blush: 0.55, sparkle: 0, lookY: 0 },
  focus: { open: 0.8, happy: 0, focus: 1, worried: 0, mouth: 0, wide: 0, blush: 0, sparkle: 0, lookY: 0.35 },
  worried: { open: 0.95, happy: 0, focus: 0, worried: 1, mouth: -0.75, wide: 0.1, blush: 0, sparkle: 0, lookY: 0.1 },
  proud: { open: 1, happy: 0.9, focus: 0, worried: 0, mouth: 1, wide: 1, blush: 0.75, sparkle: 1, lookY: -0.35 },
};
const ACTION_FACE = { flyTo: 'focus', scan: 'focus', stamp: 'focus', escort: 'happy', carry: 'focus', drop: 'focus', celebrate: 'proud', shrug: 'worried' };
const RM_QUERY = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const CANCEL = Symbol('cancelled');
const ALT = 1.75;          // hover height of the body's centre above the floor
const LENS = -0.16;        // the lens under the body (rig units)
const FACE_W = 256, FACE_H = 168;

// scratch
const VA = new THREE.Vector3(), VB = new THREE.Vector3(), INV = new THREE.Matrix4(), BOX = new THREE.Box3();
const QA = new THREE.Quaternion(), CA = new THREE.Color(), CB = new THREE.Color();
const smooth = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const outBack = (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const passOf = (v) => v === true || v === 'pass' || v === 'ok' || v === 'green';

// ---------------------------------------------------------------- the model
function buildBody(rig) {
  const shell = C('droneShell'), shade = C('droneShade'), dark = C('droneRotor');
  // the body: a round, slightly squat dome
  const body = lathe('drone-body', [[0, -0.13], [0.12, -0.13], [0.2, -0.105], [0.245, -0.055], [0.262, 0], [0.255, 0.05], [0.228, 0.1], [0.17, 0.145], [0.09, 0.168], [0, 0.174]], 24);
  part(body, shell, { parent: rig, outline: 0.014 });
  // the underside cap and the lens
  part(lathe('drone-belly', [[0, -0.165], [0.1, -0.16], [0.155, -0.13], [0.16, -0.115]], 18), shade, { parent: rig, outline: 0.01 });
  // rotor arms on the diagonals, motor pods and hub caps
  const arms = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const arm = new THREE.Group(); arm.rotation.y = a; rig.add(arm);
    part(chamfer(0.26, 0.04, 0.055, 0.014), shade, { parent: arm, x: 0.28, y: -0.02, outline: 0.009 });
    part(drum(0.05, 0.075, 12, 0.012), dark, { parent: arm, x: 0.39, y: 0.0, outline: 0.009 });
    const rotor = new THREE.Group(); rotor.position.set(0.39, 0.05, 0); arm.add(rotor);
    arms.push({ arm, rotor });
  }
  // the antenna: a little stalk with a glowing bulb, on the back of the head
  part(drum(0.009, 0.12, 6, 0.003), dark, { parent: rig, x: 0.05, y: 0.215, z: -0.1, rz: -0.25, rx: -0.3, outline: 0.006 });
  return arms;
}
// a two-blade propeller (one merged geometry) and its blur disc
const bladeGeo = () => merged('drone-blades', () => [[chamfer(0.25, 0.008, 0.03, 0.004), mat4(0, 0, 0, 0, 0, 0.12)], [ball(0.022, 8), mat4(0, 0.006, 0)]]);
let blurTex = null;
function blurTexture() {
  if (blurTex) return blurTex;
  blurTex = canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    const gr = g.createRadialGradient(64, 64, 10, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.28)'); gr.addColorStop(0.88, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 2; i++) { // two lighter sweeps, like blades caught mid-turn
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.moveTo(64, 64); g.arc(64, 64, 64, i * Math.PI + 0.2, i * Math.PI + 1.5); g.closePath(); g.fill();
    }
  });
  return blurTex;
}
const beamGeo = (() => { let g = null; return () => { if (!g) { g = new THREE.ConeGeometry(1, 1, 28, 1, true); g.translate(0, -0.5, 0); } return g; }; })();
const BEAM_VS = 'varying float vH; void main(){ vH = -position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const BEAM_FS = `uniform vec3 color; uniform float strength, time; varying float vH;
  void main(){ float bands = 0.6 + 0.4 * smoothstep(0.55, 1.0, sin(vH * 22.0 - time * 8.0));
    float a = strength * (0.35 + 0.65 * vH) * bands;
    gl_FragColor = vec4(color, a); }`;

// ---------------------------------------------------------------- the face on the screen
function drawFace(g, f, t) {
  const W = FACE_W, H = FACE_H;
  const bg = tget('palette.droneScreen'), eye = tget('palette.droneEye');
  g.clearRect(0, 0, W, H);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H / 2, W * 0.6);
  vg.addColorStop(0, 'rgba(120,200,255,0.10)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const cx = W / 2 + f.lookX * 12, cy = H * 0.42 + f.lookY * 10;
  const ew = 31, eh = 46 * Math.max(0.06, f.open * (1 - 0.3 * f.focus));
  g.save();
  g.shadowColor = eye; g.shadowBlur = 16;
  for (const s of [-1, 1]) {
    const ex = cx + s * 60, ey = cy;
    const round = 1 - f.happy;
    if (round > 0.02) {
      g.globalAlpha = round;
      g.fillStyle = eye;
      g.beginPath(); g.roundRect(ex - ew, ey - eh, ew * 2, eh * 2, Math.min(ew, eh)); g.fill();
      // lids: focus lowers the inner corner, worried the outer one (cut with the screen colour)
      g.shadowBlur = 0; g.fillStyle = bg;
      const lid = (inner, outer) => { // a straight lid from the inner corner to the outer one
        const xl = ex - ew - 4, xr = ex + ew + 4, top = ey - eh, innerRight = s < 0;
        g.beginPath(); g.moveTo(xl, top - 8); g.lineTo(xr, top - 8);
        g.lineTo(xr, top + (innerRight ? inner : outer)); g.lineTo(xl, top + (innerRight ? outer : inner)); g.closePath(); g.fill();
      };
      if (f.focus > 0.01) lid(eh * 0.95 * f.focus, -2);
      if (f.worried > 0.01) lid(-2, eh * 0.85 * f.worried);
      // a highlight
      g.fillStyle = 'rgba(255,255,255,0.85)';
      if (eh > 12) { g.beginPath(); g.ellipse(ex - ew * 0.35, ey - eh * 0.45, 6, 8 * Math.min(1, eh / 30), 0, 0, Math.PI * 2); g.fill(); }
      g.shadowBlur = 16;
    }
    if (f.happy > 0.02) { // closed, smiling eyes: ^ ^
      g.globalAlpha = f.happy;
      g.strokeStyle = eye; g.lineWidth = 16; g.lineCap = 'round';
      g.beginPath(); g.arc(ex, ey + 18, 30, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    g.globalAlpha = 1;
  }
  // the mouth
  const mw = 14 + 14 * f.wide, my = H * 0.82 + f.lookY * 6, m = f.mouth;
  g.strokeStyle = eye; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - mw, my - m * 3);
  if (m < -0.2) { g.bezierCurveTo(cx - mw * 0.3, my - 10 * -m, cx + mw * 0.3, my + 6 * -m, cx + mw, my - 4 * -m); } // a wobbly worry
  else g.quadraticCurveTo(cx, my + m * 22, cx + mw, my - m * 3);
  g.stroke();
  g.restore();
  // cheeks and sparkles
  if (f.blush > 0.02) {
    g.fillStyle = tget('palette.blush'); g.globalAlpha = 0.5 * f.blush;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 96, cy + 36, 18, 10, 0, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }
  if (f.sparkle > 0.02) {
    g.fillStyle = '#fff'; g.globalAlpha = f.sparkle;
    for (const [x, y, r] of [[30, 26, 11], [W - 34, 30, 8], [W - 22, 62, 5]]) {
      const tw = r * (0.8 + 0.2 * Math.sin(t * 6 + x));
      g.beginPath(); g.moveTo(x, y - tw); g.quadraticCurveTo(x, y, x + tw, y); g.quadraticCurveTo(x, y, x, y + tw); g.quadraticCurveTo(x, y, x - tw, y); g.quadraticCurveTo(x, y, x, y - tw); g.fill();
    }
    g.globalAlpha = 1;
  }
  // scanlines and a glassy sheen
  g.fillStyle = 'rgba(0,0,0,0.13)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  const sh = g.createLinearGradient(0, 0, W * 0.6, H);
  sh.addColorStop(0, 'rgba(255,255,255,0.16)'); sh.addColorStop(0.35, 'rgba(255,255,255,0.03)'); sh.addColorStop(0.36, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- the drone
export class Drone {
  constructor({ reducedMotion, fx = null, name = 'drone' } = {}) {
    this.reducedMotion = reducedMotion ?? !!(RM_QUERY && RM_QUERY.matches);
    this.root = new THREE.Group(); this.root.name = name;
    this.root.userData.drone = this;
    // root (on the floor) > body (height, yaw) > tilt > rig (theme scale) > parts
    this.body = new THREE.Group(); this.root.add(this.body);
    this.tilt = new THREE.Group(); this.body.add(this.tilt);
    this.rig = new THREE.Group(); this.tilt.add(this.rig);
    this.arms = buildBody(this.rig);
    // own materials: the ring light, bulb, lens and blur discs change colour or opacity per drone
    this.ringMat = new THREE.MeshBasicMaterial({ color: tget('palette.droneRing'), toneMapped: false });
    this.lensMat = new THREE.MeshBasicMaterial({ color: tget('palette.droneBeam'), toneMapped: false });
    part(new THREE.TorusGeometry(0.258, 0.02, 8, 40), this.ringMat, { parent: this.rig, rx: Math.PI / 2, y: 0.035, outline: 0.008, cast: false });
    part(new THREE.CircleGeometry(0.055, 18), this.lensMat, { parent: this.rig, y: LENS - 0.006, rx: Math.PI / 2, outline: 0, cast: false });
    this.bulb = part(ball(0.03, 10), this.ringMat, { parent: this.rig, x: 0.066, y: 0.28, z: -0.121, outline: 0.006, cast: false });
    this.blurMat = new THREE.MeshBasicMaterial({ map: blurTexture(), color: tget('palette.droneShade'), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    const blades = bladeGeo(), disc = new THREE.CircleGeometry(0.15, 24);
    for (const a of this.arms) {
      a.blade = part(blades, C('droneShade'), { parent: a.rotor, outline: 0.005 });
      a.cap = part(ball(0.026, 8), this.ringMat, { parent: a.rotor, y: 0.018, outline: 0.005, cast: false });
      a.disc = part(disc, this.blurMat, { parent: a.rotor, rx: -Math.PI / 2, y: 0.004, outline: 0, cast: false });
    }
    // the face screen, set into the top-front of the dome and tilted up to the camera
    this.faceTex = canvasTex(FACE_W, FACE_H, () => {});
    this.faceMat = new THREE.MeshBasicMaterial({ map: this.faceTex, toneMapped: false });
    const screen = new THREE.Group(); screen.position.set(0, 0.105, 0.235); screen.rotation.x = -0.95; this.rig.add(screen);
    part(chamfer(0.36, 0.25, 0.07, 0.03), C('droneRotor'), { parent: screen, z: -0.01, outline: 0.012 });
    this.faceMesh = part(new THREE.PlaneGeometry(0.32, 0.21), this.faceMat, { parent: screen, z: 0.026, outline: 0, cast: false });
    this.screen = screen;
    // the hook things hang from
    this.hook = new THREE.Group(); this.hook.position.y = LENS - 0.03; this.rig.add(this.hook);
    part(new THREE.TorusGeometry(0.03, 0.008, 6, 14, Math.PI * 1.2), C('droneRotor'), { parent: this.hook, rz: Math.PI * 1.4, y: -0.01, outline: 0.004 });
    // the beam and its floor spot (upright, not tilted), the shadow blob on the floor
    this.beamMat = new THREE.ShaderMaterial({ uniforms: { color: { value: new THREE.Color() }, strength: { value: 0 }, time: { value: 0 } },
      vertexShader: BEAM_VS, fragmentShader: BEAM_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(beamGeo(), this.beamMat); this.beam.visible = false; this.beam.renderOrder = 4; this.beam.frustumCulled = false;
    this.root.add(this.beam);
    this.spotMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    this.spot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.spotMat); this.spot.rotation.x = -Math.PI / 2; this.spot.position.y = 0.025; this.spot.visible = false;
    this.root.add(this.spot);
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.5, depthWrite: false });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.blobMat); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.012; this.blob.renderOrder = 1;
    this.root.add(this.blob);
    // the soft trail: a ring of points in the parent's frame, fading
    this.trailN = 90;
    const tg = new THREE.BufferGeometry();
    this.trailPos = new Float32Array(this.trailN * 3); this.trailCol = new Float32Array(this.trailN * 3); this.trailAge = new Float32Array(this.trailN).fill(99);
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(this.trailCol, 3));
    this.trail = new THREE.Points(tg, new THREE.PointsMaterial({ map: glowTex, size: 0.32, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.trail.frustumCulled = false; this.trail.name = 'drone-trail';
    this.trailI = 0; this.lastEmit = new THREE.Vector3(1e9, 0, 0);
    // effects: marks, rings, confetti (shared with the page when given)
    this.fx = fx || new Effects({ reducedMotion: this.reducedMotion });
    this.ownFx = !fx;

    // state
    this.alt = ALT; this.dip = 0; this.hop = 0; this.roll = 0; this.spin = 0; this.wobble = 0;
    this.yaw = 0; this.idleYaw = 0; this.bank = 0; this.camera = null;
    this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.hasPrev = false;
    this.state = 'idle'; this.faceName = 'neutral'; this.faceHold = Infinity; this.actionFace = null;
    this.faceNow = { ...EXPRESSIONS.neutral, lookX: 0 }; this.faceDrawn = null; this.faceDirty = true;
    this.blinkT = 2.2; this.blink = 1;
    this.beamOn = 0; this.beamWant = 0; this.beamR = 0.55; this.verdict = null; this.verdictK = 0; this.ringFlash = 0;
    this.follow = null; this.carried = null;
    this.tasks = []; this._gen = 0; this._pending = null;
    this.t = 0;
    this._off = onThemeChange((p) => { if (!p || p.startsWith('palette.')) this.faceDirty = true; });
    this.update(1 / 60);
  }

  // ------------------------------------------------ the face
  express(name, hold = Infinity) {
    if (!EXPRESSIONS[name]) throw new Error(`unknown expression "${name}" (one of ${Object.keys(EXPRESSIONS).join(', ')})`);
    this.faceName = name; this.faceHold = hold; return this;
  }
  faceCamera(camera) { this.camera = camera || null; return this; }

  // ------------------------------------------------ actions
  flyTo(point, { alt } = {}) {
    return this._run('flyTo', async () => { const p = this._toLocal(point, VA); await this._fly(p.x, p.z, alt ?? ALT); });
  }
  scan(target, verdict, { radius, markAt } = {}) {
    const pass = passOf(verdict);
    return this._run('scan', async () => {
      const p = this._toLocal(target, new THREE.Vector3()), top = this._topOf(target);
      await this._fly(p.x, p.z, Math.max(ALT + 0.15, top + 0.9));
      this.beamR = radius ?? 0.6; this.verdict = null; this.verdictK = 0; this.beamWant = 1;
      await this._wait(this.reducedMotion ? 0.6 : 1.1); // sweeping
      this.verdict = pass;
      this.express(pass ? 'happy' : 'worried', 1.6);
      const markY = markAt ?? Math.max(1.1, top + 0.35);
      this.fx.mark([p.x, markY, p.z], pass);
      this.fx.ring([p.x, 0.03, p.z], { color: pass ? 'palette.ok' : 'palette.danger', from: 0.3, to: 1.5, dur: 0.7 });
      if (!pass) this.wobble = 1; else this.hop = 1;
      await this._wait(0.75);
      this.beamWant = 0;
      await this._wait(0.25);
    });
  }
  stamp(target, state = 'BOOKED') {
    return this._run('stamp', async () => {
      const card = target && target.stamp && target.root ? target : null;
      const obj = card ? card.root : target;
      const p = this._toLocal(obj, new THREE.Vector3()), top = card ? p.y + 0.12 : this._topOf(obj);
      const alt = Math.max(0.8, top + 0.55);
      await this._fly(p.x, p.z, alt);
      await this._wait(0.15);
      await this._tween(0.2, (k) => { this.dip = 0.32 * k * k; });
      if (card) card.stamp(state);
      const col = STATE_COLOUR[state] || 'palette.gold';
      this.fx.ring([p.x, card ? p.y - 0.25 : 0.03, p.z], { color: col, from: 0.1, to: 0.8, dur: 0.45 });
      this.fx.sparks([p.x, top, p.z], { n: 10, color: col, speed: 1.4, up: 1.2 });
      this.squash = 1;
      this.express('happy', 1.2);
      await this._tween(0.35, (k) => { this.dip = 0.32 * (1 - outBack(k)); });
      this.dip = 0;
    });
  }
  // escort(person, seat, i, { path }): path (points in the person's frame) is the way to walk, ending by
  // the seat; without one the person walks straight to the seat
  escort(person, seat, i = 0, { path = null } = {}) {
    return this._run('escort', async () => {
      const frame = person.root.parent;
      const s = seatOf(seat, i, frame);
      const approach = { x: s.x + Math.sin(s.facing) * 0.62, z: s.z + Math.cos(s.facing) * 0.62 };
      // fly to the person, say hello
      const pp = person.root.position;
      const dx = approach.x - pp.x, dz = approach.z - pp.z, dl = Math.hypot(dx, dz) || 1;
      await this._fly(pp.x + (dx / dl) * 0.7, pp.z + (dz / dl) * 0.7, ALT);
      person.lookAt(this.body.getWorldPosition(new THREE.Vector3()));
      person.express('happy', 1.4);
      this.express('happy');
      await this._wait(0.45);
      person.lookAt(null);
      // walk together: the drone keeps beside the person, a little ahead
      this.follow = { person, side: 1 };
      await this._guard(person.walkTo(path && path.length ? path : [approach]));
      this.follow = null;
      await this._guard(person.sit(seat, i));
      this.express('proud', 1.5);
      await this._wait(0.4);
    }, () => { if (this.follow) { const pr = this.follow.person; this.follow = null; if (!pr.seat && !pr.tr && pr.path.length) pr.walkTo([]); } });
  }
  carry(object) {
    return this._run('carry', async () => {
      if (this.carried === object) return;
      if (this.carried) this._setDown(this.carried, this.root.position);
      const p = this._toLocal(object, new THREE.Vector3());
      object.updateWorldMatrix(true, true);
      BOX.setFromObject(object);
      const wy = object.getWorldPosition(VB).y, above = BOX.max.y - wy, below = wy - BOX.min.y;
      const frameTop = p.y + above;
      await this._fly(p.x, p.z, Math.max(ALT, frameTop + 0.8));
      const grab = frameTop - (LENS - 0.06) * this._scale();
      const a0 = this.alt;
      await this._tween(0.45, (k) => { this.alt = lerp(a0, grab, k); });
      letGo(object);
      this.hook.attach(object);
      this.carried = object;
      this.carriedDrop = below;
      const from = object.position.clone(), q0 = object.quaternion.clone(), to = new THREE.Vector3(0, -above / this._scale(), 0);
      this.squash = 0.6;
      await this._tween(0.3, (k) => { object.position.lerpVectors(from, to, k); object.quaternion.slerpQuaternions(q0, QA.identity(), k); });
      await this._tween(0.45, (k) => { this.alt = lerp(grab, ALT, smooth(k)); });
    });
  }
  drop(point) {
    return this._run('drop', async () => {
      const o = this.carried;
      if (!o) return;
      if (point) { const p = this._toLocal(point, new THREE.Vector3()); await this._fly(p.x, p.z, ALT); }
      o.updateWorldMatrix(true, true);
      BOX.setFromObject(o);
      const bottomNow = BOX.min.y, rootY = this.root.getWorldPosition(VB).y;
      const a0 = this.alt, a1 = a0 - (bottomNow - rootY) + 0.02;
      await this._tween(0.5, (k) => { this.alt = lerp(a0, a1, smooth(k)); });
      this._setDown(o);
      this.fx.ring([this.root.position.x, 0.03, this.root.position.z], { color: 'palette.droneShade', from: 0.1, to: 0.7, dur: 0.4 });
      this.express('happy', 1);
      await this._tween(0.45, (k) => { this.alt = lerp(a1, ALT, smooth(k)); });
    });
  }
  celebrate() {
    return this._run('celebrate', async () => {
      this.express('proud', 2.2);
      const at = this.body.getWorldPosition(new THREE.Vector3());
      if (this.root.parent) { this.root.parent.updateWorldMatrix(true, false); at.applyMatrix4(INV.copy(this.root.parent.matrixWorld).invert()); }
      this.ringFlash = 1;
      if (this.reducedMotion) { this.fx.ring([at.x, 0.03, at.z], { color: 'palette.gold', to: 1.6 }); await this._wait(1.4); return; }
      this.fx.burst(at, { confetti: 60, coins: 8, sparks: 24 });
      const a0 = this.alt;
      await this._tween(0.35, (k) => { this.alt = a0 + 0.45 * smooth(k); this.roll = 0; });
      await this._tween(0.6, (k) => { this.roll = smooth(k) * Math.PI * 2; this.spin = smooth(k) * Math.PI * 2; });
      this.roll = 0; this.spin = 0;
      await this._tween(0.45, (k) => { this.alt = a0 + 0.45 * (1 - smooth(k)); });
      this.alt = a0;
      await this._wait(0.4);
    });
  }
  shrug() {
    return this._run('shrug', async () => {
      this.express('worried', 2);
      const at = this.body.getWorldPosition(new THREE.Vector3());
      if (this.root.parent) { this.root.parent.updateWorldMatrix(true, false); at.applyMatrix4(INV.copy(this.root.parent.matrixWorld).invert()); }
      at.y += 0.4 * this._scale();
      this.fx.emote(at, 'dots', { hold: 1.5 });
      this.shrugK = 1;
      await this._wait(1.7);
      this.shrugK = 0;
    });
  }
  cancel() {
    this._abort();
    this._idle();
    return this;
  }
  reset() { this.cancel(); this.fx.reset(); return this; }
  dispose() {
    this.cancel();
    this._off();
    this.root.removeFromParent(); this.trail.removeFromParent();
    if (this.ownFx) this.fx.dispose();
    this.faceTex.dispose();
    for (const m of [this.faceMat, this.ringMat, this.lensMat, this.blurMat, this.beamMat, this.spotMat, this.blobMat, this.trail.material]) m.dispose();
    this.trail.geometry.dispose(); this.spot.geometry.dispose(); this.blob.geometry.dispose();
  }

  // ------------------------------------------------ the action machinery
  // _run(): one action at a time. A new action (or cancel) resolves the running one with false; its body
  // stops at its next await (the primitives reject with CANCEL).
  _run(name, body, onCancel) {
    this._abort();
    const gen = ++this._gen;
    this.state = name; this.actionFace = ACTION_FACE[name] || null;
    if (this.actionFace) { this.faceName = this.actionFace; this.faceHold = Infinity; }
    return new Promise((res) => {
      this._pending = { res, onCancel };
      let run; // the body starts now (its first step is queued this frame), and continues as its steps finish
      try { run = Promise.resolve(body()); } catch (e) { run = Promise.reject(e); }
      run.then(() => {
        if (this._gen !== gen) return;
        this._pending = null; this._idle(false); res(true);
      }, (e) => {
        if (e !== CANCEL) console.error(e);
        if (this._gen !== gen) return;
        this._pending = null; this._idle(); res(false);
      });
    });
  }
  _abort() {
    this._gen++;
    const tasks = this.tasks; this.tasks = [];
    for (const t of tasks) t.rej(CANCEL);
    const p = this._pending; this._pending = null;
    if (p) { try { p.onCancel?.(); } catch (e) { console.error(e); } p.res(false); }
  }
  _idle(stop = true) {
    this.state = 'idle'; this.actionFace = null; this.follow = null;
    if (stop) { this.beamWant = 0; this.dip = 0; this.roll = 0; this.spin = 0; this.shrugK = 0; this.faceName = 'neutral'; this.faceHold = Infinity; }
    else if (this.faceHold === Infinity) this.faceName = 'neutral';
  }
  _task(t) { return new Promise((res, rej) => { t.res = res; t.rej = rej; this.tasks.push(t); }); }
  _wait(s) { return this._task({ kind: 'tween', t: 0, dur: Math.max(1e-4, s), fn: null }); }
  _tween(s, fn) { return this._task({ kind: 'tween', t: 0, dur: Math.max(1e-4, s), fn }); }
  _guard(promise) {
    const t = { kind: 'guard' };
    const p = this._task(t);
    promise.then((v) => { const i = this.tasks.indexOf(t); if (i >= 0) { this.tasks.splice(i, 1); t.res(v); } });
    return p;
  }
  _fly(x, z, alt) {
    const p = this.root.position, d = Math.hypot(x - p.x, z - p.z), da = Math.abs(alt - this.alt);
    if (d < 0.02 && da < 0.02) { this.alt = alt; return Promise.resolve(); }
    const speed = Math.max(0.2, tget('drone.speed') || 1);
    const dur = Math.max(0.45, (0.45 + d * 0.3 + da * 0.3) / speed);
    return this._task({ kind: 'fly', t: 0, dur, x0: p.x, z0: p.z, a0: this.alt, x, z, alt, arc: Math.min(0.35, d * 0.08) });
  }
  _scale() { return tget('drone.scale') || 1; }
  // a point or an object, in the drone's parent's frame (floor at y = 0)
  _toLocal(target, out) {
    if (target && target.isObject3D) {
      target.updateWorldMatrix(true, false);
      target.getWorldPosition(out);
      if (this.root.parent) { this.root.parent.updateWorldMatrix(true, false); out.applyMatrix4(INV.copy(this.root.parent.matrixWorld).invert()); }
      return out;
    }
    if (Array.isArray(target)) return target.length === 2 ? out.set(target[0], 0, target[1]) : out.set(target[0], target[1], target[2]);
    return out.set(target.x, target.y ?? 0, target.z);
  }
  _topOf(target) {
    if (!(target && target.isObject3D)) return this._toLocal(target, VB).y;
    target.updateWorldMatrix(true, true);
    BOX.setFromObject(target);
    if (BOX.isEmpty()) return this._toLocal(target, VB).y;
    VB.set(0, BOX.max.y, 0);
    if (this.root.parent) VB.applyMatrix4(INV.copy(this.root.parent.matrixWorld).invert());
    return VB.y;
  }
  _setDown(o) {
    const parent = this.root.parent || this.root;
    parent.attach(o);
    o.position.y = this.carriedDrop ?? 0;
    QA.copy(o.quaternion);
    const e = new THREE.Euler().setFromQuaternion(QA, 'YXZ');
    o.rotation.set(0, e.y, 0);
    this.carried = null;
  }

  // ------------------------------------------------ the frame
  update(dt, t) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    this.t += dt; t = t ?? this.t;
    const rm = this.reducedMotion;
    const parent = this.root.parent;
    if (parent) {
      if (this.trail.parent !== parent) parent.add(this.trail);
      if (this.ownFx && this.fx.root.parent !== parent) parent.add(this.fx.root);
    }
    // tasks
    for (const task of [...this.tasks]) {
      if (task.kind === 'guard') continue;
      task.t += dt;
      const k = Math.min(1, task.t / task.dur);
      if (task.kind === 'tween') task.fn?.(k);
      else if (task.kind === 'fly') {
        const e = smooth(k);
        this.root.position.x = lerp(task.x0, task.x, e); this.root.position.z = lerp(task.z0, task.z, e);
        this.alt = lerp(task.a0, task.alt, e) + Math.sin(k * Math.PI) * task.arc;
      }
      if (k >= 1) { const i = this.tasks.indexOf(task); if (i >= 0) this.tasks.splice(i, 1); task.res(); }
    }
    // escort: keep beside the person, a little ahead of them
    if (this.follow) {
      const pr = this.follow.person, pp = pr.root.position;
      const fy = pr.yaw, ax = Math.sin(fy), az = Math.cos(fy);
      const tx = pp.x + ax * 0.25 + az * 0.85, tz = pp.z + az * 0.25 - ax * 0.85;
      this.root.position.x = damp(this.root.position.x, tx, 5, dt); this.root.position.z = damp(this.root.position.z, tz, 5, dt);
      this.alt = damp(this.alt, ALT - 0.3, 3, dt);
    }
    // velocity (for yaw and tilt)
    const p = this.root.position;
    if (!this.hasPrev) { this.prev.copy(p); this.hasPrev = true; }
    // (a jump of more than a metre in one frame is the page placing the drone, not flight)
    if (dt > 0 && p.distanceTo(this.prev) < 1) { VA.subVectors(p, this.prev).divideScalar(dt); this.vel.lerp(VA, 1 - Math.exp(-12 * dt)); }
    this.prev.copy(p);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.35) this.idleYaw = Math.atan2(this.vel.x, this.vel.z);
    else if (this.camera) {
      this.camera.getWorldPosition(VB);
      if (parent) VB.applyMatrix4(INV.copy(parent.matrixWorld).invert());
      this.idleYaw = Math.atan2(VB.x - p.x, VB.z - p.z);
    }
    this.yaw = dampAngle(this.yaw, this.idleYaw, hs > 0.35 ? 6 : 3, dt);
    this.body.rotation.y = this.yaw + this.spin;
    // tilt into flight: nose down along the travel, bank on turns
    const fwd = this.vel.x * Math.sin(this.yaw) + this.vel.z * Math.cos(this.yaw);
    const side = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw);
    const shrug = this.shrugK && !rm ? Math.sin(t * 7) * 0.22 : 0;
    const wob = this.wobble > 0 && !rm ? Math.sin(t * 22) * 0.18 * this.wobble : 0;
    this.wobble = Math.max(0, this.wobble - dt * 1.4);
    this.tilt.rotation.x = damp(this.tilt.rotation.x, THREE.MathUtils.clamp(fwd * 0.11, -0.4, 0.4) + this.dip * 0.4, 7, dt);
    this.bank = damp(this.bank, THREE.MathUtils.clamp(-side * 0.1, -0.35, 0.35), 7, dt);
    this.tilt.rotation.z = this.bank + shrug + wob;
    this.rig.rotation.z = this.roll;
    // hover: a bob, a hop on success, a squash on contact
    this.hop = Math.max(0, this.hop - dt * 1.8);
    const bob = rm ? 0 : Math.sin(t * 2.4) * 0.05 + Math.sin(t * 1.3 + 1) * 0.02;
    const hop = rm ? 0 : Math.sin((1 - this.hop) * Math.PI) * 0.22 * (this.hop > 0 ? 1 : 0);
    const sc = this._scale();
    this.body.position.y = this.alt + bob + hop - this.dip;
    this.squash = Math.max(0, (this.squash || 0) - dt * 3.5);
    const sq = rm ? 0 : Math.sin(this.squash * Math.PI) * 0.12;
    this.rig.scale.set(sc * (1 + sq), sc * (1 - sq), sc * (1 + sq));
    // rotors: spin with the blur disc
    const rate = (this.state === 'idle' ? 1 : 1.3) * (rm ? 0.5 : 1);
    for (let i = 0; i < this.arms.length; i++) {
      const a = this.arms[i];
      a.blade.rotation.y += dt * 17 * rate * (i % 2 ? 1 : -1);
      a.disc.rotation.z += dt * 23 * rate * (i % 2 ? 1 : -1);
    }
    // colours: ring light (verdict or celebration), lens, beam
    this.verdictK = damp(this.verdictK, this.verdict === null ? 0 : 1, 8, dt);
    this.ringFlash = Math.max(0, this.ringFlash - dt * 0.6);
    const verdictCol = this.verdict === null ? null : colour(this.verdict ? 'palette.ok' : 'palette.danger');
    CA.copy(colour('palette.droneRing'));
    if (verdictCol && this.beamOn > 0.01) CA.lerp(verdictCol, this.verdictK);
    const glowK = 1 + this.ringFlash * (0.6 + 0.4 * Math.sin(t * 14)) * (rm ? 0.5 : 1);
    this.ringMat.color.copy(CA).multiplyScalar(glowK);
    CB.copy(colour('palette.droneBeam'));
    if (verdictCol) CB.lerp(verdictCol, this.verdictK);
    this.lensMat.color.copy(CB).multiplyScalar(0.6 + this.beamOn * 0.8);
    this.beamOn = damp(this.beamOn, this.beamWant, this.beamWant ? 7 : 9, dt);
    if (this.beamOn < 0.01 && !this.beamWant) { this.verdict = null; }
    const lensY = this.body.position.y + LENS * sc;
    const on = this.beamOn > 0.01;
    this.beam.visible = on; this.spot.visible = on;
    if (on) {
      const len = Math.max(0.1, lensY - 0.02), r = this.beamR * (0.94 + (rm ? 0 : 0.06 * Math.sin(t * 5)));
      this.beam.position.y = lensY; this.beam.scale.set(r, len, r);
      this.beamMat.uniforms.color.value.copy(CB);
      this.beamMat.uniforms.strength.value = 0.5 * this.beamOn;
      this.beamMat.uniforms.time.value = rm ? 0 : t;
      this.spot.scale.setScalar(r * 3);
      this.spotMat.color.copy(CB); this.spotMat.opacity = this.beamOn;
    }
    // shadow blob shrinks as it rises
    const h = this.body.position.y;
    this.blob.scale.setScalar(sc * (0.95 - Math.min(0.4, h * 0.12)));
    this.blobMat.opacity = 0.55 * Math.max(0.35, 1 - h * 0.22);
    // face
    this._face(dt, t);
    this._trail(dt, hs);
    return this;
  }

  _face(dt, t) {
    if (this.faceHold !== Infinity) {
      this.faceHold -= dt;
      if (this.faceHold <= 0) { this.faceHold = Infinity; this.faceName = this.actionFace || 'neutral'; }
    }
    const want = EXPRESSIONS[this.faceName], f = this.faceNow;
    for (const k in want) f[k] = damp(f[k], want[k], 11, dt);
    // looking: glance along the flight, else wander a little
    const side = this.vel.x * Math.cos(this.yaw) - this.vel.z * Math.sin(this.yaw);
    f.lookX = damp(f.lookX, THREE.MathUtils.clamp(side * 0.4, -1, 1) + (this.reducedMotion ? 0 : Math.sin(t * 0.7) * 0.25), 6, dt);
    this.blinkT -= dt;
    if (this.blinkT < 0) this.blinkT = 2.2 + ((t * 7.31) % 2.6);
    this.blink = this.blinkT < 0.13 ? 0.08 : 1;
    const drawn = this.faceDrawn, shown = { ...f, open: f.open * this.blink };
    let changed = this.faceDirty || !drawn || (f.sparkle > 0.02);
    if (!changed) for (const k in shown) if (Math.abs(shown[k] - drawn[k]) > 0.004) { changed = true; break; }
    if (changed) {
      drawFace(this.faceTex.userData.canvas.getContext('2d'), shown, t);
      this.faceTex.needsUpdate = true;
      this.faceDrawn = shown; this.faceDirty = false;
    }
  }

  _trail(dt, hs) {
    const n = Math.max(0, Math.min(120, tget('drone.trail') ?? 56));
    const life = 0.15 + n / 70;
    const col = colour('palette.droneRing');
    const P = this.trailPos, Cc = this.trailCol, A = this.trailAge;
    // emit from behind the body, in the parent's frame
    if (n > 0 && this.root.parent) {
      VA.set(0, this.body.position.y - 0.05 * this._scale(), 0).add(this.root.position);
      if (VA.distanceTo(this.lastEmit) > 0.07 && hs > 0.25) {
        const i = this.trailI++ % this.trailN;
        P[i * 3] = VA.x; P[i * 3 + 1] = VA.y; P[i * 3 + 2] = VA.z; A[i] = 0;
        this.lastEmit.copy(VA);
      }
    }
    let any = false;
    for (let i = 0; i < this.trailN; i++) {
      A[i] += dt;
      const k = Math.max(0, 1 - A[i] / life), e = k * k * 0.55;
      Cc[i * 3] = col.r * e; Cc[i * 3 + 1] = col.g * e; Cc[i * 3 + 2] = col.b * e;
      if (k > 0) any = true;
    }
    this.trail.visible = any;
    this.trail.material.size = 0.3 * this._scale() / 1.4;
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- the registered asset
// A still drone in the catalogue grid; the close-up plays each expression and each action on a loop.
const loopAction = (start) => (obj, t) => {
  const u = obj.userData, d = u.drone;
  if (!d) return;
  const dt = u.lastT === undefined || t < u.lastT ? 1 / 60 : Math.min(0.1, t - u.lastT);
  u.lastT = t;
  if (u.playing !== start) { u.playing = start; d.cancel(); d.fx.reset(); d.root.position.set(0, 0, 0); d.alt = ALT; u.busy = false; u.next = t; }
  if (!u.busy && t >= u.next) {
    u.busy = true;
    Promise.resolve(start(d, u)).then(() => { if (u.playing === start) { u.busy = false; u.next = u.lastT + 0.9; } });
  }
  d.update(dt, t);
};
const face = (name) => (d) => { d.express(name, 2.6); return d._run('look', () => d._wait(2.6)); };
let scanFlip = false;
register('drone', {
  category: 'character', tiles: [1.5, 1.5],
  build({ expression = 'happy' } = {}) {
    const d = new Drone({ reducedMotion: true });
    d.express(expression);
    for (let i = 0; i < 40; i++) d.update(1 / 30);
    d.reducedMotion = !!(RM_QUERY && RM_QUERY.matches);
    d.fx.reducedMotion = d.reducedMotion;
    return d.root;
  },
  anims: {
    idle: loopAction((d) => d._run('look', () => d._wait(3))),
    happy: loopAction(face('happy')), focus: loopAction(face('focus')), worried: loopAction(face('worried')), proud: loopAction(face('proud')),
    fly: loopAction(async (d) => { for (const [x, z] of [[0.5, 0.5], [-0.5, 0.4], [-0.4, -0.5], [0.5, -0.4], [0, 0]]) { if (!(await d.flyTo([x, z])) ) return; } }),
    scan: loopAction((d) => { scanFlip = !scanFlip; return d.scan([0, 0, 0.1], scanFlip); }),
    stamp: loopAction((d) => d.stamp([0, 0, 0.1])),
    celebrate: loopAction((d) => d.celebrate()),
    shrug: loopAction((d) => d.shrug()),
  },
});
