import { TABLES } from '../world/views.js';

/* PHP cannot reach a Postgres server in the browser, so the learner works on a
   SQLite copy of the world through PDO and the result is written back. The
   learner's code is written to a file and included, exactly as a real request
   would load it; php-wasm's run() prefixes the script, so this also keeps
   directives like declare(strict_types=1) possible later. */
const SRC = 'https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs';
const SQLITE = 'https://cdn.jsdelivr.net/npm/php-wasm-sqlite@0.1.0/index.mjs';
const SENTINEL = '@@GRIMOIRE_WORLD@@';
const b64 = (s) => btoa(unescape(encodeURIComponent(s)));

export async function createPhpRunner() {
  const { PhpWeb } = await import(SRC);
  const { default: sqlite } = await import(SQLITE);
  const php = new PhpWeb({ version: '8.4', sharedLibs: [sqlite] });
  let out = '';
  let err = '';
  php.addEventListener('output', (e) => { out += (e.detail || []).join(''); });
  php.addEventListener('error', (e) => { err += (e.detail || []).join(''); });
  await new Promise((resolve, reject) => {
    php.addEventListener('ready', resolve);
    setTimeout(() => reject(new Error('PHP runtime never became ready')), 60000);
  });

  const createTables = Object.entries(TABLES)
    .map(([t, cols]) => {
      const sql = `CREATE TABLE ${t} (` + Object.entries(cols).map(([c, ty]) => `${c} ${ty}`).join(', ') + ')';
      return `$pdo->exec(${JSON.stringify(sql)});`;
    })
    .join('\n');

  const wrap = (code, world) => `<?php
set_time_limit(2);
$__w = json_decode(base64_decode('${b64(JSON.stringify(world))}'), true);
$pdo = new PDO('sqlite::memory:');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
${createTables}
foreach ($__w as $t => $rows) {
  foreach ($rows as $r) {
    $cols = array_keys($r);
    $pdo->prepare("INSERT INTO $t (" . implode(',', $cols) . ") VALUES (" . implode(',', array_fill(0, count($cols), '?')) . ")")
        ->execute(array_values($r));
  }
}
file_put_contents('/tmp/learner.php', '<?php ' . base64_decode('${b64(code)}'));
try { include '/tmp/learner.php'; }
catch (Throwable $e) { echo "\nPHP error: " . $e->getMessage(); $__failed = true; }
if (empty($__failed)) {
  echo "${SENTINEL}";
  $__o = [];
  foreach (['rooms', 'people', 'bookings'] as $t) {
    $__o[$t] = $pdo->query("SELECT * FROM $t ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
  }
  echo json_encode($__o);
}`;

  return {
    async run(code, world) {
      out = '';
      err = '';
      try { await php.run(wrap(code, world)); } catch (e) { err += String((e && e.message) || e); }
      const i = out.indexOf(SENTINEL);
      if (i === -1) return { ok: false, stdout: out, error: (err || out || 'PHP did not finish').trim() };
      try {
        return { ok: true, stdout: out.slice(0, i), world: JSON.parse(out.slice(i + SENTINEL.length)) };
      } catch (e) {
        return { ok: false, stdout: out, error: 'PHP returned data the game could not read.' };
      }
    },
  };
}
