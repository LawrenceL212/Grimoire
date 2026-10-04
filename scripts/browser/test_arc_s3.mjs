/* The product arc through S3 (milestone M-B), from a NEW save: the tutorial's first part on the notebook, S0-S2
   (his rooms table and Priya's rooms), the tutorial's second part on his rooms, then every S3 card (O3, O4, O5,
   T01-T04, G1 the Garden Room he types in, T08, T10, T11) played on HIS company with each cheat failing first and
   then its reference solution, across the days the pace rule asks for. Along the way: every Learn card demo and
   look-up runs without an error (on his rooms read-only, or on Sequel's practice pad of fruit and books); the
   editor's tab names the file; a question never joins his change log; the office lights a room per row of his and
   puts the fourth (the Garden Room) in the annex; after S3 the next card is T13. Then a life whose table has its
   own column names (title, seats) and ids that do not start at 1 plays T03 and T10 through the resolved card.
   SHOT=dir saves screenshots. */
import { openGame, makeReporter } from './game_lib.mjs';
import { ready, current, settle, runCode, playCard, nextTicket } from './chapter_lib.mjs';
import { LADDER } from '../../game/problems/ladder.js';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const DAY = 86400000;
const { page, errors, close } = await openGame('game/play/index.html?new', { context: { viewport: { width: 1280, height: 800 } } });
const tstep = async () => (await current(page)).tutorialStep;
const arcState = () => page.evaluate(async () => {
  const c = window.__play.chapter, w = window.__play.world;
  const tables = w ? await w.tables() : [];
  return { log: c.arc.log.map((e) => e.sql), office: c.arc.office(), rooms: tables.includes('rooms') ? await w.query('SELECT * FROM rooms ORDER BY id') : [] };
});
const fileTab = () => page.locator('#code-file').innerText();
const resultKind = () => page.evaluate(() => document.querySelector('#result').className);
let clock = Date.now();
async function nextDay() {
  clock += DAY;
  await page.evaluate((ms) => window.__play.chapter.setNow(ms), clock);
  await page.evaluate(() => window.__play.chapter.next());
  await ready(page);
}
try {
  t.check('a new save boots into the tutorial', await ready(page) && (await tstep()) === 'hello');
  await page.evaluate(() => { window.__play.timeScale = 10; });
  // ---- tutorial part 1 (paper)
  await page.fill('#company-name', 'Harbour Desk');
  await page.click('#sequel-say [data-t="company"]');
  await page.locator('#win-notebook .nb-cell[data-row="3"][data-col="who"]').click();
  await page.click('#sequel-say [data-t="next"]');
  await page.click('#sequel-say [data-t="next"]');
  await page.click('#ticket-thread [data-act="t-hint"][data-level="1"]');
  await page.waitForTimeout(300); await ready(page);

  const S3 = ['O3', 'O4', 'O5', 'T01', 'T02', 'T03', 'T04', 'G1', 'T08', 'T10', 'T11'];
  for (const card of LADDER.slice(0, LADDER.findIndex((c) => c.id === 'T11') + 1)) {
    let c = await current(page);
    if (c.kind === 'tutorial') {
      // ---- tutorial part 2: on his rooms, with his ids
      t.check('after S2 the tutorial comes back on his rooms', c.tutorialStep === 'query');
      await page.click('#run'); await settle(page);
      const studio = await page.evaluate(async () => (await window.__play.world.query("SELECT id FROM rooms WHERE name = 'Studio'"))[0].id);
      const starter = await page.locator('#editor').inputValue();
      await runCode(page, starter.replace(/= \d+;/, `= ${studio};`));
      t.check('part 2: the one-word change uses his own ids', (await tstep()) === 'grimoire', starter);
      await runCode(page, 'SELECT * FROM rooms;');
      await page.waitForTimeout(700);
      await page.evaluate(() => import('./grimoire.js').then((m) => m.grimoire().close()));
      await page.click('#sequel-say [data-t="next"]');
      await ready(page);
      c = await current(page);
    }
    if (c.pace) { await nextDay(); c = await current(page); }
    t.check(`${card.id} is served in ladder order`, c.id === card.id && !c.solved, JSON.stringify(c));
    if (c.id !== card.id) break;
    // the Learn card's demo runs, never with an error (his rooms read-only, or the practice pad)
    if (c.learning) {
      await page.click('#ticket-thread [data-act="demo"]'); await settle(page);
      if (S3.includes(card.id) && card.id !== 'O4') t.check(`${card.id}: the Learn card's example runs without an error`, !/is-error/.test(await resultKind()), await page.locator('#result').innerText());
      if (card.id === 'O4') t.check('O4: its example shows the error it is about (on the practice pad)', /practice pad: syntax error at or near "FORM"/.test(await page.locator('#result').innerText()));
      await page.click('#ticket-thread [data-act="start"]');
    }
    if (card.id === 'S1') {
      const r1 = await playCard(page, card, { cheats: false });
      t.check('S1 resolves', r1.solved, JSON.stringify(r1));
    } else {
      if (card.id === 'T01') t.check('the editor tab names the file: practice-pad.sql on a pad step', (await fileTab()) === 'practice-pad.sql', await fileTab());
      if (card.id === 'T03') t.check('the editor tab names the file: rooms.sql for a question about his rooms', (await fileTab()) === 'rooms.sql', await fileTab());
      if (card.id === 'O5') {
        await page.locator('#lookup-q').fill('first');
        await page.click('#ticket-thread [data-act="lookup-open"][data-spell="limit"]');
        const shown = await page.locator('#ticket-thread .lookup-entry').innerText();
        await page.click('#ticket-thread [data-act="lookup-run"]'); await settle(page);
        t.check('a look-up in his company shows and runs its practice-pad form, without an error', /FROM fruit/.test(shown) && !/is-error/.test(await resultKind()) && !/does not exist/.test(await page.locator('#result').innerText()), await page.locator('#result').innerText());
      }
      const before = (await arcState()).log.length;
      const r = await playCard(page, card, { t });
      t.check(`${card.id}: every cheat fails (${r.failed.join('; ')})`, r.failed.length === card.cheats.length, JSON.stringify(r));
      t.check(`${card.id}: the reference solution resolves it on his company`, r.solved, JSON.stringify(r));
      if (!r.solved) break;
      const a = await arcState();
      if (card.grading === 'query') t.check(`${card.id}: a question (cheats included) never joins his change log`, a.log.length === before, JSON.stringify(a.log));
      if (card.id === 'T04') t.check("T04: his Boardroom seats 10, the others as Priya wrote them", JSON.stringify(a.rooms.map((x) => [x.name, x.capacity])) === '[["Boardroom",10],["Studio",4],["Library",12]]', JSON.stringify(a.rooms));
      if (card.id === 'G1') {
        t.check('G1: the Garden Room is in his table, typed by him (one more log entry)', a.rooms.length === 4 && a.log.length === before + 1 && /Garden Room/.test(a.log.at(-1)), JSON.stringify(a));
        t.check('G1: the office has his three first rooms lit and the fourth in the annex', a.office.dark.length === 0 && JSON.stringify(a.office.annex) === '["Garden Room"]', JSON.stringify(a.office));
        if (SHOT) await page.screenshot({ path: `${SHOT}/arc-3-annex.png` });
      }
    }
    await nextTicket(page);
  }
  // a look-up in his company runs on the pad, without an error (the empty pad of M-A broke it)
  const end = await arcState();
  t.check('after S3 his change log is exactly his: the table, the three rooms, the Boardroom fix, the Garden Room', end.log.length === 4 && /CREATE TABLE/i.test(end.log[0]) && /UPDATE/i.test(end.log[2]) && /Garden Room/.test(end.log[3]), JSON.stringify(end.log));
  let c = await current(page);
  if (c.pace) { await nextDay(); c = await current(page); }
  t.check('after S3 the chapter moves on to T13', c.id === 'T13', JSON.stringify(c));

  // ---- his own names: columns title and seats, ids from 11, a key with no default (filled by hand)
  await page.evaluate(() => {
    const NOW = Date.now() - 3 * 86400000;
    const on = ['O1', 'O2', 'S1', 'S2', 'O3', 'O4', 'O5', 'T01', 'T02'];
    localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({
      v: 1, startedMs: NOW, highMs: NOW, tutorial: { done: true, step: 7, skipped: [] },
      cards: Object.fromEntries(on.map((id) => [id, { startedMs: NOW, learnSeen: true, step: 0 }])),
      solves: on.map((card) => ({ card, atMs: NOW, help: 'clean', unaided: false, lang: 'sql', xp: 0 })), days: { '2000-01-01': on }, spells: {},
      arc: { company: 'Own Names Ltd', marks: { S1: 0, S2: 1 }, log: [
        { sql: 'Create TABLE if not exists Rooms(id int PRIMARY KEY, title VARCHAR(40), seats INT)', card: 'S1' },
        { sql: "INSERT INTO rooms VALUES (11, 'boardroom', 8), (12, 'Studio', 4), (13, 'Library', 12);", card: 'S2' }] },
    }));
  });
  await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' });
  t.check('a life with his own column names opens at T03', await ready(page) && (await current(page)).id === 'T03', JSON.stringify(await current(page)));
  await page.evaluate(() => { window.__play.timeScale = 10; });
  await page.click('#ticket-thread [data-act="start"]');
  t.check('T03 is written in his names: the starter asks for his seats column', (await page.locator('#editor').inputValue()) === 'SELECT seats FROM rooms', await page.locator('#editor').inputValue());
  const live = await page.evaluate(() => window.__play.chapter.card);
  t.check("T03's check asks about his Boardroom as he spelt it", /title = 'boardroom'/.test(live.steps[0].checks[0].truth), live.steps[0].checks[0].truth);
  const r3 = await playCard(page, LADDER.find((x) => x.id === 'T03'), { t });
  t.check(`T03 on his names: every cheat fails (${r3.failed.join('; ')}) and his reference passes`, r3.solved && r3.failed.length === 3, JSON.stringify(r3));
  await page.evaluate(() => window.__play.chapter.loadCard(window.__play.chapter.cardById('T10')));
  await ready(page);
  const r10 = await playCard(page, LADDER.find((x) => x.id === 'T10'), { t });
  t.check('T10 on his names: "more than 7" fails (his shadow has a 7-seater), ">= 7" passes', r10.solved && r10.failed.length === 1, JSON.stringify(r10));
  const lit = await arcState();
  t.check('the office lights his rooms by order, whatever ids they have (11, 12, 13)', lit.office.dark.length === 0 && JSON.stringify(lit.office.lit.map((x) => x.label)) === '["boardroom","Studio","Library"]', JSON.stringify(lit.office));

  // ---- the rooms_pkey report: his S1 table with a key that has no default, already holding rows 1-3 (made in an
  // earlier run), and his exact statement run again. The probe must pass on its own ids, and the page must not say
  // his run "changed your company's database" (IF NOT EXISTS changed nothing) or "returned 0 rows" (it asked none).
  const LAWRENCE = 'Create TABLE if not exists Rooms(id int PRIMARY KEY, room TEXT, seats INT)';
  await page.evaluate((sql) => {
    const NOW = Date.now() - 3 * 86400000;
    const on = ['O1', 'O2'];
    localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({
      v: 1, startedMs: NOW, highMs: NOW, tutorial: { done: false, step: 4, skipped: [] },
      cards: { ...Object.fromEntries(on.map((id) => [id, { startedMs: NOW, learnSeen: true, step: 0 }])), S1: { startedMs: NOW, learnSeen: true, step: 2 } },
      solves: on.map((card) => ({ card, atMs: NOW, help: 'clean', unaided: false, lang: 'sql', xp: 0 })), days: { '2000-01-01': on }, spells: {},
      arc: { company: 'Repro Ltd', marks: { S1: 0 }, log: [{ sql, card: 'S1' }, { sql: "INSERT INTO rooms VALUES (1, 'Boardroom', 8), (2, 'Studio', 4), (3, 'Library', 12);", card: 'S1' }] },
    }));
  }, LAWRENCE);
  await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' });
  t.check('the repro life opens at S1, step 3 (his company)', await ready(page) && (await current(page)).id === 'S1' && (await current(page)).step === 2, JSON.stringify(await current(page)));
  await runCode(page, LAWRENCE);
  const said = await page.locator('#result').innerText();
  t.check('his table (id int PRIMARY KEY, no default; a text column called room; rows 1-3 already in) passes S1: the test rooms take their own ids', (await current(page)).solved, said);
  t.check('the page does not claim his run changed his company, nor that a CREATE "returned 0 rows"', !/changed your company/.test(said) && !/returned 0 rows/.test(said), said);
  t.check('no rooms_pkey anywhere', !/rooms_pkey/.test(said), said);
  // and when his table is NOT right (seats as words), a query returning 0 rows is reported as just that: nothing
  // of his changed, the reason in plain words
  await page.evaluate(() => {
    const life = JSON.parse(localStorage.getItem('grimoire.life.siso.v1'));
    life.solves = life.solves.filter((s) => s.card !== 'S1'); life.cards.S1 = { startedMs: Date.now() - 1e6, learnSeen: true, step: 2 };
    life.arc.log = [{ sql: 'CREATE TABLE rooms (id int PRIMARY KEY, room TEXT, seats TEXT)', card: 'S1' }, { sql: "INSERT INTO rooms VALUES (1, 'Boardroom', '8'), (2, 'Studio', '4'), (3, 'Library', '12');", card: 'S1' }];
    localStorage.setItem('grimoire.life.siso.v1', JSON.stringify(life));
  });
  await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await runCode(page, 'SELECT * FROM rooms WHERE id > 100;');
  const miss = await page.locator('#result').innerText();
  t.check('a query that returns 0 rows on a wrong table: "returned 0 rows", never "changed your company"', /returned 0 rows/.test(miss) && !/changed your company/.test(miss) && !(await current(page)).solved, miss);
  t.check('... and why, in plain words first: what the game tried, then the database last (if it said anything)', /10 was treated as words, not a number/.test(miss) && !/rooms_pkey/.test(miss), miss);
  const logLen = await page.evaluate(() => window.__play.chapter.arc.log.length);
  t.check('a run that changed nothing is not added to his change log', logLen === 2, String(logLen));
} catch (e) {
  t.check('the S3 playthrough ran to the end', false, String(e?.stack || e).split('\n').slice(0, 3).join(' | '));
}
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
