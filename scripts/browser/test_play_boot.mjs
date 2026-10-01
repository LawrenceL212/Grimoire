/* The 3D play page boots against the real world: the HUD reads the world, the office seats the
   bookings that are running at the office clock, the windows work, a real fix runs end to end,
   the scene stays inside its budgets, and losing (or never having) WebGL leaves the code window usable. */
import { openGame, makeReporter, BASE } from './game_lib.mjs';

const t = makeReporter();
const PAGE = 'game/play/index.html?ticket=double-booking-1'; // Phase 1's double-booking card on its own (the chapter is tested in test_chapter_*)
const VIEW = { viewport: { width: 1280, height: 720 } };
const ready = (page, timeout = 45000) =>
  page.waitForFunction(() => window.__play && window.__play.ready === true, null, { timeout }).then(() => true, () => false);
const hud = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-ctr]')].map((n) => [n.dataset.ctr, n.querySelector('b').textContent.trim()])));
// What the world says, asked directly (not through the page's own counters).
const truth = (page) => page.evaluate(async () => {
  const w = window.__play.world;
  const q = async (sql) => Object.values((await w.query(sql))[0])[0];
  const day = "start_at >= '2026-01-01T00:00:00Z' AND start_at < '2026-01-02T00:00:00Z'";
  const bookings = await q(`SELECT count(*)::int FROM bookings WHERE ${day}`);
  const clashes = await q(`SELECT count(*)::int FROM bookings a JOIN bookings b ON a.room_id = b.room_id AND a.id < b.id AND a.start_at < b.end_at AND b.start_at < a.end_at`);
  const now = window.__play.clock;
  const running = await w.query(`SELECT b.id, r.name AS room FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.start_at <= '${now}' AND b.end_at > '${now}' ORDER BY b.id`);
  return { bookings, clashes, running };
});
const money = (n) => `£${n.toLocaleString('en-GB')}`;
const settle = (page) => page.waitForSelector('#result.is-win, #result.is-miss, #result.is-error', { timeout: 30000 }).then(() => true, () => false);

{
  const { page, errors, close } = await openGame(PAGE, { context: VIEW });
  t.check('the play page boots and sets window.__play.ready', await ready(page));
  const w = await truth(page);
  const h = await hud(page);
  t.check('HUD bookings match the world (bookings on the timetable day)', h.bookings === String(w.bookings), `${h.bookings} vs ${w.bookings}`);
  t.check('HUD revenue is £40 per booking on the day', h.revenue === money(40 * w.bookings), `${h.revenue}`);
  t.check('HUD reputation drops 0.3 per clash from 4.8', h.reputation === `★ ${(4.8 - 0.3 * w.clashes).toFixed(1)}`, `${h.reputation} clashes=${w.clashes}`);
  t.check('HUD shows one open ticket while the clash stands', h.tickets === '1', h.tickets);
  t.check('HUD shows XP and level', h.xp === '0' && /Lv 1/.test(await page.locator('[data-ctr="xp"]').innerText()), JSON.stringify(h));
  t.check('the warning icon is lit while a ticket is open', await page.locator('#hud-warn.is-on').count() === 1);

  const scene = await page.evaluate(() => window.__play.scene.occupants());
  t.check('every running booking is a seated person in the office', scene.length === w.running.length && w.running.length > 0, `${scene.length} people, ${w.running.length} running`);
  t.check('each person sits in the room of their booking',
    w.running.every((b) => scene.some((o) => o.bookingId === b.id && o.room === b.room && o.inRoom)), JSON.stringify(scene));
  const map = await page.evaluate(() => window.__play.map.check());
  t.check('the map is sound (no overlapping floor items, every seat reachable from the door)', map.length === 0, map.join(' | '));
  t.check('the clash room glows red', await page.evaluate(() => window.__play.map.rooms.filter((r) => r.state === 'clash').map((r) => r.name).join()) === 'Room 1');

  t.check('the code window is present', await page.locator('#win-code').isVisible());
  t.check('the ticket window is present', await page.locator('#win-ticket').isVisible());
  t.check('the language tabs are SQL, JavaScript and PHP',
    (await page.locator('#win-code .lang-tab').allInnerTexts()).join('|') === 'SQL|JavaScript|PHP');
  await page.locator('.lang-tab[data-lang="php"]').click();
  t.check('the PHP tab shows the PHP note', /SQLite copy of the world/.test(await page.locator('#code-note').innerText()));
  await page.locator('.lang-tab[data-lang="sql"]').click();

  // the editor: Tab inserts spaces, the overlay colours keywords, Ctrl+Enter runs
  const ed = page.locator('#editor');
  await ed.fill('');
  await ed.click();
  await page.keyboard.press('Tab');
  await page.keyboard.type('SELECT 1;');
  t.check('Tab inserts spaces in the editor', (await ed.inputValue()) === '  SELECT 1;', JSON.stringify(await ed.inputValue()));
  t.check('the highlight overlay marks SQL keywords', await page.locator('#win-code .ed-hl .k', { hasText: 'SELECT' }).count() === 1);
  t.check('line numbers follow the text', (await page.locator('#win-code .ed-lines').innerText()).trim() === '1');
  await page.keyboard.press('Control+Enter');
  t.check('Ctrl+Enter runs the code', await settle(page));
  t.check('a SELECT shows its rows in the result strip', /1/.test(await page.locator('#result').innerText()) && await page.locator('#result table').count() === 1);

  // an error shows in the code window and changes nothing
  await ed.fill('SELEKT nonsense;');
  await page.locator('#run').click();
  await settle(page);
  t.check('an SQL error shows in the code window', await page.locator('#result.is-error').count() === 1);
  t.check('the error changed nothing in the HUD', JSON.stringify(await hud(page)) === JSON.stringify(h));

  // the reference fix, end to end through Phase 1's runner and grader
  await ed.fill('DELETE FROM bookings WHERE id = 21;');
  await page.locator('#run').click();
  await settle(page);
  t.check('the SQL reference fix is graded solved', await page.locator('#result.is-win').count() === 1, await page.locator('#result').innerText());
  const w2 = await truth(page), h2 = await hud(page);
  t.check('after the fix the HUD reads the new world', h2.bookings === String(w2.bookings) && h2.revenue === money(40 * w2.bookings) && h2.reputation === '★ 4.8' && h2.tickets === '0', JSON.stringify(h2));
  t.check('the first clean solve earns 10 XP', h2.xp === '10', h2.xp);
  t.check('the ticket reads resolved', /resolved/i.test(await page.locator('#win-ticket .pill').innerText()));
  t.check('the room is calm again', await page.evaluate(() => window.__play.map.rooms.every((r) => r.state !== 'clash')));
  const seated = await page.evaluate(() => window.__play.scene.occupants().length);
  t.check('the office seats exactly the bookings still running', seated === w2.running.length, `${seated} vs ${w2.running.length}`);

  // Reset puts the world back
  await page.locator('#hud-reset').click();
  await page.waitForFunction(() => window.__play.ready && !window.__play.busy, null, { timeout: 30000 });
  const h3 = await hud(page);
  t.check('Reset brings the clash back', h3.tickets === '1' && h3.bookings === h.bookings, JSON.stringify(h3));
  t.check('Reset leaves exactly the seeded people', await page.evaluate(() => window.__play.scene.occupants().length) === w.running.length);

  // budgets at the default camera (the view as it boots)
  await page.locator('#hud-focus').click(); await page.locator('#hud-focus').click();
  await page.evaluate(() => window.__play.resetView());
  await page.waitForTimeout(900);
  const st = await page.evaluate(() => window.__play.stats());
  t.check('under 600 draw calls at the default camera', st.calls < 600, JSON.stringify(st));
  t.check('under 400k triangles at the default camera', st.triangles < 400000, JSON.stringify(st));
  const b = await page.evaluate(() => window.__play.bench(150));
  t.note('frame time (work: update + render submission per frame; throughput: frames back to back incl. the GPU; full: each frame waited for, an upper bound)', JSON.stringify(b));
  t.check('frame work p95 under 8 ms at 1280x720', b.workP95 < 8, JSON.stringify(b));
  t.check('frame throughput (CPU and GPU) under 8 ms at 1280x720', b.throughput < 8, JSON.stringify(b));
  t.check('no page errors', errors.length === 0, errors.join(' | '));
  await close();
}

