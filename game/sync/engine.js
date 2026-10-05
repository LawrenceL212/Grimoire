// engine.js: the offline-first sync engine. LOCAL IS PRIMARY: the game reads and writes its own save and works with no
// backend and no network. Sync only ever MERGES (merge.js), so there is no conflict to resolve and local progress is
// never lowered.
//
//   createSync({ backend, readLocal, writeLocal, now, debounceMs = 5000, retryMinMs = 1000, retryMaxMs = 60000, ... })
//     backend      { pull() -> doc | null | { doc, version }, push(doc, { expectVersion }?) -> Promise }
//                  (null / absent: the game just plays; status 'idle'). Versions are optional: when pull() returns
//                  { doc, version }, push gets { expectVersion: version } and may reject with err.conflict = true
//                  (someone wrote in between): the engine then pulls again, merges again and retries, up to MAX_CONFLICTS
//                  times in one cycle. A backend that returns a plain doc and ignores the second argument works as before.
//     readLocal()  -> { life, spells } | null            writeLocal({ life, spells }, { slot }?)      (see local.js; slot
//                  'aside' when this device's company database was set aside by a diverging one, otherwise none)
//   returns { start(), notifyChange(), flush(), syncNow(), onStatus(fn), onNotice(fn), notices(), status(), hasBackend, stop() }
//   writeLocal may return false (the local write failed): the cycle then ends in 'error', never 'synced'.
//   writeLocal may return 'held' (the page that owns the save is open and would overwrite it: session.js): the local write is
//   skipped on purpose, the merge is still PUSHED, the cycle ends 'synced' with detail 'held' and nothing is retried.
//   onNotice(fn): fn(string) for things worth telling the player, from the merge (a purchase set aside...) and the gate.
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
import { mergeDetailed } from './merge.js';

// two documents are the same save when their content is: updatedAt is only a stamp
const same = (a, b) => canon(a?.siso) === canon(b?.siso);

export const MAX_CONFLICTS = 5;

// a backend that lives in memory: for tests, and for simulating two devices on one cloud. With versions (the default),
// pull() returns { doc, version } and push(doc, { expectVersion }) rejects with err.conflict when the cloud moved on.
export function memoryBackend({ doc = null, versions = true } = {}) {
  let stored = doc == null ? null : structuredClone(doc), online = true, failures = 0, version = doc == null ? 0 : 1;
  const gate = () => { if (!online) throw new Error('offline'); if (failures > 0) { failures--; throw new Error('backend failure'); } };
  return {
    async pull() { gate(); const d = stored == null ? null : structuredClone(stored); return versions ? { doc: d, version } : d; },
    async push(d, { expectVersion } = {}) {
      gate();
      if (versions && expectVersion !== undefined && expectVersion !== version) { const e = new Error('the cloud save changed'); e.conflict = true; throw e; }
      stored = structuredClone(d); version++; this.pushes++;
    },
    pushes: 0,
    get doc() { return stored == null ? null : structuredClone(stored); },
    get version() { return version; },
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
  const listeners = new Set(), noticeListeners = new Set();
  let lastNotices = [];
  let debounceT = null, retryT = null, retries = 0, inflight = null, again = false, started = false;
  const off = [];

  function setStatus(s, d = '') {
    if (s === status && d === detail) return;
    status = s; detail = d;
    for (const fn of [...listeners]) { try { fn(status, detail); } catch { /* a listener must not break the sync */ } }
  }

  function tell(list) {
    for (const n of list) { if (!lastNotices.includes(n)) lastNotices.push(n); for (const fn of [...noticeListeners]) { try { fn(n); } catch { /* ignore */ } } }
  }

  // one attempt: pull, merge with what is local right now, write local, push. A version conflict repeats it.
  async function attempt() {
    const pulled = await backend.pull();
    const versioned = pulled && typeof pulled === 'object' && 'doc' in pulled && !('schema' in pulled);
    const remoteRaw = versioned ? pulled.doc : pulled, version = versioned ? pulled.version : undefined;
    let remote = null;
    if (remoteRaw != null) {
      const r = checkDoc(remoteRaw, { now: now() });
      if (!r.ok) throw new Error(`the cloud save was not accepted: ${r.error}`);
      remote = r.doc;
    }
    // local is read AFTER the pull and written in the same breath: nothing can change it in between
    const state = readLocal();
    const local = state ? toDoc(state, { now: now() }) : null;
    const m = mergeDetailed(local, remote, { now: now() });
    const merged = m.doc;
    let held = false;
    if (merged) {
      if (!local || !same(merged, local)) {
        const back = fromDoc(merged, { now: now() });
        // when this device's company database lost to a diverging one (merge.js mergeArc), its game goes to the ASIDE slot
        const w = back.ok ? (m.aside === 'a' ? writeLocal(back.state, { slot: 'aside' }) : writeLocal(back.state)) : false;
        if (w === 'held') held = true;
        else if (w === false) throw new Error('the merged save could not be stored on this device');
      }
      if (!remote || !same(merged, remote)) await (version === undefined ? backend.push(merged) : backend.push(merged, { expectVersion: version }));
    }
    tell(m.notices);
    return held;
  }
  async function once() {
    if (!isOnline()) { setStatus('offline'); return { ok: false, offline: true }; }
    setStatus('syncing');
    try {
      let held = false;
      for (let n = 0; ; n++) {
        try { held = await attempt(); break; } catch (e) { if (!(e && e.conflict) || n >= MAX_CONFLICTS) throw e; }
      }
      retries = 0;
      if (retryT) { clearTimer(retryT); retryT = null; }
      setStatus('synced', held ? 'held' : '');
      return { ok: true, held };
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
  function onNotice(fn) { noticeListeners.add(fn); return () => noticeListeners.delete(fn); }
  return { start, stop, notifyChange, flush, syncNow, onStatus, onNotice, notices: () => [...lastNotices], status: () => status, hasBackend };
}
