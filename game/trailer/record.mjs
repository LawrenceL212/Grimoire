// record.mjs: records the trailer deterministically, frame by frame, then encodes it with ffmpeg.
//   node game/trailer/record.mjs --stills 12,24,36,58 [--out dir]   key frames only (PNG)
//   node game/trailer/record.mjs [--fps 30] [--out dir]               the whole trailer: frames -> webm (silent)
//                                                                     and mp4 (H.264 + AAC, with soundtrack.wav)
// The page is served by the dev server at http://127.0.0.1:8011. Headless rendering is slower than real time,
// so the master clock is stepped by exactly 1/fps per captured frame: the video plays at the right speed.
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const OUT = resolve(arg('out', join(HERE, '../../.superpowers/sdd/2026-10-01-grimoire-game-phase2a')));
const BUILD = join(OUT, 'trailer-build');
const FPS = Number(arg('fps', 30));
const URL = arg('url', 'http://127.0.0.1:8011/game/trailer/index.html?capture=1');
const FFMPEG = process.env.FFMPEG || 'C:/Users/lawre/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const CHROME = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1169/chrome-win/chrome.exe`;
mkdirSync(BUILD, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(URL);
await page.waitForFunction(() => window.__trailer && window.__trailer.ready, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.__trailer.duration);

const stills = arg('stills', null);
if (stills) {
  const times = stills.split(',').map(Number);
  for (const [i, t] of times.entries()) {
    await page.evaluate((x) => { window.__trailer.seek(x); }, t);
    await page.waitForTimeout(60);
    const f = join(OUT, arg('prefix', 'trailer-frame-') + (i + 1) + '.png');
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
await page.evaluate(() => window.__trailer.seek(0));
for (let i = 0; i < n; i++) {
  await page.evaluate((x) => { window.__trailer.seek(x); }, i / FPS);
  await page.screenshot({ path: join(FR, `f${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
  if (i % 150 === 0) console.log(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();

const webm = join(OUT, 'grimoire-concept-trailer.webm'), mp4 = join(OUT, 'grimoire-concept-trailer.mp4');
const ff = (args) => execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { stdio: 'inherit' });
ff(['-framerate', String(FPS), '-i', join(FR, 'f%05d.jpg'), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-pix_fmt', 'yuv420p', webm]);
const audio = join(BUILD, 'soundtrack.wav');
ff(['-framerate', String(FPS), '-i', join(FR, 'f%05d.jpg'), ...(existsSync(audio) ? ['-i', audio] : []),
  '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-profile:v', 'high',
  ...(existsSync(audio) ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : []), '-movflags', '+faststart', mp4]);
console.log('wrote', webm, mp4, `in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
