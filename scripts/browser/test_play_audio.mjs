/* Sound on the play page: the effects follow the real events of a run (the same ones the story plays),
   the music focuses while typing and celebrates a solve, mute silences everything and persists. */
import { openGame, makeReporter } from './game_lib.mjs';
import { doubleBooking1 as problem } from '../../game/problems/double-booking-1.js';

const t = makeReporter();
const PAGE = 'game/play/index.html?ticket=double-booking-1'; // Phase 1's double-booking card on its own (the chapter is tested in test_chapter_*)
const ready = (page, timeout = 60000) =>
  page.waitForFunction(() => window.__play && window.__play.ready === true && !window.__play.busy, null, { timeout }).then(() => true, () => false);
const idle = (page, timeout = 120000) => page.waitForFunction(() => !window.__play.busy, null, { timeout }).then(() => true, () => false);
const mark = (page) => page.evaluate(() => window.__play.sound.log.length);
const since = (page, n) => page.evaluate((k) => window.__play.sound.log.slice(k).filter((e) => e.played).map((e) => e.name), n);
const quiet = (names) => names.filter((n) => !['type-click', 'ui-click'].includes(n));
// is `want` a subsequence of `got` (in order, other sounds allowed between)?
const inOrder = (got, want) => { let i = 0; for (const g of got) if (g === want[i]) i++; return i === want.length; };

async function run(page, code) {
  await page.locator('#editor').fill(code);
  await page.locator('#run').click();
  await page.waitForFunction(() => window.__play.busy, null, { timeout: 5000 }).catch(() => {});
  return idle(page);
}

const g = await openGame(PAGE, { context: { viewport: { width: 1280, height: 720 } } });
const { page, errors } = g;
t.check('the play page boots', await ready(page));
await page.evaluate(() => { window.__play.timeScale = 4; });
const engine = (expr) => page.evaluate(async (e) => {
  const audio = await import('/game/engine/audio.js'); const sfx = await import('/game/engine/sfx.js'); const music = await import('/game/engine/music.js');
  return new Function('audio', 'sfx', 'music', `return (${e});`)(audio, sfx, music);
}, expr);

t.check('no audio before a gesture', await engine('audio.getContext() === null'));
t.check('a speaker button with an accessible label sits in the HUD',
  await page.locator('#hud #hud-sound[aria-label="Sound"][aria-pressed="false"]').count() === 1, await page.locator('#hud-sound').getAttribute('aria-label'));

// the first gesture wakes the sound: the context runs, the music starts, the waiting ticket is announced
await page.locator('#ticket-said').click();
await page.waitForFunction(async () => (await import('/game/engine/audio.js')).isRunning(), null, { timeout: 5000 }).catch(() => {});
await page.waitForTimeout(700);
t.check('after the first click the audio runs and the music plays', await engine('audio.isRunning() && music.isPlaying()'));
t.check('the open ticket is announced once the sound wakes', (await since(page, 0)).includes('alert'), JSON.stringify(await since(page, 0)));

// typing: quiet clicks and the music in focus
let m = await mark(page);
await page.locator('#editor').click();
await page.keyboard.type('SELECT 1;', { delay: 90 });
const typed = await since(page, m);
t.check('typing clicks quietly (throttled, never more than one a keystroke)', typed.filter((n) => n === 'type-click').length >= 3 && typed.filter((n) => n === 'type-click').length <= 9, JSON.stringify(typed));
t.check("the music is in focus while typing", await engine("music.musicState().mood === 'focus'"));

// the real fix: run, the person goes out of the door, the rooms calm, the ticket is stamped, the drone celebrates
await page.evaluate(async () => {
  const sfx = await import('/game/engine/sfx.js');
  window.__hum = { seen: false, timer: setInterval(() => { if (sfx.loopRunning('drone-hum')) window.__hum.seen = true; }, 30) };
});
m = await mark(page);
t.check('the reference fix runs', await run(page, problem.reference.sql));
const fix = quiet(await since(page, m));
t.check('a real fix plays run, door-chime, scan-ok, success, coin, confetti-pop in that order',
  inOrder(fix, ['run', 'door-chime', 'scan-ok', 'success', 'coin', 'confetti-pop']) && !fix.includes('error') && !fix.includes('scan-fail'), JSON.stringify(fix));
t.check('the drone hums while it flies, and stops when it rests',
  await page.evaluate(() => { clearInterval(window.__hum.timer); return window.__hum.seen; }) && await page.waitForFunction(async () => !(await import('/game/engine/sfx.js')).loopRunning('drone-hum'), null, { timeout: 5000 }).then(() => true, () => false));
t.check('the music celebrates the solve', await engine("music.musicState().mood === 'celebrate' || music.musicState().baseMood !== undefined && music.liveMusic().state().mood === 'celebrate'"));

// Reset: the ticket card pops back
m = await mark(page);
await page.locator('#hud-reset').click();
t.check('Reset', await ready(page));
await page.waitForTimeout(300);
const reset = await since(page, m);
t.check('the ticket pops back on Reset (and the click is heard)', reset.includes('ticket-pop') && reset.includes('ui-click'), JSON.stringify(reset));

// the hum's lifecycle: Reset in mid-flight stops it
await page.evaluate(() => { window.__play.timeScale = 1; });
await page.locator('#editor').fill(problem.reference.sql);
await page.locator('#run').click();
const humUp = await page.waitForFunction(async () => (await import('/game/engine/sfx.js')).loopRunning('drone-hum'), null, { timeout: 15000 }).then(() => true, () => false);
t.check('the drone hums once a run is under way', humUp);
await page.locator('#hud-reset').click();
await ready(page);
await page.waitForTimeout(800);
t.check('Reset in mid-flight stops the hum', humUp && !(await engine("sfx.loopRunning('drone-hum')")));
await page.evaluate(() => { window.__play.timeScale = 4; });
await page.waitForTimeout(300);

