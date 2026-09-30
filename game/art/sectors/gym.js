// sectors/gym.js: the gym pack. Machine frames in the gym accent (palette.gymAccent), black rubber
// (palette.rubber) for plates, pads, grips and belts, bright metal for bars, and yoga mats
// (palette.yogaMat). The treadmill and rower face -Z (their consoles at the back of the tile).
import { chamfer, taper, slab, lathe, tube, drum, merged, mat4, clear, painted, liveTex } from '../shapes.js';
import { adder, seat, strut, card, C, FONT } from '../parts.js';
import { sectorAsset, corner, wallRun, ring } from './common.js';

const asset = sectorAsset('gym');

// a console readout: big number, unit, a heart and a little bar graph
function readout(key, big, unit) {
  return liveTex(key, 192, 96, (g, w, h, get) => {
    g.fillStyle = get('palette.ink'); g.fillRect(0, 0, w, h);
    g.fillStyle = get('palette.gymAccent'); g.font = `800 40px ${FONT}`; g.textBaseline = 'alphabetic'; g.fillText(big, 12, 50);
    g.fillStyle = get('palette.text'); g.font = `600 16px ${FONT}`; g.fillText(unit, 14, 72);
    g.fillStyle = get('palette.danger'); g.beginPath(); g.arc(150, 26, 8, Math.PI, 0); g.arc(166, 26, 8, Math.PI, 0); g.lineTo(158, 46); g.closePath(); g.fill();
    g.fillStyle = get('palette.ok');
    [10, 16, 12, 22, 28, 20, 30].forEach((v, i) => g.fillRect(118 + i * 10, 88 - v, 7, v));
  });
}

// ======================================================================= treadmill
const treadScreen = readout('treadmill-screen', '8.5', 'km/h');
asset('treadmill', {
  category: 'furniture', tiles: [1, 2],
  build(g) {
    const add = adder(g);
    // the frame and deck, the belt with its two foot rails, the rollers
    for (const sx of [-1, 1]) add(chamfer(0.08, 0.12, 1.66, 0.02), C('metal'), { x: sx * 0.37, y: 0.1, z: 0.12 });
    add(chamfer(0.66, 0.06, 1.6, 0.012), C('metal'), { y: 0.13, z: 0.12, outline: 0.01 });
    add(slab(0.56, 1.58, 0.03, { r: 0.02, bev: 0.008 }), C('rubber'), { y: 0.17, z: 0.12, outline: 0.01 });
    add(merged('tread-slats', () => Array.from({ length: 9 }, (_, i) => [chamfer(0.5, 0.004, 0.02, 0.002), mat4(0, 0.187, -0.55 + i * 0.16)])), C('metal'), { outline: 0 });
    for (const sx of [-1, 1]) add(chamfer(0.09, 0.03, 1.5, 0.01), C('chrome'), { x: sx * 0.33, y: 0.175, z: 0.16, outline: 0.008 });
    add(drum(0.06, 0.74, 12), C('gymAccent'), { y: 0.1, z: 0.91, rz: Math.PI / 2, outline: 0.01 });
    for (const sx of [-1, 1]) add(drum(0.03, 0.03, 8), C('rubber'), { x: sx * 0.3, y: 0.03, z: 0.82, rx: 0, outline: 0.006 });
    // the motor hood at the front
    add(slab(0.8, 0.34, 0.2, { r: 0.1, bev: 0.06, bs: 2 }), C('gymAccent'), { y: 0.17, z: -0.78 });
    add(chamfer(0.5, 0.012, 0.05, 0.005), C('metal'), { y: 0.272, z: -0.72, outline: 0 });
    // the uprights, the console and its screen, a bottle in its holder
    for (const sx of [-1, 1]) add(taper(0.08, 0.1, 0.06, 0.07, 1.02, 0.02), C('metal'), { x: sx * 0.36, y: 0.2, z: -0.82, rx: 0.14, outline: 0.01 });
    add(slab(0.84, 0.26, 0.09, { r: 0.07, bev: 0.03, bs: 2 }), C('metal'), { y: 1.25, z: -0.66, rx: Math.PI / 2 - 0.6 });
    add(chamfer(0.6, 0.03, 0.05, 0.012), C('gymAccent'), { y: 1.32, z: -0.72, rx: -0.6, outline: 0.006 });
    card(g, 0.3, 0.15, painted(treadScreen, { unlit: true }), { y: 1.265, z: -0.618, rx: -0.6 });
    for (const [x, c] of [[-0.25, 'gymAccent'], [0.22, 'ok'], [0.29, 'danger']]) add(drum(0.018, 0.02, 8), C(c), { x, y: 1.25, z: -0.62, rx: Math.PI / 2 - 0.6, outline: 0.004 });
    add(lathe('tread-bottle', [[0, 0], [0.032, 0], [0.034, 0.12], [0.02, 0.15], [0, 0.15]], 10), clear('palette.glass', 0.45), { x: 0.32, y: 1.12, z: -0.56, outline: 0.004, cast: false });
    add(drum(0.022, 0.03, 8), C('gymAccent'), { x: 0.32, y: 1.28, z: -0.56, outline: 0.004 });
    // the handrails with their grips and heart-rate pads
    for (const sx of [-1, 1]) {
      add(tube(`tread-rail-${sx}`, [[sx * 0.39, 1.05, -0.74], [sx * 0.41, 1.06, -0.55], [sx * 0.41, 1.0, -0.36], [sx * 0.4, 0.92, -0.28]], 0.02, { seg: 10, radial: 6 }), C('chrome'), { outline: 0.008 });
      add(drum(0.026, 0.16, 8), C('rubber'), { x: sx * 0.41, y: 1.03, z: -0.45, rx: Math.PI / 2 + 0.2, outline: 0.006 });
    }
    // a towel over the left rail
    add(slab(0.14, 0.26, 0.012, { r: 0.02, bev: 0.004 }), C('sheet'), { x: -0.43, y: 1.0, z: -0.62, rz: Math.PI / 2 - 0.05, outline: 0.005 });
  },
});

