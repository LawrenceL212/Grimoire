// people.js: chibi low-poly people built from capsules and spheres, with a
// walk cycle, sitting with squash-and-stretch, breathing, blinking and emotes.
import * as THREE from 'three';
import { toonOwn, toon, capsule, sphere, rbox, torus, part, canvasTex, tween, ease, dampAngle, damp, lerp, rr } from './kit.js';

const SKINS = [0xf2c9a2, 0xd9a07a, 0x9a6444, 0xf6d5b8];

export function emoteTexture(kind, P) {
  return canvasTex(128, 128, (g) => {
    const col = { bang: P.danger, ok: P.ok, dots: '#efe6d2', q: P.gold }[kind];
    g.fillStyle = 'rgba(10,8,7,0.9)'; g.beginPath(); g.arc(64, 58, 50, 0, 7); g.fill();
    g.beginPath(); g.moveTo(52, 100); g.lineTo(64, 124); g.lineTo(76, 100); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(64, 58, 43, 0, 7); g.fill();
    g.beginPath(); g.moveTo(56, 96); g.lineTo(64, 114); g.lineTo(72, 96); g.fill();
    g.fillStyle = kind === 'dots' ? '#14110f' : '#fff';
    g.font = '900 64px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText({ bang: '!', ok: '✓', dots: '…', q: '?' }[kind], 64, kind === 'dots' ? 50 : 62);
  });
}

