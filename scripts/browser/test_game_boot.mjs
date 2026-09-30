import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const CDN = '**/cdn.jsdelivr.net/**';
const isReady = (page, timeout = 30000) =>
  page.waitForFunction(() => window.__game && window.__game.ready === true, null, { timeout }).then(() => true, () => false);
// Hold every CDN response back for a while, so the loading state can be seen.
const animation = (page) => page.locator('#loading')
  .evaluate((n) => getComputedStyle(n).animationName, null, { timeout: 2000 }).catch(() => null);
const slowCdn = (ms) => (page) => page.route(CDN, async (route) => { await new Promise((r) => setTimeout(r, ms)); await route.continue(); });

{
  const { page, errors, close } = await openGame('game/classic.html');
  t.check('game shell boots and sets window.__game.ready', await isReady(page, 15000));
  t.check('the shell has an #app mount point', await page.locator('#app').count() === 1);
  t.check('no page errors on load', errors.length === 0, errors.join(' | '));
  await close();
}

// Loading state: while the world opens, say so and keep Run disabled.
{
  const { page, errors, close } = await openGame('game/classic.html', { beforeGoto: slowCdn(2000) });
  const loading = page.locator('#loading');
  const shown = await loading.isVisible();
  t.check('while the world opens, "Opening the office" is shown', shown && /Opening the office/.test(await loading.innerText()));
  t.check('while the world opens, Run is disabled', await page.locator('#run').isDisabled());
  t.check('the loading state is animated when motion is allowed',
    ![null, 'none'].includes(await animation(page)));
  await isReady(page);
  t.check('once the world is drawn, the loading state is gone', !(await loading.isVisible()));
  t.check('once the world is drawn, Run is enabled', await page.locator('#run').isEnabled());
  t.check('the timetable has rows once loaded', await page.locator('.tt-row').count() > 0);
  t.check('no page errors while loading slowly', errors.length === 0, errors.join(' | '));
  await close();
}
{
  const { page, close } = await openGame('game/classic.html', { context: { reducedMotion: 'reduce' }, beforeGoto: slowCdn(1500) });
  t.check('the loading state is still under reduced motion',
    (await animation(page)) === 'none');
  await close();
}

// The CDN is blocked: the page says so plainly, and Reset retries.
{
  let blocked = true;
  const { page, close } = await openGame('game/classic.html', {
    beforeGoto: (p) => p.route(CDN, (route) => (blocked ? route.abort() : route.continue())),
  });
  const failed = await page.waitForSelector('#result.is-error', { timeout: 15000 }).then(() => true, () => false);
  const text = failed ? await page.locator('#result').innerText() : '';
  t.check('with the CDN blocked, a visible failure message appears', failed && /could not start/i.test(text) && /connection/i.test(text), text);
  t.check('with the CDN blocked, the loading state is gone', !(await page.locator('#loading').isVisible()));
  const quick = { timeout: 3000 };
  await page.locator('#editor').fill('SELECT 1;', quick).catch(() => {});
  await page.locator('#run').click(quick).catch(() => {});
  const notReady = (await page.locator('#result').innerText(quick).catch(() => '')).trim();
  t.check('Run says the game is not ready yet', notReady === 'The game is not ready yet.', notReady);
  blocked = false;
  await page.locator('#reset').click(quick).catch(() => {});
  t.check('Reset retries, and the game starts once the CDN is back', await isReady(page));
  t.check('after the retry the clash is visible', await page.locator('.tt-booking.is-clash').count() === 1);
  await close();
}

// A failure that is not an Error still reads as something, never "undefined".
{
  const { page, close } = await openGame('game/classic.html', {
    beforeGoto: (p) => p.route('**/pglite@*/dist/index.js', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: 'throw "the database would not open";' })),
  });
  await page.waitForSelector('#result.is-error', { timeout: 15000 }).catch(() => {});
  const text = await page.locator('#result').innerText({ timeout: 3000 }).catch(() => '');
  t.check('a non-Error failure is reported by its value', /the database would not open/.test(text) && !/undefined/.test(text), text);
  await close();
}

// main.js itself never arrives: the page is still not blank.
{
  const { page, close } = await openGame('game/classic.html', { beforeGoto: (p) => p.route('**/game/main.js', (route) => route.abort()) });
  const text = await page.locator('#app').innerText();
  t.check('without the game script, #app still says what is happening', /Loading the game/.test(text) && /connection/.test(text), text);
  await close();
}
t.finish();
