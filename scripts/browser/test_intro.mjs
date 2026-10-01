/* The story intro (game/intro): it exposes window.__intro (duration 60-90 s, seek, play, skip, done, ready); it plays
   on its own clock and asks for each line's voice as it reaches it; a caption is shown for every line (with the
   speaker for you and the three drones); Skip and Esc end it at once (done resolves { skipped: true }) and offer the
   office; without autoplay a start card waits for a tap; the pre-rendered voice files are there and small; captions
   fit a phone; finishing or skipping disposes the stage (the frame loop stops, every listener is removed, the voices
   are released); ?next= only follows a path on this site; reduced motion holds the camera still within a shot;
   no page errors. */
import { openGame, makeReporter } from './game_lib.mjs';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const t = makeReporter();
const here = dirname(fileURLToPath(import.meta.url));
const ready = (page) => page.waitForFunction(() => window.__intro && window.__intro.ready === true, null, { timeout: 60000 });

// ---- the voice files: one per line, small
const vdir = join(here, '..', '..', 'game', 'intro', 'voice');
const mp3 = readdirSync(vdir).filter((f) => f.endsWith('.mp3'));
const total = mp3.reduce((n, f) => n + statSync(join(vdir, f)).size, 0);

const { page, errors, close } = await openGame('game/intro/index.html?autoplay=1&mute=1', { context: { viewport: { width: 1280, height: 720 } } });
try { await ready(page); } catch (e) { t.check('the intro signals ready', false, String(e).split('\n')[0]); await close(); t.finish(); }
const api = await page.evaluate(() => ({ duration: window.__intro.duration, fns: ['seek', 'play', 'skip'].every((k) => typeof window.__intro[k] === 'function'), done: typeof window.__intro.done?.then === 'function', lines: window.__intro.lines }));
t.check('window.__intro exposes duration (60-90 s), seek, play, skip, done (a promise) and ready', api.duration >= 60 && api.duration <= 90 && api.fns && api.done, JSON.stringify({ d: api.duration, fns: api.fns, done: api.done }));
t.check('one pre-rendered voice file per line, under 1 MB in all', api.lines.every((l) => mp3.includes(`${l.id}.mp3`)) && total < 1024 * 1024, `${mp3.length} files, ${total} bytes`);

await page.waitForTimeout(3200);
const playing = await page.evaluate(() => ({ time: window.__intro.time, playing: window.__intro.playing, played: [...window.__intro.voice.played] }));
const vm = await page.evaluate(() => ({ mode: window.__intro.voice.mode, loaded: window.__intro.voice.files.size }));
t.check('the pre-rendered voice files load and are preferred over speechSynthesis', vm.mode === 'files' && vm.loaded === api.lines.length, JSON.stringify(vm));
t.check('it plays on its own clock and asks for the first line\'s voice when it reaches it', playing.playing && playing.time > 1.8 && playing.played.includes('shift'), JSON.stringify(playing));

