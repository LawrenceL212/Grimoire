// furniture.js: the office core pack (desks, seating, storage, plants, walls, doors, small props).
//
// Every asset is built from bevelled low-poly shapes (shapes.js) in two or three theme tones
// (palette.woodLight, woodDark, metal, chrome, fabric, fabricAlt, plastic, leaf, leafLight, pot,
// sheet, cork, glass, bulb, plaster, wall), is outlined, and stands on its own contact shadow.
// Static parts are marked for kit.bakeStatic(); moving or textured parts are not.
// Sizes follow the office scene: a desk top at 0.62, a chair seat at 0.45, walls 1.4 high
// (cut away so the camera sees in), a door 1.8.
//
// Extras beyond the registry contract:
//   make('monitor', { draw(ctx, w, h, get) })  draws the screen; obj.userData.screen = { canvas, texture, draw(fn) }
//   make('door').open(t)                      t = 0 closed .. 1 swung 100 degrees toward +Z; userData.leaf is the leaf
//   make('desk', { keyboard: false })         a bare desk (default: keyboard and mouse on the pad)
//   userData.surface (desk, coffee-table, reception-counter, filing-cabinet): the height things stand on
//   userData.seat (office-chair, sofa): the seat height
import * as THREE from 'three';
import { part } from '../engine/kit.js';
import { get as tget, onThemeChange } from '../engine/theme.js';
import {
  chamfer, taper, slab, plan, lathe, tube, leaf, merged, mat4, drum, ball,
  basic, clear, mapped, painted, liveTex, rng,
} from './shapes.js';
import { defineAsset, adder, strut, card, C, G, FONT, HAND } from './parts.js';

export const FURNITURE = [];
// Registers an asset whose build(g, opts) fills a group; the contact shadow is added last.
const asset = (id, def) => defineAsset(FURNITURE, id, def);

// ======================================================================= desk
const keysTex = liveTex('keyboard-keys', 256, 80, (g, w, h) => {
  g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, w, h);
  const rows = [14, 14, 13, 12], kw = w / 15.2;
  rows.forEach((n, r) => {
    let x = 3 + r * 4;
    for (let i = 0; i < n; i++) {
      const wide = (r === 3 && i === 5) ? 5 : 1;
      g.fillStyle = '#f2f2f2'; g.beginPath(); g.roundRect(x, 3 + r * 19, kw * wide - 3, 16, 3); g.fill();
      x += kw * wide;
    }
  });
});
asset('desk', {
  category: 'furniture', tiles: [2, 1],
  build(g, o) {
    const add = adder(g), TOP = 0.62;
    g.userData.surface = TOP;
    add(slab(1.8, 0.82, 0.05, { r: 0.05, bev: 0.016, cs: 3 }), G('woodLight'), { y: TOP - 0.025 });
    // drawer pedestal on the right, on a dark recessed plinth
    const px = 0.6;
    add(chamfer(0.42, 0.05, 0.64, 0.012), C('metal'), { x: px, y: 0.025, outline: 0.01 });
    add(chamfer(0.46, 0.53, 0.72, 0.02), C('woodDark'), { x: px, y: 0.31 });
    for (const [c, h] of [[0.49, 0.13], [0.32, 0.17], [0.135, 0.16]]) {
      add(chamfer(0.41, h, 0.026, 0.01), C('woodLight'), { x: px, y: c, z: 0.37, outline: 0.012 });
      add(chamfer(0.16, 0.022, 0.024, 0.008), C('chrome'), { x: px, y: c + h / 2 - 0.035, z: 0.393, outline: 0.008 });
    }
    // tapered legs on the left, a rail under the top, a modesty panel at the back
    for (const z of [-0.33, 0.33]) add(taper(0.045, 0.045, 0.07, 0.07, 0.57, 0.012), C('metal'), { x: -0.82, z, outline: 0.012 });
    add(chamfer(0.05, 0.05, 0.62, 0.012), C('metal'), { x: -0.82, y: 0.55, outline: 0.01 });
    add(chamfer(1.12, 0.3, 0.024, 0.008), C('woodDark'), { x: -0.23, y: 0.41, z: -0.34, outline: 0.012 });
    // the desk pad, a cable grommet and its cable
    add(slab(0.78, 0.36, 0.01, { r: 0.035, bev: 0.004 }), C('fabric'), { x: -0.18, y: TOP + 0.005, z: 0.14, outline: 0.008 });
    add(drum(0.035, 0.008, 12), C('metal'), { x: 0.36, y: TOP + 0.004, z: -0.3, outline: 0.006 });
    add(tube('desk-cable', [[0.36, TOP + 0.01, -0.3], [0.28, TOP + 0.008, -0.24], [0.1, TOP + 0.007, -0.27], [-0.15, TOP + 0.007, -0.22]], 0.007, { seg: 12, radial: 5 }), C('metal'), { outline: 0 });
    if (o.keyboard !== false) {
      add(chamfer(0.44, 0.022, 0.15, 0.008), C('metal'), { x: -0.22, y: TOP + 0.021, z: 0.17, outline: 0.008 });
      card(g, 0.42, 0.13, mapped('palette.plastic', keysTex), { x: -0.22, y: TOP + 0.0325, z: 0.17, rx: -Math.PI / 2 });
      add(chamfer(0.055, 0.026, 0.085, 0.022), C('plastic'), { x: 0.14, y: TOP + 0.023, z: 0.17, ry: -0.15, outline: 0.008 });
    }
  },
});

// ======================================================================= office chair
// the curved back: an arc band in plan (concave toward the sitter at +Z), extruded up
function arcBand(R, t, chord) {
  const A = Math.asin(chord / 2 / R);
  const s = new THREE.Shape();
  s.absarc(0, -R, R + t / 2, Math.PI / 2 + A, Math.PI / 2 - A, true);
  s.absarc(0, -R, R - t / 2, Math.PI / 2 - A, Math.PI / 2 + A, false);
  s.closePath();
  return s;
}
asset('office-chair', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    g.userData.seat = 0.49;
    // five-star base with twin castors
    add(drum(0.06, 0.07, 10), C('chrome'), { y: 0.1, outline: 0.01 });
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5, s = Math.sin(a), c = Math.cos(a);
      add(taper(0.05, 0.04, 0.034, 0.03, 0.25, 0.01), C('chrome'), { x: s * 0.04, y: 0.1, z: c * 0.04, rx: Math.PI / 2 + 0.12, ry: a, outline: 0.01 }).rotation.order = 'YXZ';
      add(chamfer(0.035, 0.05, 0.04, 0.01), C('metal'), { x: s * 0.285, y: 0.07, z: c * 0.285, ry: a, outline: 0.008 });
      add(drum(0.03, 0.036, 10), C('metal'), { x: s * 0.29, y: 0.03, z: c * 0.29, rz: Math.PI / 2, ry: a, outline: 0.008 }).rotation.order = 'YXZ';
    }
    // gas lift: dark sleeve, bright piston, the mechanism under the seat
    add(drum(0.04, 0.14, 12), C('metal'), { y: 0.2, outline: 0.01 });
    add(drum(0.024, 0.1, 10), C('chrome'), { y: 0.3, outline: 0.008 });
    add(chamfer(0.2, 0.05, 0.22, 0.015), C('metal'), { y: 0.36, outline: 0.01 });
    // seat: a shell and a plump cushion
    add(slab(0.5, 0.48, 0.03, { r: 0.1, bev: 0.01 }), C('metal'), { y: 0.395, outline: 0.012 });
    add(slab(0.5, 0.48, 0.1, { r: 0.13, bev: 0.04, bs: 2 }), C('fabric'), { y: 0.45 });
    // the spine and the curved back
    add(tube('chair-spine', [[0, 0.37, -0.12], [0, 0.4, -0.25], [0, 0.5, -0.3], [0, 0.62, -0.3]], 0.024, { seg: 10, radial: 6 }), C('metal'), { outline: 0.01 });
    add(plan('chair-back', arcBand(0.5, 0.085, 0.46), 0.46, { bev: 0.035, bs: 2, cs: 10 }), C('fabric'), { y: 0.8, z: -0.27, rx: -0.12 });
    // armrests
    for (const sx of [-1, 1]) {
      add(chamfer(0.07, 0.024, 0.06, 0.008), C('metal'), { x: sx * 0.235, y: 0.395, z: -0.03, outline: 0.008 });
      add(chamfer(0.034, 0.2, 0.05, 0.01), C('metal'), { x: sx * 0.265, y: 0.5, z: -0.03, outline: 0.01 });
      add(slab(0.075, 0.27, 0.035, { r: 0.03, bev: 0.012 }), C('metal'), { x: sx * 0.265, y: 0.612, z: -0.01, outline: 0.012 });
    }
  },
});

