// sectors/lab.js: the laboratory pack. White casework under dark epoxy tops (palette.labTop),
// glassware with bright reagents (palette.fluid), safety yellow (palette.hazard) on the shower.
// Benches stand at 0.86 (userData.surface); the microscope, centrifuge and beaker set stand on them.
import { chamfer, taper, slab, lathe, tube, drum, ball, merged, mat4, basic, clear, painted, liveTex } from '../shapes.js';
import { adder, strut, card, C, FONT } from '../parts.js';
import { sectorAsset, corner, wallRun, ring } from './common.js';

const asset = sectorAsset('lab');
const TOP = 0.86;
const GLASS = () => clear('palette.glass', 0.32);

// a turned glass vessel with its liquid inside: outer profile, and the liquid's own profile
function vessel(add, key, outer, liquid, x, y, z, liquidColour = 'fluid', o = {}) {
  add(lathe(`lab-${key}-liquid`, liquid, 12), C(liquidColour), { x, y, z, outline: 0, ...o });
  add(lathe(`lab-${key}-glass`, outer, 12), GLASS(), { x, y, z, outline: 0.006, cast: false, ...o });
}
const BEAKER = [[0, 0], [0.045, 0], [0.047, 0.004], [0.047, 0.11], [0.052, 0.118], [0.046, 0.12], [0.043, 0.112], [0.043, 0.006], [0, 0.006]];
const FLASK = [[0, 0], [0.06, 0], [0.064, 0.008], [0.045, 0.07], [0.018, 0.12], [0.018, 0.16], [0.023, 0.166], [0.014, 0.166], [0.013, 0.12], [0, 0.12]];
const BOTTLE = [[0, 0], [0.04, 0], [0.04, 0.1], [0.018, 0.122], [0.016, 0.14], [0, 0.14]];

