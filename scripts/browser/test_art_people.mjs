/* The people (game/art/people.js): a Person sits on real seats with knees bent and feet on the floor, types with
   bent elbows, plays every state, keeps apart from others walking the same path, recolours live from the People
   theme keys, shares one emote texture per kind, calms down under reduced motion; every role and seed builds within
   budget; every seat asset exposes the seat convention; the catalogue's character sheet and office corner run. */
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
  let P;
  try { P = await import('./people.js'); } catch (e) { return { importError: String(e) }; }
  th.resetTheme();
  const deg = (r) => r * 180 / Math.PI;
  const run = (people, secs, each) => { for (let i = 0; i < secs * 60; i++) { for (const p of people) p.update(1 / 60); each && each(i); } };
  const world = () => { const w = new THREE.Group(); w.updateMatrixWorld(true); return w; };
  const soleY = (p) => ['L', 'R'].map((k) => p.soles[k].getWorldPosition(new THREE.Vector3()).y);

  out.meta = reg.get('person') && { category: reg.get('person').category, budget: reg.get('person').budget, reason: reg.get('person').budgetReason, anims: Object.keys(reg.get('person').anims || {}) };
  out.roles = [...P.ROLES]; out.states = [...P.STATES]; out.styles = [...P.HAIR_STYLES];

  // ---- every role and seed builds within budget
  out.builds = [];
  for (const role of P.ROLES) for (let seed = 1; seed <= 8; seed++) {
    try {
      const o = reg.make('person', { role, seed });
      const m = reg.measure(o);
      out.builds.push({ role, seed, tris: m.triangles - m.outlineTriangles, calls: m.drawables, problems: reg.check(reg.get('person'), m) });
    } catch (e) { out.builds.push({ role, seed, error: String(e) }); }
  }
  out.styleBuilds = P.HAIR_STYLES.map((hairStyle) => {
    try { const m = reg.measure(reg.make('person', { role: 'office', seed: 1, hairStyle, beard: true, glasses: true })); return { hairStyle, tris: m.triangles - m.outlineTriangles }; } catch (e) { return { hairStyle, error: String(e) }; }
  });

  // ---- sitting on real seats: knees 70-110 degrees, feet within 3 cm of the floor, hips on the seat
  out.sits = [];
  for (const [id, idx, x, z, ry] of [['office-chair', 0, 0, 0, 0], ['office-chair', 0, 3, 1, 2.2], ['folding-chair-row', 1, -3, 2, Math.PI], ['folding-chair-row', 3, 5, -2, 0.7]]) {
    const w = world();
    const chair = reg.make(id); chair.position.set(x, 0, z); chair.rotation.y = ry; w.add(chair);
    const p = new P.Person({ role: 'lab', seed: 3 });
    p.root.position.set(x + 1, 0, z + 1); w.add(p.root);
    let resolved = false;
    p.sit(chair, idx).then(() => { resolved = true; });
    run([p], 2);
    await Promise.resolve();
    w.updateMatrixWorld(true);
    const seat = P.seatOf(chair, idx, w);
    const pelvisBottom = p.bones.pelvis.getWorldPosition(new THREE.Vector3()).y - 0.1;
    out.sits.push({ id, idx, resolved, knees: ['L', 'R'].map((k) => 180 - deg(p.bones[`knee${k}`].rotation.x)), soles: soleY(p),
      hipsOnSeat: Math.abs(pelvisBottom - seat.height), onSeatXZ: Math.hypot(p.root.position.x - seat.x, p.root.position.z - seat.z),
      facing: Math.abs(Math.atan2(Math.sin(p.root.rotation.y - seat.facing), Math.cos(p.root.rotation.y - seat.facing))) });
    p.dispose();
  }
  // standing: feet on the floor too
  { const w = world(); const p = new P.Person({ role: 'gym', seed: 2 }); w.add(p.root); run([p], 1); out.standSoles = soleY(p); p.dispose(); }

  // ---- typing bends the elbow (compared with standing idle)
  {
    const w = world();
    const chair = reg.make('office-chair'); w.add(chair);
    const p = new P.Person({ role: 'office', seed: 2 }); w.add(p.root);
    const idle = []; run([p], 1, () => idle.push(Math.abs(p.bones.elR.rotation.x)));
    p.sit(chair); p.play('type');
    const typing = []; run([p], 2, (i) => { if (i > 60) typing.push(Math.abs(p.bones.elL.rotation.x), Math.abs(p.bones.elR.rotation.x)); });
    const hand = p.bones.handR.getWorldPosition(new THREE.Vector3());
    out.type = { idleMax: Math.max(...idle), typeMin: Math.min(...typing), typeMax: Math.max(...typing), handY: hand.y, handZ: hand.z };
    p.dispose();
  }

  // ---- every state plays without throwing, standing and seated; an unknown state throws
  out.states = [];
  for (const seated of [false, true]) for (const s of P.STATES) {
    const w = world(); const p = new P.Person({ role: 'school', seed: 4 }); w.add(p.root);
    try {
      if (seated) { const c = reg.make('office-chair'); w.add(c); p.sit(c); }
      p.play(s); run([p], 1.2); p.emote('!'); run([p], 0.3);
      let nan = false; p.root.traverse((o) => { for (const v of [o.position.x, o.position.y, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.y]) if (!Number.isFinite(v)) nan = true; });
      out.states.push({ s, seated, ok: !nan });
    } catch (e) { out.states.push({ s, seated, ok: false, error: String(e) }); }
    p.dispose();
  }
  try { new P.Person().play('dance'); out.unknownThrows = false; } catch { out.unknownThrows = true; }

  // ---- two people walking the same path keep apart; both get there
  {
    const w = world();
    const path = [[0, 0], [4, 0], [4, 3], [0, 3]];
    const a = new P.Person({ role: 'office', seed: 1 }), b = new P.Person({ role: 'gym', seed: 1 });
    a.root.position.set(-0.3, 0, 0); b.root.position.set(-0.45, 0, 0.05);
    w.add(a.root, b.root);
    let done = 0; a.walkTo(path).then(() => done++); b.walkTo(path).then(() => done++);
    let min = Infinity;
    run([a, b], 12, () => { min = Math.min(min, a.root.position.distanceTo(b.root.position)); });
    await Promise.resolve();
    // head-on: two people walking towards each other along one line
    const c = new P.Person({ role: 'clinic', seed: 1 }), d = new P.Person({ role: 'lab', seed: 1 });
    c.root.position.set(0, 0, 6); d.root.position.set(4, 0, 6);
    w.add(c.root, d.root);
    let minHead = Infinity, doneHead = 0;
    c.walkTo([[4, 6]]).then(() => doneHead++); d.walkTo([[0, 6]]).then(() => doneHead++);
    run([c, d], 8, () => { minHead = Math.min(minHead, c.root.position.distanceTo(d.root.position)); });
    await Promise.resolve();
    out.walk = { min, done, minHead, doneHead, turned: Math.abs(a.root.rotation.y) > 0.01 };
    [a, b, c, d].forEach((p) => p.dispose());
  }

  // ---- recolour: a skin key and an outfit key change the person's material, live
  {
    const p = new P.Person({ role: 'office', seed: 1, skin: 'skin3', outer: 'jacket', top: 'shirt' });
    const skinMat = p.meshes.skin.material, outerMat = p.meshes.outer.material;
    th.set('palette.skin3', '#ff00aa'); th.set('palette.jacket', '#00ffaa');
    out.recolour = { skin: skinMat.color.getHexString(), jacket: outerMat.color.getHexString() };
    th.resetTheme();
    out.recolour.back = skinMat.color.getHexString() === new THREE.Color(th.DEFAULTS.palette.skin3).getHexString();
    const schema = th.SCHEMA.find(([g]) => g === 'People');
    const keys = ['skin1', 'skin2', 'skin3', 'skin4', 'skin5', 'hair1', 'hair2', 'hair3', 'hair4', 'hair5', 'hair6', 'shirt', 'jacket', 'labCoat', 'sportTop', 'cardigan', 'lanyard', 'scrubs', 'blazer', 'trousers', 'shoes', 'trainers', 'blush', 'mouth'];
    out.keys = { missingDefaults: keys.filter((k) => !/^#[0-9a-f]{6}$/i.test(th.DEFAULTS.palette[k] || '')), missingSchema: schema ? keys.filter((k) => !schema[1].some(([path]) => path === `palette.${k}`)) : ['no People group'],
      missingPanel: keys.filter((k) => !document.getElementById(`gm-tw-palette-${k}`)) };
  }

  // ---- emote textures are shared: one per kind however many people
  {
    const w = world();
    const ps = Array.from({ length: 6 }, (_, i) => { const p = new P.Person({ role: P.ROLES[i], seed: i }); w.add(p.root); return p; });
    const maps = {};
    for (const kind of ['!', '?', '…', '✓', '✗']) {
      for (const p of ps) { p.emote(kind); run([p], 0.1); (maps[kind] ||= new Set()).add(p.bubble.material.map.uuid); }
    }
    ps[0].emote('bang'); const aliasSame = ps[0].bubble.material.map.uuid === [...maps['!']][0];
    out.emotes = { perKind: Object.fromEntries(Object.entries(maps).map(([k, s]) => [k, s.size])), distinct: new Set(Object.values(maps).flatMap((s) => [...s])).size, aliasSame };
    // the face follows the emote: '✓' happy (closed eyes shown), '!' surprised (open mouth)
    const p = ps[1]; p.emote('✓'); run([p], 0.8); const happy = p.bones.happyL.scale.x, eyes = p.bones.eyeL.scale.y;
    p.emote('!'); run([p], 0.8); const o = p.bones.mO.scale.y;
    p.emote('✗'); run([p], 0.8); const frown = p.bones.mFrown.scale.x, brow = p.bones.browL.rotation.z;
    out.faces = { happy, eyes, o, frown, brow };
    try { ps[0].emote('nope'); out.badEmoteThrows = false; } catch { out.badEmoteThrows = true; }
    ps.forEach((q) => q.dispose());
  }

  // ---- reduced motion: no jumping when celebrating, no head shake when frustrated, gentler walk
  {
    const w = world();
    const calm = new P.Person({ role: 'office', seed: 5, reducedMotion: true }), lively = new P.Person({ role: 'office', seed: 5, reducedMotion: false });
    w.add(calm.root, lively.root); lively.root.position.x = 3;
    calm.play('celebrate'); lively.play('celebrate');
    const cy = [], ly = [];
    run([calm, lively], 2, (i) => { if (i > 40) { cy.push(calm.bones.pelvis.position.y); ly.push(lively.bones.pelvis.position.y); } });
    calm.play('frustrated'); lively.play('frustrated');
    const ch = [], lh = [];
    run([calm, lively], 2, (i) => { if (i > 40) { ch.push(Math.abs(calm.bones.head.rotation.y)); lh.push(Math.abs(lively.bones.head.rotation.y)); } });
    out.rm = { calmJump: Math.max(...cy) - Math.min(...cy), livelyJump: Math.max(...ly) - Math.min(...ly), calmShake: Math.max(...ch), livelyShake: Math.max(...lh) };
    calm.dispose(); lively.dispose();
  }

  // ---- the seat convention on every seat asset, and a person can sit on each
  out.seats = [];
  for (const [id, n] of [['office-chair', 1], ['sofa', 2], ['folding-chair-row', 4], ['student-desk', 1], ['bean-bag', 1], ['hot-desk-pod', 4], ['exam-bed', 1], ['wheelchair', 1], ['bench-press', 1]]) {
    const o = reg.make(id);
    const seats = o.userData.seats || [];
    const shaped = seats.length === n && o.userData.seat === seats[0] && seats.every((s) => Array.isArray(s.position) && s.position.length === 3 && s.position.every(Number.isFinite)
      && Number.isFinite(s.facing) && s.height > 0.2 && Math.abs(s.position[1] - s.height) < 1e-9);
    const w = world(); w.add(o);
    const p = new P.Person({ role: 'council', seed: 2 }); w.add(p.root);
    let soles = null, err = null;
    try { p.sit(o, n - 1); run([p], 1.5); soles = soleY(p); } catch (e) { err = String(e); }
    out.seats.push({ id, count: seats.length, shaped, soles, height: seats[n - 1]?.height, err });
    p.dispose();
  }
  return out;
});

