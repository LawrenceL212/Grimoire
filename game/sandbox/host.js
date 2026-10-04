/* Runs INSIDE the sandboxed iframe (opaque origin: no parent storage, cookies, IndexedDB or Firebase session).
   Classic script on purpose: a module script would need CORS headers from the server, which an opaque origin
   cannot assume. Learner code never runs on this page; it runs in a blob Worker created here.

   Protocol (see client.js): the page tells its parent it loaded; the parent answers once with
   { type: 'grimoire-init', token } and a MessagePort. Only that port is ever answered. Requests:
     { token, id, kind: 'run', lang: 'js' | 'php', code, world?, timeoutMs }
   Responses: { token, id, ok, result?, world?, logs?, stdout?, stderr?, error?, timedOut? }.
   `kind` is the extension point: a later kind (for example 'site') adds an entry to KINDS. */
(() => {
  const KIND = document.currentScript.dataset.kind; // which runtime this page offers: 'js' or 'php'
  const MAX_REQUEST = 4 * 1024 * 1024;
  const MAX_RESPONSE = 8 * 1024 * 1024;
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const PHP_WASM = CDN + 'php-wasm@0.1.0/PhpWeb.mjs';
  const PHP_BASE = CDN + 'php-wasm@0.1.0/PhpBase.mjs';
  const SQLITE = CDN + 'php-wasm-sqlite@0.1.0/index.mjs';

  const JS_WORKER = `
self.onmessage = async (e) => {
  const { code, world } = e.data;
  const logs = [];
  let bytes = 0, truncated = false;
  const console = { log: (...a) => {
    if (truncated) return;
    const line = a.map(String).join(' ');
    if (bytes + line.length > 1000000) { truncated = true; logs.push('[output truncated]'); return; }
    bytes += line.length; logs.push(line);
  } };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('world', 'console', code);
    const result = await fn(world, console);
    self.postMessage({ ok: true, result, world, logs });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err), logs });
  }
};`;

  /* php-wasm 0.1.0 has no worker build, so PhpWeb runs in a blob worker (with a stub document, see below). It is a CLASSIC worker that import()s the
     CDN modules: an opaque origin cannot start a module worker at all. PhpWeb.refresh() would take
     navigator.locks and sync IndexedDB, neither of which an opaque origin has, so the reset calls PhpBase's own
     refresh (pib_refresh: shut PHP down and start it again inside the same module). */
  const PHP_WORKER = `
/* The php8.4-web build touches document and window while it initialises. A worker has neither, so give it empty
   stand-ins; they are plain objects in an isolated worker and reach nothing. */
self.window = self;
self.document = { currentScript: null, body: {}, documentElement: { style: {} }, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, getElementById() { return null; }, createElement() { return { style: {}, getContext() { return null; } }; }, visibilityState: 'visible', hidden: false };
/* navigator.locks does not exist for an opaque origin. PhpWeb queues every call through it; this worker runs one
   call at a time already, so a lock that just runs the callback is equivalent. */
if (!self.navigator.locks) Object.defineProperty(self.navigator, 'locks', { value: { request: (_n, cb) => Promise.resolve().then(() => cb()) } });
let PhpWeb, PhpBase, sqlite;
const post = self.postMessage.bind(self); // the learner can reach self through the bridge; keep our own handles
const MAX_OUT = 3000000;
let out = '', err = '', truncated = false, php = null, pristine = Promise.resolve();
const add = (cur, parts) => { const x = cur + parts.join(''); if (x.length > MAX_OUT) { truncated = true; return x.slice(0, MAX_OUT); } return x; };
async function start() {
  const p = new PhpWeb({ version: '8.4', sharedLibs: [sqlite] });
  p.addEventListener('output', (e) => { out = add(out, e.detail || []); });
  p.addEventListener('error', (e) => { err = add(err, e.detail || []); });
  await new Promise((resolve, reject) => { p.addEventListener('ready', resolve); setTimeout(() => reject(new Error('PHP runtime never became ready')), 60000); });
  return p;
}
const replace = () => start().then((p) => { php = p; });
self.addEventListener('message', async (e) => {
  const { id, code } = e.data;
  try { await pristine; } catch { pristine = replace(); try { await pristine; } catch (x) { post({ id, ok: false, error: 'PHP runtime failed: ' + x }); return; } }
  out = ''; err = ''; truncated = false;
  try { await php.run(code); } catch (x) { err += String((x && x.message) || x); }
  const stdout = out, stderr = err, cut = truncated;
  // An aborted runtime (out of memory, wasm trap) cannot be refreshed or rebuilt in this worker: say so, and the
  // parent replaces the whole sandbox.
  const fatal = /Out of memory|Aborted[(]|RuntimeError|Program terminated with exit[(]1[)]/.test(stderr); // the runtime's own channel only, never printed text
  if (!fatal) pristine = PhpBase.prototype.refresh.call(php).catch(replace);
  post({ id, ok: true, stdout, stderr, fatal, truncated: cut });
});
(async () => {
  try {
    ({ PhpWeb } = await import('${PHP_WASM}'));
    ({ PhpBase } = await import('${PHP_BASE}'));
    ({ default: sqlite } = await import('${SQLITE}'));
    php = await start();
    post({ warm: true });
  } catch (e) { post({ warm: false, error: String((e && e.message) || e) }); }
})();`;

  const blobUrl = (src) => URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));

  /* Copy of sanitizeWorld in game/world/views.js (a classic script cannot import it). Keep the two in step. */
  const TABLE_COLS = { rooms: ['id', 'name', 'capacity'], people: ['id', 'name', 'role'], bookings: ['id', 'room_id', 'person_id', 'start_at', 'end_at'] };
  function cleanWorld(objects) {
    if (objects === null || typeof objects !== 'object' || Array.isArray(objects)) return { error: 'Your code must leave `world` as an object of tables.' };
    const world = {};
    for (const t of Object.keys(TABLE_COLS)) {
      const rows = objects[t];
      if (rows === undefined) continue;
      if (!Array.isArray(rows)) return { error: `world.${t} must be a list of rows.` };
      if (rows.length > 5000) return { error: 'Your code returned too many rows (limit 5,000 per table).' };
      const clean = [];
      for (const row of rows) {
        if (row === null || typeof row !== 'object' || Array.isArray(row)) return { error: `Every row in world.${t} must be an object.` };
        let keys = 0;
        for (const _k in row) if (++keys > 50) return { error: `A row in world.${t} has too many fields.` };
        const o = {};
        for (const c of TABLE_COLS[t]) {
          const v = Object.hasOwn(row, c) ? row[c] : undefined;
          if (v === undefined || v === null) continue;
          if (typeof v === 'string') { if (v.length > 500) return { error: `A text value in world.${t} is longer than 500 characters.` }; }
          else if (typeof v === 'number') { if (!Number.isFinite(v)) return { error: `A number in world.${t} is not finite.` }; }
          else return { error: `A value in world.${t}.${c} is not text or a number.` };
          o[c] = v;
        }
        clean.push(o);
      }
      world[t] = clean;
    }
    return { world };
  }

  /* Whatever a worker posts is untrusted (the learner can call postMessage too). Only own, well-typed fields of an
     object with a boolean `ok` get through; anything else is an error. */
  const own = (m, k) => Object.hasOwn(m, k) ? m[k] : undefined;
  function vetReply(m) {
    if (typeof m !== 'object' || m === null || typeof own(m, 'ok') !== 'boolean') return { ok: false, error: 'The script did not finish normally.' };
    const res = { ok: own(m, 'ok') };
    const err = own(m, 'error'); if (typeof err === 'string') res.error = err.slice(0, 2000);
    const logs = own(m, 'logs');
    if (Array.isArray(logs)) { let n = 0; res.logs = []; for (const l of logs) { if (typeof l !== 'string') continue; n += l.length; if (n > 1100000) break; res.logs.push(l); } }
    if (own(m, 'timedOut') === true) res.timedOut = true;
    if (res.ok) {
      if (own(m, 'result') !== undefined) res.result = own(m, 'result');
      if (own(m, 'world') !== undefined) {
        const w = cleanWorld(own(m, 'world'));
        if (w.error) return { ok: false, error: w.error, logs: res.logs };
        res.world = w.world;
      }
    }
    return res;
  }

  const KINDS = {
    run: {
      js: () => ({
        warm: () => Promise.resolve(),
        run(req) {
          return new Promise((resolve) => {
            const url = blobUrl(JS_WORKER);
            const w = new Worker(url);
            let timer;
            const done = (v) => { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); resolve(v); };
            timer = setTimeout(() => done({ ok: false, error: `Timed out after ${req.timeoutMs} ms. Does a loop never finish?`, timedOut: true }), req.timeoutMs);
            w.onmessage = (e) => done(vetReply(e.data));
            w.onerror = (e) => done({ ok: false, error: e.message || 'The script failed to run.' });
            w.onmessageerror = () => done({ ok: false, error: 'The result could not be copied out of the sandbox.' });
            try { w.postMessage({ code: req.code, world: req.world }); }
            catch { done({ ok: false, error: 'The world could not be given to the script.' }); }
          });
        },
      }),
      php: () => {
        const phpUrl = blobUrl(PHP_WORKER);
        const w = new Worker(phpUrl);
        let seq = 0;
        const waiting = new Map();
        let onWarm;
        const warm = new Promise((res, rej) => { onWarm = { res, rej }; });
        warm.then(() => URL.revokeObjectURL(phpUrl), () => URL.revokeObjectURL(phpUrl));
        w.onmessage = (e) => {
          const m = e.data;
          if (typeof m !== 'object' || m === null) return; // not ours: ignore
          if (Object.hasOwn(m, 'warm')) return m.warm === true ? onWarm.res() : onWarm.rej(new Error(typeof m.error === 'string' ? m.error : 'PHP failed to start'));
          if (typeof m.id === 'number' && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
        };
        w.onerror = (e) => onWarm.rej(new Error(e.message || ('PHP worker failed ' + e.filename + ':' + e.lineno)));
        return {
          warm: () => warm,
          async run(req) {
            await warm;
            const id = ++seq;
            const m = await new Promise((r) => { waiting.set(id, r); w.postMessage({ id, code: req.code }); });
            if (typeof m.ok !== 'boolean' || m.ok === false) return { ok: false, error: typeof m.error === 'string' ? m.error.slice(0, 2000) : 'PHP did not finish' };
            if (m.truncated === true) return { ok: false, error: 'Your code printed too much output.', fatal: m.fatal === true };
            return { ok: true, stdout: String(m.stdout), stderr: String(m.stderr), fatal: m.fatal === true };
          },
        };
      },
    },
  };

  let engine = null;
  const getEngine = (lang) => (engine ??= KINDS.run[lang]());

  function start(port, token) {
    let queue = Promise.resolve();
    const send = (msg) => {
      try {
        if (JSON.stringify(msg).length > MAX_RESPONSE) throw new Error('too large');
        port.postMessage({ ...msg, token });
      } catch {
        try { port.postMessage({ token, id: msg.id, ok: false, error: 'The result was too large or could not be sent out of the sandbox.' }); } catch { /* nothing left to try */ }
      }
    };
    port.onmessage = (e) => {
      const req = e.data;
      if (!req || req.token !== token || typeof req.id !== 'number') return; // not for us
      const handler = KINDS[req.kind];
      if (!handler || req.lang !== KIND || typeof req.code !== 'string' || req.code.length > MAX_REQUEST) {
        return send({ id: req.id, ok: false, error: 'The sandbox refused that request.' });
      }
      queue = queue.then(async () => send({ ...(await getEngine(req.lang).run(req)), id: req.id })).catch((err) =>
        send({ id: req.id, ok: false, error: String((err && err.message) || err) }));
    };
    port.postMessage({ token, type: 'ready' });
    getEngine(KIND).warm().then(() => port.postMessage({ token, type: 'warm' }), (err) =>
      port.postMessage({ token, type: 'warm-failed', error: String((err && err.message) || err) }));
  }

  let initialised = false;
  addEventListener('message', (e) => {
    if (initialised || e.source !== parent || e.data?.type !== 'grimoire-init' || !e.ports[0] || typeof e.data.token !== 'string') return;
    initialised = true;
    start(e.ports[0], e.data.token);
  });
  parent.postMessage({ type: 'grimoire-host-loaded' }, '*');
})();
