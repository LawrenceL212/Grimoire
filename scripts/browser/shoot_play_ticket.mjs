/* Screenshots of ticket #1 played out in the office (for the task report): before the run, during the
   story, and after it. Not part of the suite. Usage: node scripts/browser/shoot_play_ticket.mjs <outDir> [code] [lang] [duringMs] */
import { openGame } from './game_lib.mjs';
import { join } from 'path';

const out = process.argv[2] || '.';
const prefix = process.env.SHOOT_PREFIX || 'task-9';
const code = process.argv[3] || 'DELETE FROM bookings WHERE id = 21;';
const lang = process.argv[4] || 'sql';
const during = Number(process.argv[5] || 20000);
const { page, errors, close } = await openGame('game/play/index.html', { context: { viewport: { width: 1280, height: 720 } } });
await page.waitForFunction(() => window.__play && window.__play.ready === true, null, { timeout: 45000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: join(out, `${prefix}-before.png`) });
if (lang !== 'sql') await page.locator(`.lang-tab[data-lang="${lang}"]`).click();
await page.locator('#editor').fill(code);
await page.locator('#run').click();
await page.waitForFunction(() => window.__play.phase === 'story', null, { timeout: 30000 });
// the moment the clash clears (a room turns green), or a fixed time into the story
// (SHOOT_WAIT: another moment, as a JS expression, e.g. "window.__play.office.drone.state === 'escort'")
const moment = process.env.SHOOT_WAIT || "window.__play.map.rooms.some((r) => r.state === 'ok')";
await page.waitForFunction(moment, null, { timeout: during }).catch(() => {});
await page.waitForTimeout(Number(process.env.SHOOT_AFTER || 350));
await page.screenshot({ path: join(out, `${prefix}-during.png`) });
await page.waitForFunction(() => !window.__play.busy, null, { timeout: 60000 });
await page.waitForTimeout(400);
await page.screenshot({ path: join(out, `${prefix}-after.png`) });
console.log(JSON.stringify({ log: await page.evaluate(() => window.__play.storyLog()), errors }));
await close();
