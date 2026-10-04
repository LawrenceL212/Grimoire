// test helpers: build real saves with the real progression code (never hand-made records that skip the rules)
import { freshLife, recordSolve, noteHelp, startCard } from '../play/progress.js';
import { createSpellStore, memoryStorage } from '../play/spells.js';
import { buy } from '../play/home-rules.js';
import { toDoc } from './doc.js';

export const T0 = Date.UTC(2026, 9, 1, 9, 0);
export const NOW = T0 + 30 * 86400000;
export const card = (id, o = {}) => ({ id, evidence: true, newConcept: true, ...o });

// a device: { life, spells } with helpers that play like the real game
export function device(start = T0) {
  const d = { life: freshLife(start), store: null };
  const sync = () => { d.store = createSpellStore({ storage: memoryStorage(), key: 's', now: () => NOW }); };
  sync();
  d.solve = (c, { help = 'clean', at, casts = [], practice = false, lang = 'sql' } = {}) => {
    const r = recordSolve(d.life, c, { help, lang, casts, nowMs: at, practice });
    d.life = r.life;
    for (const s of r.spells) d.store.recordCast(s.id, { lang, unaided: s.unaided, outcome: s.outcome, nowMs: at });
    return r;
  };
  d.help = (id, h) => { d.life = noteHelp(d.life, id, h); };
  d.start = (c, at) => { d.life = startCard(d.life, c, at); };
  d.buy = (id) => { const r = buy(d.life.home, id); if (r.ok) d.life = { ...d.life, home: r.home }; return r; };
  d.state = () => ({ life: d.life, spells: d.dump() });
  d.dump = () => { const out = {}; for (const { spell } of d.store.all()) { const s = d.store.getSpellState(spell.id, NOW); if (!s.introduced && !s.written) continue; out[spell.id] = { langs: s.langs, written: s.written, demo: s.demo, lastMs: s.lastMs, stability: s.stability, assisted: s.assisted, forms: s.forms }; } return out; };
  d.doc = (o = {}) => toDoc(d.state(), { now: NOW, ...o });
  return d;
}
