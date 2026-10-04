// home.js: the bedroom pack (the player's home room): bed-single, bed-double, bedside-table, wardrobe, laptop, apron-hook,
// poster. Same conventions as furniture.js: bevelled low-poly shapes in theme tones, outlines, a contact shadow, +Z front,
// origin at the floor centre of the footprint. Wall things (apron-hook, poster) have their back at z = -0.4 of their
// 1x1 tile (the map puts the tile against a wall) and cast no floor blob.
//   make('bed-single' | 'bed-double' | 'wardrobe' | 'bedside-table' | 'poster', { tone })  tone: a palette key (the
//        recolour): fabric, fabricAlt, mint, coral, felt for beds; woodLight, woodDark, mint, coral for wood; and so on.
//   userData.surface (bedside-table): the height things stand on.
import { chamfer, slab, drum, ball, lathe, basic, liveTex, mapped } from './shapes.js';
import { defineAsset, adder, card, C, G, FONT } from './parts.js';

export const HOME = [];
const asset = (id, def) => defineAsset(HOME, id, def);
const T = (o, dflt) => C(o.tone || dflt);

function bed(g, o, w) {
  const add = adder(g), L = 2, bx = w / 2;
  const blanket = T(o, 'fabric');
  // frame, slatted base, mattress, blanket over the lower two thirds, two pillows, a headboard and a low foot rail
  add(chamfer(w - 0.04, 0.22, L - 0.06, 0.02), C('woodDark'), { y: 0.17, z: 0.02 });
  add(slab(w - 0.12, L - 0.16, 0.16, { r: 0.05, bev: 0.04, bs: 2 }), C('sheet'), { y: 0.28, z: 0.02 });
  add(slab(w - 0.1, L * 0.62, 0.07, { r: 0.05, bev: 0.025, bs: 2 }), blanket, { y: 0.4, z: 0.3 });
  for (const sx of w > 1.5 ? [-1, 1] : [0]) add(slab(w > 1.5 ? 0.6 : 0.62, 0.34, 0.1, { r: 0.12, bev: 0.045, bs: 2 }), C('plastic'), { x: sx * bx * 0.46, y: 0.4, z: -0.78 });
  add(chamfer(w - 0.02, 0.8, 0.07, 0.016), C('woodDark'), { y: 0.46, z: -L / 2 + 0.04 });
  add(chamfer(w - 0.02, 0.1, 0.08, 0.02), C('woodLight'), { y: 0.88, z: -L / 2 + 0.04, outline: 0.01 });
  add(chamfer(w - 0.02, 0.32, 0.06, 0.016), C('woodDark'), { y: 0.26, z: L / 2 - 0.04 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(chamfer(0.07, 0.1, 0.07, 0.012), C('woodDark'), { x: sx * (bx - 0.05), y: 0.05, z: sz * (L / 2 - 0.06) });
}
asset('bed-single', { category: 'furniture', tiles: [1, 2], build: (g, o) => bed(g, o, 1) });
asset('bed-double', { category: 'furniture', tiles: [2, 2], build: (g, o) => bed(g, o, 2) });

asset('bedside-table', {
  category: 'furniture', tiles: [1, 1],
  build(g, o) {
    const add = adder(g), TOP = 0.52, wood = T(o, 'woodLight');
    g.userData.surface = TOP;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(chamfer(0.04, 0.2, 0.04, 0.008), C('woodDark'), { x: sx * 0.19, y: 0.1, z: sz * 0.19 });
    add(chamfer(0.44, 0.3, 0.44, 0.015), wood, { y: 0.35 });
    add(chamfer(0.38, 0.11, 0.025, 0.01), C('woodDark'), { y: 0.42, z: 0.225, outline: 0.01 });
    add(chamfer(0.38, 0.11, 0.025, 0.01), C('woodDark'), { y: 0.28, z: 0.225, outline: 0.01 });
    for (const y of [0.42, 0.28]) add(ball(0.016, 6), C('chrome'), { y, z: 0.245, outline: 0 });
    add(slab(0.5, 0.5, 0.035, { r: 0.04, bev: 0.012 }), G('woodLight'), { y: TOP - 0.0175 });
  },
});

asset('wardrobe', {
  category: 'furniture', tiles: [2, 1],
  build(g, o) {
    const add = adder(g), wood = T(o, 'woodLight'), zc = -0.2, D = 0.55;
    add(chamfer(1.8, 0.07, D, 0.012), C('metal'), { y: 0.035, z: zc, outline: 0.01 });
    add(chamfer(1.84, 1.9, D, 0.02), wood, { y: 1.02, z: zc });
    add(chamfer(1.9, 0.07, D + 0.05, 0.02), C('woodDark'), { y: 2.0, z: zc, outline: 0.012 });
    for (const sx of [-1, 1]) {
      add(chamfer(0.88, 1.66, 0.025, 0.012), C('woodDark'), { x: sx * 0.45, y: 1.0, z: zc + D / 2 + 0.005, outline: 0.012 });
      add(chamfer(0.7, 1.4, 0.02, 0.01), wood, { x: sx * 0.45, y: 1.0, z: zc + D / 2 + 0.022, outline: 0.01 });
      add(chamfer(0.025, 0.2, 0.03, 0.008), C('chrome'), { x: sx * 0.07, y: 1.0, z: zc + D / 2 + 0.04, outline: 0.006 });
    }
  },
});

// the old laptop: a base, a keyboard strip and a tilted lid with a lit screen
const lapScreen = liveTex('laptop-screen', 160, 100, (g, w, h, get) => {
  g.fillStyle = get('palette.droneScreen'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.gold'); g.fillRect(10, 12, 50, 6);
  g.fillStyle = get('palette.ok'); g.fillRect(20, 28, 70, 6);
  g.fillStyle = get('palette.text'); g.globalAlpha = 0.5; g.fillRect(20, 44, 90, 6); g.fillRect(10, 60, 40, 6); g.globalAlpha = 1;
});
asset('laptop', {
  category: 'prop', tiles: [0.5, 0.5],
  build(g) {
    const add = adder(g);
    add(slab(0.44, 0.3, 0.02, { r: 0.02, bev: 0.006 }), C('metal'), { y: 0.01, z: 0.04 });
    add(chamfer(0.36, 0.006, 0.12, 0.002), C('plastic'), { y: 0.023, z: 0.08, outline: 0 });
    add(slab(0.44, 0.28, 0.014, { r: 0.02, bev: 0.005 }), C('metal'), { y: 0.15, z: -0.1, rx: -Math.PI / 2 + 0.3 });
    card(g, 0.4, 0.24, basic('palette.droneScreen'), { y: 0.152, z: -0.087, rx: -0.3 });
  },
});

asset('apron-hook', {
  category: 'prop', tiles: [1, 1], shadow: { opacity: 0 },
  build(g) {
    const add = adder(g), zb = -0.4;
    add(chamfer(0.5, 0.07, 0.04, 0.01), C('woodDark'), { y: 1.55, z: zb + 0.02, outline: 0.01 });
    add(drum(0.022, 0.07, 8), C('chrome'), { y: 1.55, z: zb + 0.06, rx: Math.PI / 2, outline: 0.006 });
    // the noodle-bar apron (a stand-in name): bib, skirt, neck strap, a pocket and a bowl badge
    add(chamfer(0.2, 0.26, 0.018, 0.006), C('fabricAlt'), { y: 1.38, z: zb + 0.09, outline: 0.008 });
    add(chamfer(0.34, 0.5, 0.02, 0.008), C('fabricAlt'), { y: 1.02, z: zb + 0.095, outline: 0.008 });
    add(chamfer(0.02, 0.2, 0.012, 0.004), C('sheet'), { x: -0.06, y: 1.52, z: zb + 0.085, outline: 0 });
    add(chamfer(0.02, 0.2, 0.012, 0.004), C('sheet'), { x: 0.06, y: 1.52, z: zb + 0.085, outline: 0 });
    add(chamfer(0.24, 0.12, 0.012, 0.004), C('sheet'), { y: 0.92, z: zb + 0.11, outline: 0.006 });
    add(lathe('bowl-badge', [[0, 0], [0.04, 0], [0.06, 0.03], [0.055, 0.035], [0.036, 0.012], [0, 0.012]], 10, { flat: true }), C('gold'), { y: 1.4, z: zb + 0.105, rx: Math.PI / 2, outline: 0 });
  },
});

const printTex = liveTex('poster-print', 128, 160, (g, w, h, get) => {
  g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b8b8b8'; g.beginPath(); g.arc(w / 2, 62, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#9a9a9a'; g.beginPath(); g.moveTo(0, h); g.lineTo(40, 96); g.lineTo(76, 128); g.lineTo(100, 90); g.lineTo(w, h); g.fill();
  g.fillStyle = '#707070'; g.font = `700 14px ${FONT}`; g.textAlign = 'center'; g.fillText('SHIP IT', w / 2, 146);
});
asset('poster', {
  category: 'prop', tiles: [1, 1], shadow: { opacity: 0 },
  build(g, o) {
    const add = adder(g), zb = -0.4;
    add(chamfer(0.62, 0.84, 0.03, 0.01), C('woodDark'), { y: 1.2, z: zb + 0.015, outline: 0.01 });
    card(g, 0.54, 0.76, mapped(`palette.${o.tone || 'fabric'}`, printTex), { y: 1.2, z: zb + 0.032 });
  },
});
