/* Ticket #1 played for real: the learner's code runs against the PostgreSQL world, the office acts out
   exactly the diff between the world before and after (never the expected answer), and the ticket
   resolves only when the real checks pass. The diff the test expects is worked out here, from snapshots
   of the world the test reads itself, with the pure bridge.js. */
import { openGame, makeReporter } from './game_lib.mjs';
import { diffWorlds } from '../../game/play/bridge.js';
import { doubleBooking1 as problem } from '../../game/problems/double-booking-1.js';

const t = makeReporter();
const SPEED = 4;
const PAGE = 'game/play/index.html';
const VIEW = { viewport: { width: 1280, height: 720 } };
const ready = (page, timeout = 45000) =>
  page.waitForFunction(() => window.__play && window.__play.ready === true && !window.__play.busy, null, { timeout }).then(() => true, () => false);
const idle = (page, timeout = 120000) => page.waitForFunction(() => !window.__play.busy, null, { timeout }).then(() => true, () => false);
const hud = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-ctr]')].map((n) => [n.dataset.ctr, n.querySelector('b').textContent.trim()])));
// the world, read directly (the same shape toObjects gives the page)
const snap = (page) => page.evaluate(async () => {
  const w = window.__play.world;
  const iso = (c) => `to_char(${c} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS ${c}`;
  return {
    rooms: await w.query('SELECT id, name, capacity FROM rooms ORDER BY id'),
    people: await w.query('SELECT id, name, role FROM people ORDER BY id'),
    bookings: await w.query(`SELECT id, room_id, person_id, ${iso('start_at')}, ${iso('end_at')} FROM bookings ORDER BY id`),
  };
});
const truth = (page) => page.evaluate(async () => {
  const w = window.__play.world;
  const q = async (sql) => Object.values((await w.query(sql))[0])[0];
  const bookings = await q("SELECT count(*)::int FROM bookings WHERE start_at >= '2026-01-01T00:00:00Z' AND start_at < '2026-01-02T00:00:00Z'");
  const clashes = await q('SELECT count(*)::int FROM bookings a JOIN bookings b ON a.room_id = b.room_id AND a.id < b.id AND a.start_at < b.end_at AND b.start_at < a.end_at');
  const now = window.__play.clock;
  const running = await w.query(`SELECT b.id, r.name AS room FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.start_at <= '${now}' AND b.end_at > '${now}' ORDER BY b.id`);
  return { bookings, clashes, running };
});
const money = (n) => `£${n.toLocaleString('en-GB')}`;
const pill = (page) => page.locator('#win-ticket .pill').innerText();
const census = (page) => page.evaluate(() => window.__play.census());
const rooms = (page) => page.evaluate(() => Object.fromEntries(window.__play.map.rooms.map((r) => [r.name, r.state])));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function run(page, lang, code) {
  await page.locator(`.lang-tab[data-lang="${lang}"]`).click();
  await page.locator('#editor').fill(code);
  const before = await snap(page);
  await page.locator('#run').click();
  await page.waitForFunction(() => window.__play.busy, null, { timeout: 5000 }).catch(() => {});
  const done = await idle(page);
  const after = await snap(page);
  return { before, after, expected: diffWorlds(before, after), done };
}
async function hudMatchesWorld(page, label, tickets) {
  const w = await truth(page), h = await hud(page);
  t.check(`${label}: HUD counters come from the real world`,
    h.bookings === String(w.bookings) && h.revenue === money(40 * w.bookings) && h.reputation === `★ ${Math.max(0, 4.8 - 0.3 * w.clashes).toFixed(1)}` && h.tickets === String(tickets),
    `${JSON.stringify(h)} world=${JSON.stringify({ bookings: w.bookings, clashes: w.clashes })}`);
  return w;
}
async function officeMatchesWorld(page, label) {
  const w = await truth(page), occ = await page.evaluate(() => window.__play.scene.occupants()), c = await census(page);
  t.check(`${label}: the office holds exactly the bookings running at the clock, each in its room`,
    occ.length === w.running.length && c.people === w.running.length && w.running.every((b) => occ.some((o) => o.bookingId === b.id && o.room === b.room && o.inRoom)),
    `${JSON.stringify(occ)} vs ${JSON.stringify(w.running)} census=${JSON.stringify(c)}`);
}
async function reset(page) {
  await page.locator('#hud-reset').click();
  return ready(page, 60000);
}

