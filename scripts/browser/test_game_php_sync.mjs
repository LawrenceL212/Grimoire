import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const { toObjects, applyObjects } = await import('/game/world/views.js');
  const { createPhpRunner } = await import('/game/runners/php.js');
  const t0 = performance.now();
  const php = await createPhpRunner();
  const loadMs = Math.round(performance.now() - t0);
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const objs = await toObjects(w);
  const sqlRoom1 = (await w.query('SELECT count(*)::int AS n FROM bookings WHERE room_id = 1'))[0].n;

  const res = await php.run(`
    echo $pdo->query("SELECT COUNT(*) FROM bookings WHERE room_id = 1")->fetchColumn();
    $pdo->exec("INSERT INTO bookings (room_id, person_id, start_at, end_at)
                VALUES (2, 1, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z')");
  `, objs);
  let after = null;
  if (res.ok) {
    await applyObjects(w, res.world);
    after = {
      bookings: await w.count('bookings'),
      rooms: await w.count('rooms'),
      start: (await w.query("SELECT to_char(start_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS s FROM bookings ORDER BY id DESC LIMIT 1"))[0].s,
    };
  }
  const thrown = await php.run("throw new Exception('nope');", objs);
  const syntax = await php.run('this is not php', objs);
  return { loadMs, sqlRoom1, res: { ok: res.ok, stdout: res.stdout, error: res.error }, after, thrown, syntax, bookingsNow: await w.count('bookings') };
});

t.note('PHP runtime load', r.loadMs + ' ms');
t.check('PHP reads the same data as SQL', r.res.ok && r.res.stdout.trim() === String(r.sqlRoom1), JSON.stringify(r.res));
t.check('a booking inserted through PDO lands in PostgreSQL', r.after && r.after.bookings === 21 && r.after.rooms === 3, JSON.stringify(r.after));
t.check('timestamps survive the round trip as the same instant', r.after && r.after.start === '2030-01-01T09:00:00Z', r.after && r.after.start);
t.check('a thrown exception is reported as an error', r.thrown.ok === false && /nope/.test(r.thrown.error), JSON.stringify(r.thrown));
t.check('a PHP syntax error is reported as an error', r.syntax.ok === false, JSON.stringify(r.syntax));
t.check('failed runs left the world unchanged', r.bookingsNow === 21, String(r.bookingsNow));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