// ======================================================================= bench press
function plates(add, x, y, z, big, small, side) {
  add(drum(big, 0.06, 16, 0.012), C('rubber'), { x, y, z, rz: Math.PI / 2, outline: 0.008 });
  add(drum(small, 0.045, 12, 0.01), C('gymAccent'), { x: x + side * 0.058, y, z, rz: Math.PI / 2, outline: 0.008 });
  add(drum(0.04, 0.03, 8), C('chrome'), { x: x + side * 0.1, y, z, rz: Math.PI / 2, outline: 0.005 });
}
asset('bench-press', {
  category: 'furniture', tiles: [2, 2],
  build(g) {
    const add = adder(g);
    seat(g, 0, 0.51, 0.5, Math.PI / 2); // astride the end of the bench, side on
    // the bench: two T feet, the spine, the padded top
    for (const z of [-0.28, 0.66]) {
      add(chamfer(0.5, 0.06, 0.09, 0.015), C('gymAccent'), { y: 0.03, z, outline: 0.01 });
      add(chamfer(0.08, 0.34, 0.08, 0.015), C('gymAccent'), { y: 0.2, z, outline: 0.01 });
      for (const sx of [-1, 1]) add(chamfer(0.06, 0.03, 0.08, 0.01), C('rubber'), { x: sx * 0.22, y: 0.015, z, outline: 0 });
    }
    add(chamfer(0.1, 0.08, 1.06, 0.015), C('gymAccent'), { y: 0.38, z: 0.19, outline: 0.01 });
    add(slab(0.32, 1.16, 0.1, { r: 0.06, bev: 0.04, bs: 2 }), C('rubber'), { y: 0.46, z: 0.19 });
    // the rack: uprights, feet, cross brace, J-hooks, safety spotters
    for (const sx of [-1, 1]) {
      add(chamfer(0.09, 1.22, 0.09, 0.015), C('gymAccent'), { x: sx * 0.56, y: 0.63, z: -0.56 });
      add(chamfer(0.11, 0.06, 0.66, 0.015), C('gymAccent'), { x: sx * 0.56, y: 0.03, z: -0.56, outline: 0.01 });
      add(merged('rack-holes', () => Array.from({ length: 5 }, (_, i) => [chamfer(0.03, 0.03, 0.01, 0.006), mat4(0, 0.5 + i * 0.12, 0.046)])), C('metal'), { x: sx * 0.56, z: -0.56, outline: 0 });
      add(chamfer(0.06, 0.1, 0.12, 0.012), C('chrome'), { x: sx * 0.56, y: 1.02, z: -0.48, outline: 0.006 });
      add(chamfer(0.06, 0.04, 0.3, 0.012), C('chrome'), { x: sx * 0.56, y: 0.62, z: -0.36, outline: 0.006 });
    }
    add(chamfer(1.2, 0.06, 0.06, 0.015), C('gymAccent'), { y: 0.1, z: -0.84, outline: 0.01 });
    add(chamfer(1.2, 0.06, 0.06, 0.015), C('gymAccent'), { y: 1.21, z: -0.56, outline: 0.01 });
    // the bar on the hooks, loaded
    add(drum(0.016, 1.5, 8), C('chrome'), { y: 1.1, z: -0.46, rz: Math.PI / 2, outline: 0.006 });
    for (const sx of [-1, 1]) {
      add(drum(0.028, 0.34, 8), C('chrome'), { x: sx * 0.8, y: 1.1, z: -0.46, rz: Math.PI / 2, outline: 0.006 });
      add(drum(0.04, 0.02, 8), C('chrome'), { x: sx * 0.63, y: 1.1, z: -0.46, rz: Math.PI / 2, outline: 0.005 });
      plates(add, sx * 0.68, 1.1, -0.46, 0.22, 0.16, sx);
    }
    // spare plates stacked on the floor beside the bench
    add(drum(0.22, 0.05, 16, 0.012), C('rubber'), { x: 0.62, y: 0.025, z: 0.55, outline: 0.008 });
    add(drum(0.16, 0.04, 12, 0.01), C('gymAccent'), { x: 0.62, y: 0.07, z: 0.55, outline: 0.008 });
    add(drum(0.05, 0.05, 8), C('chrome'), { x: 0.62, y: 0.09, z: 0.55, outline: 0 });
  },
});