// ======================================================================= reception counter
const receptionSign = liveTex('reception-sign', 512, 112, (g, w, h, get) => {
  g.fillStyle = get('palette.woodDark'); g.fillRect(0, 0, w, h);
  g.strokeStyle = get('palette.gold'); g.lineWidth = 6; g.beginPath(); g.roundRect(8, 8, w - 16, h - 16, 12); g.stroke();
  g.fillStyle = get('palette.gold'); g.font = `700 60px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('Reception', w / 2, h / 2 + 3);
});
asset('reception-counter', {
  category: 'furniture', tiles: [3, 2],
  build(g) {
    const add = adder(g);
    g.userData.surface = 0.95;
    // the front and the left return: dark bodies on recessed plinths, faced with light slats
    add(chamfer(2.84, 0.08, 0.18, 0.012), C('metal'), { x: 0.03, y: 0.04, z: 0.66, outline: 0.01 });
    add(chamfer(0.18, 0.08, 1.46, 0.012), C('metal'), { x: -1.32, y: 0.04, z: -0.16, outline: 0.01 });
    add(chamfer(2.9, 0.86, 0.22, 0.02), C('woodDark'), { y: 0.47, z: 0.69 });
    add(chamfer(0.22, 0.86, 1.5, 0.02), C('woodDark'), { x: -1.34, y: 0.47, z: -0.17 });
    for (let i = 0; i < 14; i++) add(chamfer(0.17, 0.78, 0.05, 0.02), C('woodLight'), { x: -1.3 + i * 0.2, y: 0.49, z: 0.825, outline: 0.012 });
    for (let i = 0; i < 7; i++) add(chamfer(0.05, 0.78, 0.17, 0.02), C('woodLight'), { x: -1.475, y: 0.49, z: -0.8 + i * 0.2, outline: 0.012 });
    // the customer ledge (an L) and the lower staff desk behind it
    add(slab(2.98, 0.36, 0.05, { r: 0.04, bev: 0.015 }), G('woodLight'), { y: 0.925, z: 0.8 });
    add(slab(0.36, 1.58, 0.05, { r: 0.04, bev: 0.015 }), G('woodLight'), { x: -1.32, y: 0.925, z: -0.13 });
    add(slab(2.62, 0.5, 0.04, { r: 0.02, bev: 0.012 }), G('woodLight'), { x: 0.1, y: 0.72, z: 0.32 });
    add(slab(0.5, 1.0, 0.04, { r: 0.02, bev: 0.012 }), G('woodLight'), { x: -0.98, y: 0.72, z: -0.4 });
    add(chamfer(0.04, 0.68, 0.46, 0.01), C('woodDark'), { x: 1.38, y: 0.35, z: 0.33, outline: 0.012 });
    add(chamfer(0.46, 0.68, 0.04, 0.01), C('woodDark'), { x: -0.98, y: 0.35, z: -0.87, outline: 0.012 });
    // the sign on the front
    add(chamfer(0.76, 0.19, 0.025, 0.008), C('gold'), { x: 0.35, y: 0.62, z: 0.862, outline: 0.01 });
    card(g, 0.72, 0.155, painted(receptionSign), { x: 0.35, y: 0.62, z: 0.8755 });
    // the bell
    add(drum(0.065, 0.014, 14), C('woodDark'), { x: 0.95, y: 0.957, z: 0.82, outline: 0.008 });
    add(lathe('bell-dome', [[0, 0], [0.052, 0], [0.05, 0.014], [0.042, 0.032], [0.024, 0.046], [0, 0.05]], 14), C('gold'), { x: 0.95, y: 0.964, z: 0.82, outline: 0.008 });
    add(drum(0.006, 0.026, 6), C('chrome'), { x: 0.95, y: 1.024, z: 0.82, outline: 0 });
    add(ball(0.014, 8), C('chrome'), { x: 0.95, y: 1.04, z: 0.82, outline: 0.006 });
    // the visitors' book, open, with its pen
    add(chamfer(0.34, 0.012, 0.23, 0.004), C('fabricAlt'), { x: -0.45, y: 0.956, z: 0.8, ry: 0.08, outline: 0.008 });
    for (const s of [-1, 1]) add(chamfer(0.155, 0.01, 0.21, 0.003), C('sheet'), { x: -0.45 + s * 0.08, y: 0.965, z: 0.8 + s * 0.006, ry: 0.08, rz: -s * 0.06, outline: 0.006 });
    strut(add, [-0.3, 0.968, 0.74], [-0.22, 0.968, 0.86], 0.006, C('metal'), { outline: 0 });
  },
});

// ======================================================================= bookshelf
const BOOK_COLOURS = ['fabric', 'fabricAlt', 'gold', 'ok', 'plastic', 'woodLight'];
function bookshelfBooks() {
  const R = rng(1709);
  const bins = Object.fromEntries(BOOK_COLOURS.map((c) => [c, []]));
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const zf = -0.26 + 0.18 - 0.02; // front line of the books
  const put = (c, w, h, d, x, y, z, rz = 0, ry = 0) => bins[c].push([box(w, h, d), mat4(x, y, z, 0, ry, rz)]);
  const pick = () => BOOK_COLOURS[Math.floor(R() * BOOK_COLOURS.length)];
  const bands = [];
  const upright = (x0, x1, y0, hmax) => {
    let x = x0;
    for (;;) {
      const w = 0.03 + R() * 0.035;
      if (x + w > x1) break;
      const h = hmax * (0.62 + R() * 0.34), d = 0.2 + R() * 0.06, c = pick();
      put(c, w, h, d, x + w / 2, y0 + h / 2, zf - d / 2);
      if (R() < 0.3) bands.push([box(w + 0.002, 0.018, 0.004), mat4(x + w / 2, y0 + h * 0.78, zf + 0.002)]);
      x += w + 0.003;
    }
    return x;
  };
  const lying = (x, y0, n) => { let y = y0; for (let i = 0; i < n; i++) { const h = 0.03 + R() * 0.018, w = 0.2 + R() * 0.06, d = 0.2 + R() * 0.04; put(pick(), w, h, d, x, y + h / 2, zf - d / 2, 0, (R() - 0.5) * 0.25); y += h; } return y; };
  const shelves = [0.11, 0.52, 0.93, 1.34];
  // bottom: a full run of tall books
  upright(-0.74, 0.74, shelves[0], 0.36);
  // second: books, a lean, then a lying stack
  let x = upright(-0.74, 0.2, shelves[1], 0.34);
  put(pick(), 0.045, 0.3, 0.22, x + 0.07, shelves[1] + 0.145, zf - 0.11, -0.32);
  lying(0.52, shelves[1], 4);
  // third: a lying stack, then books, room for the globe
  lying(-0.58, shelves[2], 3);
  upright(-0.42, 0.3, shelves[2], 0.34);
  // top: books leaning left, a gap for the plant
  x = upright(-0.74, -0.05, shelves[3], 0.36);
  put(pick(), 0.04, 0.3, 0.22, x + 0.08, shelves[3] + 0.14, zf - 0.11, -0.36);
  return { bins, bands };
}
let booksCache = null;
asset('bookshelf', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), zc = -0.26, D = 0.36;
    for (const sx of [-1, 1]) add(chamfer(0.05, 1.78, D, 0.012), C('woodDark'), { x: sx * 0.785, y: 0.89, z: zc });
    add(slab(1.7, D + 0.05, 0.05, { r: 0.015, bev: 0.014 }), G('woodDark'), { y: 1.805, z: zc + 0.012 });
    add(chamfer(1.52, 0.09, D - 0.05, 0.01), C('metal'), { y: 0.045, z: zc - 0.01, outline: 0.01 });
    add(chamfer(1.52, 1.7, 0.02, 0.005), C('woodLight'), { y: 0.9, z: zc - D / 2 + 0.012, outline: 0.01 });
    for (const y of [0.095, 0.505, 0.915, 1.325]) add(chamfer(1.54, 0.03, D - 0.02, 0.008), C('woodLight'), { y, z: zc + 0.005, outline: 0.01 });
    booksCache ||= bookshelfBooks();
    for (const c of BOOK_COLOURS) if (booksCache.bins[c].length) add(merged(`books-${c}`, () => booksCache.bins[c]), C(c), { outline: 0.007 });
    add(merged('book-bands', () => booksCache.bands), C('gold'), { outline: 0 });
    // a globe on the third shelf, a little plant on the top one
    add(drum(0.05, 0.015, 10), C('woodDark'), { x: 0.52, y: 0.938, z: zc, outline: 0.008 });
    add(drum(0.008, 0.06, 6), C('gold'), { x: 0.52, y: 0.975, z: zc, outline: 0 });
    add(ball(0.09, 12), C('fabric'), { x: 0.52, y: 1.09, z: zc, outline: 0.01 });
    add(tube('globe-arc', Array.from({ length: 7 }, (_, i) => { const a = -Math.PI * 0.6 + i * Math.PI * 1.2 / 6; return [0.52 + Math.sin(a) * 0.1, 1.09 + Math.cos(a) * 0.1, zc]; }), 0.006, { seg: 12, radial: 4 }), C('gold'), { outline: 0 });
    add(lathe('shelf-pot', [[0, 0], [0.05, 0], [0.065, 0.1], [0.07, 0.11], [0, 0.11]], 10, { flat: true }), C('pot'), { x: 0.45, y: 1.34, z: zc, outline: 0.008 });
    add(merged('shelf-plant', () => Array.from({ length: 9 }, (_, i) => [leaf({ len: 0.14, wid: 0.06, droop: 0.5, fold: 0.4 }), mat4(0.45, 1.45, zc, -0.9 + (i % 3) * 0.25, i * 2.4, 0)])), C('leaf'), { outline: 0 });
  },
});

// ======================================================================= monitor
const liveScreens = new Set(); // WeakRefs to the screens that redraw when the palette changes
onThemeChange((p) => {
  if (p && !p.startsWith('palette.')) return;
  for (const ref of [...liveScreens]) { const s = ref.deref(); if (s) s.draw(s.last); else liveScreens.delete(ref); }
});
// the default screen: a code editor in theme colours
export function drawCodeScreen(g, w, h, get = tget) {
  g.fillStyle = get('palette.ink'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.metal'); g.fillRect(0, 0, w, 16);
  ['danger', 'gold', 'ok'].forEach((c, i) => { g.fillStyle = get(`palette.${c}`); g.beginPath(); g.arc(10 + i * 12, 8, 3.5, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = get('palette.paper'); g.fillRect(0, 16, 26, h - 16);
  const R = rng(5), cols = ['gold', 'text', 'ok', 'text', 'fabric', 'text'];
  let y = 24;
  for (let line = 0; y < h - 8; line++, y += 11) {
    g.fillStyle = get('palette.chrome'); g.globalAlpha = 0.5; g.fillRect(8, y + 2, 10, 4); g.globalAlpha = 1;
    let x = 34 + (line % 5 === 0 ? 0 : 12 * Math.floor(1 + R() * 2));
    const n = 1 + Math.floor(R() * 4);
    for (let t = 0; t < n; t++) {
      const len = 12 + R() * 46;
      g.fillStyle = get(`palette.${cols[Math.floor(R() * cols.length)]}`);
      g.beginPath(); g.roundRect(x, y, len, 6, 3); g.fill();
      x += len + 6;
      if (x > w - 20) break;
    }
  }
  g.fillStyle = get('palette.gold'); g.fillRect(34, y - 11, 3, 9); // the cursor
}
asset('monitor', {
  category: 'prop', tiles: [1, 0.5],
  build(g, o) {
    const add = adder(g);
    add(slab(0.28, 0.2, 0.018, { r: 0.08, bev: 0.006 }), C('metal'), { y: 0.009, z: -0.02, outline: 0.01 });
    add(taper(0.06, 0.03, 0.05, 0.025, 0.2, 0.008), C('metal'), { y: 0.015, z: -0.05, rx: 0.08, outline: 0.01 });
    add(chamfer(0.3, 0.2, 0.05, 0.02), C('metal'), { y: 0.35, z: -0.05, outline: 0.012 });
    add(slab(0.66, 0.4, 0.032, { r: 0.022, bev: 0.008 }), C('metal'), { y: 0.36, z: 0, rx: Math.PI / 2 });
    add(chamfer(0.66, 0.035, 0.034, 0.01), C('chrome'), { y: 0.177, z: 0.0, outline: 0.008 });
    add(ball(0.006, 6), basic('palette.ok'), { x: 0.28, y: 0.177, z: 0.018, outline: 0 });
    // the screen: its own canvas, drawn by opts.draw or the default code editor
    const W = 320, H = 184;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const screen = {
      canvas, texture, last: null,
      draw(fn) {
        const c = canvas.getContext('2d');
        c.save(); c.clearRect(0, 0, W, H); (fn || drawCodeScreen)(c, W, H, tget); c.restore();
        screen.last = fn || null;
        texture.needsUpdate = true;
        return screen;
      },
    };
    screen.draw(typeof o.draw === 'function' ? o.draw : null);
    liveScreens.add(new WeakRef(screen));
    card(g, 0.614, 0.353, new THREE.MeshBasicMaterial({ map: texture }), { y: 0.375, z: 0.0165 });
    g.userData.screen = screen;
  },
});

// ======================================================================= desk lamp
asset('desk-lamp', {
  category: 'prop', tiles: [0.5, 0.5],
  build(g) {
    const add = adder(g);
    const P0 = [0, 0.05, -0.08], P1 = [0, 0.31, -0.14], P2 = [0, 0.43, 0.05];
    add(lathe('lamp-base', [[0, 0], [0.085, 0], [0.09, 0.012], [0.082, 0.028], [0.03, 0.036], [0, 0.037]], 16, { flat: true }), C('metal'), { z: -0.08, outline: 0.01 });
    add(chamfer(0.04, 0.035, 0.04, 0.01), C('metal'), { x: 0, y: 0.045, z: -0.08, outline: 0.006 });
    for (const dx of [-0.013, 0.013]) {
      strut(add, [dx, P0[1], P0[2]], [dx, P1[1], P1[2]], 0.007, C('metal'));
      strut(add, [dx, P1[1], P1[2]], [dx, P2[1], P2[2]], 0.007, C('metal'));
    }
    strut(add, [0.026, 0.08, -0.09], [0.026, 0.27, -0.13], 0.006, C('gold'), { outline: 0 });
    strut(add, [0.026, 0.33, -0.1], [0.026, 0.41, 0.02], 0.006, C('gold'), { outline: 0 });
    add(ball(0.02, 8), C('gold'), { x: P1[0], y: P1[1], z: P1[2], outline: 0.006 });
    add(drum(0.017, 0.05, 10), C('metal'), { x: P1[0], y: P1[1], z: P1[2], rz: Math.PI / 2, outline: 0.006 });
    add(ball(0.018, 8), C('gold'), { x: P2[0], y: P2[1], z: P2[2], outline: 0.006 });
    // the shade (a turned shell) and its lit bulb, tipped forward and down
    const head = new THREE.Group(); head.position.set(...P2); head.rotation.x = -0.85; g.add(head);
    add(lathe('lamp-shade', [[0, 0.012], [0.02, 0.01], [0.032, -0.005], [0.04, -0.035], [0.058, -0.075], [0.09, -0.105], [0.104, -0.116], [0.1, -0.121], [0.084, -0.108], [0.052, -0.078], [0.034, -0.04], [0.026, -0.012], [0, -0.008]], 16, { flat: true }), C('fabricAlt'), { parent: head, outline: 0.012 });
    add(lathe('lamp-liner', [[0.095, -0.115], [0.08, -0.104], [0.05, -0.075], [0.033, -0.04], [0.024, -0.014], [0, -0.01]], 16), basic('palette.bulb', { double: true }), { parent: head, outline: 0, cast: false });
    add(ball(0.032, 10), basic('palette.bulb'), { parent: head, y: -0.062, outline: 0, cast: false });
    add(drum(0.022, 0.025, 10), C('metal'), { parent: head, y: 0.012, outline: 0.006 });
  },
});

// ======================================================================= filing cabinet
asset('filing-cabinet', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), zc = -0.1, front = zc + 0.3;
    g.userData.surface = 1.02;
    add(chamfer(0.46, 0.05, 0.56, 0.012), C('metal'), { y: 0.025, z: zc, outline: 0.01 });
    add(chamfer(0.5, 0.97, 0.6, 0.02), C('plastic'), { y: 0.535, z: zc });
    const rows = [0.21, 0.525, 0.84];
    rows.forEach((y, i) => {
      const open = i === 2 ? 0.2 : 0, z = front + 0.015 + open;
      add(chamfer(0.46, 0.29, 0.03, 0.012), C('plastic'), { y, z, outline: 0.012 });
      add(chamfer(0.2, 0.03, 0.03, 0.012), C('metal'), { y: y + 0.07, z: z + 0.025, outline: 0.008 });
      add(chamfer(0.11, 0.06, 0.01, 0.004), C('chrome'), { y: y - 0.05, z: z + 0.018, outline: 0.006 });
      add(chamfer(0.09, 0.042, 0.006, 0.002), C('sheet'), { y: y - 0.05, z: z + 0.024, outline: 0 });
    });
    // the open drawer: sides, and hanging files with coloured tabs
    for (const sx of [-1, 1]) add(chamfer(0.014, 0.22, 0.22, 0.004), C('plastic'), { x: sx * 0.212, y: 0.8, z: front + 0.1, outline: 0.008 });
    ['gold', 'fabric', 'ok', 'fabricAlt', 'gold'].forEach((c, i) => {
      const z = front - 0.02 + i * 0.045;
      add(chamfer(0.4, 0.2, 0.008, 0.003), C('cork'), { y: 0.8, z, rx: -0.08, outline: 0.006 });
      add(chamfer(0.07, 0.035, 0.009, 0.003), C(c), { x: [-0.12, 0.02, 0.13, -0.05, 0.09][i], y: 0.91, z, rx: -0.08, outline: 0.006 });
    });
    // an in-tray on top
    add(slab(0.32, 0.4, 0.035, { r: 0.02, bev: 0.008 }), C('metal'), { y: 1.035, z: zc, outline: 0.01 });
    add(chamfer(0.27, 0.01, 0.35, 0.003), C('sheet'), { y: 1.057, z: zc, ry: 0.06, outline: 0.006 });
    add(chamfer(0.27, 0.01, 0.35, 0.003), C('sheet'), { y: 1.067, z: zc + 0.01, ry: -0.08, outline: 0.006 });
  },
});

// ======================================================================= whiteboard
const whiteboardTex = liveTex('whiteboard', 512, 320, (g, w, h, get) => {
  g.fillStyle = get('palette.sheet'); g.fillRect(0, 0, w, h);
  const blue = get('palette.fabric'), red = get('palette.danger'), green = get('palette.ok'), dark = get('palette.metal');
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.fillStyle = blue; g.font = `700 34px ${HAND}`; g.fillText('Room plan', 24, 46);
  g.strokeStyle = blue; g.lineWidth = 3; g.beginPath(); g.moveTo(22, 56); g.quadraticCurveTo(110, 62, 196, 54); g.stroke();
  // three rooms and arrows between them
  g.strokeStyle = dark; g.lineWidth = 3.5;
  [[30, 90], [150, 90], [90, 190]].forEach(([x, y], i) => {
    g.beginPath(); g.roundRect(x, y, 90, 58, 8); g.stroke();
    g.fillStyle = dark; g.font = `700 24px ${HAND}`; g.fillText(`R${i + 1}`, x + 28, y + 38);
  });
  g.strokeStyle = green; g.lineWidth = 3;
  const arrow = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); const a = Math.atan2(y2 - y1, x2 - x1); g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 12 * Math.cos(a - 0.5), y2 - 12 * Math.sin(a - 0.5)); g.moveTo(x2, y2); g.lineTo(x2 - 12 * Math.cos(a + 0.5), y2 - 12 * Math.sin(a + 0.5)); g.stroke(); };
  arrow(122, 119, 148, 119); arrow(80, 150, 110, 186); arrow(190, 150, 165, 186);
  // a clash, circled in red
  g.strokeStyle = red; g.lineWidth = 4; g.beginPath(); g.ellipse(196, 118, 58, 38, -0.1, 0, Math.PI * 2); g.stroke();
  g.fillStyle = red; g.font = `700 30px ${HAND}`; g.fillText('!!', 256, 90);
  // a bar chart
  g.strokeStyle = dark; g.lineWidth = 3; g.beginPath(); g.moveTo(300, 60); g.lineTo(300, 180); g.lineTo(480, 180); g.stroke();
  [[60, blue], [95, blue], [40, red], [110, green], [75, blue]].forEach(([v, c], i) => { g.fillStyle = c; g.fillRect(316 + i * 32, 176 - v, 20, v); });
  // a to-do list with ticks
  g.fillStyle = dark; g.font = `600 20px ${HAND}`;
  ['check times', 'fix clash', 'email Bea'].forEach((s, i) => {
    g.fillText(s, 330, 226 + i * 30);
    g.strokeStyle = i < 2 ? green : dark; g.lineWidth = 3; g.beginPath();
    if (i < 2) { g.moveTo(304, 218 + i * 30); g.lineTo(311, 226 + i * 30); g.lineTo(324, 208 + i * 30); } else g.rect(304, 208 + i * 30, 16, 16);
    g.stroke();
  });
  // a smudge left by the eraser
  g.fillStyle = dark; g.globalAlpha = 0.06; g.beginPath(); g.ellipse(120, 280, 80, 18, 0.1, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
});
asset('whiteboard', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g);
    add(chamfer(1.56, 1.0, 0.04, 0.014), C('chrome'), { y: 1.22 });
    card(g, 1.5, 0.94, painted(whiteboardTex), { y: 1.22, z: 0.0205 });
    for (const sx of [-1, 1]) {
      add(chamfer(0.045, 1.66, 0.045, 0.012), C('metal'), { x: sx * 0.83, y: 0.9, outline: 0.012 });
      add(drum(0.032, 0.04, 10), C('chrome'), { x: sx * 0.8, y: 1.22, rz: Math.PI / 2, outline: 0.008 });
      add(chamfer(0.065, 0.045, 0.62, 0.014), C('metal'), { x: sx * 0.83, y: 0.08, outline: 0.012 });
      for (const sz of [-1, 1]) {
        add(chamfer(0.03, 0.03, 0.03, 0.008), C('metal'), { x: sx * 0.83, y: 0.05, z: sz * 0.27, outline: 0 });
        add(drum(0.032, 0.03, 10), C('metal'), { x: sx * 0.83, y: 0.032, z: sz * 0.27, rz: Math.PI / 2, outline: 0.008 });
      }
    }
    // the marker tray: three markers and the eraser
    add(chamfer(1.24, 0.02, 0.08, 0.006), C('chrome'), { y: 0.712, z: 0.045, outline: 0.008 });
    add(chamfer(1.24, 0.03, 0.012, 0.004), C('chrome'), { y: 0.725, z: 0.082, outline: 0 });
    ['danger', 'fabric', 'ok'].forEach((c, i) => {
      add(drum(0.011, 0.12, 8), C(c), { x: -0.45 + i * 0.07, y: 0.735, z: 0.05, rz: Math.PI / 2, ry: 0.1 * (i - 1), outline: 0.006 });
    });
    add(chamfer(0.13, 0.03, 0.05, 0.01), C('woodDark'), { x: 0.4, y: 0.742, z: 0.048, outline: 0.008 });
    add(chamfer(0.13, 0.012, 0.05, 0.004), C('metal'), { x: 0.4, y: 0.726, z: 0.048, outline: 0 });
  },
});

// ======================================================================= pinboard
// cork in greys (multiplied by palette.cork)
const corkTex = liveTex('cork-grain', 256, 160, (g, w, h) => {
  const R = rng(91);
  g.fillStyle = '#d0d0d0'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = 150 + Math.floor(R() * 105); g.fillStyle = `rgba(${v},${v},${v},0.8)`; g.fillRect(R() * w, R() * h, 1 + R() * 2.5, 1 + R() * 2); }
  for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(90,90,90,0.5)'; g.fillRect(R() * w, R() * h, 1.2, 1.2); }
});
asset('pinboard', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), cy = 1.12;
    add(chamfer(1.5, 0.96, 0.05, 0.016), C('woodLight'), { y: cy });
    card(g, 1.4, 0.86, mapped('palette.cork', corkTex), { y: cy, z: 0.0255 });
    for (const sx of [-1, 1]) {
      add(chamfer(0.05, 1.3, 0.05, 0.012), C('woodLight'), { x: sx * 0.7, y: 0.65, z: -0.05, outline: 0.012 });
      add(chamfer(0.07, 0.045, 0.52, 0.016), C('woodDark'), { x: sx * 0.7, y: 0.0225, z: -0.03, outline: 0.012 });
    }
    // notes, a photo, pins, and a red thread between three of them
    const notes = [[-0.5, 0.2, 'gold', 0.08], [-0.22, 0.24, 'sheet', -0.05], [0.12, 0.18, 'leafLight', 0.1], [0.46, 0.22, 'gold', -0.12], [-0.45, -0.16, 'fabricAlt', -0.08], [0.32, -0.18, 'sheet', 0.06], [-0.05, -0.2, 'glass', 0.12]];
    const pins = [];
    for (const [x, y, c, r] of notes) {
      add(chamfer(0.17, 0.17, 0.006, 0.002), C(c), { x, y: cy + y, z: 0.031, rz: r, outline: 0.005 });
      pins.push([x, cy + y + 0.06, 0.05]);
      add(ball(0.014, 8), C('danger'), { x, y: cy + y + 0.06, z: 0.045, outline: 0.004 });
    }
    add(chamfer(0.17, 0.2, 0.006, 0.002), C('sheet'), { x: 0.14, y: cy - 0.16, z: 0.031, rz: 0.05, outline: 0.005 });
    add(chamfer(0.14, 0.13, 0.004, 0.001), C('fabric'), { x: 0.14, y: cy - 0.145, z: 0.035, rz: 0.05, outline: 0 });
    add(ball(0.014, 8), C('gold'), { x: 0.14, y: cy - 0.07, z: 0.045, outline: 0.004 });
    const thread = [pins[1], pins[2], [0.14, cy - 0.07, 0.05], pins[4]];
    for (let i = 0; i < thread.length - 1; i++) strut(add, thread[i], thread[i + 1], 0.0035, C('danger'), { outline: 0, seg: 4 });
  },
});

// ======================================================================= plants
function rosette(key, n, { len, wid, r0 = 0.02, y, elev, droop = 0.2, fold = 0.5, seed = 1 }) {
  const R = rng(seed);
  return merged(key, () => Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996 + R() * 0.3, e = elev[0] + R() * (elev[1] - elev[0]), l = len * (0.8 + R() * 0.3);
    return [leaf({ len: Math.round(l * 100) / 100, wid, droop, fold, thick: 0.018 }), mat4(Math.sin(a) * r0, y, Math.cos(a) * r0, -e, a, 0)];
  }));
}
asset('plant-small', {
  category: 'prop', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    add(lathe('saucer', [[0, 0], [0.17, 0], [0.2, 0.026], [0.19, 0.03], [0, 0.02]], 14, { flat: true }), C('pot'), { outline: 0.01 });
    add(lathe('pot-small', [[0, 0.012], [0.12, 0.012], [0.13, 0.026], [0.155, 0.2], [0.176, 0.205], [0.18, 0.25], [0.166, 0.256], [0.157, 0.236], [0, 0.236]], 14, { flat: true }), C('pot'));
    add(drum(0.155, 0.012, 14), C('woodDark'), { y: 0.232, outline: 0 });
    add(rosette('aloe-outer', 9, { len: 0.27, wid: 0.075, y: 0.24, elev: [0.35, 0.6], droop: 0.35, seed: 3 }), C('leaf'), { outline: 0.008 });
    add(rosette('aloe-inner', 7, { len: 0.22, wid: 0.06, y: 0.245, elev: [0.85, 1.15], droop: 0.25, seed: 4 }), C('leafLight'), { outline: 0.008 });
    for (const [x, z] of [[0.09, 0.07], [-0.08, 0.1], [0.11, -0.05]]) add(ball(0.02, 6), C('sheet'), { x, y: 0.242, z, s: [1, 0.6, 1], outline: 0.004 });
  },
});
asset('plant-tall', {
  category: 'prop', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    add(lathe('pot-tall', [[0, 0.02], [0.14, 0.02], [0.155, 0.0], [0.18, 0.012], [0.2, 0.44], [0.218, 0.45], [0.22, 0.5], [0.205, 0.506], [0.196, 0.48], [0, 0.48]], 16, { flat: true }), C('plastic'));
    add(drum(0.212, 0.03, 16), C('gold'), { y: 0.39, outline: 0.006 });
    add(drum(0.196, 0.012, 14), C('woodDark'), { y: 0.478, outline: 0 });
    const stems = [
      [[0.02, 0.47, 0.01], [0.05, 0.8, 0.03], [0.02, 1.15, 0.06], [0.06, 1.55, 0.04]],
      [[-0.03, 0.47, 0.0], [-0.08, 0.8, -0.03], [-0.06, 1.1, -0.08], [-0.1, 1.35, -0.05]],
      [[0.0, 0.47, -0.03], [0.03, 0.75, -0.07], [0.08, 1.0, -0.05], [0.12, 1.18, -0.1]],
    ];
    stems.forEach((pts, i) => add(tube(`fig-stem-${i}`, pts, 0.013, { seg: 10, radial: 5 }), C('woodDark'), { outline: 0.006 }));
    const R = rng(12), dark = [], light = [];
    stems.forEach((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      for (let t = 0.45; t <= 1.001; t += 0.09) {
        const p = curve.getPoint(Math.min(1, t)), a = R() * Math.PI * 2, e = 0.15 + R() * 0.55 + (t > 0.95 ? 0.6 : 0);
        (R() < 0.45 ? light : dark).push([leaf({ len: 0.27, wid: 0.17, thick: 0.02, droop: 0.28, fold: 0.22 }), mat4(p.x, p.y, p.z, -e, a, 0)]);
      }
    });
    add(merged('fig-leaves-dark', () => dark), C('leaf'), { outline: 0.008 });
    add(merged('fig-leaves-light', () => light), C('leafLight'), { outline: 0.008 });
  },
});
asset('plant-hanging', {
  category: 'prop', tiles: [1, 1],
  build(g) {
    const add = adder(g), x0 = -0.26, hx = 0.12;
    // a shepherd's-hook stand
    add(lathe('hook-base', [[0, 0], [0.16, 0], [0.165, 0.012], [0.12, 0.03], [0.03, 0.042], [0, 0.042]], 14, { flat: true }), C('metal'), { x: x0 });
    add(drum(0.014, 1.95, 8), C('metal'), { x: x0, y: 1.0, outline: 0.01 });
    add(tube('hook-arm', [[x0, 1.95, 0], [x0 + 0.03, 2.06, 0], [x0 + 0.17, 2.1, 0], [hx + 0.02, 2.05, 0], [hx, 1.97, 0]], 0.012, { seg: 14, radial: 6 }), C('metal'), { outline: 0.01 });
    add(ball(0.02, 8), C('gold'), { x: x0, y: 1.975, outline: 0.006 });
    // the pot on three cords
    add(drum(0.022, 0.02, 10), C('gold'), { x: hx, y: 1.93, outline: 0.006 });
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.4; strut(add, [hx, 1.92, 0], [hx + Math.cos(a) * 0.125, 1.44, Math.sin(a) * 0.125], 0.004, C('cork'), { outline: 0, seg: 4 }); }
    add(lathe('pot-hanging', [[0, 0], [0.06, 0.004], [0.11, 0.05], [0.135, 0.12], [0.14, 0.145], [0.126, 0.148], [0, 0.13]], 14, { flat: true }), C('plastic'), { x: hx, y: 1.3 });
    add(rosette('pothos-crown', 10, { len: 0.12, wid: 0.09, r0: 0.05, y: 1.44, elev: [0.1, 0.7], droop: 0.35, fold: 0.3, seed: 8 }), C('leafLight'), { x: hx, outline: 0.006 });
    // trailing vines with small leaves along them
    const R = rng(21), vineLeaves = [];
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 + 0.3, ca = Math.cos(a), sa = Math.sin(a), end = 0.72 + R() * 0.38, out = 0.2 + R() * 0.06;
      const pts = [[hx + ca * 0.12, 1.43, sa * 0.12], [hx + ca * (out - 0.02), 1.38, sa * (out - 0.02)], [hx + ca * out, 1.18, sa * out], [hx + ca * (out - 0.04), (1.18 + end) / 2, sa * (out - 0.04)], [hx + ca * (out + 0.01), end, sa * (out + 0.01)]];
      add(tube(`pothos-vine-${i}`, pts, 0.005, { seg: 16, radial: 4 }), C('leaf'), { outline: 0 });
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
      for (let t = 0.2; t <= 1.0; t += 0.13) {
        const p = curve.getPoint(t);
        vineLeaves.push([leaf({ len: 0.085, wid: 0.075, droop: 0.2, fold: 0.3, thick: 0.012 }), mat4(p.x, p.y, p.z, 0.9 + R() * 0.5, a + (R() - 0.5) * 1.6, 0)]);
      }
    }
    add(merged('pothos-leaves', () => vineLeaves), C('leaf'), { outline: 0.006 });
  },
});

// ======================================================================= sofa
asset('sofa', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g);
    g.userData.seat = 0.37;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(taper(0.035, 0.035, 0.05, 0.05, 0.075, 0.01), C('woodDark'), { x: sx * 0.83, z: sz * 0.33, outline: 0.008 });
    add(slab(1.9, 0.84, 0.16, { r: 0.06, bev: 0.03 }), C('fabric'), { y: 0.15 });
    add(slab(1.74, 0.22, 0.38, { r: 0.06, bev: 0.05, bs: 2 }), C('fabric'), { y: 0.42, z: -0.31 });
    for (const sx of [-1, 1]) {
      add(slab(0.76, 0.62, 0.14, { r: 0.09, bev: 0.05, bs: 2 }), C('fabric'), { x: sx * 0.385, y: 0.3, z: 0.09 });
      add(slab(0.74, 0.17, 0.36, { r: 0.07, bev: 0.06, bs: 2 }), C('fabric'), { x: sx * 0.385, y: 0.52, z: -0.17, rx: -0.16 });
      add(slab(0.18, 0.84, 0.45, { r: 0.08, bev: 0.06, bs: 2 }), C('fabric'), { x: sx * 0.86, y: 0.295 });
      for (const bx of [-0.18, 0.18]) add(ball(0.013, 6), C('metal'), { x: sx * 0.385 + bx, y: 0.56, z: -0.08, outline: 0 });
    }
    // a throw pillow in the accent fabric
    add(slab(0.32, 0.32, 0.1, { r: 0.12, bev: 0.045, bs: 2 }), C('fabricAlt'), { x: -0.56, y: 0.5, z: -0.04, rx: -Math.PI / 2 - 0.35, rz: 0.25 });
  },
});

// ======================================================================= coffee table
asset('coffee-table', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), TOP = 0.42;
    g.userData.surface = TOP;
    add(slab(1.2, 0.62, 0.045, { r: 0.13, bev: 0.015, cs: 4 }), G('woodLight'), { y: TOP - 0.0225 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(taper(0.028, 0.028, 0.046, 0.046, 0.4, 0.008), C('woodDark'), { x: sx * 0.5, z: sz * 0.22, rz: sx * 0.12, rx: -sz * 0.1, outline: 0.01 });
    }
    add(slab(0.92, 0.36, 0.022, { r: 0.04, bev: 0.007 }), G('woodDark'), { y: 0.13, outline: 0.012 });
    // a bowl of fruit
    add(lathe('fruit-bowl', [[0, 0], [0.05, 0], [0.085, 0.03], [0.1, 0.055], [0.092, 0.058], [0.078, 0.036], [0, 0.03]], 14, { flat: true }), C('plastic'), { x: 0.3, y: TOP, z: -0.1, outline: 0.006 });
    [['gold', 0.02, 0.0], ['ok', -0.03, 0.02], ['fabricAlt', 0.0, -0.035], ['gold', -0.015, -0.005]].forEach(([c, dx, dz], i) => add(ball(0.032, 8), C(c), { x: 0.3 + dx, y: TOP + 0.06 + (i === 3 ? 0.03 : 0), z: -0.1 + dz, outline: 0.005 }));
    // magazines, a coaster with its mug ring, and two books on the shelf
    add(chamfer(0.22, 0.008, 0.3, 0.003), C('fabricAlt'), { x: -0.3, y: TOP + 0.004, z: 0.03, ry: 0.28, outline: 0.006 });
    add(chamfer(0.22, 0.008, 0.3, 0.003), C('sheet'), { x: -0.27, y: TOP + 0.012, z: 0.0, ry: -0.12, outline: 0.006 });
    add(chamfer(0.14, 0.004, 0.03, 0.001), C('gold'), { x: -0.27, y: TOP + 0.017, z: -0.09, ry: -0.12, outline: 0 });
    add(lathe('mug-ring', [[0.029, 0], [0.036, 0], [0.036, 0.0015], [0.029, 0.0015]], 18), C('woodDark'), { x: 0.3, y: TOP + 0.0005, z: 0.12, outline: 0 });
    add(chamfer(0.24, 0.035, 0.17, 0.006), C('fabric'), { x: 0.2, y: 0.159, ry: 0.1, outline: 0.006 });
    add(chamfer(0.22, 0.03, 0.15, 0.006), C('gold'), { x: 0.21, y: 0.19, ry: -0.08, outline: 0.006 });
  },
});

// ======================================================================= water cooler
asset('water-cooler', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    add(chamfer(0.34, 0.04, 0.34, 0.01), C('metal'), { y: 0.02, outline: 0.01 });
    add(chamfer(0.36, 0.92, 0.36, 0.035), C('plastic'), { y: 0.5 });
    add(chamfer(0.26, 0.27, 0.014, 0.005), C('metal'), { y: 0.62, z: 0.184, outline: 0.008 });
    [['fabricAlt', -0.065], ['fabric', 0.065]].forEach(([c, x]) => {
      add(chamfer(0.045, 0.05, 0.05, 0.014), C(c), { x, y: 0.71, z: 0.205, outline: 0.006 });
      add(drum(0.009, 0.03, 6), C('chrome'), { x, y: 0.672, z: 0.215, outline: 0 });
    });
    add(chamfer(0.22, 0.02, 0.08, 0.006), C('chrome'), { y: 0.505, z: 0.2, outline: 0.006 });
    add(drum(0.075, 0.04, 14), C('chrome'), { y: 0.975, outline: 0.008 });
    // the bottle (glass) with the water inside, and two ribs
    add(lathe('cooler-water', [[0, 1.0], [0.03, 1.0], [0.05, 1.04], [0.135, 1.085], [0.14, 1.12], [0.14, 1.3], [0, 1.3]], 16), C('glass'), { outline: 0 });
    add(lathe('cooler-bottle', [[0, 0.96], [0.036, 0.96], [0.036, 1.02], [0.06, 1.03], [0.14, 1.08], [0.15, 1.12], [0.15, 1.2], [0.144, 1.22], [0.15, 1.24], [0.15, 1.33], [0.13, 1.38], [0.08, 1.405], [0, 1.41]], 16), clear('palette.glass', 0.3), { outline: 0.01, cast: false });
    // a stack of paper cups on the side
    add(drum(0.036, 0.22, 10), C('chrome'), { x: 0.215, y: 0.63, z: 0.05, outline: 0.008 });
    add(lathe('paper-cup', [[0, 0], [0.02, 0], [0.03, 0.06], [0, 0.06]], 10, { flat: true }), C('sheet'), { x: 0.215, y: 0.46, z: 0.05, outline: 0.005 });
  },
});

// ======================================================================= vending machine
const vendTex = liveTex('vending-window', 256, 512, (g, w, h, get) => {
  g.fillStyle = get('palette.ink'); g.fillRect(0, 0, w, h);
  const R = rng(33), wares = ['fabricAlt', 'gold', 'ok', 'fabric', 'sheet', 'danger', 'leafLight'];
  for (let row = 0; row < 5; row++) {
    const y = 18 + row * 98;
    g.fillStyle = get('palette.chrome'); g.fillRect(8, y + 78, w - 16, 5);
    for (let i = 0; i < 4; i++) {
      const x = 16 + i * 60, c = get(`palette.${wares[Math.floor(R() * wares.length)]}`), can = R() < 0.5;
      g.fillStyle = c; g.beginPath();
      if (can) g.roundRect(x + 8, y + 20, 32, 58, 7); else g.roundRect(x + 2, y + 32, 46, 46, 5);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + (can ? 13 : 7), y + (can ? 26 : 38), 6, can ? 44 : 32);
      g.fillStyle = get('palette.sheet'); g.fillRect(x + 12, y + 86, 26, 8);
    }
  }
  const sheen = g.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0.10)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = sheen; g.fillRect(0, 0, w, h);
});
const vendPad = liveTex('vending-keypad', 64, 256, (g, w, h, get) => {
  g.fillStyle = get('palette.metal'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.ok'); g.fillRect(8, 10, 48, 22);
  g.fillStyle = get('palette.ink'); g.font = `700 14px ${FONT}`; g.fillText('B4', 20, 26);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { g.fillStyle = get('palette.sheet'); g.beginPath(); g.roundRect(8 + c * 17, 46 + r * 20, 13, 14, 3); g.fill(); }
  g.fillStyle = get('palette.chrome'); g.fillRect(24, 140, 16, 34); g.fillStyle = get('palette.ink'); g.fillRect(30, 146, 4, 22);
});
const vendHeader = liveTex('vending-header', 256, 48, (g, w, h, get) => {
  g.fillStyle = get('palette.ink'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.bulb'); g.font = `800 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SNACKS', w / 2, h / 2 + 2);
});
asset('vending-machine', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), zc = -0.12, fz = zc + 0.35;
    add(chamfer(0.8, 0.06, 0.62, 0.012), C('metal'), { y: 0.03, z: zc, outline: 0.01 });
    add(chamfer(0.86, 1.74, 0.7, 0.05), C('fabricAlt'), { y: 0.93, z: zc });
    add(slab(0.9, 0.74, 0.05, { r: 0.04, bev: 0.018 }), C('fabricAlt'), { y: 1.815, z: zc });
    add(chamfer(0.5, 0.012, 0.2, 0.004), C('metal'), { y: 1.843, z: zc - 0.12, outline: 0.006 });
    for (let i = 0; i < 5; i++) add(chamfer(0.44, 0.006, 0.014, 0.002), C('chrome'), { y: 1.85, z: zc - 0.19 + i * 0.035, outline: 0 });
    add(chamfer(0.58, 1.12, 0.03, 0.012), C('metal'), { x: -0.1, y: 1.08, z: fz, outline: 0.012 });
    card(g, 0.52, 1.06, painted(vendTex, { unlit: true }), { x: -0.1, y: 1.08, z: fz + 0.0155 });
    add(chamfer(0.18, 0.56, 0.02, 0.006), C('metal'), { x: 0.3, y: 1.2, z: fz, outline: 0.01 });
    card(g, 0.15, 0.52, painted(vendPad, { unlit: true }), { x: 0.3, y: 1.2, z: fz + 0.0105 });
    card(g, 0.76, 0.12, painted(vendHeader, { unlit: true }), { y: 1.72, z: fz + 0.001 });
    add(chamfer(0.54, 0.2, 0.03, 0.012), C('metal'), { x: -0.1, y: 0.3, z: fz, outline: 0.01 });
    add(chamfer(0.48, 0.13, 0.014, 0.005), C('chrome'), { x: -0.1, y: 0.3, z: fz + 0.018, rx: -0.12, outline: 0.006 });
    add(chamfer(0.12, 0.08, 0.03, 0.01), C('chrome'), { x: 0.3, y: 0.78, z: fz, outline: 0.006 });
  },
});

