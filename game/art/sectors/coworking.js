// sectors/coworking.js: the coworking pack. Light timber, sage acoustic felt (palette.felt) and a
// warm coral accent (palette.coral): a four-seat hot-desk pod with its stools, a glazed phone booth,
// a bean bag, a sit-stand desk (raised, userData.surface 1.04) and a coffee bar (0.98).
import { chamfer, slab, lathe, tube, drum, ball, leaf, merged, mat4, basic, clear, painted, liveTex } from '../shapes.js';
import { adder, card, C, G, HAND } from '../parts.js';
import { sectorAsset, corner, wallRun } from './common.js';
import { drawCodeScreen } from '../furniture.js';

const asset = sectorAsset('coworking');

// a laptop, open, facing +Z before turning (ry)
const laptopTex = liveTex('cowork-laptop', 160, 100, (g, w, h, get) => drawCodeScreen(g, w, h, get));
function laptop(add, g, x, y, z, ry) {
  const s = Math.sin(ry), c = Math.cos(ry);
  add(chamfer(0.32, 0.016, 0.22, 0.006), C('chrome'), { x, y: y + 0.008, z, ry, outline: 0.005 });
  const hx = x - s * 0.105, hz = z - c * 0.105; // the hinge line
  add(chamfer(0.32, 0.21, 0.012, 0.006), C('chrome'), { x: hx - s * 0.03, y: y + 0.11, z: hz - c * 0.03, ry, rx: -0.28, outline: 0.005 });
  card(g, 0.29, 0.18, painted(laptopTex, { unlit: true }), { x: hx - s * 0.024 + s * 0.0065, y: y + 0.112, z: hz - c * 0.024 + c * 0.0065, ry, rx: -0.28 }).rotation.order = 'YXZ';
}
function stool(add, x, z, colour) {
  add(lathe('cowork-stool-base', [[0, 0], [0.2, 0], [0.19, 0.02], [0.05, 0.035], [0, 0.036]], 12, { flat: true }), C('metal'), { x, z, outline: 0.006 });
  add(drum(0.025, 0.42, 8), C('chrome'), { x, y: 0.24, z, outline: 0.005 });
  add(drum(0.17, 0.06, 14, 0.022), C(colour), { x, y: 0.47, z });
}

// ======================================================================= hot-desk pod
asset('hot-desk-pod', {
  category: 'furniture', tiles: [2, 2],
  build(g) {
    const add = adder(g), TOP = 0.74;
    g.userData.surface = TOP;
    // a double bench: two grain tops, panel legs, a cable tray, felt screens along and across the middle
    for (const sz of [-1, 1]) add(slab(1.8, 0.66, 0.035, { r: 0.03, bev: 0.012 }), G('woodLight'), { y: TOP - 0.0175, z: sz * 0.34 });
    for (const x of [-0.86, 0.86]) add(chamfer(0.05, TOP - 0.035, 1.24, 0.015), C('plastic'), { x, y: (TOP - 0.035) / 2, outline: 0.01 });
    add(chamfer(1.6, 0.08, 0.2, 0.01), C('metal'), { y: TOP - 0.12, outline: 0.008 });
    add(slab(1.76, 0.05, 0.4, { r: 0.02, bev: 0.02, bs: 2 }), C('felt'), { y: TOP + 0.2 });
    for (const sz of [-1, 1]) add(slab(0.05, 0.62, 0.3, { r: 0.02, bev: 0.02, bs: 2 }), C('felt'), { y: TOP + 0.15, z: sz * 0.34 });
    add(chamfer(0.16, 0.04, 0.08, 0.012), C('metal'), { x: -0.3, y: TOP + 0.02, z: 0.07, outline: 0.005 });
    // who is here: two laptops, a notebook, a mug, a plant on the screen shelf
    laptop(add, g, -0.45, TOP, 0.34, Math.PI);
    laptop(add, g, 0.45, TOP, -0.34, 0);
    add(chamfer(0.16, 0.012, 0.22, 0.004), C('coral'), { x: 0.5, y: TOP + 0.006, z: 0.32, ry: 0.3, outline: 0.004 });
    add(lathe('cowork-mug', [[0, 0], [0.04, 0], [0.042, 0.09], [0.038, 0.09], [0.036, 0.07], [0, 0.07]], 12, { flat: true }), C('coral'), { x: -0.2, y: TOP, z: -0.3, outline: 0.005 });
    add(lathe('cowork-planter', [[0, 0], [0.06, 0], [0.07, 0.08], [0, 0.08]], 10, { flat: true }), C('plastic'), { x: 0.0, y: TOP + 0.225, outline: 0.005 });
    add(merged('cowork-succulent', () => Array.from({ length: 7 }, (_, i) => [leaf({ len: 0.08, wid: 0.04, droop: 0.2 }), mat4(0, 0.07, 0, -0.5 - (i % 2) * 0.4, i * 0.9, 0)])), C('leafLight'), { x: 0, y: TOP + 0.225, outline: 0.004 });
    // four stools, two a side
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) stool(add, sx * 0.45, sz * 0.8, sx * sz > 0 ? 'coral' : 'felt');
  },
});