// ======================================================================= dumbbell rack
function dumbbells() {
  const heads = [], grips = [], caps = [];
  const hex = (r, w) => lathe(`hex-head-${r}`, [[0, -w / 2], [r, -w / 2], [r, w / 2], [0, w / 2]], 6, { flat: true });
  const tiers = [[0.38, 0.14], [0.7, -0.12]];
  tiers.forEach(([y, z], t) => {
    for (let i = 0; i < 4; i++) {
      for (const side of [-1, 1]) {
        const r = 0.055 + (t === 0 ? i : i * 0.6) * 0.012, w = 0.07 + i * 0.012;
        const x = side * (0.2 + i * 0.19) + side * 0.02;
        for (const e of [-1, 1]) {
          heads.push([hex(Math.round(r * 1000) / 1000, Math.round(w * 1000) / 1000), mat4(x, y + r, z + e * (0.075 + w / 2), Math.PI / 2)]);
        }
        grips.push([chamfer(0.03, 0.03, 0.16, 0.008), mat4(x, y + r, z)]);
        if (side > 0) caps.push([chamfer(0.07, 0.032, 0.008, 0.003), mat4(x, y - 0.012, z + 0.094)]); // a weight tag on the front rail
      }
    }
  });
  return { heads, grips, caps };
}
let bellsCache = null;
asset('dumbbell-rack', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g);
    // two end frames and the two sloping tiers (a pair of rails each)
    for (const sx of [-1, 1]) {
      add(chamfer(0.08, 0.06, 0.82, 0.015), C('gymAccent'), { x: sx * 0.93, y: 0.03, z: 0.0, outline: 0.01 });
      add(chamfer(0.08, 0.82, 0.08, 0.015), C('gymAccent'), { x: sx * 0.93, y: 0.41, z: -0.2, rx: 0.2 });
      add(chamfer(0.08, 0.46, 0.08, 0.015), C('gymAccent'), { x: sx * 0.93, y: 0.24, z: 0.2, rx: -0.12, outline: 0.01 });
    }
    for (const [y, z] of [[0.36, 0.14], [0.68, -0.12]]) {
      for (const dz of [-0.07, 0.07]) add(chamfer(1.9, 0.04, 0.04, 0.01), C('metal'), { y, z: z + dz, outline: 0.008 });
    }
    bellsCache ||= dumbbells();
    add(merged('dumbbell-heads', () => bellsCache.heads), C('rubber'), { outline: 0.008 });
    add(merged('dumbbell-grips', () => bellsCache.grips), C('chrome'), { outline: 0.005 });
    add(merged('dumbbell-caps', () => bellsCache.caps), C('gymAccent'), { outline: 0 });
  },
});