// ======================================================================= coat rack
asset('coat-rack', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    add(lathe('rack-base', [[0, 0], [0.2, 0], [0.21, 0.02], [0.16, 0.06], [0.06, 0.1], [0.04, 0.12], [0, 0.12]], 14, { flat: true }), C('woodDark'));
    add(lathe('rack-pole', [[0.036, 0.1], [0.03, 0.2], [0.025, 1.5], [0.034, 1.54], [0.025, 1.58], [0.022, 1.72], [0.036, 1.75], [0.02, 1.79], [0, 1.8]], 10), C('woodDark'));
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
      add(tube(`rack-hook-${i}`, [[c * 0.02, 1.6, s * 0.02], [c * 0.09, 1.59, s * 0.09], [c * 0.14, 1.63, s * 0.14], [c * 0.15, 1.69, s * 0.15]], 0.011, { seg: 10, radial: 5 }), C('woodDark'), { outline: 0.008 });
      add(ball(0.018, 8), C('gold'), { x: c * 0.15, y: 1.695, z: s * 0.15, outline: 0.005 });
    }
    // a coat on the front-right hook, a bag on the back-right, a scarf on the front-left, a hat on top
    const coat = new THREE.Group(); coat.position.set(0.13, 0, 0.13); coat.rotation.y = -Math.PI / 4; g.add(coat);
    add(lathe('coat-body', [[0, 0.78], [0.2, 0.78], [0.195, 0.83], [0.165, 1.25], [0.15, 1.44], [0.17, 1.5], [0.1, 1.6], [0, 1.61]], 12, { flat: true }), C('fabric'), { parent: coat, s: [1, 1, 0.6], outline: 0.012 });
    for (const sx of [-1, 1]) add(lathe('coat-sleeve', [[0, 0], [0.045, 0.012], [0.05, 0.42], [0.04, 0.48], [0, 0.49]], 8, { flat: true }), C('fabric'), { parent: coat, x: sx * 0.17, y: 1.0, z: 0.01, rz: -sx * 0.1, outline: 0.01 });
    add(chamfer(0.2, 0.05, 0.03, 0.012), C('fabricAlt'), { parent: coat, y: 1.55, z: 0.06, rx: 0.4, outline: 0.006 });
    for (const y of [1.36, 1.2, 1.04]) add(ball(0.012, 6), C('gold'), { parent: coat, y, z: 0.105, outline: 0 });
    const bag = new THREE.Group(); bag.position.set(0.12, 0, -0.12); bag.rotation.y = Math.PI / 4; g.add(bag);
    add(slab(0.24, 0.08, 0.26, { r: 0.03, bev: 0.02, bs: 2 }), C('cork'), { parent: bag, y: 1.32, outline: 0.01 });
    add(tube('bag-strap', [[-0.09, 1.44, 0], [-0.05, 1.62, 0], [0, 1.68, 0], [0.05, 1.62, 0], [0.09, 1.44, 0]], 0.01, { seg: 12, radial: 5 }), C('woodDark'), { parent: bag, outline: 0.006 });
    const hat = new THREE.Group(); hat.position.set(0, 1.795, 0); hat.rotation.set(0.12, 0, -0.1); g.add(hat);
    add(lathe('hat-brim', [[0, 0], [0.15, 0], [0.155, 0.012], [0.12, 0.018], [0, 0.018]], 16, { flat: true }), C('metal'), { parent: hat, outline: 0.01 });
    add(lathe('hat-crown', [[0, 0], [0.085, 0], [0.088, 0.09], [0.07, 0.12], [0, 0.12]], 14, { flat: true }), C('metal'), { parent: hat, outline: 0.01 });
    add(drum(0.089, 0.024, 14), C('fabricAlt'), { parent: hat, y: 0.03, outline: 0 });
    const sa = 3 * Math.PI / 4, ex = Math.cos(sa) * 0.15, ez = Math.sin(sa) * 0.15, tx = -Math.sin(sa) * 0.05, tz = Math.cos(sa) * 0.05;
    add(tube('scarf', [[ex + tx * 1.1, 1.2, ez + tz * 1.1], [ex + tx, 1.45, ez + tz], [ex + tx * 0.4, 1.66, ez + tz * 0.4], [ex - tx * 0.4, 1.66, ez - tz * 0.4], [ex - tx, 1.4, ez - tz], [ex - tx * 1.2, 1.1, ez - tz * 1.2]], 0.024, { seg: 20, radial: 6 }), C('gold'), { outline: 0.008 });
  },
});

