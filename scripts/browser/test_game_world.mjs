import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const before = { rooms: await w.count('rooms'), people: await w.count('people'), bookings: await w.count('bookings') };
  const first = (await w.query('SELECT id, room_id FROM bookings ORDER BY id LIMIT 1'))[0];
  await w.exec("INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (2, 1, '2030-01-01T09:00Z', '2030-01-01T10:00Z')");
  const snap = await w.snapshot();
  await w.exec('DELETE FROM bookings');
  const w2 = await World.restore(snap);
  const fresh = await World.create({ bookings: 5 });
  return {
    before, first,
    restored: await w2.count('bookings'),
    emptied: await w.count('bookings'),
    freshCount: await fresh.count('bookings'),
    version: (await w.query('SELECT version() AS v'))[0].v,
  };
});
t.check('seed creates the requested rows', r.before.rooms === 3 && r.before.people === 5 && r.before.bookings === 20, JSON.stringify(r.before));
t.check('the first booking is in room 1', r.first.room_id === 1);
t.check('a snapshot restores every row, including later inserts', r.restored === 21, String(r.restored));
t.check('a snapshot is independent of the live world', r.emptied === 0, String(r.emptied));
t.check('a new world is isolated from other worlds', r.freshCount === 5, String(r.freshCount));
t.check('it is a real PostgreSQL server', /PostgreSQL \d+/.test(r.version), r.version.slice(0, 40));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
