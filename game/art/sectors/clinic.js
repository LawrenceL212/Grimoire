// sectors/clinic.js: the clinic pack. Clean white casework, mint curtains and couch (palette.mint),
// the red cross (palette.medical), bright metal frames. The exam bed's head is at -Z.
import { chamfer, slab, lathe, tube, drum, merged, mat4, clear, painted, liveTex } from '../shapes.js';
import { adder, seat, strut, card, C, G, FONT } from '../parts.js';
import { sectorAsset, corner, wallRun, pleats, ring } from './common.js';

const asset = sectorAsset('clinic');

// a red cross on a white disc, facing +Z (w = the cross's width)
function cross(add, x, y, z, w, o = {}) {
  add(drum(w * 0.7, 0.012, 20), C('sheet'), { x, y, z, rx: Math.PI / 2, outline: 0.005, ...o });
  add(chamfer(w, w * 0.32, 0.016, 0.004), C('medical'), { x, y, z: z + 0.008, outline: 0, ...o });
  add(chamfer(w * 0.32, w, 0.016, 0.004), C('medical'), { x, y, z: z + 0.008, outline: 0, ...o });
}

// ======================================================================= exam bed
asset('exam-bed', {
  category: 'furniture', tiles: [1, 2],
  build(g) {
    const add = adder(g), H = 0.66;
    seat(g, 0.14, H + 0.1, 0.3, Math.PI / 2); // on the side of the couch, legs over the edge
    // the base cabinet with two drawers and a pull-out step
    add(chamfer(0.5, 0.05, 1.3, 0.012), C('metal'), { y: 0.025, z: 0.05, outline: 0.01 });
    add(chamfer(0.58, H - 0.1, 1.4, 0.025), C('plastic'), { y: 0.05 + (H - 0.1) / 2, z: 0.05 });
    for (const z of [-0.28, 0.38]) {
      add(chamfer(0.02, 0.2, 0.56, 0.008), C('plastic'), { x: 0.3, y: 0.42, z, outline: 0.008 });
      add(chamfer(0.02, 0.022, 0.2, 0.008), C('chrome'), { x: 0.315, y: 0.47, z, outline: 0.004 });
    }
    add(chamfer(0.14, 0.05, 0.5, 0.012), C('chrome'), { x: 0.33, y: 0.18, z: 0.2, outline: 0.006 });
    // the couch: a padded seat and a raised back at the head, paper run over both, a pillow
    add(slab(0.66, 1.3, 0.1, { r: 0.05, bev: 0.04, bs: 2 }), C('mint'), { y: H + 0.05, z: 0.3 });
    add(slab(0.66, 0.56, 0.1, { r: 0.05, bev: 0.04, bs: 2 }), C('mint'), { y: H + 0.2, z: -0.58, rx: 0.5 });
    add(chamfer(0.04, 0.3, 0.06, 0.01), C('chrome'), { y: H + 0.05, z: -0.5, rx: -0.6, outline: 0.006 });
    add(slab(0.48, 1.24, 0.006, { r: 0.01, bev: 0.002 }), C('sheet'), { y: H + 0.103, z: 0.31, outline: 0.004 });
    add(slab(0.48, 0.5, 0.006, { r: 0.01, bev: 0.002 }), C('sheet'), { y: H + 0.245, z: -0.555, rx: 0.5, outline: 0.004 });
    add(slab(0.4, 0.2, 0.08, { r: 0.08, bev: 0.035, bs: 2 }), C('sheet'), { y: H + 0.33, z: -0.66, rx: 0.5 });
    // the paper roll on its holder at the head
    for (const sx of [-1, 1]) add(chamfer(0.02, 0.1, 0.06, 0.006), C('chrome'), { x: sx * 0.3, y: H + 0.37, z: -0.86, rx: 0.5, outline: 0.004 });
    add(drum(0.05, 0.56, 12), C('sheet'), { y: H + 0.4, z: -0.84, rz: Math.PI / 2, outline: 0.006 });
    add(drum(0.018, 0.6, 8), C('metal'), { y: H + 0.4, z: -0.84, rz: Math.PI / 2, outline: 0 });
  },
});

