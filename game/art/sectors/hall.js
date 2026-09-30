// sectors/hall.js: the hall pack (a community or school hall). A timber stage with velvet curtains
// (palette.velvet) and footlights, rows of folding chairs facing it (-Z), a lectern that stands on
// the stage (userData.surface 0.47), and a village-hall notice board.
import { chamfer, taper, slab, lathe, tube, drum, ball, merged, mat4, basic, clear, painted, liveTex } from '../shapes.js';
import { adder, seat, card, C, G, FONT, HAND } from '../parts.js';
import { sectorAsset, corner, wallRun, pleats } from './common.js';

const asset = sectorAsset('hall');
const STAGE = 0.47;

// ======================================================================= stage
asset('stage', {
  category: 'furniture', tiles: [3, 2],
  build(g) {
    const add = adder(g);
    g.userData.surface = STAGE;
    // the platform: a dark apron, a grain top with a gold nosing, steps down at the front right
    add(chamfer(2.96, STAGE - 0.04, 1.4, 0.02), C('woodDark'), { y: (STAGE - 0.04) / 2, z: -0.28 });
    add(merged('stage-apron', () => Array.from({ length: 6 }, (_, i) => [chamfer(0.42, 0.3, 0.02, 0.01), mat4(-1.2 + i * 0.48, 0.2, 0.43)])), C('woodLight'), { outline: 0.008 });
    add(slab(3.0, 1.46, 0.04, { r: 0.02, bev: 0.012 }), G('woodLight'), { y: STAGE - 0.02, z: -0.26 });
    add(chamfer(3.0, 0.03, 0.04, 0.01), C('gold'), { y: STAGE - 0.03, z: 0.46, outline: 0.006 });
    [[0.3, 0.64], [0.15, 0.82]].forEach(([h, z], i) => {
      add(chamfer(0.66, h, 0.2 + i * 0.16, 0.012), C('woodDark'), { x: 1.02, y: h / 2, z: z - 0.08 * i });
      add(slab(0.7, 0.2, 0.03, { r: 0.015, bev: 0.008 }), C('woodLight'), { x: 1.02, y: h + 0.015, z, outline: 0.008 });
    });
    // the proscenium posts and the pelmet across the top, with a gold fringe
    for (const sx of [-1, 1]) add(chamfer(0.12, 1.72, 0.14, 0.02), C('woodDark'), { x: sx * 1.44, y: STAGE + 0.86, z: 0.36 });
    add(pleats('stage-pelmet', 2.8, 0.34, { folds: 9, depth: 0.03, t: 0.03, bev: 0 }), C('velvet'), { y: STAGE + 1.52, z: 0.38 });
    add(chamfer(2.8, 0.05, 0.1, 0.012), C('gold'), { y: STAGE + 1.33, z: 0.38, outline: 0.006 });
    add(chamfer(3.0, 0.06, 0.2, 0.015), C('woodDark'), { y: STAGE + 1.72, z: 0.36, outline: 0.01 });
    // the back curtain and the two front curtains drawn aside, tied back in gold
    add(pleats('stage-back', 2.84, 1.6, { folds: 8, depth: 0.05, t: 0.03, bev: 0 }), C('velvet'), { y: STAGE + 0.8, z: -0.9 });
    for (const sx of [-1, 1]) {
      add(pleats('stage-side', 0.42, 1.34, { folds: 3, depth: 0.05, t: 0.03, bev: 0 }), C('velvet'), { x: sx * 1.18, y: STAGE + 0.67, z: 0.3 });
      add(drum(0.2, 0.05, 8), C('gold'), { x: sx * 1.2, y: STAGE + 0.6, z: 0.3, s: [1.2, 1, 0.5], outline: 0.005 });
    }
    // footlights along the front edge
    add(chamfer(1.9, 0.06, 0.08, 0.02), C('metal'), { y: STAGE + 0.03, z: 0.38, outline: 0.006 });
    add(merged('footlight-bulbs', () => Array.from({ length: 5 }, (_, i) => [ball(0.025, 6), mat4(-0.96 + i * 0.4, STAGE + 0.03, 0.42)])), basic('palette.bulb'), { outline: 0, cast: false });
  },
});

