// map.js: the office as data, and the builder that turns it into a scene.
//
// The data (STARTER_OFFICE is the company on Day 1):
//   { size: [w, d]                 tiles; the floor spans x -w/2..w/2, z -d/2..d/2, tile centres on the halves
//     floors: [{ kind, rect: [x0, z0, x1, z1] }]   later rects paint over earlier ones (materials.js kinds)
//     place: [{ id, x, z, rot, name?, on?, edge?, walk?, nested?, opts?, lift? }]
//        x, z    the centre of the footprint (the asset's registered tiles, turned by rot)
//        edge    walls and doors: 'n' 's' 'e' 'w'. The art pack centres them on a tile; the map moves them
//                half a tile onto that edge of the tile at x, z (and turns e/w ones a quarter)
//        on      the name of a placed thing whose userData.surface it stands on (desk-top props: never floor space)
//        walk    true: people walk over it (a rug); its footprint is not blocked
//        nested  true: stands inside another's footprint on purpose (the chair behind the counter)
//     rooms: [{ id, name, tiles: [x0, z0, x1, z1], seats: [names], desk, label: [x, z] }]
//     door: { name, outside: [x, z] }      where people come in from
//     lane: [x0, z0, x1, z1]                the walking lane, kept clear (check() proves it)
//   }
// buildMap(stage, data) -> {
//   root, rooms: [{ id, name, tiles, center, seats: [Object3D], desk, glow, state }], seats, doors,
//   lookup(name) -> Object3D, route(from, to) -> [{ x, z }], traffic, setRoomState(id, state),
//   check() -> [problems], update(dt, t), dispose()
// }
//   route() plans over the tile grid (walls block tile edges, floor furniture blocks tiles) and keeps to the
//   right of the way it goes (two lanes on every corridor, so people passing do not meet head on).
//   traffic.send(person, to, { seat, delay }) -> Promise: walks a person along a route; departures sent in
//   the same moment are staggered, and a walker that has not made headway for a while re-plans with a
//   sidestep (the people's local steering can jam in a crowd).
import * as THREE from 'three';
import { make, get as assetMeta } from '../art/index.js';
import { tileField } from '../art/materials.js';
import { bakeStatic, canvasTex, floorGlow } from '../engine/kit.js';
import { get as tget, onThemeChange } from '../engine/theme.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const HALF_PI = Math.PI / 2;
const RUG_TOP = 0.024; // a rug's top (its painted card lies at 0.0185): blobs of things standing on it go above