// ======================================================================= privacy curtain (a three-panel mobile screen)
asset('privacy-curtain', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), PW = 0.62, H = 1.62;
    const fabric = pleats('screen-panel', PW - 0.06, 1.28, { folds: 5, depth: 0.028, t: 0.016, bev: 0 });
    // three panels in a shallow U facing +Z: the side panels angled forward on their hinges
    const panels = [[-PW + 0.02, -0.02, 0.42], [0, -0.12, 0], [PW - 0.02, -0.02, -0.42]];
    for (const [x, z, ry] of panels) {
      const o = (dx, dz = 0) => ({ x: x + Math.cos(ry) * dx + Math.sin(ry) * dz, z: z - Math.sin(ry) * dx + Math.cos(ry) * dz });
      add(fabric, C('mint'), { ...o(0), y: 0.18 + 0.64 + 0.08, ry, outline: 0.008 });
      for (const y of [0.16, H]) add(chamfer(PW - 0.04, 0.03, 0.03, 0.01), C('chrome'), { ...o(0), y, ry, outline: 0.006 });
      for (const sx of [-1, 1]) {
        add(drum(0.016, H, 8), C('chrome'), { ...o(sx * (PW / 2 - 0.02)), y: H / 2 + 0.03, outline: 0.006 });
        add(drum(0.03, 0.03, 8), C('rubber'), { ...o(sx * (PW / 2 - 0.02)), y: 0.03, rz: Math.PI / 2, ry, outline: 0.004 });
        add(ballCap(), C('chrome'), { ...o(sx * (PW / 2 - 0.02)), y: H + 0.04, outline: 0.004 });
      }
    }
  },
});
function ballCap() { return lathe('screen-cap', [[0, 0], [0.024, 0], [0.024, 0.01], [0.012, 0.024], [0, 0.026]], 8, { flat: true }); }

// ======================================================================= medicine cabinet
asset('medicine-cabinet', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), zc = -0.18, fz = zc + 0.21;
    add(chamfer(0.76, 0.06, 0.38, 0.012), C('metal'), { y: 0.03, z: zc, outline: 0.01 });
    // a solid lower cupboard; the upper case is hollow (sides, back, top) behind its glass doors
    add(chamfer(0.84, 0.82, 0.42, 0.025), C('plastic'), { y: 0.47, z: zc });
    add(chamfer(0.84, 0.08, 0.42, 0.02), C('plastic'), { y: 1.74, z: zc });
    for (const sx of [-1, 1]) add(chamfer(0.05, 0.9, 0.42, 0.015), C('plastic'), { x: sx * 0.395, y: 1.3, z: zc, outline: 0.008 });
    add(chamfer(0.84, 0.9, 0.03, 0.01), C('plastic'), { y: 1.3, z: zc - 0.195, outline: 0.008 });
    // upper: shelves of bottles and boxes behind two glass doors
    add(chamfer(0.74, 0.84, 0.01, 0.004), C('chrome'), { y: 1.3, z: fz - 0.2, outline: 0 });
    const bins = { sheet: [], fabric: [], medical: [], mint: [], pot: [], ok: [] };
    [0.93, 1.21, 1.49].forEach((y, row) => {
      add(chamfer(0.74, 0.02, 0.3, 0.004), C('plastic'), { y, z: fz - 0.16, outline: 0 });
      let x = -0.33;
      for (let i = 0; x < 0.3; i++) {
        const k = Object.keys(bins)[(i * 5 + row * 2) % 6], bottle = (i + row) % 3 === 0;
        const w = bottle ? 0.06 : 0.08 + ((i + row) % 2) * 0.04, h = bottle ? 0.16 : 0.1 + ((i * 3 + row) % 3) * 0.03;
        bins[k].push([bottle ? lathe('med-bottle', [[0, 0], [0.03, 0], [0.03, 0.11], [0.014, 0.14], [0.014, 0.16], [0, 0.16]], 8, { flat: true }) : chamfer(w, h, 0.12, 0.008), mat4(x + w / 2, y + 0.01 + (bottle ? 0 : h / 2), fz - 0.12)]);
        x += w + 0.015;
      }
    });
    for (const [k, list] of Object.entries(bins)) if (list.length) add(merged(`med-shelf-${k}`, () => list), C(k), { outline: 0.004 });
    for (const sx of [-1, 1]) {
      for (const dy of [-0.405, 0.405]) add(chamfer(0.38, 0.05, 0.03, 0.01), C('plastic'), { x: sx * 0.2, y: 1.3 + dy, z: fz + 0.01, outline: 0.008 });
      for (const dx of [-0.165, 0.165]) add(chamfer(0.05, 0.86, 0.03, 0.01), C('plastic'), { x: sx * 0.2 + dx, y: 1.3, z: fz + 0.01, outline: 0.008 });
      add(chamfer(0.02, 0.1, 0.03, 0.008), C('chrome'), { x: sx * 0.035, y: 1.2, z: fz + 0.035, outline: 0.004 });
    }
    for (const sx of [-1, 1]) cardGlass(g, sx * 0.2, 1.3, fz + 0.027);
    // lower: two solid doors with the red cross across them, a lock
    for (const sx of [-1, 1]) {
      add(chamfer(0.39, 0.72, 0.03, 0.01), C('plastic'), { x: sx * 0.2, y: 0.46, z: fz + 0.01, outline: 0.008 });
      add(drum(0.016, 0.03, 8), C('chrome'), { x: sx * 0.05, y: 0.72, z: fz + 0.03, rx: Math.PI / 2, outline: 0.004 });
    }
    cross(add, 0, 0.44, fz + 0.03, 0.26);
    // a green first-aid box on top
    add(slab(0.34, 0.2, 0.14, { r: 0.03, bev: 0.012 }), C('ok'), { x: -0.1, y: 1.85, z: zc + 0.02 });
    add(chamfer(0.12, 0.035, 0.008, 0.002), C('sheet'), { x: -0.1, y: 1.85, z: zc + 0.125, outline: 0 });
    add(chamfer(0.035, 0.12, 0.008, 0.002), C('sheet'), { x: -0.1, y: 1.85, z: zc + 0.125, outline: 0 });
    add(chamfer(0.12, 0.02, 0.03, 0.008), C('chrome'), { x: -0.1, y: 1.93, z: zc + 0.02, outline: 0.004 });
  },
});
function cardGlass(g, x, y, z) { card(g, 0.32, 0.78, clear('palette.glass', 0.18), { x, y, z }); }

