// sectors/school.js: the school pack. A green board (palette.chalkboard) with chalk writing, blue
// lockers and school furniture (palette.locker), wood desks. Pupils' desks face -Z, toward the board
// at the back of a classroom; the teacher's desk shows its front panel (+Z) to the class.
import * as THREE from 'three';
import { chamfer, slab, plan, lathe, tube, drum, ball, leaf, merged, mat4, painted, liveTex } from '../shapes.js';
import { adder, seat, strut, card, C, G, FONT, HAND } from '../parts.js';
import { sectorAsset, corner, wallRun, ring } from './common.js';

const asset = sectorAsset('school');

// an exercise book lying open: a cover and two pages
function openBook(add, x, y, z, ry, cover) {
  add(chamfer(0.3, 0.008, 0.21, 0.003), C(cover), { x, y: y + 0.004, z, ry, outline: 0.005 });
  for (const s of [-1, 1]) add(chamfer(0.14, 0.008, 0.2, 0.002), C('sheet'), { x: x + Math.cos(ry) * s * 0.073, y: y + 0.012, z: z - Math.sin(ry) * s * 0.073, ry, rz: -s * 0.05, outline: 0.004 });
}

// ======================================================================= student desk (with its chair)
asset('student-desk', {
  category: 'furniture', tiles: [1, 1],
  build(g) {
    const add = adder(g), TOP = 0.6, dz = -0.22;
    g.userData.surface = TOP; seat(g, 0, 0.42, 0.21, Math.PI);
    // the desk: a wooden top on a tubular frame, a book tray under the top
    add(slab(0.74, 0.5, 0.035, { r: 0.03, bev: 0.012 }), G('woodLight'), { y: TOP - 0.0175, z: dz });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) add(drum(0.018, TOP - 0.04, 8), C('locker'), { x: sx * 0.32, y: (TOP - 0.04) / 2, z: dz + sz * 0.2, outline: 0.008 });
      add(chamfer(0.04, 0.03, 0.46, 0.01), C('locker'), { x: sx * 0.32, y: 0.12, z: dz, outline: 0.006 });
      for (const sz of [-1, 1]) add(drum(0.022, 0.02, 8), C('rubber'), { x: sx * 0.32, y: 0.01, z: dz + sz * 0.2, outline: 0 });
    }
    add(chamfer(0.66, 0.1, 0.4, 0.012), C('metal'), { y: TOP - 0.1, z: dz - 0.02, outline: 0.008 });
    add(chamfer(0.3, 0.05, 0.22, 0.008), C('fabricAlt'), { x: -0.14, y: TOP - 0.125, z: dz - 0.02, outline: 0.005 });
    // on the desk: an open exercise book, a pencil, a pencil case
    openBook(add, -0.05, TOP, dz + 0.04, 0.12, 'locker');
    add(drum(0.006, 0.16, 6), C('gold'), { x: 0.2, y: TOP + 0.008, z: dz + 0.06, rz: Math.PI / 2, ry: 0.5, outline: 0.004 }).rotation.order = 'YXZ';
    add(slab(0.2, 0.07, 0.05, { r: 0.03, bev: 0.02, bs: 2 }), C('fabric'), { x: 0.2, y: TOP + 0.025, z: dz - 0.14, ry: -0.1, outline: 0.005 });
    // the chair behind it, tucked in (a moulded shell on a chrome frame)
    const cz = 0.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(drum(0.013, 0.38, 6), C('chrome'), { x: sx * 0.16, y: 0.19, z: cz + sz * 0.15, rx: sz * 0.08, outline: 0.006 });
    add(slab(0.4, 0.38, 0.035, { r: 0.07, bev: 0.014 }), C('locker'), { y: 0.4, z: cz });
    for (const sx of [-1, 1]) add(drum(0.013, 0.28, 6), C('chrome'), { x: sx * 0.16, y: 0.54, z: cz + 0.17, rx: 0.1, outline: 0.006 });
    add(slab(0.4, 0.2, 0.035, { r: 0.07, bev: 0.014 }), C('locker'), { y: 0.64, z: cz + 0.19, rx: Math.PI / 2 + 0.12 });
    // a school bag hung on the chair back
    add(slab(0.26, 0.1, 0.24, { r: 0.04, bev: 0.03, bs: 2 }), C('fabricAlt'), { x: 0.02, y: 0.5, z: cz + 0.25, rx: 0.1 });
    add(chamfer(0.18, 0.08, 0.02, 0.008), C('gold'), { x: 0.02, y: 0.44, z: cz + 0.305, rx: 0.1, outline: 0.004 });
  },
});

