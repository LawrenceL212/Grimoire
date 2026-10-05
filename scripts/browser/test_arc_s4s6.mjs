/* The product arc through S6 and the kept cards after it (milestone M-C), from a NEW save: the tutorial, S0-S3 played
   with their reference solutions (their cheats are test_arc_s3's), then S4 (his people and bookings tables), S5
   (Priya's paper bookings arrive through his tables; the foreign key), S6 (Tom imports Sam's spreadsheet), and
   T13, T14, T16, T17, O6, O7, O8, T18, T19, T21 on that data, each with every cheat failing first and then its
   reference, across the days the pace rule asks for. Along the way: a colleague's script and its log are shown in
   the ticket window and join his change log as that colleague's entry, once (a reload does not run it again); Reset
   never undoes it; the office seats his members from his rows; JavaScript and PHP read his company and change
   nothing; T21's morning booking arrives through his tables. Then (PART=own) a life whose tables use his own names
   (title, seats; full_name and a required email; a key with no default) plays S4 to T14. SHOT=dir saves screenshots. */
import { openGame, makeReporter } from './game_lib.mjs';
import { ready, current, settle, runCode, playCard, nextTicket } from './chapter_lib.mjs';
import { LADDER, cardById } from '../../game/problems/ladder.js';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const PART = process.env.PART || 'new';
const DAY = 86400000;
const { page, errors, close } = await openGame(`game/play/index.html${PART === 'new' ? '?new' : ''}`, { context: { viewport: { width: 1280, height: 800 } } });
page.on('dialog', (d) => d.dismiss());
const tstep = async () => (await current(page)).tutorialStep;
const arc = () => page.evaluate(async () => {
  const c = window.__play.chapter, w = window.__play.world;
  const tables = w ? await w.tables() : [];
  const n = async (tb) => (tables.includes(tb) ? w.count(tb) : 0);
  return { log: c.arc.log.map((e) => ({ card: e.card, by: e.by || null, sql: e.sql })), tables, rooms: await n('rooms'), people: await n('people'), bookings: await n('bookings'), choices: c.life.arc.choices, census: window.__play.office?.census?.() ?? null };
});
const thread = () => page.locator('#ticket-thread').innerText();
let clock = Date.now();
async function nextDay() {
  clock += DAY;
  await page.evaluate((ms) => window.__play.chapter.setNow(ms), clock);
  await page.evaluate(() => window.__play.chapter.next());
  await ready(page);
}
async function toCard(id) {
  let c = await current(page);
  if (c.pace) { await nextDay(); c = await current(page); }
  return c;
}
const MC = ['S4', 'S5', 'S6', 'T13', 'T14', 'T16', 'T17', 'O6', 'O7', 'O8', 'T18', 'T19', 'T21'];