// ======================================================================= lab bench
asset('lab-bench', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g);
    g.userData.surface = TOP;
    add(chamfer(1.82, 0.08, 0.66, 0.012), C('metal'), { y: 0.04, z: 0.0, outline: 0.01 });
    add(chamfer(1.9, 0.74, 0.76, 0.02), C('plastic'), { y: 0.45, z: -0.02 });
    // four bays: door, drawers, door, door (the sink is over the last)
    const bays = [-0.705, -0.235, 0.235, 0.705];
    bays.forEach((x, i) => {
      if (i === 1) {
        for (const [y, h] of [[0.72, 0.18], [0.5, 0.22], [0.25, 0.24]]) {
          add(chamfer(0.44, h - 0.02, 0.03, 0.01), C('plastic'), { x, y, z: 0.37, outline: 0.01 });
          add(chamfer(0.18, 0.024, 0.03, 0.01), C('chrome'), { x, y: y + h / 2 - 0.05, z: 0.395, outline: 0.006 });
        }
      } else {
        add(chamfer(0.44, 0.66, 0.03, 0.012), C('plastic'), { x, y: 0.48, z: 0.37, outline: 0.01 });
        add(chamfer(0.024, 0.2, 0.03, 0.01), C('chrome'), { x: x + (i % 2 ? -0.17 : 0.17), y: 0.62, z: 0.395, outline: 0.006 });
      }
    });
    // the epoxy top and its upstand at the back
    add(slab(1.98, 0.86, 0.05, { r: 0.025, bev: 0.012 }), C('labTop'), { y: TOP - 0.025 });
    add(chamfer(1.98, 0.1, 0.04, 0.012), C('labTop'), { y: TOP + 0.05, z: -0.41, outline: 0.01 });
    // the sink (a dark basin let into the top), its gooseneck tap and two tap heads
    add(slab(0.38, 0.3, 0.012, { r: 0.04, bev: 0.004 }), C('metal'), { x: 0.64, y: TOP + 0.002, z: 0.06, outline: 0.006 });
    add(drum(0.028, 0.03, 10), C('chrome'), { x: 0.64, y: TOP + 0.015, z: -0.24, outline: 0.006 });
    add(tube('lab-tap', [[0.64, TOP, -0.24], [0.64, TOP + 0.24, -0.24], [0.64, TOP + 0.32, -0.16], [0.64, TOP + 0.26, -0.06], [0.64, TOP + 0.2, -0.05]], 0.013, { seg: 10, radial: 6 }), C('chrome'), { outline: 0.006 });
    for (const sx of [-1, 1]) {
      add(drum(0.012, 0.05, 8), C('chrome'), { x: 0.64 + sx * 0.09, y: TOP + 0.025, z: -0.24, outline: 0.005 });
      add(chamfer(0.06, 0.014, 0.014, 0.005), C(sx < 0 ? 'medical' : 'fabric'), { x: 0.64 + sx * 0.09, y: TOP + 0.055, z: -0.24, outline: 0.004 });
    }
    // the reagent shelf over the back: two uprights, a glass-edged shelf, reagent bottles on it
    for (const sx of [-0.9, 0.2]) add(chamfer(0.04, 0.5, 0.04, 0.01), C('chrome'), { x: sx, y: TOP + 0.3, z: -0.36, outline: 0.008 });
    add(chamfer(1.2, 0.03, 0.2, 0.01), C('plastic'), { x: -0.35, y: TOP + 0.4, z: -0.33, outline: 0.01 });
    [['pot', -0.85], ['fluid', -0.7], ['pot', -0.55], ['hazard', -0.2], ['pot', -0.05], ['fluid', 0.1]].forEach(([c, x], i) => {
      add(lathe('lab-reagent', BOTTLE, 8, { flat: true }), C(c), { x, y: TOP + 0.415, z: -0.33, s: i % 3 === 1 ? 0.85 : 1, outline: 0.005 });
      add(chamfer(0.034, 0.02, 0.034, 0.006), C('metal'), { x, y: TOP + 0.415 + (i % 3 === 1 ? 0.125 : 0.148), z: -0.33, outline: 0 });
    });
    // a test-tube rack at the left end, with four tubes
    add(chamfer(0.22, 0.012, 0.07, 0.004), C('chrome'), { x: -0.7, y: TOP + 0.006, z: 0.12, outline: 0.006 });
    add(chamfer(0.22, 0.012, 0.07, 0.004), C('chrome'), { x: -0.7, y: TOP + 0.075, z: 0.12, outline: 0.006 });
    for (const sx of [-1, 1]) add(chamfer(0.012, 0.08, 0.07, 0.004), C('chrome'), { x: -0.7 + sx * 0.105, y: TOP + 0.04, z: 0.12, outline: 0 });
    ['fluid', 'hazard', 'medical', 'fluid'].forEach((c, i) => {
      const x = -0.775 + i * 0.05;
      add(drum(0.011, 0.07, 6), C(c), { x, y: TOP + 0.045, z: 0.12, outline: 0 });
      add(drum(0.013, 0.12, 6), GLASS(), { x, y: TOP + 0.066, z: 0.12, outline: 0.004, cast: false });
    });
  },
});

