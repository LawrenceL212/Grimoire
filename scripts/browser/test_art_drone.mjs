/* The drone and the effects (game/art/drone.js, game/art/fx.js): every drone action resolves; cancel() mid-action
   resolves what was pending and leaves the drone idle; escort seats a real Person on a real chair (hips on the seat);
   carry and drop reparent correctly (out of a person's hand too); the face changes per action; the effects are
   pooled (20 confetti bursts add no draw calls or geometries); reduced motion suppresses bursts and shakes; a held
   thing clones; the Drone and effects keys are in DEFAULTS, every preset, SCHEMA and the tweak panel, and recolour
   live; the catalogue's drone scene and every effect's demo run. Personas: Sequel, Jay and Hex build as three distinct
   drones (colours, eye shape, name label) within the same budget, their idle quirks differ (Jay bounces and wiggles,
   Hex sweeps and hardly bobs, Sequel nods), their palette keys recolour live, and an unknown persona throws. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame('game/art/catalogue.html', { context: { viewport: { width: 1280, height: 800 } } });
try {
  await page.waitForFunction(() => window.__catalogue && window.__catalogue.ready === true, null, { timeout: 30000 });
} catch (e) {
  t.check('the catalogue signals ready', false, String(e).split('\n')[0]);
  await close(); t.finish();
}

const r = await page.evaluate(async () => {
  const out = {};
  const THREE = await import('three');
  const reg = await import('./index.js');
  const th = await import('../engine/theme.js');
  let D, FX, P;
  try { D = await import('./drone.js'); FX = await import('./fx.js'); P = await import('./people.js'); } catch (e) { return { importError: String(e) }; }
  th.resetTheme();
  const tick = () => new Promise((res) => setTimeout(res, 0));
  // step the world at 60 fps until the promise settles (or the time runs out); returns { value, settled, secs }
  async function until(promise, things, secs = 20, each) {
    let settled = false, value;
    promise.then((v) => { settled = true; value = v; });
    let n = 0;
    for (; n < secs * 60 && !settled; n++) {
      for (const x of things) x.update(1 / 60);
      each && each(n);
      await Promise.resolve(); await Promise.resolve();
      if (n % 30 === 29) await tick();
    }
    await tick();
    return { value, settled, secs: n / 60 };
  }
  const world = () => { const w = new THREE.Group(); w.updateMatrixWorld(true); return w; };

  out.meta = reg.get('drone') && { category: reg.get('drone').category, budget: reg.get('drone').budget, anims: Object.keys(reg.get('drone').anims || {}) };
  { const o = reg.make('drone'); const m = reg.measure(o); out.meta.tris = m.triangles - m.outlineTriangles; out.meta.problems = reg.check(reg.get('drone'), m); }
  out.fxAssets = reg.list({ category: 'fx' }).map((a) => a.id).filter((id) => id.startsWith('fx-'));

  // ---- every action resolves, and the face follows the action
  {
    const w = world();
    const d = new D.Drone({ reducedMotion: false }); w.add(d.root);
    const person = new P.Person({ role: 'office', seed: 2 }); person.root.position.set(-2, 0, 2); w.add(person.root);
    const chair = reg.make('office-chair'); chair.position.set(2, 0, -1); chair.rotation.y = 0.8; w.add(chair);
    const card = d.fx.ticket({ title: '09:30', line: 'Room 2', state: 'OPEN' }); card.root.position.set(0, 1.2, 1);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.3), new THREE.MeshBasicMaterial()); box.geometry.translate(0, 0.125, 0); box.position.set(1.5, 0, 1.5); w.add(box);
    const room = reg.make('desk'); room.position.set(-1.5, 0, -1.5); w.add(room);
    const things = [d, person];
    out.actions = {};
    const run = async (name, fn, secs) => {
      const faces = new Set();
      const res = await until(fn(), things, secs, () => faces.add(d.faceName));
      out.actions[name] = { value: res.value, settled: res.settled, secs: Math.round(res.secs * 10) / 10, faces: [...faces], state: d.state, tasks: d.tasks.length };
    };
    await run('flyTo', () => d.flyTo([2, 1]));
    out.actions.flyTo.at = [d.root.position.x, d.root.position.z].map((v) => Math.round(v * 100) / 100);
    await run('scanPass', () => d.scan(new THREE.Vector3(0, 0, -2), true));
    await run('scanFail', () => d.scan(room, 'fail'));
    out.marks = d.fx.marks.filter((m) => m.visible).map((m) => m.userData.ok);
    await run('stamp', () => d.stamp(card, 'MOVED'));
    out.actions.stamp.card = card.state;
    await run('carry', () => d.carry(box));
    out.actions.carry.parentIsHook = box.parent === d.hook && d.carried === box;
    await run('drop', () => d.drop([1, -1]));
    { const wp = box.getWorldPosition(new THREE.Vector3()); out.actions.drop.parentIsWorld = box.parent === w && d.carried === null; out.actions.drop.at = [wp.x, wp.y, wp.z].map((v) => Math.round(v * 100) / 100); }
    await run('celebrate', () => d.celebrate());
    await run('shrug', () => d.shrug());
    await run('escort', () => d.escort(person, chair), 30);
    for (let i = 0; i < 120; i++) { d.update(1 / 60); person.update(1 / 60); }
    w.updateMatrixWorld(true);
    const seat = P.seatOf(chair, 0, w);
    const pelvisBottom = person.bones.pelvis.getWorldPosition(new THREE.Vector3()).y - 0.1;
    out.escortSeat = { seated: !!person.seat && !person.seat.virtual, hips: Math.abs(pelvisBottom - seat.height), xz: Math.hypot(person.root.position.x - seat.x, person.root.position.z - seat.z), soles: ['L', 'R'].map((k) => person.soles[k].getWorldPosition(new THREE.Vector3()).y) };
    for (let i = 0; i < 200; i++) d.update(1 / 60);
    out.idleFace = d.faceName; out.idleState = d.state;
    // a thing in a person's hand: the drone takes it out of the hand
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12), new THREE.MeshBasicMaterial());
    const walker = new P.Person({ role: 'lab', seed: 3 }); walker.root.position.set(-1, 0, 1); w.add(walker.root);
    walker.hold(cup, 'R'); things.push(walker);
    let cloneOk = true; try { cup.clone(); } catch { cloneOk = false; }
    await run('carryFromHand', () => d.carry(cup));
    out.fromHand = { handFree: walker.held.R === null, parentIsHook: cup.parent === d.hook, heldBy: P.heldBy(cup), cloneWhileHeld: cloneOk };
    try { cup.clone(); out.fromHand.cloneWhileCarried = true; } catch { out.fromHand.cloneWhileCarried = false; }
    d.dispose(); person.dispose(); walker.dispose();
    out.disposed = { trail: !w.children.some((c) => c.name === 'drone-trail'), fx: !w.children.some((c) => c.name === 'fx') };
  }

  // ---- cancel(): pending promises resolve (false), motion stops, the drone is idle; a new action replaces the old
  {
    const w = world();
    const d = new D.Drone({ reducedMotion: false }); w.add(d.root);
    let first = 'pending';
    d.flyTo([6, 6]).then((v) => { first = v; });
    for (let i = 0; i < 20; i++) { d.update(1 / 60); await Promise.resolve(); }
    const mid = d.root.position.clone();
    d.cancel();
    await tick();
    for (let i = 0; i < 60; i++) d.update(1 / 60);
    out.cancel = { first, state: d.state, tasks: d.tasks.length, moved: d.root.position.distanceTo(mid), started: mid.length() > 0.01, beam: d.beam.visible, face: d.faceName };
    // cancel mid-scan (the beam goes off) and mid-escort (the person stops)
    let scanRes = 'pending';
    d.scan([0, 0, 0], true).then((v) => { scanRes = v; });
    for (let i = 0; i < 80; i++) { d.update(1 / 60); await Promise.resolve(); await Promise.resolve(); }
    const beamWas = d.beamWant;
    d.cancel(); await tick();
    for (let i = 0; i < 60; i++) d.update(1 / 60);
    out.cancelScan = { res: scanRes, beamWas, beamNow: d.beam.visible, state: d.state };
    const person = new P.Person({ role: 'gym', seed: 1 }); person.root.position.set(-3, 0, 0); w.add(person.root);
    const chair = reg.make('office-chair'); chair.position.set(3, 0, 0); w.add(chair);
    let escRes = 'pending';
    d.escort(person, chair).then((v) => { escRes = v; });
    for (let i = 0; i < 150; i++) { d.update(1 / 60); person.update(1 / 60); await Promise.resolve(); }
    d.cancel(); await tick();
    const px = person.root.position.x;
    for (let i = 0; i < 60; i++) { d.update(1 / 60); person.update(1 / 60); }
    out.cancelEscort = { res: escRes, state: d.state, personStopped: Math.abs(person.root.position.x - px) < 0.2, seated: !!person.seat };
    // replacing: a new action resolves the old one with false
    let a = 'pending', b = 'pending';
    d.flyTo([5, 0]).then((v) => { a = v; });
    for (let i = 0; i < 5; i++) d.update(1 / 60);
    const pb = d.flyTo([0, 0]).then((v) => { b = v; });
    await tick();
    const rb = await until(pb, [d], 10);
    out.replace = { a, b, settled: rb.settled };
    d.dispose(); person.dispose();
  }

  // ---- effects: pooled, no new draw calls or geometries however many bursts
  {
    const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
    renderer.setSize(128, 128, false);
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    cam.position.set(0, 8, 8); cam.lookAt(0, 0, 0);
    const fx = new FX.Effects({ reducedMotion: false }); scene.add(fx.root);
    const render = () => { renderer.info.reset(); renderer.render(scene, cam); return { calls: renderer.info.render.calls, geos: renderer.info.memory.geometries, textures: renderer.info.memory.textures }; };
    fx.confetti([0, 1, 0], { n: 20 }); fx.update(0.1);
    const one = render();
    for (let i = 0; i < 20; i++) { fx.confetti([i * 0.1, 1, 0], { n: 60 }); fx.update(1 / 60); }
    const many = render();
    // full bursts with text and marks: every sprite and pool drawn at once is the most there can be
    for (let i = 0; i < 20; i++) { fx.burst([0, 1, i * 0.1]); fx.text([0, 1, 0], `+${i}`); fx.mark([0, 1, i], i % 2 === 0); fx.update(1 / 60); }
    const full1 = render();
    for (let i = 0; i < 20; i++) { fx.burst([0, 1, i * 0.1]); fx.text([0, 1, 0], `+${i}`); fx.mark([0, 1, i], i % 2 === 0); fx.update(1 / 60); }
    const full2 = render();
    const st = fx.stats();
    out.pool = { one, many, full1, full2, maxCalls: Object.keys(fx.pools).length + fx.capacity.texts + fx.capacity.marks + fx.capacity.emotes, live: st.live, cap: fx.capacity, meshCounts: Object.fromEntries(Object.entries(fx.pools).map(([k, p]) => [k, p.mesh.count])) };
    for (let i = 0; i < 60 * 6; i++) fx.update(1 / 60);
    out.pool.after = fx.stats().live;
    out.pool.idleCalls = render().calls;
    fx.dispose(); renderer.dispose();
  }

  // ---- reduced motion: no confetti, sparks or shake; coins rest; marks still show their colour
  {
    const fx = new FX.Effects({ reducedMotion: true });
    fx.burst([0, 1, 0]); fx.shake(0.5);
    const m = fx.mark([0, 1, 0], false);
    fx.update(1 / 60);
    const s = fx.stats();
    out.rm = { confetti: s.live.strips + s.live.discs + s.live.tris, sparks: s.live.sparks, coins: s.live.coins, shake: fx.shakeAmt, mark: m.visible && m.userData.ok === false && m.scale.x > 0.3 };
    const coinY = []; for (let i = 0; i < 30; i++) { fx.update(1 / 60); } for (let i = 0; i < fx.pools.coins.n; i++) if (fx.pools.coins.alive[i]) coinY.push(fx.pools.coins.pos[i * 3 + 1]);
    out.rm.coinsResting = coinY.every((y) => y < 0.1);
    const d = new D.Drone({ reducedMotion: true }); const w = world(); w.add(d.root);
    const res = await until(d.celebrate(), [d], 10);
    const ds = d.fx.stats();
    out.rm.drone = { res: res.value, confetti: ds.live.strips + ds.live.discs + ds.live.tris, face: [...new Set([d.faceName])] };
    d.dispose(); fx.dispose();
  }

  // ---- tickets: four states, an unknown one throws; stamp changes the state
  {
    const c = new FX.TicketCard({ title: '09:30', line: 'Room 2', state: 'BOOKED' });
    const states = []; for (const s of FX.TICKET_STATES) { c.stamp(s); states.push(c.state); }
    let bad = false; try { c.set({ state: 'LOST' }); } catch { bad = true; }
    let badNew = false; try { new FX.TicketCard({ state: 'nope' }); } catch { badNew = true; }
    out.ticket = { states, bad, badNew, all: FX.TICKET_STATES };
    c.dispose();
  }

  // ---- theme keys and live recolour
  {
    const keys = Object.keys(th.DEFAULTS.palette).filter((k) => /^(drone|fx)/.test(k));
    const group = th.SCHEMA.find(([g]) => g === 'Drone and effects');
    out.keys = { n: keys.length, missingPresets: Object.entries(th.PRESETS).filter(([n, p]) => n !== 'Warm dusk').flatMap(([n, p]) => keys.filter((k) => !/^#[0-9a-f]{6}$/i.test(p.palette?.[k] || '')).map((k) => `${n}:${k}`)),
      missingSchema: group ? keys.filter((k) => !group[1].some(([path]) => path === `palette.${k}`)) : ['no group'],
      missingPanel: keys.filter((k) => !document.getElementById(`gm-tw-palette-${k}`)) };
    const d = new D.Drone({ reducedMotion: true });
    const fx = new FX.Effects({ reducedMotion: true });
    th.set('palette.droneRing', '#00ff00'); d.update(1 / 60);
    const ring = d.ringMat.color.getHexString();
    th.set('palette.fxCoin', '#0000ff');
    const coin = fx.pools.coins.mesh.material.color.getHexString();
    th.set('palette.droneShell', '#ff0000');
    let shell = null; d.root.traverse((o) => { if (!shell && o.isMesh && o.material?.color && o.material.color.getHexString() === 'ff0000') shell = true; });
    const px = d.faceTex.userData.canvas.getContext('2d').getImageData(10, 84, 1, 1).data;
    th.set('palette.droneScreen', '#ffffff'); d.update(1 / 60);
    const px2 = d.faceTex.userData.canvas.getContext('2d').getImageData(10, 84, 1, 1).data;
    out.recolour = { ring, coin, shell: !!shell, screenBefore: [...px].slice(0, 3), screenAfter: [...px2].slice(0, 3) };
    th.resetTheme();
    d.dispose(); fx.dispose();
  }

  // ---- every effect's catalogue demo loops without throwing
  out.demos = {};
  for (const id of out.fxAssets) {
    try {
      const o = reg.make(id); const meta = reg.get(id);
      for (let i = 0; i < 400; i++) meta.anims.loop(o, i / 60);
      out.demos[id] = 'ok';
    } catch (e) { out.demos[id] = String(e); }
  }
  // the drone's own close-up animations
  {
    const o = reg.make('drone'); const meta = reg.get('drone'); const w = world(); w.add(o);
    out.droneAnims = {};
    for (const a of Object.keys(meta.anims)) {
      try { for (let i = 0; i < 200; i++) meta.anims[a](o, i / 60); out.droneAnims[a] = 'ok'; } catch (e) { out.droneAnims[a] = String(e); }
    }
    o.userData.drone.dispose();
  }

  // ---- a scaled drone's trail spawns at its body, not above it
  {
    const w = world();
    const d = new D.Drone({ reducedMotion: false }); d.root.scale.setScalar(0.4); w.add(d.root);
    let gap = Infinity, emitted = 0;
    const res = d.flyTo([3, 0]);
    for (let i = 0; i < 120; i++) {
      d.update(1 / 60);
      const bodyY = d.body.getWorldPosition(new THREE.Vector3()).y;
      if (d.trailI > emitted) { emitted = d.trailI; const k = (d.trailI - 1) % d.trailN; gap = Math.min(gap, Math.abs(d.trailPos[k * 3 + 1] - bodyY)); }
    }
    await res;
    out.scaledTrail = { emitted, gap, size: d.trail.material.size };
    d.dispose();
  }

  // ---- personas: Sequel (SQL), Jay (JavaScript), Hex (PHP)
  {
    th.resetTheme();
    const ids = ['sequel', 'jay', 'hex'];
    const drones = ids.map((persona) => { const d = new D.Drone({ persona, reducedMotion: true }); const w = world(); w.add(d.root); for (let i = 0; i < 30; i++) d.update(1 / 60); return d; });
    const base = new D.Drone({ reducedMotion: true }); world().add(base.root); for (let i = 0; i < 30; i++) base.update(1 / 60);
    const face = (d) => { const c = d.faceTex.userData.canvas; return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); };
    const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) n++; return n; };
    const faces = drones.map(face);
    const tris = drones.map((d) => { const m = reg.measure(d.root); return m.triangles - m.outlineTriangles; });
    const baseM = reg.measure(base.root);
    out.personas = {
      names: drones.map((d) => d.persona.name), labels: drones.map((d) => !!d.label && d.label.visible), baseLabel: base.label,
      shells: drones.map((d) => d.shellMesh.material.color.getHexString()), rings: drones.map((d) => d.ringMat.color.getHexString()),
      baseShell: base.shellMesh.material.color.getHexString(), eyes: drones.map((d) => d.persona.eye),
      faceDiff: [diff(faces[0], faces[1]), diff(faces[1], faces[2]), diff(faces[0], faces[2])],
      tris, baseTris: baseM.triangles - baseM.outlineTriangles,
      drawables: drones.map((d) => reg.measure(d.root).drawables), baseDrawables: baseM.drawables,
    };
    try { new D.Drone({ persona: 'cobol' }); out.personas.badThrows = false; } catch (e) { out.personas.badThrows = /persona/.test(String(e)); }
    // idle quirks: six seconds of idling, with motion on
    const motion = {};
    for (const persona of ids) {
      const d = new D.Drone({ persona, reducedMotion: false }); world().add(d.root);
      const ys = [], zs = [], yaws = [], xs = [];
      for (let i = 0; i < 480; i++) { d.update(1 / 60); if (i > 60) { ys.push(d.body.position.y); zs.push(d.tilt.rotation.z); yaws.push(d.body.rotation.y); xs.push(d.tilt.rotation.x); } }
      const range = (a) => Math.max(...a) - Math.min(...a);
      motion[persona] = { bob: range(ys), wiggle: range(zs), sweep: range(yaws), nod: range(xs) };
      d.dispose();
    }
    out.personas.motion = motion;
    // recolour live
    const [sq, jay, hex] = drones;
    th.set('palette.droneJayShell', '#ff0000');
    th.set('palette.droneHexRing', '#00ff00'); hex.update(1 / 60);
    th.set('palette.droneSequelEye', '#ff00ff'); sq.update(1 / 60);
    const c = sq.faceTex.userData.canvas, px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let magenta = 0; for (let i = 0; i < px.length; i += 4) if (px[i] > 200 && px[i + 1] < 90 && px[i + 2] > 200) magenta++;
    out.personas.recolour = { jayShell: jay.shellMesh.material.color.getHexString(), hexRing: hex.ringMat.color.getHexString(), sequelEyePixels: magenta,
      othersKept: sq.shellMesh.material.color.getHexString() !== 'ff0000' && base.shellMesh.material.color.getHexString() !== 'ff0000' };
    th.resetTheme();
    drones.forEach((d) => d.dispose()); base.dispose();
  }
  return out;
});

if (r.importError) { t.check('drone.js and fx.js import', false, r.importError); await close(); t.finish(); }
t.check('the drone is a registered character within 7,000 triangles, with its expressions and actions as animations', r.meta.category === 'character' && r.meta.budget === 7000 && r.meta.tris <= 7000 && r.meta.problems.length === 0 && ['happy', 'focus', 'worried', 'proud', 'scan', 'celebrate', 'shrug'].every((a) => r.meta.anims.includes(a)), JSON.stringify(r.meta));
t.check('every effect is a catalogue entry (sparks, confetti, coins, shock ring, text, ticket, scan marks, emote)', ['fx-sparks', 'fx-confetti', 'fx-coins', 'fx-shock-ring', 'fx-float-text', 'fx-ticket', 'fx-scan-marks', 'fx-emote'].every((id) => r.fxAssets.includes(id)), r.fxAssets.join(', '));
const A = r.actions;
t.check('every drone action resolves true', Object.values(A).every((a) => a.settled && a.value === true && a.state === 'idle' && a.tasks === 0), JSON.stringify(Object.fromEntries(Object.entries(A).map(([k, a]) => [k, [a.value, a.secs, a.state]]))));
t.check('flyTo arrives where it was sent', Math.hypot(A.flyTo.at[0] - 2, A.flyTo.at[1] - 1) < 0.02, JSON.stringify(A.flyTo.at));
t.check('scan leaves a green tick and a red cross', JSON.stringify(r.marks) === JSON.stringify([true, false]), JSON.stringify(r.marks));
t.check('stamp changes the ticket card state', A.stamp.card === 'MOVED', A.stamp.card);
t.check('carry puts the thing on the drone\'s hook; drop sets it on the floor in the world where asked', A.carry.parentIsHook && A.drop.parentIsWorld && Math.abs(A.drop.at[1]) < 0.02 && Math.hypot(A.drop.at[0] - 1, A.drop.at[2] + 1) < 0.1, JSON.stringify({ c: A.carry.parentIsHook, d: A.drop }));
t.check('carrying a thing out of a person\'s hand frees the hand; the thing clones while held and while carried (P2-7)', r.fromHand.handFree && r.fromHand.parentIsHook && r.fromHand.heldBy === null && r.fromHand.cloneWhileHeld && r.fromHand.cloneWhileCarried, JSON.stringify(r.fromHand));
const E = r.escortSeat;
t.check('escort seats a real Person on a real chair (hips on the seat, feet on the floor)', A.escort.value === true && E.seated && E.hips < 0.05 && E.xz < 0.08 && E.soles.every((y) => Math.abs(y) < 0.04), JSON.stringify(E));
const has = (a, f) => A[a].faces.includes(f);
t.check('the face changes per action (flying: focus; pass: happy; fail: worried; escort: happy then proud; celebrate: proud; shrug: worried)',
  has('flyTo', 'focus') && has('scanPass', 'happy') && has('scanFail', 'worried') && !has('scanPass', 'worried') && has('escort', 'happy') && has('escort', 'proud') && has('celebrate', 'proud') && has('shrug', 'worried') && has('stamp', 'focus') && has('carry', 'focus'),
  JSON.stringify(Object.fromEntries(Object.entries(A).map(([k, a]) => [k, a.faces]))));
t.check('back to a neutral face when idle', r.idleFace === 'neutral' && r.idleState === 'idle', `${r.idleFace} ${r.idleState}`);
t.check('dispose takes the trail and the effects layer out of the world', r.disposed.trail && r.disposed.fx, JSON.stringify(r.disposed));
t.check('cancel() mid-flight resolves the pending promise (false), stops motion, leaves the drone idle', r.cancel.first === false && r.cancel.state === 'idle' && r.cancel.tasks === 0 && r.cancel.moved < 1e-6 && r.cancel.started && r.cancel.face === 'neutral', JSON.stringify(r.cancel));
t.check('cancel() mid-scan resolves it and turns the beam off', r.cancelScan.res === false && r.cancelScan.beamWas === 1 && r.cancelScan.beamNow === false && r.cancelScan.state === 'idle', JSON.stringify(r.cancelScan));
t.check('cancel() mid-escort resolves it and the person stops walking', r.cancelEscort.res === false && r.cancelEscort.state === 'idle' && r.cancelEscort.personStopped && !r.cancelEscort.seated, JSON.stringify(r.cancelEscort));
t.check('a new action replaces the running one (the old resolves false, the new true)', r.replace.a === false && r.replace.b === true, JSON.stringify(r.replace));
const pl = r.pool;
t.check('effects pool: 20 confetti bursts add no draw calls, geometries or textures', pl.many.calls <= pl.one.calls && pl.many.geos === pl.one.geos && pl.many.textures === pl.one.textures, JSON.stringify({ one: pl.one, many: pl.many }));
t.check('20 more full bursts (confetti, coins, sparks, rings, text, marks) add nothing either; the most is one call per pool and pooled sprite', pl.full2.calls <= pl.full1.calls && pl.full2.geos === pl.full1.geos && pl.full2.textures === pl.full1.textures && pl.full1.calls <= pl.maxCalls, JSON.stringify({ full1: pl.full1, full2: pl.full2, max: pl.maxCalls }));
t.check('the pools never grow past their capacity', pl.live.strips <= pl.cap.confetti && pl.live.coins <= pl.cap.coins && pl.live.sparks <= pl.cap.sparks && Object.values(pl.meshCounts).every((n, i) => n >= 0), JSON.stringify({ live: pl.live, cap: pl.cap }));
t.check('bursts die away and hidden pools draw nothing', Object.values(pl.after).every((n) => n === 0) && pl.idleCalls < pl.one.calls, JSON.stringify({ after: pl.after, idle: pl.idleCalls }));
t.check('reduced motion: no confetti, no sparks, no shake; coins appear resting; a mark still shows red', r.rm.confetti === 0 && r.rm.sparks === 0 && r.rm.shake === 0 && r.rm.coinsResting && r.rm.mark, JSON.stringify(r.rm));
t.check('reduced motion: the drone still celebrates (resolves) without a confetti burst', r.rm.drone.res === true && r.rm.drone.confetti === 0, JSON.stringify(r.rm.drone));
t.check('ticket cards take the four states (BOOKED, MOVED, RESOLVED, OPEN); an unknown state throws', JSON.stringify(r.ticket.states) === JSON.stringify(['BOOKED', 'MOVED', 'RESOLVED', 'OPEN']) && r.ticket.bad && r.ticket.badNew, JSON.stringify(r.ticket));
t.check('the Drone and effects keys are in DEFAULTS, every preset, a SCHEMA group and the tweak panel', r.keys.n >= 14 && r.keys.missingPresets.length === 0 && r.keys.missingSchema.length === 0 && r.keys.missingPanel.length === 0, JSON.stringify(r.keys));
t.check('the drone and effects recolour live (ring light, body, face screen, coins)', r.recolour.ring === '00ff00' && r.recolour.coin === '0000ff' && r.recolour.shell && r.recolour.screenAfter.every((v) => v > 150) && r.recolour.screenBefore.some((v) => v < 100), JSON.stringify(r.recolour));
t.check('every effect demo loops without throwing', Object.values(r.demos).every((v) => v === 'ok'), JSON.stringify(r.demos));
t.check('every drone close-up animation plays without throwing', Object.values(r.droneAnims).every((v) => v === 'ok'), JSON.stringify(r.droneAnims));

t.check('a scaled drone trail spawns at its body (the root scale is respected), and its points shrink with it', r.scaledTrail.emitted > 3 && r.scaledTrail.gap < 0.15 && r.scaledTrail.size < 0.15, JSON.stringify(r.scaledTrail));
const pe = r.personas;
t.check('three personas build: Sequel, Jay and Hex, each with a name label (the default drone has none)', JSON.stringify(pe.names) === '["Sequel","Jay","Hex"]' && pe.labels.every(Boolean) && pe.baseLabel === null, JSON.stringify({ names: pe.names, labels: pe.labels }));
t.check('the personas look distinct: body and ring colours differ from each other and the default, eye shapes differ, faces differ', new Set(pe.shells).size === 3 && !pe.shells.includes(pe.baseShell) && new Set(pe.rings).size === 3 && new Set(pe.eyes).size === 3 && pe.faceDiff.every((n) => n > 300), JSON.stringify({ shells: pe.shells, rings: pe.rings, eyes: pe.eyes, faceDiff: pe.faceDiff }));
t.check('the personas stay within the drone budget (7,000 triangles), one extra draw (the label) over the default drone', pe.tris.every((n) => n <= 7000) && pe.drawables.every((n) => n <= pe.baseDrawables + 1), JSON.stringify({ tris: pe.tris, base: pe.baseTris, drawables: pe.drawables, baseDrawables: pe.baseDrawables }));
const mo = pe.motion;
t.check('idle quirks differ: Jay bounces most and wiggles, Hex barely bobs and sweeps, Sequel nods', mo.jay.bob > mo.sequel.bob * 1.5 && mo.sequel.bob > mo.hex.bob * 1.5 && mo.jay.wiggle > 0.1 && mo.sequel.wiggle < 0.02 && mo.hex.sweep > 0.2 && mo.sequel.sweep < 0.1 && mo.jay.sweep < 0.1 && mo.sequel.nod > 0.05, JSON.stringify(mo));
t.check('persona colours recolour live (Jay body, Hex ring, Sequel eyes) and leave the others alone', pe.recolour.jayShell === 'ff0000' && pe.recolour.hexRing === '00ff00' && pe.recolour.sequelEyePixels > 200 && pe.recolour.othersKept, JSON.stringify(pe.recolour));
t.check('an unknown persona throws', pe.badThrows === true, String(pe.badThrows));

// ---- the catalogue's drone scene runs
const scene = await page.evaluate(async () => {
  window.__catalogue.drone('drone-rooms');
  await new Promise((res) => setTimeout(res, 2500));
  const cu = window.__catalogue.closeup;
  const s = cu.people;
  const out = { title: document.getElementById('cu-title').textContent, frames: cu.frames, state: s.drone.state, people: s.people.length, ticket: s.ticket.state };
  window.__catalogue.drone('drone-faces');
  await new Promise((res) => setTimeout(res, 500));
  out.faces = window.__catalogue.closeup.people.drones.map((d) => d.faceName);
  window.__catalogue.close();
  return out;
});
t.check('the catalogue\'s drone scene runs (the drone at work in three rooms)', scene.frames > 10 && scene.state !== 'idle' && scene.people === 1 && scene.title.includes('Drone'), JSON.stringify(scene));
t.check('the drone faces scene shows every expression', JSON.stringify(scene.faces) === JSON.stringify(['neutral', 'happy', 'focus', 'worried', 'proud']), JSON.stringify(scene.faces));
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
