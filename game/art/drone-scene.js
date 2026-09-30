// drone-scene.js: review scenes for the drone and the effects, shown by the catalogue (People > Scene).
//
//   buildDroneScene('drone-rooms'): three rooms off a corridor. On a loop the drone scans the rooms (green,
//                                   red, green: the marks stay over the rooms), escorts a visitor to a chair in
//                                   a green room, stamps the visitor's ticket RESOLVED and celebrates
//   buildDroneScene('drone-faces'): five drones, one per expression, with the four ticket states behind them
//   -> { group, people, drone(s), fx, update(dt, t), camera(cam), center, radius, distance?, dispose() }
import * as THREE from 'three';
import { make } from './registry.js';
import { canvasTex } from '../engine/kit.js';
import { tileField } from './materials.js';
import { Person } from './people.js';
import { Drone, EXPRESSIONS } from './drone.js';
import { Effects, TICKET_STATES } from './fx.js';

const place = (g, id, x, z, ry = 0, y = 0, opts = {}) => { const o = make(id, opts); o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
function label(text, w = 1.6, size = 0.34) {
  const tex = canvasTex(512, 110, (g) => {
    g.fillStyle = 'rgba(20,16,13,0.78)'; g.beginPath(); g.roundRect(4, 8, 504, 94, 36); g.fill();
    g.fillStyle = '#efe6d2'; g.font = '700 58px system-ui, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 57);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function buildDroneScene(kind = 'drone-rooms') {
  const group = new THREE.Group();
  group.name = kind;
  if (kind === 'drone-faces') {
    const names = Object.keys(EXPRESSIONS);
    const cells = [];
    for (let i = -4; i < 4; i++) for (let j = -2; j < 2; j++) cells.push([i + 0.5, j + 0.5]);
    group.add(tileField('wood', cells));
    const drones = names.map((n, i) => {
      const d = new Drone(); d.root.position.set((i - 2) * 1.5, 0, 0.4); d.alt = 1.3; group.add(d.root); d.express(n); d.hasPrev = false;
      const l = label(n, 1.2, 0.26); l.position.set((i - 2) * 1.5, 0.02, 1.35); group.add(l);
      return d;
    });
    const fx = new Effects(); group.add(fx.root);
    TICKET_STATES.forEach((state, i) => {
      const c = fx.ticket({ title: ['09:30', '11:00', '14:15', '16:45'][i], line: ['Room 2 · Ada', 'Room 3 · Bea', 'Room 1 · Cy', 'Room 4 · Dev'][i], state });
      c.root.position.set((i - 1.5) * 1.35, 2.6, -1.3);
    });
    return {
      group, people: [], drones, fx, center: new THREE.Vector3(0, 1.2, 0), radius: 4, distance: 11,
      camera(cam) { drones.forEach((d) => d.faceCamera(cam)); },
      update(dt, t) { drones.forEach((d) => d.update(dt, t)); fx.update(dt, t); },
      dispose() { drones.forEach((d) => d.dispose()); fx.dispose(); },
    };
  }

  // ---- three rooms off a corridor
  const cells = { wood: [], lino: [], carpet: [] };
  for (let x = -6; x < 6; x++) {
    for (let z = -4; z < 1; z++) cells[x < -2 ? 'wood' : x < 2 ? 'carpet' : 'wood'].push([x + 0.5, z + 0.5]);
    for (let z = 1; z < 3; z++) cells.lino.push([x + 0.5, z + 0.5]);
  }
  for (const [k, c] of Object.entries(cells)) group.add(tileField(k, c, { seed: k.length }));
  for (let x = -5.5; x <= 5.5; x++) place(group, x === -4.5 || x === 3.5 ? 'wall-window' : 'wall-segment', x, -4.4);
  for (const x of [-6.4, -2, 2, 6.4]) for (const z of [-3.5, -2.5, -1.5, -0.5]) place(group, 'wall-segment', x, z, Math.PI / 2);
  const rooms = [[-4, -1.8], [0, -1.8], [4, -1.8]];
  rooms.forEach(([x, z], i) => { const l = label(`Room ${i + 1}`); l.position.set(x, 0.02, 0.45); group.add(l); });
  // room 1: a desk; room 2: a sofa; room 3: a chair by a desk
  place(group, 'desk', -4, -3.2); place(group, 'office-chair', -4, -2.5, Math.PI); place(group, 'plant-tall', -5.6, -3.6);
  place(group, 'sofa', 0, -3.4); place(group, 'coffee-table', 0, -2.3); place(group, 'plant-small', 1.4, -3.7);
  place(group, 'desk', 4.2, -3.2); const seat = place(group, 'office-chair', 3.2, -1.6, -0.6); place(group, 'filing-cabinet', 5.6, -3.6);
  const fx = new Effects(); group.add(fx.root);
  const drone = new Drone({ fx }); drone.root.position.set(-5, 0, 2); group.add(drone.root);
  const people = [];
  const ticket = fx.ticket({ title: '10:15', line: 'Visitor · Room 3', state: 'OPEN' });
  ticket.root.position.set(-3.4, 1.35, 2.2);
  let visitor = null, run = 0;
  const spawnVisitor = () => {
    if (visitor) { people.splice(people.indexOf(visitor), 1); visitor.dispose(); }
    visitor = new Person({ role: 'clinic', seed: 5, name: 'visitor' });
    visitor.root.position.set(-4.4, 0, 2.2); visitor.yaw = visitor.targetYaw = Math.PI / 2;
    group.add(visitor.root); people.push(visitor);
    return visitor;
  };
  const story = async () => {
    const my = ++run;
    const alive = () => run === my;
    drone.reset(); ticket.set({ state: 'OPEN' }); spawnVisitor();
    for (const [i, ok] of [[0, true], [1, false], [2, true]]) {
      if (!alive() || !(await drone.scan(new THREE.Vector3(rooms[i][0], 0, rooms[i][1]), ok, { radius: 0.9, markAt: 2.7 }))) return;
    }
    if (!alive() || !(await drone.escort(visitor, seat))) return;
    if (!alive() || !(await drone.stamp(ticket, 'RESOLVED'))) return;
    if (!alive() || !(await drone.celebrate())) return;
    await new Promise((r) => setTimeout(r, 2500));
    if (alive()) story();
  };
  story();
  return {
    group, people, drone, fx, ticket, center: new THREE.Vector3(0, 0.4, -0.6), radius: 6.5,
    camera(cam) { drone.faceCamera(cam); },
    update(dt, t) { for (const p of people) p.update(dt, t); drone.update(dt, t); fx.update(dt, t); },
    dispose() { run++; drone.dispose(); for (const p of people) p.dispose(); fx.dispose(); },
  };
}
