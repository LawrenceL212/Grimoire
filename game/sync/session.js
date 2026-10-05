// session.js: the glue between the account (firebase.js), the sync engine (engine.js) and the game's local save.
// Shared by the title screen (sign in, sign out, Sync now) and the play page (pull before the life loads, push after).
//
//   createSession({ fb, storage, onToast, ... }) -> { connect(account, choice?), disconnect(), syncNow(), restoreBackup(),
//                                                   hasBackup(), hint(), engine(), account(), goLive(), notifyLocalChange() }
//   bootPlaySync({ timeoutMs = 3000 })   the play page: before the life is read, pull + merge (never block offline play)
//
// RULES: local is primary and a merge never lowers it. A save that belongs to another account (or a guest save meeting
// a cloud game) is never merged silently: connect() answers { needsChoice: true } and the player decides. Before any
// sync overwrites the local save, the pre-merge save is kept under BACKUP (one level of undo).
// lastUid (the account the local save last synced with) and the sign-in hint (a flag, not a token) are the only things
// stored here; Firebase keeps the session itself.
import { createSync } from './engine.js';
import { localAdapter } from './local.js';
import { exportSave } from './file.js';
import { restoreBackup as restoreLocalBackup, backupInfo, backupSlots } from './local.js';
import { fromDoc } from './doc.js';
import { createStatusChip } from './status.js';
import { LIFE_KEY } from '../play/progress.js';
import { hasSave, localStore } from '../title/saves.js';

export const KEYS = Object.freeze({ lastUid: 'grimoire.sync.lastUid.v1', hint: 'grimoire.sync.hint.v1', backup: 'grimoire.life.siso.v1.backup' }); // the backup key is kept by local.js
const RELOAD = 'A newer game from another device is ready: reload to use it';

export function toast(msg, doc = globalThis.document) {
  if (!doc?.body) return null;
  const el = doc.createElement('div');
  el.className = 'sync-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:99999;max-width:min(92vw,440px);padding:10px 14px;border-radius:12px;border:1px solid var(--gold,#d9a441);background:#1b1612;color:#efe6d2;font:14px/1.4 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;gap:12px;align-items:center';
  const t = doc.createElement('span'); t.textContent = msg;
  const b = doc.createElement('button'); b.type = 'button'; b.textContent = 'Dismiss'; b.setAttribute('aria-label', 'Dismiss this message');
  b.style.cssText = 'flex:none;min-height:32px;padding:4px 10px;border-radius:999px;border:1px solid #6b5a3a;background:transparent;color:inherit;font:inherit;cursor:pointer';
  b.onclick = () => el.remove();
  el.append(t, b); doc.body.appendChild(el);
  setTimeout(() => el.remove(), 15000);
  return el;
}