// ======================================================================= phone booth
asset('phone-booth', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), H = 2.02, zc = -0.02;
    // the shell: plinth, back, sides, roof; felt lining inside
    add(chamfer(0.92, 0.08, 0.88, 0.015), C('metal'), { y: 0.04, z: zc, outline: 0.01 });
    add(chamfer(0.94, H, 0.07, 0.02), C('woodLight'), { y: H / 2 + 0.06, z: zc - 0.41 });
    for (const sx of [-1, 1]) add(chamfer(0.07, H, 0.88, 0.02), C('woodLight'), { x: sx * 0.44, y: H / 2 + 0.06, z: zc });
    add(slab(0.98, 0.94, 0.08, { r: 0.03, bev: 0.02 }), C('woodLight'), { y: H + 0.1, z: zc });
    add(chamfer(0.8, H - 0.1, 0.02, 0.006), C('felt'), { y: H / 2 + 0.06, z: zc - 0.37, outline: 0 });
    for (const sx of [-1, 1]) add(chamfer(0.02, H - 0.1, 0.76, 0.006), C('felt'), { x: sx * 0.4, y: H / 2 + 0.06, z: zc - 0.01, outline: 0 });
    add(merged('booth-felt-ribs', () => Array.from({ length: 6 }, (_, i) => [chamfer(0.05, H - 0.2, 0.02, 0.008), mat4(-0.3 + i * 0.12, H / 2 + 0.06, zc - 0.355)])), C('felt'), { outline: 0.004 });
    // inside: a shelf desk with a laptop, a coral stool, a pendant light
    add(slab(0.78, 0.3, 0.03, { r: 0.02, bev: 0.01 }), G('woodLight'), { y: 1.0, z: zc - 0.22 });
    laptop(add, g, 0, 1.015, zc - 0.2, 0);
    add(drum(0.14, 0.05, 12), C('coral'), { y: 0.62, z: zc + 0.05, outline: 0.006 });
    add(drum(0.022, 0.5, 8), C('chrome'), { y: 0.35, z: zc + 0.05, outline: 0 });
    add(drum(0.12, 0.02, 12), C('metal'), { y: 0.1, z: zc + 0.05, outline: 0 });
    add(drum(0.004, 0.3, 4), C('metal'), { y: H - 0.1, z: zc - 0.05, outline: 0 });
    add(lathe('booth-shade', [[0, 0.1], [0.03, 0.1], [0.1, 0.0], [0.09, -0.004], [0.028, 0.09], [0, 0.092]], 12, { flat: true }), C('coral'), { y: H - 0.35, z: zc - 0.05, outline: 0.005 });
    add(ball(0.03, 8), basic('palette.bulb'), { y: H - 0.35, z: zc - 0.05, outline: 0, cast: false });
    // the glass door: a slim frame, the glass, a long handle; an 'engaged' light over it
    const fz = zc + 0.42;
    for (const sx of [-1, 1]) add(chamfer(0.04, H - 0.04, 0.05, 0.012), C('metal'), { x: sx * 0.38, y: H / 2 + 0.06, z: fz, outline: 0.006 });
    for (const y of [0.1, H + 0.04]) add(chamfer(0.8, 0.04, 0.05, 0.012), C('metal'), { y, z: fz, outline: 0.006 });
    card(g, 0.72, H - 0.1, clear('palette.glass', 0.16), { y: H / 2 + 0.06, z: fz });
    add(chamfer(0.025, 0.6, 0.03, 0.01), C('chrome'), { x: 0.3, y: 1.05, z: fz + 0.04, outline: 0.004 });
    add(chamfer(0.9, 0.08, 0.02, 0.01), C('felt'), { y: H + 0.02, z: fz + 0.03, outline: 0.004 });
    add(ball(0.018, 8), basic('palette.ok'), { x: 0.34, y: H + 0.02, z: fz + 0.045, outline: 0 });
    add(drum(0.12, 0.02, 12), C('metal'), { y: H + 0.15, z: zc - 0.1, outline: 0.004 });
  },
});