export class Person {
  constructor({ name, shirt, hair = 0x3b2417, skin = 0, pants = 0x2b2522, style = 'short', P }) {
    this.name = name; this.P = P;
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    this.shirtMat = toonOwn(shirt);
    const skinMat = toon(SKINS[skin]);
    const pantsMat = toon(pants), shoeMat = toon(0x1c1714), hairMat = toon(hair, { side: THREE.DoubleSide });
    const dark = toon(0x1a1210);

    // legs (pivot at the hip)
    const leg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.3, 0); this.body.add(p);
      part(capsule(0.072, 0.12), pantsMat, { y: -0.14, parent: p, outline: 0.014 });
      part(rbox(0.13, 0.07, 0.19, 0.03), shoeMat, { y: -0.27, z: 0.035, parent: p, outline: 0.012 });
      return p;
    };
    this.legL = leg(-0.095); this.legR = leg(0.095);

    // torso
    this.torso = new THREE.Group(); this.torso.position.y = 0.3; this.body.add(this.torso);
    part(capsule(0.2, 0.13), this.shirtMat, { y: 0.2, s: [1, 1, 0.86], parent: this.torso, outline: 0.016 });
    part(rbox(0.3, 0.05, 0.2, 0.02), pantsMat, { y: 0.06, parent: this.torso, outline: 0 }); // belt line

    // arms (pivot at the shoulder)
    const arm = (s) => {
      const p = new THREE.Group(); p.position.set(s * 0.225, 0.36, 0); this.torso.add(p);
      part(capsule(0.058, 0.13), this.shirtMat, { y: -0.1, rz: s * 0.18, parent: p, outline: 0.012 });
      part(sphere(0.062, 10, 8), skinMat, { x: s * 0.035, y: -0.22, parent: p, outline: 0.01 });
      return p;
    };
    this.armL = arm(-1); this.armR = arm(1);

    // head
    this.head = new THREE.Group(); this.head.position.y = 0.44; this.torso.add(this.head);
    part(sphere(0.27, 22, 16), skinMat, { y: 0.23, parent: this.head, outline: 0.018 });
    this.eyes = [-1, 1].map((s) => part(sphere(0.036, 10, 8), dark, { x: s * 0.095, y: 0.25, z: 0.245, s: [1, 1.3, 0.6], parent: this.head, outline: 0, cast: false }));
    this.eyes.forEach((e) => part(sphere(0.012, 6, 4), toon(0xffffff), { x: 0.012, y: 0.012, z: 0.03, parent: e, outline: 0, cast: false }));
    [-1, 1].forEach((s) => part(sphere(0.045, 10, 6), toon(0xf09a86), { x: s * 0.16, y: 0.17, z: 0.215, s: [1, 0.6, 0.35], parent: this.head, outline: 0, cast: false }));
    this.mouth = part(torus(0.036, 0.011, 6, 12, Math.PI), dark, { y: 0.16, z: 0.262, rz: Math.PI, parent: this.head, outline: 0, cast: false });
    // hair
    const capGeo = new THREE.SphereGeometry(0.29, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56);
    part(capGeo, hairMat, { y: 0.25, rx: -0.42, parent: this.head, outline: 0.016 });
    if (style === 'bun') part(sphere(0.11, 12, 8), hairMat, { y: 0.52, z: -0.1, parent: this.head, outline: 0.014 });
    if (style === 'long') part(rbox(0.5, 0.38, 0.16, 0.07), hairMat, { y: 0.1, z: -0.17, parent: this.head, outline: 0.014 });
    if (style === 'tuft') part(sphere(0.08, 10, 6), hairMat, { y: 0.53, z: 0.08, s: [1, 1.4, 1], rx: 0.5, parent: this.head, outline: 0.012 });
    if (style === 'cap') {
      part(rbox(0.3, 0.03, 0.2, 0.015), toon(0x2f4a3f), { y: 0.4, z: 0.26, rx: 0.12, parent: this.head, outline: 0.01 });
    }

    // emote bubble
    this.bubble = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    this.bubble.position.y = 1.62; this.bubble.scale.setScalar(0); this.bubble.renderOrder = 20;
    this.root.add(this.bubble);
    this.bubbleShown = false;

    // state
    this.yaw = 0; this.targetYaw = 0; this.path = []; this.speed = 1.55;
    this.walk = 0; this.phase = Math.random() * 6; this.sit = 0; this.shake = 0;
    this.sq = 0; this.sqV = 0; this.blinkT = 1 + Math.random() * 3; this.seed = Math.random() * 10;
    this.read = 0; this.happy = 0;
  }

  setShirt(c) { this.shirtMat.color.set(c); }

  walkTo(points) {
    this.path = points.map((p) => p.clone());
    return new Promise((res) => { this._arrive = res; });
  }
  face(yaw) { this.targetYaw = yaw; }

  sitDown(pos, yaw, seatY = 0.1) {
    const from = this.root.position.clone();
    this.targetYaw = yaw;
    return tween(0.5, (k, raw) => {
      this.root.position.x = lerp(from.x, pos.x, k); this.root.position.z = lerp(from.z, pos.z, k);
      this.root.position.y = lerp(from.y, seatY, k) + Math.sin(raw * Math.PI) * 0.16;
      this.sit = k;
    }).then(() => { this.sqV = -3.2; });
  }
  standUp(to) {
    const from = this.root.position.clone();
    this.sqV = 2.5;
    return tween(0.45, (k, raw) => {
      this.root.position.x = lerp(from.x, to.x, k); this.root.position.z = lerp(from.z, to.z, k);
      this.root.position.y = lerp(from.y, 0, k) + Math.sin(raw * Math.PI) * 0.14;
      this.sit = 1 - k;
    });
  }
  emote(kind) {
    this.bubble.material.map?.dispose();
    this.bubble.material.map = emoteTexture(kind, this.P); this.bubble.material.needsUpdate = true;
    this.bubbleShown = true;
    return tween(0.45, (k) => this.bubble.scale.setScalar(0.8 * k), ease.elastic);
  }
  hideEmote() {
    if (!this.bubbleShown) return Promise.resolve();
    this.bubbleShown = false;
    const s0 = this.bubble.scale.x;
    return tween(0.2, (k) => this.bubble.scale.setScalar(s0 * (1 - k)), ease.in);
  }
  bounce() { this.sqV = 4; this.happy = 1; }

  update(dt, t) {
    // path following
    if (this.path.length) {
      const p = this.root.position, tg = this.path[0];
      const dx = tg.x - p.x, dz = tg.z - p.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      if (d <= step) {
        p.x = tg.x; p.z = tg.z; this.path.shift();
        if (!this.path.length && this._arrive) { const r = this._arrive; this._arrive = null; r(); }
      } else { p.x += dx / d * step; p.z += dz / d * step; this.targetYaw = Math.atan2(dx, dz); }
    }
    const moving = this.path.length > 0;
    this.walk = damp(this.walk, moving ? 1 : 0, 10, dt);
    this.yaw = dampAngle(this.yaw, this.targetYaw, 9, dt);
    this.root.rotation.y = this.yaw;

    this.phase += dt * 10.5 * this.speed / 1.55 * (0.2 + this.walk);
    const sw = Math.sin(this.phase) * this.walk;
    const sit = this.sit;
    const breathe = Math.sin(t * 2.3 + this.seed);
    this.legL.rotation.x = lerp(sw * 0.75, -1.45, sit);
    this.legR.rotation.x = lerp(-sw * 0.75, -1.45, sit);
    const armSit = -0.85 - this.read * 0.3;
    this.armL.rotation.x = lerp(-sw * 0.65, armSit + Math.sin(t * 3.1 + this.seed) * 0.04, sit);
    this.armR.rotation.x = lerp(sw * 0.65, armSit + Math.sin(t * 2.7 + this.seed) * 0.05, sit);
    this.armL.rotation.z = lerp(-0.08 - this.walk * 0.05, -0.05, sit) - this.happy * 2.2;
    this.armR.rotation.z = lerp(0.08 + this.walk * 0.05, 0.05, sit) + this.happy * 2.2;
    if (this.typing) {
      this.armL.rotation.x = -1.05 + Math.max(0, Math.sin(t * 13)) * 0.12;
      this.armR.rotation.x = -1.05 + Math.max(0, Math.sin(t * 13 + 2)) * 0.12;
    }
    this.happy = Math.max(0, this.happy - dt * 0.9);
    this.torso.position.y = 0.3 + Math.abs(Math.sin(this.phase)) * 0.045 * this.walk;
    this.torso.rotation.x = this.walk * 0.08 + sit * 0.05;
    this.torso.scale.set(1 + breathe * 0.012, 1 + breathe * 0.022, 1 + breathe * 0.012);
    this.head.rotation.z = Math.sin(t * 0.7 + this.seed) * 0.06 * (1 - this.walk);
    this.head.rotation.y = Math.sin(t * 0.43 + this.seed * 2) * 0.25 * (1 - this.walk) * (1 - this.read);
    // seated people glance up toward the camera now and then (faces read better from above)
    const lookUp = sit * (0.22 + 0.12 * Math.max(0, Math.sin(t * 0.37 + this.seed)));
    this.head.rotation.x = this.read * 0.45 - lookUp - this.walk * 0.1;

    // blink
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 ? 0.12 : 1;
    if (this.blinkT < 0) this.blinkT = 1.8 + Math.random() * 3.2;
    this.eyes.forEach((e) => { e.scale.y = 1.3 * blink; });

    // squash & stretch spring
    const k = 120, c = 9;
    this.sqV += (-k * this.sq - c * this.sqV) * dt;
    this.sq += this.sqV * dt;
    const s = THREE.MathUtils.clamp(this.sq, -0.3, 0.3);
    this.body.scale.set(1 - s * 0.5, 1 + s, 1 - s * 0.5);

    // shake (clash)
    this.shake = Math.max(0, this.shake - dt * 0.5);
    this.body.position.x = Math.sin(t * 48) * 0.04 * Math.min(1, this.shake);

    // bubble bob
    if (this.bubbleShown) this.bubble.position.y = 1.62 + Math.sin(t * 4) * 0.04;
  }
}
