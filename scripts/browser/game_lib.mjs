/* Shared helpers for the game's browser tests. Same conventions as the
   existing probes: print ok / XX per behaviour, exit non-zero on failure. */
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export const BASE = process.env.GRIMOIRE_BASE || 'http://127.0.0.1:8010/';

export function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(base)) return undefined;
  const dir = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  return dir
    ? [join(base, dir, 'chrome-win64', 'chrome.exe'), join(base, dir, 'chrome-win', 'chrome.exe')].find(existsSync)
    : undefined;
}

export async function openGame(path = 'game/index.html', opts = {}) {
  const browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext(opts.context || {});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  return { browser, page, errors, close: () => browser.close() };
}

export function makeReporter() {
  const rows = [];
  let failed = 0;
  return {
    check(name, ok, detail = '') { rows.push({ kind: ok ? 'ok' : 'XX', name, detail }); if (!ok) failed++; },
    note(name, detail = '') { rows.push({ kind: '..', name, detail }); },
    finish() {
      for (const r of rows) console.log(`${r.kind}  ${r.name}${r.detail ? '  - ' + r.detail : ''}`);
      const checks = rows.filter((r) => r.kind !== '..');
      console.log(`\n${checks.length - failed}/${checks.length} passed`);
      process.exit(failed ? 1 : 0);
    },
  };
}
