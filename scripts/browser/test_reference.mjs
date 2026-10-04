/* The Library (game/reference/): opened from the play HUD, searched, and EVERY entry's example run in the real
   runtime (PGlite scratch world, the sandboxed JS worker, the sandboxed iframe for DOM, php-wasm, a no-script frame
   for HTML/CSS) with the real output compared to what the entry says it is. A mismatch fails loudly, naming the entry.
   Also proves it is only documentation: opening, searching and running leaves the credit, help and progress record,
   the HUD, the ticket and the company world exactly as they were, and the scratch SQL never lands in the learner's database.
   Optional: SHOT=dir saves screenshots. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const SHOT = process.env.SHOT || null;
const { page, errors, close } = await openGame('game/play/index.html?ticket=double-booking-1', { context: { viewport: { width: 1280, height: 800 } } });
const ready = await page.waitForFunction(() => window.__play && window.__play.ready === true, null, { timeout: 60000 }).then(() => true, () => false);
t.check('the play page boots', ready);
if (!ready) { await close(); t.finish(); }
await page.waitForSelector('#hud-library', { timeout: 10000 });

// ---- what must not change: the progress record, the HUD, the ticket, the company world
const snapshot = () => page.evaluate(async () => {
  const life = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('grimoire.') && !k.startsWith('grimoire.reference.') && !k.startsWith('grimoire.play.windows')) life[k] = localStorage.getItem(k); }
  const hud = Object.fromEntries([...document.querySelectorAll('[data-ctr]')].map((n) => [n.dataset.ctr, n.querySelector('b').textContent.trim()]));
  const w = window.__play.world;
  const world = {};
  for (const tb of ['rooms', 'people', 'bookings']) world[tb] = await w.query(`SELECT * FROM ${tb} ORDER BY id`);
  const extra = (await w.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1")).map((r) => r.table_name);
  return { life, hud, world: JSON.stringify(world), tables: extra, runs: window.__play.runs, refused: window.__play.refused, result: document.getElementById('result').textContent, ticket: document.getElementById('win-ticket').textContent, ticketOpen: !!document.querySelector('#win-ticket .pill.open') };
});
const before = await snapshot();
t.check('a ticket is open while the library is used (so it is used mid-ticket)', before.ticketOpen && before.hud.tickets === '1', JSON.stringify(before.hud));

// ---- the HUD button opens the panel; the code window is still there
await page.click('#hud-library');
await page.waitForSelector('.rf-panel.is-open', { timeout: 10000 });
const opened = await page.evaluate(() => {
  const p = document.querySelector('.rf-panel');
  const r = p.getBoundingClientRect();
  const code = document.getElementById('win-code').getBoundingClientRect();
  return { visible: !p.hidden, expanded: document.getElementById('hud-library').getAttribute('aria-expanded'), tabs: [...p.querySelectorAll('.rf-tab')].map((b) => b.textContent), focus: document.activeElement?.className,
    inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, codeVisible: code.width > 0 && getComputedStyle(document.getElementById('win-code')).display !== 'none', rows: p.querySelectorAll('.rf-row').length, count: p.querySelector('.rf-count').textContent };
});
t.check('the Library button in the HUD opens a panel with tabs for SQL, JavaScript, PHP and HTML/CSS', opened.visible && opened.expanded === 'true' && JSON.stringify(opened.tabs) === '["SQL","JavaScript","PHP","HTML/CSS"]', JSON.stringify(opened));
t.check('the panel is on screen, does not hide the code window, and the search box has the focus', opened.inside && opened.codeVisible && /rf-search/.test(opened.focus), JSON.stringify(opened));
t.check('it lists the SQL entries first', opened.rows >= 40, opened.count);
if (SHOT) await page.screenshot({ path: `${SHOT}/reference-list.png` });

// ---- search: instant filter over names and descriptions
const typed = async (q) => { await page.fill('.rf-search', q); await page.waitForTimeout(80); return page.evaluate(() => [...document.querySelectorAll('.rf-row b')].map((b) => b.textContent)); };
const join = await typed('join');
t.check('searching "join" (SQL) finds the join entries, best name first', join.length >= 3 && /JOIN/.test(join[0]) && join.every((n) => true), JSON.stringify(join));
const desc = await typed('remove duplicate');
t.check('search reads descriptions as well as names ("remove duplicate" finds DISTINCT)', desc.includes('DISTINCT'), JSON.stringify(desc));
const none = await typed('zzzqqq');
t.check('a search with no match says so', none.length === 0 && /Nothing matches/.test(await page.textContent('.rf-list')));
await page.fill('.rf-search', '');
await page.click('.rf-tab[data-lang="js"]');
const jsq = await typed('map');
t.check('the language tab limits the search (JavaScript "map")', jsq.includes('map') && (await page.evaluate(() => document.querySelector('.rf-tab.is-on').dataset.lang)) === 'js', JSON.stringify(jsq));
await page.fill('.rf-search', '');
await page.click('.rf-tab[data-lang="sql"]');
await page.click('.rf-chip[data-cat="Joins"]');
const joins = await page.evaluate(() => [...document.querySelectorAll('.rf-row b')].map((b) => b.textContent));
t.check('a category chip filters the list (Joins)', joins.length === 3, JSON.stringify(joins));
await page.click('.rf-chip[data-cat=""]');

// ---- an entry: signature, summary, example, expected output, mistake, see also; Try it; recently opened
await page.fill('.rf-search', 'having');
await page.click('.rf-row >> nth=0');
const entry = await page.evaluate(() => { const e = document.querySelector('.rf-entry'); return { hidden: e.hidden, name: e.querySelector('.rf-name').textContent, parts: ['.rf-sig', '.rf-sum', '.rf-code', '.rf-try', '.rf-expect', '.rf-mistake', '.rf-see .rf-chip'].map((s) => !!e.querySelector(s)), setup: !!e.querySelector('.rf-setup') }; });
t.check('an entry shows name, signature, summary, example, Try it, expected output, mistake and see-also', !entry.hidden && entry.name === 'HAVING' && entry.parts.every(Boolean), JSON.stringify(entry));
await page.click('.rf-try');
await page.waitForFunction(() => { const s = document.querySelector('.rf-out')?.dataset.state; return s && s !== 'running' && s !== 'idle'; }, null, { timeout: 30000 });
const ran = await page.evaluate(() => ({ state: document.querySelector('.rf-out').dataset.state, text: document.querySelector('.rf-out pre').textContent, tag: document.querySelector('.rf-tag').textContent }));
t.check('Try it shows the real output and says it matches the page', ran.state === 'ok' && ran.text === 'colour | n\nred | 2' && /Matches/.test(ran.tag), JSON.stringify(ran));
await page.click('.rf-see .rf-chip >> nth=0');
t.check('a see-also link opens that entry', (await page.textContent('.rf-name')) === 'GROUP BY');
await page.click('.rf-back');
const recent = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.rf-chip-recent')].map((b) => b.textContent), stored: JSON.parse(localStorage.getItem('grimoire.reference.v1') || '{}') }));
t.check('recently opened lists what was opened, newest first, and is remembered', recent.chips[0] === 'GROUP BY' && recent.chips[1] === 'HAVING' && recent.stored.recent[0] === 'sql-group-by', JSON.stringify(recent));
if (SHOT) { await page.click('.rf-chip-recent >> nth=0'); await page.waitForTimeout(150); await page.screenshot({ path: `${SHOT}/reference-entry.png` }); await page.click('.rf-back'); }

// keys typed in the panel are not the game's shortcuts (F toggles the camera focus, T the tweak panel)
await page.fill('.rf-search', '');
await page.focus('.rf-search');
await page.keyboard.type('ft');
const keys = await page.evaluate(() => ({ focusBtn: document.getElementById('hud-focus').getAttribute('aria-pressed'), tweak: !!document.querySelector('.gm-tweak:not([hidden])'), value: document.querySelector('.rf-search').value }));
t.check('typing F and T into the search box does not trigger the game\'s shortcuts', keys.focusBtn === 'false' && !keys.tweak && keys.value === 'ft', JSON.stringify(keys));
await page.fill('.rf-search', '');

// ---- EVERY entry, in the real runtime, through the panel's own Try it button
const verdict = await page.evaluate(async () => {
  const { ENTRIES, matchesExpected, normalise } = await import('../reference/library.js');
  const { checkWeb, runEntry } = await import('../reference/run.js');
  const { reference } = await import('../reference/panel.js');
  const panel = reference();
  const out = [];
  for (const e of ENTRIES) {
    const row = { id: e.id, lang: e.lang, ok: false, detail: '' };
    try {
      panel.open(e.id);
      const root = panel.el;
      const btn = root.querySelector('.rf-try');
      if (e.norun) {
        row.hasButton = !!btn;
        const r = await runEntry(e); // proves the stated reason: the example really is refused by the sandbox
        row.ok = !btn && r.ok && matchesExpected(e, r.text);
        row.detail = row.ok ? '' : `norun entry: button=${!!btn} ok=${r.ok} text=${JSON.stringify(r.text)}`;
        out.push(row); continue;
      }
      if (!btn) { row.detail = 'no Try it button'; out.push(row); continue; }
      btn.click();
      const box = root.querySelector('.rf-out');
      const t0 = performance.now();
      while ((box.dataset.state === 'idle' || box.dataset.state === 'running') && performance.now() - t0 < 40000) await new Promise((r) => setTimeout(r, 30));
      if (e.lang === 'web') {
        const frame = box.querySelector('iframe');
        if (!frame) { row.detail = `no frame (${box.dataset.state})`; out.push(row); continue; }
        const checks = checkWeb(frame.contentDocument, e.check);
        const bad = checks.filter((c) => !c.ok);
        row.ok = bad.length === 0;
        row.detail = bad.map((c) => JSON.stringify(c.check)).join(' ');
      } else {
        const pre = box.querySelector('pre');
        const shown = pre ? pre.textContent : '';
        const state = box.dataset.state;
        if (e.expectError) {
          row.ok = state === 'refused' && shown.includes(e.expectError);
          row.detail = row.ok ? '' : `expected an error containing ${JSON.stringify(e.expectError)}, got [${state}] ${JSON.stringify(shown)}`;
        } else {
          row.ok = state === 'ok' && matchesExpected(e, shown);
          row.detail = row.ok ? '' : `expected ${JSON.stringify(normalise(e.expect))}, got [${state}] ${JSON.stringify(normalise(shown))}`;
        }
      }
    } catch (err) { row.detail = `threw: ${err && err.message}`; }
    out.push(row);
  }
  panel.close();
  return out;
});
for (const lang of ['sql', 'js', 'php', 'web']) {
  const rows = verdict.filter((r) => r.lang === lang);
  const bad = rows.filter((r) => !r.ok);
  t.check(`every ${lang} entry's example runs for real and its documented output is true (${rows.length - bad.length}/${rows.length})`, rows.length > 0 && bad.length === 0, bad.map((r) => `${r.id}: ${r.detail}`).join(' || '));
}
t.check('every entry was exercised', verdict.length === (await page.evaluate(async () => (await import('../reference/library.js')).ENTRIES.length)), String(verdict.length));

// ---- documentation only: nothing about the game changed
const after = await snapshot();
t.check('no credit or help state changed: the progress record is byte-for-byte the same', JSON.stringify(after.life) === JSON.stringify(before.life), Object.keys(after.life).join());
t.check('the HUD (bookings, revenue, reputation, tickets, XP) is unchanged', JSON.stringify(after.hud) === JSON.stringify(before.hud), JSON.stringify({ b: before.hud, a: after.hud }));
t.check('the ticket is still open and nothing was run or refused', after.ticketOpen && after.runs === before.runs && after.refused === before.refused && after.result === before.result && after.ticket === before.ticket, JSON.stringify({ r: [before.runs, after.runs], x: [before.refused, after.refused] }));
t.check('the company world is untouched (rooms, people, bookings identical)', after.world === before.world);
t.check('the scratch SQL never reached the learner\'s database (no extra tables)', JSON.stringify(after.tables) === JSON.stringify(before.tables), JSON.stringify(after.tables));

// ---- closing, and the Grimoire still works beside it
await page.click('#hud-library');
await page.waitForSelector('.rf-panel.is-open');
await page.keyboard.press('Escape');
const closed = await page.evaluate(() => ({ hidden: document.querySelector('.rf-panel').hidden, focus: document.activeElement?.id, expanded: document.getElementById('hud-library').getAttribute('aria-expanded') }));
t.check('Esc closes the panel and gives the focus back to the HUD button', closed.hidden && closed.focus === 'hud-library' && closed.expanded === 'false', JSON.stringify(closed));
await page.click('#hud-grimoire');
await page.waitForSelector('.gm-book-overlay.is-open', { timeout: 5000 });
t.check('the Grimoire still opens', true);
await page.keyboard.press('Escape');

// ---- a phone: the panel fits the screen
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.click('#hud-library');
await page.waitForSelector('.rf-panel.is-open');
await page.click('.rf-back'); // it reopens on the entry it was left on
await page.click('.rf-row >> nth=0');
const phone = await page.evaluate(() => { const r = document.querySelector('.rf-panel').getBoundingClientRect(); const code = document.querySelector('.rf-code'); return { l: r.left, r: r.right, t: r.top, b: r.bottom, scrollW: document.documentElement.scrollWidth, codePx: parseFloat(getComputedStyle(code).fontSize) }; });
if (SHOT) await page.screenshot({ path: `${SHOT}/reference-phone.png` });
t.check('phone: the panel fits inside the screen with readable code', phone.l >= 0 && phone.r <= 390.5 && phone.b <= 844.5 && phone.scrollW <= 390 && phone.codePx >= 12, JSON.stringify(phone));
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();
t.finish();
