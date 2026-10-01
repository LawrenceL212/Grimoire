// record.mjs: records the story intro deterministically, frame by frame, then encodes it with ffmpeg.
//   node game/intro/make_audio.mjs                      first: the voices and the soundtrack (intro-build/soundtrack.wav)
//   node game/intro/record.mjs [--w 360 --h 640 --dsf 2] [--fps 30] [--out file.mp4]
//   node game/intro/record.mjs --stills 24,56 [--prefix name-]   key frames only (PNG, next to the video)
// The page is served at http://127.0.0.1:8011 (GRIMOIRE_BASE). Headless rendering is slower than real time, so the
// master clock is stepped by exactly 1/fps per captured frame and the video plays at the right speed. The default
// is a phone-shaped video (360 x 640 CSS pixels at 2x: 720 x 1280), H.264 + AAC with the soundtrack.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const SDD = resolve(join(HERE, '../../.superpowers/sdd/2026-10-01-grimoire-game-phase2a'));
const BUILD = join(SDD, 'intro-build');
const OUT = resolve(arg('out', join(SDD, 'grimoire-intro.mp4')));
const FPS = Number(arg('fps', 30)), W = Number(arg('w', 360)), H = Number(arg('h', 640)), DSF = Number(arg('dsf', 2));
const BASE = process.env.GRIMOIRE_BASE || 'http://127.0.0.1:8011/';
const URL = `${BASE}game/intro/index.html?capture=1`;
const FFMPEG = process.env.FFMPEG || 'C:/Users/lawre/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const CHROME = process.env.CHROMIUM_PATH || `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1169/chrome-win/chrome.exe`;
mkdirSync(BUILD, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(URL);
await page.waitForFunction(() => window.__intro && window.__intro.ready, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.__intro.duration);

const stills = arg('stills', null);
if (stills) {
  for (const t of stills.split(',').map(Number)) {
    await page.evaluate((x) => { window.__intro.seek(x); }, t);
    await page.waitForTimeout(60);
    const f = join(dirname(OUT), `${arg('prefix', 'intro-frame-')}${t}.png`);
    await page.screenshot({ path: f });
    console.log('still', t, f);
  }
  await browser.close();
  process.exit(0);
}

const FR = join(BUILD, 'frames');
if (existsSync(FR)) rmSync(FR, { recursive: true });
mkdirSync(FR, { recursive: true });
const n = Math.round(duration * FPS);
const t0 = Date.now();
await page.evaluate(() => window.__intro.seek(0));
for (let i = 0; i < n; i++) {
  await page.evaluate((x) => { window.__intro.seek(x); }, i / FPS);
  await page.screenshot({ path: join(FR, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
  if (i % 300 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();

const audio = join(BUILD, 'soundtrack.wav');
execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(FR, 'f%05d.jpg'), ...(existsSync(audio) ? ['-i', audio] : []),
  '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', arg('crf', '29'), '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-profile:v', 'high',
  ...(existsSync(audio) ? ['-c:a', 'aac', '-b:a', '112k', '-shortest'] : []), '-movflags', '+faststart', OUT], { stdio: 'inherit' });
console.log('wrote', OUT, `${(statSync(OUT).size / 1048576).toFixed(2)} MB in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
