/* Hard-coded answers cannot pass an evidence card. For every question (query-graded) SQL step of a card that
   counts as evidence, the reference answer's rows are typed back as literals (SELECT ... FROM (VALUES ...)) and
   graded exactly as the page grades them: on the real world and on the shadow world. Every one must fail. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame('game/play/index.html?ticket=double-booking-1', { context: { viewport: { width: 1000, height: 700 } } });
await page.waitForFunction(() => window.__play, null, { timeout: 30000 });
const out = await page.evaluate(async () => {
  const { LADDER } = await import('../problems/ladder.js');
  const C = await import('../problems/card.js');
  const { runSql } = await import('../runners/sql.js');
  const lit = (v) => (v === null || v === undefined ? 'NULL' : v instanceof Date ? `'${v.toISOString()}'::timestamptz` : typeof v === 'number' || typeof v === 'bigint' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
  const res = [];
  for (const card of LADDER) {
    if (card.evidence === false || card.grading !== 'query') continue;
    for (const [i, step] of card.steps.entries()) {
      if (step.interaction || !step.checks.some((k) => k.kind === 'rows' || k.kind === 'value')) continue;
      const ref = card.reference.find((r) => (r.step ?? card.steps.length - 1) === i);
      if (!ref?.code || (ref.lang || 'sql') !== 'sql') continue;
      const world = await C.startWorld(card);
      const shadow = C.startShadow(card);
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
t.check('every evidence question card was tried', out.filter((r) => !r.skipped).length >= 9, String(out.length));
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
