// engine.js: the offline-first sync engine. LOCAL IS PRIMARY: the game reads and writes its own save and works with no
// backend and no network. Sync only ever MERGES (merge.js), so there is no conflict to resolve and local progress is
// never lowered.
//
//   createSync({ backend, readLocal, writeLocal, now, debounceMs = 5000, retryMinMs = 1000, retryMaxMs = 60000, ... })
//     backend      { pull() -> doc | null, push(doc) -> Promise }   (null / absent: the game just plays; status 'idle')
//     readLocal()  -> { life, spells } | null            writeLocal({ life, spells })      (see local.js)
//   returns { start(), notifyChange(), flush(), syncNow(), onStatus(fn), status(), hasBackend, stop() }
//
//   start()         run one cycle now and listen for pagehide / visibilitychange(hidden) (flush) and online / offline
//   notifyChange()  the save changed: push after a quiet debounceMs (5 s); a burst of changes is one push
//   flush()         push now (the page is going away)
//   one CYCLE       pull the remote, merge it with what is local RIGHT NOW (read after the pull, so progress made while
//                   waiting is never overwritten), write local only if the merge differs, push only if it differs from
//                   the remote. A failed cycle retries with backoff 1 s, 2 s, 4 s ... capped at 60 s; success resets it.
//   status          'idle' (no backend) | 'offline' | 'syncing' | 'synced' | 'error'; onStatus(fn) calls fn(status, detail)
//                   now and on every change and returns the unsubscribe function.
//   Fail soft: nothing here throws into the UI; every failure becomes a status and a retry.
import { checkDoc, toDoc, fromDoc, canon } from './doc.js';
import { mergeSaves } from './merge.js';

// two documents are the same save when their content is: updatedAt is only a stamp
const same = (a, b) => canon(a?.siso) === canon(b?.siso);

// a backend that lives in memory: for tests, and for simulating two devices on one cloud
export function memoryBackend({ doc = null } = {}) {
  let stored = doc == null ? null : structuredClone(doc), online = true, failures = 0;
  const gate = () => { if (!online) throw new Error('offline'); if (failures > 0) { failures--; throw new Error('backend failure'); } };
  return {
    async pull() { gate(); return stored == null ? null : structuredClone(stored); },
    async push(d) { gate(); stored = structuredClone(d); this.pushes++; },
    pushes: 0,
    get doc() { return stored == null ? null : structuredClone(stored); },
    setOnline(v) { online = !!v; },
    failNext(n = 1) { failures = n; },
  };
}

export function createSync({
  backend = null, readLocal, writeLocal, now = () => Date.now(),
  debounceMs = 5000, retryMinMs = 1000, retryMaxMs = 60000,
  setTimer = (f, ms) => setTimeout(f, ms), clearTimer = (t) => clearTimeout(t),
  isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false,
  listen = true,
} = {}) {
  const hasBackend = !!backend && typeof backend.pull === 'function' && typeof backend.push === 'function';
  let status = 'idle', detail = '';
  const listeners = new Set();
  let debounceT = null, retryT = null, retries = 0, inflight = null, again = false, started = false;
  const off = [];

  function setStatus(s, d = '') {
    if (s === status && d === detail) return;
    status = s; detail = d;
    for (const fn of [...listeners]) { try { fn(status, detail); } catch { /* a listener must not break the sync */ } }
  }

  async function once() {
    if (!isOnline()) { setStatus('offline'); return { ok: false, offline: true }; }
    setStatus('syncing');
    try {
      const remoteRaw = await backend.pull();
      let remote = null;
      if (remoteRaw != null) {
        const r = checkDoc(remoteRaw, { now: now() });
        if (!r.ok) throw new Error(`the cloud save was not accepted: ${r.error}`);
        remote = r.doc;
      }
      // local is read AFTER the pull and written in the same breath: nothing can change it in between
      const state = readLocal();
      const local = state ? toDoc(state, { now: now() }) : null;
      const merged = mergeSaves(local, remote, { now: now() });
      if (merged) {
        if (!local || !same(merged, local)) {
          const back = fromDoc(merged, { now: now() });
          if (back.ok) writeLocal(back.state);
        }
        if (!remote || !same(merged, remote)) await backend.push(merged);
      }
      retries = 0;
      if (retryT) { clearTimer(retryT); retryT = null; }
      setStatus('synced');
      return { ok: true };
    } catch (e) {
      setStatus(isOnline() ? 'error' : 'offline', String(e?.message || e));
      return { ok: false, error: String(e?.message || e) };
    }
  }

  function scheduleRetry() {
    if (retryT) clearTimer(retryT);
    const delay = Math.min(retryMaxMs, retryMinMs * 2 ** retries);
    retries++;
    retryT = setTimer(() => { retryT = null; syncNow(); }, delay);
  }

  // one cycle at a time; a request that arrives during one runs another straight after it
  function syncNow() {
    if (!hasBackend) return Promise.resolve({ ok: false, skipped: true });
    if (inflight) { again = true; return inflight; }
    inflight = (async () => {
      let res;
      try {
        do { again = false; res = await once(); if (!res.ok) scheduleRetry(); } while (again && res.ok);
      } catch (e) { res = { ok: false, error: String(e?.message || e) }; setStatus('error', res.error); scheduleRetry(); }
      inflight = null;
      return res;
    })();
    return inflight;
  }

  function notifyChange() {
    if (!hasBackend) return;
    if (debounceT) clearTimer(debounceT);
    debounceT = setTimer(() => { debounceT = null; syncNow(); }, debounceMs);
  }
  function flush() {
    if (debounceT) { clearTimer(debounceT); debounceT = null; }
    return syncNow();
  }

  function start() {
    if (started) return syncNow();
    started = true;
    if (!hasBackend) { setStatus('idle'); return Promise.resolve({ ok: false, skipped: true }); }
    if (listen && typeof globalThis.addEventListener === 'function') {
      const on = (target, ev, fn) => { try { target.addEventListener(ev, fn); off.push(() => target.removeEventListener(ev, fn)); } catch { /* no events here */ } };
      on(globalThis, 'pagehide', () => { flush(); });
      if (globalThis.document) on(globalThis.document, 'visibilitychange', () => { if (globalThis.document.visibilityState === 'hidden') flush(); });
      on(globalThis, 'online', () => { retries = 0; syncNow(); });
      on(globalThis, 'offline', () => setStatus('offline'));
    }
    return syncNow();
  }
  function stop() {
    for (const t of [debounceT, retryT]) if (t) clearTimer(t);
    debounceT = retryT = null;
    for (const f of off.splice(0)) f();
    started = false;
  }
  function onStatus(fn) {
    listeners.add(fn);
    try { fn(status, detail); } catch { /* ignore */ }
    return () => listeners.delete(fn);
  }
  return { start, stop, notifyChange, flush, syncNow, onStatus, status: () => status, hasBackend };
}