// ======================================================================= wheelchair
function wheelSpokes(key, R, n) {
  return merged(key, () => Array.from({ length: n }, (_, i) => [chamfer(0.006, R * 2, 0.006, 0.002), mat4(0, 0, 0, i * Math.PI / n, 0, 0)]));
}
asset('wheelchair', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), R = 0.3, az = 0.1;
    seat(g, 0, 0.53, -0.04, Math.PI);
    // the big rear wheels: tyre, hand rim, spokes, hub
    for (const sx of [-1, 1]) {
      const x = sx * 0.31;
      add(ring('wc-tyre', R - 0.02, 0.022, 20, 6), C('rubber'), { x, y: R, z: az, rz: Math.PI / 2, outline: 0.006 });
      add(ring('wc-rim', R - 0.05, 0.008, 16, 4), C('chrome'), { x: x + sx * 0.035, y: R, z: az, rz: Math.PI / 2, outline: 0.004 });
      add(wheelSpokes('wc-spokes', R - 0.04, 4), C('chrome'), { x, y: R, z: az, outline: 0 });
      add(drum(0.035, 0.05, 8), C('metal'), { x, y: R, z: az, rz: Math.PI / 2, outline: 0.005 });
    }
    // the small front castors in their forks
    for (const sx of [-1, 1]) {
      add(drum(0.06, 0.03, 10), C('rubber'), { x: sx * 0.2, y: 0.06, z: -0.3, rz: Math.PI / 2, outline: 0.005 });
      add(chamfer(0.045, 0.1, 0.025, 0.008), C('chrome'), { x: sx * 0.2, y: 0.11, z: -0.3, outline: 0.004 });
    }
    // the frame: sides from the castors up to the push handles, a cross brace under the seat
    for (const sx of [-1, 1]) {
      const x = sx * 0.22;
      add(tube(`wc-side-${sx}`, [[x, 0.16, -0.3], [x, 0.46, -0.28], [x, 0.5, -0.1], [x, 0.5, 0.14], [x, 0.9, 0.22], [x, 0.96, 0.32]], 0.015, { seg: 12, radial: 6 }), C('chrome'), { outline: 0.006 });
      add(drum(0.022, 0.1, 8), C('rubber'), { x, y: 0.97, z: 0.34, rx: Math.PI / 2 - 0.2, outline: 0.004 });
      // armrest and footrest
      add(slab(0.06, 0.3, 0.035, { r: 0.02, bev: 0.01 }), C('rubber'), { x, y: 0.7, z: -0.02, outline: 0.005 });
      strut(add, [x, 0.5, 0.1], [x, 0.7, 0.08], 0.012, C('chrome'), { seg: 6 });
      strut(add, [x, 0.46, -0.28], [sx * 0.16, 0.14, -0.4], 0.012, C('chrome'), { seg: 6 });
      add(chamfer(0.14, 0.015, 0.1, 0.005), C('metal'), { x: sx * 0.1, y: 0.13, z: -0.42, rx: -0.2, outline: 0.005 });
    }
    strut(add, [-0.22, 0.26, 0.05], [0.22, 0.42, 0.05], 0.01, C('chrome'), { outline: 0, seg: 6 });
    strut(add, [-0.22, 0.42, 0.05], [0.22, 0.26, 0.05], 0.01, C('chrome'), { outline: 0, seg: 6 });
    // the sling seat and back
    add(slab(0.44, 0.42, 0.04, { r: 0.03, bev: 0.015 }), C('fabric'), { y: 0.51, z: -0.07 });
    add(slab(0.44, 0.36, 0.04, { r: 0.03, bev: 0.015 }), C('fabric'), { y: 0.73, z: 0.19, rx: Math.PI / 2 - 0.22 });
  },
});