// ======================================================================= chalkboard
const chalkTex = liveTex('chalk-writing', 512, 272, (g, w, h, get) => {
  g.clearRect(0, 0, w, h);
  const chalk = get('palette.sheet');
  g.fillStyle = chalk; g.strokeStyle = chalk; g.lineCap = 'round'; g.lineJoin = 'round';
  // smudges left by the rubber
  g.globalAlpha = 0.1; for (const [x, y, rx] of [[140, 200, 110], [390, 70, 90], [300, 230, 70]]) { g.beginPath(); g.ellipse(x, y, rx, 20, 0.05, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 0.92;
  g.font = `700 30px ${HAND}`; g.fillText('Monday 5 May', 20, 40);
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(18, 50); g.lineTo(210, 48); g.stroke();
  g.font = `700 34px ${HAND}`; g.fillText('3 + 4 = 7', 26, 104); g.fillText('12 ÷ 3 = 4', 26, 152); g.fillText('5 × 6 = ?', 26, 200);
  // a triangle with its angles, and the ABC
  g.lineWidth = 3.5; g.beginPath(); g.moveTo(300, 200); g.lineTo(430, 200); g.lineTo(340, 100); g.closePath(); g.stroke();
  g.font = `700 20px ${HAND}`; g.fillText('60°', 312, 190); g.fillText('A', 290, 222); g.fillText('B', 432, 222); g.fillText('C', 336, 92);
  g.font = `700 30px ${HAND}`; g.fillText('Aa Bb Cc', 280, 252);
  // a sun in the corner, drawn in yellow chalk
  g.strokeStyle = get('palette.gold'); g.lineWidth = 3; g.beginPath(); g.arc(462, 48, 18, 0, Math.PI * 2); g.stroke();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(462 + Math.cos(a) * 24, 48 + Math.sin(a) * 24); g.lineTo(462 + Math.cos(a) * 34, 48 + Math.sin(a) * 34); g.stroke(); }
  g.globalAlpha = 1;
});
asset('chalkboard', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), cy = 1.28;
    add(chamfer(1.82, 1.0, 0.06, 0.02), C('woodLight'), { y: cy, z: -0.1 });
    add(chamfer(1.7, 0.88, 0.064, 0.008), C('chalkboard'), { y: cy, z: -0.1, outline: 0 });
    card(g, 1.68, 0.86, painted(chalkTex, { transparent: true }), { y: cy, z: -0.066 });
    // the stand: two posts on sledge feet
    for (const sx of [-1, 1]) {
      add(chamfer(0.06, 1.8, 0.06, 0.015), C('woodDark'), { x: sx * 0.94, y: 0.9, z: -0.1 });
      add(chamfer(0.09, 0.06, 0.6, 0.02), C('woodDark'), { x: sx * 0.94, y: 0.03, z: -0.1, outline: 0.01 });
    }
    // a rolled-up map over the board, its pull ring
    add(drum(0.035, 1.6, 10), C('sheet'), { y: 1.84, z: -0.1, rz: Math.PI / 2, outline: 0.008 });
    for (const sx of [-1, 1]) add(drum(0.04, 0.03, 10), C('woodDark'), { x: sx * 0.81, y: 1.84, z: -0.1, rz: Math.PI / 2, outline: 0.005 });
    add(ring('map-pull', 0.025, 0.004, 10, 4), C('gold'), { y: 1.78, z: -0.06, rx: Math.PI / 2, outline: 0 });
    // the chalk tray: chalk sticks, the board rubber, a wooden set square
    add(chamfer(1.6, 0.03, 0.1, 0.01), C('woodLight'), { y: cy - 0.5, z: -0.03, outline: 0.008 });
    add(chamfer(1.6, 0.04, 0.012, 0.004), C('woodLight'), { y: cy - 0.48, z: 0.018, outline: 0 });
    [['sheet', -0.5], ['sheet', -0.42], ['gold', -0.36], ['fabricAlt', -0.3]].forEach(([c, x], i) => add(drum(0.009, 0.08, 6), C(c), { x, y: cy - 0.476, z: -0.02 + (i % 2) * 0.02, rz: Math.PI / 2, ry: i * 0.3, outline: 0.004 }));
    add(chamfer(0.14, 0.035, 0.055, 0.012), C('woodDark'), { x: 0.35, y: cy - 0.46, z: -0.03, outline: 0.005 });
    add(chamfer(0.14, 0.018, 0.055, 0.004), C('metal'), { x: 0.35, y: cy - 0.482, z: -0.03, outline: 0 });
    const sq = new THREE.Shape(); sq.moveTo(0, 0); sq.lineTo(0.2, 0); sq.lineTo(0, 0.14); sq.closePath();
    add(plan('set-square', sq, 0.01, { bev: 0.002 }), C('woodLight'), { x: 0.55, y: cy - 0.49, z: -0.05, rx: Math.PI / 2 - 0.2, outline: 0.004 });
  },
});