// ======================================================================= door
asset('door', {
  category: 'structure', tiles: [1, 1],
  anims: { open: (o, s) => o.open(0.5 - 0.5 * Math.cos(s * 1.4)) },
  build(g) {
    const add = adder(g);
    for (const sx of [-1, 1]) {
      add(chamfer(0.08, 1.78, 0.26, 0.016), C('woodDark'), { x: sx * 0.46, y: 0.89 });
      for (const sz of [-1, 1]) add(chamfer(0.06, 1.8, 0.02, 0.008), C('woodDark'), { x: sx * 0.47, y: 0.9, z: sz * 0.136, outline: 0.01 });
    }
    add(chamfer(1.0, 0.1, 0.26, 0.016), C('woodDark'), { y: 1.76 });
    for (const sz of [-1, 1]) add(chamfer(1.0, 0.06, 0.02, 0.008), C('woodDark'), { y: 1.79, z: sz * 0.136, outline: 0.01 });
    add(chamfer(0.84, 0.014, 0.26, 0.005), C('metal'), { y: 0.007, outline: 0.006 });
    // the leaf turns about its hinge at x = -0.41
    const leafG = new THREE.Group(); leafG.name = 'door-leaf'; leafG.position.set(-0.41, 0, 0); g.add(leafG);
    // it moves, so it cannot be baked: its pieces are merged per material instead (a few draw calls)
    const L = (geo, mat, o) => part(geo, mat, { ...o, parent: leafG });
    L(chamfer(0.82, 1.68, 0.045, 0.014), C('woodLight'), { x: 0.41, y: 0.86, outline: 0.016 });
    L(merged('door-leaf-dark', () => [
      [chamfer(0.36, 0.52, 0.055, 0.014), mat4(0.41, 1.28, 0)],
      [chamfer(0.56, 0.58, 0.053, 0.03), mat4(0.41, 0.52, 0)],
    ]), C('woodDark'), { outline: 0.008 });
    L(merged('door-leaf-metal', () => [
      [chamfer(0.72, 0.12, 0.05, 0.004), mat4(0.41, 0.09, 0)],
      ...[0.3, 1.4].map((y) => [drum(0.013, 0.1, 8), mat4(0, y, 0.026)]),
      ...[-1, 1].flatMap((sz) => [
        [drum(0.028, 0.012, 12), mat4(0.74, 0.92, sz * 0.028, Math.PI / 2)],
        [chamfer(0.13, 0.02, 0.022, 0.008), mat4(0.69, 0.92, sz * 0.05)],
      ]),
    ]), C('chrome'), { outline: 0.006 });
    L(chamfer(0.16, 0.05, 0.059, 0.006), C('gold'), { x: 0.41, y: 1.6, outline: 0 });
    for (const sz of [-1, 1]) card(leafG, 0.3, 0.46, clear('palette.glass', 0.55), { x: 0.41, y: 1.28, z: sz * 0.0285, ry: sz < 0 ? Math.PI : 0 });
    g.userData.leaf = leafG;
    g.open = (t) => { leafG.rotation.y = -Math.max(0, Math.min(1, t)) * THREE.MathUtils.degToRad(100); };
    g.userData.open = g.open;
  },
});