// an SQL error: the soft error sound and nothing else
m = await mark(page);
await run(page, 'SELEKT nonsense;');
await page.waitForTimeout(400);
const err = quiet(await since(page, m));
t.check('an SQL error plays only run and error', JSON.stringify(err) === JSON.stringify(['run', 'error']), JSON.stringify(err));

// a run that changes nothing: no success, no coins
m = await mark(page);
await run(page, 'UPDATE bookings SET room_id = room_id WHERE id = 21;');
await page.waitForTimeout(400);
const noop = quiet(await since(page, m));
t.check('a no-op plays no success (and no door, scan or coin)', noop[0] === 'run' && !noop.some((n) => ['success', 'coin', 'confetti-pop', 'door-chime', 'scan-ok', 'error'].includes(n)), JSON.stringify(noop));

// the cheat: the checks fail, the drone's red scan is heard
m = await mark(page);
await run(page, problem.cheats[0].code);
const cheat = quiet(await since(page, m));
t.check('a run that fails the checks says the ticket still needs attention, and plays no success', cheat.includes('alert') && !cheat.includes('success') && !cheat.includes('coin'), JSON.stringify(cheat));
t.check("the cheat's real events are heard: people leaving by the door, the rooms calming", cheat.includes('door-chime') && cheat.includes('scan-ok'));

// a change that leaves the clash: the drone's scan turns red and that is what is heard
await page.locator('#hud-reset').click();
await ready(page);
m = await mark(page);
await run(page, "UPDATE bookings SET end_at = end_at + interval '1 minute' WHERE id = 1;");
const red = quiet(await since(page, m));
const redLog = await page.evaluate(() => window.__play.storyLog().map((e) => e.type));
t.check('a change that leaves the clash plays the red scan (scan-fail) once, no second alert after it, no success',
  red.filter((n) => n === 'scan-fail').length === 1 && !red.slice(red.indexOf('scan-fail')).includes('alert') && !red.includes('success')
  && red.filter((n) => n === 'alert').length === redLog.filter((e) => e === 'clash-started').length, `${JSON.stringify(red)} story ${JSON.stringify(redLog)}`);

// the tweak panel carries the volumes; opening it is heard
m = await mark(page);
await page.locator('#hud-tweak').click();
await page.waitForTimeout(200);
t.check('the tweak panel has master, music and effects sliders, calm and mute',
  await page.locator('.gm-tweak .gm-sound input[data-snd]').count() === 5 && (await since(page, m)).includes('window-open'), JSON.stringify(await since(page, m)));
await page.locator('.gm-tweak .gm-sound [data-snd="music"]').fill('0.45');
await page.locator('#hud-tweak').click();

// a hidden tab is silent, and comes back when shown
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(1500);
t.check('a hidden tab sets the output level to 0', (await engine('audio.outputLevel()')) < 1e-4);
await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });

// mute: silence, and it persists
await page.locator('#hud-sound').click();
await page.waitForTimeout(600);
const muted = await engine('({ level: audio.outputLevel(), muted: audio.getSettings().muted })');
t.check('mute silences everything', muted.muted && muted.level < 1e-4, JSON.stringify(muted));
await page.locator('#ticket-said').click();
await page.evaluate(() => window.__play.sound.cue('success'));
await page.waitForTimeout(150);
t.check('an effect played while muted is silent too', (await engine('audio.outputLevel()')) < 1e-4);
await page.reload();
t.check('the page boots again', await ready(page));
const after = await engine('audio.getSettings()');
t.check('mute and the volumes persist across a reload', after.muted === true && after.music === 0.45 && await page.locator('#hud-sound[aria-pressed="true"]').count() === 1, JSON.stringify(after));
await page.locator('#hud-sound').click();
t.check('unmute from the speaker', !(await engine('audio.getSettings().muted')) && await page.locator('#hud-sound[aria-pressed="false"]').count() === 1);

t.check('no page errors', errors.length === 0, errors.join(' | '));
await g.close();

// WebGL lost: the hum stops, and a solve is still celebrated (success + coin from the ticket pill)
{
  const lost = await openGame(PAGE, { context: { viewport: { width: 1280, height: 720 } } });
  const pg = lost.page;
  t.check('(webgl loss) the page boots', await ready(pg));
  await pg.locator('#ticket-said').click();
  await pg.evaluate(() => { window.__play.timeScale = 1; });
  await pg.locator('#editor').fill(problem.reference.sql);
  await pg.locator('#run').click();
  const up = await pg.waitForFunction(async () => (await import('/game/engine/sfx.js')).loopRunning('drone-hum'), null, { timeout: 15000 }).then(() => true, () => false);
  await pg.evaluate(() => { const c = document.querySelector('#scene canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); gl.getExtension('WEBGL_lose_context').loseContext(); });
  await pg.waitForTimeout(800);
  const down = await pg.evaluate(() => !!document.querySelector('.no-gl'));
  t.check('WebGL loss stops the hum', up && down && !(await pg.evaluate(async () => (await import('/game/engine/sfx.js')).loopRunning('drone-hum'))), JSON.stringify({ up, down }));
  await idle(pg);
  // a second solve with the view down: Reset, run the fix again
  await pg.locator('#hud-reset').click();
  await ready(pg);
  const n = await mark(pg);
  await run(pg, problem.reference.sql);
  const names = await since(pg, n);
  t.check('with the 3D view down a solve still plays success and coin', names.includes('success') && names.includes('coin'), JSON.stringify(names));
  t.check('(webgl loss) no page errors', lost.errors.length === 0, lost.errors.join(' | '));
  await lost.close();
}
t.finish();
