import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const ready = (page) => page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout: 30000 });
const run = async (page, lang, code) => {
  await page.locator(`[data-lang="${lang}"]`).click();
  await page.locator('#editor').fill(code);
  await page.locator('#run').click();
};
const settled = (page, extra = '') =>
  page.waitForSelector(`#result.is-win, #result.is-miss${extra}`, { timeout: 15000 });

const { page, errors, close } = await openGame('game/classic.html');
await ready(page);
t.check('the goal is shown', /double-booked/i.test(await page.locator('#goal').innerText()));
t.check('the clash is visible before any code runs', await page.locator('.tt-booking.is-clash').count() === 1);
t.check('a memory meter is shown', await page.locator('.meter').count() === 1);
t.check('the demo meter is labelled as demo values',
  /Demo values: the real skill log arrives in a later phase\./.test(await page.locator('#app').innerText()));

// Empty code (the starter text on first load) runs nothing.
const before = await page.locator('.tt-booking').count();
await page.locator('#run').click();
await page.waitForSelector('#result.is-miss', { timeout: 5000 });
t.check('starter text shows "Write some code first."', (await page.locator('#result').innerText()).trim() === 'Write some code first.', await page.locator('#result').innerText());
t.check('empty code does not change the world',
  await page.locator('.tt-booking').count() === before && await page.locator('.tt-booking.is-clash').count() === 1);
await page.locator('#editor').fill('   \n ');
await page.locator('#run').click();
t.check('whitespace-only code is also refused', (await page.locator('#result').innerText()).trim() === 'Write some code first.');

await run(page, 'sql', 'DELETE FROM bookings;');
await settled(page);
t.check('the cheat is not accepted', await page.locator('#result.is-miss').count() === 1, await page.locator('#result').innerText());

await page.locator('#reset').click();
await page.waitForFunction(() => document.querySelectorAll('.tt-booking.is-clash').length === 1, null, { timeout: 15000 });
t.check('Reset restores the clash', await page.locator('.tt-booking.is-clash').count() === 1);
t.check('Reset clears the result', (await page.locator('#result').innerText()).trim() === '');

// Reset three times: each Reset closes the world it replaces, and the game still works.
const resetAndWait = async () => {
  await page.evaluate(() => { window.__oldWorlds = [...(window.__oldWorlds || []), window.__game.world]; });
  await page.locator('#reset').click();
  await page.waitForFunction(() => window.__game.world !== window.__oldWorlds.at(-1) && !document.querySelector('#reset').disabled,
    null, { timeout: 15000 });
};
for (let i = 0; i < 3; i++) await resetAndWait();
t.check('Reset closes the worlds it replaces',
  await page.evaluate(() => window.__oldWorlds.every((w) => w.db.closed === true)),
  await page.evaluate(() => JSON.stringify(window.__oldWorlds.map((w) => w.db.closed))));
t.check('after three Resets the clash is still there', await page.locator('.tt-booking.is-clash').count() === 1);

await run(page, 'sql', 'DELETE FROM bookings WHERE id = 21;');
await settled(page);
t.check('a real fix is accepted', await page.locator('#result.is-win').count() === 1, await page.locator('#result').innerText());

await page.locator('#reset').click();
await page.waitForFunction(() => document.querySelectorAll('.tt-booking.is-clash').length === 1, null, { timeout: 15000 });
await run(page, 'php', "$pdo->exec('DELETE FROM bookings WHERE id = 21');");
await page.waitForSelector('#result.is-win, #result.is-miss, #result.is-error', { timeout: 90000 });
t.check('the same problem is solved in PHP after a Reset', await page.locator('#result.is-win').count() === 1, await page.locator('#result').innerText());

await close();
{
  const g = await openGame('game/classic.html');
  await ready(g.page);
  await run(g.page, 'js', 'world.bookings = world.bookings.filter((b) => b.id !== 21);');
  await settled(g.page, ', #result.is-error');
  t.check('the same problem is solved in JavaScript', await g.page.locator('#result.is-win').count() === 1, await g.page.locator('#result').innerText());
  await g.page.locator('#reset').click();
  await g.page.waitForFunction(() => document.querySelectorAll('.tt-booking.is-clash').length === 1, null, { timeout: 15000 });
  await run(g.page, 'sql', 'SELECT nonsense FROM nowhere;');
  await g.page.waitForSelector('#result.is-error', { timeout: 15000 });
  t.check('a SQL error is shown plainly', /nonsense|nowhere|does not exist/i.test(await g.page.locator('#result').innerText()));
  await g.page.locator('[data-lang="php"]').click();
  t.check('the PHP note is honest', /SQLite copy.*endless loop/i.test(await g.page.locator('#note').innerText()));
  t.check('no page errors', g.errors.length === 0, g.errors.join(' | '));
  await g.close();
}
t.check('no page errors on first load', errors.length === 0, errors.join(' | '));
t.finish();