const { page, errors, close } = await openGame(PAGE, { context: VIEW });
t.check('the play page boots', await ready(page));
// the office and the story run 4x faster: the same events, the same outcome, a quarter of the waiting
await page.evaluate((k) => { window.__play.timeScale = k; }, SPEED);
t.check('the ticket is Bea\'s symptom, not an instruction',
  /Bea/.test(await page.locator('#ticket-who').innerText()) && /booked Room 1 for 08:30 and someone's already sitting there/.test(await page.locator('#ticket-said').innerText())
  && !/delete|update|sql/i.test(await page.locator('#ticket-said').innerText()));
t.check('the ticket starts OPEN with its card over the clashing room', /OPEN/.test(await pill(page)) && (await census(page)).tickets === 1 && (await rooms(page))['Room 1'] === 'clash');
const seeded = (await census(page)).people;

// ---- the reference fixes in all three languages: resolved, calm, counted from the world, the log is the diff
for (const [lang, n] of [['sql', 1], ['js', 2], ['php', 3]]) {
  const r = await run(page, lang, problem.reference[lang]);
  t.check(`${lang}: the run and its story finish`, r.done);
  const log = await page.evaluate(() => window.__play.storyLog());
  const last = await page.evaluate(() => window.__play.lastEvents);
  t.check(`${lang}: the story log is exactly the real diff`, same(log, r.expected) && same(last, r.expected), `log=${JSON.stringify(log)} expected=${JSON.stringify(r.expected)}`);
  t.check(`${lang}: the diff is Bea's booking going and both clashes clearing`,
    same(r.expected.map((e) => `${e.type}:${e.bookingId}${e.otherId ? '-' + e.otherId : ''}`), ['booking-removed:21', 'clash-cleared:1-21', 'clash-cleared:4-21']), JSON.stringify(r.expected));
  t.check(`${lang}: the ticket is RESOLVED`, /RESOLVED/.test(await pill(page)) && await page.locator('#result.is-win').count() === 1, await page.locator('#result').innerText());
  const card = await page.evaluate(() => window.__play.story.ticket && { ...window.__play.story.ticket.data });
  t.check(`${lang}: the 3D ticket card is stamped RESOLVED and no longer says double-booked`, card && card.state === 'RESOLVED' && /sorted/.test(card.line) && !/double-booked/.test(card.line), JSON.stringify(card));
  const fits = await page.evaluate(() => {
    const body = document.querySelector('#win-ticket .body').getBoundingClientRect();
    return ['.recap', '.credit'].every((sel) => { const r = document.querySelector(`#ticket-thread ${sel}`).getBoundingClientRect(); return r.top >= body.top - 1 && r.bottom <= body.bottom + 1; });
  });
  t.check(`${lang}: the ticket window shows the recap and the credit line without scrolling by hand`, fits);
  const overlap = await page.evaluate(() => document.querySelector('#win-ticket').getBoundingClientRect().bottom <= document.querySelector('#win-code').getBoundingClientRect().top);
  t.check(`${lang}: the code window moved down under the grown ticket`, overlap);
  t.check(`${lang}: Bea replies and a two-line recap says what you did`,
    /Bea:/.test(await page.locator('#ticket-thread .reply').innerText()) && await page.locator('#ticket-thread .recap p').count() === 2
    && /cancelled the newer booking \(21\)/.test(await page.locator('#ticket-thread .recap').innerText()));
  t.check(`${lang}: every room is calm`, Object.values(await rooms(page)).every((s) => s !== 'clash'), JSON.stringify(await rooms(page)));
  await hudMatchesWorld(page, lang, 0);
  await officeMatchesWorld(page, lang);
  const c = await census(page);
  t.check(`${lang}: no one left walking, only the ticket card, the drone idle`, c.walkers === 0 && c.leaving === 0 && c.tickets === 1 && c.drone === 'idle', JSON.stringify(c));
  const xp = (await hud(page)).xp;
  t.check(`${lang}: XP is honest (+10 on the first clean solve only)`, xp === '10', `xp=${xp} run ${n}`);
  if (n > 1) t.check(`${lang}: a repeat solve says it earns nothing`, /No XP this time/.test(await page.locator('#ticket-thread .credit').innerText()));
  t.check(`${lang}: Reset brings the ticket back`, await reset(page) && /OPEN/.test(await pill(page)) && (await census(page)).people === seeded);
}

