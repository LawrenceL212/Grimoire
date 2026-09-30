import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  const { toObjects, applyObjects } = await import('/game/world/views.js');
  const { createPhpRunner } = await import('/game/runners/php.js');
  const { runSolution, getPhpRunner } = await import('/game/runners/index.js');
  const t0 = performance.now();
  const php = await createPhpRunner();
  const loadMs = Math.round(performance.now() - t0);
  const w = await World.create({ rooms: 3, people: 5, bookings: 20 });
  const objs = await toObjects(w);
  const sqlRoom1 = (await w.query('SELECT count(*)::int AS n FROM bookings WHERE room_id = 1'))[0].n;
  const brief = (x) => ({ ok: x.ok, stdout: x.stdout, error: x.error, hasWorld: 'world' in x && x.world !== undefined });

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
  const thrown = brief(await php.run("throw new Exception('nope');", objs));
  const syntax = brief(await php.run('this is not php', objs));

  // A failure must not poison the runs that follow it.
  const afterFailure = brief(await php.run('echo 1;', objs));

  // A fatal error (not a Throwable) and exit() do not poison later runs either.
  const fatal = brief(await php.run('function g() {} function g() {}', objs));
  const afterFatal = brief(await php.run('echo 2;', objs));
  const exited = brief(await php.run('exit;', objs));
  const afterExit = brief(await php.run('echo 3;', objs));

  // Re-running the same answer is the normal play loop.
  const declaring = 'function fix() { return 7; } class Fixer {} echo fix();';
  const declare1 = brief(await php.run(declaring, objs));
  const declare2 = brief(await php.run(declaring, objs));

  // Nothing carries over from one run to the next, and the wrapper's own
  // variables are not visible to the learner.
  await php.run('$x = 5;', objs);
  const leak = brief(await php.run('echo isset($x) ? "LEAK" : "CLEAN";', objs));
  const wrapperVars = brief(await php.run(
    'echo (isset($__w) || isset($rows) || isset($cols) || isset($t) || isset($r) || isset($__failed)) ? "SEEN" : "HIDDEN";', objs));

  // A learner printing the old fixed sentinel cannot corrupt the result.
  const oldSentinel = brief(await php.run('echo "@@GRIMOIRE_WORLD@@";', objs));

  // A leading <?php is accepted.
  const openTag = brief(await php.run('<?php echo 42;', objs));

  // Two runs asked for at once both finish with their own output.
  const [a, b] = await Promise.all([php.run('echo "A";', objs), php.run('echo "B";', objs)]);
  const concurrent = { a: brief(a), b: brief(b) };

  // A failed run through the game's door changes nothing in the world.
  const beforeFail = JSON.stringify(await toObjects(w));
  const failed = brief(await runSolution(w, 'php', '$pdo->exec("DELETE FROM bookings"); throw new Exception("half way");'));
  const afterFail = JSON.stringify(await toObjects(w));

  // Per-run latency: back to back (each waits for the previous reset), and after a pause.
  const lat = [];
  for (let i = 0; i < 5; i++) { const s = performance.now(); await php.run('echo 1;', objs); lat.push(Math.round(performance.now() - s)); }
  await new Promise((res) => setTimeout(res, 500));
  const s1 = performance.now();
  await php.run('echo 1;', objs);
  const idleMs = Math.round(performance.now() - s1);
  const latency = { backToBack: lat, idleMs };

  // The PHP runner is created once, even when two first calls race.
  const samePromise = typeof getPhpRunner === 'function' && getPhpRunner() === getPhpRunner();

  return {
    loadMs, sqlRoom1, res: brief(res), after, thrown, syntax, afterFailure, fatal, afterFatal, exited, afterExit, declare1, declare2, leak, wrapperVars,
    oldSentinel, openTag, concurrent, failed, worldUnchanged: beforeFail === afterFail, samePromise, latency,
    bookingsNow: await w.count('bookings'),
  };
});

const j = JSON.stringify;
t.note('PHP runtime load', r.loadMs + ' ms');
t.note('PHP run latency (20 bookings)', `back to back ${r.latency.backToBack.join(', ')} ms; after a pause ${r.latency.idleMs} ms`);
t.check('PHP reads the same data as SQL', r.res.ok && r.res.stdout.trim() === String(r.sqlRoom1), j(r.res));
t.check('a booking inserted through PDO lands in PostgreSQL', r.after && r.after.bookings === 21 && r.after.rooms === 3, j(r.after));
t.check('timestamps survive the round trip as the same instant', r.after && r.after.start === '2030-01-01T09:00:00Z', r.after && r.after.start);
t.check('a thrown exception is reported as an error', r.thrown.ok === false && /nope/.test(r.thrown.error), j(r.thrown));
t.check('a PHP syntax error is reported as an error', r.syntax.ok === false, j(r.syntax));
t.check('a success after a failure is still a success', r.afterFailure.ok === true && r.afterFailure.stdout.trim() === '1', j(r.afterFailure));
t.check('a fatal error is reported, and the next run still succeeds',
  r.fatal.ok === false && /redeclare/i.test(r.fatal.error) && r.afterFatal.ok === true && r.afterFatal.stdout.trim() === '2', j({ f: r.fatal, a: r.afterFatal }));
t.check('exit() is reported as unfinished, and the next run still succeeds',
  r.exited.ok === false && r.afterExit.ok === true && r.afterExit.stdout.trim() === '3', j({ e: r.exited, a: r.afterExit }));
t.check('code that declares a function and a class runs the first time', r.declare1.ok === true && r.declare1.stdout.trim() === '7', j(r.declare1));
t.check('the same declaring code runs again', r.declare2.ok === true && r.declare2.stdout.trim() === '7', j(r.declare2));
t.check('variables do not leak between runs', r.leak.ok === true && r.leak.stdout.trim() === 'CLEAN', j(r.leak));
t.check("the wrapper's variables are hidden from the learner", r.wrapperVars.ok === true && r.wrapperVars.stdout.trim() === 'HIDDEN', j(r.wrapperVars));
t.check('printing the old sentinel does not corrupt the result',
  r.oldSentinel.ok === true && r.oldSentinel.hasWorld && r.oldSentinel.stdout.includes('@@GRIMOIRE_WORLD@@'), j(r.oldSentinel));
t.check('a leading <?php is accepted', r.openTag.ok === true && r.openTag.stdout.trim() === '42', j(r.openTag));
t.check('two runs at once each get their own output',
  r.concurrent.a.ok && r.concurrent.b.ok && r.concurrent.a.stdout.trim() === 'A' && r.concurrent.b.stdout.trim() === 'B', j(r.concurrent));
t.check('a failed run returns no world', r.failed.ok === false && !r.failed.hasWorld && /half way/.test(r.failed.error), j(r.failed));
t.check('a failed run leaves the world exactly as it was', r.worldUnchanged && r.bookingsNow === 21, String(r.bookingsNow));
t.check('the PHP runner is created once (the promise is cached)', r.samePromise === true);
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
