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
//   checkDoc(raw, { now? }) -> { ok: true, doc } | { ok: false, error }     the one gate; the doc is the clamped copy
//   toDoc(localState, { now?, updatedAt? }) -> doc | null     localState = { life, spells? }; null when unusable
//   fromDoc(raw, { now? }) -> { ok, doc, state: { life, spells } } | { ok: false, error }   state is what the game keeps
//   canon(v)                                   stable JSON text (sorted keys), for comparing documents
import { cleanLife } from '../play/progress.js';
import { cleanSpellRecord, isSpell } from '../play/spells.js';

export const SCHEMA = 1;
export const MAX_BYTES = 500_000;
export const SKEW_MS = 36 * 3600 * 1000; // a device clock may run this far ahead of ours before a time is "the future"

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
const goodKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 80 && !BAD_KEY.has(k);

export function canon(v) {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}
const size = (v) => { try { return JSON.stringify(v).length; } catch { return Infinity; } };

// a spell record with every time after `limit` forgotten, so a forged "written next year" cannot write a spell
function noFuture(rec, limit) {
  if (!isObj(rec)) return rec;
  const out = { ...rec };
  if (num(out.lastMs) !== null && out.lastMs > limit) { out.lastMs = null; out.written = false; }
  if (isObj(out.forms)) {
    out.forms = Object.fromEntries(Object.entries(out.forms).map(([l, f]) => {
      if (!isObj(f)) return [l, f];
      return [l, num(f.lastMs) !== null && f.lastMs > limit ? { ...f, lastMs: null, written: false } : f];
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
  const pre = { ...siso.life };
  if (num(pre.highMs) === null) return { ok: false, error: 'This save has no clock, so it cannot be trusted.' };
  pre.highMs = Math.min(pre.highMs, limit);
  if (num(pre.startedMs) !== null) pre.startedMs = Math.min(pre.startedMs, limit);
  if (isObj(pre.cards)) pre.cards = Object.fromEntries(Object.entries(pre.cards).filter(([k]) => goodKey(k)));
  if (isObj(pre.days)) pre.days = Object.fromEntries(Object.entries(pre.days).filter(([d]) => /^\d{4}-\d\d-\d\d$/.test(d)));
  if (Array.isArray(pre.solves)) pre.solves = pre.solves.filter((s) => isObj(s) && goodKey(s.card));
  // nowMs 0: the validator must not move the record's clock to "now", or two copies of one save would never be equal
  const life = cleanLife(pre, 0);
  delete life.spells;
  const doc = {
    schema: SCHEMA,
    updatedAt: Math.max(0, Math.min(Math.floor(num(raw.updatedAt) ?? life.highMs), limit)),
    siso: { life, spells: cleanSpells(siso.spells, limit) },
  };
  if (size(doc) > MAX_BYTES) return { ok: false, error: 'This save is far too large to be a Grimoire save.' };
  return { ok: true, doc };
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
  return { ok: true, doc: r.doc, state: { life: { ...structuredClone(r.doc.siso.life), spells: structuredClone(spells) }, spells } };
}
