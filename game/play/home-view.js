// home-view.js: the home room in 3D. A second map built by map.js's buildMap (the same tile system as the office: floor,
// back wall with windows, west wall with the door), and the furniture, which is NOT baked so that edit mode can change it.
//
//   createHomeView(stage) -> {
//     root, map, bounds         the map's group (hidden until shown), the tile map, { x0, z0, x1, z1 }
//     show(on)                  visible or not
//     sync(items, selectedUid)  rebuild the furniture from home.items (placed ones only); a gold footprint marks the selected
//     pick(x, y, camera, canvas) -> uid | null          the furniture under a screen point
//     ground(x, y, camera, canvas) -> { x, z } | null   the floor point under a screen point
//     setCursor(spot | null)    a green (ok) or red (refused) footprint under the pointer
//     dispose()
//   }
import * as THREE from 'three';
import { make } from '../art/index.js';
import { buildMap } from './map.js';
import { CATALOG, ROOM, footOf } from './home-rules.js';

const HALF_PI = Math.PI / 2;
const xs = (a, b) => { const o = []; for (let v = a; v <= b + 1e-9; v++) o.push(v); return o; };
export const HOME_MAP = {
  size: [ROOM.w, ROOM.d],
  floors: [{ kind: 'wood', rect: [ROOM.x0, ROOM.z0, ROOM.x0 + ROOM.w, ROOM.z0 + ROOM.d] }],
  place: [
    ...xs(-2.5, 2.5).map((x) => ({ id: ROOM.windows.includes(Math.round(x + 2.5)) ? 'wall-window' : 'wall-segment', x, z: -2, edge: 'n' })),
    ...xs(-2, 2).filter((z) => z !== 1).map((z) => ({ id: 'wall-segment', x: -2.5, z, edge: 'w' })),
    { id: 'door', x: -2.5, z: 1, edge: 'w', name: 'door' },
  ],
  rooms: [],
  door: { name: 'door', outside: [-3.9, 1] },
  lane: [-3, 0.5, -2, 1.5],
};

export function createHomeView(stage) {
  const map = buildMap(stage, HOME_MAP);
  const root = map.root; root.name = 'home'; root.visible = false;
  const stuff = new THREE.Group(); stuff.name = 'home-furniture'; root.add(stuff);
  const marks = new THREE.Group(); root.add(marks);
  const bounds = { x0: ROOM.x0, z0: ROOM.z0, x1: ROOM.x0 + ROOM.w, z1: ROOM.z0 + ROOM.d };
  const objects = new Map(); // uid -> Object3D

  function mark(f, colour, opacity = 0.55) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.x1 - f.x0, f.z1 - f.z0), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -HALF_PI; m.position.set((f.x0 + f.x1) / 2, 0.035, (f.z0 + f.z1) / 2); m.renderOrder = 3; m.raycast = () => {};
    return m;
  }
  function clear(g) { for (const c of [...g.children]) { g.remove(c); c.geometry?.dispose(); c.material?.dispose(); } }
  function dropObject(o) { o.traverse((c) => { if (c.userData?.screen) c.userData.screen.texture?.dispose?.(); }); stuff.remove(o); }

  function sync(items, selectedUid = null) {
    for (const o of objects.values()) dropObject(o);
    objects.clear(); clear(marks);
    const placed = items.filter((i) => i.x !== null && i.x !== undefined);
    const surfaces = new Map();
    // floor and wall things first, so a surface exists before what stands on it
    for (const it of [...placed].sort((a, b) => (CATALOG[a.id].kind === 'top') - (CATALOG[b.id].kind === 'top'))) {
      const def = CATALOG[it.id];
      const o = make(def.asset, { ...(def.tones && it.tone ? { tone: it.tone } : {}), ...(def.asset === 'desk' ? { keyboard: false } : {}) });
      o.userData.uid = it.uid;
      let y = 0;
      if (def.kind === 'top') {
        const base = [...surfaces.values()].find(({ item, foot }) => { const f = footOf(def, it.x, it.z, it.rot); return f.x0 >= foot.x0 - 1e-6 && f.x1 <= foot.x1 + 1e-6 && f.z0 >= foot.z0 - 1e-6 && f.z1 <= foot.z1 + 1e-6; });
        y = base?.obj.userData.surface ?? 0.6;
      }
      o.position.set(it.x, y, it.z); o.rotation.y = it.rot || 0;
      if (it.id === 'desk-wobbly') o.rotation.z = 0.012; // one leg is short
      if (it.starter && it.id === 'plant-small') o.scale.set(1, 0.8, 1); // the sad plant
      o.traverse((c) => { c.userData.homeUid = it.uid; });
      stuff.add(o); objects.set(it.uid, o);
      if (def.surface) surfaces.set(it.uid, { item: it, obj: o, foot: footOf(def, it.x, it.z, it.rot) });
      if (it.uid === selectedUid) {
        const f = def.kind === 'wall' ? { x0: it.x - 0.5, x1: it.x + 0.5, z0: it.z - 0.5, z1: it.z + 0.5 } : footOf(def, it.x, it.z, it.rot);
        marks.add(mark(f, 0xd9a441, 0.6));
      }
    }
  }
  let cursor = null;
  function setCursor(spot) {
    if (cursor) { marks.remove(cursor); cursor.geometry.dispose(); cursor.material.dispose(); cursor = null; }
    if (!spot) return;
    cursor = mark(spot.foot, spot.ok ? 0x6fbf8b : 0xe2574c, 0.5); marks.add(cursor);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const aim = (x, y, camera, canvas) => {
    const c = canvas.getBoundingClientRect();
    ndc.set(((x - c.left) / c.width) * 2 - 1, -((y - c.top) / c.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  function pick(x, y, camera, canvas) {
    aim(x, y, camera, canvas);
    const hit = ray.intersectObjects([...objects.values()], true).find((h) => h.object.userData.homeUid);
    return hit ? hit.object.userData.homeUid : null;
  }
  function ground(x, y, camera, canvas) {
    aim(x, y, camera, canvas);
    const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
    return p ? { x: p.x, z: p.z } : null;
  }
  return {
    root, map, bounds, sync, pick, ground, setCursor, objects,
    show(on) { root.visible = !!on; },
    dispose() { clear(marks); for (const o of objects.values()) dropObject(o); map.dispose(); },
  };
}
