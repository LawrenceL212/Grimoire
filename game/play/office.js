// office.js: the living office. The map, the light, the people seeded from the world, the drone (you)
// with one shared effects layer, and the camera framing. Everything 3D on the play page lives here, so
// main.js can boot the game without it when WebGL is missing (it is loaded with a dynamic import).
//
//   createOffice(stage, { reducedMotion }) -> office
//     .map, .drone, .fx, .people (Map bookingId -> { person, booking, room, seat }), .staff
//     .seed(objects, clock)         seat the bookings running at the office clock (and nobody else)
//     .reconcile(objects, clock)    make the office match the world at once (no walking)
//     .running(objects, clock)      [{ booking, room }] the bookings running now, in rooms the office has
//     .roomFor(objects, roomId)     the map room of a world room id (or null)
//     .enter(booking, room, objects) -> { entry, done }   someone walks in from the door and sits
//     .leave(bookingId) -> Promise  someone stands and walks out of the door (then is gone)
//     .freeSeat(room), .standSpot(room), .census() -> { people, seated, leaving, tickets, walkers, drone }
//     .setRooms(clashIds)           room glows from the real world (a set of world room ids that clash)
//     .occupants()                  [{ bookingId, name, room, inRoom, seated }]
//     .frame(rects)                 fit the office into the part of the scene the windows leave free
//     .overview() / .focus(roomName)   the camera: the whole office, or one room close up
//     .update(dt, t), .bench(n), .stats(), .dispose()
//     .drones { sql, js, php }: Sequel, Jay and Hex, one drone per language; .drone is the one acting now
//     .useDrone(lang)               the drone of the language used acts out the run (the others wait at the desk)
//     .rest                         where the acting drone waits; .resetDrones() puts every drone back
//     .relabel(worldRooms)          the floor labels say the world's room names (room-1 is rooms.id 1)
//     .pick(x, y) -> bookingId      the booking of the person under a screen point (or null)
//     .screenOf(bookingId | 'drone') -> { x, y } in CSS pixels of the canvas (or null)
//   story.js drives .drone, .people and .map.traffic through these.
import * as THREE from 'three';
import { get as tget, onThemeChange } from '../engine/theme.js';
import { Person, ROLES } from '../art/people.js';
import { Drone } from '../art/drone.js';
import { Effects } from '../art/fx.js';
import { buildMap } from './map.js';

// the drone reads small at game distance: the play page gives it extra size (theme drone.playScale)
class PlayDrone extends Drone { _scale() { return super._scale() * (tget('drone.playScale') || 1); } }

const SKY_DUSK = new THREE.Color(0x5b5f9e), SUN_DUSK = new THREE.Color(0x7c78c8);

