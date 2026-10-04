/* The opening chapter, part 1, since the product arc (M-A): a fresh save starts an EMPTY company. The tutorial's
   first part happens on Priya's paper notebook (he names the company, looks at a line, reads a ticket, opens a hint
   on purpose); then S0 (O1, O2 answered on the notebook, cheats by position failing), S1 (the rooms table: two
   steps on Sequel's practice pad, then the real one from a blank editor; its cheats fail) and S2 (her three rooms;
   the double insert fails), each played in the real runtime with its reference solution. The office follows his
   database: nothing at first, a cabinet for his table, a room lit per row. Then the tutorial's second part on his
   rooms (a query shown, a one-word change, the Grimoire demonstration, the meter) changes nothing; the pace rule
   holds; Continue resumes; his world comes back from the change log alone; an old save keeps its credit and
   spells and gets its company rebuilt from S1. SHOT=dir saves screenshots. */
import { openGame, makeReporter } from './game_lib.mjs';
import { ready, current, settle, runCode, playCard, nextTicket } from './chapter_lib.mjs';
import { LADDER, PART2_START } from '../../game/problems/ladder.js';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const { page, errors, close } = await openGame('game/play/index.html?new', { context: { viewport: { width: 1280, height: 800 } } });
const say = () => page.evaluate(() => document.querySelector('#sequel-say')?.innerText || '');
const tstep = async () => (await current(page)).tutorialStep;
const arcState = () => page.evaluate(async () => {
  const c = window.__play.chapter, w = window.__play.world;
  const tables = w ? await w.tables() : null;
  return { log: c.arc.log.map((e) => e.sql), company: c.arc.company, tables, office: c.arc.office(), rooms: tables?.includes('rooms') ? await w.query('SELECT * FROM rooms ORDER BY id') : [] };
});
const xp = () => page.evaluate(() => window.__play.chapter.life.solves.reduce((n, s) => n + s.xp, 0));
try {
  t.check('the play page boots into the chapter', await ready(page));
  await page.evaluate(() => { window.__play.timeScale = 8; });

  // ---- the tutorial, part 1: an empty company and a paper notebook
  const c0 = await current(page);
  t.check('a fresh save starts at the first-day tutorial', c0.kind === 'tutorial' && c0.tutorialStep === 'hello', JSON.stringify(c0));
  t.check('Sequel speaks in a bubble, and says the company is empty', /I'm Sequel/.test(await say()) && /nothing else yet/.test(await say()) && await page.locator('#sequel-say').isVisible());
  t.check('first play: each step can be skipped, the tutorial as a whole cannot', await page.locator('#sequel-say [data-t="skip"]').count() === 1 && await page.locator('#sequel-say [data-t="end"]').count() === 0);
  const a0 = await arcState();
  t.check('Day 0: his company database has no tables and no rows (no seed)', Array.isArray(a0.tables) && a0.tables.length === 0 && a0.log.length === 0, JSON.stringify(a0));
  t.check('Day 0: the office shows no cabinet and every room dark', a0.office && a0.office.cabinets.length === 0 && a0.office.dark.length === 3, JSON.stringify(a0.office));
  await page.click('#sequel-say [data-t="company"]');
  t.check('a name is asked for, not invented', await tstep() === 'hello');
  await page.fill('#company-name', 'Harbour Desk');
  await page.click('#sequel-say [data-t="company"]');
  t.check('he names the company (kept in the life)', await tstep() === 'world' && (await arcState()).company === 'Harbour Desk');
  t.check('step 2: the notebook is the business; it is open', /notebook/.test(await say()) && await page.locator('#win-notebook').isVisible());
  await page.locator('#win-notebook .nb-cell[data-row="3"][data-col="who"]').click();
  t.check('clicking a line of the notebook says it is one row, its headings columns', /line 3 of Priya's bookings: one booking, one row/.test(await page.locator('#result').innerText()));
  if (SHOT) await page.screenshot({ path: `${SHOT}/arc-0-notebook.png` });
  await page.click('#sequel-say [data-t="next"]');
  t.check('step 3: a ticket, read', await tstep() === 'ticket' && /Can the computer hold this/.test(await page.locator('#ticket-said').innerText()));
  await page.click('#sequel-say [data-t="next"]');
  const rung = await page.locator('#ticket-thread [data-act="t-hint"][data-level="1"]').innerText();
  t.check('step 4: the hint ladder shows each cost before it is opened', /costs 3 XP/.test(rung) && await page.locator('#ticket-thread [data-act="t-hint"]').count() === 4, rung);
  await page.click('#ticket-thread [data-act="t-hint"][data-level="1"]');
  await page.waitForTimeout(300); await ready(page);
  const c1 = await current(page);
  t.check('part 1 ends where the database begins: the first ticket is O1, on the notebook', c1.kind === 'card' && c1.id === 'O1', JSON.stringify(c1));
  t.check('the tutorial is not done: part 2 waits for his rooms', await page.evaluate((p) => { const tu = window.__play.chapter.life.tutorial; return !tu.done && tu.step === p; }, PART2_START));

  // ---- S0, S1, S2: each cheat fails first, then the reference, in the real runtime
  const shots = { S1: 'arc-1-cabinet', S2: 'arc-2-rooms' };
  for (const card of LADDER.slice(0, 4)) {
    const c = await current(page);
    t.check(`${card.id} is served in ladder order`, c.id === card.id && !c.solved, JSON.stringify(c));
    if (c.id !== card.id) break;
    if (card.id === 'S1') {
      await page.click('#ticket-thread [data-act="start"]');
      const txt = await page.locator('#ticket-thread').innerText();
      t.check('S1 shows the goal and how it is checked ("Done when"), never the table', /done when/i.test(txt) && /seating at least 7/.test(txt) && !/capacity INTEGER/.test(txt), txt.slice(0, 300));
      t.check('S1 states the house convention once', /House convention/.test(txt));
      t.check('S1 step 1 is on the practice pad, with the one-word change pre-filled', /practice pad/.test(await page.locator('#ticket-objective').innerText()) && /CREATE TABLE shifts/.test(await page.locator('#editor').inputValue()));
    }
    const r = await playCard(page, card, { t });
    t.check(`${card.id}: every cheat fails (${r.failed.join('; ')})`, r.failed.length === card.cheats.length, JSON.stringify(r));
    t.check(`${card.id}: the reference solution resolves it in the real runtime`, r.solved, JSON.stringify(r));
    if (!r.solved) break;
    await page.waitForTimeout(1200 / 8 + 200);
    const a = await arcState();
    if (card.id === 'O2') t.check('S0 changed nothing in the database (it was all paper)', a.log.length === 0 && a.tables.length === 0, JSON.stringify(a));
    if (card.id === 'S1') {
      t.check('S1: his change log holds exactly his CREATE TABLE (the pad runs and the undone cheats are not in it)', a.log.length === 1 && /CREATE TABLE rooms/.test(a.log[0]) && /NOT NULL/.test(a.log[0]), JSON.stringify(a.log));
      t.check('S1: the office has one cabinet, labelled with his table and his columns', a.office.cabinets.length === 1 && a.office.cabinets[0].label === 'rooms: name, capacity', JSON.stringify(a.office));
      t.check('S1: still no room lit (the table is empty)', a.office.dark.length === 3, JSON.stringify(a.office));
      t.check('S1 is a first meeting: no XP', (await xp()) === 0);
    }
    if (card.id === 'S2') {
      t.check("S2: his table holds Priya's three rooms, once each", JSON.stringify(a.rooms.map((x) => [x.id, x.name, x.capacity])) === '[[1,"Boardroom",8],[2,"Studio",4],[3,"Library",12]]', JSON.stringify(a.rooms));
      t.check('S2: the office has exactly as many rooms lit as his table, with his names', a.office.dark.length === 0 && JSON.stringify(a.office.lit.map((x) => x.label)) === '["Boardroom","Studio","Library"]', JSON.stringify(a.office));
      t.check('S2: the log holds the CREATE and one INSERT (the cheats were undone by Reset)', a.log.length === 2 && /INSERT INTO rooms/.test(a.log[1]), JSON.stringify(a.log));
      const s = await page.evaluate(() => window.__play.chapter.life.solves.at(-1));
      t.check('S2: a first clean solve earns its credit honestly (+10 XP, unaided)', s.card === 'S2' && s.help === 'clean' && s.unaided === true && s.xp === 10, JSON.stringify(s));
      t.check('S2: the idea it taught stays in pencil (taught here, not recalled)', await page.evaluate(() => !window.__play.chapter.store().getSpellState('insert').written));
    }
    if (SHOT && shots[card.id]) await page.screenshot({ path: `${SHOT}/${shots[card.id]}.png` });
    await nextTicket(page);
  }

  // ---- the tutorial, part 2: on his rooms, changing nothing
  t.check('after S2 the tutorial comes back, on his rooms', await tstep() === 'query' && (await page.locator('#editor').inputValue()) === 'SELECT * FROM rooms;');
  await page.click('#run'); await settle(page);
  t.check('the query shown returns his rooms, from his own table', await tstep() === 'change' && /Harbour Desk's own table/.test(await page.locator('#result').innerText()));
  await runCode(page, 'SELECT * FROM rooms WHERE id = 3;');
  t.check('the wrong word does not pass', await tstep() === 'change');
  await runCode(page, 'SELECT * FROM rooms WHERE id = 2;');
  t.check('changing 1 to 2 passes', await tstep() === 'grimoire');
  t.check('the editor is empty for the unaided cast', (await page.locator('#editor').inputValue()) === '');
  await runCode(page, 'SELECT * FROM rooms;');
  const demo = await page.evaluate(() => window.__play.chapter.store().getSpellState('select-all'));
  t.check('cast on his own in the tutorial: a Demonstration, not counted as written', demo.demo === true && demo.written === false, JSON.stringify(demo));
  await page.waitForTimeout(700);
  await page.evaluate(() => import('./grimoire.js').then((m) => m.grimoire().close()));
  t.check('step 8: the meter', await tstep() === 'meter' && /Easy today is not the same as kept/.test(await say()));
  await runCode(page, "DELETE FROM rooms;");
  const a2 = await arcState();
  t.check('nothing run in the tutorial changes his company (rolled back, not logged)', a2.rooms.length === 3 && a2.log.length === 2, JSON.stringify(a2));
  await page.click('#sequel-say [data-t="next"]');
  await ready(page);
  const c3 = await current(page);
  t.check('after the tutorial: O3, and the tutorial is done', c3.kind === 'card' && c3.id === 'O3' && await page.evaluate(() => window.__play.chapter.life.tutorial.done), JSON.stringify(c3));
  const r3 = await playCard(page, LADDER[4], { t });
  t.check('O3 still resolves (its seeded world, until M-B re-hosts it)', r3.solved, JSON.stringify(r3));
  await nextTicket(page);
  const pace = await current(page);
  t.check('the pace rule: five new ideas today (O1, O2, S1, S2, O3), the sixth waits, honestly', pace.pace && /new ideas today/.test(pace.pace) && /tomorrow/.test(pace.pace), JSON.stringify(pace));

  // ---- Continue, and his world back from the change log alone
  await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' }); // without ?new: Continue
  t.check('Continue: the page boots again', await page.waitForFunction(() => window.__play?.chapter?.current, null, { timeout: 60000 }).then(() => true, () => false));
  t.check('Continue resumes where the pace rule left him (O3 done, O4 waits)', (await current(page)).pace !== null || (await current(page)).id === 'O4', JSON.stringify(await current(page)));
  await page.evaluate(() => window.__play.chapter.loadCard(window.__play.chapter.cardById('S2')));
  await ready(page);
  const back = await arcState();
  t.check('restore: after a reload his company is rebuilt from the log: same rows, same ids', JSON.stringify(back.rooms.map((x) => [x.id, x.name, x.capacity])) === '[[1,"Boardroom",8],[2,"Studio",4],[3,"Library",12]]' && back.log.length === 2, JSON.stringify(back));
  t.check('restore: and the office shows his cabinet and his three rooms again', back.office.cabinets.length === 1 && back.office.dark.length === 0, JSON.stringify(back.office));

  // ---- an old save (before the arc): credit and spells kept, its company rebuilt by the arc from S1
  await page.evaluate(() => {
    const NOW = Date.now() - 86400000;
    const on = ['O1', 'O2', 'O3', 'O4', 'O5', 'T01', 'T02', 'T03', 'T04', 'T06'];
    localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({
      v: 1, startedMs: NOW, highMs: NOW, tutorial: { done: true, step: 7, skipped: [] },
      cards: Object.fromEntries(on.map((id) => [id, { startedMs: NOW, learnSeen: true, step: 0 }])),
      solves: on.map((card) => ({ card, atMs: NOW, help: 'clean', unaided: card.startsWith('T'), lang: 'sql', xp: card.startsWith('T') ? 10 : 0 })),
      days: { '2000-01-01': on }, spells: { where: { langs: ['sql'], written: true, lastMs: NOW, stability: 3, forms: {} } },
    }));
  });
  await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' });
  await ready(page);
  const old = await current(page);
  const oa = await arcState();
  t.check('an old save is served S1: its company is rebuilt by the arc, from empty', old.id === 'S1' && oa.tables.length === 0 && oa.office.dark.length === 3, JSON.stringify({ old, oa }));
  t.check('an old save keeps its credit and its spells', (await xp()) === 50 && await page.evaluate(() => window.__play.chapter.store().getSpellState('where').written));
} catch (e) {
  t.check('the chapter start test ran to the end', false, String(e?.stack || e).split('\n').slice(0, 3).join(' | '));
}
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
