/* A quick look at the chapter page: boots it, prints the state and any errors, saves a screenshot.
   PROBE_URL (default game/play/index.html?new), PROBE_SHOT (a path), PROBE_JS (code evaluated after boot). */
import { openGame } from './game_lib.mjs';

const url = process.env.PROBE_URL || 'game/play/index.html?new';
const { page, errors, close } = await openGame(url, { context: { viewport: { width: 1280, height: 800 } } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console', m.type(), m.text()); });
try {
  await page.waitForFunction(() => window.__play && window.__play.ready === true, null, { timeout: 60000 });
} catch { console.log('not ready'); }
await page.evaluate(() => { window.__play.timeScale = 6; });
if (process.env.PROBE_JS) console.log('js:', JSON.stringify(await page.evaluate(process.env.PROBE_JS)));
console.log('current', JSON.stringify(await page.evaluate(() => window.__play.chapter?.current)));
await page.waitForTimeout(800);
if (process.env.PROBE_SHOT) await page.screenshot({ path: process.env.PROBE_SHOT });
console.log('errors', JSON.stringify(errors));
await close();