// ======================================================================= bean bag
asset('bean-bag', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    g.userData.seat = 0.3;
    // the sack: a squashed base, a slumped back rising behind the seat hollow
    add(lathe('beanbag-base', [[0, 0], [0.3, 0], [0.4, 0.05], [0.44, 0.13], [0.42, 0.2], [0.32, 0.26], [0.16, 0.24], [0, 0.22]], 16), C('coral'), { z: 0.03, s: [1, 1, 0.94] });
    add(ball(0.3, 14), C('coral'), { y: 0.36, z: -0.2, s: [1.25, 1.02, 0.7], rx: -0.5 });
    add(ball(0.12, 8), C('coral'), { x: 0.3, y: 0.24, z: -0.1, s: [1, 0.8, 1.3], outline: 0.006 });
    // a seam round the base, a label, a felt throw over the side, a book left on the seat
    add(lathe('beanbag-seam', [[0.428, 0.12], [0.438, 0.14], [0.428, 0.16]], 16), C('felt'), { z: 0.03, s: [1, 1, 0.92], outline: 0 });
    add(chamfer(0.06, 0.04, 0.006, 0.002), C('sheet'), { x: 0.12, y: 0.12, z: 0.42, rx: -0.3, outline: 0 });
    add(slab(0.32, 0.26, 0.03, { r: 0.03, bev: 0.012, bs: 2 }), C('felt'), { x: -0.3, y: 0.22, z: 0.12, rz: 0.5, ry: 0.3 });
    add(chamfer(0.15, 0.03, 0.21, 0.008), C('fabric'), { x: 0.05, y: 0.265, z: 0.12, ry: 0.4, rx: 0.1, outline: 0.005 });
  },
});

