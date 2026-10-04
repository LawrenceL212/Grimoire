// saves.js: the SISO life's save, as the title screen sees it. ONE list of the keys that make up a save, in one place.
//
// The play page owns these records (game/play/progress.js and game/play/spells.js); the title screen only asks
// "is there a save?" (Start or Continue) and clears it for New game. Both the old and the new layout are handled:
//   'grimoire.life.siso.v1'  the life record (progress.js LIFE_KEY): tutorial, cards, solves, days, and the spells inside
//   'grimoire.spells.v1'     the spell store before the life record held it (spells.js default key; still its fallback)
//   any later 'grimoire.life.siso.*' version (a future v2) is treated as part of the same save, defensively.
// Kept on New game (settings and layout, not progress): 'grimoire.audio.v1', 'grimoire.theme.v1', 'grimoire.title.preset.v1',
// 'grimoire.play.windows.v1'.
//
// Pure apart from the storage passed in (tested in node with a Map-backed stand-in):
//   SAVE_KEYS                      the exact keys of a SISO save
//   saveKeysIn(storage)            the save keys present in this storage (exact ones plus 'grimoire.life.siso.*')
//   hasSave(storage)               a save worth continuing: some key holds a non-empty record
//   clearSave(storage)             removes every save key; returns the keys removed
export const SAVE_KEYS = Object.freeze(['grimoire.life.siso.v1', 'grimoire.spells.v1']);
const LIFE_PREFIX = 'grimoire.life.siso.';

function keysOf(storage) {
  const out = [];
  try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k != null) out.push(k); } } catch { /* blocked */ }
  return out;
}

export function saveKeysIn(storage) {
  if (!storage) return [];
  const found = new Set();
  for (const k of SAVE_KEYS) { try { if (storage.getItem(k) != null) found.add(k); } catch { /* blocked */ } }
  // the two backup slots (manual and auto) the sync code keeps (game/sync/local.js) is not a save: it never makes Continue appear
  for (const k of keysOf(storage)) if (k.startsWith(LIFE_PREFIX) && !/\.(auto)?backup(\.at)?$/.test(k)) found.add(k);
  return [...found];
}

// a record counts when it parses to something with content: an empty spell store '{}' or a corrupt value is no save
function meaningful(raw) {
  if (raw == null || raw === '') return false;
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') return Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0;
    return false;
  } catch { return false; }
}

export function hasSave(storage) {
  if (!storage) return false;
  return saveKeysIn(storage).some((k) => { try { return meaningful(storage.getItem(k)); } catch { return false; } });
}

export function clearSave(storage) {
  if (!storage) return [];
  const keys = saveKeysIn(storage);
  for (const k of keys) { try { storage.removeItem(k); } catch { /* blocked: nothing to clear */ } }
  return keys;
}

export function localStore() {
  try { const s = globalThis.localStorage; const k = '__grimoire_probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; }
}