// ---- the cheat: the checks fail, the ticket stays OPEN with an honest note
{
  const r = await run(page, 'sql', problem.cheats[0].code);
  const log = await page.evaluate(() => window.__play.storyLog());
  t.check('cheat: the story log is exactly the real diff (every booking removed, the clashes cleared)', same(log, r.expected) && r.expected.filter((e) => e.type === 'booking-removed').length === 21, `${log.length} vs ${r.expected.length}`);
  t.check('cheat: the ticket stays OPEN', /OPEN/.test(await pill(page)) && await page.locator('#result.is-miss').count() === 1);
  t.check('cheat: the note says honestly what is wrong', /Only 0 of the 20 bookings/.test(await page.locator('#ticket-thread .still').innerText()), await page.locator('#ticket-thread').innerText());
  t.check('cheat: a hint chip says hints come later', /later update/.test(await page.locator('#ticket-thread .chip').innerText()));
  await hudMatchesWorld(page, 'cheat', 1);
  await officeMatchesWorld(page, 'cheat');
  t.check('cheat: Reset', await reset(page));
}

// ---- an SQL error: shown in the code window, nothing in the scene moves
{
  const logBefore = await page.evaluate(() => window.__play.storyLog());
  const drone0 = await page.evaluate(() => window.__play.office.drone.root.position.toArray());
  const h0 = await hud(page);
  const r = await run(page, 'sql', 'SELEKT nonsense;');
  t.check('error: shown in the code window', await page.locator('#result.is-error').count() === 1 && /syntax error/i.test(await page.locator('#result').innerText()));
  t.check('error: no scene events (the world did not change, the story did not play)',
    r.expected.length === 0 && same(await page.evaluate(() => window.__play.lastEvents), []) && same(await page.evaluate(() => window.__play.storyLog()), logBefore));
  const drone1 = await page.evaluate(() => window.__play.office.drone.root.position.toArray());
  t.check('error: the drone stays at rest and the HUD is unchanged', same(drone0, drone1) && same(await hud(page), h0) && (await census(page)).drone === 'idle');
}

// ---- a run that changes nothing: the drone shrugs, the page says so
{
  await page.locator('#editor').fill('UPDATE bookings SET room_id = room_id WHERE id = 21;');
  await page.locator('#run').click();
  const shrugged = await page.waitForFunction(() => window.__play.office.drone.state === 'shrug', null, { timeout: 15000 }).then(() => true, () => false);
  await idle(page);
  t.check('no-op: the drone shrugs', shrugged);
  t.check('no-op: the code window says the world did not change', /did not change/.test(await page.locator('#result').innerText()), await page.locator('#result').innerText());
  t.check('no-op: no events', same(await page.evaluate(() => window.__play.storyLog()), []) && same(await page.evaluate(() => window.__play.lastEvents), []));
  t.check('no-op: the ticket stays OPEN, nobody moved', /OPEN/.test(await pill(page)) && (await census(page)).people === seeded);
}

// ---- a move between rooms: the drone escorts the person, the old room calms, the new room clashes
{
  await page.locator('#editor').fill('UPDATE bookings SET room_id = 3 WHERE id = 21;');
  const before = await snap(page);
  await page.locator('#run').click();
  const escorted = await page.waitForFunction(() => window.__play.office.drone.state === 'escort', null, { timeout: 20000 }).then(() => true, () => false);
  await idle(page);
  const expected = diffWorlds(before, await snap(page));
  t.check('move: the drone escorts the person', escorted);
  t.check('move: the story log is exactly the real diff', same(await page.evaluate(() => window.__play.storyLog()), expected), JSON.stringify(expected));
  t.check('move: the diff is a move, two clashes cleared, two started',
    same(expected.map((e) => e.type), ['booking-moved', 'clash-cleared', 'clash-cleared', 'clash-started', 'clash-started']));
  const occ = await page.evaluate(() => window.__play.scene.occupants().find((o) => o.bookingId === 21));
  t.check('move: the person is seated in Room 3 now', occ && occ.room === 'Room 3' && occ.inRoom && occ.seated, JSON.stringify(occ));
  const st = await rooms(page);
  t.check('move: Room 3 pulses red, Room 1 is calm (not shown as sorted: the ticket failed)', st['Room 3'] === 'clash' && st['Room 1'] === 'calm', JSON.stringify(st));
  t.check('move: the ticket stays OPEN and names the new clash', /OPEN/.test(await pill(page)) && /Room 3 is double-booked now/.test(await page.locator('#ticket-thread').innerText()), await page.locator('#ticket-thread').innerText());
  await hudMatchesWorld(page, 'move', 1);
  t.check('move: Reset', await reset(page));
}