async function playMC(ids, { checks = true } = {}) {
  for (const id of ids) {
    const card = cardById(id);
    const c = await toCard(id);
    t.check(`${id} is served in ladder order`, c.id === id && !c.solved, JSON.stringify(c));
    if (c.id !== id) return false;
    const before = await arc();
    if (checks && id === 'S5') {
      const shown = await thread();
      const priya = before.log.filter((e) => e.by === 'Priya');
      t.check("S5 arrives with Priya's script: shown in the ticket window, its log line by line (room 7 went in)", /Priya's script: Sam's paper bookings/i.test(shown) && /Sam Fletcher, room 7, Wed 16:30-17:30: went in/.test(shown), shown.slice(0, 400));
      t.check("... and what it put in joined his change log once, as Priya's entry, before S5's Reset mark", priya.length === 1 && priya[0].card === 'S5' && before.bookings === 14 && before.people === 5, JSON.stringify({ priya: priya.length, b: before.bookings, p: before.people }));
      await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' }); // Continue (not ?new)
      await ready(page);
      await page.evaluate((ms) => { window.__play.timeScale = 10; window.__play.chapter.setNow(ms); }, clock);
      const again = await arc();
      t.check('a reload at S5 does not run her script again (Continue)', (await current(page)).id === 'S5' && again.log.length === before.log.length && again.bookings === 14, JSON.stringify({ log: again.log.length, b: again.bookings }));
      t.check('the office seats his members from his rows (Monday 10:15: Priya in the Studio, Jo in the Library)', (again.census?.seated ?? 0) >= 2, JSON.stringify(again.census));
      if (SHOT) await page.screenshot({ path: `${SHOT}/mc-s5.png` });
    }
    if (checks && id === 'S6') {
      const shown = await thread();
      t.check("S6 arrives with Tom's import and its log: the Atrium line skipped, said why", /Tom's import: Sam's spreadsheet/i.test(shown) && /Atrium, Thu 09:00-10:00: skipped: there is no room called Atrium in your rooms table/.test(shown), shown.slice(0, 500));
      t.check("... and Tom's rows joined his log as Tom's entry (the end-before-start line went in: he has no CHECK)", before.log.filter((e) => e.by === 'Tom').length === 1 && before.bookings === 14 + 12, String(before.bookings));
      if (SHOT) await page.screenshot({ path: `${SHOT}/mc-s6.png` });
    }
    if (checks && id === 'T21') {
      const shown = await thread();
      t.check("T21 arrives with Priya's morning booking through his tables (Jo, the Boardroom, 08:30)", /Priya's booking this morning/i.test(shown) && /Jo Bell, Boardroom, Mon 08:30-09:30: went in/.test(shown) && before.log.at(-1).by === 'Priya' && before.log.at(-1).card === 'T21', shown.slice(0, 300));
    }
    const r = await playCard(page, card, { t });
    t.check(`${id}: every cheat fails (${r.failed.join('; ')})`, r.failed.length === card.cheats.length, JSON.stringify(r));
    t.check(`${id}: the reference solution resolves it on his company`, r.solved, JSON.stringify(r));
    if (!r.solved) return false;
    const after = await arc();
    if (checks) {
      if (card.grading === 'query' || ['js', 'php'].includes(card.languages[0])) t.check(`${id}: changes nothing in his company (a question, or ${card.languages[0]} reading it)`, after.log.length === before.log.length && after.bookings === before.bookings, JSON.stringify({ was: before.log.length, now: after.log.length }));
      if (id === 'S4') t.check('S4: his people and bookings tables exist, and his choice of time type is recorded for later', after.tables.includes('people') && after.tables.includes('bookings') && after.log.at(-1).card === 'S4' && !after.log.at(-1).by, JSON.stringify(after.tables));
      if (id === 'S5') t.check('S5: the room-7 booking is put right and the foreign key is in his log, as his entry', after.bookings === 14 && /FOREIGN KEY/.test(after.log.at(-1).sql) && !after.log.at(-1).by, after.log.at(-1).sql);
      if (id === 'T13') t.check("T13: Sam's Friday Boardroom booking is gone, one row fewer", after.bookings === before.bookings - 1);
      if (id === 'T21') t.check('T21: the clash is gone, his change log ends with his fix', after.bookings === before.bookings - 1 && /DELETE/.test(after.log.at(-1).sql));
      if (id === 'O8') { const g = await page.evaluate(() => JSON.stringify(window.__play.lastGrade)); t.check('O8: PHP counted the rooms of HIS company (four), on its practice copy', /Rooms: 4/.test(g), g); }
    }
    if (id !== MC.at(-1)) await nextTicket(page);
  }
  return true;
}

try {
  if (PART === 'new') {
    t.check('a new save boots into the tutorial', await ready(page) && (await tstep()) === 'hello');
    await page.evaluate(() => { window.__play.timeScale = 10; });
    await page.fill('#company-name', 'Harbour Desk');
    await page.click('#sequel-say [data-t="company"]');
    await page.locator('#win-notebook .nb-cell[data-row="3"][data-col="who"]').click();
    await page.click('#sequel-say [data-t="next"]');
    await page.click('#sequel-say [data-t="next"]');
    await page.click('#ticket-thread [data-act="t-hint"][data-level="1"]');
    await page.waitForTimeout(300); await ready(page);
    // ---- S0-S3 with their references (their cheats are test_arc_s3's)
    for (const card of LADDER.slice(0, LADDER.findIndex((c) => c.id === 'S4'))) {
      let c = await current(page);
      if (c.kind === 'tutorial') {
        await page.click('#run'); await settle(page);
        const studio = await page.evaluate(async () => (await window.__play.world.query("SELECT id FROM rooms WHERE name = 'Studio'"))[0].id);
        const starter = await page.locator('#editor').inputValue();
        await runCode(page, starter.replace(/= \d+;/, `= ${studio};`));
        await runCode(page, 'SELECT * FROM rooms;');
        await page.waitForTimeout(700);
        await page.evaluate(() => import('./grimoire.js').then((m) => m.grimoire().close()));
        await page.click('#sequel-say [data-t="next"]');
        await ready(page);
        c = await current(page);
      }
      if (c.pace) { await nextDay(); c = await current(page); }
      if (c.id !== card.id) { t.check(`${card.id} is served in ladder order`, false, JSON.stringify(c)); break; }
      const r = await playCard(page, card, { cheats: false });
      if (!r.solved) { t.check(`${card.id} resolves`, false, JSON.stringify(r)); break; }
      await nextTicket(page);
    }
    const s3 = await arc();
    t.check('S0-S3 played from a new save: his rooms table and four rooms, nothing else yet', s3.rooms === 4 && s3.tables.length === 1, JSON.stringify(s3.tables));
    const ok = await playMC(MC);
    if (ok) {
      const end = await arc();
      t.check('every entry of his change log is his own run or a named colleague\'s script (Priya twice, Tom once)', JSON.stringify(end.log.filter((e) => e.by).map((e) => `${e.by}@${e.card}`)) === '["Priya@S5","Tom@S6","Priya@T21"]', JSON.stringify(end.log.map((e) => e.by || e.card)));
      t.check('his schema decisions are recorded for later problems (TIMESTAMPTZ, a room link, no person link, no CHECK on times)', JSON.stringify(end.choices) === '{"timesType":"timestamptz","roomLink":true,"personLink":false,"timesCheck":false}', JSON.stringify(end.choices));
      const order = await page.evaluate(() => window.__play.chapter.life.solves.filter((s) => !s.practice).map((s) => s.card));
      t.check('the whole chapter was solved in ladder order, from a new save', JSON.stringify(order) === JSON.stringify(LADDER.map((c) => c.id)), order.join(' '));
      // Reset at T21 after solving: back to where T21 arrived, Priya's morning booking kept
      await page.click('#reset'); await settle(page); await ready(page);
      const back = await arc();
      t.check("Reset goes back to how T21 arrived: his fix undone, Priya's morning booking still there", back.bookings === end.bookings + 1 && back.log.at(-1).by === 'Priya', JSON.stringify({ was: end.bookings, now: back.bookings }));
      if (SHOT) await page.screenshot({ path: `${SHOT}/mc-end.png` });
    }
  } else {
    // ---- his own names: a life at S4 whose rooms are (id int, title, seats), keys without defaults
    await page.waitForFunction(() => window.__play, null, { timeout: 30000 });
    await page.evaluate(() => {
      const NOW = Date.now() - 3 * 86400000;
      const done = ['O1', 'O2', 'S1', 'S2', 'O3', 'O4', 'O5', 'T01', 'T02', 'T03', 'T04', 'G1', 'T08', 'T10', 'T11'];
      localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({
        v: 1, startedMs: NOW, highMs: NOW, tutorial: { done: true, step: 7, skipped: [] },
        cards: Object.fromEntries(done.map((id) => [id, { startedMs: NOW, learnSeen: true, step: 0 }])),
        solves: done.map((card) => ({ card, atMs: NOW, help: 'clean', unaided: false, lang: 'sql', xp: 0 })), days: { '2000-01-01': done }, spells: {},
        arc: { company: 'Own Names Ltd', marks: {}, log: [
          { sql: 'CREATE TABLE rooms (id int PRIMARY KEY, title VARCHAR(40) NOT NULL, seats INT NOT NULL)', card: 'S1' },
          { sql: "INSERT INTO rooms VALUES (11, 'boardroom', 10), (12, 'Studio', 4), (13, 'Library', 12), (14, 'Garden Room', 6);", card: 'S2' }] },
      }));
    });
    await page.goto(new URL('index.html', page.url()).href, { waitUntil: 'domcontentloaded' });
    t.check('a life with his own names (title, seats; ids from 11) opens at S4', await ready(page) && (await current(page)).id === 'S4', JSON.stringify(await current(page)));
    await page.evaluate((ms) => { window.__play.timeScale = 10; window.__play.chapter.setNow(ms); }, clock);
    await page.click('#ticket-thread [data-act="start"]');
    await runCode(page, "CREATE TABLE people (id int PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL);\nCREATE TABLE bookings (id int PRIMARY KEY, room_id INT NOT NULL REFERENCES rooms(id), person_id INT NOT NULL, start_at TIMESTAMP NOT NULL, end_at TIMESTAMP NOT NULL);");
    t.check('S4 passes his own tables (full_name, a required email, keys with no default, TIMESTAMP, a link already)', (await current(page)).solved, await page.locator('#result').innerText());
    await nextTicket(page);
    const c5 = await toCard('S5');
    const shown = await page.locator('#win-ticket').innerText();
    t.check("S5 serves its other branch: Priya's room-7 slip was refused by his link, and the ticket asks what that means", c5.id === 'S5' && /Sam Fletcher, room 7, Wed 16:30-17:30: refused by your database: a link column points at a row that does not exist/.test(shown) && /What does it mean/.test(shown), shown.slice(0, 2000));
    const people = await page.evaluate(async () => window.__play.world.query('SELECT id, full_name, email FROM people ORDER BY id'));
    t.check("Priya's script filled his columns: ids counted by hand, a plain value for the email she does not have", people.length === 5 && people[0].id === 1 && people.every((p) => p.email === 'x'), JSON.stringify(people));
    const r5 = await playCard(page, cardById('S5'), { t });
    t.check('S5 (branch): the wrong replies fail, the true one resolves it', r5.solved && r5.failed.length === 2, JSON.stringify(r5));
    await nextTicket(page);
    for (const id of ['S6', 'T13', 'T14']) {
      const c = await toCard(id);
      const r = await playCard(page, cardById(id), { t });
      t.check(`${id} on his own names: every cheat fails and the reference resolves it`, c.id === id && r.solved && r.failed.length === cardById(id).cheats.length, JSON.stringify(r));
      if (!r.solved) break;
      await nextTicket(page);
    }
    const objects = await page.evaluate(() => window.__play.objects);
    t.check('the office reads his rows under the house names (title -> name, full_name -> name, TIMESTAMP -> ISO)', objects.rooms[0].name === 'boardroom' && objects.people[0].name === 'Priya Shah' && /Z$/.test(objects.bookings[0].start_at), JSON.stringify([objects.rooms[0], objects.people[0], objects.bookings[0]]));
  }
} catch (e) {
  t.check('the M-C playthrough ran to the end', false, String(e?.stack || e).split('\n').slice(0, 3).join(' | '));
}
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
