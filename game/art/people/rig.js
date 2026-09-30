// people/rig.js: a person's skeleton, and the skinned body built over it.
//
// A person is a few SkinnedMeshes (one per colour slot: skin, hair, top, outer, bottoms, legs, shoes,
// face ink, ...) sharing one Skeleton, plus one skinned outline hull. Every piece is rigidly bound to
// one bone, so the body stays low-poly and faceted but costs about a dozen draw calls, not fifty.
// The face is bones too: eyes (blink, widen), closed "happy" eyes, brows, and five mouths that are
// shown by scaling their bone up (a hidden one is scaled to almost nothing).
//
//   DIM                    the body's measurements (world units: 1 tile = 1 unit, a chair seat is 0.5)
//   FACE                   the face features: [elevation, azimuth] on the head sphere
//   facePoint(el, az, out) a position and orientation on the head sphere (in the head bone's frame)
//   buildRig(sig, parts, slotPaths) -> { group, bones, meshes, skeleton, soles }
//     sig: a cache key for the geometry (the same sig must give the same parts), parts: see outfits.js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { themed, skinnedOutlineMat } from '../../engine/kit.js';

export const DIM = Object.freeze({
  sole: 0.075,     // ankle above the sole
  shin: 0.36,      // knee to ankle
  thigh: 0.31,     // hip joint to knee
  hipX: 0.088,     // hip joints either side of the pelvis
  hipDrop: 0.04,   // hip joints below the pelvis bone
  seatDrop: 0.1,   // the seat of the trousers below the pelvis bone (what rests on a chair)
  spineY: 0.03,    // spine above the pelvis
  shX: 0.19, shY: 0.25, upper: 0.2, fore: 0.18, // shoulders (on the spine), upper arm, forearm
  neckY: 0.29,     // head bone above the spine
  headR: 0.27, headY: 0.24, // the head sphere: radius, centre above the head bone
  hipY: 0.075 + 0.36 + 0.31, // standing hip joint height (0.745)
});
export const PELVIS_Y = DIM.hipY + DIM.hipDrop; // the pelvis bone when standing

// face features on the head sphere: [elevation, azimuth] in radians (0, 0 = the middle of the face).
// The eyes sit high on the face (elevation 0.17) so they face the steep camera more squarely.
export const FACE = Object.freeze({
  eye: [0.17, 0.34], brow: [0.43, 0.31], mouth: [-0.2, 0], cheek: [-0.06, 0.62], nose: [-0.02, 0],
});
const HEAD_C = new THREE.Vector3(0, DIM.headY, 0);
export function facePoint(el, az, out = 0) {
  const r = DIM.headR + out;
  const pos = new THREE.Vector3(Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, Math.cos(az) * Math.cos(el) * r).add(HEAD_C);
  const rot = new THREE.Euler(-el, az, 0, 'YXZ');
  return { pos, rot };
}

// [name, parent, x, y, z]; L is the person's left (+X, since a person faces +Z)
const BONES = [
  ['root', null, 0, 0, 0],
  ['pelvis', 'root', 0, PELVIS_Y, 0],
  ['hipL', 'pelvis', DIM.hipX, -DIM.hipDrop, 0], ['kneeL', 'hipL', 0, -DIM.thigh, 0], ['ankleL', 'kneeL', 0, -DIM.shin, 0],
  ['hipR', 'pelvis', -DIM.hipX, -DIM.hipDrop, 0], ['kneeR', 'hipR', 0, -DIM.thigh, 0], ['ankleR', 'kneeR', 0, -DIM.shin, 0],
  ['spine', 'pelvis', 0, DIM.spineY, 0],
  ['shL', 'spine', DIM.shX, DIM.shY, 0], ['elL', 'shL', 0, -DIM.upper, 0], ['handL', 'elL', 0, -DIM.fore, 0],
  ['shR', 'spine', -DIM.shX, DIM.shY, 0], ['elR', 'shR', 0, -DIM.upper, 0], ['handR', 'elR', 0, -DIM.fore, 0],
  ['head', 'spine', 0, DIM.neckY, 0],
];
// face bones: [name, el, az, out]
export const FACE_BONES = [
  ['eyeL', FACE.eye[0], FACE.eye[1], -0.006], ['eyeR', FACE.eye[0], -FACE.eye[1], -0.006],
  ['happyL', FACE.eye[0], FACE.eye[1], 0.004], ['happyR', FACE.eye[0], -FACE.eye[1], 0.004],
  ['browL', FACE.brow[0], FACE.brow[1], 0.006], ['browR', FACE.brow[0], -FACE.brow[1], 0.006],
  ['mSmile', FACE.mouth[0], 0, 0.006], ['mGrin', FACE.mouth[0], 0, 0.008], ['mO', FACE.mouth[0], 0, 0.008],
  ['mFrown', FACE.mouth[0] - 0.03, 0, 0.006], ['mFlat', FACE.mouth[0], 0, 0.006],
];