// ======================================================================= clinic desk
const apptTex = liveTex('clinic-appointments', 320, 184, (g, w, h, get) => {
  g.fillStyle = get('palette.sheet'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.mint'); g.fillRect(0, 0, w, 30);
  g.fillStyle = get('palette.ink'); g.font = `700 18px ${FONT}`; g.textBaseline = 'middle'; g.fillText('Appointments', 12, 16);
  ['09:00', '09:20', '09:40', '10:00', '10:20'].forEach((t, i) => {
    const y = 44 + i * 27;
    g.fillStyle = i === 2 ? get('palette.medical') : get('palette.chrome'); g.globalAlpha = i === 2 ? 0.25 : 0.35; g.fillRect(8, y - 10, w - 16, 22); g.globalAlpha = 1;
    g.fillStyle = get('palette.ink'); g.font = `600 15px ${FONT}`; g.fillText(t, 14, y + 1);
    g.fillStyle = get('palette.metal'); g.fillRect(74, y - 3, 80 + ((i * 37) % 90), 7);
  });
});
asset('clinic-desk', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), TOP = 0.76, fz = 0.39;
    g.userData.surface = TOP;
    // the desk behind, the raised front screen the patients see, its ledge
    add(chamfer(1.8, 0.06, 0.64, 0.012), C('metal'), { y: 0.03, z: -0.02, outline: 0.01 });
    add(chamfer(0.5, 0.7, 0.66, 0.02), C('plastic'), { x: -0.68, y: 0.39, z: -0.04 });
    add(slab(1.9, 0.7, 0.04, { r: 0.02, bev: 0.012 }), G('woodLight'), { y: TOP - 0.02, z: -0.1 });
    add(chamfer(1.96, 1.06, 0.07, 0.02), C('mint'), { y: 0.55, z: fz - 0.02 });
    add(chamfer(1.96, 0.1, 0.075, 0.015), C('plastic'), { y: 0.05, z: fz - 0.02, outline: 0.01 });
    add(slab(2.0, 0.24, 0.04, { r: 0.02, bev: 0.012 }), C('plastic'), { y: 1.1, z: fz - 0.04 });
    cross(add, 0.45, 0.62, fz + 0.016, 0.24);
    // the monitor and keyboard
    add(slab(0.2, 0.14, 0.015, { r: 0.05, bev: 0.005 }), C('metal'), { x: -0.3, y: TOP + 0.008, z: -0.24, outline: 0.006 });
    add(chamfer(0.05, 0.22, 0.03, 0.01), C('metal'), { x: -0.3, y: TOP + 0.11, z: -0.27, outline: 0.006 });
    add(chamfer(0.6, 0.36, 0.035, 0.012), C('metal'), { x: -0.3, y: TOP + 0.33, z: -0.24 });
    card(g, 0.55, 0.31, painted(apptTex, { unlit: true }), { x: -0.3, y: TOP + 0.33, z: -0.221 });
    add(chamfer(0.42, 0.02, 0.14, 0.006), C('plastic'), { x: -0.3, y: TOP + 0.01, z: 0.0, outline: 0.006 });
    // a blood-pressure monitor with its cuff and tube
    add(chamfer(0.16, 0.08, 0.12, 0.02), C('plastic'), { x: 0.3, y: TOP + 0.04, z: -0.1, outline: 0.006 });
    add(chamfer(0.1, 0.05, 0.004, 0.002), C('labTop'), { x: 0.3, y: TOP + 0.05, z: -0.039, outline: 0 });
    add(slab(0.16, 0.12, 0.04, { r: 0.04, bev: 0.015, bs: 2 }), C('fabric'), { x: 0.55, y: TOP + 0.02, z: -0.06, ry: 0.4 });
    add(tube('bp-tube', [[0.37, TOP + 0.05, -0.1], [0.45, TOP + 0.03, -0.18], [0.52, TOP + 0.02, -0.12], [0.55, TOP + 0.03, -0.06]], 0.006, { seg: 10, radial: 4 }), C('metal'), { outline: 0 });
    // a jar of tongue depressors and a sanitiser pump on the ledge
    add(lathe('depressor-jar', [[0, 0], [0.04, 0], [0.042, 0.12], [0.036, 0.13], [0, 0.13]], 10), clear('palette.glass', 0.35), { x: -0.7, y: 1.12, z: fz - 0.04, outline: 0.004, cast: false });
    add(merged('depressors', () => Array.from({ length: 6 }, (_, i) => [chamfer(0.014, 0.15, 0.003, 0.001), mat4(Math.sin(i * 1.1) * 0.02, 0.09, Math.cos(i * 1.1) * 0.02, 0, i, (i - 2.5) * 0.06)])), C('woodLight'), { x: -0.7, y: 1.12, z: fz - 0.04, outline: 0 });
    add(lathe('sanitiser', [[0, 0], [0.035, 0], [0.037, 0.13], [0.012, 0.15], [0, 0.15]], 10, { flat: true }), C('sheet'), { x: 0.85, y: 1.12, z: fz - 0.04, outline: 0.004 });
    add(tube('sanitiser-pump', [[0.85, 1.27, fz - 0.04], [0.85, 1.3, fz - 0.04], [0.85, 1.3, fz - 0.0]], 0.008, { seg: 4, radial: 5 }), C('mint'), { outline: 0 });
    // a clipboard with a form
    add(chamfer(0.2, 0.01, 0.28, 0.004), C('woodDark'), { x: 0.2, y: 1.125, z: fz - 0.04, ry: 1.45, outline: 0.004 });
    add(chamfer(0.18, 0.006, 0.24, 0.002), C('sheet'), { x: 0.2, y: 1.133, z: fz - 0.035, ry: 1.45, outline: 0 });
  },
});

corner('clinic', 'ceramic', [
  ...wallRun([-1.5, 1.5]),
  ['exam-bed', -2.3, -1.8, 0],
  ['privacy-curtain', -1.3, -1.3, Math.PI / 2],
  ['medicine-cabinet', 0.2, -2.3, 0],
  ['water-cooler', 2.3, -2.3, 0],
  ['clinic-desk', 1.6, -0.1, 0],
  ['office-chair', 1.6, -1.1, 0],
  ['sofa', 0.3, 2.3, Math.PI],
  ['wheelchair', 2.3, 1.9, -0.5],
  ['plant-tall', -2.3, 2.3, 0],
]);