// ======================================================================= walls
function wallBase(add, top) {
  add(chamfer(1.0, 0.08, 0.232, 0.01), C('woodDark'), { y: 0.04, outline: 0.01 });
  for (const sz of [-1, 1]) for (let i = 0; i < 4; i++) add(chamfer(0.245, 0.5, 0.016, 0.007), C('wall'), { x: -0.375 + i * 0.25, y: 0.33, z: sz * 0.106, outline: 0 });
  add(chamfer(1.0, 0.05, 0.26, 0.016), C('woodDark'), { y: top + 0.025 });
}
asset('wall-segment', {
  category: 'structure', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    add(chamfer(1.0, 0.54, 0.2, 0.01), C('wall'), { y: 0.3 });
    add(chamfer(1.0, 0.78, 0.2, 0.01), C('plaster'), { y: 0.97 });
    add(chamfer(1.0, 0.04, 0.24, 0.012), C('woodLight'), { y: 0.6, outline: 0.01 });
    wallBase(add, 1.36);
  },
});
asset('wall-window', {
  category: 'structure', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    add(chamfer(1.0, 0.54, 0.2, 0.01), C('wall'), { y: 0.3 });
    add(chamfer(1.0, 0.04, 0.28, 0.012), C('woodLight'), { y: 0.6, outline: 0.01 });
    for (const sx of [-1, 1]) add(chamfer(0.14, 0.6, 0.2, 0.01), C('plaster'), { x: sx * 0.43, y: 0.92 });
    add(chamfer(1.0, 0.14, 0.2, 0.01), C('plaster'), { y: 1.29 });
    for (const sx of [-1, 1]) add(chamfer(0.05, 0.6, 0.1, 0.012), C('plastic'), { x: sx * 0.335, y: 0.92, outline: 0.01 });
    for (const y of [0.645, 1.195]) add(chamfer(0.72, 0.05, 0.1, 0.012), C('plastic'), { y, outline: 0.01 });
    add(chamfer(0.03, 0.52, 0.06, 0.008), C('plastic'), { y: 0.92, outline: 0.006 });
    add(chamfer(0.62, 0.03, 0.06, 0.008), C('plastic'), { y: 0.97, outline: 0.006 });
    card(g, 0.62, 0.52, clear('palette.glass', 0.35), { y: 0.92 });
    wallBase(add, 1.36);
  },
});