// ---- a booking added at the office clock: someone walks in from the door and sits
{
  const r = await run(page, 'sql', "INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (2, 4, '2026-01-01T08:40:00Z', '2026-01-01T09:10:00Z');");
  const log = await page.evaluate(() => window.__play.storyLog());
  // 08:40-09:10 in Room 2 overlaps booking 2 (08:00-09:00) and booking 5 (09:00-10:00)
  t.check('add: the story log is exactly the real diff (added, then two clashes in Room 2)', same(log, r.expected) && same(r.expected.map((e) => `${e.type}:${e.bookingId}-${e.otherId ?? ''}`), ['booking-added:22-', 'clash-started:2-22', 'clash-started:5-22']), JSON.stringify(log));
  const occ = await page.evaluate(() => window.__play.scene.occupants().find((o) => o.bookingId === 22));
  t.check('add: the new person is seated in Room 2', occ && occ.room === 'Room 2' && occ.inRoom && occ.seated, JSON.stringify(occ));
  t.check('add: Room 2 pulses red', (await rooms(page))['Room 2'] === 'clash');
  await officeMatchesWorld(page, 'add');
  t.check('add: Reset', await reset(page));
}

// ---- changes with no booking event: honest words, the office reconciled, nobody disappears
{
  const r = await run(page, 'sql', 'UPDATE bookings SET person_id = 3 WHERE id = 21;');
  const text = await page.locator('#result').innerText();
  t.check('person change: not "nothing changed", it says what changed', !/did not change/.test(text) && /No booking moved; 1 row in bookings changed/.test(text) && r.expected.length === 0, text);
  t.check('person change: the drone did not shrug about it', (await census(page)).drone === 'idle');
  const occ = await page.evaluate(() => window.__play.scene.occupants().find((o) => o.bookingId === 21));
  t.check('person change: the booking now shows its new person, still seated in Room 1', occ && occ.name === 'Person 3' && occ.room === 'Room 1' && occ.inRoom && occ.seated, JSON.stringify(occ));
  await officeMatchesWorld(page, 'person change');
  t.check('person change: Reset', await reset(page));
  await run(page, 'sql', "UPDATE rooms SET name = 'Room One' WHERE id = 1;");
  const text2 = await page.locator('#result').innerText();
  t.check('room rename: says 1 row in rooms changed', /No booking moved; 1 row in rooms changed/.test(text2), text2);
  const c = await census(page), occ2 = await page.evaluate(() => window.__play.scene.occupants());
  t.check('room rename: nobody disappears from the renamed room', c.people === seeded && occ2.filter((o) => o.room === 'Room 1' && o.inRoom).length === 2, JSON.stringify(occ2));
  t.check('room rename: the clash still glows red in that room', (await rooms(page))['Room 1'] === 'clash');
  t.check('room rename: Reset', await reset(page));
}

// ---- rapid double Run is refused while busy (a second INSERT would add a second booking)
{
  await page.locator('#editor').fill("INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (2, 1, '2026-01-02T12:00:00Z', '2026-01-02T12:30:00Z');");
  const runs0 = await page.evaluate(() => window.__play.runs);
  await page.locator('#editor').focus();
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('Control+Enter');
  await page.evaluate(() => document.querySelector('#run').click());
  await page.keyboard.press('Control+Enter');
  await idle(page);
  const n = await page.evaluate(async () => (await window.__play.world.query("SELECT count(*)::int AS n FROM bookings WHERE start_at >= '2026-01-02T00:00:00Z'"))[0].n);
  const p = await page.evaluate(() => ({ runs: window.__play.runs, refused: window.__play.refused }));
  t.check('rapid Run: only one run happened, the others were refused', p.runs === runs0 + 1 && p.refused >= 1 && n === 1, `${JSON.stringify(p)} runs0=${runs0} added=${n}`);
  t.check('rapid Run: the booked-for-later card came and went', (await census(page)).tickets === 1);
  t.check('rapid Run: Reset', await reset(page));
}