// ======================================================================= folding chair row
function chairRow() {
  const frame = [], seats = [], feet = [];
  const xs = [-1.11, -0.37, 0.37, 1.11];
  for (const cx of xs) {
    for (const sx of [-1, 1]) {
      const x = cx + sx * 0.19;
      frame.push([chamfer(0.026, 0.94, 0.026, 0.008), mat4(x, 0.47, 0.13, -0.1)]); // back legs up to the backrest
      frame.push([chamfer(0.026, 0.5, 0.026, 0.008), mat4(x, 0.24, -0.1, 0.25)]); // front legs, splayed
      frame.push([chamfer(0.026, 0.026, 0.4, 0.008), mat4(x, 0.44, 0.0)]); // seat rail
      feet.push([chamfer(0.04, 0.02, 0.05, 0.006), mat4(x, 0.01, 0.18)]);
    }
    frame.push([chamfer(0.4, 0.024, 0.024, 0.008), mat4(cx, 0.12, 0.06)]);
    seats.push([slab(0.42, 0.4, 0.05, { r: 0.05, bev: 0.018, cs: 2 }), mat4(cx, 0.47, -0.01)]);
    seats.push([slab(0.42, 0.2, 0.04, { r: 0.04, bev: 0.015, cs: 2 }), mat4(cx, 0.82, 0.17, Math.PI / 2 + 0.1)]);
  }
  // the gang clips that hold the row together
  for (const x of [-0.74, 0, 0.74]) frame.push([chamfer(0.36, 0.03, 0.03, 0.008), mat4(x, 0.44, -0.18)]);
  return { frame, seats, feet };
}
let rowCache = null;
const programmeTex = liveTex('hall-programme', 96, 128, (g, w, h, get) => {
  g.fillStyle = get('palette.velvet'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.gold'); g.font = `700 16px ${FONT}`; g.textAlign = 'center'; g.fillText('Spring', w / 2, 38); g.fillText('Concert', w / 2, 58);
  g.strokeStyle = get('palette.gold'); g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
});
asset('folding-chair-row', {
  category: 'furniture', tiles: [3, 1],
  build(g) {
    const add = adder(g);
    for (const cx of [-1.11, -0.37, 0.37, 1.11]) seat(g, cx, 0.495, -0.02, Math.PI);
    rowCache ||= chairRow();
    add(merged('chair-row-frame', () => rowCache.frame), C('chrome'), { outline: 0.006 });
    add(merged('chair-row-seats', () => rowCache.seats), C('fabric'), { outline: 0.008 });
    add(merged('chair-row-feet', () => rowCache.feet), C('rubber'), { outline: 0 });
    // a programme left on one seat, a coat over the back of another
    add(chamfer(0.14, 0.006, 0.19, 0.002), C('velvet'), { x: -0.37, y: 0.5, z: -0.02, ry: 0.3, outline: 0.004 });
    card(g, 0.13, 0.18, painted(programmeTex), { x: -0.37, y: 0.504, z: -0.02, rx: -Math.PI / 2, rz: 0.3 });
    add(slab(0.4, 0.1, 0.34, { r: 0.04, bev: 0.03, bs: 2 }), C('fabricAlt'), { x: 1.11, y: 0.75, z: 0.23, rx: 0.12 });
    add(slab(0.38, 0.16, 0.05, { r: 0.05, bev: 0.02, bs: 2 }), C('fabricAlt'), { x: 1.11, y: 0.93, z: 0.18, rx: 0.3 });
  },
});

// ======================================================================= podium (lectern)
const crestTex = liveTex('podium-crest', 128, 128, (g, w, h, get) => {
  g.clearRect(0, 0, w, h);
  g.fillStyle = get('palette.gold'); g.beginPath(); g.arc(64, 64, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = get('palette.velvet'); g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.fill();
  g.fillStyle = get('palette.gold');
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 14 : 32; g.lineTo(64 + Math.cos(a) * r, 60 + Math.sin(a) * r); } g.closePath(); g.fill();
  g.font = `800 15px ${FONT}`; g.textAlign = 'center'; g.fillText('EST 1924', 64, 106);
});
asset('podium', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), H = 1.06;
    add(chamfer(0.7, 0.06, 0.56, 0.015), C('woodDark'), { y: 0.03, outline: 0.01 });
    add(taper(0.52, 0.4, 0.62, 0.46, H - 0.1, 0.03), C('woodDark'), { y: 0.06 });
    add(taper(0.4, 0.02, 0.48, 0.02, H - 0.3, 0.005), C('woodLight'), { y: 0.16, z: 0.21, rx: -0.05, outline: 0.008 });
    add(drum(0.13, 0.02, 20), C('gold'), { y: 0.66, z: 0.235, rx: Math.PI / 2 - 0.05, outline: 0.005 });
    card(g, 0.24, 0.24, painted(crestTex, { transparent: true }), { y: 0.66, z: 0.247, rx: -0.05 });
    // the sloping top, the notes on it, a lip to hold them
    add(slab(0.7, 0.54, 0.05, { r: 0.03, bev: 0.015 }), G('woodLight'), { y: H, z: 0, rx: -0.22 });
    add(chamfer(0.6, 0.03, 0.02, 0.008), C('woodDark'), { y: H - 0.02, z: -0.26, outline: 0.005 });
    add(chamfer(0.21, 0.006, 0.29, 0.002), C('sheet'), { x: -0.06, y: H + 0.03, z: 0.0, rx: -0.22, ry: 0.06, outline: 0.004 });
    add(chamfer(0.21, 0.006, 0.29, 0.002), C('sheet'), { x: 0.08, y: H + 0.036, z: -0.01, rx: -0.22, ry: -0.08, outline: 0.004 });
    // the gooseneck microphone and a glass of water
    add(drum(0.03, 0.03, 10), C('metal'), { x: 0.22, y: H + 0.07, z: 0.14, outline: 0.004 });
    add(tube('mic-neck', [[0.22, H + 0.08, 0.14], [0.22, H + 0.2, 0.12], [0.18, H + 0.3, 0.02], [0.12, H + 0.32, -0.06]], 0.008, { seg: 12, radial: 5 }), C('metal'), { outline: 0.004 });
    add(lathe('mic-head', [[0, 0], [0.018, 0.004], [0.022, 0.05], [0.014, 0.07], [0, 0.072]], 10), C('rubber'), { x: 0.12, y: H + 0.32, z: -0.06, rx: -1.9, outline: 0.004 });
    add(lathe('water-glass', [[0, 0], [0.03, 0], [0.034, 0.1], [0, 0.1]], 12), clear('palette.glass', 0.35), { x: -0.26, y: H + 0.085, z: 0.2, outline: 0.004, cast: false });
    add(lathe('water-glass-water', [[0, 0.004], [0.028, 0.004], [0.031, 0.07], [0, 0.07]], 12), C('glass'), { x: -0.26, y: H + 0.085, z: 0.2, outline: 0 });
  },
});

