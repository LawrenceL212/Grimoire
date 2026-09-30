/* The play page fits: at 1280x720 (floating windows) and 390x844 (stacked panels) there is no
   horizontal scroll, every window is on screen, the HUD fits, and the editor accepts typing.
   On desktop the windows drag and resize, remember where they were, and stay on screen when the
   viewport shrinks. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const PAGE = 'game/play/index.html';
const ready = (page) => page.waitForFunction(() => window.__play && window.__play.ready === true, null, { timeout: 45000 }).then(() => true, () => false);
const rect = (page, sel) => page.locator(sel).evaluate((n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth);
const onScreenX = (r, W) => r.x >= -0.5 && r.r <= W + 0.5 && r.w > 100;

for (const [name, vp, phone] of [['1280x720', { width: 1280, height: 720 }, false], ['390x844', { width: 390, height: 844 }, true]]) {
  const context = phone ? { viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: vp };
  const { page, errors, close } = await openGame(PAGE, { context });
  t.check(`${name}: the page becomes ready`, await ready(page));
  t.check(`${name}: no horizontal scroll`, await noHScroll(page));
  const hudR = await rect(page, '#hud');
  t.check(`${name}: the HUD fits the width`, hudR.x >= 0 && hudR.r <= vp.width + 0.5, JSON.stringify(hudR));
  const counters = await page.locator('[data-ctr]').count();
  t.check(`${name}: all five HUD counters show`, counters === 5 && await page.locator('[data-ctr="tickets"]').isVisible());
  for (const sel of ['#win-ticket', '#win-code']) {
    const r = await rect(page, sel);
    t.check(`${name}: ${sel} is on screen horizontally`, onScreenX(r, vp.width), JSON.stringify(r));
    if (!phone) t.check(`${name}: ${sel} is on screen vertically`, r.y >= 0 && r.b <= vp.height + 0.5, JSON.stringify(r));
  }
  const scene = await rect(page, '#scene');
  t.check(`${name}: the scene has room to be seen`, scene.w >= vp.width - 1 && scene.h >= (phone ? 300 : 600), JSON.stringify(scene));
  if (phone) {
    const tk = await rect(page, '#win-ticket'), cd = await rect(page, '#win-code');
    t.check(`${name}: the windows are stacked panels under the scene`, tk.y >= scene.b - 1 && cd.y >= tk.b - 1, JSON.stringify({ scene, tk, cd }));
    t.check(`${name}: the panels are not draggable`, await page.locator('#win-code').evaluate((n) => getComputedStyle(n).position) === 'static');
  }
  const ed = page.locator('#editor');
  await ed.scrollIntoViewIfNeeded();
  await ed.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('SELECT name FROM rooms;');
  t.check(`${name}: the editor accepts typing`, (await ed.inputValue()) === 'SELECT name FROM rooms;', await ed.inputValue());
  const font = await ed.evaluate((n) => parseFloat(getComputedStyle(n).fontSize));
  t.check(`${name}: the editor text is at least 16 px on a phone (no zoom on focus)`, !phone || font >= 16, String(font));
  const runR = await rect(page, '#run');
  t.check(`${name}: Run is on screen`, runR.x >= 0 && runR.r <= vp.width + 0.5 && runR.w > 40, JSON.stringify(runR));
  t.check(`${name}: still no horizontal scroll after typing`, await noHScroll(page));
  await page.screenshot({ path: `${process.env.TEMP || '.'}/play-layout-${name}.png` }).catch(() => {});
  t.check(`${name}: no page errors`, errors.length === 0, errors.join(' | '));

  if (!phone) {
    // drag the code window by its bar
    const before = await rect(page, '#win-code');
    const bar = await rect(page, '#win-code .bar');
    await page.mouse.move(bar.x + 60, bar.y + bar.h / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x + 200, bar.y + bar.h / 2 - 40, { steps: 6 });
    await page.mouse.up();
    const moved = await rect(page, '#win-code');
    t.check('desktop: the code window drags by its title bar', Math.abs(moved.x - before.x - 140) < 3 && Math.abs(moved.y - before.y + 40) < 3, JSON.stringify({ before, moved }));
    // resize by the grip
    const grip = await rect(page, '#win-code .grip');
    await page.mouse.move(grip.x + grip.w / 2, grip.y + grip.h / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.w / 2 + 60, grip.y + grip.h / 2 - 30, { steps: 5 });
    await page.mouse.up();
    const sized = await rect(page, '#win-code');
    t.check('desktop: the code window resizes by its grip', Math.abs(sized.w - moved.w - 60) < 3 && Math.abs(sized.h - moved.h + 30) < 3, JSON.stringify({ moved, sized }));
    // remembered after a reload
    await page.reload({ waitUntil: 'domcontentloaded' });
    await ready(page);
    const again = await rect(page, '#win-code');
    t.check('desktop: position and size are remembered after a reload', Math.abs(again.x - sized.x) < 2 && Math.abs(again.y - sized.y) < 2 && Math.abs(again.w - sized.w) < 2, JSON.stringify({ sized, again }));
    // a window dragged far right stays on screen when the viewport shrinks
    const bar2 = await rect(page, '#win-ticket .bar');
    await page.mouse.move(bar2.x + 40, bar2.y + bar2.h / 2);
    await page.mouse.down();
    await page.mouse.move(bar2.x + 2000, bar2.y + bar2.h / 2, { steps: 4 });
    await page.mouse.up();
    const far = await rect(page, '#win-ticket');
    t.check('desktop: a window cannot be dragged off screen', far.r <= 1280.5, JSON.stringify(far));
    await page.setViewportSize({ width: 900, height: 640 });
    await page.waitForTimeout(300);
    const small = await rect(page, '#win-ticket');
    t.check('desktop: windows stay on screen when the viewport shrinks', small.r <= 900.5 && small.x >= 0 && small.b <= 640.5, JSON.stringify(small));
    t.check('desktop: no horizontal scroll at 900 px', await noHScroll(page));
    // a stored position that is nonsense does not break the page
    await page.evaluate(() => localStorage.setItem('grimoire.play.windows.v1', '{"code":{"x":"nope"'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    t.check('desktop: a corrupt stored layout falls back to the default', await ready(page) && onScreenX(await rect(page, '#win-code'), 900));
    await page.evaluate(() => localStorage.removeItem('grimoire.play.windows.v1'));
  }
  await close();
}
t.finish();