// ---- a caption for every line
await page.evaluate(() => window.__intro.pause());
const caps = await page.evaluate(async () => {
  const out = [];
  for (const l of window.__intro.lines) {
    window.__intro.seek(l.at + Math.min(1, l.len / 2));
    const c = document.getElementById('caption');
    out.push({ id: l.id, shown: c.dataset.line, text: document.getElementById('cap-text').textContent, who: document.getElementById('cap-who').textContent, op: Number(getComputedStyle(c).opacity), want: l.text, whoWant: l.who });
  }
  return out;
});
const bad = caps.filter((c) => c.shown !== c.id || !c.text.includes(c.want) || c.op < 0.5);
t.check(`a caption is shown for every line (${caps.length})`, caps.length >= 10 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
const whoOf = (id) => caps.find((c) => c.id === id)?.who;
t.check('the speaker is named for your line and each drone\'s hello (Sequel, Jay, Hex)', whoOf('promise') === 'You' && /Sequel/.test(whoOf('sequel')) && /Jay/.test(whoOf('jay')) && /Hex/.test(whoOf('hex')) && whoOf('shift') === '', JSON.stringify(caps.map((c) => c.who)));
t.check('the story is told: the noodle bar, the promise, the company, the blank Grimoire and its fading ink, the doorbell',
  /noodle bar/.test(caps[0].want) && caps.some((c) => /I'm going to be a software developer/.test(c.want)) && caps.some((c) => /register a company/.test(c.want)) && caps.some((c) => /Every page is blank/.test(c.want)) && caps.some((c) => /the ink fades/.test(c.want)) && caps.some((c) => /doorbell/.test(c.want)), '');
const between = await page.evaluate(() => { window.__intro.seek(14.6); return { line: document.getElementById('caption').dataset.line, fade: Number(document.getElementById('fade').style.opacity) }; });
t.check('between scenes it cuts through black with no caption', between.line === '' && between.fade > 0.9, JSON.stringify(between));
const signup = await page.evaluate(() => { window.__intro.seek(36.6); return { name: document.getElementById('f-name').textContent, done: document.getElementById('f-submit').textContent, op: Number(document.getElementById('signup').style.opacity) }; });
t.check('the company is registered on the laptop (the sign-up page fills in and is accepted)', signup.name === 'Siso Bookings Ltd' && /Registered/.test(signup.done) && signup.op > 0.9, JSON.stringify(signup));

// ---- Skip ends it at once
await page.evaluate(() => { window.__intro.seek(10); window.__intro.play(); });
await page.click('#skip');
const sk = await page.evaluate(async () => { const r = await Promise.race([window.__intro.done, new Promise((res) => setTimeout(() => res('timeout'), 1500))]); return { r, end: !document.getElementById('end').hidden, playing: window.__intro.playing, title: Number(document.getElementById('title').style.opacity), onward: document.getElementById('onward').getAttribute('href') }; });
t.check('Skip ends it at once: done resolves { skipped: true }, the title shows and the office is offered', sk.r && sk.r.skipped === true && sk.end && !sk.playing && sk.title > 0.9 && /play\/index\.html/.test(sk.onward), JSON.stringify(sk));
const f0 = await page.evaluate(() => window.__intro.frames);
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
const td = await page.evaluate(() => ({ frames: window.__intro.frames, disposed: window.__intro.disposed, listening: window.__intro.listening, sources: window.__intro.voice.sources.length, files: window.__intro.voice.files.size, t: window.__intro.seek(5) }));
t.check('after Skip the stage is disposed: the frame loop stops, the listeners are removed, the voices are released, seek is inert', td.disposed && td.frames === f0 && td.listening === false && td.sources === 0 && td.files === 0 && td.t > 80, JSON.stringify({ f0, ...td }));

// ---- Esc skips too; without autoplay a start card waits
await page.goto(page.url().replace('autoplay=1&', ''));
await ready(page);
const card = await page.evaluate(() => ({ start: !document.getElementById('start').hidden, playing: window.__intro.playing }));
t.check('without autoplay a start card waits for a tap (sound needs a gesture)', card.start && !card.playing, JSON.stringify(card));
await page.click('#start-btn');
await page.waitForTimeout(400);
const started = await page.evaluate(() => ({ playing: window.__intro.playing, start: document.getElementById('start').hidden }));
await page.keyboard.press('Escape');
const esc = await page.evaluate(async () => { const r = await Promise.race([window.__intro.done, new Promise((res) => setTimeout(() => res('timeout'), 1500))]); return r; });
t.check('the tap starts it; Esc skips it', started.playing && started.start && esc && esc.skipped === true, JSON.stringify({ started, esc }));

// ---- ?next= follows only a path on this site
for (const [next, follows] of [['//example.com/x', false], ['https://example.com/', false], ['./index.html?went=1', true]]) {
  await page.goto(`${process.env.GRIMOIRE_BASE || 'http://127.0.0.1:8011/'}game/intro/index.html?autoplay=1&mute=1&next=${encodeURIComponent(next)}`);
  await ready(page);
  await Promise.all([follows ? page.waitForURL(/went=1/, { timeout: 5000 }).catch(() => null) : Promise.resolve(), page.click('#skip')]);
  await page.waitForTimeout(300);
  const url = page.url();
  t.check(`?next=${next} is ${follows ? 'followed' : 'ignored'}`, follows ? /went=1/.test(url) : /game\/intro\/index\.html\?autoplay/.test(url) && !/example\.com\/?$/.test(new URL(url).origin), url);
}

// ---- a phone
await page.goto(`${process.env.GRIMOIRE_BASE || 'http://127.0.0.1:8011/'}game/intro/index.html?autoplay=1&mute=1`);
await ready(page);
await page.evaluate(() => window.__intro.pause());
await page.setViewportSize({ width: 375, height: 812 });
await page.evaluate(() => { window.__intro.seek(23.5); });
const phone = await page.evaluate(() => { const r = document.getElementById('caption').getBoundingClientRect(), s = document.getElementById('skip').getBoundingClientRect(); return { l: r.left, r: r.right, b: r.bottom, op: Number(getComputedStyle(document.getElementById('caption')).opacity), skipR: s.right, sw: document.documentElement.scrollWidth }; });
t.check('on a phone the caption and Skip fit the screen', phone.l >= 0 && phone.r <= 375.5 && phone.b <= 812 && phone.op > 0.5 && phone.skipR <= 375.5 && phone.sw <= 375, JSON.stringify(phone));
t.check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await close();

// ---- reduced motion: still shots (no camera drift inside a shot), the flag is seen
{
  const rm = await openGame('game/intro/index.html?autoplay=1&mute=1', { context: { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' } });
  await ready(rm.page);
  const cam = await rm.page.evaluate(() => { window.__intro.pause(); window.__intro.seek(1); const a = window.__intro.cameraPosition; window.__intro.seek(9); const b = window.__intro.cameraPosition; window.__intro.seek(45); const c = window.__intro.cameraPosition; return { rm: window.__intro.reducedMotion, a, b, c }; });
  const same = cam.a.every((v, i) => Math.abs(v - cam.b[i]) < 1e-6), moved = cam.a.some((v, i) => Math.abs(v - cam.c[i]) > 0.5);
  t.check('reduced motion: the camera holds still within a shot and cuts between shots', cam.rm === true && same && moved, JSON.stringify(cam));
  t.check('reduced motion: no page errors', rm.errors.length === 0, rm.errors.slice(0, 3).join(' | '));
  await rm.close();
}
t.finish();
