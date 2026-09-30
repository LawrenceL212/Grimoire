// people/sheet.js: review scenes for the people, shown by the catalogue.
//
//   buildPeopleScene('sheet') : one row per role, one column per state, every state animating
//                               (sit and type on real office chairs, type at a real desk)
//   buildPeopleScene('office'): the furnished office corner at work: two people typing at desks, one on
//                               the sofa talking, one frustrated at the filing cabinet, two walking the
//                               same loop (they keep apart), one carrying a box
//   -> { group, people, update(dt, t), center: Vector3, radius, dispose() }
import * as THREE from 'three';
import { make } from '../registry.js';
import { canvasTex } from '../../engine/kit.js';
import { tileField } from '../materials.js';
import { Person, STATES, ROLES } from '../people.js';

function label(text, w = 1.5, size = 0.3) {
  const tex = canvasTex(512, 96, (g) => {
    g.fillStyle = 'rgba(20,16,13,0.78)'; g.beginPath(); g.roundRect(4, 8, 504, 80, 30); g.fill();
    g.fillStyle = '#efe6d2'; g.font = '700 50px system-ui, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 50);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.userData.label = text;
  return m;
}
const place = (g, id, x, z, ry = 0, y = 0, opts = {}) => { const o = make(id, opts); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };

export function buildPeopleScene(kind = 'sheet') {
  const group = new THREE.Group();
  group.name = `people-${kind}`;
  const people = [], loops = [];
  if (kind === 'sheet') {
    const DX = 1.9, DZ = 2.1, W = STATES.length, H = ROLES.length;
    const x0 = -((W - 1) * DX) / 2, z0 = -((H - 1) * DZ) / 2;
    const cells = [];
    for (let i = -1; i < Math.ceil(W * DX) + 1; i++) for (let j = -1; j < Math.ceil(H * DZ) + 2; j++) cells.push([x0 - DX / 2 + i + 0.5, z0 - DZ / 2 + j + 0.5]);
    group.add(tileField('wood', cells));
    STATES.forEach((s, c) => { const l = label(s); l.position.set(x0 + c * DX, 0.02, z0 - DZ / 2 - 0.2); group.add(l); });
    ROLES.forEach((role, r) => {
      const z = z0 + r * DZ;
      const l = label(role, 1.2, 0.26); l.position.set(x0 - DX * 0.5 - 0.1, 0.02, z + 0.6); l.rotation.z = Math.PI / 2; group.add(l);
      STATES.forEach((s, c) => {
        const x = x0 + c * DX;
        const p = new Person({ role, seed: r * 7 + c + 1, name: `${role}-${s}` });
        p.root.position.set(x, 0, z);
        group.add(p.root);
        if (s === 'sit' || s === 'type') {
          const chair = place(group, 'office-chair', x, z);
          if (s === 'type') place(group, 'desk', x, z + 0.5, Math.PI);
          p.sit(chair);
        }
        p.play(s);
        people.push(p);
      });
    });
    const center = new THREE.Vector3(0, 0.6, 0.2);
    return finish(group, people, loops, center, Math.hypot(W * DX, H * DZ) / 2);
  }
  // ---- the office corner at work (the catalogue's furnished floor patch, with its people)
  const cells = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) cells.push([i - 2.5, j - 2.5]);
  group.add(tileField('wood', cells));
  for (const x of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) place(group, x === 0.5 || x === 1.5 ? 'wall-window' : 'wall-segment', x, -2.9);
  for (const z of [-1.5, -0.5, 0.5, 1.5, 2.5]) place(group, 'wall-segment', -2.9, z, Math.PI / 2);
  place(group, 'bookshelf', -1.3, -2.35); place(group, 'plant-tall', -2.3, -2.25, 0.4); place(group, 'filing-cabinet', 2.45, -0.2, -Math.PI / 2);
  place(group, 'rug', -1.05, 0.55, Math.PI / 2); place(group, 'plant-small', -2.3, 2.1);
  const sofa = place(group, 'sofa', -2.0, 0.4, Math.PI / 2); place(group, 'coffee-table', -0.8, 0.45, Math.PI / 2);
  const code = (ctx, w, h) => {
    ctx.fillStyle = '#0f1420'; ctx.fillRect(0, 0, w, h);
    const cols = ['#d9a441', '#6fbf8b', '#86c4e0', '#e2574c', '#efe6d2'];
    for (let i = 0; i < 9; i++) { ctx.fillStyle = cols[(i * 3) % 5]; ctx.fillRect(10 + (i % 3) * 12, 10 + i * 12, 40 + ((i * 37) % 90), 6); }
  };
  // the first desk faces the back wall (its typist shows their back), the second faces the room (and the camera)
  const desks = [[-0.2, -1.6, 0], [1.75, -1.2, Math.PI]].map(([x, z, ry], i) => {
    const f = ry ? -1 : 1; // +1: the sitter faces -Z
    place(group, 'desk', x, z, ry);
    place(group, 'monitor', x - 0.05 * f, z - 0.23 * f, ry, 0.62, { draw: code });
    if (i === 0) place(group, 'mug', x + 0.45, z + 0.05, 0.4, 0.62); else place(group, 'desk-lamp', x - 0.7, z + 0.2, 2.5, 0.62);
    return place(group, 'office-chair', x - 0.22 * f, z + 0.5 * f, ry ? 0 : Math.PI);
  });
  const add = (o, x, z, yaw = 0) => { const p = new Person(o); p.root.position.set(x, 0, z); p.yaw = p.targetYaw = yaw; group.add(p.root); people.push(p); return p; };
  add({ role: 'office', seed: 3 }, 0, 0).sit(desks[0]); people.at(-1).play('type');
  add({ role: 'office', seed: 8, prop: null }, 0, 0).sit(desks[1]); people.at(-1).play('type');
  add({ role: 'council', seed: 2 }, -1.5, 0.3).sit(sofa, 1); people.at(-1).play('talk');
  add({ role: 'clinic', seed: 4 }, 1.9, -0.25, Math.PI / 2).play('frustrated');
  const loop = [[0.6, 2.2], [2.3, 2.1], [2.2, 0.8], [0.9, 0.2], [0.3, 1.1]];
  const w1 = add({ role: 'lab', seed: 5 }, 0.6, 2.2), w2 = add({ role: 'school', seed: 6 }, 0.3, 1.6);
  w2.play('carry');
  loops.push(w1, w2);
  const run = (p) => { p.walkTo([...loop.slice(1), loop[0]]).then(() => run(p)); };
  loops.forEach(run);
  add({ role: 'gym', seed: 1 }, -1.0, 2.0, 0.5).play('wave');
  return finish(group, people, loops, new THREE.Vector3(0, 0.4, 0), 4.6);
}

function finish(group, people, loops, center, radius) {
  let tAcc = 0;
  return {
    group, people, center, radius,
    update(dt, t) { tAcc += dt; for (const p of people) p.update(dt, t ?? tAcc); },
    dispose() { for (const p of people) p.dispose(); },
  };
}