// ======================================================================= locker row
const lockerNumbers = [21, 22, 23, 24].map((n) => liveTex(`locker-${n}`, 64, 32, (g, w, h, get) => {
  g.fillStyle = get('palette.sheet'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.ink'); g.font = `800 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, h / 2 + 1);
}));
asset('locker-row', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), zc = -0.2, W = 0.47, H = 1.72, fz = zc + 0.235;
    add(chamfer(1.9, 0.1, 0.44, 0.012), C('metal'), { y: 0.05, z: zc, outline: 0.01 });
    add(chamfer(1.92, H, 0.46, 0.02), C('locker'), { y: 0.1 + H / 2, z: zc });
    add(slab(1.96, 0.5, 0.04, { r: 0.015, bev: 0.012 }), C('metal'), { y: 0.1 + H + 0.02, z: zc, outline: 0.01 });
    const vents = merged('locker-vents', () => [0.18, 1.52].flatMap((y) => Array.from({ length: 4 }, (_, i) => [chamfer(0.26, 0.016, 0.01, 0.004), mat4(0, y + i * 0.035, 0)])));
    for (let i = 0; i < 4; i++) {
      const x = -0.705 + i * W;
      // locker 3 stands ajar about its left hinge, a bag strap hanging out
      const door = new THREE.Group(); door.position.set(x - W / 2 + 0.02, 0.1, fz); if (i === 2) door.rotation.y = -0.55; g.add(door);
      add(chamfer(W - 0.03, H - 0.06, 0.024, 0.01), C('locker'), { parent: door, x: W / 2 - 0.02, y: H / 2, outline: 0.01 });
      add(vents, C('metal'), { parent: door, x: W / 2 - 0.02, z: 0.013, outline: 0 });
      add(chamfer(0.03, 0.14, 0.03, 0.01), C('chrome'), { parent: door, x: W - 0.09, y: H * 0.55, z: 0.02, outline: 0.005 });
      add(chamfer(0.1, 0.055, 0.008, 0.003), C('chrome'), { parent: door, x: W / 2 - 0.02, y: H - 0.12, z: 0.014, outline: 0 });
      card(door, 0.08, 0.04, painted(lockerNumbers[i]), { x: W / 2 - 0.02, y: H - 0.12, z: 0.019 });
      if (i === 1) { // a padlock
        add(drum(0.03, 0.022, 10), C('gold'), { parent: door, x: W - 0.09, y: H * 0.5 - 0.04, z: 0.04, rx: Math.PI / 2, outline: 0.004 });
        add(ring('padlock', 0.018, 0.004, 10, 4), C('chrome'), { parent: door, x: W - 0.09, y: H * 0.5 - 0.005, z: 0.04, rx: Math.PI / 2, outline: 0 });
      }
      if (i === 0) add(chamfer(0.1, 0.1, 0.006, 0.002), C('gold'), { parent: door, x: 0.12, y: H * 0.62, z: 0.015, rz: 0.2, outline: 0.003 });
    }
    // inside the open locker: the dark back, a bag strap trailing out
    add(chamfer(W - 0.04, H - 0.1, 0.01, 0.004), C('metal'), { x: -0.705 + 2 * W, y: 0.1 + H / 2, z: fz - 0.02, outline: 0 });
    add(tube('locker-strap', [[0.18, 1.0, fz - 0.05], [0.14, 0.9, fz + 0.02], [0.16, 0.7, fz + 0.06], [0.2, 0.55, fz + 0.04]], 0.014, { seg: 10, radial: 5 }), C('fabricAlt'), { outline: 0.005 });
  },
});

