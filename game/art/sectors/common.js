// sectors/common.js: what the sector packs share.
//
// Each client sector (lab, gym, school, clinic, hall, coworking) is a district of its own in the
// game, with its own props (sectors/<sector>.js). Every asset carries `sector`, stands on a contact
// shadow, is outlined and toon-shaded, and colours itself from theme palette keys (the office keys
// plus the "Sectors" group: labTop, fluid, hazard, rubber, gymAccent, yogaMat, chalkboard, locker,
// mint, medical, velvet, felt, coral), so it recolours live.
//
//   SECTOR_ASSETS[sector]       the ids a sector pack registered, in order
//   sectorAsset(sector)(id, def)  registers an asset of that sector (def as in registry.register, with build(g, opts))
//   CORNERS[sector] = { floor, props: [[id, x, z, turn, height], ...] }
//                               a furnished corner of a 6x6 floor patch (the catalogue's "sector corner"):
//                               props stand on the floor (height 0) or on a placed asset's userData.surface
//   pleats(key, w, h, { folds, depth, t })  a pleated curtain: a wavy strip in plan, extruded up, centred
//   ring(key, R, r, seg, radial)  a torus about Y (tyres, hand rims, coils): radius R, tube radius r
//   wallRun(windows)            the corner's back and left walls (office wall pieces), windows at the given back x
import * as THREE from 'three';
import { defineAsset } from '../parts.js';
import { plan, lathe } from '../shapes.js';

export const SECTORS = Object.freeze(['lab', 'gym', 'school', 'clinic', 'hall', 'coworking']);
export const SECTOR_ASSETS = Object.fromEntries(SECTORS.map((s) => [s, []]));
export const CORNERS = {};

export const sectorAsset = (sector) => {
  if (!SECTOR_ASSETS[sector]) throw new Error(`unknown sector "${sector}"`);
  return (id, def) => defineAsset(SECTOR_ASSETS[sector], id, { ...def, sector });
};
export function corner(sector, floor, props) { CORNERS[sector] = { floor, props }; }

export function wallRun(windows = []) {
  return [
    ...[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((x) => [windows.includes(x) ? 'wall-window' : 'wall-segment', x, -2.9, 0]),
    ...[-1.5, -0.5, 0.5, 1.5, 2.5].map((z) => ['wall-segment', -2.9, z, Math.PI / 2]),
  ];
}

export function pleats(key, w, h, { folds = 8, depth = 0.05, t = 0.02, bev = 0.006 } = {}) {
  const n = folds * 8, k = (folds * Math.PI * 2) / w;
  const s = new THREE.Shape();
  const front = [], back = [];
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w * i) / n, z = Math.sin(x * k) * depth;
    front.push([x, z + t / 2]); back.push([x, z - t / 2]);
  }
  s.moveTo(...front[0]);
  for (const p of front.slice(1)) s.lineTo(...p);
  for (const p of back.reverse()) s.lineTo(...p);
  s.closePath();
  return plan(`pleats-${key}`, s, h, { bev, bs: 1, cs: 1 });
}

export function ring(key, R, r, seg = 20, radial = 8) {
  const pts = [];
  for (let i = 0; i <= radial; i++) { const a = -Math.PI / 2 + (i / radial) * Math.PI * 2; pts.push([R + Math.cos(a) * r, Math.sin(a) * r]); }
  return lathe(`ring-${key}`, pts, seg);
}
