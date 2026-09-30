// office.js: the living office. The map, the light, the people seeded from the world, the drone (you)
// with one shared effects layer, and the camera framing. Everything 3D on the play page lives here, so
// main.js can boot the game without it when WebGL is missing (it is loaded with a dynamic import).
//
//   createOffice(stage, { reducedMotion }) -> office
//     .map, .drone, .fx, .people (Map bookingId -> { person, booking, room }), .staff
//     .seed(objects, clock)         seat the bookings running at the office clock (and nobody else)
//     .setRooms(clashIds)           room glows from the real world (a set of room names that clash)
//     .occupants()                  [{ bookingId, name, room, inRoom, seated }]
//     .frame(rects)                 fit the office into the part of the scene the windows leave free
//     .overview() / .focus(roomName)   the camera: the whole office, or one room close up
//     .update(dt, t), .bench(n), .stats(), .dispose()
//   Task 9's story drives .drone, .people and .map.traffic; it replaces the minimal reaction in main.js.
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
  const fx = new Effects({ reducedMotion });
  map.root.add(fx.root);
  const drone = new PlayDrone({ fx, reducedMotion });
  const myDesk = map.lookup('my-desk');
  const rest = new THREE.Vector3(myDesk.position.x - 0.1, 0, myDesk.position.z - 0.35);
  drone.root.position.copy(rest);
  drone.faceCamera(camera);
  drone.express('happy');
  map.root.add(drone.root);
  // the drone hovers: its own soft blob on the floor is its shadow (a sun shadow of 17 parts costs a draw call each)
  drone.root.traverse((o) => { o.castShadow = false; });

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
  function clearPeople() {
    for (const { person } of people.values()) person.dispose();
    people.clear();
  }
  function seed(objects, clock) {
    clearPeople();
    map.traffic.clear();
    const now = Date.parse(clock);
    const roomName = new Map((objects.rooms || []).map((r) => [r.id, r.name]));
    const who = new Map((objects.people || []).map((p) => [p.id, p.name]));
    const running = (objects.bookings || []).filter((b) => Date.parse(b.start_at) <= now && Date.parse(b.end_at) > now)
      .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at) || a.id - b.id);
    const inRoom = new Map();
    for (const b of running) {
      const name = roomName.get(b.room_id);
      const room = map.rooms.find((r) => r.name === name);
      if (!room) continue; // a room the office does not have yet
      const k = inRoom.get(room.id) || 0; inRoom.set(room.id, k + 1);
      const p = new Person({ role: roleOf(b.person_id), seed: 100 + b.id, name: who.get(b.person_id) || `Booking ${b.id}`, reducedMotion });
      map.root.add(p.root);
      const seat = room.seats[k];
      if (seat) {
        const a = map.approach(seat);
        p.root.position.set(a.x, 0, a.z);
        p.sit(seat); p.play(k === 0 ? 'sit' : 'talk');
      } else { // more people than seats: they stand by the desk
        const a = map.approach(room.desk);
        p.root.position.set(a.x + (k - 2) * 0.55, 0, a.z); p.face(Math.PI);
      }
      settle(p);
      people.set(b.id, { person: p, booking: b, room });
    }
  }
  function setRooms(clashNames) {
    for (const r of map.rooms) map.setRoomState(r.id, clashNames.has(r.name) ? 'clash' : 'calm');
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
      const cooler = map.lookup('water-cooler');
      const spot = map.approach(cooler);
      map.traffic.send(s.person, spot)
        .then((ok) => { if (!ok) return false; s.person.face(-Math.PI / 2); return new Promise((r) => setTimeout(() => r(true), 2200)); })
        .then((ok) => (ok ? map.traffic.send(s.person, map.approach(s.chair), { seat: s.chair }) : false))
        .then(() => { s.person.play('type'); s.busy = false; s.next = 25 + Math.random() * 20; });
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
  function overview() { focused = null; return stage.focus(home, { zoom: tget('camera.zoom') }); }
  function focus(roomName) {
    const r = map.rooms.find((x) => x.name === roomName || x.id === roomName) || map.rooms[0];
    focused = r.center.clone().add(new THREE.Vector3(0, 0, 0.6));
    return stage.focus(focused, { zoom: tget('camera.zoom') * 2.1 });
  }
  const onResize = () => applyOffset();
  addEventListener('resize', onResize);

  // ---------------------------------------------------------------- the frame
  function update(dt, t) {
    for (const { person } of people.values()) person.update(dt, t);
    for (const s of staff) s.person.update(dt, t);
    ambient(dt);
    drone.update(dt, t);
    fx.update(dt, t);
    map.update(dt, t);
  }
  // measured, not estimated: draw calls and triangles of one full frame (shadow pass included), and
  // the frame's work: `work` is the CPU side (update + render submission), `full` waits for the GPU
  function stats() {
    renderer.render(scene, camera);
    const { calls, triangles } = renderer.info.render;
    return { calls, triangles, people: people.size + staff.length, programs: renderer.info.programs?.length ?? 0, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
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
    drone.dispose(); fx.dispose(); map.dispose();
  }
  return { map, drone, fx, people, staff, seed, setRooms, occupants, frame, overview, focus, update, stats, bench, dispose, rest,
    get focused() { return !!focused; }, get fitDistance() { return fitDist; } };
}