// ------------------------------------------------------------------ the starter office
const wallRun = (xs, z, edge, windows = []) => xs.map((x) => ({ id: windows.includes(x) ? 'wall-window' : 'wall-segment', x, z, edge }));
const colRun = (zs, x, edge, skip = []) => zs.filter((z) => !skip.includes(z)).map((z) => ({ id: 'wall-segment', x, z, edge }));
const range = (a, b) => { const o = []; for (let v = a; v <= b + 1e-9; v++) o.push(v); return o; };
function meetingRoom(n, x0, props) {
  const cx = x0 + 2, dz = -3.9;
  return [
    { id: 'desk', x: cx, z: dz, rot: Math.PI, name: `desk-r${n}`, opts: { keyboard: false } },
    { id: 'office-chair', x: cx + 0.15, z: dz - 0.55, rot: 0, name: `chair-r${n}a`, nested: true }, // the host faces the camera
    { id: 'office-chair', x: cx + 1.3, z: dz - 0.05, rot: -HALF_PI + 0.15, name: `chair-r${n}b`, nested: true }, // a guest at the desk end, in profile
    { id: 'paper-stack', x: cx - 0.35, z: dz + 0.05, rot: 0.3, on: `desk-r${n}` },
    { id: 'mug', x: cx + 0.55, z: dz - 0.1, rot: 1, on: `desk-r${n}` },
    ...props,
  ];
}
export const STARTER_OFFICE = {
  size: [16, 12],
  floors: [
    { kind: 'wood', rect: [-8, -6, 8, 6] },
    { kind: 'carpet', rect: [-8, -6, 4, -2] },
    { kind: 'lino', rect: [4, -6, 8, -2] },
  ],
  place: [
    // the shell: a back wall with windows, the left wall with the front door, partitions between the rooms
    ...wallRun(range(-7.5, 7.5), -5.5, 'n', [-5.5, -1.5, 2.5, 5.5, 6.5]),
    ...colRun(range(-5.5, 5.5), -7.5, 'w', [-1.5]),
    { id: 'door', x: -7.5, z: -1.5, edge: 'w', name: 'door' },
    ...[-4, 0, 4].flatMap((x) => colRun(range(-5.5, -2.5), x - 0.5, 'e')),
    // Room 1: a filing cabinet and a tall plant
    ...meetingRoom(1, -8, [
      { id: 'plant-tall', x: -7.45, z: -5.45, rot: 0.4 },
      { id: 'filing-cabinet', x: -4.55, z: -5.5, rot: 0 },
      { id: 'desk-lamp', x: -6.55, z: -3.7, rot: 2.6, on: 'desk-r1' },
    ]),
    // Room 2: a bookshelf on the back wall
    ...meetingRoom(2, -4, [
      { id: 'bookshelf', x: -2.0, z: -5.5, rot: 0 },
      { id: 'plant-small', x: -0.5, z: -2.55, rot: 0.8 },
    ]),
    // Room 3: the whiteboard with the room plan
    ...meetingRoom(3, 0, [
      { id: 'whiteboard', x: 1.9, z: -5.5, rot: 0 },
      { id: 'plant-tall', x: 3.45, z: -5.45, rot: 1.9 },
      { id: 'desk-lamp', x: 1.45, z: -3.7, rot: 2.6, on: 'desk-r3' },
    ]),
    // the lab corner: boxes still arriving for the first client
    { id: 'fume-hood', x: 5.2, z: -5.5, rot: 0 },
    { id: 'lab-fridge', x: 7.5, z: -5.45, rot: 0 },
    { id: 'lab-bench', x: 5.9, z: -3.3, rot: 0, name: 'lab-bench' },
    { id: 'microscope', x: 5.45, z: -3.25, rot: -0.3, on: 'lab-bench' },
    { id: 'beaker-set', x: 6.3, z: -3.2, rot: 0.2, on: 'lab-bench' },
    { id: 'crate-stack', x: 7.5, z: -2.5, rot: 0.25 },
    // reception by the door
    { id: 'reception-counter', x: -5.6, z: 1.9, rot: 0, name: 'reception' },
    { id: 'office-chair', x: -5.3, z: 1.3, rot: 0, name: 'reception-chair', nested: true },
    { id: 'monitor', x: -4.95, z: 2.0, rot: Math.PI + 0.35, on: 'reception', name: 'reception-monitor' },
    { id: 'coat-rack', x: -7.45, z: 0.45, rot: 0 },
    { id: 'sofa', x: -7.45, z: 4.0, rot: HALF_PI, name: 'waiting-sofa' },
    { id: 'water-cooler', x: -7.5, z: 5.5, rot: HALF_PI, name: 'water-cooler' },
    { id: 'plant-tall', x: -6.45, z: 5.5, rot: 2.2 },
    // the waiting area on a rug
    { id: 'rug', x: -0.6, z: 3.4, rot: 0, walk: true },
    { id: 'sofa', x: -0.6, z: 2.55, rot: 0, name: 'sofa' },
    { id: 'coffee-table', x: -0.6, z: 3.75, rot: 0, name: 'coffee-table' },
    { id: 'paper-stack', x: -0.95, z: 3.75, rot: -0.4, on: 'coffee-table' },
    { id: 'plant-small', x: -2.55, z: 2.5, rot: 0.3 },
    // your desk: the monitor shows code, the drone rests over it
    { id: 'desk', x: 4.6, z: 2.6, rot: Math.PI, name: 'my-desk' },
    { id: 'office-chair', x: 4.8, z: 2.05, rot: 0.2, name: 'my-chair', nested: true },
    { id: 'monitor', x: 4.55, z: 2.78, rot: Math.PI, on: 'my-desk', name: 'my-monitor', opts: { code: true } },
    { id: 'desk-lamp', x: 3.95, z: 2.8, rot: 2.4, on: 'my-desk' },
    { id: 'mug', x: 5.2, z: 2.45, rot: 0.3, on: 'my-desk' },
    { id: 'filing-cabinet', x: 6.5, z: 2.1, rot: -HALF_PI + Math.PI },
    { id: 'plant-tall', x: 7.45, z: 0.5, rot: 1.2 },
    { id: 'vending-machine', x: 7.5, z: 4.3, rot: 0, name: 'vending' },
    { id: 'plant-small', x: 7.45, z: 5.5, rot: 2.1 },
    { id: 'plant-small', x: 2.5, z: 5.5, rot: 1.1 },
  ],
  rooms: [
    { id: 'room-1', name: 'Room 1', tiles: [-8, -6, -4, -2], seats: ['chair-r1a', 'chair-r1b'], desk: 'desk-r1', label: [-6, -2.45] },
    { id: 'room-2', name: 'Room 2', tiles: [-4, -6, 0, -2], seats: ['chair-r2a', 'chair-r2b'], desk: 'desk-r2', label: [-2, -2.45] },
    { id: 'room-3', name: 'Room 3', tiles: [0, -6, 4, -2], seats: ['chair-r3a', 'chair-r3b'], desk: 'desk-r3', label: [2, -2.45] },
  ],
  zones: [{ name: 'Lab · opening soon', label: [5.6, -2.45], w: 2.6 }],
  door: { name: 'door', outside: [-8.9, -1.5] },
  lane: [-8, -2, 8, 0],
};

