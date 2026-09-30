/* Spec risk 1: can the world hold a grown business (50,000 bookings) without
   freezing the page? Correctness is checked hard; timings are reported, with
   generous ceilings so a genuinely unusable result still fails. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { World } = await import('/game/world/world.js');
  let last = performance.now(), maxGap = 0, running = true;
  const tick = () => {
    const n = performance.now();
    maxGap = Math.max(maxGap, n - last);
    last = n;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const ms = {};
  let t0 = performance.now();
  const w = await World.create({ rooms: 20, people: 500, bookings: 50000 });
  ms.create = Math.round(performance.now() - t0);

  const CLASH = `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
    ON a.room_id = b.room_id AND a.id < b.id AND a.start_at < b.end_at AND b.start_at < a.end_at`;
  t0 = performance.now();
  const clashesBefore = (await w.query(CLASH))[0].n;
  ms.clashNoIndex = Math.round(performance.now() - t0);

  await w.exec('CREATE INDEX bookings_room_time ON bookings (room_id, start_at, end_at)');
  t0 = performance.now();
  await w.query(CLASH);
  ms.clashWithIndex = Math.round(performance.now() - t0);

  t0 = performance.now();
  const snap = await w.snapshot();
  ms.snapshot = Math.round(performance.now() - t0);
  const bytes = snap.size;

  t0 = performance.now();
  const w2 = await World.restore(snap);
  ms.restore = Math.round(performance.now() - t0);
  const restored = await w2.count('bookings');
  running = false;
  return { ms, bytes, clashesBefore, restored, total: await w.count('bookings'), maxGapMs: Math.round(maxGap) };
});

t.check('50,000 bookings were created', r.total === 50000, String(r.total));
t.check('the base seed has no clashes', r.clashesBefore === 0, String(r.clashesBefore));
t.check('a restored snapshot has all 50,000 bookings', r.restored === 50000, String(r.restored));
t.check('create finishes under 30 s', r.ms.create < 30000, r.ms.create + ' ms');
t.check('snapshot finishes under 20 s', r.ms.snapshot < 20000, r.ms.snapshot + ' ms');
t.check('restore finishes under 30 s', r.ms.restore < 30000, r.ms.restore + ' ms');
t.note('timings', JSON.stringify(r.ms));
t.note('snapshot size', (r.bytes / 1024 / 1024).toFixed(1) + ' MiB');
t.note('longest main-thread stall', r.maxGapMs + ' ms' + (r.maxGapMs > 250
  ? '  => PGlite on the main thread freezes the page; run the world in PGliteWorker'
  : '  => acceptable on the main thread'));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