// ======================================================================= microscope
asset('microscope', {
  category: 'prop', tiles: [0.5, 0.5],
  build(g) {
    const add = adder(g);
    add(slab(0.2, 0.24, 0.035, { r: 0.05, bev: 0.012 }), C('plastic'), { y: 0.0175, z: -0.01 });
    // the arm: a curved pillar from the back of the base up over the stage
    add(tube('scope-arm', [[0, 0.03, -0.09], [0, 0.16, -0.1], [0, 0.26, -0.08], [0, 0.32, -0.03]], 0.03, { seg: 12, radial: 8 }), C('plastic'), { outline: 0.008 });
    add(chamfer(0.07, 0.07, 0.1, 0.02), C('plastic'), { y: 0.32, z: -0.03, outline: 0.008 });
    // coarse and fine focus knobs either side of the arm
    for (const sx of [-1, 1]) {
      add(drum(0.032, 0.02, 12), C('metal'), { x: sx * 0.045, y: 0.13, z: -0.095, rz: Math.PI / 2, outline: 0.005 });
      add(drum(0.018, 0.018, 10), C('chrome'), { x: sx * 0.064, y: 0.13, z: -0.095, rz: Math.PI / 2, outline: 0.004 });
    }
    // the stage with its slide and clips, the lamp under it
    add(chamfer(0.15, 0.016, 0.14, 0.005), C('metal'), { y: 0.155, z: 0.015, outline: 0.006 });
    add(chamfer(0.075, 0.004, 0.026, 0.001), GLASS(), { y: 0.166, z: 0.015, outline: 0, cast: false });
    add(ball(0.01, 6), C('medical'), { y: 0.168, z: 0.015, s: [1.5, 0.3, 1], outline: 0 });
    for (const sx of [-1, 1]) add(chamfer(0.012, 0.006, 0.05, 0.002), C('chrome'), { x: sx * 0.045, y: 0.167, z: 0.01, outline: 0 });
    add(drum(0.026, 0.05, 10), C('metal'), { y: 0.1, z: 0.015, outline: 0.005 });
    add(drum(0.02, 0.006, 10), basic('palette.bulb'), { y: 0.126, z: 0.015, outline: 0 });
    // the nosepiece turret and its three objectives
    add(lathe('scope-turret', [[0, 0], [0.042, 0.005], [0.036, 0.03], [0, 0.034]], 12, { flat: true }), C('chrome'), { y: 0.25, z: 0.015, rx: Math.PI, outline: 0.005 });
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1 + 0.4;
      add(taper(0.022, 0.022, 0.014, 0.014, 0.045, 0.004), C('chrome'), { x: Math.sin(a) * 0.022, y: 0.18, z: 0.015 + Math.cos(a) * 0.022, outline: 0.004 });
    }
    // the head and the binocular eyepieces, tipped back toward the user at +Z
    add(chamfer(0.09, 0.05, 0.1, 0.018), C('plastic'), { y: 0.33, z: 0.025, rx: 0.2, outline: 0.008 });
    for (const sx of [-1, 1]) {
      add(drum(0.017, 0.1, 10), C('metal'), { x: sx * 0.027, y: 0.39, z: 0.06, rx: 0.75, outline: 0.005 });
      add(drum(0.02, 0.022, 10), C('rubber'), { x: sx * 0.027, y: 0.426, z: 0.1, rx: 0.75, outline: 0.004 });
    }
  },
});

// ======================================================================= centrifuge
const rpmTex = liveTex('centrifuge-readout', 128, 48, (g, w, h, get) => {
  g.fillStyle = get('palette.ink'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.fluid'); g.font = `700 26px ${FONT}`; g.textBaseline = 'middle'; g.fillText('4000', 10, h / 2 + 1);
  g.font = `600 13px ${FONT}`; g.fillText('rpm', 86, h / 2 + 3);
});
asset('centrifuge', {
  category: 'prop', tiles: [0.5, 0.5],
  build(g) {
    const add = adder(g);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(drum(0.022, 0.016, 8), C('rubber'), { x: sx * 0.14, y: 0.008, z: sz * 0.14, outline: 0 });
    add(slab(0.4, 0.4, 0.2, { r: 0.12, bev: 0.03, bs: 2 }), C('plastic'), { y: 0.115 });
    add(slab(0.36, 0.36, 0.03, { r: 0.11, bev: 0.01 }), C('labTop'), { y: 0.225, outline: 0.008 });
    // inside the clear lid: the rotor with its tubes
    add(drum(0.1, 0.03, 14), C('chrome'), { y: 0.25, z: -0.02, outline: 0.005 });
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      add(drum(0.014, 0.05, 8), C(i % 2 ? 'fluid' : 'hazard'), { x: Math.sin(a) * 0.07, y: 0.27, z: -0.02 + Math.cos(a) * 0.07, rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5, outline: 0 });
    }
    add(lathe('centrifuge-lid', [[0.13, 0], [0.13, 0.02], [0.11, 0.05], [0.06, 0.07], [0, 0.074]], 16), GLASS(), { y: 0.24, z: -0.02, outline: 0.006, cast: false });
    add(ring('centrifuge-rim', 0.13, 0.01, 18, 6), C('metal'), { y: 0.243, z: -0.02, outline: 0 });
    // the sloping control panel at the front, its readout and buttons
    add(chamfer(0.3, 0.1, 0.04, 0.012), C('labTop'), { y: 0.13, z: 0.2, rx: -0.35, outline: 0.008 });
    card(g, 0.13, 0.05, painted(rpmTex, { unlit: true }), { x: -0.05, y: 0.14, z: 0.222, rx: -0.35 });
    [['ok', 0.07], ['medical', 0.115]].forEach(([c, x]) => add(drum(0.015, 0.016, 10), C(c), { x, y: 0.135, z: 0.222, rx: Math.PI / 2 - 0.35, outline: 0.004 }));
  },
});