function makeBones() {
  const bones = {};
  for (const [name, parent, x, y, z] of BONES) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    if (parent) bones[parent].add(b);
    bones[name] = b;
  }
  for (const [name, el, az, out] of FACE_BONES) {
    const b = new THREE.Bone();
    b.name = name;
    const { pos, rot } = facePoint(el, az, out);
    b.position.copy(pos);
    b.rotation.copy(rot);
    b.userData.face = { el, az, out };
    bones.head.add(b);
    bones[name] = b;
  }
  return bones;
}

// one piece: position + normal only, non-indexed, moved to its place, rigidly bound to one bone
function piece(geo, matrix, boneIndex) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  const n = g.attributes.position.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = boneIndex; sw[i * 4] = 1; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return g;
}

const geoCache = new Map(); // sig -> { slots: [[slot, geometry]], outlines: [[thickness, geometry]] }
function bakeGeometry(sig, parts, bones, order) {
  if (geoCache.has(sig)) return geoCache.get(sig);
  const bySlot = new Map(), byOutline = new Map();
  const M = new THREE.Matrix4();
  for (const p of parts) {
    const bone = bones[p.bone];
    if (!bone) throw new Error(`person part on unknown bone "${p.bone}"`);
    const frame = bones[p.at || p.bone];
    M.multiplyMatrices(frame.matrixWorld, p.m || new THREE.Matrix4());
    const idx = order.indexOf(p.bone);
    if (!bySlot.has(p.slot)) bySlot.set(p.slot, []);
    bySlot.get(p.slot).push(piece(p.geo, M, idx));
    if (p.outline) {
      if (!byOutline.has(p.outline)) byOutline.set(p.outline, []);
      byOutline.get(p.outline).push(piece(p.geo.userData.hull || p.geo, M, idx));
    }
  }
  const out = {
    slots: [...bySlot].map(([slot, gs]) => [slot, mergeGeometries(gs)]),
    outlines: [...byOutline].map(([th, gs]) => [th, mergeGeometries(gs)]),
  };
  for (const [, g] of [...out.slots, ...out.outlines]) { g.computeBoundingBox(); g.computeBoundingSphere(); }
  geoCache.set(sig, out);
  return out;
}

export function buildRig(sig, parts, slotPaths) {
  const group = new THREE.Group();
  const bones = makeBones();
  group.add(bones.root);
  group.updateMatrixWorld(true);
  const order = Object.keys(bones);
  const skeleton = new THREE.Skeleton(order.map((n) => bones[n]));
  const baked = bakeGeometry(sig, parts, bones, order);
  const meshes = {};
  for (const [slot, geo] of baked.slots) {
    const path = slotPaths[slot];
    if (!path) throw new Error(`person slot "${slot}" has no colour`);
    const m = new THREE.SkinnedMesh(geo, themed(path));
    m.name = `person-${slot}`;
    m.castShadow = slot !== 'ink' && slot !== 'glint' && slot !== 'blush' && slot !== 'mouth';
    m.receiveShadow = true;
    m.frustumCulled = false; // the bind-pose bounds do not follow a jump or a sit
    m.userData.slot = slot;
    group.add(m);
    m.bind(skeleton);
    meshes[slot] = m;
  }
  for (const [th, geo] of baked.outlines) {
    const o = new THREE.SkinnedMesh(geo, skinnedOutlineMat(th));
    o.name = 'person-outline';
    o.userData.outlineChild = true; // measured apart from the budget (ruling P2-4)
    o.frustumCulled = false;
    o.raycast = () => {};
    group.add(o);
    o.bind(skeleton);
  }
  // the soles, for checks and for planting feet
  const soles = {};
  for (const s of ['L', 'R']) {
    const o = new THREE.Object3D();
    o.name = `sole${s}`;
    o.position.set(0, -DIM.sole, 0.03);
    bones[`ankle${s}`].add(o);
    soles[s] = o;
  }
  return { group, bones, meshes, skeleton, soles };
}
