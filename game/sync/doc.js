// doc.js: the portable save document, the one shape that travels between devices, the cloud and the export file.
//
//   { schema: 1, updatedAt: <ms>, siso: { life, spells } }      EXACTLY these three top-level keys (the Firestore
//                                                               rules of step 2 will match them)
//   life    the life record of game/play/progress.js (tutorial, cards, solves, days, home...), WITHOUT its spells
//   spells  the spell records of game/play/spells.js, keyed by spell id
//
// Nothing here re-states a rule. Every part goes through the EXISTING validators: cleanLife (which uses cleanHome and
// the credit table), and spells.js's own record cleaner. On top of them this module only adds what a document that
// arrives from OUTSIDE needs: a schema check, a size cap, a clock clamp (a time in the future cannot have happened),
// and refusing the keys that are not data ('__proto__' and friends).
//
// WHAT THE GATE ENFORCES, ON TOP OF THE EXISTING VALIDATORS. A save carries no signature, so it is SELF-ATTESTED: anyone
// can write any file. These caps are therefore the MINIMUM that stops a save from minting credit out of thin air; they
// cannot prove the solves happened. A valid doc has:
//   - only cards of the real ladder (game/problems/ladder.js); unknown ids are dropped (cards, solves, days)
//   - at most one REAL (non-practice) solve per card, plus at most MAX_EXTRA re-solves or practice solves of it; a card
//     that cannot count as evidence (a teaching ticket) earns no XP and no money, whatever the file says
//   - at most DAILY_CAP new concepts per calendar day in `days` (the pace cap)
//   - a spell written (ink) only if a real, unaided solve on the ladder at or after the card that teaches it exists in
//     the same doc; otherwise it is downgraded to pencil (introduced and any assisted mark are kept)
//   - purchases at most what the solves COULD have earned (EARNINGS per distinct evidence card solved: a later merge
//     may lower what a solve earned, but never un-buys what was bought), and the balance at most what the solves did
//     earn minus the worth of what is owned, never below 0
//   - times no later than now + SKEW_MS: a later solve time is set back to that ceiling (never deleted) with a notice
//
//   checkDoc(raw, { now? }) -> { ok: true, doc, notices[] } | { ok: false, error }     the one gate; the doc is the clamped copy
//   toDoc(localState, { now?, updatedAt? }) -> doc | null     localState = { life, spells? }; null when unusable
//   fromDoc(raw, { now? }) -> { ok, doc, state: { life, spells } } | { ok: false, error }   state is what the game keeps
//   canon(v)                                   stable JSON text (sorted keys), for comparing documents
import { cleanLife } from '../play/progress.js';
import { cleanSpellRecord, isSpell } from '../play/spells.js';
import { cleanHome, earnedOf, priceOf, EARNINGS } from '../play/home-rules.js';
import { LADDER, DAILY_CAP } from '../problems/ladder.js';

export const SCHEMA = 1;
export const MAX_BYTES = 500_000;
export const MAX_EXTRA = 3; // re-solves and practice solves kept per card, beyond its one real solve
export const SKEW_MS = 36 * 3600 * 1000; // a device clock may run this far ahead of ours before a time is "the future"

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
const goodKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 80 && !BAD_KEY.has(k);

const CARD = new Map(LADDER.map((c, i) => [c.id, { i, evidence: c.evidence !== false }]));
// the first ladder card that teaches or recalls a spell: from it on, an unaided solve could have cast it
const SPELL_FROM = new Map();
LADDER.forEach((c, i) => { for (const id of [...(c.spells?.teach || []), ...(c.spells?.recall || [])]) if (!SPELL_FROM.has(id)) SPELL_FROM.set(id, i); });
const worthOf = (items) => items.reduce((n, it) => n + (it.starter ? 0 : priceOf(it.id)), 0);

export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}
const size = (v) => { try { return JSON.stringify(v).length; } catch { return Infinity; } };

// a spell record with every time after `limit` set back to it (a fast clock loses nothing; ink still needs its backing solve)
function noFuture(rec, limit) {
  if (!isObj(rec)) return rec;
  const out = { ...rec };
  if (num(out.lastMs) !== null && out.lastMs > limit) out.lastMs = limit;
  if (isObj(out.forms)) {
    out.forms = Object.fromEntries(Object.entries(out.forms).map(([l, f]) => {
      if (!isObj(f)) return [l, f];
      return [l, num(f.lastMs) !== null && f.lastMs > limit ? { ...f, lastMs: limit } : f];
    }));
  }
  return out;
}

export function cleanSpells(raw, limit = Infinity) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw)) {
    if (!isSpell(id)) continue;
    const r = cleanSpellRecord(noFuture(raw[id], limit));
    // a form is ink only inside a page that is itself written: the record-level rule, applied to its forms
    if (!r.written) for (const f of Object.values(r.forms)) f.written = false;
    if (r.langs.length || r.written || r.demo || r.assisted) out[id] = r;
  }
  return out;
}

