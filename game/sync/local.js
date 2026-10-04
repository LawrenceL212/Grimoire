// local.js: the game's own save, as the sync engine and the export file see it. A thin adapter over the one storage key
// the play page owns (game/play/progress.js LIFE_KEY; the spells live inside that record).
//
//   localAdapter(storage?) -> { readLocal() -> { life, spells } | null, writeLocal({ life, spells }) -> boolean }
//   readLocal returns null when there is no readable save; it never throws. writeLocal never throws either.
//   BACKUP: before writeLocal changes what is stored, the previous raw strings are copied to
//       'grimoire.life.siso.v1.backup' and 'grimoire.spells.v1.backup' (ONE previous generation) with the time in
//       'grimoire.life.siso.v1.backup.at'. This also happens when the old save is unreadable (a broken save is never
//       overwritten without being kept first). If the backup cannot be stored, the write does NOT happen and returns false.
//   backupInfo(storage?) -> { at } | null          is there something to restore, and since when
//   restoreBackup({ storage?, now? }) -> { ok, error? }   puts the backup back; what was there becomes the new backup, so a
//       restore can itself be undone.
// NOTE for the play page: it keeps its life in memory and saves it whole, so after a sync writes local while the page is
// open, the page must re-read (session.js pulls before the life loads).
import { LIFE_KEY } from '../play/progress.js';
import { localStore } from '../title/saves.js';
import { canon } from './doc.js';

export const SPELLS_KEY = 'grimoire.spells.v1';
export const LIFE_BACKUP = `${LIFE_KEY}.backup`;
export const SPELLS_BACKUP = `${SPELLS_KEY}.backup`;
export const BACKUP_AT = `${LIFE_KEY}.backup.at`;

const get = (S, k) => { try { return S.getItem(k); } catch { return null; } };
const parse = (raw) => { try { return JSON.parse(raw); } catch { return undefined; } };

export function backupInfo(storage = localStore()) {
  if (!storage || get(storage, LIFE_BACKUP) == null) return null;
  const at = Number(get(storage, BACKUP_AT));
  return { at: Number.isFinite(at) ? at : null };
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
    writeLocal(state) {
      try {
        const next = JSON.stringify({ ...state.life, spells: state.spells ?? state.life.spells ?? {} });
        const old = get(storage, LIFE_KEY);
        if (old != null && old !== next) {
          const o = parse(old);
          const same = o !== undefined && o && typeof o === 'object' && canon(o) === canon(JSON.parse(next));
          if (!same) {
            storage.setItem(LIFE_BACKUP, old);
            const sp = get(storage, SPELLS_KEY);
            if (sp != null) storage.setItem(SPELLS_BACKUP, sp); else storage.removeItem(SPELLS_BACKUP);
            storage.setItem(BACKUP_AT, String(now()));
          }
        }
        storage.setItem(LIFE_KEY, next);
        return true;
      } catch { return false; }
    },
  };
}

export function restoreBackup({ storage = localStore(), now = () => Date.now() } = {}) {
  try {
    const back = get(storage, LIFE_BACKUP);
    if (back == null) return { ok: false, error: 'There is no earlier save to restore.' };
    const o = parse(back);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'The earlier save is not readable, so it was left alone.' };
    const cur = get(storage, LIFE_KEY), curSp = get(storage, SPELLS_KEY), backSp = get(storage, SPELLS_BACKUP);
    // swap: the restored save goes live; what was live becomes the backup (so this can be undone)
    storage.setItem(LIFE_KEY, back);
    if (backSp != null) storage.setItem(SPELLS_KEY, backSp); else storage.removeItem(SPELLS_KEY);
    if (cur != null) storage.setItem(LIFE_BACKUP, cur); else storage.removeItem(LIFE_BACKUP);
    if (curSp != null) storage.setItem(SPELLS_BACKUP, curSp); else storage.removeItem(SPELLS_BACKUP);
    storage.setItem(BACKUP_AT, String(now()));
    return { ok: true };
  } catch { return { ok: false, error: 'This device could not restore the earlier save.' }; }
}