// ------------------------------------------------------------------ helpers
const EDGE = { n: [0, -0.5, 0], s: [0, 0.5, 0], e: [0.5, 0, HALF_PI], w: [-0.5, 0, HALF_PI] };
const quarter = (rot) => Math.abs(Math.round(((rot % Math.PI) + Math.PI) % Math.PI / HALF_PI)) % 2 === 1;
function footprint(p) {
  const meta = assetMeta(p.id);
  if (!meta) throw new Error(`map: unknown asset "${p.id}"`);
  let [w, d] = meta.tiles;
  if (quarter(p.rot || 0)) [w, d] = [d, w];
  return { x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - d / 2, z1: p.z + d / 2 };
}
const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

function floorLabel(text, w = 2.0) {
  const tex = canvasTex(512, 128, (g) => {
    g.fillStyle = 'rgba(20,16,13,0.72)'; g.beginPath(); g.roundRect(8, 14, 496, 100, 30); g.fill();
    g.strokeStyle = tget('palette.gold'); g.lineWidth = 5; g.stroke();
    g.fillStyle = tget('palette.text'); g.font = '800 54px "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text.toUpperCase(), 256, 66, 460);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -HALF_PI; m.position.y = 0.02; m.renderOrder = 2;
  m.name = `label-${text}`;
  return m;
}
const glowTex = canvasTex(256, 256, (g) => {
  for (let i = 0; i < 16; i++) { g.strokeStyle = `rgba(255,255,255,${0.08 + (i / 16) * 0.6})`; g.lineWidth = 3; g.beginPath(); g.roundRect(8 + i * 2, 8 + i * 2, 240 - i * 4, 240 - i * 4, 30); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.32)'; g.beginPath(); g.roundRect(40, 40, 176, 176, 16); g.fill();
});

// Merge meshes that share a material into one mesh each: contact-shadow blobs, textured cards and the
// few loose parts that bakeStatic leaves alone. Only for things that never move (a subtree marked
// userData.moving, like the door, is skipped). uv is kept where the material has a map or a shader.
function mergeLoose(root, pick) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !pick(o)) return;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.moving) return;
    const key = `${o.material.uuid}|${o.castShadow}|${o.renderOrder}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  let merged = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const mat = list[0].material;
    const keepUv = !!(mat.map || mat.isShaderMaterial);
    const geos = list.map((o) => {
      const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
      for (const n of Object.keys(g.attributes)) if (!(n === 'position' || n === 'normal' || (keepUv && n === 'uv'))) g.deleteAttribute(n);
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      return g;
    });
    if (keepUv && !geos.every((g) => g.attributes.uv)) continue;
    const geo = mergeGeometries(geos);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = list[0].renderOrder; m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow;
    m.userData = { contactShadow: !!list[0].userData.contactShadow, outlineChild: !!list[0].userData.outlineChild, merged: list.length };
    m.raycast = () => {};
    for (const o of list) { for (const c of [...o.children]) root.attach(c); o.removeFromParent(); } // its children stay where they were
    root.add(m);
    merged += list.length;
  }
  return merged;
}

// ------------------------------------------------------------------ the builder
export function buildMap(stage, data = STARTER_OFFICE) {
  const scene = stage.scene || stage;
  const root = new THREE.Group(); root.name = 'office';
  const props = new THREE.Group(); props.name = 'props';
  root.add(props);
  scene.add(root);
  const [W, D] = data.size;
  const X0 = -W / 2, Z0 = -D / 2;

  // floors: each tile gets the last rect that covers it
  const kinds = new Map();
  for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
    const x = X0 + i + 0.5, z = Z0 + j + 0.5;
    let kind = null;
    for (const f of data.floors) { const [a, b, c, d] = f.rect; if (x > a && x < c && z > b && z < d) kind = f.kind; }
    if (!kind) continue;
    if (!kinds.has(kind)) kinds.set(kind, []);
    kinds.get(kind).push([x, z]);
  }
  let seed = 2;
  for (const [kind, cells] of kinds) { const f = tileField(kind, cells, { seed: seed++ }); f.name = `floor-${kind}`; root.add(f); }

  // props (floor things first, so a surface exists before what stands on it)
  const named = new Map();
  const placed = [];
  const order = [...data.place].sort((a, b) => (a.on ? 1 : 0) - (b.on ? 1 : 0));
  for (const p of order) {
    const opts = { ...(p.opts || {}) };
    if (opts.code) { delete opts.code; opts.draw = codeScreen; }
    const o = make(p.id, opts);
    let { x, z } = p, rot = p.rot || 0, y = 0;
    if (p.edge) { const [dx, dz, r] = EDGE[p.edge]; x += dx; z += dz; rot = r + (p.rot || 0); }
    if (p.on) {
      const base = named.get(p.on);
      if (!base) throw new Error(`map: "${p.id}" stands on "${p.on}", which is not placed`);
      y = base.userData.surface ?? 0;
    }
    o.position.set(x, y, z); o.rotation.y = rot;
    if (p.name) { o.name = p.name; named.set(p.name, o); }
    if (p.id === 'door') o.userData.moving = true;
    props.add(o);
    placed.push({ p, o, foot: p.edge || p.on ? null : footprint(p) });
  }
  // things standing on a rug keep a visible contact shadow: their blob goes above the rug's top
  const rugs = placed.filter((e) => e.p.id === 'rug');
  for (const e of placed) {
    if (!e.foot || e.p.id === 'rug') continue;
    if (!rugs.some((r) => overlap(e.foot.x0, e.foot.x1, r.foot.x0, r.foot.x1) > 0.1 && overlap(e.foot.z0, e.foot.z1, r.foot.z0, r.foot.z1) > 0.1)) continue;
    e.o.traverse((c) => { if (c.userData.contactShadow) c.position.y = RUG_TOP; });
  }

  // blocked tiles and walled edges, for routes
  const blocked = new Uint8Array(W * D);
  const idx = (i, j) => j * W + i;
  const tileOf = (x, z) => [Math.floor(x - X0), Math.floor(z - Z0)];
  const inside = (i, j) => i >= 0 && j >= 0 && i < W && j < D;
  const walls = new Set();
  const edgeKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const { p, foot } of placed) {
    if (p.edge) {
      if (p.id === 'door') continue;
      const [i, j] = tileOf(p.x, p.z);
      const n = { n: [i, j - 1], s: [i, j + 1], e: [i + 1, j], w: [i - 1, j] }[p.edge];
      walls.add(edgeKey(idx(i, j), inside(...n) ? idx(...n) : `out${n}`));
      continue;
    }
    if (!foot || p.walk) continue;
    for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
      const tx = X0 + i, tz = Z0 + j;
      if (overlap(foot.x0, foot.x1, tx, tx + 1) > 0.25 && overlap(foot.z0, foot.z1, tz, tz + 1) > 0.25) blocked[idx(i, j)] = 1;
    }
  }
  const free = (i, j) => inside(i, j) && !blocked[idx(i, j)];
  const passable = (a, b) => !walls.has(edgeKey(a, b));
  const centre = (i, j) => ({ x: X0 + i + 0.5, z: Z0 + j + 0.5 });
  function nearestFree(x, z) {
    const [ci, cj] = tileOf(x, z);
    let best = null, bd = Infinity;
    for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
      if (!free(i, j)) continue;
      const c = centre(i, j), d = Math.hypot(c.x - x, c.z - z) + (Math.abs(i - ci) + Math.abs(j - cj) === 0 ? 0 : 0.01);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    return best;
  }
  // A* over the tiles, 8 ways (no corner cutting past a blocked tile or a wall)
  function plan(from, to) {
    const s = free(...tileOf(from.x, from.z)) ? tileOf(from.x, from.z) : nearestFree(from.x, from.z);
    const g = free(...tileOf(to.x, to.z)) ? tileOf(to.x, to.z) : nearestFree(to.x, to.z);
    if (!s || !g) return null;
    const S = idx(...s), G = idx(...g);
    const cost = new Float32Array(W * D).fill(Infinity), prev = new Int32Array(W * D).fill(-1), done = new Uint8Array(W * D);
    cost[S] = 0;
    const open = [S];
    const h = (k) => Math.hypot((k % W) - g[0], Math.floor(k / W) - g[1]);
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (cost[open[k]] + h(open[k]) < cost[open[bi]] + h(open[bi])) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (cur === G) break;
      if (done[cur]) continue;
      done[cur] = 1;
      const ci = cur % W, cj = Math.floor(cur / W);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!free(ni, nj)) continue;
        const n = idx(ni, nj);
        if (di && dj) { // diagonal: both side tiles free and no wall on the way
          if (!free(ci + di, cj) || !free(ci, cj + dj)) continue;
          if (!passable(cur, idx(ci + di, cj)) || !passable(cur, idx(ci, cj + dj)) || !passable(idx(ci + di, cj), n) || !passable(idx(ci, cj + dj), n)) continue;
        } else if (!passable(cur, n)) continue;
        const c = cost[cur] + (di && dj ? Math.SQRT2 : 1);
        if (c < cost[n]) { cost[n] = c; prev[n] = cur; open.push(n); }
      }
    }
    if (cost[G] === Infinity) return null;
    const path = [];
    for (let k = G; k !== -1; k = prev[k]) path.unshift(centre(k % W, Math.floor(k / W)));
    return path;
  }
  // keep to the right: every inner corner moves a little to the right of the way in
  const LANE = 0.2;
  function route(from, to, { keepRight = true } = {}) {
    const f = toXZ(from), t = toXZ(to);
    const tiles = plan(f, t);
    if (!tiles) return null;
    // drop points on a straight run
    const pts = [tiles[0]];
    for (let k = 1; k < tiles.length - 1; k++) {
      const a = pts[pts.length - 1], b = tiles[k], c = tiles[k + 1];
      if (Math.abs((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) > 1e-6) pts.push(b);
    }
    if (tiles.length > 1) pts.push(tiles[tiles.length - 1]);
    const out = pts.map((p, k) => {
      if (!keepRight || k === 0 || k === pts.length - 1) return { ...p };
      const a = pts[k - 1], dx = p.x - a.x, dz = p.z - a.z, l = Math.hypot(dx, dz) || 1;
      return { x: p.x - (dz / l) * LANE, z: p.z + (dx / l) * LANE }; // right of the heading (x, z) is (-z, x)
    });
    out.shift(); // the start tile's centre: the walker is already on it
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - t.x, last.z - t.z) > 0.05) out.push({ x: t.x, z: t.z });
    return out;
  }

  // rooms: their seats and desk, a glow that tells their state, a label on the floor
  const rooms = data.rooms.map((r) => {
    const [a, b, c, d] = r.tiles;
    const center = new THREE.Vector3((a + c) / 2, 0, (b + d) / 2);
    const glow = floorGlow(0xffffff, c - a - 0.3, d - b - 0.3, 0, glowTex);
    glow.material.blending = THREE.NormalBlending;
    glow.position.set(center.x, 0.03, center.z); glow.visible = false; glow.renderOrder = 1; glow.name = `${r.id}-glow`;
    root.add(glow);
    const label = floorLabel(r.name); label.position.x = r.label[0]; label.position.z = r.label[1]; root.add(label);
    return { id: r.id, name: r.name, tiles: [...r.tiles], center, seats: r.seats.map((s) => named.get(s)), desk: named.get(r.desk), glow, state: 'calm', t: 0 };
  });
  for (const z of data.zones || []) { const l = floorLabel(z.name, z.w || 1.7); l.position.x = z.label[0]; l.position.z = z.label[1]; root.add(l); }

  // bake: static parts into a few merged meshes, then blobs and shared textured cards
  const baked = bakeStatic(props);
  const loose = mergeLoose(props, (o) => !o.parent || o.parent.name !== 'static-batch');

  const colour = { clash: new THREE.Color(), calm: new THREE.Color() };
  const recolour = () => { colour.clash.set(tget('play.clash')); colour.calm.set(tget('play.calm')); };
  recolour();
  const offTheme = onThemeChange((p) => { if (!p || p.startsWith('play.')) recolour(); });
  function setRoomState(id, state) {
    const r = rooms.find((x) => x.id === id || x.name === id);
    if (!r) return;
    r.state = state; r.t = 0;
    r.glow.visible = state === 'clash' || state === 'ok';
    r.glow.material.color.copy(state === 'clash' ? colour.clash : colour.calm);
  }
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const traffic = createTraffic(route, (p) => {
    const [ci, cj] = tileOf(p.x, p.z), opts = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if ((di || dj) && free(ci + di, cj + dj)) opts.push(centre(ci + di, cj + dj));
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : null;
  });
  function update(dt, t) {
    for (const r of rooms) {
      if (!r.glow.visible) continue;
      r.t += dt;
      const base = r.state === 'clash' ? 0.8 : 0.65;
      r.glow.material.opacity = RM ? base : base + 0.2 * Math.sin(t * (r.state === 'clash' ? 4 : 2));
      if (r.state === 'clash') r.glow.material.color.copy(colour.clash); else r.glow.material.color.copy(colour.calm);
    }
    traffic.update(dt);
  }

  function check() {
    const problems = [];
    const floor = placed.filter((e) => e.foot && !e.p.walk && !e.p.nested);
    for (let a = 0; a < floor.length; a++) for (let b = a + 1; b < floor.length; b++) {
      const A = floor[a].foot, B = floor[b].foot;
      if (overlap(A.x0, A.x1, B.x0, B.x1) > 0.12 && overlap(A.z0, A.z1, B.z0, B.z1) > 0.12) problems.push(`${floor[a].p.name || floor[a].p.id} overlaps ${floor[b].p.name || floor[b].p.id}`);
    }
    for (const e of placed) {
      if (!e.foot) continue;
      const f = e.foot;
      if (f.x0 < X0 - 0.01 || f.z0 < Z0 - 0.01 || f.x1 > -X0 + 0.01 || f.z1 > -Z0 + 0.01) problems.push(`${e.p.name || e.p.id} is off the floor`);
    }
    const [lx0, lz0, lx1, lz1] = data.lane;
    for (let i = 0; i < W; i++) for (let j = 0; j < D; j++) {
      const c = centre(i, j);
      if (c.x > lx0 && c.x < lx1 && c.z > lz0 && c.z < lz1 && blocked[idx(i, j)]) problems.push(`the lane is blocked at ${c.x}, ${c.z}`);
    }
    const inDoor = doorInside();
    for (const r of rooms) r.seats.forEach((s, k) => {
      if (!s) { problems.push(`${r.name} seat ${k} is missing`); return; }
      if (!route(inDoor, approach(s))) problems.push(`${r.name} seat ${k} cannot be reached from the door`);
    });
    const rc = named.get('reception-chair');
    if (rc && !route(inDoor, approach(rc))) problems.push('the reception chair cannot be reached');
    return problems;
  }
  const door = named.get(data.door.name);
  function doorInside() { const [i, j] = tileOf(door.position.x + 0.5, door.position.z); return centre(i, j); }
  // where to stand before sitting on a seat: the free tile nearest the seat, on the side it faces
  function approach(obj) {
    const s = obj.userData.seat;
    const f = s ? s.facing + obj.rotation.y : 0;
    const x = obj.position.x + Math.sin(f) * 0.6, z = obj.position.z + Math.cos(f) * 0.6;
    const t = nearestFree(x, z);
    return t ? centre(...t) : { x, z };
  }

  return {
    root, rooms, data,
    seats: rooms.flatMap((r) => r.seats),
    doors: [{ object: door, name: data.door.name, inside: doorInside(), outside: { x: data.door.outside[0], z: data.door.outside[1] } }],
    lookup: (name) => named.get(name) || null,
    route, approach, traffic, setRoomState, update, check,
    roomAt(x, z) { return rooms.find((r) => x > r.tiles[0] && x < r.tiles[2] && z > r.tiles[1] && z < r.tiles[3]) || null; },
    bounds: { x0: X0, z0: Z0, x1: -X0, z1: -Z0 },
    stats: { baked, loose },
    dispose() { offTheme(); traffic.clear(); root.removeFromParent(); },
  };
}
const toXZ = (p) => (Array.isArray(p) ? { x: p[0], z: p[1] } : p.isVector3 ? { x: p.x, z: p.z } : { x: p.x, z: p.z });

// the developer's monitor: a code editor in theme colours
function codeScreen(g, w, h, get) {
  g.fillStyle = get('palette.droneScreen'); g.fillRect(0, 0, w, h);
  const cols = [get('palette.gold'), get('palette.ok'), get('palette.glass'), get('palette.danger'), get('palette.text')];
  for (let i = 0; i < 11; i++) {
    const ind = [0, 1, 1, 2, 2, 1, 0, 1, 2, 1, 0][i];
    g.fillStyle = cols[(i * 3) % 5]; g.fillRect(12 + ind * 14, 12 + i * (h - 24) / 11, 30 + ((i * 37) % 80), 6);
    g.fillStyle = get('palette.text'); g.globalAlpha = 0.35; g.fillRect(50 + ind * 14 + ((i * 37) % 80), 12 + i * (h - 24) / 11, 20 + ((i * 53) % 60), 6); g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ traffic
// Walks people along routes. Departures in the same moment go 0.7 s apart; a walker that has not moved
// 0.25 in 2.5 s re-plans from where it stands through a sidestep; after four tries it goes straight there.
function createTraffic(route, sidestepFrom) {
  const walkers = new Set();
  let nextSlot = 0, clock = 0;
  function send(person, to, { seat = null, delay = 0, seatIndex = 0 } = {}) {
    const w = { person, to: toXZ(to), seat, seatIndex, wait: Math.max(delay, nextSlot - clock), moved: 0, still: 0, tries: 0, last: person.root.position.clone(), started: false };
    nextSlot = clock + w.wait + 0.7;
    return new Promise((res) => { w.res = res; walkers.add(w); });
  }
  function go(w, sidestep) {
    const from = w.person.root.position;
    let pts = w.tries >= 4 ? [w.to] : route(from, w.to);
    if (!pts) pts = [w.to];
    if (sidestep) pts = [sidestep, ...(route(sidestep, w.to) || [w.to])];
    w.started = true; w.still = 0; w.last.copy(from);
    const token = {}; w.token = token;
    w.person.walkTo(pts).then((arrived) => {
      if (w.token !== token || !walkers.has(w)) return;
      if (!arrived) return; // replaced by a re-plan (or someone else took the person over)
      finish(w, true);
    });
  }
  function finish(w, ok) {
    walkers.delete(w);
    if (ok && w.seat) w.person.sit(w.seat, w.seatIndex).then(() => w.res(true));
    else w.res(ok);
  }
  function update(dt) {
    clock += dt;
    for (const w of [...walkers]) {
      if (w.person.disposed) { walkers.delete(w); w.res(false); continue; }
      if (!w.started) { w.wait -= dt; if (w.wait <= 0) go(w); continue; }
      const p = w.person.root.position;
      if (p.distanceTo(w.last) > 0.25) { w.last.copy(p); w.still = 0; continue; }
      w.still += dt;
      if (w.still > 2.5) {
        w.tries++;
        go(w, sidestepFrom(p));
      }
    }
  }
  function clear() { for (const w of walkers) w.res(false); walkers.clear(); nextSlot = clock; }
  return { send, update, clear, get size() { return walkers.size; } };
}
