/* Learner JavaScript runs in a Web Worker with a hard timeout, so an infinite
   loop costs the learner a message, not the page. The worker gets a copy of the
   world objects; whatever it leaves in `world` is what the caller writes back. */
const WORKER_SRC = `
self.onmessage = async (e) => {
  const { code, world } = e.data;
  const logs = [];
  const console = { log: (...a) => logs.push(a.map(String).join(' ')) };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const fn = new AsyncFunction('world', 'console', code);
    const result = await fn(world, console);
    self.postMessage({ ok: true, result, world, logs });
  } catch (err) {
    self.postMessage({ ok: false, error: String((err && err.message) || err), logs });
  }
};`;

export function runJs(code, world, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    const worker = new Worker(url);
    let timer;
    const done = (value) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    timer = setTimeout(
      () => done({ ok: false, error: `Timed out after ${timeoutMs} ms. Does a loop never finish?`, timedOut: true }),
      timeoutMs);
    worker.onmessage = (e) => done(e.data);
    worker.onerror = (e) => done({ ok: false, error: e.message || 'The script failed to run.' });
    worker.postMessage({ code, world });
  });
}
