// shapes.js: low-poly geometry and material builders shared by the art packs.
//
// Every geometry is cached by its arguments (build as often as you like, it is made once) and
// carries userData.hull, a smooth-normal copy that kit.part() uses for the outline, so a
// flat-shaded bevel keeps a closed outline. Sizes are in tiles (1 tile = 1 unit).
//
//   chamfer(w, h, d, b)                a box with every edge bevelled by b (44 triangles), centred
//   taper(wb, db, wt, dt, h, b)        a tapered post, corners cut by b, base at y = 0 (28 triangles)
//   slab(w, d, h, { r, bev, bs, cs })  a rounded rectangle in plan, extruded up with a bevelled rim, centred;
//                                      big bev + bs 2 gives a cushion
//   plan(key, shape, h, { bev, bs, cs }) any THREE.Shape drawn in plan (x, z), extruded up, centred
//   lathe(key, [[r, y], ...], seg, { flat })  a turned profile about Y
//   tube(key, [[x, y, z], ...], r, { seg, radial })  a smooth tube through the points
//   leaf({ len, wid, thick, droop, fold })  one low-poly leaf along +Z (16 triangles)
//   merged(key, () => [[geometry, matrix], ...])  many pieces as one geometry (one draw call)
//   rounded(w, h, r)                   a rounded-rectangle THREE.Shape, centred
//   drum(r, h, seg, bev)               a cylinder with bevelled rims, centred, axis Y
//   ball(r, seg)                       a low-poly sphere
//   mat4(x, y, z, rx, ry, rz, s)       a placement matrix for merged() (order YXZ: tip, then turn)
//
// Materials that follow the theme (palette keys), recoloured live:
//   basic(path)          unlit (screens, bulbs)
//   clear(path, opacity) see-through toon (glass, steam)
//   mapped(path, tex)    toon with a greyscale texture multiplied by the colour
//   painted(tex, { transparent, unlit })  a full-colour texture (usually a liveTex)
//   liveTex(key, w, h, draw)  a shared canvas texture redrawn when the palette changes
import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { gradientMap, canvasTex } from '../engine/kit.js';
import { get as tget, onThemeChange } from '../engine/theme.js';

const V3 = THREE.Vector3;
const cache = new Map();
function cached(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }
const k = (...a) => a.map((v) => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v)).join(',');

// the outline copy: positions welded, normals averaged (see the header)
export function withHull(g) {
  const p = new THREE.BufferGeometry();
  p.setAttribute('position', g.attributes.position.clone());
  if (g.index) p.setIndex(g.index.clone());
  const h = mergeVertices(p, 1e-4);
  h.computeVertexNormals();
  g.userData.hull = h;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
// non-indexed, flat normals (uv kept where the builder made them, for grain textures)
function flatten(g) {
  const f = g.index ? g.toNonIndexed() : g;
  for (const n of Object.keys(f.attributes)) if (n !== 'position' && n !== 'uv') f.deleteAttribute(n);
  f.computeVertexNormals();
  return f;
}

export function chamfer(w, h, d, b = 0.02) {
  return cached(`ch${k(w, h, d, b)}`, () => {
    const W = w / 2, H = h / 2, D = d / 2;
    b = Math.max(0.001, Math.min(b, W * 0.9, H * 0.9, D * 0.9));
    const pts = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      pts.push(new V3(sx * W, sy * (H - b), sz * (D - b)), new V3(sx * (W - b), sy * H, sz * (D - b)), new V3(sx * (W - b), sy * (H - b), sz * D));
    }
    return withHull(flatten(new ConvexGeometry(pts)));
  });
}

export function taper(wb, db, wt, dt, h, b = 0.01) {
  return cached(`tp${k(wb, db, wt, dt, h, b)}`, () => {
    const pts = [];
    const ring = (w, d, y, c) => {
      const W = w / 2, D = d / 2; c = Math.min(c, W * 0.9, D * 0.9);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new V3(sx * W, y, sz * (D - c)), new V3(sx * (W - c), y, sz * D));
    };
    ring(wb, db, 0, b); ring(wt, dt, h, b * (wt / wb));
    return withHull(flatten(new ConvexGeometry(pts)));
  });
}

