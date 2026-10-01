/* Runs the game's test suite in order, stopping at the first failure. */
import { spawnSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function collectPureTests(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) collectPureTests(p, out);
    else if (e.name.endsWith('.test.mjs')) out.push(p);
  }
  return out;
}

function run(args) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const pure = collectPureTests(join(root, 'game'));
if (pure.length) run(['--test', ...pure]);

for (const f of ['boot', 'world', 'js_view', 'php_sync', 'grading', 'timetable', 'meter', 'slice']) {
  const file = join(here, `test_game_${f}.mjs`);
  if (existsSync(file)) run([file]);
}

for (const f of ['engine', 'art_catalogue', 'art_materials', 'art_furniture', 'art_sectors', 'art_people', 'art_drone', 'play_boot', 'play_layout', 'play_ticket', 'audio', 'grimoire']) run([join(here, `test_${f}.mjs`)]);