// ======================================================================= standing desk
asset('standing-desk', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), TOP = 1.04;
    g.userData.surface = TOP;
    // two telescoping columns on T feet, the beam, the top
    for (const sx of [-1, 1]) {
      add(chamfer(0.08, 0.05, 0.7, 0.015), C('metal'), { x: sx * 0.66, y: 0.025, outline: 0.01 });
      add(chamfer(0.1, 0.5, 0.075, 0.015), C('metal'), { x: sx * 0.66, y: 0.3, outline: 0.008 });
      add(chamfer(0.08, 0.48, 0.06, 0.012), C('chrome'), { x: sx * 0.66, y: 0.76, outline: 0.008 });
    }
    add(chamfer(1.3, 0.06, 0.1, 0.015), C('metal'), { y: TOP - 0.08, outline: 0.008 });
    add(slab(1.6, 0.76, 0.035, { r: 0.04, bev: 0.012 }), G('woodLight'), { y: TOP - 0.0175 });
    // the height keypad with its readout
    add(chamfer(0.14, 0.035, 0.05, 0.01), C('metal'), { x: 0.6, y: TOP - 0.05, z: 0.38, outline: 0.004 });
    add(chamfer(0.05, 0.016, 0.004, 0.002), basic('palette.ok'), { x: 0.58, y: TOP - 0.05, z: 0.406, outline: 0 });
    // a laptop on a riser, a keyboard, a planter, a coffee cup
    add(chamfer(0.3, 0.012, 0.24, 0.004), C('chrome'), { x: -0.2, y: TOP + 0.1, z: -0.14, rx: 0.2, outline: 0.004 });
    for (const sx of [-1, 1]) add(chamfer(0.012, 0.1, 0.2, 0.004), C('chrome'), { x: -0.2 + sx * 0.13, y: TOP + 0.05, z: -0.14, outline: 0.004 });
    laptop(add, g, -0.2, TOP + 0.108, -0.14, 0);
    add(chamfer(0.36, 0.018, 0.12, 0.006), C('plastic'), { x: -0.2, y: TOP + 0.009, z: 0.18, outline: 0.004 });
    add(lathe('cowork-planter', [[0, 0], [0.06, 0], [0.07, 0.08], [0, 0.08]], 10, { flat: true }), C('coral'), { x: 0.55, y: TOP, z: -0.2, outline: 0.005 });
    add(merged('cowork-succulent', () => Array.from({ length: 7 }, (_, i) => [leaf({ len: 0.08, wid: 0.04, droop: 0.2 }), mat4(0, 0.07, 0, -0.5 - (i % 2) * 0.4, i * 0.9, 0)])), C('leafLight'), { x: 0.55, y: TOP, z: -0.2, outline: 0.004 });
    add(lathe('cowork-cup', [[0, 0], [0.032, 0], [0.04, 0.1], [0.035, 0.1], [0, 0.09]], 10, { flat: true }), C('sheet'), { x: 0.28, y: TOP, z: 0.12, outline: 0.004 });
    add(drum(0.041, 0.025, 10), C('coral'), { x: 0.28, y: TOP + 0.05, z: 0.12, outline: 0 });
    // an anti-fatigue mat on the floor in front
    add(slab(0.9, 0.46, 0.025, { r: 0.06, bev: 0.01 }), C('rubber'), { y: 0.0125, z: 0.22, outline: 0.005, cast: false });
  },
});