if (r.importError) { t.check('game/art/people.js imports', false, r.importError); await close(); t.finish(); }
t.check('the person asset is registered as a character with the default 7,000 budget', r.meta && r.meta.category === 'character' && r.meta.budget === 7000 && !r.meta.reason, JSON.stringify(r.meta));
t.check('the person asset offers every state as a catalogue animation', r.meta && r.states && ['idle', 'walk', 'sit', 'type', 'talk', 'celebrate', 'frustrated', 'carry', 'wave'].every((s) => r.meta.anims.includes(s)), JSON.stringify(r.meta?.anims));
t.check('six roles and eight hair styles', r.roles.join() === 'office,lab,gym,school,clinic,council' && r.styles.length === 8, `${r.roles} | ${r.styles}`);
const bad = r.builds.filter((b) => b.error || b.problems.length);
t.check(`every role and seed builds within budget and footprint (${r.builds.length} builds)`, bad.length === 0, JSON.stringify(bad.slice(0, 3)));
const tris = r.builds.filter((b) => !b.error).map((b) => b.tris);
t.note('triangles per person (mesh, outline hulls excluded)', `${Math.min(...tris)}..${Math.max(...tris)} of 7000; draw calls ${Math.min(...r.builds.map((b) => b.calls))}..${Math.max(...r.builds.map((b) => b.calls))}`);
t.check('every hair style builds (with beard and glasses) within budget', r.styleBuilds.every((s) => !s.error && s.tris <= 7000), JSON.stringify(r.styleBuilds));
for (const s of r.sits) {
  const name = `${s.id}${s.id === 'office-chair' ? '' : ` seat ${s.idx}`}`;
  t.check(`sitting on ${name}: knees between 70 and 110 degrees`, s.knees.every((k) => k >= 70 && k <= 110), s.knees.map((k) => k.toFixed(1)).join(', '));
  t.check(`sitting on ${name}: feet within 3 cm of the floor`, s.soles.every((y) => Math.abs(y) <= 0.03), s.soles.map((y) => y.toFixed(3)).join(', '));
  t.check(`sitting on ${name}: hips on the seat, facing the seat's way; sit() resolves`, s.hipsOnSeat < 0.03 && s.onSeatXZ < 0.02 && s.facing < 0.02 && s.resolved, JSON.stringify(s));
}
t.check('standing: feet on the floor', r.standSoles.every((y) => Math.abs(y) <= 0.02), r.standSoles.map((y) => y.toFixed(3)).join(', '));
t.check('typing bends the elbows (over 45 degrees, standing idle under 20), hands at the desk', r.type.typeMin > 0.78 && r.type.idleMax < 0.35 && r.type.handY > 0.6 && r.type.handY < 0.8, JSON.stringify(r.type));
const failedStates = r.states.filter((s) => !s.ok);
t.check(`every state plays without throwing, standing and seated (${r.states.length})`, failedStates.length === 0, JSON.stringify(failedStates));
t.check('an unknown state throws', r.unknownThrows === true);
t.check('two people walking the same path keep at least 0.35 apart, and both arrive', r.walk.min >= 0.35 && r.walk.done === 2, JSON.stringify(r.walk));
t.check('two people walking head-on keep at least 0.35 apart, and both arrive', r.walk.minHead >= 0.35 && r.walk.doneHead === 2, JSON.stringify(r.walk));
t.check('recolouring a skin key and an outfit key changes the person, live; reset restores', r.recolour.skin === 'ff00aa' && r.recolour.jacket === '00ffaa' && r.recolour.back, JSON.stringify(r.recolour));
t.check('the People keys are in DEFAULTS, a People SCHEMA group and the tweak panel', r.keys.missingDefaults.length === 0 && r.keys.missingSchema.length === 0 && r.keys.missingPanel.length === 0, JSON.stringify(r.keys));
t.check('emote textures are shared: one texture per kind across six people, five kinds in all', Object.values(r.emotes.perKind).every((n) => n === 1) && r.emotes.distinct === 5 && r.emotes.aliasSame, JSON.stringify(r.emotes));
t.check('an unknown emote throws', r.badEmoteThrows === true);
t.check('faces follow emotes: ✓ closes the eyes happily, ! opens the mouth, ✗ frowns with brows down', r.faces.happy > 0.8 && r.faces.eyes < 0.2 && r.faces.o > 0.8 && r.faces.frown > 0.8, JSON.stringify(r.faces));
t.check('reduced motion: no celebration jump, no frustrated head shake', r.rm.calmJump < 0.01 && r.rm.calmShake < 0.02 && r.rm.livelyJump > 0.06 && r.rm.livelyShake > 0.15, JSON.stringify(r.rm));
for (const s of r.seats) {
  const dangles = s.height > 0.7;
  t.check(`${s.id}: ${s.count} seat(s) in the convention; a person sits${dangles ? ' (legs over the edge)' : ' with feet on the floor'}`, s.shaped && !s.err && (dangles || s.soles.every((y) => Math.abs(y) <= 0.03)), JSON.stringify(s));
}