// ======================================================================= teacher's desk
asset('teacher-desk', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), TOP = 0.74;
    g.userData.surface = TOP;
    // two pedestals and the front panel the class sees, with a raised moulding
    for (const sx of [-1, 1]) {
      add(chamfer(0.46, 0.68, 0.74, 0.02), C('woodDark'), { x: sx * 0.68, y: 0.36, z: -0.02 });
      add(chamfer(0.38, 0.56, 0.02, 0.01), C('woodLight'), { x: sx * 0.68, y: 0.38, z: 0.36, outline: 0.008 });
      add(chamfer(0.5, 0.04, 0.78, 0.012), C('metal'), { x: sx * 0.68, y: 0.02, z: -0.02, outline: 0.008 });
    }
    add(chamfer(0.92, 0.5, 0.04, 0.012), C('woodDark'), { y: 0.46, z: 0.3 });
    add(chamfer(0.78, 0.36, 0.02, 0.01), C('woodLight'), { y: 0.46, z: 0.325, outline: 0.008 });
    add(slab(1.9, 0.86, 0.05, { r: 0.03, bev: 0.015 }), G('woodLight'), { y: TOP - 0.025 });
    // a pile of exercise books to mark
    ['locker', 'fabricAlt', 'ok', 'gold', 'fabric', 'locker'].forEach((c, i) => add(chamfer(0.22, 0.018, 0.3, 0.004), C(c), { x: -0.6, y: TOP + 0.01 + i * 0.019, z: -0.02, ry: (i % 3 - 1) * 0.08, outline: 0.004 }));
    openBook(add, -0.18, TOP, 0.08, -0.05, 'fabricAlt');
    // an apple, a pen pot, the brass handbell, a globe
    add(ball(0.045, 10), C('danger'), { x: 0.2, y: TOP + 0.042, z: 0.22, s: [1, 0.9, 1], outline: 0.005 });
    add(drum(0.004, 0.03, 5), C('woodDark'), { x: 0.2, y: TOP + 0.09, z: 0.22, outline: 0 });
    add(leaf({ len: 0.04, wid: 0.025 }), C('leaf'), { x: 0.2, y: TOP + 0.095, z: 0.22, ry: 0.8, rx: -0.4, outline: 0 });
    add(lathe('pen-pot', [[0, 0], [0.035, 0], [0.037, 0.1], [0.033, 0.1], [0.031, 0.006], [0, 0.006]], 10, { flat: true }), C('metal'), { x: 0.45, y: TOP, z: -0.25, outline: 0.005 });
    ['gold', 'danger', 'fabric'].forEach((c, i) => add(drum(0.006, 0.15, 6), C(c), { x: 0.45 + (i - 1) * 0.012, y: TOP + 0.1, z: -0.25 + (i % 2) * 0.01, rz: (i - 1) * 0.15, outline: 0 }));
    add(lathe('handbell', [[0, 0], [0.05, 0], [0.046, 0.012], [0.03, 0.05], [0.018, 0.07], [0, 0.074]], 12, { flat: true }), C('gold'), { x: 0.2, y: TOP, z: -0.18, outline: 0.005 });
    add(drum(0.012, 0.09, 8), C('woodDark'), { x: 0.2, y: TOP + 0.11, z: -0.18, outline: 0.004 });
    add(drum(0.06, 0.018, 10), C('woodDark'), { x: 0.7, y: TOP + 0.009, z: -0.1, outline: 0.005 });
    add(drum(0.008, 0.07, 6), C('gold'), { x: 0.7, y: TOP + 0.05, z: -0.1, outline: 0 });
    add(ball(0.1, 12), C('fabric'), { x: 0.7, y: TOP + 0.18, z: -0.1, outline: 0.006 });
    add(ring('desk-globe-ring', 0.112, 0.006, 16, 4), C('gold'), { x: 0.7, y: TOP + 0.18, z: -0.1, rx: Math.PI / 2, ry: 0.4, outline: 0 });
    add(merged('globe-land', () => [[0.3, 0.2, 0.05], [2.2, -0.3, 0.045], [4.1, 0.4, 0.04]].map(([a, e, r]) => [ball(r, 6), mat4(Math.sin(a) * 0.085, Math.sin(e) * 0.07, Math.cos(a) * 0.085, 0, 0, 0, [1, 0.6, 1])])), C('leaf'), { x: 0.7, y: TOP + 0.18, z: -0.1, outline: 0 });
  },
});