// ======================================================================= rug
const rugTex = liveTex('rug', 512, 336, (g, w, h, get) => {
  const field = get('palette.fabricAlt'), border = get('palette.gold'), light = get('palette.sheet'), dark = get('palette.woodDark'), blue = get('palette.fabric');
  g.fillStyle = border; g.fillRect(0, 0, w, h);
  g.fillStyle = dark; g.fillRect(14, 14, w - 28, h - 28);
  // a zigzag in the border band
  g.strokeStyle = light; g.lineWidth = 3;
  const zig = (x0, y0, x1, y1, n) => { g.beginPath(); for (let i = 0; i <= n; i++) { const t = i / n; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; const o = (i % 2 ? 5 : -5); x0 === x1 ? g.lineTo(x + o, y) : g.lineTo(x, y + o); } g.stroke(); };
  zig(24, 24, w - 24, 24, 40); zig(24, h - 24, w - 24, h - 24, 40); zig(24, 24, 24, h - 24, 26); zig(w - 24, 24, w - 24, h - 24, 26);
  g.fillStyle = field; g.fillRect(36, 36, w - 72, h - 72);
  // a lattice of small diamonds, a big medallion in the middle
  g.fillStyle = dark; g.globalAlpha = 0.35;
  for (let y = 56; y < h - 40; y += 28) for (let x = 56 + ((y / 28) % 2) * 14; x < w - 40; x += 28) { g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.fill(); }
  g.globalAlpha = 1;
  const cx = w / 2, cy = h / 2;
  const diamond = (rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(cx, cy - ry); g.lineTo(cx + rx, cy); g.lineTo(cx, cy + ry); g.lineTo(cx - rx, cy); g.closePath(); g.fill(); };
  diamond(130, 96, border); diamond(116, 84, dark); diamond(96, 68, blue); diamond(60, 42, light); diamond(26, 18, field);
  for (const [x, y] of [[60, 60], [w - 60, 60], [60, h - 60], [w - 60, h - 60]]) { g.fillStyle = border; g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill(); g.fillStyle = light; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
});
function fringe(side) {
  return merged(`rug-fringe-${side}`, () => Array.from({ length: 22 }, (_, i) => [new THREE.BoxGeometry(0.075, 0.005, 0.02), mat4(side * 1.33, 0.004, -0.76 + i * (1.52 / 21), 0, side * (i % 3 - 1) * 0.08, 0)]));
}
asset('rug', {
  category: 'furniture', tiles: [3, 2],
  shadow: { opacity: 0.35 },
  build(g) {
    const add = adder(g);
    add(slab(2.6, 1.7, 0.018, { r: 0.06, bev: 0.006 }), C('gold'), { y: 0.009, outline: 0.008, cast: false });
    card(g, 2.54, 1.64, painted(rugTex), { y: 0.0185, rx: -Math.PI / 2 });
    for (const side of [-1, 1]) add(fringe(side), C('sheet'), { outline: 0, cast: false });
  },
});

// ======================================================================= crate stack
function crateParts() {
  const slats = [], frame = [];
  const S = (w, h, d, x, y, z, ry = 0) => slats.push([chamfer(w, h, d, 0.018), mat4(x, y, z, 0, ry, 0)]);
  for (const [px, pz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) frame.push([chamfer(0.12, 1.0, 0.12, 0.02), mat4(px * 0.44, 0.5, pz * 0.44)]);
  frame.push([chamfer(0.84, 0.9, 0.84, 0.02), mat4(0, 0.48, 0)]);
  for (const y of [0.18, 0.5, 0.82]) for (const s of [-1, 1]) { S(0.78, 0.22, 0.05, 0, y, s * 0.465); S(0.78, 0.22, 0.05, s * 0.465, y, 0, Math.PI / 2); }
  for (const x of [-0.33, -0.11, 0.11, 0.33]) S(0.2, 0.05, 1.0, x, 0.975, 0);
  return { slats, frame };
}
const crateStencil = liveTex('crate-stencil', 256, 96, (g, w, h, get) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = get('palette.woodDark'); g.globalAlpha = 0.85;
  g.font = `800 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FRAGILE', w / 2, h / 2 + 2);
  for (const x of [20, w - 20]) { g.beginPath(); g.moveTo(x, 20); g.lineTo(x + 12, 40); g.lineTo(x + 4, 40); g.lineTo(x + 4, 76); g.lineTo(x - 4, 76); g.lineTo(x - 4, 40); g.lineTo(x - 12, 40); g.fill(); }
});
let crateCache = null;
asset('crate-stack', {
  category: 'prop', tiles: [1, 1],
  build(g) {
    const add = adder(g);
    crateCache ||= crateParts();
    const slatGeo = merged('crate-slats', () => crateCache.slats), frameGeo = merged('crate-frame', () => crateCache.frame);
    for (const [x, y, z, ry, s] of [[-0.14, 0, -0.08, 0.12, 0.58], [-0.1, 0.58, -0.07, -0.35, 0.44]]) {
      const c = new THREE.Group(); c.position.set(x, y, z); c.rotation.y = ry; g.add(c);
      add(frameGeo, C('woodDark'), { parent: c, s, outline: 0.01 });
      add(slatGeo, C('woodLight'), { parent: c, s, outline: 0.012 });
      if (s > 0.5) card(c, 0.4, 0.15, painted(crateStencil, { transparent: true }), { y: 0.5 * s, z: 0.49 * s + 0.002 });
    }
    // a cardboard box, taped, with its label
    const b = new THREE.Group(); b.position.set(0.24, 0, 0.24); b.rotation.y = 0.3; g.add(b);
    add(chamfer(0.36, 0.28, 0.3, 0.015), C('cork'), { parent: b, y: 0.14 });
    add(chamfer(0.07, 0.006, 0.31, 0.002), C('plastic'), { parent: b, y: 0.282, outline: 0 });
    add(chamfer(0.07, 0.1, 0.006, 0.002), C('plastic'), { parent: b, y: 0.23, z: 0.151, outline: 0 });
    add(chamfer(0.12, 0.07, 0.004, 0.002), C('sheet'), { parent: b, x: -0.09, y: 0.12, z: 0.151, outline: 0 });
  },
});

// ======================================================================= mug
asset('mug', {
  category: 'prop', tiles: [0.25, 0.25],
  build(g) {
    const add = adder(g), x = -0.02;
    add(lathe('mug-body', [[0, 0], [0.04, 0], [0.044, 0.004], [0.046, 0.095], [0.043, 0.1], [0.04, 0.097], [0.039, 0.075], [0, 0.075]], 18, { flat: true }), C('plastic'), { x, outline: 0.006 });
    add(drum(0.039, 0.006, 16), C('woodDark'), { x, y: 0.082, outline: 0 });
    add(lathe('mug-band', [[0.0462, 0.03], [0.0476, 0.032], [0.0476, 0.05], [0.0462, 0.052]], 18), C('fabricAlt'), { x, outline: 0 });
    add(tube('mug-handle', [[0.044, 0.08, 0], [0.068, 0.078, 0], [0.078, 0.052, 0], [0.068, 0.026, 0], [0.044, 0.024, 0]], 0.0075, { seg: 10, radial: 6 }), C('plastic'), { x, outline: 0.005 });
    for (const [dx, ph] of [[-0.012, 0], [0.014, 1.7]]) {
      add(tube(`steam-${ph}`, Array.from({ length: 5 }, (_, i) => [dx + Math.sin(ph + i * 1.3) * 0.012, 0.1 + i * 0.03, Math.cos(ph + i) * 0.006]), 0.005, { seg: 12, radial: 4 }), clear('palette.sheet', 0.45), { x, outline: 0, cast: false, static: false });
    }
  },
});

// ======================================================================= paper stack
const printTex = liveTex('printed-page', 128, 180, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#4a4a4a'; g.fillRect(12, 12, 60, 8);
  const R = rng(17);
  for (let y = 30; y < h - 14; y += 9) g.fillStyle = '#9a9a9a', g.fillRect(12, y, (w - 24) * (y % 45 === 30 ? 0.5 : 0.7 + R() * 0.3), 3);
  g.strokeStyle = '#8a8a8a'; g.lineWidth = 1.5; g.strokeRect(70, 120, 44, 44);
});
asset('paper-stack', {
  category: 'prop', tiles: [0.5, 0.5],
  build(g) {
    const add = adder(g), R = rng(29), n = 9;
    const sheets = [];
    let top = 0;
    for (let i = 0; i < n; i++) { top = 0.004 + i * 0.0065; if (i !== 4) sheets.push([chamfer(0.28, 0.006, 0.39, 0.002), mat4((R() - 0.5) * 0.02, top, (R() - 0.5) * 0.02, 0, (R() - 0.5) * 0.08, 0)]); }
    add(merged('paper-sheets', () => sheets), C('sheet'), { outline: 0.006 });
    add(chamfer(0.28, 0.006, 0.39, 0.002), C('gold'), { x: 0.012, y: 0.004 + 4 * 0.0065, z: -0.008, ry: 0.07, outline: 0.004 });
    card(g, 0.26, 0.37, mapped('palette.sheet', printTex), { y: top + 0.0035, rx: -Math.PI / 2, rz: 0.02 });
    // a binder clip, a sticky note, a pen
    add(chamfer(0.07, 0.022, 0.03, 0.008), C('metal'), { y: top + 0.004, z: -0.185, outline: 0.005 });
    add(tube('clip-wire', [[-0.025, top + 0.014, -0.18], [-0.02, top + 0.03, -0.215], [0.02, top + 0.03, -0.215], [0.025, top + 0.014, -0.18]], 0.0025, { seg: 8, radial: 4 }), C('chrome'), { outline: 0 });
    add(chamfer(0.075, 0.003, 0.075, 0.001), C('gold'), { x: 0.08, y: top + 0.006, z: 0.11, ry: 0.25, outline: 0.004 });
    add(drum(0.0065, 0.15, 8), C('fabric'), { x: -0.02, y: top + 0.012, z: 0.05, rz: Math.PI / 2, ry: 0.6, outline: 0.004 }).rotation.order = 'YXZ';
    add(drum(0.0072, 0.04, 8), C('chrome'), { x: 0.035, y: top + 0.012, z: 0.012, rz: Math.PI / 2, ry: 0.6, outline: 0 }).rotation.order = 'YXZ';
  },
});