// ======================================================================= yoga mat
function spiral(key, r0, r1, turns, x) {
  const pts = [];
  for (let i = 0; i <= turns * 12; i++) { const a = (i / 12) * Math.PI * 2, r = r0 + (r1 - r0) * (i / (turns * 12)); pts.push([x, Math.sin(a) * r, Math.cos(a) * r]); }
  return tube(key, pts, 0.004, { seg: turns * 12, radial: 3 });
}
asset('yoga-mat', {
  category: 'furniture', tiles: [1, 2],
  shadow: { opacity: 0.35 },
  build(g) {
    const add = adder(g);
    // the mat, rolled up at the far end
    add(slab(0.62, 1.52, 0.014, { r: 0.03, bev: 0.005 }), C('yogaMat'), { y: 0.007, z: 0.18, outline: 0.006, cast: false });
    add(merged('mat-lines', () => [0.3, -0.3].map((x) => [chamfer(0.012, 0.002, 1.3, 0.001), mat4(x * 0.8, 0.015, 0.2)])), C('sheet'), { outline: 0 });
    add(drum(0.075, 0.62, 16), C('yogaMat'), { y: 0.075, z: -0.66, rz: Math.PI / 2, outline: 0.008 });
    for (const sx of [-1, 1]) add(spiral(`mat-roll-${sx}`, 0.015, 0.07, 3, sx * 0.312), C('rubber'), { y: 0.075, z: -0.66, outline: 0 });
    // a foam block, a strap, a folded towel and a bottle beside it
    add(chamfer(0.23, 0.09, 0.15, 0.025), C('gymAccent'), { x: 0.14, y: 0.059, z: 0.52, ry: 0.3 });
    add(chamfer(0.26, 0.04, 0.18, 0.02), C('sheet'), { x: -0.13, y: 0.034, z: 0.62, ry: -0.15 });
    add(chamfer(0.262, 0.042, 0.03, 0.008), C('fabric'), { x: -0.13, y: 0.034, z: 0.66, ry: -0.15, outline: 0 });
    add(ring('mat-strap', 0.07, 0.008, 12, 4), C('fabric'), { x: 0.14, y: 0.02, z: -0.28, s: [1, 1, 1.6], outline: 0.004 });
    add(lathe('mat-bottle', [[0, 0], [0.035, 0], [0.037, 0.16], [0.022, 0.19], [0, 0.19]], 10), clear('palette.glass', 0.45), { x: 0.4, y: 0, z: -0.3, outline: 0.005, cast: false });
    add(lathe('mat-bottle-water', [[0, 0.004], [0.032, 0.004], [0.032, 0.11], [0, 0.11]], 10), C('glass'), { x: 0.4, y: 0, z: -0.3, outline: 0 });
    add(drum(0.024, 0.04, 8), C('gymAccent'), { x: 0.4, y: 0.2, z: -0.3, outline: 0.004 });
  },
});

// ======================================================================= kettlebell set
const BELL = [[0, 0], [0.07, 0], [0.1, 0.025], [0.115, 0.075], [0.105, 0.125], [0.075, 0.16], [0.035, 0.175], [0, 0.178]];
asset('kettlebell-set', {
  category: 'prop', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    // a low rubber tile they stand on
    add(slab(0.92, 0.92, 0.025, { r: 0.04, bev: 0.008 }), C('rubber'), { y: 0.0125, outline: 0.006 });
    const set = [[1.25, -0.24, -0.2, 'rubber', 0.2], [1.1, 0.14, -0.24, 'gymAccent', -0.3], [0.95, -0.28, 0.2, 'yogaMat', 0.5], [0.85, 0.05, 0.12, 'hazard', 0.1], [0.75, 0.3, 0.22, 'fabric', -0.6]];
    for (const [s, x, z, c, ry] of set) {
      const y = 0.025;
      add(lathe('kettlebell', BELL, 12, { flat: true }), C(c), { x, y, z, s, outline: 0.008 });
      add(tube('kettle-horn', [[-0.06, 0.15, 0], [-0.085, 0.22, 0], [-0.06, 0.275, 0], [0, 0.29, 0], [0.06, 0.275, 0], [0.085, 0.22, 0], [0.06, 0.15, 0]], 0.019, { seg: 12, radial: 6 }), C('metal'), { x, y, z, ry, s, outline: 0.006 });
      add(drum(0.03, 0.004, 10), C('sheet'), { x: x + Math.sin(ry) * 0.0, y: y + 0.09 * s, z: z + 0.113 * s, rx: Math.PI / 2 - 0.1, outline: 0 });
    }
  },
});

