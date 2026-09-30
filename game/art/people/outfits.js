// people/outfits.js: who a person is (role, skin, hair, clothes, accessories) and the pieces they are built from.
//
//   ROLES, HAIR_STYLES, SKINS, HAIRS
//   dress({ role, seed, ...overrides }) -> spec: { role, seed, skin, hair, hairStyle, glasses, beard, prop,
//        flags (what shapes the body is built from), slots (colour slot -> theme path), sig (geometry cache key) }
//   pieces(spec) -> [{ bone, at?, slot, geo, m, outline }]   (rig.js bakes them)
//
// Every colour is a theme path (palette.*, the "People" group in the tweak panel), so people recolour live.
import * as THREE from 'three';
import { lathe, ball, drum, chamfer, tube, withHull, rng } from '../shapes.js';
import { torus } from '../../engine/kit.js';
import { DIM, FACE, facePoint } from './rig.js';

export const ROLES = Object.freeze(['office', 'lab', 'gym', 'school', 'clinic', 'council']);
export const HAIR_STYLES = Object.freeze(['short', 'bob', 'long', 'bun', 'ponytail', 'curly', 'spiky', 'bald']);
export const SKINS = Object.freeze(['skin1', 'skin2', 'skin3', 'skin4', 'skin5']);
export const HAIRS = Object.freeze(['hair1', 'hair2', 'hair3', 'hair4', 'hair5', 'hair6']);
export const PROPS = Object.freeze(['clipboard', 'laptop']);

// per role: the colour choices and the chances of each piece (seeded, so a seed is always the same person)
const ROLE = {
  office: { top: ['shirt', 'shirtAlt'], outer: ['jacket', 'jacketAlt'], outerKind: 'jacket', outerChance: 0.7, bottoms: ['trousers', 'chinos', 'jeans'], skirt: 0.3, shoes: 'shoes', glasses: 0.35, props: [['laptop', 0.3], ['clipboard', 0.15]] },
  lab: { top: ['shirtAlt', 'shirt'], outer: ['labCoat'], outerKind: 'coat', outerChance: 1, bottoms: ['trousers', 'jeans'], skirt: 0, shoes: 'shoes', glasses: 0.25, goggles: 0.7, props: [['clipboard', 0.5]] },
  gym: { top: ['sportTop', 'sportAlt'], outer: [], outerChance: 0, bottoms: ['trousers'], skirt: 0, shorts: true, shoes: 'trainers', glasses: 0.1, headband: 0.5, shortSleeves: true, props: [] },
  school: { top: ['shirt', 'shirtAlt'], outer: ['cardigan', 'cardiganAlt'], outerKind: 'cardigan', outerChance: 0.85, bottoms: ['trousers', 'chinos'], skirt: 0.4, shoes: 'shoes', glasses: 0.4, lanyard: 1, props: [['clipboard', 0.3]] },
  clinic: { top: ['scrubs', 'scrubsAlt'], outer: [], outerChance: 0, bottoms: ['=top'], skirt: 0, shoes: 'trainers', glasses: 0.25, stethoscope: 0.65, shortSleeves: true, props: [['clipboard', 0.4]] },
  council: { top: ['shirt'], outer: ['blazer', 'blazerAlt'], outerKind: 'jacket', outerChance: 1, bottoms: ['trousers'], skirt: 0.35, shoes: 'shoes', glasses: 0.45, badge: 1, props: [['clipboard', 0.4]] },
};

