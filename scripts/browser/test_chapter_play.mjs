/* The opening chapter, part 2 (game/play/chapter.js): from a life that finished the tutorial and the on-ramp
   O1-O5, every remaining ticket (T01 to T21, with O6-O8 in JavaScript and PHP) is played in the real runtimes
   with its reference solution after each of its cheats has failed. Along the way: the pace rule holds new
   concepts to the day's cap and says so; Continue after a reload resumes at the right ticket; the hint ladder
   shows its cost before opening; the worked example makes a solve exposure and leaves its spells in pencil; a
   spell is written only by an unaided solve; the double-booking ticket comes last, where the ladder puts it.
   SHOT=dir saves screenshots. */
import { openGame, makeReporter } from './game_lib.mjs';
import { ready, current, settle, playCard, nextTicket } from './chapter_lib.mjs';
import { LADDER, cardById } from '../../game/problems/ladder.js';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const DAY = 86400000;
const { page, errors, close } = await openGame('game/play/index.html?ticket=double-booking-1', { context: { viewport: { width: 1280, height: 800 } } });
page.on('dialog', (d) => d.dismiss());

// a life that has done the tutorial and the on-ramp, yesterday
await page.waitForFunction(() => window.__play, null, { timeout: 30000 });
const base = Date.now() - 2 * DAY;
await page.evaluate((b) => {
  const on = ['O1', 'O2', 'O3', 'O4', 'O5'];
  const life = {
    v: 1, startedMs: b, tutorial: { done: true, step: 7, skipped: [] },
    cards: Object.fromEntries(on.map((id) => [id, { startedMs: b, learnSeen: true, step: 0 }])),
    solves: on.map((card) => ({ card, atMs: b, help: 'clean', unaided: false, lang: 'sql', xp: 10, practice: false })),
    days: { '2000-01-01': on },
    spells: { 'select-all': { langs: ['sql'], written: false, demo: true, lastMs: null, stability: 3, forms: {} } }, // the tutorial's demonstration
  };
  localStorage.setItem('grimoire.life.siso.v1', JSON.stringify(life));
}, base);
const home = new URL('index.html', page.url()).href;
await page.goto(home, { waitUntil: 'domcontentloaded' });

