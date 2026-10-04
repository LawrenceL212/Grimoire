// shoot_home.mjs: screenshots of the home room (dev helper): node scripts/browser/shoot_home.mjs <outDir>
import { openGame } from './game_lib.mjs';
const out = process.argv[2] || '.';
for (const [name, vp] of [['1280', { width: 1280, height: 720 }], ['390', { width: 390, height: 844 }]]) {
  const { page, errors, close } = await openGame('game/play/index.html', { context: { viewport: vp }, beforeGoto: (p) => p.addInitScript(() => { if (!localStorage.getItem('grimoire.life.siso.v1')) localStorage.setItem('grimoire.life.siso.v1', JSON.stringify({ v: 1, startedMs: Date.now(), highMs: Date.now(), tutorial: { done: true, step: 0, skipped: [] }, cards: {}, solves: [], days: {}, spells: {} })); }) });
  await page.waitForFunction(() => window.__play?.ready === true && !window.__play.busy, null, { timeout: 60000 });
  await page.evaluate(() => window.__play.home.setMode('home'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/home-${name}.png` });
  console.log(name, errors);
  await close();
}