// ======================================================================= fume hood
const hoodSign = liveTex('fume-hood-sign', 256, 64, (g, w, h, get) => {
  g.fillStyle = get('palette.hazard'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.ink');
  for (let x = -h; x < w; x += 28) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 14, h); g.lineTo(x + 14 + h * 0.5, h - 12); g.lineTo(x + h * 0.5, h - 12); g.fill(); g.beginPath(); g.moveTo(x, 12); g.lineTo(x + 14, 12); g.lineTo(x + 14 + 12, 0); g.lineTo(x + 12, 0); g.fill(); }
  g.font = `800 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KEEP SASH LOW', w / 2, h / 2 + 1);
});
asset('fume-hood', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), zc = -0.04;
    g.userData.surface = TOP;
    // base cabinet and worktop
    add(chamfer(1.82, 0.08, 0.66, 0.012), C('metal'), { y: 0.04, z: zc, outline: 0.01 });
    add(chamfer(1.9, 0.74, 0.8, 0.02), C('plastic'), { y: 0.45, z: zc });
    for (const x of [-0.475, 0.475]) {
      add(chamfer(0.9, 0.66, 0.03, 0.012), C('plastic'), { x, y: 0.48, z: zc + 0.41, outline: 0.01 });
      add(chamfer(0.3, 0.024, 0.03, 0.01), C('chrome'), { x, y: 0.72, z: zc + 0.435, outline: 0.006 });
    }
    add(slab(1.96, 0.88, 0.05, { r: 0.02, bev: 0.012 }), C('labTop'), { y: TOP - 0.025, z: zc });
    // the enclosure: sides, back baffle with slots, the top box with its light
    for (const sx of [-1, 1]) {
      add(chamfer(0.1, 1.1, 0.84, 0.02), C('plastic'), { x: sx * 0.93, y: TOP + 0.55, z: zc });
      add(chamfer(0.03, 1.02, 0.03, 0.01), C('chrome'), { x: sx * 0.865, y: TOP + 0.53, z: zc + 0.39, outline: 0.006 });
    }
    add(chamfer(1.78, 1.08, 0.04, 0.012), C('chrome'), { y: TOP + 0.55, z: zc - 0.39 });
    for (const y of [0.18, 0.62, 0.98]) add(chamfer(1.5, 0.03, 0.02, 0.008), C('labTop'), { y: TOP + y, z: zc - 0.36, outline: 0 });
    add(chamfer(1.96, 0.3, 0.86, 0.025), C('plastic'), { y: TOP + 1.25, z: zc });
    add(chamfer(1.6, 0.02, 0.5, 0.006), basic('palette.bulb'), { y: TOP + 1.095, z: zc - 0.05, outline: 0, cast: false });
    // the sash: a framed glass pane, half raised, with a yellow pull bar
    const sashY = TOP + 0.8;
    add(chamfer(1.72, 0.05, 0.05, 0.012), C('hazard'), { y: sashY - 0.3, z: zc + 0.42, outline: 0.008 });
    add(chamfer(1.72, 0.04, 0.05, 0.012), C('chrome'), { y: sashY + 0.3, z: zc + 0.42, outline: 0.008 });
    for (const sx of [-1, 1]) add(chamfer(0.04, 0.6, 0.05, 0.012), C('chrome'), { x: sx * 0.85, y: sashY, z: zc + 0.42, outline: 0.008 });
    card(g, 1.66, 0.56, GLASS(), { y: sashY, z: zc + 0.42 });
    // the caution strip on the top box, the airflow monitor with its green light
    card(g, 1.0, 0.12, painted(hoodSign), { x: -0.25, y: TOP + 1.25, z: zc + 0.431 });
    add(chamfer(0.18, 0.14, 0.03, 0.01), C('labTop'), { x: 0.7, y: TOP + 1.25, z: zc + 0.43, outline: 0.006 });
    add(ball(0.018, 8), basic('palette.ok'), { x: 0.66, y: TOP + 1.25, z: zc + 0.45, outline: 0 });
    add(chamfer(0.05, 0.03, 0.01, 0.004), C('sheet'), { x: 0.73, y: TOP + 1.25, z: zc + 0.447, outline: 0 });
    // the exhaust duct from the roof
    add(drum(0.16, 0.08, 16), C('chrome'), { x: 0.4, y: TOP + 1.44, z: zc - 0.1, outline: 0.008 });
    add(drum(0.12, 0.34, 16), C('chrome'), { x: 0.4, y: TOP + 1.63, z: zc - 0.1, outline: 0.01 });
    add(ring('hood-duct-band', 0.122, 0.012, 16, 6), C('metal'), { x: 0.4, y: TOP + 1.6, z: zc - 0.1, outline: 0 });
    // inside: a retort stand holding a flask over a hot plate, and a beaker
    add(chamfer(0.22, 0.02, 0.16, 0.006), C('metal'), { x: -0.35, y: TOP + 0.01, z: zc - 0.1, outline: 0.006 });
    add(drum(0.008, 0.5, 6), C('chrome'), { x: -0.43, y: TOP + 0.27, z: zc - 0.14, outline: 0.004 });
    strut(add, [-0.43, TOP + 0.3, zc - 0.14], [-0.33, TOP + 0.3, zc - 0.1], 0.006, C('chrome'), { outline: 0 });
    add(chamfer(0.18, 0.05, 0.16, 0.012), C('plastic'), { x: -0.3, y: TOP + 0.025, z: zc - 0.05, outline: 0.006 });
    add(drum(0.06, 0.008, 12), C('medical'), { x: -0.3, y: TOP + 0.054, z: zc - 0.05, outline: 0 });
    vessel(add, 'hood-flask', FLASK, [[0, 0.004], [0.055, 0.004], [0.04, 0.06], [0, 0.06]], -0.3, TOP + 0.058, zc - 0.05);
    vessel(add, 'hood-beaker', BEAKER, [[0, 0.006], [0.042, 0.006], [0.042, 0.07], [0, 0.07]], 0.3, TOP, zc + 0.05, 'hazard', { s: 1.2 });
  },
});

// ======================================================================= beaker set
asset('beaker-set', {
  category: 'prop', tiles: [0.5, 0.5],
  build(g) {
    const add = adder(g);
    // a white tray the glassware stands on
    add(slab(0.44, 0.34, 0.018, { r: 0.03, bev: 0.006 }), C('plastic'), { y: 0.009, z: 0.02, outline: 0.006 });
    const y0 = 0.018;
    vessel(add, 'set-flask', FLASK, [[0, 0.004], [0.057, 0.004], [0.034, 0.08], [0, 0.08]], -0.12, y0, 0.06, 'fluid', { s: 1.15 });
    vessel(add, 'set-beaker', BEAKER, [[0, 0.006], [0.042, 0.006], [0.042, 0.075], [0, 0.075]], 0.03, y0, 0.09, 'hazard');
    // a tall graduated cylinder, a round-bottom flask in a cork ring
    vessel(add, 'set-cylinder', [[0, 0], [0.04, 0], [0.04, 0.012], [0.018, 0.014], [0.02, 0.24], [0.026, 0.25], [0.016, 0.25], [0, 0.23]],
      [[0, 0.012], [0.016, 0.012], [0.016, 0.16], [0, 0.16]], 0.14, y0, -0.06, 'medical');
    add(ring('set-cork', 0.035, 0.012, 12, 6), C('cork'), { x: -0.04, y: y0 + 0.012, z: -0.07, outline: 0.004 });
    vessel(add, 'set-round', [[0, 0.004], [0.03, 0.01], [0.052, 0.04], [0.054, 0.065], [0.04, 0.1], [0.016, 0.115], [0.016, 0.17], [0.02, 0.174], [0, 0.174]],
      [[0, 0.006], [0.03, 0.012], [0.05, 0.04], [0.052, 0.06], [0, 0.06]], -0.04, y0 + 0.004, -0.07, 'fluid');
    // a dropper bottle and a wash bottle with its bent spout
    add(lathe('set-dropper', [[0, 0], [0.022, 0], [0.024, 0.05], [0.012, 0.06], [0, 0.06]], 10, { flat: true }), C('pot'), { x: 0.16, y: y0, z: 0.11, outline: 0.004 });
    add(lathe('set-teat', [[0, 0], [0.009, 0], [0.011, 0.02], [0.006, 0.035], [0, 0.036]], 8), C('rubber'), { x: 0.16, y: y0 + 0.06, z: 0.11, outline: 0.004 });
    add(lathe('set-wash', [[0, 0], [0.035, 0], [0.038, 0.012], [0.038, 0.1], [0.022, 0.12], [0.012, 0.13], [0, 0.13]], 12, { flat: true }), C('sheet'), { x: -0.17, y: y0, z: -0.08, outline: 0.005 });
    add(tube('set-wash-spout', [[-0.17, y0 + 0.13, -0.08], [-0.17, y0 + 0.17, -0.08], [-0.15, y0 + 0.18, -0.05], [-0.13, y0 + 0.16, -0.03]], 0.005, { seg: 8, radial: 5 }), C('fabric'), { outline: 0 });
  },
});

// ======================================================================= lab fridge
const fridgeReadout = liveTex('fridge-readout', 96, 40, (g, w, h, get) => {
  g.fillStyle = get('palette.ink'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.fluid'); g.font = `700 24px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('4.0°C', w / 2, h / 2 + 1);
});
const bioSign = liveTex('biohazard', 64, 64, (g, w, h, get) => {
  g.fillStyle = get('palette.hazard'); g.beginPath(); g.moveTo(w / 2, 3); g.lineTo(w - 3, h - 6); g.lineTo(3, h - 6); g.closePath(); g.fill();
  g.strokeStyle = get('palette.ink'); g.lineWidth = 3.5; g.stroke();
  g.fillStyle = get('palette.ink'); g.font = `900 30px ${FONT}`; g.textAlign = 'center'; g.fillText('!', w / 2, h - 13);
});
asset('lab-fridge', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), zc = -0.05, fz = zc + 0.34;
    add(chamfer(0.66, 0.08, 0.6, 0.012), C('metal'), { y: 0.04, z: zc, outline: 0.01 });
    // a hollow carcass (sides, back, top with the controls, a base), open behind the glass door
    for (const sx of [-1, 1]) add(chamfer(0.07, 1.74, 0.68, 0.025), C('plastic'), { x: sx * 0.345, y: 0.95, z: zc });
    add(chamfer(0.76, 1.74, 0.06, 0.02), C('plastic'), { y: 0.95, z: zc - 0.31, outline: 0.008 });
    add(chamfer(0.76, 0.3, 0.68, 0.03), C('plastic'), { y: 1.67, z: zc });
    add(chamfer(0.76, 0.1, 0.68, 0.02), C('plastic'), { y: 0.13, z: zc, outline: 0.008 });
    // the dark interior seen through the glass door: shelves of racked samples
    add(chamfer(0.62, 1.34, 0.02, 0.006), C('labTop'), { y: 0.86, z: zc - 0.27, outline: 0 });
    const cols = ['fluid', 'hazard', 'medical', 'glass'];
    const racks = Object.fromEntries(cols.map((c) => [c, []]));
    [0.34, 0.64, 0.94, 1.24].forEach((y, row) => {
      add(chamfer(0.6, 0.018, 0.1, 0.004), C('chrome'), { y, z: fz - 0.04, outline: 0 });
      for (let i = 0; i < 8; i++) {
        const c = cols[(i + row * 3) % 4];
        if ((i + row) % 5 === 4) continue;
        racks[c].push([chamfer(0.05, 0.1 + ((i * 7 + row) % 3) * 0.03, 0.05, 0.01), mat4(-0.25 + i * 0.07, y + 0.07, fz - 0.05)]);
      }
    });
    for (const c of cols) add(merged(`fridge-samples-${c}`, () => racks[c]), C(c), { outline: 0.004 });
    // the door frame, glass, handle; a temperature readout and a hazard sticker over it
    for (const sx of [-1, 1]) add(chamfer(0.06, 1.42, 0.04, 0.012), C('plastic'), { x: sx * 0.34, y: 0.86, z: fz + 0.01, outline: 0.008 });
    for (const y of [0.14, 1.58]) add(chamfer(0.74, 0.06, 0.04, 0.012), C('plastic'), { y, z: fz + 0.01, outline: 0.008 });
    card(g, 0.62, 1.38, clear('palette.glass', 0.14), { y: 0.86, z: fz + 0.02 });
    add(chamfer(0.03, 0.5, 0.04, 0.01), C('chrome'), { x: 0.3, y: 0.95, z: fz + 0.05, outline: 0.006 });
    add(chamfer(0.72, 0.18, 0.02, 0.01), C('labTop'), { y: 1.73, z: fz + 0.005, outline: 0.006 });
    card(g, 0.2, 0.08, painted(fridgeReadout, { unlit: true }), { x: -0.18, y: 1.73, z: fz + 0.016 });
    card(g, 0.12, 0.12, painted(bioSign, { transparent: true }), { x: 0.2, y: 1.73, z: fz + 0.016 });
  },
});

