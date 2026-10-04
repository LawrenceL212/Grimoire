/* The page's side of the sandbox. Learner JavaScript and PHP run in hidden <iframe sandbox="allow-scripts"> pages
   (no allow-same-origin: opaque origin, so no access to this page's storage, IndexedDB, cookies, DOM or Firebase
   session). One iframe per language, kept warm between runs.

   KILL SWITCH: the parent owns a hard timer per run. When it fires the iframe is destroyed (which stops any loop,
   including one inside php-wasm) and a fresh one is started in the background, so the page never freezes and the
   next run works.

   run(lang, code, { world, timeoutMs, kind = 'run' }) -> { ok, result?, world?, logs?, stdout?, stderr?, error?, timedOut? }
   Never throws. See host.js for the wire format. */
export const LIMITS = Object.freeze({
  maxRequestBytes: 4 * 1024 * 1024,
  readyTimeoutMs: 90000, // iframe load plus runtime warm-up (PHP: 1-4 s typical, longer on a cold CDN)
  jsGraceMs: 1500,       // the JS host stops its own worker at timeoutMs; the parent backstop fires after this
});
const PAGES = { js: 'host-js.html', php: 'host.html' };
const token = () => [...crypto.getRandomValues(new Uint8Array(16))].map((x) => x.toString(16).padStart(2, '0')).join('');

export function createSandbox({ doc = document, base = import.meta.url } = {}) {
  const slots = {};
  let seq = 0;

  function destroy(lang) {
    const s = slots[lang];
    if (!s) return;
    delete slots[lang];
    s.dead = true;
    try { s.port?.close(); } catch { /* already closed */ }
    s.frame.remove();
    removeEventListener('message', s.onWindowMessage);
    s.settle?.(new Error('The sandbox was reset.'));
  }

  function ensure(lang) {
    if (slots[lang]) return slots[lang];
    const tok = token();
    const frame = doc.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts'); // deliberately NOT allow-same-origin
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none';
    const s = { frame, tok, port: null, pending: new Map(), t0: performance.now(), loadedMs: null };
    s.warm = new Promise((resolve, reject) => {
      let timer = setTimeout(() => reject(new Error('The sandbox did not start.')), LIMITS.readyTimeoutMs);
      s.settle = (err) => { clearTimeout(timer); reject(err); };
      s.onWindowMessage = (e) => {
        // Only our own iframe may start the handshake, and only once.
        if (e.source !== frame.contentWindow || e.data?.type !== 'grimoire-host-loaded' || s.port) return;
        const ch = new MessageChannel();
        s.port = ch.port1;
        ch.port1.onmessage = (m) => {
          const d = m.data;
          if (!d || d.token !== tok) return; // wrong token: ignore
          if (d.type === 'warm') { s.loadedMs = Math.round(performance.now() - s.t0); clearTimeout(timer); resolve(); }
          else if (d.type === 'warm-failed') { clearTimeout(timer); reject(new Error(d.error || 'The sandbox could not start.')); }
          else if (typeof d.id === 'number') { s.pending.get(d.id)?.(d); s.pending.delete(d.id); }
        };
        frame.contentWindow.postMessage({ type: 'grimoire-init', token: tok }, '*', [ch.port2]);
      };
    });
    s.warm.catch(() => {});
    addEventListener('message', s.onWindowMessage);
    frame.src = new URL(PAGES[lang], base).href;
    doc.body.appendChild(frame);
    slots[lang] = s;
    return s;
  }

  /* One run at a time per language: the runtimes are single-flight. */
  const queues = {};
  function run(lang, code, { world, timeoutMs, kind = 'run' } = {}) {
    const next = (queues[lang] ?? Promise.resolve()).then(() => runOnce(lang, code, world, timeoutMs, kind));
    queues[lang] = next.catch(() => {});
    return next;
  }

  async function runOnce(lang, code, world, timeoutMs, kind) {
    if (!PAGES[lang]) return { ok: false, error: `There is no sandbox for ${lang}.` };
    timeoutMs ??= lang === 'php' ? 8000 : 2000;
    let size;
    try { size = (typeof code === 'string' ? code.length : Infinity) + (world === undefined ? 0 : JSON.stringify(world).length); }
    catch { size = Infinity; }
    if (!(size <= LIMITS.maxRequestBytes)) return { ok: false, error: 'That request is too large to run.' };

    const s = ensure(lang);
    try { await s.warm; } catch (e) {
      destroy(lang);
      return { ok: false, error: String(e?.message ?? e) };
    }
    if (s.dead) return { ok: false, error: 'The sandbox was reset.' };

    const id = ++seq;
    const hardMs = lang === 'js' ? timeoutMs + LIMITS.jsGraceMs : timeoutMs;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        s.pending.delete(id);
        destroy(lang);
        setTimeout(() => ensure(lang), 0); // a fresh, warming sandbox for the next run
        resolve({ ok: false, error: `Timed out after ${timeoutMs} ms. Does a loop never finish?`, timedOut: true });
      }, hardMs);
      s.pending.set(id, ({ token: _t, id: _i, ...res }) => { clearTimeout(timer); resolve(res); });
      try { s.port.postMessage({ token: s.tok, id, kind, lang, code, world, timeoutMs }); }
      catch {
        clearTimeout(timer); s.pending.delete(id);
        resolve({ ok: false, error: 'The request could not be sent to the sandbox.' });
      }
    });
  }

  return {
    run,
    /** Start the sandbox for `lang` ahead of the first run; resolves when its runtime is warm. */
    warm: (lang) => { const s = ensure(lang); return s.warm.then(() => ({ ms: s.loadedMs })); },
    destroy,
    /** For tests only. */
    inspect: (lang) => slots[lang] && ({ frame: slots[lang].frame, tok: slots[lang].tok, send: (m) => slots[lang].port.postMessage(m) }),
  };
}

let shared = null;
export const getSandbox = () => (shared ??= createSandbox());
