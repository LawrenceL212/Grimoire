import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const ready = await page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 15000 })
  .then(() => true, () => false);
t.check('game shell boots and sets window.__game.ready', ready);
t.check('the shell has an #app mount point', await page.locator('#app').count() === 1);
t.check('no page errors on load', errors.length === 0, errors.join(' | '));
await close();
t.finish();
