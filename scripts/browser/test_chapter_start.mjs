/* The opening chapter, part 1 (game/play/chapter.js): a fresh save starts at the first-day tutorial (Sequel
   guides it, step by step skippable, not skippable as a whole on the first play); the tutorial is played through
   in the real runtime (the world is the database, a ticket, a query shown before typing, a one-word change, a
   hint opened on purpose, a spell cast unaided and written, the meter); then the on-ramp O1-O5, each card's cheat
   failing first; Continue resumes at the right ticket; the tutorial can be replayed. SHOT=dir saves screenshots. */
import { openGame, makeReporter } from './game_lib.mjs';
import { ready, current, settle, runCode, playCard, nextTicket } from './chapter_lib.mjs';
import { LADDER } from '../../game/problems/ladder.js';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const { page, errors, close } = await openGame('game/play/index.html?new', { context: { viewport: { width: 1280, height: 800 } } });
const say = () => page.evaluate(() => document.querySelector('#sequel-say')?.innerText || '');
const tstep = async () => (await current(page)).tutorialStep;
try {
  t.check('the play page boots into the chapter', await ready(page));
  await page.evaluate(() => { window.__play.timeScale = 8; });

  // ---- a fresh save: the tutorial, Sequel speaking
  const c0 = await current(page);
  t.check('a fresh save starts at the first-day tutorial', c0.kind === 'tutorial' && c0.tutorialStep === 'hello', JSON.stringify(c0));
  t.check('Sequel speaks in a bubble by the drone', /I'm Sequel/.test(await say()) && await page.locator('#sequel-say').isVisible());
  t.check('first play: each step can be skipped, the tutorial as a whole cannot', await page.locator('#sequel-say [data-t="skip"]').count() === 1 && await page.locator('#sequel-say [data-t="end"]').count() === 0);
  await page.click('#sequel-say [data-t="next"]');

  // ---- the world is the database: click a person in the office, see the row
  t.check('step 2: the world is the database', await tstep() === 'world' && /This office IS the database/.test(await say()));
  const target = await page.evaluate(() => { const p = window.__play; const ids = [...p.office.people.keys()]; for (const id of ids) { const s = p.office.screenOf(id); if (s) return { id, ...s }; } return null; });
  let clicked = null;
  if (target) {
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(200);
    clicked = await page.evaluate(() => window.__play.chapter.timetable.picked);
  }
  if (clicked == null) { await page.locator('#win-timetable .tt-block').first().click(); clicked = await page.evaluate(() => window.__play.chapter.timetable.picked); }
  const insp = await page.evaluate(() => ({ text: document.querySelector('.tt-inspect')?.innerText || '', visible: !document.getElementById('win-timetable').hidden }));
  t.check('clicking a booking (a person in the office) opens its row in the inspector, every column labelled', clicked != null && insp.visible && /bookings: row/.test(insp.text) && /room_id/.test(insp.text) && /start_at/.test(insp.text), JSON.stringify({ target, clicked, insp }));
  if (SHOT) await page.screenshot({ path: `${SHOT}/task-15-tutorial-1.png` });
  await page.click('#sequel-say [data-t="next"]');

  // ---- a ticket is a symptom
  t.check('step 3: a ticket, read', await tstep() === 'ticket' && /symptom/.test(await say()) && /everything that is booked/.test(await page.locator('#ticket-said').innerText()));
  await page.click('#sequel-say [data-t="next"]');

  // ---- a first query, shown before typing: the rows light up
  t.check('step 4: the first query is shown, typed for him', await tstep() === 'query' && (await page.locator('#editor').inputValue()) === 'SELECT * FROM bookings;');
  await page.click('#run'); await settle(page);
  t.check('running it returns every booking (and the tutorial moves on)', await tstep() === 'change' && /every booking/.test(await page.locator('#result').innerText()));

  // ---- a one-word change
  t.check('step 5: a one-word change, pre-filled', (await page.locator('#editor').inputValue()) === 'SELECT * FROM bookings WHERE room_id = 1;');
  await runCode(page, 'SELECT * FROM bookings WHERE room_id = 3;');
  t.check('the wrong word does not pass', await tstep() === 'change');
  await runCode(page, 'SELECT * FROM bookings WHERE room_id = 2;');
  t.check('changing 1 to 2 passes', await tstep() === 'hints');

  // ---- the hint ladder, its cost shown before opening
  const rung = await page.locator('#ticket-thread [data-act="t-hint"][data-level="1"]').innerText();
  t.check('step 6: the hint ladder shows each cost before it is opened', /costs 3 XP/.test(rung) && await page.locator('#ticket-thread [data-act="t-hint"]').count() === 4, rung);
  await page.click('#ticket-thread [data-act="t-hint"][data-level="1"]');
  await page.waitForTimeout(200);
  t.check('opening the first hint on purpose moves on, and says what it would have cost', await tstep() === 'grimoire' && /cost 3 XP/.test(await page.locator('#result').innerText()));

  // ---- the Grimoire: cast unaided, written in ink
  const before = await page.evaluate(() => window.__play.chapter.store().getSpellState('select-all'));
  t.check('before casting, the spell is met but in pencil', before.introduced && !before.written, JSON.stringify(before));
  t.check('the editor is empty for the unaided cast', (await page.locator('#editor').inputValue()) === '');
  await runCode(page, 'SELECT * FROM people;');
  const after = await page.evaluate(() => window.__play.chapter.store().getSpellState('select-all'));
  t.check('cast on his own: the first spell is written in the Grimoire', after.written === true, JSON.stringify(after));
  await page.waitForTimeout(700);
  t.check('the Grimoire opens at the spell, in ink', await page.evaluate(() => document.querySelector('.gm-book-overlay [data-spell="select-all"]')?.dataset.status) === 'fresh');
  await page.evaluate(() => import('./grimoire.js').then((m) => m.grimoire().close()));

  // ---- the forgetting meter
  t.check('step 8: the meter (easy today is not kept; it comes back in a few days)', await tstep() === 'meter' && /Easy today is not the same as kept/.test(await say()) && /Kept about/.test(await say()));
  await page.click('#sequel-say [data-t="next"]');
  await ready(page);
  const c1 = await current(page);
  t.check('after the tutorial the first ticket is O1, not the double booking', c1.kind === 'card' && c1.id === 'O1', JSON.stringify(c1));
  t.check('the tutorial is recorded as done in the life', await page.evaluate(() => window.__play.chapter.life.tutorial.done) === true);

  // ---- O1: a Learn card first
  t.check('O1 opens with its Learn card (3-5 lines) before the task', c1.learning && await page.locator('#ticket-thread .learn p').count() >= 3);
  if (SHOT) await page.screenshot({ path: `${SHOT}/task-15-learn-card.png` });

  // ---- O1-O5 in order, cheats failing first
  for (const card of LADDER.slice(0, 5)) {
    const c = await current(page);
    t.check(`${card.id} is served in ladder order`, c.id === card.id, JSON.stringify(c));
    const r = await playCard(page, card, { t });
    t.check(`${card.id}: every cheat fails (${r.failed.join('; ')})`, r.failed.length === card.cheats.length, JSON.stringify(r));
    t.check(`${card.id}: the reference solution resolves it in the real runtime`, r.solved, JSON.stringify(r));
    t.check(`${card.id}: the recap is two lines`, await page.locator('#ticket-thread .recap p').count() === 2);
    await nextTicket(page);
  }
  const afterO5 = await current(page);
  t.check('the pace rule: five new concepts today, the sixth waits, with an honest message', afterO5.pace && /new ideas today/.test(afterO5.pace) && /tomorrow/.test(afterO5.pace), JSON.stringify(afterO5));
  t.check('the pace message offers practice, never a lock', await page.locator('#ticket-thread [data-act="practice"]').count() === 1);
  const solves = await page.evaluate(() => window.__play.chapter.life.solves.map((s) => [s.card, s.help, typeof s.atMs]));
  t.check('each solve is recorded with its help and a timestamp', solves.length === 5 && solves.every((s) => s[2] === 'number'), JSON.stringify(solves));

  // ---- Continue: a reload resumes at the right place (the next day, T01)
  await page.evaluate(() => { const k = 'grimoire.life.siso.v1'; const l = JSON.parse(localStorage.getItem(k)); for (const d of Object.keys(l.days)) { l.days['2000-01-01'] = l.days[d]; delete l.days[d]; } localStorage.setItem(k, JSON.stringify(l)); });
  await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' });
  t.check('Continue: the page boots again', await ready(page));
  const c2 = await current(page);
  t.check('Continue resumes at the right ticket (T01), not the tutorial', c2.kind === 'card' && c2.id === 'T01', JSON.stringify(c2));
  t.check('the spell written in the tutorial is still written after the reload', await page.evaluate(() => window.__play.chapter.store().getSpellState('select-all').written) === true);

  // ---- the tutorial can be replayed (practice; it records nothing) and can then be ended as a whole
  await page.click('#ticket-thread [data-act="tutorial"]');
  await ready(page);
  const c3 = await current(page);
  t.check('the tutorial is replayable from the ticket window', c3.kind === 'tutorial' && c3.tutorialStep === 'hello', JSON.stringify(c3));
  t.check('on a replay it can be ended as a whole', await page.locator('#sequel-say [data-t="end"]').count() === 1);
  await page.click('#sequel-say [data-t="end"]');
  await ready(page);
  t.check('ending the replay goes back to the chapter where it was', (await current(page)).id === 'T01');
} catch (e) {
  t.check('the chapter start test ran to the end', false, String(e?.stack || e).split('\n').slice(0, 3).join(' | '));
}
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
