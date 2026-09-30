import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const { toObjects, applyObjects } = await import('/game/world/views.js');
  const { runJs } = await import('/game/runners/js.js');
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const objs = await toObjects(w);
  const out = {};
  out.counts = { rooms: objs.rooms.length, people: objs.people.length, bookings: objs.bookings.length };
  out.iso = objs.bookings[0].start_at;

  const sqlRoom1 = (await w.query('SELECT count(*)::int AS n FROM bookings WHERE room_id = 1'))[0].n;
  const read = await runJs('return world.bookings.filter((b) => b.room_id === 1).length;', objs);
  out.read = { ok: read.ok, result: read.result, sqlRoom1 };

  const write = await runJs(
    "world.bookings.push({ room_id: 2, person_id: 1, start_at: '2030-01-01T09:00:00Z', end_at: '2030-01-01T10:00:00Z' });",
    objs);
  await applyObjects(w, write.world);
  out.afterWrite = {
    bookings: await w.count('bookings'),
    rooms: await w.count('rooms'),
    newId: (await w.query('SELECT max(id)::int AS m FROM bookings'))[0].m,
  };
  await w.exec("INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (1, 1, '2030-02-01T09:00Z', '2030-02-01T10:00Z')");
  out.nextSerial = (await w.query('SELECT max(id)::int AS m FROM bookings'))[0].m;

  const bad = await runJs("throw new Error('boom');", objs);
  out.error = { ok: bad.ok, error: bad.error, bookingsAfter: await w.count('bookings') };

  const t0 = performance.now();
  const loop = await runJs('while (true) {}', objs, { timeoutMs: 1500 });
  out.loop = { ok: loop.ok, timedOut: loop.timedOut, ms: Math.round(performance.now() - t0) };

  const rollback = await (async () => {
    try {
      await applyObjects(w, { rooms: objs.rooms, people: objs.people, bookings: [{ room_id: 999, person_id: 1, start_at: '2030-01-01T09:00:00Z', end_at: '2030-01-01T10:00:00Z' }] });
      return 'no error';
    } catch { return 'threw'; }
  })();
  out.rollback = { result: rollback, bookings: await w.count('bookings') };
  return out;
});

t.check('toObjects returns every row', r.counts.rooms === 3 && r.counts.people === 5 && r.counts.bookings === 20, JSON.stringify(r.counts));
t.check('timestamps arrive as ISO-8601 UTC strings', /^2026-01-01T08:00:00Z$/.test(r.iso), r.iso);
t.check('learner JavaScript sees the same data as SQL', r.read.ok && r.read.result === r.read.sqlRoom1, JSON.stringify(r.read));
t.check('a booking pushed in JavaScript lands in PostgreSQL', r.afterWrite.bookings === 21 && r.afterWrite.rooms === 3, JSON.stringify(r.afterWrite));
t.check('the pushed booking was given the next id', r.afterWrite.newId === 21, String(r.afterWrite.newId));
t.check('the id sequence is realigned after write-back', r.nextSerial === 22, String(r.nextSerial));
t.check('a thrown error is reported and changes nothing', r.error.ok === false && /boom/.test(r.error.error) && r.error.bookingsAfter === 22, JSON.stringify(r.error));
t.check('an infinite loop is terminated with timedOut', r.loop.ok === false && r.loop.timedOut === true && r.loop.ms < 3500, JSON.stringify(r.loop));
t.check('a failed write-back rolls back and leaves the world intact', r.rollback.result === 'threw' && r.rollback.bookings === 22, JSON.stringify(r.rollback));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
