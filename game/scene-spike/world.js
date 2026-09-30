// world.js: the tile-grid diorama (floor tiles, three rooms, reception, door, props).
import * as THREE from 'three';
import { toonOwn, rbox, sphere, cyl, cone, ico, capsule, part, canvasTex, glow, floorGlow, glowTex, bakeStatic, rr, lerp } from './kit.js';

export const GRID = { w: 17, d: 13 };        // tiles, centred on the origin; tile = 1 unit
export const ROOM_X = [-6, 0, 6];
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function buildWorld(scene, S) {
  const root = new THREE.Group();
  scene.add(root);
  const P = S.palette;

  // Materials that the tweak panel recolours live (shared by batched meshes too).
  const M = {
    wall: toonOwn(P.wall), base: toonOwn(P.base),
    gold: toonOwn(P.gold, { emissive: P.gold, ei: 0.18 }),
    wood: toonOwn(0x8a5a36), woodDark: toonOwn(0x5b3b25), metal: toonOwn(0x2d2925), cream: toonOwn(0xe9dcc0),
    leaf: toonOwn(0x5f8f4e), leaf2: toonOwn(0x7aa85a), pot: toonOwn(0xa45a3a), paper: toonOwn(0xf3ead8),
    cork: toonOwn(0xa77b4f), note1: toonOwn(0xf2d27a), note2: toonOwn(0xe89a8a), note3: toonOwn(0x9ccfb0),
    glass: toonOwn(0xcfe6f0, { transparent: true, opacity: 0.35 }),
  };
  const chairMats = [toonOwn(0x7a3f2e), toonOwn(0x2f5446), toonOwn(0x4a3d66)];

  // ---------- diorama slab ----------
  const W = GRID.w, D = GRID.d;
  part(rbox(W + 0.7, 0.9, D + 0.7, 0.28), M.base, { y: -0.62, static: true, outline: 0.03, parent: root });
  // thin gold frame around the top edge of the slab (four strips, not a plate: tile gaps must stay dark)
  for (const s of [-1, 1]) {
    part(rbox(W + 0.78, 0.05, 0.06, 0.02), M.gold, { y: -0.19, z: s * (D / 2 + 0.36), static: true, outline: 0, parent: root });
    part(rbox(0.06, 0.05, D + 0.78, 0.02), M.gold, { y: -0.19, x: s * (W / 2 + 0.36), static: true, outline: 0, parent: root });
  }
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.9, D * 1.9), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.0, depthWrite: false }));
  // (an additive-free dark blob would need a dark texture; the CSS vignette does this job instead)
  shadowBlob.visible = false;

  // ---------- tiles (one instanced mesh) ----------
  const tileGeo = rbox(1, 1, 1, 0.1);
  const tileMat = toonOwn(0xffffff);
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, W * D);
  tiles.receiveShadow = true; tiles.castShadow = false;
  root.add(tiles);
  const tileKind = [];
  for (let iz = 0; iz < D; iz++) for (let ix = 0; ix < W; ix++) {
    const x = ix - (W - 1) / 2, z = iz - (D - 1) / 2;
    let kind = ((x + z) & 1) ? 'a' : 'b';
    if (z <= -3) kind = ROOM_X.some((cx) => Math.abs(x - cx) <= 2) ? 'wood' : 'gap';
    else if (x <= -4 && z >= 2 && z <= 5) kind = 'recep';
    tileKind.push({ x, z, kind });
  }
  function rebuildTiles() {
    const r = rng(7);
    const m = new THREE.Matrix4(), c = new THREE.Color(), q = new THREE.Quaternion();
    const f = S.world.tileFill, h = S.world.tileHeight;
    tileKind.forEach((t, i) => {
      const jitter = (r() - 0.5) * 0.025;
      m.compose(V(t.x, -h / 2 + jitter, t.z), q, V(f, h, f));
      tiles.setMatrixAt(i, m);
      const src = { a: P.tileA, b: P.tileB, wood: P.tileWood, gap: P.tileA, recep: P.tileB }[t.kind];
      c.set(src);
      if (t.kind === 'gap') c.multiplyScalar(0.72);
      if (t.kind === 'recep') c.lerp(new THREE.Color(P.gold), 0.12);
      c.offsetHSL(0, 0, (r() - 0.5) * (t.kind === 'wood' ? 0.07 : 0.035));
      if (t.kind !== 'wood' && r() < 0.05) c.lerp(new THREE.Color(P.gold), 0.18);
      tiles.setColorAt(i, c);
    });
    tiles.instanceMatrix.needsUpdate = true;
    tiles.instanceColor.needsUpdate = true;
  }
  rebuildTiles();

  // ---------- shared textures ----------
  const screenTex = canvasTex(128, 80, (g) => {
    g.fillStyle = '#10161a'; g.fillRect(0, 0, 128, 80);
    g.fillStyle = '#2a3a44'; for (let i = 0; i < 6; i++) g.fillRect(8, 10 + i * 10, 56, 4);
    const bars = [30, 44, 22, 52, 38];
    bars.forEach((b, i) => { g.fillStyle = i === 3 ? '#e2b25a' : '#6fbf8b'; g.fillRect(74 + i * 10, 70 - b, 7, b); });
  });
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, color: 0xcfd8d0 });

  function signTexture(text, col) {
    return canvasTex(256, 96, (g) => {
      rr(g, 6, 10, 244, 76, 16); g.fillStyle = 'rgba(20,17,15,0.92)'; g.fill();
      g.lineWidth = 4; g.strokeStyle = col; g.stroke();
      g.fillStyle = col; g.font = '700 40px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, 128, 50);
    });
  }

  // ---------- rooms ----------
  const rooms = ROOM_X.map((cx, i) => {
    const g = new THREE.Group(); root.add(g);
    const WH = 1.12;
    // walls: back, two sides, two front stubs, gold caps
    part(rbox(5.0, WH, 0.16, 0.05), M.wall, { x: cx, y: WH / 2, z: -6.42, static: true, parent: g });
    for (const s of [-1, 1]) {
      part(rbox(0.16, WH, 4.0, 0.05), M.wall, { x: cx + s * 2.42, y: WH / 2, z: -4.5, static: true, parent: g });
      part(rbox(1.1, WH, 0.16, 0.05), M.wall, { x: cx + s * 1.95, y: WH / 2, z: -2.58, static: true, parent: g });
      part(rbox(0.22, 0.06, 4.1, 0.02), M.gold, { x: cx + s * 2.42, y: WH + 0.02, z: -4.5, static: true, outline: 0, parent: g });
      part(rbox(1.14, 0.06, 0.22, 0.02), M.gold, { x: cx + s * 1.95, y: WH + 0.02, z: -2.58, static: true, outline: 0, parent: g });
    }
    part(rbox(5.06, 0.06, 0.22, 0.02), M.gold, { x: cx, y: WH + 0.02, z: -6.42, static: true, outline: 0, parent: g });
    // pinboard with notes on the back wall
    part(rbox(1.3, 0.55, 0.04, 0.02), M.cork, { x: cx - 1.1, y: 0.72, z: -6.32, static: true, outline: 0.012, parent: g });
    [[M.note1, -1.4, 0.8], [M.note2, -1.05, 0.66], [M.note3, -0.75, 0.82], [M.paper, -1.25, 0.58]].forEach(([mat, dx, y]) =>
      part(rbox(0.2, 0.2, 0.02, 0.01), mat, { x: cx + dx, y, z: -6.29, rz: (dx * 7) % 0.3, static: true, outline: 0, cast: false, parent: g }));
    // shelf with binders on the back wall, right side
    part(rbox(1.1, 0.05, 0.24, 0.02), M.woodDark, { x: cx + 1.2, y: 0.8, z: -6.24, static: true, parent: g });
    [0xd9a441, 0x6b8fb0, 0xb8574c, 0x6fbf8b, 0xe9dcc0].forEach((c, k) =>
      part(rbox(0.1, 0.26, 0.2, 0.02), toonOwn(c), { x: cx + 0.8 + k * 0.15, y: 0.95, z: -6.24, rz: k === 4 ? 0.25 : 0, static: true, outline: 0.01, parent: g }));

    // desk
    part(rbox(2.0, 0.08, 0.8, 0.03), M.wood, { x: cx, y: 0.56, z: -4.2, static: true, parent: g });
    for (const sx of [-0.92, 0.92]) for (const sz of [-0.34, 0.34])
      part(rbox(0.07, 0.52, 0.07, 0.02), M.woodDark, { x: cx + sx, y: 0.26, z: -4.2 + sz, static: true, outline: 0.012, parent: g });
    part(rbox(1.84, 0.3, 0.04, 0.015), M.woodDark, { x: cx, y: 0.38, z: -3.84, static: true, outline: 0.012, parent: g });
    // chair (behind the desk, person faces the camera)
    const cm = chairMats[i];
    part(rbox(0.56, 0.08, 0.5, 0.03), cm, { x: cx, y: 0.36, z: -5.08, static: true, parent: g });
    part(rbox(0.56, 0.5, 0.08, 0.03), cm, { x: cx, y: 0.64, z: -5.36, static: true, parent: g });
    part(cyl(0.035, 0.035, 0.3, 8), M.metal, { x: cx, y: 0.17, z: -5.08, static: true, outline: 0, parent: g });
    part(cyl(0.22, 0.22, 0.03, 12), M.metal, { x: cx, y: 0.02, z: -5.08, static: true, outline: 0.01, parent: g });
    // monitor (angled toward the seat)
    const mon = new THREE.Group(); mon.position.set(cx - 0.55, 0.6, -4.25); mon.rotation.y = Math.PI - 0.55; g.add(mon);
    part(rbox(0.66, 0.42, 0.05, 0.03), M.metal, { y: 0.34, static: true, parent: mon });
    part(rbox(0.06, 0.2, 0.04, 0.02), M.metal, { y: 0.1, z: -0.02, static: true, outline: 0, parent: mon });
    part(rbox(0.26, 0.02, 0.18, 0.01), M.metal, { y: 0.01, static: true, outline: 0, parent: mon });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34), screenMat); scr.position.set(0, 0.34, 0.027); mon.add(scr);
    const monBack = part(sphere(0.03, 8, 6), M.gold, { y: 0.36, z: -0.03, outline: 0, cast: false, parent: mon });
    monBack.userData.static = true;
    // papers + mug on the desk
    part(rbox(0.3, 0.012, 0.22, 0.005), M.paper, { x: cx + 0.15, y: 0.607, z: -4.05, ry: 0.2, static: true, outline: 0, cast: false, parent: g });
    part(cyl(0.05, 0.045, 0.1, 10), M.cream, { x: cx + 0.35, y: 0.65, z: -4.4, static: true, outline: 0.01, parent: g });

    // desk lamp (dynamic: bulb colour + light change with room state)
    const lamp = new THREE.Group(); lamp.position.set(cx + 0.72, 0.6, -4.35); g.add(lamp);
    part(cyl(0.1, 0.12, 0.03, 12), M.gold, { y: 0.015, outline: 0.01, parent: lamp });
    part(cyl(0.015, 0.015, 0.42, 6), M.metal, { y: 0.22, rz: 0.12, outline: 0, parent: lamp });
    part(cone(0.15, 0.16, 14, true), toonOwn(P.gold, { side: THREE.DoubleSide, emissive: P.gold, ei: 0.15 }), { x: -0.03, y: 0.46, outline: 0.012, parent: lamp });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe1a0 });
    part(sphere(0.055, 10, 8), bulbMat, { x: -0.03, y: 0.39, outline: 0, cast: false, parent: lamp });
    const bulbGlow = glow(0xffc36a, 1.1, 0.75); bulbGlow.position.set(-0.03, 0.38, 0); lamp.add(bulbGlow);
    const light = new THREE.PointLight(0xffc070, 5, 6.5, 1.6); light.position.set(cx + 0.6, 1.0, -4.1); g.add(light);

    // status bulb on the front stub
    const statusMat = new THREE.MeshBasicMaterial({ color: P.gold });
    part(sphere(0.09, 12, 8), statusMat, { x: cx + 1.95, y: WH + 0.13, z: -2.58, outline: 0.012, cast: false, parent: g });
    const statusGlow = glow(P.gold, 0.9, 0.7); statusGlow.position.set(cx + 1.95, WH + 0.15, -2.58); g.add(statusGlow);
    // room floor glow for alarm / ok states
    const fg = floorGlow(0xffffff, 6.4, 5.2, 0); fg.position.set(cx, 0.015, -4.5); fg.renderOrder = 2; g.add(fg);

    // floating sign
    const signMat = new THREE.SpriteMaterial({ map: signTexture(`Room ${i + 1}`, P.gold), transparent: true, depthWrite: false });
    const sign = new THREE.Sprite(signMat); sign.scale.set(2.0, 0.75, 1); sign.position.set(cx, 1.95, -6.4); sign.renderOrder = 5; g.add(sign);

    return {
      id: i + 1, cx, group: g, light, bulbMat, bulbGlow, statusMat, statusGlow, floorGlow: fg, sign, signMat,
      seat: V(cx, 0, -5.06), seatYaw: 0, seatY: 0.1,
      entry: [V(cx + 0.95, 0, -1.9), V(cx + 1.5, 0, -3.3), V(cx + 1.5, 0, -5.06), V(cx + 0.35, 0, -5.06)],
      clashSpot: V(cx + 0.45, 0, -3.25),
      ticketAnchor: V(cx - 1.35, 1.55, -4.7),
      markAnchor: V(cx, 2.55, -6.4),
      state: 'idle', stateT: 0, baseIntensity: 5,
    };
  });

  // ---------- gap-column props between rooms ----------
  function plant(x, z, s = 1, parent = root) {
    const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); parent.add(p);
    part(cyl(0.2, 0.15, 0.32, 12), M.pot, { y: 0.16, parent: p, static: true });
    part(cyl(0.21, 0.21, 0.04, 12), M.pot, { y: 0.32, parent: p, static: true, outline: 0 });
    const leaves = new THREE.Group(); leaves.position.y = 0.34; p.add(leaves);
    part(ico(0.26, 0), M.leaf, { y: 0.22, parent: leaves });
    part(ico(0.19, 0), M.leaf2, { x: 0.13, y: 0.4, z: 0.05, ry: 0.5, parent: leaves });
    part(ico(0.17, 0), M.leaf, { x: -0.12, y: 0.45, z: -0.06, ry: 1.2, parent: leaves });
    leaves.userData.phase = x * 1.3 + z;
    return leaves;
  }
  const swaying = [];
  swaying.push(plant(-3, -3.1), plant(3, -3.1), plant(-8, 5.9, 1.2), plant(8, -1.6, 1.1), plant(3.6, 5.9, 0.9));
  // filing cabinet + water cooler at the back of the gap columns
  part(rbox(0.6, 0.9, 0.5, 0.04), toonOwn(0x5a5550), { x: -3, y: 0.45, z: -5.9, static: true, parent: root });
  for (let k = 0; k < 3; k++) part(rbox(0.3, 0.03, 0.02, 0.01), M.gold, { x: -3, y: 0.2 + k * 0.28, z: -5.64, static: true, outline: 0, parent: root });
  part(rbox(0.42, 0.7, 0.42, 0.05), M.cream, { x: 3, y: 0.35, z: -5.9, static: true, parent: root });
  const jug = part(cyl(0.16, 0.16, 0.36, 14), toonOwn(0x7fb6d6, { transparent: true, opacity: 0.8, emissive: 0x2a5a78, ei: 0.4 }), { x: 3, y: 0.9, z: -5.9, parent: root });

  // ---------- reception ----------
  const rec = new THREE.Group(); rec.position.set(-5.6, 0, 3.6); root.add(rec);
  part(rbox(3.2, 0.72, 0.7, 0.06), M.woodDark, { y: 0.36, static: true, parent: rec });
  part(rbox(3.36, 0.07, 0.86, 0.03), M.wood, { y: 0.74, static: true, parent: rec });
  part(rbox(0.7, 0.72, 1.4, 0.06), M.woodDark, { x: -1.95, y: 0.36, z: -0.35, static: true, parent: rec });
  part(rbox(0.86, 0.07, 1.56, 0.03), M.wood, { x: -1.95, y: 0.74, z: -0.35, static: true, parent: rec });
  part(rbox(3.0, 0.08, 0.04, 0.02), M.gold, { y: 0.5, z: 0.36, static: true, outline: 0, parent: rec });
  // bell + monitor + plant on the counter
  part(sphere(0.1, 12, 8), M.gold, { x: 0.9, y: 0.8, s: [1, 0.7, 1], parent: rec, static: true });
  const rmon = new THREE.Group(); rmon.position.set(-0.4, 0.78, -0.1); rmon.rotation.y = Math.PI + 0.3; rec.add(rmon);
  part(rbox(0.6, 0.38, 0.05, 0.03), M.metal, { y: 0.3, static: true, parent: rmon });
  part(rbox(0.06, 0.16, 0.04, 0.02), M.metal, { y: 0.08, z: -0.02, static: true, outline: 0, parent: rmon });
  const rscr = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.3), screenMat); rscr.position.set(0, 0.3, 0.027); rmon.add(rscr);
  swaying.push(plant(-7.1, 3.3, 0.7, root));
  // reception lamp: a hanging pendant over the counter
  const pend = new THREE.Group(); pend.position.set(-5.2, 2.3, 3.4); root.add(pend);
  part(cyl(0.008, 0.008, 0.9, 4), M.metal, { y: 0.45, outline: 0, cast: false, parent: pend });
  part(cone(0.26, 0.22, 16, true), toonOwn(P.gold, { side: THREE.DoubleSide, emissive: P.gold, ei: 0.2 }), { y: 0, outline: 0.015, cast: false, parent: pend });
  const pendGlow = glow(0xffc36a, 1.6, 0.8); pendGlow.position.y = -0.1; pend.add(pendGlow);
  const recLight = new THREE.PointLight(0xffc27a, 7, 8, 1.5); recLight.position.set(-5.2, 1.9, 3.5); root.add(recLight);

  // rug in front of reception, emblem in the hall
  const rugTex = canvasTex(256, 160, (g) => {
    g.fillStyle = '#5a2a22'; rr(g, 0, 0, 256, 160, 18); g.fill();
    g.strokeStyle = '#d9a441'; g.lineWidth = 6; rr(g, 12, 12, 232, 136, 12); g.stroke();
    g.lineWidth = 2; rr(g, 24, 24, 208, 112, 8); g.stroke();
    g.fillStyle = '#d9a441'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(58 + k * 35, 80, 6, 0, 7); g.fill(); }
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.9), new THREE.MeshToonMaterial({ map: rugTex, gradientMap: tileMat.gradientMap }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(-5.4, 0.012, 5.05); rug.receiveShadow = true; root.add(rug);

  // ---------- the office cat, asleep in the hall (breathes) ----------
  const cat = new THREE.Group(); cat.position.set(-2.6, 0, 4.6); cat.rotation.y = 0.6; root.add(cat);
  const fur = toonOwn(0xd98f4e), furDark = toonOwn(0x8a4f26);
  const catBody = part(sphere(0.2, 14, 10), fur, { y: 0.13, s: [1.25, 0.62, 0.9], parent: cat, outline: 0.012 });
  part(sphere(0.12, 12, 10), fur, { x: 0.24, y: 0.12, z: 0.06, parent: cat, outline: 0.01 });
  for (const s of [-1, 1]) part(cone(0.045, 0.09, 6), furDark, { x: 0.25, y: 0.23, z: 0.06 + s * 0.06, rz: -0.3, parent: cat, outline: 0.008 });
  part(new THREE.TorusGeometry(0.17, 0.035, 6, 14, Math.PI * 1.1), fur, { y: 0.05, rx: -Math.PI / 2, rz: 2.2, parent: cat, outline: 0.008 });
  const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, (g) => { g.fillStyle = '#efe6d2'; g.font = '700 30px Georgia, serif'; g.fillText('z', 10, 44); g.font = '700 20px Georgia, serif'; g.fillText('z', 36, 24); }), transparent: true, depthWrite: false }));
  zzz.scale.setScalar(0.35); zzz.position.set(0.3, 0.5, 0); cat.add(zzz);

  // ---------- hall props along the edges (the walking diagonal stays clear) ----------
  const crateMat = toonOwn(0x9a6a3c), crateDark = toonOwn(0x6e4a2a);
  function crate(x, z, s = 0.55, ry = 0, y = 0) {
    part(rbox(s, s, s, 0.04), crateMat, { x, y: y + s / 2, z, ry, static: true, parent: root });
    part(rbox(s + 0.02, 0.06, s + 0.02, 0.02), crateDark, { x, y: y + s * 0.78, z, ry, static: true, outline: 0, parent: root });
  }
  crate(-1.4, 5.85, 0.6, 0.2); crate(-0.75, 5.9, 0.45, -0.3); crate(-1.35, 5.85, 0.42, 0.5, 0.6);
  crate(2.3, 5.9, 0.5, 0.1);
  // vending machine (right edge)
  part(rbox(0.8, 1.5, 0.6, 0.05), toonOwn(0x7a2f2a), { x: 8.0, y: 0.75, z: 4.7, ry: -Math.PI / 2, static: true, parent: root });
  const vendTex = canvasTex(64, 96, (g) => { g.fillStyle = '#1b2226'; g.fillRect(0, 0, 64, 96); const cs = ['#d9a441', '#6fbf8b', '#e2574c', '#7fb6d6']; for (let r2 = 0; r2 < 4; r2++) for (let c2 = 0; c2 < 3; c2++) { g.fillStyle = cs[(r2 + c2) % 4]; g.fillRect(8 + c2 * 18, 8 + r2 * 21, 12, 14); } });
  const vend = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.85), new THREE.MeshBasicMaterial({ map: vendTex }));
  vend.position.set(7.59, 0.95, 4.62); vend.rotation.y = -Math.PI / 2; root.add(vend);
  const vendGlow = glow(0xbfe6ff, 1.4, 0.25); vendGlow.position.set(7.4, 0.95, 4.62); root.add(vendGlow);
  // floor lamp (front middle) + coat rack (left)
  part(cyl(0.16, 0.18, 0.04, 12), M.metal, { x: 0.9, y: 0.02, z: 5.9, static: true, parent: root });
  part(cyl(0.02, 0.02, 1.5, 6), M.metal, { x: 0.9, y: 0.77, z: 5.9, static: true, outline: 0, parent: root });
  part(cyl(0.18, 0.26, 0.28, 14, true), toonOwn(0xf1dfb8, { side: THREE.DoubleSide, emissive: 0xffc27a, ei: 0.5 }), { x: 0.9, y: 1.58, z: 5.9, parent: root });
  const floorLampGlow = glow(0xffc27a, 1.8, 0.55); floorLampGlow.position.set(0.9, 1.55, 5.9); root.add(floorLampGlow);
  part(cyl(0.025, 0.025, 1.4, 6), M.woodDark, { x: -8.1, y: 0.7, z: 1.6, static: true, outline: 0.01, parent: root });
  part(cyl(0.2, 0.22, 0.04, 12), M.woodDark, { x: -8.1, y: 0.02, z: 1.6, static: true, parent: root });
  part(capsule(0.12, 0.35), toonOwn(0x3f5a78), { x: -7.98, y: 1.1, z: 1.6, rz: 0.15, static: true, parent: root });
  part(sphere(0.1, 10, 8), toonOwn(0xb8574c), { x: -8.1, y: 1.44, z: 1.7, s: [1, 0.6, 1], static: true, parent: root });
  const emblemTex = canvasTex(256, 256, (g) => {
    g.translate(128, 128);
    g.strokeStyle = 'rgba(217,164,65,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 118, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 104, 0, 7); g.stroke();
    for (let k = 0; k < 12; k++) { g.save(); g.rotate(k * Math.PI / 6); g.fillStyle = 'rgba(217,164,65,0.8)'; g.fillRect(-2, -118, 4, 12); g.restore(); }
    // a calendar glyph
    g.fillStyle = 'rgba(217,164,65,0.22)'; rr(g, -52, -44, 104, 92, 12); g.fill();
    g.strokeStyle = 'rgba(217,164,65,0.95)'; g.lineWidth = 6; rr(g, -52, -44, 104, 92, 12); g.stroke();
    g.beginPath(); g.moveTo(-52, -16); g.lineTo(52, -16); g.moveTo(-26, -58); g.lineTo(-26, -34); g.moveTo(26, -58); g.lineTo(26, -34); g.stroke();
    g.fillStyle = 'rgba(217,164,65,0.95)'; for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 3; c2++) g.fillRect(-36 + c2 * 28, -2 + r2 * 22, 14, 12);
  });
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  emblem.rotation.x = -Math.PI / 2; emblem.position.set(0, 0.013, 1.9); root.add(emblem);

  // ---------- lab bench (left) ----------
  const lab = new THREE.Group(); lab.position.set(-7.75, 0, -0.4); root.add(lab);
  part(rbox(0.8, 0.07, 2.4, 0.03), M.cream, { y: 0.62, static: true, parent: lab });
  part(rbox(0.72, 0.58, 2.3, 0.05), toonOwn(0x3f4a4f), { y: 0.3, static: true, parent: lab });
  const liquids = [0x6fbf8b, 0xd9a441, 0xe2574c, 0x7fb6d6];
  const beakers = [];
  liquids.forEach((c, k) => {
    const z = -0.9 + k * 0.42;
    part(cyl(0.09, 0.09, 0.26, 12, true), M.glass, { y: 0.79, z, outline: 0.008, cast: false, parent: lab });
    const liq = new THREE.MeshBasicMaterial({ color: c });
    part(cyl(0.08, 0.08, 0.14, 12), liq, { y: 0.73, z, outline: 0, cast: false, parent: lab });
    const gl = glow(c, 0.7, 0.5); gl.position.set(0, 0.85, z); lab.add(gl);
    beakers.push({ gl, k });
  });
  // microscope-ish instrument
  part(rbox(0.3, 0.05, 0.3, 0.02), M.metal, { y: 0.68, z: 0.9, static: true, parent: lab });
  part(rbox(0.07, 0.35, 0.07, 0.02), M.metal, { y: 0.85, z: 0.95, rx: -0.2, static: true, parent: lab });
  part(cyl(0.06, 0.05, 0.22, 10), M.gold, { y: 1.0, z: 0.86, rx: 0.5, static: true, parent: lab });

  // ---------- waiting bench (right) ----------
  const wb = new THREE.Group(); wb.position.set(7.65, 0, 1.4); wb.rotation.y = -Math.PI / 2; root.add(wb);
  part(rbox(2.2, 0.09, 0.55, 0.03), M.wood, { y: 0.36, static: true, parent: wb });
  part(rbox(2.2, 0.4, 0.08, 0.03), M.wood, { y: 0.62, z: -0.26, static: true, parent: wb });
  for (const sx of [-0.95, 0.95]) part(rbox(0.08, 0.34, 0.5, 0.02), M.woodDark, { x: sx, y: 0.17, static: true, outline: 0.012, parent: wb });
  part(cyl(0.3, 0.3, 0.05, 16), M.wood, { x: 6.9, y: 0.42, z: 3.1, static: true, parent: root });
  part(cyl(0.04, 0.04, 0.4, 6), M.metal, { x: 6.9, y: 0.2, z: 3.1, static: true, outline: 0, parent: root });
  part(cyl(0.05, 0.045, 0.1, 10), M.cream, { x: 6.8, y: 0.5, z: 3.05, static: true, outline: 0.01, parent: root });

  // ---------- front door ----------
  const door = new THREE.Group(); door.position.set(5.2, 0, 6.35); root.add(door);
  for (const s of [-1, 1]) part(rbox(0.16, 1.7, 0.22, 0.04), M.woodDark, { x: s * 0.62, y: 0.85, parent: door, static: true });
  part(rbox(1.44, 0.18, 0.26, 0.04), M.woodDark, { y: 1.72, parent: door, static: true });
  part(rbox(1.5, 0.05, 0.3, 0.02), M.gold, { y: 1.83, parent: door, static: true, outline: 0 });
  const leaf = new THREE.Group(); leaf.position.set(0.55, 0, 0); leaf.rotation.y = 1.25; door.add(leaf);
  part(rbox(1.06, 1.58, 0.07, 0.03), M.wood, { x: -0.53, y: 0.8, parent: leaf });
  part(sphere(0.045, 8, 6), M.gold, { x: -0.95, y: 0.8, z: 0.05, outline: 0, parent: leaf });
  const portalTex = canvasTex(64, 128, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,190,110,0.55)'); gr.addColorStop(1, 'rgba(255,225,160,1)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.62), new THREE.MeshBasicMaterial({ map: portalTex, transparent: true, opacity: 0.9 }));
  portal.position.set(0, 0.81, 0.02); door.add(portal);
  const doorGlow = glow(0xffc27a, 3.2, 0.5); doorGlow.position.set(0, 0.9, -0.3); door.add(doorGlow);
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.7), new THREE.MeshToonMaterial({ color: 0x6b3a28, gradientMap: tileMat.gradientMap }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(5.2, 0.012, 5.7); mat.receiveShadow = true; root.add(mat);

  // ---------- dust motes ----------
  const N = 90, dpos = new Float32Array(N * 3), dseed = [];
  const dr = rng(3);
  for (let k = 0; k < N; k++) { dpos[k * 3] = (dr() - 0.5) * W; dpos[k * 3 + 1] = 0.3 + dr() * 3; dpos[k * 3 + 2] = (dr() - 0.5) * D; dseed.push(dr() * 10); }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const motes = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: glowTex, color: 0xffd08a, size: 0.12, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  root.add(motes);

  const bakeInfo = bakeStatic(root);

  const glows = [...rooms.flatMap((r) => [r.bulbGlow, r.statusGlow]), pendGlow, doorGlow, vendGlow, floorLampGlow, ...beakers.map((b) => b.gl), motes];

  // ---------- live recolour ----------
  function applyColors() {
    M.wall.color.set(P.wall); M.base.color.set(P.base);
    M.gold.color.set(P.gold); M.gold.emissive.set(P.gold);
    rebuildTiles();
    rooms.forEach((r) => {
      r.signMat.map.dispose();
      r.signMat.map = signTexture(`Room ${r.id}`, P.gold);
      if (r.state === 'idle') { r.statusMat.color.set(P.gold); r.statusGlow.material.color.set(P.gold); }
    });
  }

  function setRoomState(r, state) { r.state = state; r.stateT = 0; }

  function update(dt, t) {
    swaying.forEach((l) => { l.rotation.z = Math.sin(t * 1.3 + l.userData.phase) * 0.04; l.rotation.x = Math.cos(t * 1.1 + l.userData.phase) * 0.03; });
    const lampK = S.light.lamps;
    rooms.forEach((r, i) => {
      r.stateT += dt;
      const flick = 1 + Math.sin(t * 13 + i * 3) * 0.02 + Math.sin(t * 29.7 + i) * 0.015 + (Math.sin(t * 2.1 + i * 5) > 0.985 ? -0.25 : 0);
      let col = 0xffc070, inten = r.baseIntensity * flick, fgCol = null, fgA = 0, st = P.gold;
      const sign = r.sign;
      if (r.state === 'alarm') {
        const p = 0.5 + 0.5 * Math.sin(r.stateT * 9);
        col = new THREE.Color(0xffc070).lerp(new THREE.Color(P.danger), 0.6 + 0.4 * p); inten = r.baseIntensity * (1.2 + p * 1.2);
        fgCol = P.danger; fgA = 0.35 + 0.45 * p; st = P.danger;
      } else if (r.state === 'ok') {
        const k = Math.max(0, 1 - r.stateT / 6);
        col = new THREE.Color(0xffc070).lerp(new THREE.Color(P.ok), 0.25 + 0.6 * k); fgCol = P.ok; fgA = 0.12 + 0.3 * k * (0.7 + 0.3 * Math.sin(r.stateT * 4)); st = P.ok;
      } else if (r.state === 'scan-bad' || r.state === 'scan-good') {
        const k = Math.max(0, 1 - r.stateT / 1.4);
        fgCol = r.state === 'scan-bad' ? P.danger : P.ok; fgA = 0.4 * k; st = fgCol;
        if (k === 0) r.state = r.state === 'scan-good' ? 'idle' : 'idle';
      } else if (r.state === 'shield') {
        const k = Math.max(0, 1 - r.stateT / 1.6);
        fgCol = P.gold; fgA = 0.45 * Math.sin(Math.min(1, r.stateT / 1.6) * Math.PI); if (k === 0) r.state = r.after || 'idle';
      }
      r.light.color.set(col); r.light.intensity = inten * lampK;
      r.bulbMat.color.set(col);
      r.bulbGlow.material.color.set(col);
      r.statusMat.color.set(st); r.statusGlow.material.color.set(st);
      r.statusGlow.scale.setScalar(0.9 + (r.state === 'alarm' ? 0.5 * Math.abs(Math.sin(r.stateT * 9)) : 0.05 * Math.sin(t * 2 + i)));
      if (fgCol) { r.floorGlow.material.color.set(fgCol); }
      r.floorGlow.material.opacity = damp1(r.floorGlow.material.opacity, fgA, dt, 10);
      sign.position.y = 1.95 + Math.sin(t * 1.6 + i * 1.7) * 0.05;
      sign.material.rotation = Math.sin(t * 1.1 + i) * 0.02;
    });
    recLight.intensity = 7 * lampK * (1 + Math.sin(t * 17) * 0.015);
    beakers.forEach((b) => { b.gl.material.opacity = 0.35 + 0.2 * Math.sin(t * 2 + b.k * 1.7); });
    jug.rotation.y = t * 0.2;
    catBody.scale.y = 0.62 * (1 + 0.06 * Math.sin(t * 1.7));
    const zk = (t * 0.35) % 1; zzz.position.y = 0.45 + zk * 0.35; zzz.material.opacity = Math.sin(zk * Math.PI);
    const a = motes.geometry.attributes.position;
    for (let k = 0; k < N; k++) {
      a.array[k * 3 + 1] += dt * 0.08; a.array[k * 3] += Math.sin(t * 0.4 + dseed[k]) * dt * 0.05;
      if (a.array[k * 3 + 1] > 3.4) a.array[k * 3 + 1] = 0.2;
    }
    a.needsUpdate = true;
    portal.material.opacity = 0.82 + Math.sin(t * 2.3) * 0.06;
  }
  function damp1(a, b, dt, r) { return lerp(a, b, 1 - Math.exp(-r * dt)); }

  return {
    root, rooms, tiles, M, glows, update, applyColors, rebuildTiles, setRoomState, bakeInfo,
    door: { spawn: V(5.2, 0, 6.25), inside: V(5.2, 0, 5.0), portal },
    droneHome: V(-3.6, 2.2, 3.0),
    bench: { seat: V(7.6, 0, 1.6), yaw: -Math.PI / 2 },
    center: V(0, 0, 0),
  };
}