export function rounded(w, h, r) {
  r = Math.max(0.0005, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4));
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// A shape drawn in plan (shape x = world x, shape y = world -z), extruded up by h (bevel included), centred on y.
export function plan(key, shape, h, { bev = 0.01, bs = 1, cs = 3 } = {}) {
  return cached(`pl${key}|${k(h, bev, bs, cs)}`, () => {
    bev = Math.min(bev, h * 0.45);
    const depth = Math.max(0.001, h - 2 * bev);
    const g = new THREE.ExtrudeGeometry(typeof shape === 'function' ? shape(bev) : shape,
      { depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: bs, curveSegments: cs, steps: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -depth / 2, 0);
    return withHull(flatten(g));
  });
}

export function slab(w, d, h, { r = 0.03, bev = 0.012, bs = 1, cs = 3 } = {}) {
  return plan(`slab${k(w, d, r)}`, rounded(w, d, r), h, { bev, bs, cs });
}

export function lathe(key, profile, seg = 16, { flat = false } = {}) {
  return cached(`la${key}|${seg}|${flat}`, () => {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg);
    return withHull(flat ? flatten(g) : g);
  });
}

export function tube(key, points, r, { seg = 16, radial = 6 } = {}) {
  return cached(`tu${key}|${k(r, seg, radial)}`, () => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new V3(...p)));
    return withHull(new THREE.TubeGeometry(curve, seg, r, radial, false));
  });
}

// A leaf along +Z from the origin: a midrib ridge, edges folded down, drooping toward the tip.
export function leaf({ len = 0.3, wid = 0.12, thick = 0.015, droop = 0.25, fold = 0.35 } = {}) {
  return cached(`lf${k(len, wid, thick, droop, fold)}`, () => {
    const st = [[0, 0, 0], [0.33, 1, 1], [0.7, 0.78, 0.7], [1, 0, 0]]; // [t, width, thickness]
    const rings = st.map(([t, wf, tf]) => {
      const z = t * len, y = -droop * t * t * len, w = (wid / 2) * wf, th = thick * tf;
      return [new V3(-w, y - fold * w, z), new V3(0, y + th, z), new V3(w, y - fold * w, z), new V3(0, y - th * 0.6, z)];
    });
    const tris = [];
    const B = rings[0][0], P = rings[3][0];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      tris.push([B, rings[1][j], rings[1][i]]);
      tris.push([rings[1][i], rings[1][j], rings[2][j]], [rings[1][i], rings[2][j], rings[2][i]]);
      tris.push([rings[2][i], rings[2][j], P]);
    }
    let vol = 0;
    for (const [a, b, c] of tris) vol += a.dot(new V3().crossVectors(b, c));
    const pos = [];
    for (const [a, b, c] of tris) (vol < 0 ? [a, c, b] : [a, b, c]).forEach((v) => pos.push(v.x, v.y, v.z));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return withHull(g);
  });
}

// Many pieces baked into one geometry: list() returns [[geometry, Matrix4], ...].
export function merged(key, list) {
  return cached(`mg${key}`, () => {
    const parts = list().map(([g, m]) => {
      const c = g.index ? g.toNonIndexed() : g.clone();
      for (const n of Object.keys(c.attributes)) if (n !== 'position' && n !== 'normal') c.deleteAttribute(n);
      return c.applyMatrix4(m);
    });
    return withHull(mergeGeometries(parts));
  });
}
// a Matrix4 from position, angles and scale. Order 'YXZ': a piece is twisted (rz), tipped (rx),
// then turned (ry), which is how leaves and spokes are placed round a centre.
export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
  const sc = Array.isArray(s) ? new V3(...s) : new V3(s, s, s);
  return new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), sc);
}

