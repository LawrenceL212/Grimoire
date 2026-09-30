// fx.js: sparks, confetti + coins, shockwave rings, floating text, tickets and marks.
import * as THREE from 'three';
import { glowTex, canvasTex, tween, ease, rr, toonOwn, gradientMap } from './kit.js';

export class FX {
  constructor(scene, S) {
    this.scene = scene; this.S = S;
    // ---- sparks: CPU-integrated additive points ----
    const N = 400; this.N = N;
    this.sp = { pos: new Float32Array(N * 3), col: new Float32Array(N * 3), size: new Float32Array(N), vel: new Float32Array(N * 3), life: new Float32Array(N), max: new Float32Array(N), grav: new Float32Array(N) };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.sp.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.sp.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.sp.size, 1));
    this.sparkMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTex }, px: { value: 1 } },
      vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float px;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = px * size / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC, t.a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.sparks = new THREE.Points(g, this.sparkMat); this.sparks.frustumCulled = false; scene.add(this.sparks);
    this.spIdx = 0;

    // ---- confetti (instanced quads) + coins (instanced discs) ----
    this.CN = 160; this.KN = 36;
    this.confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), this.CN);
    this.coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.022, 14), toonOwn(0xe8b54f, { emissive: 0x7a5410, ei: 0.5 }), this.KN);
    this.coins.castShadow = true;
    this.parts = [];
    for (const [mesh, n] of [[this.confetti, this.CN], [this.coins, this.KN]]) {
      mesh.frustumCulled = false; scene.add(mesh);
      const c = new THREE.Color(1, 1, 1);
      for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); mesh.setColorAt(i, c); }
      mesh.count = n;
    }
    this.cState = Array.from({ length: this.CN }, () => ({ alive: false }));
    this.kState = Array.from({ length: this.KN }, () => ({ alive: false }));
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpE = new THREE.Euler(); this.tmpV = new THREE.Vector3(); this.tmpS = new THREE.Vector3();
    this.transients = [];
  }

  sparksAt(p, n, { color = 0xffd27a, speed = 2, up = 1.5, life = 0.9, size = 0.35, gravity = -3 } = {}) {
    const c = new THREE.Color(color), s = this.sp;
    for (let k = 0; k < n; k++) {
      const i = this.spIdx++ % this.N;
      s.pos[i * 3] = p.x; s.pos[i * 3 + 1] = p.y; s.pos[i * 3 + 2] = p.z;
      const a = Math.random() * Math.PI * 2, r = Math.random() * speed;
      s.vel[i * 3] = Math.cos(a) * r; s.vel[i * 3 + 1] = up * (0.4 + Math.random()); s.vel[i * 3 + 2] = Math.sin(a) * r;
      const cc = c.clone().offsetHSL((Math.random() - 0.5) * 0.05, 0, (Math.random() - 0.5) * 0.2);
      s.col[i * 3] = cc.r; s.col[i * 3 + 1] = cc.g; s.col[i * 3 + 2] = cc.b;
      s.max[i] = s.life[i] = life * (0.6 + Math.random() * 0.6); s.size[i] = size * (0.6 + Math.random() * 0.8); s.grav[i] = gravity;
    }
  }

  burst(p, { confetti = 110, coins = 26 } = {}) {
    const P = this.S.palette;
    const cols = [P.gold, '#ffe3a3', P.ok, P.text, '#f0b86a', P.danger].map((c) => new THREE.Color(c));
    let made = 0;
    for (let i = 0; i < this.CN && made < confetti; i++) {
      const st = this.cState[i]; if (st.alive) continue; made++;
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.6;
      Object.assign(st, { alive: true, t: 0, life: 3 + Math.random() * 1.5, p: p.clone(), v: new THREE.Vector3(Math.cos(a) * r, 3 + Math.random() * 3.5, Math.sin(a) * r), rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), flutter: Math.random() * 6 });
      this.confetti.setColorAt(i, cols[i % cols.length]);
    }
    this.confetti.instanceColor.needsUpdate = true;
    made = 0;
    for (let i = 0; i < this.KN && made < coins; i++) {
      const st = this.kState[i]; if (st.alive) continue; made++;
      const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 1.8;
      Object.assign(st, { alive: true, t: 0, life: 3.4 + Math.random(), p: p.clone(), v: new THREE.Vector3(Math.cos(a) * r, 4 + Math.random() * 2.5, Math.sin(a) * r), rot: new THREE.Euler(Math.random() * 6, 0, Math.random() * 6), spin: new THREE.Vector3(8 + Math.random() * 8, 0, 3 + Math.random() * 5), rest: false });
    }
  }

  ring(p, color, { from = 0.2, to = 2.2, dur = 0.8, y = 0.03 } = {}) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, y, p.z); this.scene.add(m);
    return tween(dur, (k) => { m.scale.setScalar(from + (to - from) * k); m.material.opacity = 1 - k; }, ease.out)
      .then(() => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }

  floatText(p, text, color) {
    const tex = canvasTex(256, 96, (g) => {
      g.font = '900 60px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = 'rgba(20,17,15,0.95)'; g.strokeText(text, 128, 50);
      g.fillStyle = color; g.fillText(text, 128, 50);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    s.renderOrder = 30; s.position.copy(p); this.scene.add(s);
    return tween(2.0, (k, raw) => {
      s.position.y = p.y + raw * 1.3;
      const pop = raw < 0.15 ? ease.back(raw / 0.15) : 1;
      s.scale.set(3.0 * pop, 1.12 * pop, 1);
      s.material.opacity = raw > 0.7 ? 1 - (raw - 0.7) / 0.3 : 1;
    }, ease.linear).then(() => { this.scene.remove(s); tex.dispose(); s.material.dispose(); });
  }

  // a scan mark (✗ / ✓) popping above a room sign
  mark(p, good) {
    const P = this.S.palette;
    const tex = canvasTex(128, 128, (g) => {
      g.fillStyle = 'rgba(12,10,9,0.9)'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill();
      g.fillStyle = good ? P.ok : P.danger; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath();
      if (good) { g.moveTo(38, 66); g.lineTo(57, 85); g.lineTo(92, 44); } else { g.moveTo(42, 42); g.lineTo(86, 86); g.moveTo(86, 42); g.lineTo(42, 86); }
      g.stroke();
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    s.renderOrder = 25; s.position.copy(p); this.scene.add(s);
    this.transients.push(s);
    return tween(0.5, (k) => s.scale.setScalar(0.7 * k), ease.elastic).then(() => s);
  }
  clearTransients() { this.transients.forEach((s) => { this.scene.remove(s); s.material.map?.dispose(); s.material.dispose(); }); this.transients = []; }

  update(dt, camera, heightPx) {
    const px = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    this.sparkMat.uniforms.px.value = px;
    const s = this.sp;
    for (let i = 0; i < this.N; i++) {
      if (s.life[i] <= 0) { s.size[i] = 0; continue; }
      s.life[i] -= dt;
      s.vel[i * 3 + 1] += s.grav[i] * dt;
      for (let a = 0; a < 3; a++) { s.pos[i * 3 + a] += s.vel[i * 3 + a] * dt; s.vel[i * 3 + a] *= 1 - dt * 1.5; }
      const k = Math.max(0, s.life[i] / s.max[i]);
      s.size[i] = Math.max(0, s.size[i]) ; if (k <= 0) s.size[i] = 0;
      s.col[i * 3] *= 1 - dt * 0.6; s.col[i * 3 + 1] *= 1 - dt * 0.8; s.col[i * 3 + 2] *= 1 - dt * 1.0;
      if (s.life[i] <= 0) s.size[i] = 0;
    }
    const g = this.sparks.geometry.attributes;
    g.position.needsUpdate = g.color.needsUpdate = g.size.needsUpdate = true;

    const step = (mesh, states, isCoin) => {
      let dirty = false;
      states.forEach((st, i) => {
        if (!st.alive) return; dirty = true;
        st.t += dt;
        if (!st.rest) {
          st.v.y -= (isCoin ? 9.5 : 4.2) * dt;
          if (!isCoin) { st.v.x *= 1 - dt * 1.4; st.v.z *= 1 - dt * 1.4; st.v.y = Math.max(st.v.y, -1.3); st.p.x += Math.sin(st.t * 5 + st.flutter) * dt * 0.4; }
          st.p.addScaledVector(st.v, dt);
          st.rot.x += st.spin.x * dt; st.rot.y += st.spin.y * dt; st.rot.z += st.spin.z * dt;
          if (st.p.y < 0.02) {
            st.p.y = 0.02;
            if (isCoin && Math.abs(st.v.y) > 1.2) { st.v.y *= -0.45; st.v.x *= 0.6; st.v.z *= 0.6; }
            else { st.rest = true; st.rot.x = -Math.PI / 2 * (isCoin ? 0 : 1); st.rot.z = isCoin ? 0 : st.rot.z; if (isCoin) st.rot.x = 0; }
          }
        }
        const fade = Math.min(1, Math.max(0, (st.life - st.t) / 0.6));
        this.tmpQ.setFromEuler(st.rot);
        this.tmpS.setScalar(fade);
        this.tmpM.compose(st.p, this.tmpQ, this.tmpS);
        mesh.setMatrixAt(i, this.tmpM);
        if (st.t > st.life) { st.alive = false; mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); }
      });
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
    };
    step(this.confetti, this.cState, false);
    step(this.coins, this.kState, true);
  }

  reset() {
    this.cState.forEach((s) => { s.alive = false; }); this.kState.forEach((s) => { s.alive = false; });
    for (let i = 0; i < this.CN; i++) this.confetti.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    for (let i = 0; i < this.KN; i++) this.coins.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    this.confetti.instanceMatrix.needsUpdate = this.coins.instanceMatrix.needsUpdate = true;
    this.sp.life.fill(0); this.sp.size.fill(0);
    this.clearTransients();
  }
}

// ---------- booking tickets (floating paper cards above desks) ----------
export function ticketTexture({ slot, who, room, state }, P) {
  return canvasTex(256, 136, (g) => {
    const red = state === 'clash';
    // card with notches
    g.save();
    rr(g, 8, 8, 240, 120, 14); g.fillStyle = red ? '#f6d9d2' : '#f5e6c4'; g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (const y of [68]) { g.beginPath(); g.arc(8, y, 12, 0, 7); g.fill(); g.beginPath(); g.arc(248, y, 12, 0, 7); g.fill(); }
    g.restore();
    g.lineWidth = 5; g.strokeStyle = red ? P.danger : P.gold; rr(g, 10, 10, 236, 116, 12); g.stroke();
    g.setLineDash([6, 6]); g.lineWidth = 2; g.beginPath(); g.moveTo(190, 18); g.lineTo(190, 118); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#2a1f17'; g.textBaseline = 'middle';
    g.font = '800 34px ui-monospace, Consolas, monospace'; g.fillText(slot, 24, 50);
    g.font = '600 22px "Segoe UI", system-ui, sans-serif'; g.fillStyle = '#5a4634'; g.fillText(`${who} · Room ${room}`, 26, 92);
    g.font = '800 30px Georgia, serif'; g.fillStyle = red ? P.danger : P.gold; g.textAlign = 'center'; g.fillText(`R${room}`, 219, 68);
    if (state === 'booked' || state === 'moved') {
      g.save(); g.translate(126, 70); g.rotate(-0.18);
      g.strokeStyle = state === 'moved' ? 'rgba(79,160,108,0.9)' : 'rgba(196,72,60,0.82)'; g.fillStyle = g.strokeStyle;
      g.lineWidth = 5; rr(g, -78, -26, 156, 52, 8); g.stroke();
      g.font = '900 30px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(state === 'moved' ? 'MOVED' : 'BOOKED', 0, 2);
      g.restore();
    }
    if (red) {
      g.fillStyle = P.danger; g.beginPath(); g.arc(232, 24, 18, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = '900 26px sans-serif'; g.textAlign = 'center'; g.fillText('!', 232, 26);
    }
  });
}

export class Ticket {
  constructor(scene, data, P) {
    this.data = { ...data }; this.P = P; this.scene = scene;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: ticketTexture(this.data, P), transparent: true, depthWrite: false }));
    this.sprite.renderOrder = 10; this.sprite.scale.set(0, 0, 1);
    this.anchor = new THREE.Vector3(); this.offset = new THREE.Vector3(); this.size = 1.75; this.pop = 0; this.wobble = 0; this.seed = Math.random() * 6;
    this.follow = true;
    scene.add(this.sprite);
  }
  set(patch) { Object.assign(this.data, patch); this.sprite.material.map.dispose(); this.sprite.material.map = ticketTexture(this.data, this.P); }
  place(anchor) { this.anchor.copy(anchor); this.sprite.position.copy(anchor); }
  appear() { return tween(0.5, (k) => { this.pop = k; }, ease.back); }
  punch() { this.pulse = 1; }
  moveTo(anchor, dur = 1.2) {
    const from = this.anchor.clone();
    return tween(dur, (k, raw) => { this.anchor.lerpVectors(from, anchor, k); this.anchor.y += Math.sin(raw * Math.PI) * 0.8; });
  }
  update(dt, t) {
    this.pulse = Math.max(0, (this.pulse || 0) - dt * 3);
    const s = this.size * this.pop * (1 + this.pulse * 0.35);
    this.sprite.scale.set(s, s * 136 / 256, 1);
    this.sprite.position.copy(this.anchor).add(this.offset);
    this.sprite.position.y += Math.sin(t * 1.8 + this.seed) * 0.05;
    this.sprite.position.x += Math.sin(t * 40) * 0.03 * this.wobble;
    this.sprite.material.rotation = Math.sin(t * 1.2 + this.seed) * 0.04 + Math.sin(t * 30) * 0.08 * this.wobble;
  }
  dispose() { this.scene.remove(this.sprite); this.sprite.material.map.dispose(); this.sprite.material.dispose(); }
}
