// local.js: the game's own save, as the sync engine and the export file see it. A thin adapter over the one storage key
// the play page owns (game/play/progress.js LIFE_KEY; the spells live inside that record).
//
//   localAdapter(storage?, { now? }) -> { readLocal() -> { life, spells } | null, writeLocal({ life, spells }, { slot? }) -> boolean }
//   readLocal returns null when there is no readable save; it never throws. writeLocal never throws either.
//
//   BACKUPS: THREE slots, each ONE previous generation with its time.
//     MANUAL  'grimoire.life.siso.v1.backup' + 'grimoire.spells.v1.backup' + 'grimoire.life.siso.v1.backup.at'
//             written by what the player chose to do: an import (Merge or Replace), New game, Erase, setting a game aside.
//             The sync engine NEVER touches it, so a wrong Replace can still be undone after any number of syncs.
//     AUTO    'grimoire.life.siso.v1.autobackup' + 'grimoire.spells.v1.autobackup' + 'grimoire.life.siso.v1.autobackup.at'
//             written by every other content-changing writeLocal (the engine's merges): a safety net for the sync itself.
//     ASIDE   'grimoire.life.siso.v1.asidebackup' + ... '.asidebackup.at'
//             written only when a sync set THIS device's company database aside for a diverging one from another device
//             (merge.js mergeArc): later syncs do not overwrite it, so that world can still be restored.
//   Before writeLocal changes what is stored, the live raw strings are copied to the slot, also when the old save is
//   unreadable (a broken save is never overwritten without being kept). If the copy cannot be stored, the write does NOT
//   happen and returns false.
//   backupNow(storage, { slot = 'manual', now? }) -> boolean   copy the live life/spells raw strings into a slot now (for New
//       game and Erase, before they clear anything); false when there is nothing live or the copy failed
//   backupSlots(storage?) -> { manual: { at } | null, auto: { at } | null, aside: { at } | null }       backupInfo(storage?) -> manual's, else auto's, else null
//   restoreBackup({ storage?, slot = 'manual', now? }) -> { ok, error? }   puts that slot back live; what was live becomes that
//       slot's backup, so a restore can itself be undone.
// NOTE for the play page: it keeps its life in memory and saves it whole, so after a sync writes local while the page is
// open, the page must re-read (session.js pulls before the life loads).
import { LIFE_KEY } from '../play/progress.js';
import { localStore } from '../title/saves.js';
import { canon } from './doc.js';

export const SPELLS_KEY = 'grimoire.spells.v1';
export const SLOTS = Object.freeze({
  manual: Object.freeze({ life: `${LIFE_KEY}.backup`, spells: `${SPELLS_KEY}.backup`, at: `${LIFE_KEY}.backup.at` }),
  auto: Object.freeze({ life: `${LIFE_KEY}.autobackup`, spells: `${SPELLS_KEY}.autobackup`, at: `${LIFE_KEY}.autobackup.at` }),
  aside: Object.freeze({ life: `${LIFE_KEY}.asidebackup`, spells: `${SPELLS_KEY}.asidebackup`, at: `${LIFE_KEY}.asidebackup.at` }),
});
export const LIFE_BACKUP = SLOTS.manual.life, SPELLS_BACKUP = SLOTS.manual.spells, BACKUP_AT = SLOTS.manual.at;

const get = (S, k) => { try { return S.getItem(k); } catch { return null; } };
const parse = (raw) => { try { return JSON.parse(raw); } catch { return undefined; } };
const slotOf = (slot) => SLOTS[slot] || SLOTS.manual;

function slotInfo(S, slot) {
  const k = slotOf(slot);
  if (!S || get(S, k.life) == null) return null;
  const at = Number(get(S, k.at));
  return { at: Number.isFinite(at) && at > 0 ? at : null };
}
export const backupSlots = (storage = localStore()) => ({ manual: slotInfo(storage, 'manual'), auto: slotInfo(storage, 'auto'), aside: slotInfo(storage, 'aside') });
export const backupInfo = (storage = localStore()) => { const s = backupSlots(storage); return s.manual || s.auto; };

// copy the live raw strings into a slot (throws when the storage refuses: callers decide what that means)
function copyToSlot(S, slot, now) {
  const k = slotOf(slot), life = get(S, LIFE_KEY);
  if (life == null) return false;
  S.setItem(k.life, life);
  const sp = get(S, SPELLS_KEY);
  if (sp != null) S.setItem(k.spells, sp); else S.removeItem(k.spells);
  S.setItem(k.at, String(now()));
  return true;
}
export function backupNow(storage = localStore(), { slot = 'manual', now = () => Date.now() } = {}) {
  try { return !!storage && copyToSlot(storage, slot, now); } catch { return false; }
}

export function localAdapter(storage = localStore(), { now = () => Date.now() } = {}) {
  return {
    readLocal() {
      try {
        const life = JSON.parse(storage?.getItem(LIFE_KEY) || 'null');
        if (!life || typeof life !== 'object' || Array.isArray(life)) return null;
        return { life, spells: life.spells && typeof life.spells === 'object' ? life.spells : {} };
      } catch { return null; }
    },
    writeLocal(state, { slot = 'auto' } = {}) {
      try {
        const next = JSON.stringify({ ...state.life, spells: state.spells ?? state.life.spells ?? {} });
        const old = get(storage, LIFE_KEY);
        if (old != null && old !== next) {
          const o = parse(old);
          const same = o !== undefined && o && typeof o === 'object' && canon(o) === canon(JSON.parse(next));
          if (!same) copyToSlot(storage, slot, now);
        }
        storage.setItem(LIFE_KEY, next);
        return true;
      } catch { return false; }
    },
  };
}

export function restoreBackup({ storage = localStore(), slot = 'manual', now = () => Date.now() } = {}) {
  try {
    const k = slotOf(slot);
    const back = get(storage, k.life);
    if (back == null) return { ok: false, error: 'There is no earlier save to restore.' };
    const o = parse(back);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'The earlier save is not readable, so it was left alone.' };
    const cur = get(storage, LIFE_KEY), curSp = get(storage, SPELLS_KEY), backSp = get(storage, k.spells);
    // swap: the restored save goes live; what was live becomes the slot's backup (so this can be undone)
    storage.setItem(LIFE_KEY, back);
    if (backSp != null) storage.setItem(SPELLS_KEY, backSp); else storage.removeItem(SPELLS_KEY);
    if (cur != null) storage.setItem(k.life, cur); else storage.removeItem(k.life);
    if (curSp != null) storage.setItem(k.spells, curSp); else storage.removeItem(k.spells);
    storage.setItem(k.at, String(now()));
    return { ok: true };
  } catch { return { ok: false, error: 'This device could not restore the earlier save.' }; }
}