export function createOffice(stage, { reducedMotion = false } = {}) {
  const { scene, camera, renderer } = stage;
  const phone = matchMedia('(max-width: 720px)').matches;
  renderer.setClearColor(0x000000, 0);

  // ---------------------------------------------------------------- light (Warm dusk by default)
  const hemi = new THREE.HemisphereLight(0xffe0b5, 0x2a1d14, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(phone ? 1024 : 1536, phone ? 1024 : 1536);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  { const c = sun.shadow.camera; c.left = -13; c.right = 13; c.top = 11; c.bottom = -11; c.near = 20; c.far = 90; }
  const sunDir = new THREE.Vector3(-0.5, 0.95, 0.55).normalize();
  sun.target.position.set(0, 0, 0); sun.position.copy(sun.target.position).addScaledVector(sunDir, 50);
  const rim = new THREE.DirectionalLight(0x8f86ff, 1);
  rim.position.set(18, 24, -36);
  const lamps = [[-2.5, 3.2, -3.4], [2.5, 3.2, 2.6]].map(([x, y, z]) => { const l = new THREE.PointLight(0xffc98a, 1, 12, 1.6); l.position.set(x, y, z); return l; });
  scene.add(hemi, sun, sun.target, rim, ...lamps);
  function light() {
    const d = tget('light.dusk');
    sun.color.set(tget('light.sunColor')).lerp(SUN_DUSK, d * 0.55);
    sun.intensity = tget('light.sun') * (1 - 0.55 * d);
    hemi.color.set(0xffe0b5).lerp(SKY_DUSK, d * 0.7); hemi.intensity = tget('light.hemi') * (1 - 0.35 * d);
    rim.color.set(tget('light.rimColor')); rim.intensity = tget('light.rim') * (0.6 + 0.8 * d);
    for (const l of lamps) { l.color.set(tget('play.lampColor')); l.intensity = 3 * tget('light.lamps'); }
    renderer.toneMappingExposure = tget('light.exposure');
    sun.shadow.radius = Math.max(0.01, tget('light.shadowSoft'));
    scene.fog = tget('toggles.fog') ? new THREE.Fog(tget('palette.bg'), 40, 90) : null;
  }
  light();
  const offTheme = onThemeChange((p) => { if (!p || p.startsWith('light') || p.startsWith('play.') || p.startsWith('toggles') || p === 'palette.bg') light(); });

  // ---------------------------------------------------------------- the map, the effects, the drone
  const map = buildMap(stage);
  stage.setPanBounds({ minX: map.bounds.x0 - 2, maxX: map.bounds.x1 + 2, minZ: map.bounds.z0 - 2, maxZ: map.bounds.z1 + 2 });
  const fx = new Effects({ reducedMotion });
  map.root.add(fx.root);
  // one drone per language (Task 14): Sequel for SQL, Jay for JavaScript, Hex for PHP. They share the desk;
  // the drone of the language a run used acts it out, so the learner sees which language did what
  const myDesk = map.lookup('my-desk');
  const homes = {
    sql: new THREE.Vector3(myDesk.position.x - 0.1, 0, myDesk.position.z - 0.35),
    js: new THREE.Vector3(myDesk.position.x + 0.65, 0, myDesk.position.z - 0.15),
    php: new THREE.Vector3(myDesk.position.x - 0.85, 0, myDesk.position.z - 0.15),
  };
  const drones = {};
  for (const [lang, persona] of [['sql', 'sequel'], ['js', 'jay'], ['php', 'hex']]) {
    const d = new PlayDrone({ fx, reducedMotion, persona });
    d.root.position.copy(homes[lang]);
    d.faceCamera(camera);
    d.express('happy');
    map.root.add(d.root);
    // the drone hovers: its own soft blob on the floor is its shadow (a sun shadow of 17 parts costs a draw call each)
    d.root.traverse((o) => { o.castShadow = false; });
    drones[lang] = d;
  }
  let active = 'sql';
  let drone = drones.sql;
  function useDrone(lang) {
    if (!drones[lang] || lang === active) return drone;
    if (drone.state !== 'idle') { drone.cancel(); drone.root.position.copy(homes[active]); }
    active = lang; drone = drones[lang];
    return drone;
  }
  function resetDrones() { for (const [l, d] of Object.entries(drones)) { d.reset(); d.root.position.copy(homes[l]); } }

  // ---------------------------------------------------------------- people
  const people = new Map();
  const staff = [];
  const roleOf = (personId) => ROLES[(Number(personId) || 0) % ROLES.length];
  function settle(p, n = 8) { for (let i = 0; i < n; i++) p.update(0.1); }
  // the receptionist: part of the office, not of the world (not a booking)
  {
    const chair = map.lookup('reception-chair');
    const p = new Person({ role: 'office', seed: 7, name: 'Receptionist', reducedMotion, prop: null });
    const s = chair.userData.seat;
    p.root.position.set(chair.position.x, 0, chair.position.z + 0.3);
    map.root.add(p.root);
    p.sit(chair); p.play('type'); settle(p);
    staff.push({ person: p, chair, home: 'reception', next: 18 + Math.random() * 10, busy: false, s });
  }
  const leaving = new Set(); // people walking out of the office (no longer in the world); disposed at the door
  const isStaff = (p) => staff.some((s) => s.person === p);
  function clearPeople() {
    for (const { person } of people.values()) person.dispose();
    people.clear();
    for (const p of leaving) p.dispose();
    leaving.clear();
  }
  // the bookings running at the office clock, in a room the office has, earliest first
  // a world room is the map room of the same id (room-1 is rooms.id 1), whatever the world calls it now:
  // renaming a room in the world does not make it vanish from the office
  const roomOf = (roomId) => map.rooms.find((r) => r.id === `room-${roomId}`) || null;
  function running(objects, clock) {
    const now = Date.parse(clock);
    const exists = new Set((objects.rooms || []).map((r) => r.id));
    return (objects.bookings || [])
      .filter((b) => Date.parse(b.start_at) <= now && Date.parse(b.end_at) > now && exists.has(b.room_id))
      .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at) || a.id - b.id)
      .map((b) => ({ booking: b, room: roomOf(b.room_id) }))
      .filter((x) => x.room);
  }
  const roomFor = (objects, roomId) => ((objects.rooms || []).some((r) => r.id === roomId) ? roomOf(roomId) : null);
  function makePerson(b, objects) {
    const who = (objects.people || []).find((p) => p.id === b.person_id);
    const p = new Person({ role: roleOf(b.person_id), seed: 100 + b.id, name: who?.name || `Booking ${b.id}`, reducedMotion });
    map.root.add(p.root);
    return p;
  }
  // a seat in the room nobody has taken (or is on the way to), or null
  function freeSeat(room, except = null) {
    const taken = new Set([...people.values()].filter((e) => e !== except).map((e) => e.seat));
    return room.seats.find((s) => s && !taken.has(s)) || null;
  }
  // where someone without a seat stands: by the desk, side by side
  function standSpot(room) {
    const a = map.approach(room.desk);
    const n = [...people.values()].filter((e) => e.room === room && !e.seat).length;
    return { x: a.x + (n - 0.5) * 0.55, z: a.z };
  }
  // put a booking's person in place at once (no walking)
  function place(b, room, objects) {
    const p = makePerson(b, objects);
    const entry = { person: p, booking: b, room, seat: null };
    const seat = freeSeat(room);
    if (seat) {
      const a = map.approach(seat);
      p.root.position.set(a.x, 0, a.z);
      p.sit(seat); p.play(room.seats.indexOf(seat) === 0 ? 'sit' : 'talk');
      entry.seat = seat;
    } else {
      const a = standSpot(room);
      p.root.position.set(a.x, 0, a.z); p.face(Math.PI);
    }
    settle(p);
    people.set(b.id, entry);
    return entry;
  }
  // make the office match the world at the clock without any walking: people whose booking is no longer
  // running here go, missing ones appear in their room, someone else on a booking (another person_id)
  // replaces the one sitting there, anyone given a seat but not in it (an escort that ran out of time)
  // is put in it, and everyone keeps their latest booking row and name
  function reconcile(objects, clock) {
    const want = new Map(running(objects, clock).map((x) => [x.booking.id, x]));
    for (const [id, e] of [...people]) {
      const w = want.get(id);
      const stranded = e.seat && !e.person.seat && !e.person.tr && !map.traffic.has(e.person);
      if (!w || w.room !== e.room || w.booking.person_id !== e.booking.person_id || stranded) {
        map.traffic.clear((p) => p !== e.person); e.person.dispose(); people.delete(id);
      }
    }
    for (const [id, w] of want) {
      const e = people.get(id);
      if (e) {
        e.booking = w.booking;
        const who = (objects.people || []).find((p) => p.id === w.booking.person_id);
        if (who) e.person.name = who.name;
      } else place(w.booking, w.room, objects);
    }
  }
  function seed(objects, clock) {
    clearPeople();
    map.traffic.clear(isStaff); // the receptionist keeps her errand; everyone else is gone
    reconcile(objects, clock);
  }
  // someone arrives through the front door and takes a seat in the room (or stands by the desk)
  function enter(b, room, objects) {
    const p = makePerson(b, objects);
    const d = map.doors[0].outside;
    p.root.position.set(d.x, 0, d.z);
    const seat = freeSeat(room);
    const to = seat ? map.approach(seat) : standSpot(room);
    const entry = { person: p, booking: b, room, seat };
    people.set(b.id, entry);
    const done = map.traffic.send(p, to, seat ? { seat } : {})
      .then((ok) => { if (ok && seat) p.play('talk'); if (ok && !seat) p.face(Math.PI); return ok; });
    return { entry, done };
  }
  // someone whose booking has gone stands up and walks out of the front door
  function leave(id) {
    const e = people.get(id);
    if (!e) return Promise.resolve(false);
    people.delete(id);
    leaving.add(e.person);
    const p = e.person;
    return map.traffic.send(p, map.doors[0].outside).then((ok) => { if (leaving.delete(p)) p.dispose(); return ok; });
  }
  // counts for tests and the Reset check: people in the scene, ticket cards, walkers (staff apart)
  function census() {
    let n = 0;
    map.root.traverse((o) => { if (o.userData.person && !isStaff(o.userData.person)) n++; });
    const walkers = [...people.values()].filter((e) => map.traffic.has(e.person)).length + [...leaving].filter((p) => map.traffic.has(p)).length;
    return { people: n, seated: people.size, leaving: leaving.size, tickets: fx.stats().tickets, walkers, drone: drone.state };
  }
  function setRooms(clashRoomIds) {
    for (const r of map.rooms) map.setRoomState(r.id, [...clashRoomIds].some((id) => roomOf(id) === r) ? 'clash' : 'calm');
  }
  function occupants() {
    return [...people.values()].map(({ person, booking, room }) => {
      const at = map.roomAt(person.root.position.x, person.root.position.z);
      return { bookingId: booking.id, name: person.name, room: room.name, inRoom: !!at && at.id === room.id, seated: !!person.seat };
    });
  }

  // the receptionist gets up for water now and then (and shows the traffic at work)
  function ambient(dt) {
    for (const s of staff) {
      if (s.busy) continue;
      s.next -= dt;
      if (s.next > 0) continue;
      s.busy = true;
      const home = () => map.traffic.send(s.person, map.approach(s.chair), { seat: s.chair });
      const trip = s.away ? home() // an errand was stopped: go back to the desk first
        : map.traffic.send(s.person, map.approach(map.lookup('water-cooler')))
          .then((ok) => { if (!ok) return false; s.person.face(-Math.PI / 2); return new Promise((r) => setTimeout(() => r(true), 2200)); })
          .then(() => home());
      s.away = true;
      trip.then((ok) => {
        s.busy = false;
        if (ok) { s.away = false; s.person.play('type'); s.next = 25 + Math.random() * 20; } else s.next = 1;
      });
    }
  }

  // ---------------------------------------------------------------- camera framing
  const box = new THREE.Box3(new THREE.Vector3(map.bounds.x0 - 0.3, 0, map.bounds.z0 - 0.3), new THREE.Vector3(map.bounds.x1 + 0.3, 1.5, map.bounds.z1 + 0.3));
  const home = new THREE.Vector3(0, 0, 0.2);
  let free = null; // { x, y, w, h } of the scene left free by the HUD and the windows
  let focused = null;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  function viewport() { const c = renderer.domElement; return { W: c.clientWidth || 1, H: c.clientHeight || 1 }; }
  function applyOffset() {
    const { W, H } = viewport();
    const f = free || { x: 0, y: 0, w: W, h: H };
    camera.setViewOffset(W, H, (W / 2) - (f.x + f.w / 2), (H / 2) - (f.y + f.h / 2), W, H);
  }
  // fit: the eight corners of the office, projected, inside the free rectangle
  function frame(rects = [], hudH = 64) {
    const { W, H } = viewport();
    let left = 0, right = 0;
    for (const r of rects) {
      if (r.x + r.w / 2 < W / 2) left = Math.max(left, r.x + r.w + 8);
      else right = Math.max(right, W - r.x + 8);
    }
    if (W - left - right < W * 0.4) { left = right = 0; } // windows everywhere: frame the whole view
    free = { x: left, y: hudH, w: W - left - right, h: H - hudH };
    applyOffset();
    const zoom = tget('camera.zoom');
    let dist = 30;
    for (let k = 0; k < 3; k++) {
      stage.setDistance(dist * zoom, focused ? focused : home);
      camera.updateMatrixWorld();
      let mx = 0, my = 0;
      for (const c of corners) {
        const v = c.clone().project(camera);
        // NDC of the full canvas -> pixels relative to the free rectangle's centre
        const px = (v.x * 0.5 + 0.5) * W - (free.x + free.w / 2), py = (-v.y * 0.5 + 0.5) * H - (free.y + free.h / 2);
        mx = Math.max(mx, Math.abs(px) / (free.w / 2)); my = Math.max(my, Math.abs(py) / (free.h / 2));
      }
      dist *= Math.max(mx, my) / 0.94;
    }
    stage.setDistance(dist * zoom, home);
    focused = null;
    fitDist = dist * zoom;
  }
  let fitDist = 30;
  // the home room reuses this camera: aim the framing (and the pan limits) at another floor, or back at the office's own
  function setFocusBox(b = map.bounds) {
    box.min.set(b.x0 - 0.3, 0, b.z0 - 0.3); box.max.set(b.x1 + 0.3, 1.5, b.z1 + 0.3);
    let k = 0;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners[k++].set(x, y, z);
    home.set((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2 + 0.2);
    stage.setPanBounds({ minX: b.x0 - 2, maxX: b.x1 + 2, minZ: b.z0 - 2, maxZ: b.z1 + 2 });
  }
  function overview() { focused = null; return stage.focus(home, { zoom: tget('camera.zoom') }); }
  function focus(roomName) {
    const r = map.rooms.find((x) => x.name === roomName || x.id === roomName) || map.rooms[0];
    focused = r.center.clone().add(new THREE.Vector3(0, 0, 0.6));
    return stage.focus(focused, { zoom: tget('camera.zoom') * 1.75 });
  }
  const onResize = () => applyOffset();
  addEventListener('resize', onResize);

  // ---------------------------------------------------------------- the frame
  function update(dt, t) {
    for (const { person } of people.values()) person.update(dt, t);
    for (const p of leaving) p.update(dt, t);
    for (const s of staff) s.person.update(dt, t);
    ambient(dt);
    for (const d of Object.values(drones)) d.update(dt, t);
    fx.update(dt, t);
    map.update(dt, t);
  }
  // measured, not estimated: draw calls and triangles of one full frame (shadow pass included), and
  // the frame's work: `work` is the CPU side (update + render submission), `full` waits for the GPU
  function stats() {
    renderer.render(scene, camera);
    const { calls, triangles } = renderer.info.render;
    return { calls, triangles, people: people.size + leaving.size + staff.length, programs: renderer.info.programs?.length ?? 0, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  }
  function bench(n = 120) {
    const gl = renderer.getContext(), px = new Uint8Array(4);
    const work = [], full = [];
    let t = performance.now() / 1000;
    // warm up first (shader programs, uploads, and the GPU's clocks), then measure
    for (let i = 0; i < 60; i++) { t += 1 / 60; update(1 / 60, t); renderer.render(scene, camera); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      t += 1 / 60;
      update(1 / 60, t);
      renderer.render(scene, camera);
      const t1 = performance.now();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the GPU to finish the frame
      const t2 = performance.now();
      work.push(t1 - t0); full.push(t2 - t0);
    }
    // throughput: n frames back to back and one wait at the end (CPU and GPU overlap as in the real loop)
    const tp0 = performance.now();
    for (let i = 0; i < n; i++) { t += 1 / 60; update(1 / 60, t); renderer.render(scene, camera); }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const throughput = (performance.now() - tp0) / n;
    const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(2); };
    const mean = (a) => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
    const c = renderer.domElement;
    return { frames: n, size: `${c.width}x${c.height}`, workMean: mean(work), workP95: p(work, 0.95), fullMean: mean(full), fullP95: p(full, 0.95), throughput: +throughput.toFixed(2) };
  }
  function dispose() {
    offTheme(); removeEventListener('resize', onResize);
    clearPeople(); for (const s of staff) s.person.dispose();
    for (const d of Object.values(drones)) d.dispose();
    fx.dispose(); map.dispose();
  }
  // the floor labels follow the world's room names
  function relabel(worldRooms = []) { for (const r of worldRooms) { const m = roomOf(r.id); if (m) map.relabel(m.id, r.name); } }
  // picking: the person under a screen point, as the booking they sit for
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(x, y) {
    if (!map.root.visible) return null; // the office is hidden (the player is at home)
    const c = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - c.left) / c.width) * 2 - 1, -((y - c.top) / c.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const roots = [...people.values()].map((e) => e.person.root);
    const hit = ray.intersectObjects(roots, true)[0];
    if (!hit) return null;
    for (const [id, e] of people) { let o = hit.object; while (o) { if (o === e.person.root) return id; o = o.parent; } }
    return null;
  }
  const V = new THREE.Vector3();
  function screenOf(what) {
    let obj = null;
    if (what === 'drone') obj = drone.root;
    else obj = people.get(what)?.person.root || null;
    if (!obj) return null;
    obj.getWorldPosition(V); V.y += what === 'drone' ? 0.9 : 1.1;
    V.project(camera);
    const c = renderer.domElement.getBoundingClientRect();
    if (V.z > 1) return null;
    return { x: c.left + (V.x * 0.5 + 0.5) * c.width, y: c.top + (-V.y * 0.5 + 0.5) * c.height };
  }
  return { map, fx, people, staff, seed, reconcile, running, roomFor, roomOf, freeSeat, standSpot, enter, leave, census, setRooms, occupants, frame, overview, focus, update, stats, bench, dispose,
    drones, useDrone, resetDrones, relabel, pick, screenOf, setFocusBox,
    get drone() { return drone; }, get rest() { return homes[active]; }, get activeLang() { return active; },
    get focused() { return !!focused; }, get fitDistance() { return fitDist; } };
}
