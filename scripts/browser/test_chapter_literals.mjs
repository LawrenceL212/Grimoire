/* Hard-coded answers cannot pass an evidence card. For every question (query-graded) SQL step of a card that
   counts as evidence, the reference answer's rows are typed back as literals (SELECT ... FROM (VALUES ...)) and
   graded exactly as the page grades them: on the real world and on the shadow world. Every one must fail.
   Since the product arc every card runs on HIS company: here a company built the way a player builds it (his rooms,
   Priya's paper bookings and Tom's import through his tables, by their scripts), each card resolved by his names,
   and his shadow built from that change log. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame('game/play/index.html?ticket=double-booking-1', { context: { viewport: { width: 1000, height: 700 } } });
await page.waitForFunction(() => window.__play, null, { timeout: 30000 });
const out = await page.evaluate(async () => {
  const { LADDER } = await import('../problems/ladder.js');
  const C = await import('../problems/card.js');
  const { runSql } = await import('../runners/sql.js');
  const { World } = await import('../world/world.js');
  const L = await import('../world/ddl-log.js');
  const SC = await import('../problems/arc/scripts.js');
  const { readCatalogue } = await import('../world/catalogue.js');
  // his company as a player builds it, up to the end of the chapter (S5 fixed, Tom's import in)
  let log = [];
  const his = (sql) => { log = L.append(log, sql); };
  const arrive = async (id) => { const { world } = await L.rebuild(World, log); const sc = SC.buildScript(id, await readCatalogue(world)); const r = await SC.runScript(world, sc); log = L.append(log, SC.loggedSql(sc, r), { by: sc.by }); await world.close(); };
  for (const sql of ['CREATE TABLE rooms (id SERIAL PRIMARY KEY, name TEXT NOT NULL, capacity INTEGER NOT NULL);', "INSERT INTO rooms (name, capacity) VALUES ('Boardroom', 8), ('Studio', 4), ('Library', 12);",
    "UPDATE rooms SET capacity = 10 WHERE name = 'Boardroom';", "INSERT INTO rooms (name, capacity) VALUES ('Garden Room', 6);", LADDER.find((c) => c.id === 'S4').reference[0].code]) his(sql);
  await arrive('paper');
  his('UPDATE bookings SET room_id = 2 WHERE room_id = 7;\nALTER TABLE bookings ADD FOREIGN KEY (room_id) REFERENCES rooms(id);');
  await arrive('import');
  const startHis = async () => (await L.rebuild(World, log)).world;
  const lit = (v) => (v === null || v === undefined ? 'NULL' : v instanceof Date ? `'${v.toISOString()}'::timestamptz` : typeof v === 'number' || typeof v === 'bigint' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
  const res = [];
  for (const raw of LADDER) {
    if (raw.evidence === false || raw.grading !== 'query') continue;
    for (const [i, step0] of raw.steps.entries()) {
      if (step0.interaction || step0.on === 'pad' || !step0.checks.some((k) => k.kind === 'rows' || k.kind === 'value')) continue;
      const ref0 = raw.reference.find((r) => (r.step ?? raw.steps.length - 1) === i);
      if (!ref0?.code || (ref0.lang || 'sql') !== 'sql') continue;
      const world = raw.world.arc ? await startHis() : await C.startWorld(raw);
      const shadow = raw.world.arc ? C.startArcShadow(log) : C.startShadow(raw);
      const card = raw.world.arc ? C.resolveCard(raw, await C.namesOf(world)).card : raw;
      const step = card.steps[i], ref = card.reference.find((r) => (r.step ?? card.steps.length - 1) === i);
      const baseline = await C.baselineOf(world, card.steps);
      const truths = await C.truthsOf(world, step);
      const good = await C.runQuestionSql(world, ref.code);
      const refGrade = await C.gradeStep(card, step, { world, shadow, lang: 'sql', code: ref.code, res: good, baseline, truths, act: {} });
      const rows = good.rows || [];
      if (!rows.length) { res.push({ id: card.id, step: i, skipped: 'empty answer' }); continue; }
      const cols = Object.keys(rows[0]);
      const literal = `SELECT * FROM (VALUES ${rows.map((r) => `(${cols.map((c) => lit(r[c])).join(', ')})`).join(', ')}) AS t(${cols.join(', ')});`;
      const typed = await C.runQuestionSql(world, literal);
      const g = await C.gradeStep(card, step, { world, shadow, lang: 'sql', code: literal, res: typed, baseline, truths, act: {} });
      res.push({ id: card.id, step: i, refPassed: refGrade.passed, literalPassed: g.passed, ran: typed.ok, why: g.results.filter((x) => !x.ok).map((x) => `${x.where}: ${x.why}`)[0] || '' });
      await world.close(); await (await shadow).close();
    }
  }
  return res;
});
for (const r of out) {
  if (r.skipped) { t.note(`${r.id} step ${r.step + 1}`, r.skipped); continue; }
  t.check(`${r.id} step ${r.step + 1}: the reference answer passes`, r.refPassed);
  t.check(`${r.id} step ${r.step + 1}: the same answer typed in as literals fails`, r.ran && !r.literalPassed, r.why);
}
t.check('every evidence question card was tried (S3, S6 and the kept cards on his company)', out.filter((r) => !r.skipped).length >= 11, String(out.length));
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