// The WebGL context is lost: say so plainly, keep the code window working.
{
  const { page, errors, close } = await openGame(PAGE, { context: VIEW });
  await ready(page);
  const lost = await page.evaluate(() => {
    const c = document.querySelector('#scene canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const ext = gl && gl.getExtension('WEBGL_lose_context');
    if (!ext) return false;
    ext.loseContext();
    return true;
  });
  t.check('WEBGL_lose_context is available to the test', lost);
  const msg = await page.waitForSelector('#gl-msg:not([hidden])', { timeout: 5000 }).then(() => true, () => false);
  t.check('a lost context shows a plain message over the scene', msg && /3D view/i.test(await page.locator('#gl-msg').innerText()), await page.locator('#gl-msg').innerText().catch(() => ''));
  const ed = page.locator('#editor');
  await ed.fill('DELETE FROM bookings WHERE id = 21;');
  t.check('the editor still accepts typing', (await ed.inputValue()).startsWith('DELETE'));
  await page.locator('#run').click();
  await settle(page);
  t.check('Run still grades the fix after the context is lost', await page.locator('#result.is-win').count() === 1, await page.locator('#result').innerText());
  t.check('the HUD still follows the world', (await hud(page)).tickets === '0');
  t.check('no page errors after the context is lost', errors.length === 0, errors.join(' | '));
  await close();
}

// WebGL is not there at all.
{
  const { page, errors, close } = await openGame(PAGE, {
    context: VIEW,
    beforeGoto: (p) => p.addInitScript(() => {
      const real = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...a) { return /webgl/i.test(kind) ? null : real.call(this, kind, ...a); };
    }),
  });
  t.check('without WebGL the page still becomes ready', await ready(page));
  t.check('without WebGL a plain message says so', /3D view/i.test(await page.locator('#gl-msg').innerText()) && await page.locator('#gl-msg').isVisible());
  t.check('without WebGL the HUD still reads the world', (await hud(page)).bookings === '21');
  await page.locator('#editor').fill("SELECT name FROM rooms WHERE id = 1;");
  await page.locator('#run').click();
  await settle(page);
  t.check('without WebGL the code window runs code', /Room 1/.test(await page.locator('#result').innerText()));
  t.check('no page errors without WebGL', errors.length === 0, errors.join(' | '));
  await close();
}

// The old address sends people to the title screen (Task 14); the Phase 1 page lives on at classic.html.
{
  const { page, close } = await openGame('game/index.html', { context: VIEW });
  await page.waitForURL((u) => !/\/game\//.test(u.pathname), { timeout: 10000 }).catch(() => {});
  t.check('game/index.html redirects to the title screen at the site root (Task 14)', new URL(page.url()).pathname === new URL(BASE).pathname, page.url());
  await close();
}
t.finish();