// ======================================================================= projector screen
const slideTex = liveTex('projector-slide', 512, 320, (g, w, h, get) => {
  g.fillStyle = get('palette.sheet'); g.fillRect(0, 0, w, h);
  g.fillStyle = get('palette.locker'); g.fillRect(0, 0, w, 58);
  g.fillStyle = get('palette.sheet'); g.font = `800 32px ${FONT}`; g.textBaseline = 'middle'; g.fillText('The water cycle', 22, 31);
  // sea, a cloud, rain, the sun, arrows round
  g.fillStyle = get('palette.glass'); g.fillRect(0, 250, w, 70);
  g.strokeStyle = get('palette.sheet'); g.lineWidth = 3; for (let x = 0; x < w; x += 40) { g.beginPath(); g.arc(x + 20, 262, 12, Math.PI, 0); g.stroke(); }
  g.fillStyle = get('palette.gold'); g.beginPath(); g.arc(70, 120, 32, 0, Math.PI * 2); g.fill();
  g.fillStyle = get('palette.chrome'); for (const [x, y, r] of [[330, 110, 34], [370, 96, 40], [412, 114, 30], [360, 124, 30]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = get('palette.fabric'); g.lineWidth = 4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(330 + i * 16, 160); g.lineTo(322 + i * 16, 186); g.stroke(); }
  g.strokeStyle = get('palette.ink'); g.lineWidth = 4;
  const arrow = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 40, x2, y2); g.stroke(); g.beginPath(); g.arc(x2, y2, 6, 0, Math.PI * 2); g.fillStyle = get('palette.ink'); g.fill(); };
  arrow(150, 230, 290, 120); arrow(430, 170, 470, 240);
  g.fillStyle = get('palette.ink'); g.font = `600 18px ${FONT}`; g.fillText('evaporation', 140, 200); g.fillText('rain', 440, 200);
});
asset('projector-screen', {
  category: 'furniture', tiles: [2, 1],
  build(g) {
    const add = adder(g), cy = 1.36;
    // the tripod: pole, three legs, the case at the top
    add(drum(0.022, 1.95, 8), C('metal'), { y: 0.975, z: -0.12, outline: 0.008 });
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + Math.PI / 6;
      strut(add, [0, 0.42, -0.12], [Math.sin(a) * 0.4, 0.02, -0.12 + Math.cos(a) * 0.36], 0.013, C('metal'), { outline: 0.006 });
      add(drum(0.024, 0.03, 8), C('rubber'), { x: Math.sin(a) * 0.4, y: 0.015, z: -0.12 + Math.cos(a) * 0.36, outline: 0 });
    }
    add(drum(0.045, 1.84, 12), C('chrome'), { y: 1.98, z: -0.08, rz: Math.PI / 2, outline: 0.008 });
    for (const sx of [-1, 1]) add(drum(0.05, 0.03, 12), C('metal'), { x: sx * 0.93, y: 1.98, z: -0.08, rz: Math.PI / 2, outline: 0.005 });
    // the screen: a black border round the white field, the slide projected on it, the weighted bottom bar
    add(chamfer(1.76, 1.18, 0.012, 0.004), C('metal'), { y: cy, z: -0.07 });
    add(chamfer(1.62, 1.04, 0.014, 0.003), C('sheet'), { y: cy, z: -0.07, outline: 0 });
    card(g, 1.52, 0.95, painted(slideTex, { unlit: true }), { y: cy, z: -0.0625 });
    add(chamfer(1.8, 0.04, 0.035, 0.012), C('metal'), { y: cy - 0.6, z: -0.07, outline: 0.006 });
    add(chamfer(0.12, 0.03, 0.03, 0.01), C('chrome'), { y: cy - 0.64, z: -0.06, outline: 0.004 });
  },
});

corner('school', 'wood', [
  ...wallRun([1.5, 2.5]),
  ['plant-tall', -2.3, -2.3, 0.3],
  ['chalkboard', -0.3, -2.3, 0],
  ['projector-screen', 1.8, -2.3, -0.2],
  ['teacher-desk', -0.3, -1.1, 0],
  ['locker-row', -2.3, 0.5, Math.PI / 2],
  ...[-1.2, 0.0, 1.2].flatMap((x) => [['student-desk', x, 0.3, 0], ['student-desk', x, 1.6, 0]]),
  ['mug', 0.15, -0.95, 0.2, 0.74],
]);