export function dress({ role = 'office', seed = 1, ...o } = {}) {
  if (!ROLE[role]) throw new Error(`unknown role "${role}"`);
  const R = ROLE[role];
  const rnd = rng(((seed | 0) * 2654435761 + ROLES.indexOf(role) * 97) >>> 0);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
  const chance = (p) => rnd() < p;
  const skin = o.skin ?? pick(SKINS);
  let hairStyle = o.hairStyle ?? pick(HAIR_STYLES);
  const hair = o.hair ?? (hairStyle === 'bald' || role === 'council' ? pick([...HAIRS, 'hair5']) : pick(HAIRS));
  const top = o.top ?? pick(R.top);
  const hasOuter = o.outer !== undefined ? !!o.outer : chance(R.outerChance);
  const outer = hasOuter ? (typeof o.outer === 'string' ? o.outer : pick(R.outer)) : null;
  const bottomsKey = pick(R.bottoms);
  const bottoms = o.bottoms ?? (bottomsKey === '=top' ? top : bottomsKey);
  const skirt = o.skirt ?? chance(R.skirt);
  const glasses = o.glasses ?? chance(R.glasses);
  const goggles = o.goggles ?? chance(R.goggles || 0);
  const headband = o.headband ?? chance(R.headband || 0);
  const stethoscope = o.stethoscope ?? chance(R.stethoscope || 0);
  const beard = o.beard ?? (!skirt && chance(0.18));
  let prop = o.prop;
  if (prop === undefined) { prop = null; for (const [p, c] of R.props) if (!prop && chance(c)) prop = p; }
  if (prop && !PROPS.includes(prop)) throw new Error(`unknown prop "${prop}"`);
  if (!HAIR_STYLES.includes(hairStyle)) throw new Error(`unknown hair style "${hairStyle}"`);
  const flags = {
    outer: outer ? R.outerKind : null,
    skirt, shorts: !!R.shorts, shortSleeves: !!R.shortSleeves, hairStyle, glasses, goggles, headband, stethoscope, beard,
    lanyard: !!R.lanyard, badge: !!R.badge,
  };
  const p = (k) => `palette.${k}`;
  const slots = {
    skin: p(skin), hair: p(hair), top: p(top), bottoms: p(bottoms), legs: p(skirt ? 'trousers' : bottoms), shoes: p(R.shoes),
    ink: p('ink'), glint: p('text'), blush: p('blush'), mouth: p('mouth'),
  };
  if (outer) slots.outer = p(outer);
  if (flags.shorts) { slots.legs = p(skin); slots.bottoms = p('trousers'); }
  if (headband) slots.accent = p(top === 'sportTop' ? 'sportAlt' : 'sportTop');
  if (flags.badge || flags.outer === 'cardigan') slots.accent = p('gold');
  if (flags.lanyard) { slots.lanyard = p('lanyard'); slots.card = p('sheet'); }
  if (goggles) { slots.lens = p('goggles'); slots.strap = p('metal'); }
  if (stethoscope) { slots.strap = p('metal'); slots.chrome = p('chrome'); }
  return { role, seed, skin, hair, hairStyle, top, outer, bottoms, prop, glasses, beard, flags, slots, sig: JSON.stringify(flags) };
}

// ---------------------------------------------------------------- geometry helpers
const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
// a lathe open at the front: gap is the half-angle of the opening, centred on +Z
function openLathe(key, profile, seg, gap) {
  return once(`ol|${key}|${seg}|${gap}`, () => withHull(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, gap, Math.PI * 2 - gap * 2)));
}
// a lathe covering only an arc [from, from + len] (0 = +Z, PI/2 = +X)
function arcLathe(key, profile, seg, from, len) {
  return once(`al|${key}|${seg}|${from}|${len}`, () => withHull(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, from, len)));
}
function hairCap(r, theta) {
  return once(`cap|${r}|${theta}`, () => withHull(new THREE.SphereGeometry(r, 16, 7, 0, Math.PI * 2, 0, theta)));
}
const disc = (r, seg, start = 0, len = Math.PI * 2) => once(`disc|${r}|${seg}|${start}|${len}`, () => new THREE.CircleGeometry(r, seg, start, len));
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, order = 'XYZ') => new THREE.Matrix4().compose(
  new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, order)),
  Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s));
// a matrix placing a feature on the head sphere, facing out
function onFace(el, az, out = 0, s = 1, roll = 0) {
  const { pos, rot } = facePoint(el, az, out);
  return new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, roll, 'YXZ')),
    Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s));
}
// a matrix standing +Y along the head sphere's normal at (el, az)
function alongNormal(el, az, r, s = 1) {
  const n = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const pos = n.clone().multiplyScalar(r).add(new THREE.Vector3(0, DIM.headY, 0));
  return new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), new THREE.Vector3(s, s, s));
}

