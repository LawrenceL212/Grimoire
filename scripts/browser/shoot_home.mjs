// shoot_home.mjs (dev helper): the four task-16 screenshots. node scripts/browser/shoot_home.mjs <outDir>
import { openGame } from './game_lib.mjs';
const out = process.argv[2] || '.';
const seed = (balance) => (p) => p.addInitScript((bal) => {
  if (localStorage.getItem('grimoire.life.siso.v1')) return;
  const n = Date.now();
  const solves = Array.from({ length: Math.ceil(bal / 40) }, (_, k) => ({ card: `T${k}`, atMs: n - 1000, help: 'clean', unaided: true, lang: 'sql', xp: 10, gbp: 40, practice: false }));
  localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({ v: 1, startedMs: n, highMs: n, tutorial: { done: true, step: 0, skipped: [] }, cards: {}, solves, days: {}, spells: {}}));
}, balance);
for (const [name, vp] of [['1280', { width: 1280, height: 720 }], ['390', { width: 390, height: 844 }]]) {
  const { page, errors, close } = await openGame('game/play/index.html', { context: { viewport: vp }, beforeGoto: seed(1200) });
  await page.waitForFunction(() => window.__play?.ready === true && !window.__play.busy, null, { timeout: 60000 });
  await page.evaluate(() => { window.__play.timeScale = 8; document.getElementById('win-timetable') && (document.getElementById('win-timetable').hidden = true); });
  await page.evaluate(() => { const h = window.__play.home; h.apply({ ok: true, home: { ...h.home, balance: 1200 } }); return h.setMode('home'); });
  await page.waitForTimeout(500);
  if (name === '1280') await page.screenshot({ path: `${out}/task-16-bedroom.png` });
  await page.click('#hud-shop'); await page.waitForTimeout(300);
  if (name === '1280') await page.screenshot({ path: `${out}/task-16-shop.png` });
  // furnish: buy and place a few things
  const ids = ['desk-lamp', 'monitor', 'bookshelf', 'rug', 'sofa', 'coffee-table', 'plant-tall', 'wardrobe', 'bedside-table', 'poster', 'poster', 'office-chair'];
  await page.evaluate(async (ids) => {
    const r = await import('./home-rules.js'); const h = window.__play.home;
    for (const id of ids) { const b = r.buy(h.home, id); if (!b.ok) continue; h.apply(b); const it = h.home.items.find((i) => i.uid === b.uid); const spot = r.findSpot(h.home.items, it); if (spot) h.apply(r.place(h.home, b.uid, spot)); }
  }, ids);
  await page.waitForTimeout(400);
  if (name === '1280') { await page.screenshot({ path: `${out}/task-16-furnished.png` }); }
  else { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${out}/task-16-phone.png` }); }
  console.log(name, JSON.stringify(errors));
  await close();
}
