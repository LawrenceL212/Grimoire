// materials.js: floor tiles and contact shadows, the first pieces of our own art pack.
//
// Floor tiles: one bevelled tile geometry shared by every kind, one toon material per kind whose
// canvas-drawn pattern (greys) is multiplied by a theme colour (palette.floor*), recoloured live.
// Every build of a kind returns the same geometry and material, so floors can be instanced:
//   tileGeometry()                      the shared 1x1 tile, top face at y = 0, bevelled edge
//   tileMaterial(kind)                  the shared material for 'wood' | 'carpet' | ...
//   tileField(kind, cells, { seed })    one InstancedMesh: cells = [[x, z], ...] tile centres
// Patterns are drawn to read at the game's default camera (a tile is roughly 35-40 px on screen):
// the features that carry them (planks, heather, sub-tiles, mottling) are a tenth of a tile or larger;
// the fine detail (grain, fibre, grit) is for close-ups.
//
// Contact shadows: contactShadow(object3d, { opacity = 1, spread, footprint }) adds one soft,
// multiply-blended blob under an object (a prop or a person), sized to its measured footprint and
// kept inside its registered tiles. Its darkness is opacity x theme light.contact (live), and it
// fades out with the scene's fog like everything else in it.
import * as THREE from 'three';
import { register, measure, get as assetMeta } from './registry.js';
import { gradientMap, canvasTex } from '../engine/kit.js';
import { get as tget, onThemeChange } from '../engine/theme.js';

export const FLOOR_KINDS = Object.freeze({
  wood: 'palette.floorWood',
  carpet: 'palette.floorCarpet',
  lino: 'palette.floorLino',
  concrete: 'palette.floorConcrete',
  rubber: 'palette.floorRubber',
  ceramic: 'palette.floorCeramic',
});

