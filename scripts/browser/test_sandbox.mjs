/* The sandbox: learner JS and PHP cannot reach the game's storage, login, DOM or network, a runaway loop is
   killed without freezing the page, and the next run works. Runs against the real browser and the real CDN. */
import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const { page, errors, close } = await openGame();
const r = await page.evaluate(async () => {
  const out = {};
  const { createSandbox, getSandbox } = await import('/game/sandbox/client.js');
  const { runJs } = await import('/game/runners/js.js');
  const { createPhpRunner } = await import('/game/runners/php.js');

  // A fake login the learner must not be able to read.
  localStorage.setItem('firebase:authUser:FAKE:[DEFAULT]', JSON.stringify({ uid: 'SECRET-UID', stsTokenManager: { refreshToken: 'SECRET-TOKEN' } }));
  await new Promise((res, rej) => {
    const rq = indexedDB.open('firebaseLocalStorageDb', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('firebaseLocalStorage', { keyPath: 'fbase_key' });
    rq.onsuccess = () => {
      const tx = rq.result.transaction('firebaseLocalStorage', 'readwrite');
      tx.objectStore('firebaseLocalStorage').put({ fbase_key: 'firebase:authUser:FAKE', value: { uid: 'SECRET-UID', refreshToken: 'SECRET-TOKEN' } });
      tx.oncomplete = () => { rq.result.close(); res(); };
    };
    rq.onerror = () => rej(rq.error);
  });

  // Heartbeat: the longest gap between two timer ticks on the main thread.
  let last = performance.now(); let worst = 0; let beatOn = true;
  (function beat() { const n = performance.now(); worst = Math.max(worst, n - last); last = n; if (beatOn) setTimeout(beat, 20); })();
  const resetWorst = () => { worst = 0; last = performance.now(); };
  const empty = { rooms: [], people: [], bookings: [] };

  const sb = getSandbox();
  let t0 = performance.now();
  await sb.warm('js'); out.jsColdMs = Math.round(performance.now() - t0);
  t0 = performance.now();
  await sb.warm('php'); out.phpColdMs = Math.round(performance.now() - t0);

  // --- learner JS probes (each one reports instead of throwing)
  const here = location.origin;
  const probe = `
    const attempt = async (f) => { try { return String(await f()); } catch (e) { return 'ERR ' + (e && e.name); } };
    const res = {};
    res.origin = String(self.origin);
    res.localStorage = typeof localStorage; res.sessionStorage = typeof sessionStorage; res.cookie = typeof document;
    res.parent = typeof parent; res.top = typeof top; res.window = typeof window; res.document = typeof document;
    res.idb = await attempt(() => new Promise((ok, no) => {
      const rq = indexedDB.open('firebaseLocalStorageDb');
      let fresh = false; rq.onupgradeneeded = () => { fresh = true; };
      rq.onsuccess = () => { const names = [...rq.result.objectStoreNames]; rq.result.close(); ok(JSON.stringify({ fresh, names })); };
      rq.onerror = () => no(rq.error);
    }));
    res.fetchSame = await attempt(() => fetch('${here}/game/classic.html').then((x) => x.status));
    res.fetchOther = await attempt(() => fetch('https://cdn.jsdelivr.net/npm/php-wasm@0.1.0/package.json').then((x) => x.status));
    res.xhr = await attempt(() => new Promise((ok, no) => { const x = new XMLHttpRequest(); x.open('GET', '${here}/game/classic.html'); x.onload = () => ok(x.status); x.onerror = () => no({ name: 'NetworkError' }); x.send(); }));
    res.ws = await attempt(() => new Promise((ok, no) => { const s = new WebSocket('ws://127.0.0.1:8011/'); s.onopen = () => ok('open'); s.onerror = () => no({ name: 'WsError' }); }));
    res.importScripts = await attempt(() => importScripts('${here}/game/sandbox/host.js'));
    res.dynamicImport = await attempt(() => import('${here}/game/sandbox/client.js'));
    return res;`;
  out.js = await runJs(probe, empty);

  // --- learner PHP probes
  const php = await createPhpRunner();
  const phpProbe = `
    $v = class_exists('Vrzno') ? new Vrzno() : null;
    $seen = [];
    foreach (['localStorage', 'sessionStorage', 'parent', 'top', 'caches'] as $p) { $seen[$p] = $v ? ($v->$p === null ? 'absent' : 'PRESENT') : 'nobridge'; }
    $seen['origin'] = $v ? $v->origin : 'nobridge';
    echo json_encode(['vrzno' => $v !== null, 'seen' => $seen]);`;
  out.phpIdb = await php.run(`$v = new Vrzno(); $v->indexedDB->open('firebaseLocalStorageDb'); echo 'OPENED';`, empty);
  const pr = await php.run(phpProbe, empty);
  out.php = pr.ok ? { ok: true, stdout: pr.stdout } : pr;
  out.phpEval = await php.run(`
    try { echo json_encode(vrzno_eval("String(self.localStorage)")); } catch (Throwable $e) { echo 'threw'; }`, empty);

  // --- the frames themselves
  await sb.warm('php'); // the bridge probes above recycled it
  const jf = sb.inspect('js').frame, pf = sb.inspect('php').frame;
  out.frames = {
    sandboxAttr: [jf.getAttribute('sandbox'), pf.getAttribute('sandbox')],
    contentDoc: [jf.contentDocument === null, pf.contentDocument === null],
    lsThrows: (() => { try { void jf.contentWindow.localStorage; return false; } catch { return true; } })(),
    noAllowSame: !/allow-same-origin|allow-top-navigation/.test(jf.getAttribute('sandbox') + pf.getAttribute('sandbox')),
  };
  out.lsStillThere = localStorage.getItem('firebase:authUser:FAKE:[DEFAULT]') !== null;

  // --- spoofing: a sibling frame pretends to be the host, and tries to initialise a host as if it were the parent
  const fresh = createSandbox();
  const spoofer = document.createElement('iframe');
  spoofer.setAttribute('sandbox', 'allow-scripts');
  spoofer.srcdoc = `<script>
    const msg = { type: 'grimoire-host-loaded' };
    const initMsg = { type: 'grimoire-init', token: 'evil' };
    let n = 0;
    const id = setInterval(() => {
      parent.postMessage(msg, '*');
      for (let i = 0; i < parent.frames.length; i++) { try { parent.frames[i].postMessage(initMsg, '*'); } catch (e) {} }
      if (++n > 200) clearInterval(id);
    }, 10);
  <\/script>`;
  document.body.appendChild(spoofer);
  await fresh.warm('js');
  out.spoofRun = await fresh.run('js', 'return 41 + 1;', { world: {}, timeoutMs: 2000 });
  await new Promise((r) => setTimeout(r, 400));
  out.spoofIgnored = fresh.inspect('js').ignored();
  // wrong token on the real port: no answer. A right token with a bad kind: refused.
  const ins = fresh.inspect('js');
  let answered = false;
  ins.pending.set(777, () => { answered = true; });
  ins.send({ token: 'wrong', id: 777, kind: 'run', lang: 'js', code: 'return 1', world: {}, timeoutMs: 500 });
  await new Promise((r) => setTimeout(r, 600));
  out.wrongTokenAnswered = answered;
  let refused = null;
  ins.pending.set(778, (m) => { refused = m; });
  ins.send({ token: ins.tok, id: 778, kind: 'evil', lang: 'js', code: 'return 1', timeoutMs: 500 });
  await new Promise((r) => setTimeout(r, 400));
  out.badKind = !!refused && refused.ok === false;
  // oversize: through the client, and straight at the host with a valid token
  out.oversizeClient = await fresh.run('js', 'x'.repeat(5 * 1024 * 1024), { world: {} });
  let big = null;
  ins.pending.set(779, (m) => { big = m; });
  ins.send({ token: ins.tok, id: 779, kind: 'run', lang: 'js', code: 'x'.repeat(5 * 1024 * 1024), world: {}, timeoutMs: 500 });
  await new Promise((r) => setTimeout(r, 800));
  out.oversizeHost = !!big && big.ok === false;
  out.oversizeResponse = await fresh.run('js', 'return "y".repeat(10 * 1024 * 1024);', { world: {}, timeoutMs: 3000 });
  fresh.destroy('js'); spoofer.remove();

  // --- kill switch: JS
  resetWorst();
  t0 = performance.now();
  out.jsLoop = await runJs('while (true) {}', empty, { timeoutMs: 1000 });
  out.jsLoopMs = Math.round(performance.now() - t0);
  t0 = performance.now();
  out.jsAfter = await runJs('return 5;', {});
  out.jsAfterMs = Math.round(performance.now() - t0);
  out.jsHeartbeat = Math.round(worst);

  // --- kill switch: PHP, inside php-wasm
  resetWorst();
  t0 = performance.now();
  out.phpLoop = await sb.run('php', '<?php while (true) {}', { timeoutMs: 3000 });
  out.phpLoopMs = Math.round(performance.now() - t0);
  t0 = performance.now();
  out.phpAfter = await php.run('echo 6;', empty);
  out.phpAfterMs = Math.round(performance.now() - t0); // includes re-warming a fresh iframe
  t0 = performance.now();
  await php.run('echo 7;', empty);
  out.phpWarmMs = Math.round(performance.now() - t0);
  t0 = performance.now(); await runJs('return 1;', {}); out.jsWarmMs = Math.round(performance.now() - t0);
  out.phpHeartbeat = Math.round(worst);

  // --- memory bombs
  resetWorst();
  out.jsBomb = await runJs('const a = []; while (true) a.push(new Array(1e6).fill(7));', {}, { timeoutMs: 2000 });
  out.jsBuf = await runJs('return new ArrayBuffer(2 ** 40).byteLength;', {});
  out.jsAfterBomb = await runJs('return 8;', {});
  out.phpBomb = await php.run('$s = "x"; while (true) { $s .= $s; }', empty);
  out.phpAfterBomb = await php.run('echo 9;', empty);
  out.bombHeartbeat = Math.round(worst);

  beatOn = false;
  return out;
});

const j = JSON.stringify;
t.note('cold start (iframe + runtime)', `JS ${r.jsColdMs} ms, PHP ${r.phpColdMs} ms`);
t.note('warm run', `JS ${r.jsWarmMs} ms, PHP ${r.phpWarmMs} ms`);
t.note('after a kill', `JS loop stopped at ${r.jsLoopMs} ms, next JS run ${r.jsAfterMs} ms; PHP loop stopped at ${r.phpLoopMs} ms, next PHP run ${r.phpAfterMs} ms`);
t.note('PHP probe', j(r.php));

const js = r.js.result || {};
t.check('the JS probe ran', r.js.ok === true, j(r.js));
t.check('learner JS has the opaque origin "null"', js.origin === 'null', js.origin);
t.check('learner JS has no localStorage, sessionStorage or document.cookie', js.localStorage === 'undefined' && js.sessionStorage === 'undefined' && js.cookie === 'undefined', j(js));
t.check('learner JS cannot reach parent, top, window or document', js.parent === 'undefined' && js.top === 'undefined' && js.window === 'undefined' && js.document === 'undefined', j(js));
t.check('learner JS cannot read the Firebase login in IndexedDB', /ERR|"fresh":true/.test(js.idb) && !/firebaseLocalStorage/.test(js.idb) && !/SECRET/.test(j(r.js)), js.idb);
t.check('learner JS cannot fetch (CSP), not even the game origin', /^ERR/.test(js.fetchSame) && /^ERR/.test(js.fetchOther), j([js.fetchSame, js.fetchOther]));
t.check('learner JS cannot use XMLHttpRequest', /^ERR/.test(js.xhr), js.xhr);
t.check('learner JS cannot open a WebSocket', /^ERR/.test(js.ws), js.ws);
t.check('learner JS cannot importScripts or import() the game', /^ERR/.test(js.importScripts) && /^ERR/.test(js.dynamicImport), j([js.importScripts, js.dynamicImport]));
t.check('the frames are sandboxed without allow-same-origin or top navigation', r.frames.noAllowSame && r.frames.sandboxAttr.every((x) => x === 'allow-scripts'), j(r.frames));
t.check('the page cannot read into the frames', r.frames.contentDoc.every(Boolean) && r.frames.lsThrows, j(r.frames));
t.check('the fake login is still in the page (the test seeded it)', r.lsStillThere);

let ph = null; try { ph = JSON.parse(r.php.stdout); } catch { /* reported below */ }
t.check('the PHP probe ran', r.php.ok === true && ph !== null, j(r.php));
t.check('PHP: the VRZNO bridge sees only a bare worker (no storage, no parent or top, origin null)',
  ph && Object.entries(ph.seen).every(([k, v]) => k === 'origin' ? v === 'null' : v === 'absent'), r.php.stdout);
t.check('PHP: IndexedDB through the bridge is denied (opaque origin)', r.phpIdb.ok === false && /denied|Security/i.test(r.phpIdb.error) && !/OPENED/.test(r.phpIdb.stdout), j(r.phpIdb));
t.check('PHP: vrzno_eval is blocked by the CSP (no string evaluation)', !/SECRET|undefined/.test(r.phpEval.stdout || '') && !(r.phpEval.ok && r.phpEval.stdout !== '"undefined"' && r.phpEval.stdout !== 'threw'), j(r.phpEval));

t.check('a sibling frame spoofing the handshake is ignored and the sandbox still works', r.spoofRun.ok === true && r.spoofRun.result === 42 && r.spoofIgnored > 0, j([r.spoofRun, r.spoofIgnored]));
t.check('a request with the wrong token is never answered', r.wrongTokenAnswered === false);
t.check('an unknown kind is refused', r.badKind === true);
t.check('an oversize request is rejected by the client', r.oversizeClient.ok === false && /too large/.test(r.oversizeClient.error), j(r.oversizeClient));
t.check('an oversize request is rejected by the host too', r.oversizeHost === true);
t.check('an oversize response is refused', r.oversizeResponse.ok === false, j(r.oversizeResponse).slice(0, 200));

t.check('a JS infinite loop is killed with timedOut', r.jsLoop.ok === false && r.jsLoop.timedOut === true && r.jsLoopMs < 2500, j([r.jsLoop, r.jsLoopMs]));
t.check('the next JS run succeeds', r.jsAfter.ok === true && r.jsAfter.result === 5, j(r.jsAfter));
t.check('the page stayed responsive during the JS loop', r.jsHeartbeat < 300, r.jsHeartbeat + ' ms');
t.check('a PHP infinite loop is killed with timedOut', r.phpLoop.ok === false && r.phpLoop.timedOut === true && r.phpLoopMs < 4500, j([r.phpLoop, r.phpLoopMs]));
t.check('the next PHP run succeeds', r.phpAfter.ok === true && r.phpAfter.stdout.trim() === '6', j(r.phpAfter));
t.check('the page stayed responsive during the PHP loop and re-warm', r.phpHeartbeat < 400, r.phpHeartbeat + ' ms');
t.check('a JS memory bomb fails without freezing the page', r.jsBomb.ok === false && r.jsBuf.ok === false && r.jsAfterBomb.result === 8, j([r.jsBomb, r.jsBuf, r.jsAfterBomb]).slice(0, 300));
t.check('a PHP memory bomb fails and the next PHP run succeeds', r.phpBomb.ok === false && r.phpAfterBomb.ok === true && r.phpAfterBomb.stdout.trim() === '9', j([r.phpBomb, r.phpAfterBomb]).slice(0, 300));
t.check('the page stayed responsive through the memory bombs', r.bombHeartbeat < 600, r.bombHeartbeat + ' ms');
// Worker errors from the deliberate attacks above surface as page errors; only unexpected ones count.
const unexpected = errors.filter((e) => !/Refused to evaluate|access to the Indexed Database API is denied|ExitStatus/.test(e));
t.check('no unexpected page errors', unexpected.length === 0, unexpected.join(' | '));
await close();
t.finish();