// ======================================================================= notice board
function poster(key, title, band, draw) {
  return liveTex(key, 128, 168, (g, w, h, get) => {
    g.fillStyle = get('palette.sheet'); g.fillRect(0, 0, w, h);
    g.fillStyle = get(`palette.${band}`); g.fillRect(0, 0, w, 40);
    g.fillStyle = get('palette.sheet'); g.font = `800 17px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, w / 2, 21);
    g.textAlign = 'left'; draw(g, w, h, get);
  });
}
const lines = (g, get, y0, n) => { g.fillStyle = get('palette.metal'); for (let i = 0; i < n; i++) g.fillRect(12, y0 + i * 14, 70 + ((i * 31) % 34), 5); };
const POSTERS = [
  poster('poster-jumble', 'Jumble sale', 'velvet', (g, w, h, get) => { g.fillStyle = get('palette.ink'); g.font = `700 22px ${HAND}`; g.fillText('Sat 10am', 16, 74); lines(g, get, 96, 4); }),
  poster('poster-choir', 'Choir', 'fabric', (g, w, h, get) => { g.fillStyle = get('palette.ink'); g.font = `700 36px ${FONT}`; g.fillText('♪ ♫', 22, 88); lines(g, get, 110, 3); }),
  poster('poster-yoga', 'Yoga', 'ok', (g, w, h, get) => { g.strokeStyle = get('palette.ink'); g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(64, 62, 8, 0, 7); g.moveTo(64, 72); g.lineTo(64, 100); g.moveTo(40, 80); g.lineTo(88, 80); g.moveTo(64, 100); g.lineTo(48, 118); g.moveTo(64, 100); g.lineTo(80, 118); g.stroke(); lines(g, get, 130, 2); }),
  poster('poster-hire', 'Hall hire', 'gold', (g, w, h, get) => { g.strokeStyle = get('palette.metal'); g.lineWidth = 2; for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) g.strokeRect(12 + c * 26, 54 + r * 20, 26, 20); g.fillStyle = get('palette.velvet'); g.fillRect(38, 74, 26, 20); g.fillRect(90, 114, 26, 20); }),
];
const headerTex = liveTex('notices-header', 256, 48, (g, w, h, get) => {
  g.fillStyle = get('palette.woodDark'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.gold'); g.font = `800 30px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NOTICES', w / 2, h / 2 + 2);
});
asset('notice-board', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), cy = 1.22;
    // posts on feet, a little pitched roof over the case
    for (const sx of [-1, 1]) {
      add(chamfer(0.08, 1.9, 0.08, 0.015), C('woodDark'), { x: sx * 0.86, y: 0.95, z: -0.08 });
      add(chamfer(0.1, 0.06, 0.5, 0.02), C('woodDark'), { x: sx * 0.86, y: 0.03, z: -0.08, outline: 0.01 });
    }
    for (const s of [-1, 1]) add(chamfer(1.96, 0.035, 0.26, 0.01), C('woodDark'), { y: 1.98 + 0.035, z: -0.08 + s * 0.11, rx: s * 0.5 });
    // the case: frame, cork back, the header, the posters, pins, the glass front
    add(chamfer(1.66, 1.02, 0.08, 0.02), C('woodLight'), { y: cy, z: -0.08 });
    add(chamfer(1.52, 0.8, 0.084, 0.006), C('cork'), { y: cy - 0.06, z: -0.08, outline: 0 });
    add(chamfer(0.66, 0.13, 0.03, 0.008), C('woodDark'), { y: cy + 0.44, z: -0.03, outline: 0.006 });
    card(g, 0.62, 0.11, painted(headerTex), { y: cy + 0.44, z: -0.0145 });
    const spots = [[-0.52, 0.02, 0.06], [-0.18, -0.06, -0.05], [0.16, 0.0, 0.04], [0.5, -0.08, -0.07]];
    spots.forEach(([x, y, r], i) => card(g, 0.26, 0.34, painted(POSTERS[i]), { x, y: cy - 0.06 + y, z: -0.035, rz: r }));
    add(merged('notice-pins', () => spots.map(([x, y]) => [ball(0.013, 6), mat4(x, cy + 0.1 + y, -0.03)])), C('danger'), { outline: 0 });
    card(g, 1.54, 0.84, clear('palette.glass', 0.14), { y: cy - 0.04, z: 0.004 });
    add(chamfer(0.03, 0.08, 0.02, 0.008), C('chrome'), { x: 0.72, y: cy - 0.05, z: 0.012, outline: 0.004 });
  },
});

corner('hall', 'wood', [
  ...wallRun([-1.5, 1.5]),
  ['stage', 0, -1.8, 0],
  ['podium', 0.7, -1.5, 0, STAGE],
  ['plant-tall', 2.3, -2.3, 0],
  ['notice-board', -2.3, 0.6, Math.PI / 2],
  ['folding-chair-row', 0, 0.2, 0],
  ['folding-chair-row', 0, 1.3, 0],
  ['folding-chair-row', 0, 2.4, 0],
  ['coat-rack', 2.3, 2.3, 0],
]);