export function createSession({ fb, storage = localStore(), local = localAdapter(storage), onToast = toast, now = () => Date.now(), engineOptions = {} } = {}) {
  let eng = null, acct = null, live = false, toasted = false, cur = 'idle', curDetail = '', offStatus = null, held = false;
  // one status source for the chips, whichever engine is attached now (the chip may be mounted before there is one)
  const listeners = new Set();
  const source = {
    get hasBackend() { return !!eng; },
    onStatus(fn) { listeners.add(fn); try { fn(cur, curDetail); } catch { /* ignore */ } return () => listeners.delete(fn); },
  };
  const emit = (s, d) => { cur = s; curDetail = d || ''; for (const fn of [...listeners]) { try { fn(cur, curDetail); } catch { /* ignore */ } } };
  const get = (k) => { try { return storage ? storage.getItem(k) : null; } catch { return null; } };
  const set = (k, v) => { try { if (v == null) storage?.removeItem(k); else storage?.setItem(k, v); } catch { /* storage off */ } };

  // the engine writes local only through here (local.js keeps the pre-merge copy). Once the play page holds its life in
  // memory a write would be overwritten by its next save, so it is HELD: the merge is still pushed, the player is told
  // to reload, and the engine does not count it as a failure.
  const writeLocal = (state, opts) => {
    if (live) { if (!toasted) { toasted = true; onToast(RELOAD); } return 'held'; }
    return local.writeLocal(state, opts);
  };
  function attach(account) {
    if (eng) eng.stop();
    if (offStatus) offStatus();
    acct = account;
    set(KEYS.hint, '1');
    const backend = fb.firebaseBackend(account.uid);
    eng = createSync({ backend, readLocal: local.readLocal, writeLocal, now, ...engineOptions });
    held = false;
    offStatus = eng.onStatus((st, d) => {
      if (st === 'synced') set(KEYS.lastUid, account.uid);   // the save belongs to this account from its first success
      if (st === 'synced' && d === 'held') held = true;
      emit(st === 'synced' && held ? 'held' : st, d);
    });
    return eng;
  }
  const mountChip = (parent) => { const c = createStatusChip(source); parent.appendChild(c); return c; };
  async function start(account) {
    const e = attach(account);
    return e.start();
  }

  async function connect(account, choice) {
    if (!account || !account.uid) return { ok: false, error: 'Not signed in.' };
    const lastUid = get(KEYS.lastUid);
    let backupFile = null;
    const st = local.readLocal();
    if (lastUid !== account.uid && st && hasSave(storage)) {
      let remote;
      try { remote = await fb.firebaseBackend(account.uid).pull(); } catch (e) { return { ok: false, error: (e && e.message) || 'No connection', account }; }
      if (lastUid != null || remote != null) {
        if (choice !== 'aside' && choice !== 'merge') return { needsChoice: true, account, hasCloud: remote != null };
        if (choice === 'aside') {
          // setting the local game aside only makes sense when there is a cloud game to keep: never wipe for nothing
          if (remote == null) return { ok: false, error: 'This account has no cloud game yet, so there is nothing to keep. Upload your game instead.', account };
          const f = exportSave({ readLocal: local.readLocal });
          backupFile = f.ok ? f : null;
          const back = fromDoc(remote, { now: now() });
          if (!back.ok) return { ok: false, error: 'The cloud game could not be read. Nothing was changed.', account };
          if (local.writeLocal(back.state, { slot: 'manual' }) === false) return { ok: false, error: 'This device could not store the cloud game, so nothing was changed.', account };
          set(KEYS.lastUid, account.uid);
        }
      }
    }
    const res = await start(account);
    return { ok: true, account, backupFile, synced: !!(res && res.ok), held: !!(res && res.held), error: res && res.ok ? '' : ((res && res.error) || '') };
  }
  async function disconnect() {
    if (eng) eng.stop();
    if (offStatus) offStatus();
    offStatus = null; eng = null; acct = null; emit('idle');
    set(KEYS.hint, null);            // stop loading the SDK at startup; lastUid stays, so another account is noticed
    return fb.signOutNow();
  }
  const hasBackup = () => !!backupInfo(storage);
  // a set-aside game is in the MANUAL slot; the engine's merges use the AUTO slot (local.js)
  const restoreBackup = ({ slot } = {}) => restoreLocalBackup({ storage, now, slot: slot || (backupSlots(storage).manual ? 'manual' : 'auto') });
  return {
    connect, disconnect, restoreBackup, hasBackup,
    syncNow: () => (eng ? eng.syncNow() : Promise.resolve({ ok: false, skipped: true })),
    hint: () => get(KEYS.hint) === '1', lastUid: () => get(KEYS.lastUid),
    engine: () => eng, account: () => acct, source, mountChip,
    start, attach, goLive() { live = true; },
    notifyLocalChange() { if (eng) eng.notifyChange(); },
  };
}

// ---------------------------------------------------------------- the play page
// Called BEFORE the life is read. Returns when the first pull+merge has been applied, or after timeoutMs (play goes on
// and the sync carries on in the background; what it finds is applied on the NEXT load, with a toast).
export async function bootPlaySync({ timeoutMs = 3000, fb } = {}) {
  let s = null;
  try {
    const storage = localStore();
    if (!storage || storage.getItem(KEYS.hint) !== '1') return null;
    fb = fb || await import('./firebase.js');
    s = createSession({ fb, storage });
    globalThis.__sync = { notifyLocalChange: () => s.notifyLocalChange(), session: s, mountChip: (el) => s.mountChip(el), status: () => (s.engine() ? s.engine().status() : 'idle') };
    const work = (async () => {
      const account = await fb.getAccount();
      // only the account this save last synced with is synced here: anything else needs the title screen's choice
      if (!account || account.uid !== s.lastUid()) return;
      const e = s.attach(account);
      await e.start();
    })().catch(() => {});
    await Promise.race([work, new Promise((r) => setTimeout(r, timeoutMs))]);
    s.goLive();
  } catch { try { if (s) s.goLive(); } catch { /* ignore */ } }
  return s;
}
