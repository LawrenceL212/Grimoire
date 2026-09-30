import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const { describeSkill, renderMeter } = await import('/game/memory/meter.js');
  const el = document.createElement('div');
  document.body.appendChild(el);
  const now = Date.UTC(2026, 8, 30);
  renderMeter(el, describeSkill({ name: 'Overlap detection', lang: 'sql', lastMs: Date.UTC(2026, 8, 24), stability: 10 }, now));
  return { text: el.textContent.replace(/\s+/g, ' ').trim(), cls: el.className, points: el.querySelectorAll('polyline').length };
});
t.check('the meter shows the plain-language line', /last used 6 days ago · due now/.test(r.text), r.text);
t.check('the meter is marked due', r.cls.includes('is-due'), r.cls);
t.check('the meter draws a curve', r.points === 1, String(r.points));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