// body shapes (profiles are [radius, y] from the bone)
const G = {
  pelvis: () => lathe('p-pelvis', [[0, -0.1], [0.1, -0.1], [0.146, -0.07], [0.156, 0], [0.15, 0.075], [0, 0.08]], 12),
  torso: () => lathe('p-torso', [[0, -0.03], [0.15, -0.03], [0.162, 0.05], [0.176, 0.15], [0.172, 0.22], [0.135, 0.28], [0.06, 0.305], [0, 0.305]], 14),
  thigh: () => lathe('p-thigh', [[0, 0.035], [0.06, 0.03], [0.079, 0], [0.075, -0.15], [0.065, -0.29], [0.05, -0.325], [0, -0.335]], 10),
  shin: () => lathe('p-shin', [[0, 0.03], [0.058, 0.022], [0.063, -0.03], [0.054, -0.2], [0.046, -0.33], [0, -0.365]], 10),
  shorts: () => lathe('p-shorts', [[0, 0.045], [0.086, 0.04], [0.09, -0.02], [0.088, -0.15], [0.07, -0.16], [0, -0.16]], 10),
  shoe: () => chamfer(0.115, 0.08, 0.215, 0.035),
  upper: () => lathe('p-upper', [[0, 0.045], [0.05, 0.036], [0.06, 0], [0.054, -0.18], [0.045, -0.21], [0, -0.22]], 10),
  sleeve: () => lathe('p-sleeve', [[0, 0.05], [0.058, 0.04], [0.068, 0], [0.066, -0.1], [0.058, -0.11], [0, -0.11]], 10),
  fore: () => lathe('p-fore', [[0, 0.03], [0.046, 0.022], [0.05, -0.02], [0.043, -0.17], [0, -0.19]], 10),
  hand: () => ball(0.056, 10),
  head: () => ball(DIM.headR, 16),
  ear: () => ball(0.055, 8),
  // clothes
  jacket: (gap) => openLathe('p-jacket', [[0.155, -0.075], [0.17, -0.06], [0.178, 0.03], [0.19, 0.15], [0.186, 0.22], [0.146, 0.288], [0.07, 0.318]], 14, gap),
  coatSkirt: () => openLathe('p-coatskirt', [[0.172, 0.06], [0.178, 0], [0.19, -0.2], [0.205, -0.42], [0.2, -0.45]], 14, 0.95),
  skirt: () => lathe('p-skirt', [[0.15, 0.06], [0.162, 0], [0.18, -0.15], [0.2, -0.26], [0.192, -0.28], [0.12, -0.27]], 14),
};

