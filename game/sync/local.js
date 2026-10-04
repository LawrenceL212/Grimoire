// local.js: the game's own save, as the sync engine and the export file see it. A thin adapter over the one storage key
// the play page owns (game/play/progress.js LIFE_KEY; the spells live inside that record).
//
//   localAdapter(storage?) -> { readLocal() -> { life, spells } | null, writeLocal({ life, spells }) }
//   readLocal returns null when there is no readable save; it never throws. writeLocal never throws either.
// NOTE for step 2: the play page keeps its life in memory and saves it whole, so after a sync writes local while the
// page is open, the page must re-read (or the next save would overwrite the merge). Mount the sync on the title screen
// and on page load, before the play page reads its life.
import { LIFE_KEY } from '../play/progress.js';
import { localStore } from '../title/saves.js';

export function localAdapter(storage = localStore()) {
  return {
    readLocal() {
      try {
        const life = JSON.parse(storage?.getItem(LIFE_KEY) || 'null');
        if (!life || typeof life !== 'object' || Array.isArray(life)) return null;
        return { life, spells: life.spells && typeof life.spells === 'object' ? life.spells : {} };
      } catch { return null; }
    },
    writeLocal(state) {
      try { storage?.setItem(LIFE_KEY, JSON.stringify({ ...state.life, spells: state.spells ?? state.life.spells ?? {} })); return true; } catch { return false; }
    },
  };
}
