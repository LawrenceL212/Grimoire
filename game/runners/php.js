import { TABLES } from '../world/views.js';

/* PHP cannot reach a Postgres server in the browser, so the learner works on a
   SQLite copy of the world through PDO and the result is written back. The
   learner's code is written to a file and included, exactly as a real request
   would load it; php-wasm's run() prefixes the script, so this also keeps
   directives like declare(strict_types=1) possible later.

   php-wasm keeps globals, functions and classes between run() calls, so every
   run must start on a pristine runtime: after each run the runtime is reset
   with PhpWeb.refresh() (pib_refresh, which shuts PHP down and starts it again
   inside the same WebAssembly module). The reset happens in the background
   after a run, so the next run only waits for it if it comes very quickly. */

// Pinned: php-wasm 0.1.0 is what the unversioned URL resolved to on 2026-09-30.
const PHP_WASM_VERSION = '0.1.0';
const SRC = `https://cdn.jsdelivr.net/npm/php-wasm@${PHP_WASM_VERSION}/PhpWeb.mjs`;
const SQLITE = 'https://cdn.jsdelivr.net/npm/php-wasm-sqlite@0.1.0/index.mjs';
const READY_TIMEOUT_MS = 60000;

const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
// A fresh marker per run, so nothing the learner prints can be mistaken for it.
const makeSentinel = () => '@@GRIMOIRE_' + [...crypto.getRandomValues(new Uint8Array(16))]
  .map((x) => x.toString(16).padStart(2, '0')).join('') + '@@';
// The wrapper adds the opening tag itself, so a learner's own is dropped.
const stripOpenTag = (code) => code.replace(/^\s*<\?php\b/, '');

const CREATE_TABLES = Object.entries(TABLES)
  .map(([t, cols]) => {
    const sql = `CREATE TABLE ${t} (` + Object.entries(cols).map(([c, ty]) => `${c} ${ty}`).join(', ') + ')';
    return `$pdo->exec(${JSON.stringify(sql)});`;
  })
  .join('\n');

/* Everything lives inside closures so the wrapper's variables never reach the
   learner: the learner's file is included in a scope that holds only $pdo. */
const wrap = (code, world, sentinel) => `<?php
set_time_limit(2);
(static function () {
  $pdo = new PDO('sqlite::memory:');
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  ${CREATE_TABLES}
  foreach (json_decode(base64_decode('${b64(JSON.stringify(world))}'), true) as $t => $rows) {
    foreach ($rows as $r) {
      $cols = array_keys($r);
      $pdo->prepare("INSERT INTO $t (" . implode(',', $cols) . ") VALUES (" . implode(',', array_fill(0, count($cols), '?')) . ")")
          ->execute(array_values($r));
    }
  }
  file_put_contents('/tmp/learner.php', '<?php ' . base64_decode('${b64(stripOpenTag(code))}'));
  $ok = (static function (PDO $pdo) {
    try { include '/tmp/learner.php'; return true; }
    catch (Throwable $e) { echo "\\nPHP error: " . $e->getMessage(); return false; }
  })($pdo);
  if (!$ok) return;
  echo "${sentinel}";
  $o = [];
  foreach (['rooms', 'people', 'bookings'] as $t) {
    $o[$t] = $pdo->query("SELECT * FROM $t ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
  }
  echo json_encode($o);
})();`;

export async function createPhpRunner() {
  const { PhpWeb } = await import(SRC);
  const { default: sqlite } = await import(SQLITE);
  let out = '';
  let err = '';

  async function start() {
    const php = new PhpWeb({ version: '8.4', sharedLibs: [sqlite] });
    php.addEventListener('output', (e) => { out += (e.detail || []).join(''); });
    php.addEventListener('error', (e) => { err += (e.detail || []).join(''); });
    await new Promise((resolve, reject) => {
      php.addEventListener('ready', resolve);
      setTimeout(() => reject(new Error('PHP runtime never became ready')), READY_TIMEOUT_MS);
    });
    return php;
  }

  let php = await start();
  // Resolves when `php` is pristine. If a reset fails, a new runtime replaces it.
  let pristine = Promise.resolve();
  const replace = () => start().then((p) => { php = p; });

  async function runOnce(code, world) {
    try { await pristine; } catch { pristine = replace(); await pristine; }
    out = '';
    err = '';
    const sentinel = makeSentinel();
    try { await php.run(wrap(code, world, sentinel)); } catch (e) { err += String((e && e.message) || e); }
    const stdout = out;
    const stderr = err;
    pristine = php.refresh().catch(replace);

    const i = stdout.indexOf(sentinel);
    if (i === -1) return { ok: false, stdout, error: (stderr || stdout || 'PHP did not finish').trim() };
    try {
      return { ok: true, stdout: stdout.slice(0, i), world: JSON.parse(stdout.slice(i + sentinel.length)) };
    } catch (e) {
      return { ok: false, stdout, error: 'PHP returned data the game could not read.' };
    }
  }

  // Single flight: runs share one runtime and one output buffer, so they queue.
  let queue = Promise.resolve();
  return {
    run(code, world) {
      const next = queue.then(() => runOnce(code, world));
      queue = next.catch(() => {});
      return next;
    },
  };
}