// ---------------------------------------------------------------- pieces
export function pieces(spec) {
  const f = spec.flags, out = [];
  const add = (bone, slot, geo, m, outline = 0.01, at) => out.push({ bone, slot, geo, m, outline, at });
  const sleeveSlot = f.outer ? 'outer' : 'top';
  // hips and legs
  add('pelvis', 'bottoms', G.pelvis(), M(0, 0, 0, 0, 0, 0, [1, 1, 0.8]));
  if (f.skirt) add('pelvis', 'bottoms', G.skirt(), M(0, 0, 0, 0, 0, 0, [1, 1, 0.85]));
  for (const s of ['L', 'R']) {
    const x = s === 'L' ? 1 : -1;
    add(`hip${s}`, f.skirt || f.shorts ? 'legs' : 'bottoms', G.thigh(), M());
    if (f.shorts) add(`hip${s}`, 'bottoms', G.shorts(), M());
    add(`knee${s}`, f.skirt || f.shorts ? 'legs' : 'bottoms', G.shin(), M());
    add(`ankle${s}`, 'shoes', G.shoe(), M(0, -DIM.sole + 0.04, 0.045));
    // arms
    add(`sh${s}`, f.shortSleeves ? 'skin' : sleeveSlot, G.upper(), M());
    if (f.shortSleeves) add(`sh${s}`, 'top', G.sleeve(), M());
    add(`el${s}`, f.shortSleeves ? 'skin' : sleeveSlot, G.fore(), M());
    add(`hand${s}`, 'skin', G.hand(), M(0, -0.035, 0, 0, 0, 0, [0.88, 1, 0.92]));
    // ears
    add('head', 'skin', G.ear(), M(x * 0.262, DIM.headY - 0.01, -0.01, 0, 0, 0, [0.55, 1, 0.8]), 0.008);
  }
  // torso and outer layer
  add('spine', 'top', G.torso(), M(0, 0, 0, 0, 0, 0, [1, 1, 0.74]));
  if (f.outer === 'jacket') add('spine', 'outer', G.jacket(0.42), M(0, 0, 0, 0, 0, 0, [1, 1, 0.76]));
  if (f.outer === 'cardigan') {
    add('spine', 'outer', G.jacket(0.3), M(0, 0, 0, 0, 0, 0, [1, 1, 0.76]));
    for (let i = 0; i < 3; i++) add('spine', 'accent', ball(0.011, 6), M(0.052, 0.02 + i * 0.07, 0.135 + i * 0.005), 0);
  }
  if (f.outer === 'coat') {
    add('spine', 'outer', G.jacket(0.32), M(0, 0, 0, 0, 0, 0, [1, 1, 0.78]));
    add('pelvis', 'outer', G.coatSkirt(), M(0, 0, 0, 0, 0, 0, [1, 1, 0.82]));
    // a breast pocket with a pen
    add('spine', 'outer', chamfer(0.06, 0.05, 0.012, 0.004), M(-0.09, 0.16, 0.128, 0, -0.35, 0), 0);
    add('spine', 'ink', drum(0.006, 0.05, 5), M(-0.08, 0.19, 0.13), 0);
  }
  if (f.lanyard) {
    for (const x of [-1, 1]) add('spine', 'lanyard', tube(`lanyard${x}`, [[x * 0.075, 0.3, 0.02], [x * 0.07, 0.24, 0.11], [x * 0.03, 0.15, 0.137], [0, 0.12, 0.138]], 0.007, { seg: 6, radial: 4 }), M(), 0);
    add('spine', 'card', chamfer(0.06, 0.08, 0.008, 0.003), M(0, 0.075, 0.142), 0.004);
  }
  if (f.badge) {
    add('spine', 'accent', drum(0.026, 0.012, 10), M(0.1, 0.19, 0.142, Math.PI / 2, 0, 0), 0.004);
    add('spine', 'accent', chamfer(0.02, 0.04, 0.006, 0.002), M(0.1, 0.155, 0.14, 0, 0, 0.2), 0);
  }
  if (f.stethoscope) {
    add('spine', 'strap', tube('steth', [[-0.06, 0.1, 0.14], [-0.1, 0.2, 0.115], [-0.09, 0.29, 0.03], [0, 0.315, -0.05], [0.09, 0.29, 0.03], [0.1, 0.2, 0.115], [0.07, 0.12, 0.14]], 0.008, { seg: 16, radial: 4 }), M(), 0);
    add('spine', 'chrome', drum(0.022, 0.012, 10), M(0.07, 0.105, 0.145, Math.PI / 2, 0, 0), 0.004);
  }
  // head and face
  add('head', 'skin', G.head(), M(0, DIM.headY, 0, 0, 0, 0, [1.02, 0.98, 1]), 0.012);
  add('head', 'skin', ball(0.03, 8), onFace(FACE.nose[0], 0, -0.004, [1, 0.8, 1]), 0);
  for (const [s, az] of [['L', 1], ['R', -1]]) {
    add(`eye${s}`, 'ink', ball(0.05, 10), M(0, 0, 0, 0, 0, 0, [0.72, 1.12, 0.4]), 0);
    add(`eye${s}`, 'glint', ball(0.016, 6), M(az * 0.012, 0.022, 0.017), 0);
    add(`happy${s}`, 'ink', torus(0.034, 0.011, 4, 10, Math.PI), M(0, -0.012, 0), 0);
    add(`brow${s}`, 'ink', chamfer(0.08, 0.02, 0.02, 0.007), M(), 0);
    add('head', 'blush', disc(0.045, 10), onFace(FACE.cheek[0], az * FACE.cheek[1], 0.009, [1, 0.6, 1]), 0);
  }
  add('mSmile', 'ink', torus(0.042, 0.011, 4, 10, Math.PI), M(0, 0.02, 0, 0, 0, Math.PI), 0);
  add('mGrin', 'mouth', disc(0.058, 12, Math.PI, Math.PI), M(0, 0.018, 0), 0);
  add('mGrin', 'ink', torus(0.058, 0.009, 3, 12, Math.PI), M(0, 0.018, 0, 0, 0, Math.PI), 0);
  add('mO', 'mouth', disc(0.034, 12), M(0, 0, 0, 0, 0, 0, [0.85, 1, 1]), 0);
  add('mO', 'ink', torus(0.034, 0.008, 3, 12), M(0, 0, 0, 0, 0, 0, [0.85, 1, 1]), 0);
  add('mFrown', 'ink', torus(0.036, 0.011, 4, 10, Math.PI), M(0, -0.018, 0), 0);
  add('mFlat', 'ink', chamfer(0.07, 0.016, 0.012, 0.006), M(), 0);
  if (f.glasses) {
    for (const az of [1, -1]) add('head', 'ink', torus(0.056, 0.009, 4, 14), onFace(FACE.eye[0] - 0.02, az * FACE.eye[1], 0.035), 0.004);
    add('head', 'ink', chamfer(0.06, 0.014, 0.012, 0.004), onFace(FACE.eye[0] + 0.02, 0, 0.04), 0);
  }
  hairPieces(spec, add);
  if (f.goggles) {
    add('head', 'strap', lathe('goggle-strap', [[0.3, 0.2], [0.305, 0.17], [0.3, 0.14]], 16), M(0, DIM.headY, 0, -0.35, 0, 0), 0.006);
    for (const az of [1, -1]) add('head', 'lens', drum(0.05, 0.04, 12), onFace(0.78, az * 0.3, 0.035), 0.006);
  }
  if (f.headband) add('head', 'accent', lathe('headband', [[0.29, 0.1], [0.3, 0.06], [0.292, 0.02]], 16), M(0, DIM.headY + 0.05, 0, -0.4, 0, 0), 0.006);
  return out;
}