// ---------- the tile: 1 x 1, top at y = 0, a bevelled rim, short skirt (18 triangles) ----------
export const TILE = Object.freeze({ half: 0.5, bevel: 0.06, drop: 0.03, depth: 0.08 });
let tileGeo = null;
export function tileGeometry() {
  if (tileGeo) return tileGeo;
  const { half: H, bevel: B, drop: D, depth: T } = TILE;
  const I = H - B;
  const pos = [], col = [];
  const tri = (a, b, c, ca, cb, cc) => { pos.push(...a, ...b, ...c); col.push(ca, ca, ca, cb, cb, cb, cc, cc, cc); };
  const quad = (a, b, c, d, ca, cb, cc, cd) => { tri(a, b, c, ca, cb, cc); tri(a, c, d, ca, cc, cd); };
  // top (counter-clockwise seen from above: front-left, front-right, back-right, back-left)
  quad([-I, 0, I], [I, 0, I], [I, 0, -I], [-I, 0, -I], 1, 1, 1, 1);
  // each side: the bevel (inner top edge down to the outer rim) and the skirt, turned four ways
  for (let k = 0; k < 4; k++) {
    const c = Math.cos(k * Math.PI / 2), s = Math.sin(k * Math.PI / 2);
    const r = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
    quad(r([-H, -D, H]), r([H, -D, H]), r([I, 0, I]), r([-I, 0, I]), 0.42, 0.42, 0.95, 0.95);
    quad(r([-H, -T, H]), r([H, -T, H]), r([H, -D, H]), r([-H, -D, H]), 0.3, 0.3, 0.4, 0.4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // planar UVs from above, so the pattern runs on over the bevel (v = 1 at the back, z = -0.5)
  const uv = [];
  for (let i = 0; i < pos.length; i += 3) uv.push(pos[i] + 0.5, 0.5 - pos[i + 2]);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); // non-indexed: flat per face, which is what sells the bevel
  g.computeBoundingBox(); g.computeBoundingSphere();
  tileGeo = g;
  return g;
}

// ---------- patterns: greys on a 256 px canvas, seeded so every run draws the same floor ----------
const S = 256;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const grey = (v, a = 1) => { const c = Math.round(clamp01(v) * 255); return `rgba(${c},${c},${c},${a})`; };
const tint = (r, g, b, a = 1) => `rgba(${Math.round(clamp01(r) * 255)},${Math.round(clamp01(g) * 255)},${Math.round(clamp01(b) * 255)},${a})`;
// soft light/dark clouds: low-frequency variation that survives being shrunk to a few pixels
function mottle(g, R, n, rMin, rMax, amp) {
  for (let i = 0; i < n; i++) {
    const x = R() * S, y = R() * S, r = rMin + R() * (rMax - rMin);
    const light = R() < 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, light ? `rgba(255,255,255,${amp * (0.5 + R() * 0.5)})` : `rgba(0,0,0,${amp * (0.5 + R() * 0.5)})`);
    gr.addColorStop(1, light ? 'rgba(255,255,255,0)' : 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function specks(g, R, n, size, pick) {
  for (let i = 0; i < n; i++) {
    const s = size[0] + R() * (size[1] - size[0]);
    g.fillStyle = pick(R);
    g.fillRect(R() * S - s / 2, R() * S - s / 2, s, s);
  }
}

const PATTERNS = {
  // planks with grain, knots and seams: four boards per tile, staggered end joints
  wood(g) {
    const R = rng(11);
    const rows = 4, h = S / rows;
    for (let row = 0; row < rows; row++) {
      const y0 = row * h;
      const joint = row % 2 ? 150 + R() * 70 : 30 + R() * 70;
      for (const [x0, x1] of [[0, joint], [joint, S]]) {
        const tone = 0.7 + R() * 0.26;
        g.fillStyle = grey(tone); g.fillRect(x0, y0, x1 - x0, h);
        // a soft lengthwise sheen across the board
        const sh = g.createLinearGradient(0, y0, 0, y0 + h);
        sh.addColorStop(0, 'rgba(255,255,255,0.10)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.12)');
        g.fillStyle = sh; g.fillRect(x0, y0, x1 - x0, h);
        // grain: long wavy lines
        g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, h); g.clip();
        for (let k = 0; k < 13; k++) {
          const yy = y0 + 4 + R() * (h - 8), amp = 1 + R() * 3, f = 0.01 + R() * 0.03, ph = R() * 6.3;
          g.strokeStyle = R() < 0.75 ? grey(tone - 0.2, 0.35 + R() * 0.3) : grey(tone + 0.15, 0.3);
          g.lineWidth = 0.8 + R() * 1.4;
          g.beginPath();
          for (let x = x0 - 2; x <= x1 + 2; x += 6) { const v = yy + Math.sin(x * f + ph) * amp; x === x0 - 2 ? g.moveTo(x, v) : g.lineTo(x, v); }
          g.stroke();
        }
        if (R() < 0.45 && x1 - x0 > 60) { // a knot
          const kx = x0 + 20 + R() * (x1 - x0 - 40), ky = y0 + 14 + R() * (h - 28);
          for (let ring = 3; ring >= 0; ring--) {
            g.strokeStyle = grey(tone - 0.3 + ring * 0.05, 0.55); g.lineWidth = 1.3;
            g.beginPath(); g.ellipse(kx, ky, 3 + ring * 3.2, 1.8 + ring * 1.6, 0, 0, Math.PI * 2); g.stroke();
          }
          g.fillStyle = grey(tone - 0.38); g.beginPath(); g.ellipse(kx, ky, 2.6, 1.6, 0, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }
      // end joint and the seam under this board (the tile edge itself is the bevel)
      g.fillStyle = grey(0.26); g.fillRect(joint - 1.5, y0, 3, h);
      if (row > 0) { g.fillStyle = grey(0.24); g.fillRect(0, y0 - 2, S, 4); g.fillStyle = grey(1, 0.25); g.fillRect(0, y0 + 2, S, 1.5); }
    }
  },
  // a loop-pile carpet tile: heathered clouds (what reads at game distance), staggered soft loops
  // and fine fibre (close-ups). No direction, so a field can turn its tiles at random.
  carpet(g) {
    const R = rng(23);
    g.fillStyle = grey(0.8); g.fillRect(0, 0, S, S);
    mottle(g, R, 34, 24, 80, 0.25);
    // the loops: staggered rows of small soft ovals, each lit on top and shaded underneath
    const step = 8;
    for (let row = 0, y = step / 2; y < S; row++, y += step) {
      for (let x = (row % 2) * step / 2; x < S + step; x += step) {
        const cx = x + (R() - 0.5) * 1.5, cy = y + (R() - 0.5) * 1.5;
        g.fillStyle = grey(0.45, 0.16); g.beginPath(); g.ellipse(cx, cy + 1.2, 3, 2.3, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = grey(0.86 + R() * 0.12, 0.35); g.beginPath(); g.ellipse(cx, cy, 2.6, 2, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // fibre: short strokes in every direction
    g.lineCap = 'round';
    for (let i = 0; i < 4200; i++) {
      const x = R() * S, y = R() * S, a = R() * Math.PI * 2, l = 1.5 + R() * 3;
      g.strokeStyle = grey(R() < 0.55 ? 0.45 : 1, 0.12 + R() * 0.14); g.lineWidth = 0.6 + R() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    specks(g, R, 500, [1, 1.8], (r) => grey(r() < 0.5 ? 0.5 : 1, 0.25));
  },
  // sheet lino: pale clouds and a scatter of chips
  lino(g) {
    const R = rng(37);
    g.fillStyle = grey(0.86); g.fillRect(0, 0, S, S);
    mottle(g, R, 22, 26, 80, 0.22);
    specks(g, R, 700, [1.5, 3.2], (r) => { const u = r(); return u < 0.55 ? grey(0.5 + r() * 0.15) : u < 0.85 ? grey(1) : tint(0.95, 0.86, 0.7); });
    specks(g, R, 60, [3, 5], (r) => grey(r() < 0.5 ? 0.55 : 1));
  },
  // concrete: heavy mottling, grit, pits and a couple of hairline cracks
  concrete(g) {
    const R = rng(41);
    g.fillStyle = grey(0.8); g.fillRect(0, 0, S, S);
    mottle(g, R, 30, 24, 100, 0.12);
    specks(g, R, 4000, [0.8, 1.6], (r) => grey(r() < 0.5 ? 0.55 : 1, 0.35));
    for (let i = 0; i < 45; i++) { g.fillStyle = grey(0.4, 0.7); g.beginPath(); g.arc(R() * S, R() * S, 0.8 + R() * 1.8, 0, Math.PI * 2); g.fill(); }
    const crack = (x, y, a, steps, wdt) => {
      g.strokeStyle = grey(0.34, 0.7); g.lineWidth = wdt; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < steps; k++) {
        a += (R() - 0.5) * 0.9; x += Math.cos(a) * (8 + R() * 12); y += Math.sin(a) * (8 + R() * 12);
        g.lineTo(x, y);
        if (R() < 0.15 && wdt > 1) { g.stroke(); crack(x, y, a + (R() < 0.5 ? 0.9 : -0.9), 4, wdt * 0.6); g.strokeStyle = grey(0.34, 0.7); g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y); }
      }
      g.stroke();
    };
    crack(0, 60 + R() * 60, 0.3, 11, 1.8);
    crack(150 + R() * 60, S, -1.9, 7, 1.4);
  },
  // gym rubber: dark crumb with pale flecks, clustered so it is not a flat grey at a distance
  rubber(g) {
    const R = rng(53);
    g.fillStyle = grey(0.72); g.fillRect(0, 0, S, S);
    mottle(g, R, 18, 20, 60, 0.26);
    specks(g, R, 3200, [1.2, 3.2], (r) => { const u = r(); return u < 0.45 ? grey(0.4) : u < 0.85 ? grey(0.98) : tint(0.8, 0.9, 1.0); });
    // clusters of pale flecks
    for (let c = 0; c < 9; c++) {
      const cx = R() * S, cy = R() * S, cr = 12 + R() * 22;
      for (let i = 0; i < 90; i++) { const a = R() * 6.3, d = Math.sqrt(R()) * cr, s = 1.5 + R() * 2.5; g.fillStyle = grey(1, 0.85); g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s); }
    }
  },
  // ceramic: four glazed squares in grout
  ceramic(g) {
    const R = rng(67);
    g.fillStyle = grey(0.56); g.fillRect(0, 0, S, S);
    const n = 2, cell = S / n, gap = 5;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = i * cell + gap, y = j * cell + gap, w = cell - gap * 2;
      const tone = 0.86 + R() * 0.1;
      g.fillStyle = grey(tone); g.beginPath(); g.roundRect(x, y, w, w, 7); g.fill();
      const gl = g.createLinearGradient(x, y, x + w, y + w);
      gl.addColorStop(0, 'rgba(255,255,255,0.22)'); gl.addColorStop(0.45, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = gl; g.beginPath(); g.roundRect(x, y, w, w, 7); g.fill();
      // a glint along the top edge, a shade along the bottom edge
      g.fillStyle = grey(1, 0.5); g.fillRect(x + 8, y + 3, w - 16, 2);
      g.fillStyle = grey(0.4, 0.35); g.fillRect(x + 6, y + w - 3, w - 12, 2);
      specks(g, R, 30, [0.8, 1.6], () => grey(0.7, 0.4));
    }
  },
};

// ---------- materials: one per kind, recoloured live from the theme ----------
const mats = new Map();
export function tileMaterial(kind) {
  const key = FLOOR_KINDS[kind];
  if (!key) throw new Error(`unknown floor kind "${kind}"`);
  if (!mats.has(kind)) {
    const map = canvasTex(S, S, PATTERNS[kind]);
    map.anisotropy = 8;
    const m = new THREE.MeshToonMaterial({ color: tget(key), gradientMap, map, vertexColors: true });
    m.name = `floor-${kind}`;
    m.userData.themeKey = key;
    onThemeChange((p) => { if (!p || p === key) m.color.set(tget(key)); });
    mats.set(kind, m);
  }
  return mats.get(kind);
}

// How the tiles of a field turn: wood only end for end, the rest (carpet included: its loop pile
// has no direction) at random, so a big floor does not show one tile stamped over and over.
const TURNS = { wood: [0, 2], carpet: [0, 1, 2, 3], lino: [0, 1, 2, 3], concrete: [0, 1, 2, 3], rubber: [0, 1, 2, 3], ceramic: [0, 1, 2, 3] };
export function tileField(kind, cells, { seed = 1 } = {}) {
  const mesh = new THREE.InstancedMesh(tileGeometry(), tileMaterial(kind), cells.length);
  const R = rng(seed * 7919 + kind.length);
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), M = new THREE.Matrix4(), c = new THREE.Color();
  cells.forEach(([x, z], i) => {
    const turn = TURNS[kind][Math.floor(R() * TURNS[kind].length)];
    q.setFromAxisAngle(up, turn * Math.PI / 2);
    mesh.setMatrixAt(i, M.compose(p.set(x, 0, z), q, one));
    const v = 1 + (R() - 0.5) * (kind === 'carpet' ? 0.04 : 0.07);
    mesh.setColorAt(i, c.setRGB(v, v, v));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.receiveShadow = true; mesh.castShadow = false;
  mesh.userData.floorKind = kind;
  return mesh;
}

for (const kind of Object.keys(FLOOR_KINDS)) {
  register(`tile-${kind}`, {
    category: 'floor', tiles: [1, 1],
    build() {
      const m = new THREE.Mesh(tileGeometry(), tileMaterial(kind));
      m.receiveShadow = true; m.castShadow = false;
      return new THREE.Group().add(m);
    },
  });
}

// ---------- contact shadows ----------
const strength = { value: tget('light.contact') };
onThemeChange((p) => { if (!p || p === 'light.contact') strength.value = tget('light.contact'); });
const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const blobMats = new Map();
function blobMaterial(opacity) {
  const k = Math.round(clamp01(opacity) * 100) / 100;
  if (!blobMats.has(k)) {
    // fog: true gives the shader the scene's fog uniforms; the blob multiplies, so instead of
    // mixing toward the fog colour it fades toward white (no darkening) as the fog thickens
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { opacity: { value: k } }]);
    uniforms.strength = strength; // shared, so light.contact reaches every blob
    blobMats.set(k, new THREE.ShaderMaterial({
      name: 'contact-shadow',
      uniforms,
      fog: true,
      vertexShader: `varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      // a rounded-rectangle falloff in the plane's own UVs, so a long bench gets a long shadow
      fragmentShader: `uniform float opacity; uniform float strength; varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){
          vec2 p = abs(vUv * 2.0 - 1.0);
          float d = pow(pow(p.x, 3.0) + pow(p.y, 3.0), 1.0 / 3.0);
          // full strength out to the object's own edge (1 / spread = 0.77), fading to nothing at the rim
          float s = 1.0 - smoothstep(0.74, 1.0, d);
          float k = clamp(opacity * strength * s, 0.0, 0.95);
          #ifdef USE_FOG
            #ifdef FOG_EXP2
              float fogFactor = 1.0 - exp(- fogDensity * fogDensity * vFogDepth * vFogDepth);
            #else
              float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
            #endif
            k *= 1.0 - fogFactor;
          #endif
          gl_FragColor = vec4(vec3(1.0 - k), 1.0);
        }`,
      // no polygon offset: BLOB_Y already clears the floor by ~50 depth steps at game distance, and an
      // offset would pull the blob over anything flat lying just above it (a rug, a mat)
      transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true,
    }));
  }
  return blobMats.get(k);
}
export const BLOB_Y = 0.008;
function blobMesh(w, d, opacity) {
  const m = new THREE.Mesh(blobGeo, blobMaterial(opacity));
  m.scale.set(w, 1, d);
  m.position.y = BLOB_Y;
  m.castShadow = m.receiveShadow = false;
  m.raycast = () => {};
  m.renderOrder = -1; // under anything else see-through that stands on it
  m.userData.contactShadow = true;
  return m;
}

// Adds (or replaces) the object's contact shadow and returns it. The blob is `spread` times the
// object's own width and depth (measured in its frame), clamped inside `footprint` [w, d] tiles,
// which defaults to the registered footprint of an asset made with make().
export function contactShadow(object3d, { opacity = 1, spread = 1.3, footprint } = {}) {
  for (const c of [...object3d.children]) if (c.userData && c.userData.contactShadow) object3d.remove(c);
  const m = measure(object3d);
  if (!m.bounds) return null;
  const { min, max } = m.bounds;
  let w = Math.max(0.2, (max[0] - min[0]) * spread), d = Math.max(0.2, (max[2] - min[2]) * spread);
  let cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  const foot = footprint || (object3d.userData.assetId && assetMeta(object3d.userData.assetId)?.tiles);
  if (foot) {
    w = Math.min(w, foot[0]); d = Math.min(d, foot[1]);
    cx = Math.max(-foot[0] / 2 + w / 2, Math.min(foot[0] / 2 - w / 2, cx));
    cz = Math.max(-foot[1] / 2 + d / 2, Math.min(foot[1] / 2 - d / 2, cz));
  }
  const b = blobMesh(w, d, opacity);
  b.position.x = cx; b.position.z = cz;
  object3d.add(b);
  return b;
}

register('shadow-blob', {
  category: 'fx', tiles: [1, 1],
  build() { return new THREE.Group().add(blobMesh(0.9, 0.9, 1)); },
});