// a cylinder with bevelled rims, centred, axis Y
export function drum(r, h, seg = 12, bev = null) {
  const b = Math.min(bev ?? Math.min(r, h) * 0.2, r * 0.45, h * 0.45);
  return lathe(`drum${k(r, h, b)}`, [[0, -h / 2], [r - b, -h / 2], [r, -h / 2 + b], [r, h / 2 - b], [r - b, h / 2], [0, h / 2]], seg, { flat: true });
}
// a low-poly ball, centred
export function ball(r, seg = 10) {
  const n = Math.max(3, Math.round(seg / 2)), pts = [];
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return lathe(`ball${k(r)}`, pts, seg);
}

// ---------- theme-following materials ----------
const mats = new Map();
function live(key, path, make) {
  if (!mats.has(key)) {
    const m = make(tget(path));
    m.userData.themeKey = path;
    onThemeChange((p) => { if (!p || p === path) m.color.set(tget(path)); });
    mats.set(key, m);
  }
  return mats.get(key);
}
export const basic = (path, { double = false } = {}) => live(`basic|${path}|${double}`, path,
  (c) => new THREE.MeshBasicMaterial({ color: c, side: double ? THREE.DoubleSide : THREE.FrontSide }));
export const clear = (path, opacity = 0.4) => live(`clear|${path}|${opacity}`, path,
  (c) => new THREE.MeshToonMaterial({ color: c, gradientMap, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
export const mapped = (path, tex) => live(`mapped|${path}|${tex.uuid}`, path,
  (c) => new THREE.MeshToonMaterial({ color: c, gradientMap, map: tex }));

// toon (or unlit) with a full-colour texture (a liveTex draws its own theme colours)
export function painted(tex, { transparent = false, unlit = false } = {}) {
  const key = `painted|${tex.uuid}|${transparent}|${unlit}`;
  if (!mats.has(key)) {
    const o = { map: tex, transparent, alphaTest: transparent ? 0.05 : 0, depthWrite: !transparent };
    mats.set(key, unlit ? new THREE.MeshBasicMaterial(o) : new THREE.MeshToonMaterial({ ...o, gradientMap }));
  }
  return mats.get(key);
}

// Wood grain in greys, one repeat per tile along X, for the big wooden tops (their UVs are in tiles).
let grainTex = null;
export function grain(path) {
  if (!grainTex) {
    grainTex = canvasTex(256, 256, (g, w, h) => {
      const R = rng(404);
      g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { // long, gently wavy streaks
        const y = R() * h, amp = 1 + R() * 3, f = 0.01 + R() * 0.025, ph = R() * 6.3, v = R() < 0.7 ? 170 + R() * 30 : 240;
        g.strokeStyle = `rgba(${v},${v},${v},${0.25 + R() * 0.35})`; g.lineWidth = 0.8 + R() * 2.2;
        g.beginPath();
        for (let x = -4; x <= w + 4; x += 8) { const yy = y + Math.sin(x * f + ph) * amp; x === -4 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
        g.stroke();
      }
      for (let i = 0; i < 3; i++) { // a knot or two
        const x = R() * w, y = R() * h;
        for (let r = 4; r > 0; r--) { g.strokeStyle = `rgba(150,150,150,${0.25 + r * 0.05})`; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, r * 4, r * 1.6, 0, 0, Math.PI * 2); g.stroke(); }
      }
    });
    grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
  }
  return mapped(path, grainTex);
}

// A canvas texture shared by every build, redrawn from the theme whenever a palette colour changes.
const texes = new Map();
export function liveTex(key, w, h, draw) {
  if (!texes.has(key)) {
    const t = canvasTex(w, h, (g) => draw(g, w, h, tget));
    onThemeChange((p) => {
      if (p && !p.startsWith('palette.')) return;
      const g = t.userData.canvas.getContext('2d');
      g.clearRect(0, 0, w, h);
      draw(g, w, h, tget);
      t.needsUpdate = true;
    });
    texes.set(key, t);
  }
  return texes.get(key);
}

// seeded random numbers, so every build of an asset is the same
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
