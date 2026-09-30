/* Runs the game's test suite in order, stopping at the first failure. */
import { spawnSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

function hasPureTests(dir) {
  if (!existsSync(dir)) return false;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory() ? hasPureTests(p) : e.name.endsWith('.test.mjs')) return true;
  }
  return false;
}

function run(args) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: root });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (hasPureTests(join(root, 'game'))) run(['--test', 'game/']);

for (const f of ['boot', 'world', 'js_view', 'php_sync', 'grading', 'timetable', 'meter', 'slice']) {
  const file = join(here, `test_game_${f}.mjs`);
  if (existsSync(file)) run([file]);
}