// ======================================================================= safety shower
const showerSign = liveTex('shower-sign', 128, 128, (g, w, h, get) => {
  g.fillStyle = get('palette.ok'); g.beginPath(); g.roundRect(0, 0, w, h, 12); g.fill();
  g.fillStyle = get('palette.sheet'); g.strokeStyle = get('palette.sheet'); g.lineCap = 'round';
  g.fillRect(36, 18, 56, 8); g.lineWidth = 3; // the rose and its drops
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(42 + i * 11, 32); g.lineTo(40 + i * 11, 44); g.stroke(); }
  g.beginPath(); g.arc(64, 60, 10, 0, Math.PI * 2); g.fill(); // a figure under it
  g.lineWidth = 12; g.beginPath(); g.moveTo(64, 74); g.lineTo(64, 100); g.stroke();
  g.lineWidth = 7; g.beginPath(); g.moveTo(64, 98); g.lineTo(54, 118); g.moveTo(64, 98); g.lineTo(74, 118); g.moveTo(58, 80); g.lineTo(44, 64); g.moveTo(70, 80); g.lineTo(84, 64); g.stroke();
});
asset('safety-shower', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), px = -0.3, pz = -0.3;
    // the floor plate and grated drain under the rose
    add(slab(0.6, 0.6, 0.02, { r: 0.04, bev: 0.006 }), C('metal'), { x: 0.05, y: 0.01, z: 0.05, outline: 0.006 });
    add(merged('shower-grate', () => Array.from({ length: 7 }, (_, i) => [chamfer(0.5, 0.01, 0.025, 0.004), mat4(0.05, 0.024, -0.16 + i * 0.07)])), C('chrome'), { outline: 0 });
    // the yellow column, the arm over, the rose
    add(drum(0.09, 0.03, 12), C('hazard'), { x: px, y: 0.035, z: pz, outline: 0.008 });
    add(drum(0.045, 2.16, 12), C('hazard'), { x: px, y: 1.1, z: pz, outline: 0.012 });
    add(tube('shower-arm', [[px, 2.12, pz], [px, 2.2, pz], [px + 0.06, 2.24, pz + 0.06], [0.05, 2.24, 0.05]], 0.04, { seg: 12, radial: 8 }), C('hazard'), { outline: 0.01 });
    add(drum(0.04, 0.08, 10), C('hazard'), { x: 0.05, y: 2.2, z: 0.05, outline: 0.006 });
    add(lathe('shower-rose', [[0, 0.07], [0.05, 0.07], [0.17, 0.0], [0.18, -0.015], [0.165, -0.03], [0, -0.03]], 16, { flat: true }), C('hazard'), { x: 0.05, y: 2.1, z: 0.05, outline: 0.01 });
    // the pull rod and its triangle handle
    add(drum(0.007, 0.6, 6), C('chrome'), { x: 0.2, y: 1.93, z: 0.05, outline: 0.004 });
    add(ring('shower-handle', 0.06, 0.009, 3, 5), C('hazard'), { x: 0.2, y: 1.58, z: 0.05, rx: Math.PI / 2, outline: 0.005 });
    // the eyewash bowl on its arm, two nozzles, the push paddle
    add(tube('eyewash-arm', [[px, 0.95, pz], [px + 0.08, 0.95, pz + 0.08], [0.02, 0.95, 0.06]], 0.022, { seg: 8, radial: 6 }), C('hazard'), { outline: 0.008 });
    add(lathe('eyewash-bowl', [[0, 0], [0.04, 0], [0.16, 0.08], [0.17, 0.1], [0.155, 0.1], [0.04, 0.02], [0, 0.02]], 16, { flat: true }), C('hazard'), { x: 0.06, y: 0.92, z: 0.1, outline: 0.008 });
    for (const sx of [-1, 1]) add(drum(0.018, 0.04, 8), C('ok'), { x: 0.06 + sx * 0.05, y: 0.96, z: 0.1, outline: 0.004 });
    add(chamfer(0.14, 0.1, 0.02, 0.008), C('ok'), { x: 0.06, y: 0.98, z: 0.27, rx: -0.4, outline: 0.006 });
    // the green sign on the column
    add(chamfer(0.3, 0.3, 0.02, 0.008), C('sheet'), { x: px, y: 1.55, z: pz + 0.05, outline: 0.006 });
    card(g, 0.27, 0.27, painted(showerSign), { x: px, y: 1.55, z: pz + 0.061 });
  },
});

corner('lab', 'lino', [
  ...wallRun([0.5, 1.5]),
  ['safety-shower', -2.3, -2.3, 0],
  ['fume-hood', -0.8, -2.3, 0],
  ['lab-bench', 1.2, -2.3, 0],
  ['microscope', 0.55, -2.15, -0.3, TOP],
  ['lab-fridge', -2.3, -1.0, Math.PI / 2],
  ['lab-bench', 0.6, 0.4, 0],
  ['beaker-set', 0.0, 0.5, 0.2, TOP],
  ['centrifuge', 0.95, 0.55, -0.4, TOP],
  ['plant-tall', 2.5, 2.4, 0],
]);
