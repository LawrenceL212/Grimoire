// drone.js: the player's avatar. A cream-and-gold hover bot with a glowing
// visor, four spinning rotors, a soft light cone, a floor spot and a glowing trail.
import * as THREE from 'three';
import { toonOwn, toon, sphere, rbox, cyl, cone, torus, part, glow, floorGlow, glowTex, tween, ease, damp, dampAngle, lerp } from './kit.js';

export class Drone {
  constructor(scene, S) {
    this.S = S;
    this.root = new THREE.Group(); scene.add(this.root);
    this.body = new THREE.Group(); this.root.add(this.body);
    this.rig = new THREE.Group(); this.body.add(this.rig); // scaled by settings
    const P = S.palette;
    const shell = toon(0xefe6d2), gold = toonOwn(P.gold, { emissive: P.gold, ei: 0.25 }), dark = toon(0x1a1512);
    this.goldMat = gold;
    part(sphere(0.26, 24, 16), shell, { s: [1, 0.82, 1], parent: this.rig, outline: 0.02 });
    part(torus(0.262, 0.035, 8, 32), gold, { rx: Math.PI / 2, parent: this.rig, outline: 0.012 });
    // gold crown cap: gives the drone a readable silhouette from the steep top-down camera
    part(new THREE.SphereGeometry(0.2, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), gold, { y: 0.03, s: [1, 0.9, 1], parent: this.rig, outline: 0.012 });
    part(rbox(0.32, 0.17, 0.12, 0.06), dark, { y: 0.03, z: 0.2, parent: this.rig, outline: 0.012 });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe2a0 });
    this.eyes = [-1, 1].map((s) => part(rbox(0.06, 0.07, 0.02, 0.02), this.eyeMat, { x: s * 0.07, y: 0.035, z: 0.262, outline: 0, cast: false, parent: this.rig }));
    const eg = glow(0xffc862, 0.55, 0.6); eg.position.set(0, 0.04, 0.3); this.rig.add(eg); this.eyeGlow = eg;
    // antenna
    part(cyl(0.012, 0.012, 0.16, 6), dark, { y: 0.27, outline: 0, parent: this.rig });
    this.tipMat = new THREE.MeshBasicMaterial({ color: 0xff9c5a });
    part(sphere(0.035, 10, 8), this.tipMat, { y: 0.36, outline: 0.01, cast: false, parent: this.rig });
    this.tipGlow = glow(0xff9c5a, 0.35, 0.8); this.tipGlow.position.y = 0.36; this.rig.add(this.tipGlow);
    // rotor arms
    this.rotors = [];
    const discMat = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      const arm = new THREE.Group(); arm.rotation.y = a; this.rig.add(arm);
      part(rbox(0.3, 0.035, 0.05, 0.015), dark, { x: 0.3, y: 0.08, parent: arm, outline: 0.008 });
      part(cyl(0.035, 0.04, 0.06, 10), gold, { x: 0.44, y: 0.1, parent: arm, outline: 0.008 });
      const rotor = new THREE.Group(); rotor.position.set(0.44, 0.14, 0); arm.add(rotor);
      part(rbox(0.26, 0.012, 0.035, 0.005), shell, { parent: rotor, outline: 0, cast: false });
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20), discMat); disc.rotation.x = -Math.PI / 2; rotor.add(disc);
      this.rotors.push(rotor);
    }
    // underside light + cone + floor spot (not tilted, not scaled with rig)
    this.light = new THREE.PointLight(0xffd28a, 3.5, 4, 1.6); this.light.position.y = -0.3; this.root.add(this.light);
    const coneMat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xffd48a) }, strength: { value: 0.1 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 color; uniform float strength; varying float vY; void main(){ gl_FragColor = vec4(color, pow(vY, 1.8) * strength); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.coneMat = coneMat;
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1, 28, 1, true), coneMat);
    this.root.add(this.cone);
    this.spot = floorGlow(0xffcf80, 1.8, 1.8, 0.42); this.spot.position.y = 0.02; scene.add(this.spot);
    this.shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    // (the real shadow map already draws the drone's shadow; blob unused)

    // trail
    this.trailMax = 140;
    this.trailPos = new Float32Array(this.trailMax * 3);
    this.trailBirth = new Float32Array(this.trailMax).fill(-99);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    tg.setAttribute('birth', new THREE.BufferAttribute(this.trailBirth, 1));
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, life: { value: 1.2 }, map: { value: glowTex }, color: { value: new THREE.Color(0xffc862) }, px: { value: 1 } },
      vertexShader: `attribute float birth; uniform float time, life, px; varying float vA;
        void main(){ float age = clamp((time - birth) / life, 0.0, 1.0); vA = 1.0 - age;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = px * (0.75 * (1.0 - age * 0.6)) * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * vA * vA * 0.9); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.trail = new THREE.Points(tg, this.trailMat); this.trail.frustumCulled = false; scene.add(this.trail);
    this.trailIdx = 0; this.lastEmit = new THREE.Vector3(); this.time = 0;

    this.vel = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.dip = 0; this.blinkT = 2;
    this.lookYaw = 0; this.scanColor = null;
  }

  setPos(v) { this.root.position.copy(v); this.prev.copy(v); this.lastEmit.copy(v); }

  // eased flight along a gentle arc; duration scales with distance and speed setting
  flyTo(target, { arc = 0.5, dur, e = ease.inOut } = {}) {
    const from = this.root.position.clone(), to = target.clone();
    const d = from.distanceTo(to);
    const T = dur ?? Math.max(0.5, (0.45 + d * 0.16) / this.S.drone.speed);
    return tween(T, (k, raw) => {
      this.root.position.lerpVectors(from, to, k);
      this.root.position.y += Math.sin(raw * Math.PI) * arc * Math.min(1, d / 4);
    }, e);
  }
  // stamp: dip down onto a ticket and bounce back up
  async stamp(onHit) {
    const y0 = this.root.position.y;
    await tween(0.22, (k) => { this.root.position.y = y0 - 0.35 * k; this.dip = k; }, ease.in);
    onHit && onHit();
    await tween(0.35, (k) => { this.root.position.y = y0 - 0.35 * (1 - k); this.dip = 1 - k; }, ease.back);
  }
  flash(color) { this.scanColor = new THREE.Color(color); this.scanT = 1; }

  update(dt, t) {
    this.time = t;
    const s = this.S.drone.scale;
    this.rig.scale.setScalar(s);
    // velocity from position change (for tilt and yaw)
    const p = this.root.position;
    this.vel.subVectors(p, this.prev).divideScalar(Math.max(dt, 1e-4));
    this.prev.copy(p);
    const hs = Math.hypot(this.vel.x, this.vel.z);
    // moving: face the direction of travel; hovering: turn to the camera and tip the visor up
    if (hs > 0.4) this.lookYaw = Math.atan2(this.vel.x, this.vel.z);
    else if (this.camera) this.lookYaw = Math.atan2(this.camera.position.x - p.x, this.camera.position.z - p.z);
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.lookYaw, hs > 0.4 ? 5 : 2.5, dt);
    const idle = Math.max(0, 1 - hs / 0.8);
    this.body.rotation.x = damp(this.body.rotation.x, Math.min(hs * 0.09, 0.4) + this.dip * 0.25 - idle * 0.5, 6, dt);
    this.body.position.y = Math.sin(t * 2.6) * 0.06 + Math.sin(t * 1.3) * 0.02;
    this.body.rotation.z = Math.sin(t * 1.7) * 0.05;
    this.rotors.forEach((r, i) => { r.rotation.y += dt * (38 + i * 3); });
    // blink visor
    this.blinkT -= dt; if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    const bl = this.blinkT < 0.1 ? 0.15 : 1;
    this.eyes.forEach((e) => { e.scale.y = bl; });
    // antenna pulse
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    this.tipGlow.material.opacity = 0.4 + pulse * 0.6;
    // scan flash tints the cone and eye
    let coneCol = new THREE.Color(0xffd48a), str = 0.09 + 0.015 * Math.sin(t * 3);
    if (this.scanT > 0) { this.scanT -= dt * 0.9; coneCol.lerp(this.scanColor, Math.min(1, this.scanT * 1.5)); str += this.scanT * 0.22; }
    this.coneMat.uniforms.color.value.copy(coneCol); this.coneMat.uniforms.strength.value = str;
    this.eyeMat.color.copy(coneCol).lerp(new THREE.Color(0xffffff), 0.3);
    // cone reaches the floor
    const h = Math.max(0.2, p.y + this.body.position.y - 0.15);
    this.cone.scale.set(0.9 + h * 0.18, h, 0.9 + h * 0.18); this.cone.position.y = this.body.position.y - 0.15 - h / 2;
    this.spot.position.x = p.x; this.spot.position.z = p.z;
    this.spot.material.color.copy(coneCol);
    this.spot.material.opacity = 0.32 * Math.min(1, 2.4 / Math.max(h, 0.5));
    this.spot.scale.setScalar(0.8 + h * 0.25);
    this.light.color.copy(coneCol);
    // trail: emit a point every ~6cm travelled
    const n = Math.min(this.trailMax, Math.max(0, Math.round(this.S.drone.trail)));
    this.trailMat.uniforms.time.value = t;
    this.trailMat.uniforms.life.value = 0.25 + n / 45;
    const wp = new THREE.Vector3(0, -0.05 + this.body.position.y, 0).add(p);
    if (n > 0 && wp.distanceTo(this.lastEmit) > 0.06) {
      const i = this.trailIdx % this.trailMax;
      this.trailPos[i * 3] = wp.x; this.trailPos[i * 3 + 1] = wp.y; this.trailPos[i * 3 + 2] = wp.z;
      this.trailBirth[i] = t; this.trailIdx++; this.lastEmit.copy(wp);
      this.trail.geometry.attributes.position.needsUpdate = true;
      this.trail.geometry.attributes.birth.needsUpdate = true;
    }
  }
}
