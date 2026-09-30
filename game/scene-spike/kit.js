// kit.js: shared procedural building blocks (materials, geometry, outlines,
// canvas textures, tweens, static batching). Zero assets: everything here is code.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PAL = {
  ink: 0x14110f, gold: 0xd9a441, paper: 0x1d1915, text: 0xefe6d2,
  danger: 0xe2574c, ok: 0x6fbf8b,
};

// ---------- toon materials ----------
const ramp = new Uint8Array([100, 146, 190, 228, 255]);
export const gradientMap = new THREE.DataTexture(ramp, ramp.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.generateMipmaps = false;
gradientMap.needsUpdate = true;

const matCache = new Map();
export function toon(color, { emissive = 0x000000, ei = 1, side = THREE.FrontSide } = {}) {
  const k = `${color}|${emissive}|${ei}|${side}`;
  if (!matCache.has(k)) {
    matCache.set(k, new THREE.MeshToonMaterial({ color, gradientMap, emissive, emissiveIntensity: ei, side }));
  }
  return matCache.get(k);
}
export function toonOwn(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, emissive: opts.emissive ?? 0, emissiveIntensity: opts.ei ?? 1, side: opts.side ?? THREE.FrontSide, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
}

// ---------- geometry cache ----------
const geoCache = new Map();
function cached(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
export const rbox = (w, h, d, r = 0.04) => cached(`rb${w},${h},${d},${r}`, () =>
  new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))));
export const sphere = (r, ws = 18, hs = 14) => cached(`sp${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const capsule = (r, l) => cached(`cp${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 12));
export const cyl = (rt, rb, h, s = 16, open = false) => cached(`cy${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
export const cone = (r, h, s = 16, open = false) => cached(`co${r},${h},${s},${open}`, () => new THREE.ConeGeometry(r, h, s, 1, open));
export const ico = (r, d = 0) => cached(`ic${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
export const torus = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => cached(`to${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));

// ---------- inverted-hull outline (extrude along normal, draw back faces) ----------
const outlineMats = new Map();
export function outlineMat(th = 0.02) {
  if (!outlineMats.has(th)) {
    outlineMats.set(th, new THREE.ShaderMaterial({
      uniforms: { th: { value: th }, color: { value: new THREE.Color(0x0a0807) } },
      vertexShader: `uniform float th;
        void main(){ vec3 p = position + normalize(normal) * th;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }`,
      side: THREE.BackSide,
    }));
  }
  return outlineMats.get(th);
}

export function setOutlines(on) { outlineMats.forEach((m) => { m.visible = on; }); }
const smooth = new Uint8Array(64).map((_, i) => 60 + Math.round((i / 63) * 195));
export const smoothRamp = new THREE.DataTexture(smooth, smooth.length, 1, THREE.RedFormat);
smoothRamp.minFilter = smoothRamp.magFilter = THREE.LinearFilter; smoothRamp.needsUpdate = true;
// toon on: stepped ramp; off: smooth ramp (reads like soft Lambert shading)
export function setToon(scene, on) {
  scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach((m) => { if (m.isMeshToonMaterial && (m.gradientMap === gradientMap || m.gradientMap === smoothRamp)) { m.gradientMap = on ? gradientMap : smoothRamp; m.needsUpdate = true; } });
  });
}

// part(): one mesh, positioned, shadowed, optionally outlined, optionally static
export function part(geo, material, o = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
  if (o.s !== undefined) Array.isArray(o.s) ? m.scale.set(...o.s) : m.scale.setScalar(o.s);
  m.castShadow = o.cast ?? true;
  m.receiveShadow = o.receive ?? true;
  if (o.outline !== 0 && o.outline !== false) {
    const th = o.outline ?? 0.018;
    const ol = new THREE.Mesh(geo, outlineMat(th));
    ol.userData.outlineChild = true;
    ol.raycast = () => {};
    m.add(ol);
    m.userData.outline = th;
  }
  if (o.static) m.userData.static = true;
  if (o.parent) o.parent.add(m);
  return m;
}

// ---------- static batching: bake marked meshes into a few merged meshes ----------
export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const byMat = new Map();
  const byOutline = new Map();
  const victims = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.static) return;
    victims.push(o);
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, { geos: [], cast: o.castShadow });
    byMat.get(o.material).geos.push(g);
    if (o.userData.outline) {
      const th = o.userData.outline;
      if (!byOutline.has(th)) byOutline.set(th, []);
      byOutline.get(th).push(g);
    }
  });
  for (const v of victims) v.parent && v.parent.remove(v);
  const out = new THREE.Group();
  out.name = 'static-batch';
  for (const [mat, { geos, cast }] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = cast; m.receiveShadow = true;
    out.add(m);
  }
  for (const [th, geos] of byOutline) {
    out.add(new THREE.Mesh(mergeGeometries(geos), outlineMat(th)));
  }
  root.add(out);
  return { meshes: victims.length, batches: out.children.length };
}

// ---------- canvas textures ----------
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.canvas = c;
  return t;
}
export const glowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.6)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
export const blobTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.85)');
  gr.addColorStop(0.6, 'rgba(0,0,0,0.35)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
export function glow(color, size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}
// flat additive decal lying on the floor
export function floorGlow(color, w, d, opacity = 0.5, tex = glowTex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

// ---------- tweens (every await in the story goes through here, so Reset can kill them) ----------
const tweens = [];
export const ease = {
  linear: (k) => k,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  out: (k) => 1 - Math.pow(1 - k, 3),
  in: (k) => k * k * k,
  back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  elastic: (k) => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};
export function tween(dur, fn, e = ease.inOut) {
  return new Promise((res) => tweens.push({ t: 0, dur: Math.max(dur, 1e-4), fn, e, res }));
}
export const wait = (s) => tween(s, () => {});
export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k), k);
    if (k >= 1) { tweens.splice(i, 1); tw.res(); }
  }
}
export function killTweens() { tweens.length = 0; } // pending story promises never resolve: the script simply stops

export const lerp = (a, b, k) => a + (b - a) * k;
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
export function dampAngle(a, b, rate, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-rate * dt));
}
export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