// ---- the catalogue's character sheet and office corner
const sheet = await page.evaluate(async () => {
  window.__catalogue.people('sheet');
  await new Promise((res) => setTimeout(res, 1500));
  const cu = window.__catalogue.closeup;
  const s = { mode: cu.mode, people: cu.people.people.length, states: new Set(cu.people.people.map((p) => p.state)).size, roles: new Set(cu.people.people.map((p) => p.role)).size, frames: cu.frames, title: document.getElementById('cu-title').textContent, seated: cu.people.people.filter((p) => p.seat && !p.seat.virtual).length };
  document.getElementById('people-kind').value = 'office'; document.getElementById('people-kind').dispatchEvent(new Event('change'));
  await new Promise((res) => setTimeout(res, 1500));
  const c2 = window.__catalogue.closeup;
  s.office = { people: c2.people.people.length, walking: c2.people.people.filter((p) => p.path.length).length, typing: c2.people.people.filter((p) => p.state === 'type' && p.seat).length };
  window.__catalogue.close();
  await new Promise((res) => setTimeout(res, 200));
  return s;
});
t.check('the character sheet shows every role in every state, animating (sit and type on real chairs)', sheet.people === 54 && sheet.states === 9 && sheet.roles === 6 && sheet.frames > 5 && sheet.seated === 12, JSON.stringify(sheet));
t.check('the office corner has people typing at desks and walking', sheet.office.typing >= 2 && sheet.office.walking >= 2, JSON.stringify(sheet.office));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