// ---- Reset mid-story, with windows dragged and runs pressed in between: exactly the seeded office
{
  for (let round = 0; round < 3; round++) {
    await page.locator('#editor').fill(round === 1 ? 'UPDATE bookings SET room_id = 3 WHERE id = 21;' : 'DELETE FROM bookings WHERE id = 21;');
    await page.locator('#run').click();
    await page.waitForFunction(() => window.__play.phase === 'story', null, { timeout: 20000 });
    if (round === 1) { // Reset while the drone is walking someone to Room 3
      const inFlight = await page.waitForFunction(() => window.__play.office.drone.state === 'escort' && window.__play.office.drone.follow, null, { timeout: 20000 }).then(() => true, () => false);
      t.check('Reset mid-move: the escort is in flight when Reset is pressed', inFlight);
    } else await page.waitForTimeout((600 + round * 700) / SPEED);
    const bar = await page.locator('#win-ticket .bar').boundingBox();
    await page.mouse.move(bar.x + 60, bar.y + 10); await page.mouse.down(); await page.mouse.move(bar.x + 140, bar.y + 40, { steps: 4 }); await page.mouse.up();
    await page.locator('#run').click({ force: true }).catch(() => {}); // refused: the story is playing
    await page.locator('#hud-reset').click();
    await ready(page, 60000);
    if (round === 0) t.check('Reset mid-story: the reset says the fix had resolved the ticket (credit not silently lost)', /fix had resolved/.test(await page.locator('#result').innerText()), await page.locator('#result').innerText());
  }
  const c = await census(page);
  t.check('Reset mid-story: exactly the seeded people, no one walking or leaving', c.people === seeded && c.seated === seeded && c.leaving === 0 && c.walkers === 0, JSON.stringify(c));
  t.check('Reset mid-story: no stray cards (just the open ticket), the drone idle', c.tickets === 1 && c.drone === 'idle', JSON.stringify(c));
  t.check('Reset mid-story: the ticket is OPEN with nothing under it', /OPEN/.test(await pill(page)) && (await page.locator('#ticket-thread').innerText()).trim() === '');
  await page.waitForTimeout(2500 / SPEED * 2); // anything the cancelled story left running would show up now
  const c2 = await census(page);
  t.check('Reset mid-story: still exactly the seeded office a moment later', c2.people === seeded && c2.walkers === 0 && c2.tickets === 1, JSON.stringify(c2));
  await officeMatchesWorld(page, 'after Reset');
  const rest = await page.evaluate(() => { const o = window.__play.office; return o.drone.root.position.distanceTo(o.rest) < 0.05; });
  t.check('Reset mid-story: the drone is back at its desk', rest);
  const again = await run(page, 'sql', 'DELETE FROM bookings WHERE id = 21;');
  t.check('after the chaos a real fix still resolves the ticket', again.done && /RESOLVED/.test(await pill(page)));
}

t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();

// ---- the 3D view is lost in the middle of the story: the real outcome is still shown
{
  const { page: p2, errors: e2, close: close2 } = await openGame(PAGE, { context: VIEW });
  t.check('GL loss: the page boots', await ready(p2));
  await p2.evaluate((k) => { window.__play.timeScale = k; }, SPEED);
  await p2.locator('#editor').fill('DELETE FROM bookings WHERE id = 21;');
  await p2.locator('#run').click();
  await p2.waitForFunction(() => window.__play.phase === 'story', null, { timeout: 20000 });
  const lost = await p2.evaluate(() => { const c = document.querySelector('#scene canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); const x = gl && gl.getExtension('WEBGL_lose_context'); if (!x) return false; x.loseContext(); return true; });
  t.check('GL loss: the context was lost mid-story', lost);
  await idle(p2, 30000);
  t.check('GL loss: the ticket still ends RESOLVED with the reply', /RESOLVED/.test(await p2.locator('#win-ticket .pill').innerText()) && /Bea:/.test(await p2.locator('#ticket-thread').innerText()));
  t.check('GL loss: the result line says solved', await p2.locator('#result.is-win').count() === 1, await p2.locator('#result').innerText());
  await hudMatchesWorld(p2, 'GL loss', 0);
  t.check('GL loss: the XP was earned and shown', (await hud(p2)).xp === '10');
  t.check('GL loss: no page errors', e2.length === 0, e2.join(' | '));
  await close2();
}
t.finish();