const written = () => page.evaluate(() => window.__play.chapter.store().all().filter((x) => x.state.written).map((x) => x.spell.id));
const lastSolve = () => page.evaluate(() => window.__play.chapter.life.solves.at(-1));
let clock = Date.now();
async function nextDay() {
  clock += DAY;
  await page.evaluate((ms) => window.__play.chapter.setNow(ms), clock);
  await page.evaluate(() => window.__play.chapter.next());
  await ready(page);
}
const allowed = new Set(); // the tutorial's demonstration is not a written spell
try {
  t.check('Continue: a life past the on-ramp resumes at T01', await ready(page) && (await current(page)).id === 'T01', JSON.stringify(await current(page)));
  await page.evaluate(() => { window.__play.timeScale = 10; });
  let paceSeen = 0, continued = false, workedChecked = false, hintsShot = false;
  for (const card of LADDER.slice(5)) {
    let c = await current(page);
    if (c.pace) {
      paceSeen++;
      t.check(`the pace rule stops a sixth new idea in a day, honestly (before ${card.id})`, /new ideas today/.test(c.pace) && /tomorrow/.test(c.pace), c.pace);
      await nextDay();
      c = await current(page);
    }
    t.check(`${card.id} is served in ladder order`, c.id === card.id && !c.solved, JSON.stringify(c));
    if (c.id !== card.id) break;

    // the hint ladder: the cost is on each rung before it is opened (T10: hint 1 on purpose)
    if (card.id === 'T10') {
      await page.click('#ticket-thread [data-act="start"]');
      const rungs = await page.locator('#ticket-thread .rung').allInnerTexts();
      t.check('every rung of the hint ladder says what it costs before it is opened', rungs.length === 4 && /3 XP/.test(rungs[0]) && /guided/.test(rungs[1]) && /practice only/.test(rungs[3]), rungs.join(' | '));
      await page.click('#ticket-thread [data-act="hint"][data-level="1"]');
      if (SHOT && !hintsShot) { await page.screenshot({ path: `${SHOT}/task-15-hints.png` }); hintsShot = true; }
    }
    // the worked example (T11): exposure, not mastery
    if (card.id === 'T11') {
      await page.click('#ticket-thread [data-act="start"]');
      for (const l of [1, 2, 3, 4]) {
        await page.click(`#ticket-thread [data-act="hint"][data-level="${l}"]`);
        if (l === 3) { await page.waitForSelector('.gm-book-overlay.is-open'); t.check('hint 3 opens the Grimoire at the entry', true); await page.keyboard.press('Escape'); }
      }
      t.check('hint 4 shows the worked example panel, runnable', await page.locator('#ticket-thread .worked [data-act="worked-run"]').count() === 1);
      await page.click('#ticket-thread [data-act="worked-run"]'); await settle(page);
      // a reload (Continue) must not wash the help out
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.evaluate((ms) => { window.__play.timeScale = 10; window.__play.chapter.setNow(ms); }, clock);
      const back = await current(page);
      t.check('after a reload, the worked example already used on T11 is still counted', back.id === 'T11' && back.hint === 4 && back.worked === true, JSON.stringify(back));
    }
    // T17: a look in the Grimoire from the HUD before the first run is recorded (it shows the code)
    if (card.id === 'T17') {
      await page.click('#hud-grimoire');
      await page.waitForSelector('.gm-book-overlay.is-open');
      await page.keyboard.press('Escape');
    }
    const r = await playCard(page, card, { t });
    t.check(`${card.id}: every cheat fails (${r.failed.join('; ')})`, r.failed.length === card.cheats.length, JSON.stringify(r));
    t.check(`${card.id}: the reference solution resolves it in the real runtime`, r.solved, JSON.stringify(r));
    if (!r.solved) break;
    const s = await lastSolve();
    if (card.id === 'T11') {
      const w = await written();
      t.check('using the worked example marks the solve assisted (exposure, 0 XP)', s.card === 'T11' && s.help === 'exposure' && s.assisted === true && s.xp === 0, JSON.stringify(s));
      t.check('... and leaves its spells unwritten (WHERE and compare stay in pencil)', !w.includes('where') && !w.includes('compare'), w.join());
      t.check('the recap says it was exposure, not mastery', /exposure, not mastery/.test(await page.locator('#ticket-thread').innerText()));
      workedChecked = true;
    } else if (s.help === 'clean' || s.help === 'nudged') {
      if (s.unaided) for (const sp of card.spells.recall) allowed.add(sp);
    }
    const w = await written();
    const extra = w.filter((x) => !allowed.has(x));
    t.check(`${card.id}: spells are written only by unaided solves (${w.join(', ')})`, extra.length === 0, `not earned: ${extra.join(', ')}`);
    if (card.id === 'T17') t.check('opening the Grimoire from the HUD before the first run makes the solve "nudged" (7 XP)', s.help === 'nudged' && s.xp === 7, JSON.stringify(s));
    if (card.id === 'T03') t.check('a question changes nothing: the cheats that changed the data were rolled back (the Boardroom still seats 8)', await page.evaluate(async () => (await window.__play.world.query("SELECT capacity FROM rooms WHERE name = 'Boardroom'"))[0].capacity) === 8);
    if (card.id === 'T17') t.check('T17 solved unaided (nudged) writes the WHERE it recalled (left in pencil at T11)', w.includes('where') && w.includes('order-by'), JSON.stringify({ w, s, casts: await page.evaluate(() => window.__play.lastSolve) }));
    if (card.id === 'T14' && SHOT) await page.screenshot({ path: `${SHOT}/task-15-chapter.png` });

    // Continue mid-chapter: a reload after T08 resumes at T10
    if (card.id === 'T08' && !continued) {
      await nextTicket(page);
      let c2 = await current(page);
      if (c2.pace) { await nextDay(); c2 = await current(page); }
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ready(page);
      await page.evaluate((ms) => { window.__play.timeScale = 10; window.__play.chapter.setNow(ms); }, clock);
      const c3 = await current(page);
      t.check('Continue mid-chapter: after a reload the chapter resumes at the right ticket (T10)', c3.id === 'T10' && c3.kind === 'card', JSON.stringify(c3));
      continued = true;
      continue;
    }
    if (card.id !== 'T21') await nextTicket(page);
  }
  t.check('the pace rule came into play on the way (new concepts held to the daily cap)', paceSeen >= 2, String(paceSeen));
  t.check('the worked-example check ran', workedChecked);
  const order = await page.evaluate(() => window.__play.chapter.life.solves.filter((s) => !s.practice).map((s) => s.card));
  t.check('the chapter was solved in ladder order, the double booking last', JSON.stringify(order) === JSON.stringify(LADDER.map((c) => c.id)), order.join(' '));
  const t21 = cardById('T21');
  t.check('T21 is the Phase 1 double-booking card, reskinned, at the end of the chapter', t21.reskinOf === 'double-booking-1');
  await page.click('#ticket-thread [data-act="next"]');
  await page.waitForTimeout(300);
  const end = await current(page);
  t.check('after the last ticket the chapter says it is done, that JavaScript and PHP continue in the next chapter, and offers practice', /whole opening chapter/.test(end.pace || '') && /JavaScript and PHP continue in the next chapter/.test(end.pace || ''), JSON.stringify(end));
  // practice: no credit, and no spell changes at all
  const before = await page.evaluate(() => JSON.stringify({ s: window.__play.chapter.store().all().map((x) => x.state), xp: window.__play.chapter.life.solves.reduce((n, s) => n + s.xp, 0) }));
  await page.click('#ticket-thread [data-act="practice"]');
  await ready(page);
  const pc = await current(page);
  const pcard = cardById(pc.id);
  const pr = await playCard(page, pcard, { cheats: false });
  const after = await page.evaluate(() => JSON.stringify({ s: window.__play.chapter.store().all().map((x) => x.state), xp: window.__play.chapter.life.solves.reduce((n, s) => n + s.xp, 0) }));
  t.check(`a practice solve (${pc.id}) earns nothing and changes no spell`, pc.practice && pr.solved && before === after, JSON.stringify({ pc, solved: pr.solved }));
} catch (e) {
  t.check('the chapter play test ran to the end', false, String(e?.stack || e).split('\n').slice(0, 3).join(' | '));
}
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