// ======================================================================= rowing machine
const rowScreen = readout('rower-screen', '2:05', '/500 m');
asset('rowing-machine', {
  category: 'furniture', tiles: [1, 2],
  build(g) {
    const add = adder(g);
    // the monorail on its rear leg, the seat on its carriage
    add(chamfer(0.12, 0.07, 1.46, 0.015), C('chrome'), { y: 0.34, z: 0.2, rx: 0.03 });
    add(chamfer(0.46, 0.06, 0.1, 0.015), C('gymAccent'), { y: 0.03, z: 0.86, outline: 0.01 });
    add(chamfer(0.08, 0.3, 0.08, 0.015), C('gymAccent'), { y: 0.18, z: 0.86, outline: 0.01 });
    add(chamfer(0.2, 0.05, 0.2, 0.012), C('metal'), { y: 0.39, z: 0.34, outline: 0.008 });
    add(slab(0.34, 0.3, 0.07, { r: 0.1, bev: 0.03, bs: 2 }), C('rubber'), { y: 0.45, z: 0.34 });
    // the front: the fan housing (the flywheel inside), its stand and foot
    add(chamfer(0.56, 0.06, 0.12, 0.015), C('gymAccent'), { y: 0.03, z: -0.72, outline: 0.01 });
    add(chamfer(0.14, 0.3, 0.18, 0.02), C('gymAccent'), { y: 0.18, z: -0.62 });
    add(drum(0.27, 0.16, 22, 0.04), C('gymAccent'), { y: 0.36, z: -0.7, rz: Math.PI / 2 });
    for (const sx of [-1, 1]) {
      add(drum(0.2, 0.012, 18), C('rubber'), { x: sx * 0.081, y: 0.36, z: -0.7, rz: Math.PI / 2, outline: 0 });
      add(merged(`fan-vents-${sx}`, () => Array.from({ length: 8 }, (_, i) => [chamfer(0.006, 0.16, 0.03, 0.002), mat4(0, 0, 0, i * Math.PI / 8, 0, 0)])), C('metal'), { x: sx * 0.089, y: 0.36, z: -0.7, outline: 0 });
      add(drum(0.05, 0.02, 12), C('chrome'), { x: sx * 0.09, y: 0.36, z: -0.7, rz: Math.PI / 2, outline: 0.005 });
    }
    // the foot plates with straps
    for (const sx of [-1, 1]) {
      add(chamfer(0.13, 0.022, 0.28, 0.008), C('rubber'), { x: sx * 0.1, y: 0.33, z: -0.3, rx: -0.75, outline: 0.006 });
      add(chamfer(0.14, 0.03, 0.05, 0.01), C('gymAccent'), { x: sx * 0.1, y: 0.35, z: -0.28, rx: -0.75, outline: 0.005 });
    }
    // the handle resting on its hook, the strap back into the fan
    add(chamfer(0.5, 0.03, 0.03, 0.01), C('metal'), { y: 0.5, z: -0.44, outline: 0.006 });
    for (const sx of [-1, 1]) add(drum(0.022, 0.12, 8), C('rubber'), { x: sx * 0.2, y: 0.5, z: -0.44, rz: Math.PI / 2, outline: 0.005 });
    strut(add, [0, 0.5, -0.45], [0, 0.4, -0.52], 0.008, C('rubber'), { outline: 0 });
    // the monitor on its arm
    add(tube('rower-arm', [[0, 0.6, -0.72], [0, 0.72, -0.72], [0, 0.86, -0.64], [0, 0.95, -0.54]], 0.02, { seg: 10, radial: 6 }), C('chrome'), { outline: 0.006 });
    add(slab(0.24, 0.18, 0.05, { r: 0.03, bev: 0.012 }), C('metal'), { y: 1.0, z: -0.52, rx: Math.PI / 2 - 0.5 });
    card(g, 0.19, 0.1, painted(rowScreen, { unlit: true }), { y: 1.0, z: -0.495, rx: -0.5 });
  },
});

corner('gym', 'rubber', [
  ...wallRun([-0.5, 0.5]),
  ['plant-tall', -2.3, -2.3, 0],
  ['treadmill', -1.3, -1.8, 0],
  ['treadmill', -0.3, -1.8, 0],
  ['rowing-machine', 0.7, -1.8, 0],
  ['water-cooler', 2.3, -2.3, 0],
  ['dumbbell-rack', -2.3, 0.5, Math.PI / 2],
  ['bench-press', 1.6, 0.6, 0],
  ['yoga-mat', -1.2, 1.6, 0],
  ['yoga-mat', 0.0, 1.6, 0.08],
  ['kettlebell-set', 2.3, 2.3, 0],
]);