function hairPieces(spec, add) {
  const st = spec.flags.hairStyle, Y = DIM.headY;
  const cap = (theta = 1.5, tilt = -0.62, r = 0.288) => add('head', 'hair', hairCap(r, theta), M(0, Y, 0, tilt, 0, 0), 0.012);
  if (st === 'short') {
    cap();
    add('head', 'hair', ball(0.09, 8), M(0.06, Y + 0.2, 0.19, 0.4, 0, 0.35, [1.5, 0.5, 0.8]), 0.008);
    add('head', 'hair', ball(0.08, 8), M(-0.07, Y + 0.215, 0.18, 0.4, 0, -0.3, [1.4, 0.5, 0.8]), 0.008);
  } else if (st === 'bob') {
    cap(1.5, -0.55);
    add('head', 'hair', openLathe('bob', [[0.28, 0.16], [0.305, 0.04], [0.305, -0.08], [0.28, -0.15], [0.255, -0.14]], 16, 0.95), M(0, Y, 0), 0.012);
  } else if (st === 'long') {
    cap(1.5, -0.55);
    add('head', 'hair', openLathe('long', [[0.28, 0.16], [0.31, 0.02], [0.31, -0.16], [0.285, -0.3], [0.25, -0.31]], 16, 1.05), M(0, Y, 0), 0.012);
  } else if (st === 'bun') {
    cap(1.55, -0.5);
    add('head', 'hair', ball(0.11, 10), M(0, Y + 0.27, -0.12), 0.01);
  } else if (st === 'ponytail') {
    cap(1.55, -0.5);
    add('head', 'hair', ball(0.075, 8), M(0, Y + 0.13, -0.27), 0.008);
    add('head', 'hair', lathe('ponytail', [[0, 0], [0.06, -0.03], [0.068, -0.12], [0.045, -0.24], [0, -0.28]], 8), M(0, Y + 0.12, -0.3, 0.45, 0, 0), 0.008);
  } else if (st === 'curly') {
    cap(1.35, -0.55, 0.28);
    const spots = [[1.45, 0], [0.95, 0.2], [0.95, -0.9], [0.95, 0.9], [0.95, 2.0], [0.95, -2.0], [0.95, Math.PI], [0.35, 1.35], [0.35, -1.35], [0.35, 2.3], [0.35, -2.3], [0.3, Math.PI], [1.0, -0.25]];
    spots.forEach(([el, az], i) => add('head', 'hair', ball(0.1 + (i % 3) * 0.01, 8), alongNormal(el, az, 0.25), 0.008));
  } else if (st === 'spiky') {
    cap(1.45, -0.55);
    const spots = [[1.2, 0.3], [1.25, 2.3], [1.2, -1.9], [0.8, 0.7], [0.8, -0.6], [0.75, 1.7], [0.75, -1.5], [0.7, 2.7], [0.7, -2.7]];
    spots.forEach(([el, az]) => add('head', 'hair', lathe('spike', [[0, 0], [0.06, 0], [0, 0.14]], 6), alongNormal(el, az, 0.25), 0.006));
  } else if (st === 'bald') {
    add('head', 'hair', arcLathe('bald-ring', [[0.272, 0.04], [0.29, -0.02], [0.28, -0.09], [0.26, -0.1]], 14, 1.5, Math.PI * 2 - 3.0), M(0, Y, 0), 0.008);
  }
  if (spec.flags.beard) {
    add('head', 'hair', arcLathe('beard', [[0.1, -0.265], [0.19, -0.225], [0.245, -0.16], [0.268, -0.1], [0.262, -0.08]], 14, -1.35, 2.7), M(0, Y, 0.012), 0.008);
  }
}