export function checkDoc(raw, { now = Date.now() } = {}) {
  if (!isObj(raw)) return { ok: false, error: 'This is not a Grimoire save.' };
  if (raw.schema !== SCHEMA) return { ok: false, error: 'This save is from a version of Grimoire this one does not know.' };
  if (size(raw) > MAX_BYTES) return { ok: false, error: 'This save is far too large to be a Grimoire save.' };
  const siso = raw.siso;
  if (!isObj(siso) || !isObj(siso.life) || siso.life.v !== 1) return { ok: false, error: 'This save has no readable game in it.' };
  const limit = now + SKEW_MS;
  const notices = [];
  const pre = { ...siso.life };
  if (num(pre.highMs) === null) return { ok: false, error: 'This save has no clock, so it cannot be trusted.' };
  pre.highMs = Math.min(pre.highMs, limit);
  if (num(pre.startedMs) !== null) pre.startedMs = Math.min(pre.startedMs, limit);
  pre.cards = isObj(pre.cards) ? Object.fromEntries(Object.entries(pre.cards).filter(([k]) => goodKey(k) && CARD.has(k))) : {};
  pre.days = isObj(pre.days)
    ? Object.fromEntries(Object.entries(pre.days).filter(([d, ids]) => /^\d{4}-\d\d-\d\d$/.test(d) && Array.isArray(ids))
      .map(([d, ids]) => [d, [...new Set(ids.filter((x) => typeof x === 'string' && CARD.has(x)))].slice(0, DAILY_CAP)]))
    : {};
  // solves: real cards only, in time order, one real solve per card (+ a few extras), a teaching card earns nothing
  let setBack = 0;
  const solves = (Array.isArray(pre.solves) ? pre.solves : []).filter((s) => isObj(s) && goodKey(s.card) && CARD.has(s.card) && num(s.atMs) !== null)
    .map((s) => { if (s.atMs > limit) { setBack++; return { ...s, atMs: limit }; } return s; })
    .sort((p, q) => p.atMs - q.atMs);
  if (setBack) notices.push(`A device clock was ahead: ${setBack} solve time${setBack === 1 ? ' was' : 's were'} set back to now.`);
  const real = new Set(), extra = new Map();
  pre.solves = [];
  for (const s of solves) {
    const meta = CARD.get(s.card);
    const isReal = s.practice !== true && !real.has(s.card);
    if (isReal) real.add(s.card);
    else { const n = (extra.get(s.card) || 0) + 1; if (n > MAX_EXTRA) continue; extra.set(s.card, n); }
    pre.solves.push(meta.evidence ? s : { ...s, unaided: false, xp: 0 });
  }
  pre.highMs = Math.max(pre.highMs, ...pre.solves.map((s) => s.atMs).filter((t) => t <= limit));
  const rawHome = pre.home;
  pre.home = null;
  // nowMs 0: the validator must not move the record's clock to "now", or two copies of one save would never be equal
  const life = cleanLife(pre, 0);
  delete life.spells;
  // the home: purchases up to what the solves could have earned, the balance up to what they did earn
  const evidenceCards = new Set(life.solves.filter((s) => !s.practice && CARD.get(s.card)?.evidence).map((s) => s.card));
  const home = cleanHome(rawHome, evidenceCards.size * EARNINGS.unaidedEvidenceSolve);
  home.balance = Math.max(0, Math.min(home.balance, earnedOf(life.solves) - worthOf(home.items)));
  life.home = home;
  // ink needs a real unaided solve at or after the card that teaches the spell
  // (any real solve of an evidence card made clean or nudged counts, first or not: that fact only ever grows when two saves are
  // merged, so which merge order was used can never decide whether a spell stays written)
  const top = Math.max(-1, ...life.solves.filter((s) => !s.practice && CARD.get(s.card).evidence && (s.help === 'clean' || s.help === 'nudged')).map((s) => CARD.get(s.card).i));
  const spells = cleanSpells(siso.spells, limit);
  for (const [id, r] of Object.entries(spells)) {
    if (!r.written || (SPELL_FROM.has(id) && top >= SPELL_FROM.get(id))) continue;
    r.written = false;
    for (const f of Object.values(r.forms)) f.written = false;
  }
  const doc = {
    schema: SCHEMA,
    updatedAt: Math.max(0, Math.min(Math.floor(num(raw.updatedAt) ?? life.highMs), limit)),
    siso: { life, spells },
  };
  if (size(doc) > MAX_BYTES) return { ok: false, error: 'This save is far too large to be a Grimoire save.' };
  return { ok: true, doc, notices };
}

export function toDoc(state, { now, updatedAt } = {}) {
  if (!isObj(state) || !isObj(state.life)) return null;
  const r = checkDoc({ schema: SCHEMA, updatedAt: updatedAt ?? state.life.highMs, siso: { life: state.life, spells: state.spells ?? state.life.spells ?? {} } }, { now });
  return r.ok ? r.doc : null;
}

export function fromDoc(raw, opts = {}) {
  const r = checkDoc(raw, opts);
  if (!r.ok) return r;
  const spells = structuredClone(r.doc.siso.spells);
  return { ok: true, doc: r.doc, notices: r.notices, state: { life: { ...structuredClone(r.doc.siso.life), spells: structuredClone(spells) }, spells } };
}
