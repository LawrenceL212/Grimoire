import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { runSolution } = await import('/game/runners/index.js');
  const { startProblem, gradeProblem } = await import('/game/problems/check.js');
  const { doubleBooking1: p } = await import('/game/problems/double-booking-1.js');

  const attempt = async (lang, code) => {
    const w = await startProblem(p);
    const run = await runSolution(w, lang, code);
    const grade = await gradeProblem(w, p);
    return { run: { ok: run.ok, error: run.error }, passed: grade.passed, failed: grade.results.filter((x) => !x.ok).map((x) => x.name) };
  };

  const out = { start: null, reference: {}, alternates: [], cheats: [], empty: {} };
  const w0 = await startProblem(p);
  out.start = await gradeProblem(w0, p);
  for (const lang of p.languages) out.reference[lang] = await attempt(lang, p.reference[lang]);
  for (const a of p.alternates) out.alternates.push({ name: a.name, ...(await attempt(a.lang, a.code)) });
  for (const c of p.cheats) out.cheats.push({ name: c.name, ...(await attempt(c.lang, c.code)) });
  for (const lang of p.languages) out.empty[lang] = await attempt(lang, '');

  const w1 = await startProblem(p);
  const before = await w1.count('bookings');
  const half = await runSolution(w1, 'sql',
    "INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (3, 1, '2030-01-01T09:00Z', '2030-01-01T10:00Z'); SELECT nonsense FROM nowhere;");
  out.half = { ok: half.ok, before, after: await w1.count('bookings') };
  return out;
});

t.check('the problem starts unsolved', r.start.passed === false, JSON.stringify(r.start.results));
for (const lang of ['sql', 'js', 'php']) {
  t.check(`the reference ${lang} solution passes`, r.reference[lang].run.ok && r.reference[lang].passed,
    JSON.stringify(r.reference[lang]));
}
for (const a of r.alternates) t.check(`a different valid answer passes: ${a.name}`, a.run.ok && a.passed, JSON.stringify(a));
for (const c of r.cheats) t.check(`the cheat fails: ${c.name}`, c.passed === false, JSON.stringify(c));
for (const lang of ['sql', 'js', 'php']) {
  t.check(`empty ${lang} code fails cleanly`, r.empty[lang].passed === false, JSON.stringify(r.empty[lang]));
}
t.check('an SQL script that fails halfway leaves the world unchanged', r.half.ok === false && r.half.after === r.half.before, JSON.stringify(r.half));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