// ======================================================================= coffee bar
const menuTex = liveTex('coffee-menu', 160, 112, (g, w, h, get) => {
  g.fillStyle = get('palette.chalkboard'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.sheet'); g.font = `700 20px ${HAND}`; g.fillText('Coffee', 14, 28);
  g.font = `600 14px ${HAND}`; ['Flat white', 'Latte', 'Tea'].forEach((t, i) => { g.fillText(t, 14, 54 + i * 20); g.fillText(['£2.60', '£2.80', '£1.50'][i], 104, 54 + i * 20); });
});
asset('coffee-bar', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), TOP = 0.98, zc = -0.08;
    g.userData.surface = TOP;
    // the counter: coral body faced with timber slats, a grain top, a kick plinth
    add(chamfer(1.84, 0.08, 0.56, 0.012), C('metal'), { y: 0.04, z: zc, outline: 0.01 });
    add(chamfer(1.9, TOP - 0.1, 0.64, 0.02), C('coral'), { y: 0.08 + (TOP - 0.13) / 2, z: zc });
    add(merged('bar-slats', () => Array.from({ length: 12 }, (_, i) => [chamfer(0.1, TOP - 0.2, 0.03, 0.012), mat4(-0.825 + i * 0.15, (TOP - 0.2) / 2 + 0.1, 0)])), C('woodLight'), { z: zc + 0.33, outline: 0.006 });
    add(slab(1.98, 0.72, 0.05, { r: 0.03, bev: 0.015 }), G('woodLight'), { y: TOP - 0.025, z: zc });
    // the espresso machine: body, cups warming on top, two group heads with handles, drip tray, steam wand, gauge
    const ex = -0.4, ez = zc - 0.08;
    add(chamfer(0.56, 0.36, 0.38, 0.03), C('chrome'), { x: ex, y: TOP + 0.2, z: ez });
    add(chamfer(0.58, 0.04, 0.4, 0.012), C('coral'), { x: ex, y: TOP + 0.39, z: ez, outline: 0.006 });
    add(merged('warming-cups', () => [-0.15, 0, 0.15].map((dx) => [lathe('espresso-cup', [[0, 0], [0.03, 0], [0.036, 0.05], [0, 0.045]], 8, { flat: true }), mat4(dx, 0, 0, Math.PI)])), C('sheet'), { x: ex, y: TOP + 0.46, z: ez, outline: 0.004 });
    for (const sx of [-1, 1]) {
      add(drum(0.04, 0.05, 10), C('metal'), { x: ex + sx * 0.13, y: TOP + 0.12, z: ez + 0.21, outline: 0.004 });
      add(chamfer(0.03, 0.025, 0.14, 0.008), C('rubber'), { x: ex + sx * 0.13, y: TOP + 0.1, z: ez + 0.3, outline: 0.004 });
    }
    add(chamfer(0.48, 0.03, 0.14, 0.008), C('metal'), { x: ex, y: TOP + 0.015, z: ez + 0.22, outline: 0.004 });
    add(tube('steam-wand', [[ex + 0.26, TOP + 0.28, ez + 0.18], [ex + 0.3, TOP + 0.26, ez + 0.22], [ex + 0.3, TOP + 0.1, ez + 0.24]], 0.008, { seg: 6, radial: 5 }), C('chrome'), { outline: 0.004 });
    add(drum(0.045, 0.02, 12), C('sheet'), { x: ex, y: TOP + 0.28, z: ez + 0.19, rx: Math.PI / 2, outline: 0.004 });
    // the grinder with its bean hopper
    add(chamfer(0.14, 0.26, 0.18, 0.02), C('metal'), { x: 0.08, y: TOP + 0.13, z: ez });
    add(lathe('grinder-beans', [[0, 0], [0.04, 0], [0.07, 0.08], [0, 0.08]], 10), C('woodDark'), { x: 0.08, y: TOP + 0.26, z: ez, outline: 0 });
    add(lathe('grinder-hopper', [[0, 0], [0.045, 0], [0.085, 0.14], [0.08, 0.15], [0, 0.15]], 10), clear('palette.glass', 0.35), { x: 0.08, y: TOP + 0.26, z: ez, outline: 0.004, cast: false });
    // a stack of cups, a biscuit jar, the chalk menu
    add(merged('takeaway-cups', () => Array.from({ length: 4 }, (_, i) => [lathe('takeaway-cup', [[0, 0], [0.03, 0], [0.04, 0.1], [0, 0.1]], 10, { flat: true }), mat4(0, i * 0.025, 0)])), C('sheet'), { x: 0.36, y: TOP, z: zc - 0.02, outline: 0.004 });
    add(lathe('biscuit-jar', [[0, 0], [0.07, 0], [0.075, 0.16], [0.05, 0.18], [0, 0.18]], 12), clear('palette.glass', 0.35), { x: 0.62, y: TOP, z: zc + 0.05, outline: 0.004, cast: false });
    add(merged('biscuits', () => Array.from({ length: 5 }, (_, i) => [drum(0.035, 0.012, 8), mat4(Math.sin(i * 2) * 0.02, 0.01 + i * 0.022, Math.cos(i * 2) * 0.02, 0.3 * (i % 2), i, 0)])), C('cork'), { x: 0.62, y: TOP, z: zc + 0.05, outline: 0 });
    add(drum(0.06, 0.02, 12), C('coral'), { x: 0.62, y: TOP + 0.19, z: zc + 0.05, outline: 0.004 });
    add(chamfer(0.3, 0.22, 0.03, 0.01), C('woodDark'), { x: 0.85, y: TOP + 0.13, z: zc - 0.2, rx: -0.15, outline: 0.006 });
    card(g, 0.26, 0.18, painted(menuTex), { x: 0.85, y: TOP + 0.133, z: zc - 0.183, rx: -0.15 });
  },
});

corner('coworking', 'carpet', [
  ...wallRun([-0.5, 0.5]),
  ['phone-booth', -2.3, -2.3, 0],
  ['standing-desk', -0.6, -2.3, 0],
  ['coffee-bar', 1.8, -2.3, 0],
  ['mug', 0.95, -2.1, 0.4, 0.98],
  ['hot-desk-pod', 0.6, 0.4, 0],
  ['bean-bag', -2.2, 0.9, 0.5],
  ['bean-bag', -1.6, 2.3, -0.3],
  ['plant-tall', 2.4, 2.4, 0],
]);
