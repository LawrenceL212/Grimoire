// parts.js: the helpers every art pack builds its assets with (the office pack, the sector packs).
//
//   defineAsset(list, id, def)  registers an asset whose def.build(g, opts) fills a group; adds the
//                               contact shadow last and pushes the id onto list (a pack's id list)
//   adder(g) -> add(geo, material, { x, y, z, rx, ry, rz, s, outline, parent, static })  a static part of g
//   strut(add, a, b, r, material, o)   a round rod from point a to point b
//   card(g, w, h, material, o)         a flat textured plane facing +Z, never outlined
//   C(key) / G(key)                    the toon material for palette.<key>, plain or with wood grain
//   FONT, HAND                         system font stacks for canvas lettering (plain, handwritten)
//   seat(g, x, height, z, facing)      a place to sit: pushed onto g.userData.seats, the first is also
//                                      g.userData.seat. { position: [x, height, z] (the top of the seat, where
//                                      the hips go, in g's frame), facing (the yaw a sitter faces, 0 = +Z),
//                                      height (above the floor) }. A Person sits on it with sit(object[, i]).
import * as THREE from 'three';
import { register } from './registry.js';
import { contactShadow } from './materials.js';
import { part, themed } from '../engine/kit.js';
import { drum, grain } from './shapes.js';

export const C = (k) => themed(`palette.${k}`);
export const G = (k) => grain(`palette.${k}`);
export const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard SE", cursive';
const Y = new THREE.Vector3(0, 1, 0);

export function defineAsset(list, id, def) {
  list.push(id);
  const { shadow = {}, build, ...rest } = def;
  register(id, {
    ...rest,
    build(opts) {
      const g = new THREE.Group();
      g.name = id;
      build(g, opts || {});
      contactShadow(g, { footprint: def.tiles, ...shadow });
      return g;
    },
  });
}
export const adder = (g) => (geo, mat, o = {}) => part(geo, mat, { static: true, ...o, parent: o.parent || g });
export function strut(add, a, b, r, mat, o = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const m = add(drum(r, A.distanceTo(B), o.seg ?? 8, r * 0.3), mat, { outline: 0.008, ...o, x: (A.x + B.x) / 2, y: (A.y + B.y) / 2, z: (A.z + B.z) / 2 });
  m.quaternion.setFromUnitVectors(Y, B.sub(A).normalize());
  return m;
}
const planes = new Map(); // one plane per size, shared by every build
export function card(g, w, h, mat, o = {}) {
  const key = `${w},${h}`;
  if (!planes.has(key)) planes.set(key, new THREE.PlaneGeometry(w, h));
  return part(planes.get(key), mat, { outline: 0, cast: false, ...o, parent: o.parent || g });
}

export function seat(g, x, height, z, facing = 0) {
  const s = { position: [x, height, z], facing, height };
  (g.userData.seats ||= []).push(s);
  g.userData.seat ||= s;
  return s;
}
