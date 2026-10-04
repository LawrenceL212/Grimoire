// run.js: runs a reference entry's example for real, and only ever away from the learner's world.
//   SQL         a throwaway PGlite database of its own, wiped before every run (never play.world)
//   JavaScript  the game's sandboxed worker (runners/js.js), given no world
//   JS + DOM    a sandboxed iframe holding the entry's markup: scripts allowed, opaque origin, no network, no parent access
//   PHP         the game's sandboxed php-wasm (runners/php.js), given no world; PDO here is SQLite
//   HTML/CSS    drawn in a frame that runs no scripts
// Opening the library or running anything here touches no credit, help, progress or world: it is documentation.
//
//   runEntry(entry) -> { ok, text, error?, matches }      text is the output as shown; matches says it is what the entry documents
//   renderWeb(entry, host) -> iframe                       draws a web entry into host (the caller removes it)
//   checkWeb(doc, checks) -> [{ check, ok }]               the machine test of a web entry's claim
import { World } from '../world/world.js';
import { runSolution } from '../runners/index.js';
import { runJs } from '../runners/js.js';
import { getPhpRunner } from '../runners/index.js';
import { formatRows, matchesExpected, normalise } from './library.js';

const EMPTY_WORLD = { rooms: [], people: [], bookings: [] }; // the PHP runner's wrapper wants the three table names; nothing is in them

let scratch = null;
const scratchWorld = () => (scratch ??= World.create({}, { seed: '' }).catch((e) => { scratch = null; throw e; }));
let chain = Promise.resolve();
const queued = (fn) => (chain = chain.then(fn, fn)); // one run at a time: they share one scratch database

async function runSqlEntry(entry) {
  const w = await scratchWorld();
  await w.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  if (entry.setup) {
    const s = await runSolution(w, 'sql', entry.setup);
    if (!s.ok) return { ok: false, error: `The starting data failed: ${s.error}` };
  }
  const r = await runSolution(w, 'sql', entry.example);
  return r.ok ? { ok: true, text: formatRows(r.rows) } : { ok: false, error: r.error };
}

async function runJsEntry(entry) {
  const r = await runJs(entry.example, {});
  const text = (r.logs || []).join('\n');
  return r.ok ? { ok: true, text } : { ok: false, text, error: r.error };
}

async function runPhpEntry(entry) {
  const r = await (await getPhpRunner()).run(entry.example, EMPTY_WORLD);
  return r.ok ? { ok: true, text: r.stdout } : { ok: false, text: r.stdout || '', error: r.error };
}

const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'none'; connect-src 'none'; form-action 'none'";

function runDomEntry(entry) {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts allow-forms'); // (forms: so a submit event fires; the CSP forbids sending) an opaque origin: no cookies, no storage, no way into this page
    frame.hidden = true;
    const tag = `rf-${Math.random().toString(36).slice(2)}`;
    let done = false;
    const finish = (res) => { if (done) return; done = true; clearTimeout(timer); removeEventListener('message', onMsg); frame.remove(); resolve(res); };
    const onMsg = (e) => {
      if (e.source !== frame.contentWindow || !e.data || e.data.tag !== tag) return;
      const logs = Array.isArray(e.data.logs) ? e.data.logs.map(String) : [];
      finish(e.data.err ? { ok: false, text: logs.join('\n'), error: String(e.data.err) } : { ok: true, text: logs.join('\n') });
    };
    const timer = setTimeout(() => finish({ ok: false, error: 'Timed out.' }), 4000);
    addEventListener('message', onMsg);
    const script = `const __logs = []; let __err = '';
try { (function (console) {\n${entry.example}\n})({ log: (...a) => __logs.push(a.map(String).join(' ')) }); } catch (e) { __err = String((e && e.message) || e); }
parent.postMessage({ tag: ${JSON.stringify(tag)}, logs: __logs, err: __err }, '*');`;
    frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${CSP}"><body>${entry.dom}<script>${script.replace(/<\/script/gi, '<\\/script')}</script></body>`;
    document.body.appendChild(frame);
  });
}

export function renderWeb(entry, host) {
  const frame = document.createElement('iframe');
  frame.className = 'rf-frame';
  frame.title = 'What the example draws';
  frame.setAttribute('sandbox', 'allow-same-origin'); // no scripts: the frame can be read, never run
  frame.srcdoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'"><style>body{font:15px/1.5 system-ui,sans-serif;margin:12px;color:#1b1b1b;background:#fff}input,button{font:inherit;margin:2px}</style><body>${entry.example}</body>`;
  host.appendChild(frame);
  return new Promise((resolve) => { frame.addEventListener('load', () => resolve(frame), { once: true }); });
}

export function checkWeb(doc, checks) {
  return checks.map((c) => {
    const el = doc.querySelector(c.sel);
    let ok = !!el;
    if (ok && c.text !== undefined) ok = el.textContent.trim() === c.text;
    if (ok && c.css) { const cs = doc.defaultView.getComputedStyle(el); ok = Object.entries(c.css).every(([k, v]) => cs.getPropertyValue(k) === v); }
    return { check: c, ok };
  });
}

function judge(entry, res) {
  if (entry.expectError) return !res.ok && String(res.error || '').includes(entry.expectError);
  return !!res.ok && matchesExpected(entry, res.text);
}

export function runEntry(entry) {
  return queued(async () => {
    let res;
    try {
      if (entry.lang === 'sql') res = await runSqlEntry(entry);
      else if (entry.lang === 'js') res = entry.dom ? await runDomEntry(entry) : await runJsEntry(entry);
      else if (entry.lang === 'php') res = await runPhpEntry(entry);
      else return { ok: false, error: 'Web examples are drawn, not run: use renderWeb.', matches: false };
    } catch (e) {
      res = { ok: false, error: String((e && e.message) || e) };
    }
    return { ...res, text: normalise(res.text ?? ''), matches: judge(entry, res) };
  });
}
