// progress.js: the learner's progress through the opening chapter, per life, under ONE storage key. Honest
// progression (learning design, sections 1 and 5): progress is solves, never time or tickets seen; hints cost
// credit; a solve that used the worked example is exposure, not mastery; a spell is written only on an unaided
// solve of a fresh problem using it; at most DAILY_CAP new concepts a calendar day.
//
// Pure (tested in node):
//   freshLife(nowMs)                      a new life: the tutorial first
//   cleanLife(raw, nowMs)                 a stored life checked field by field (corrupt data -> a fresh life)
//   dayKey(ms)                            the local calendar day, 'YYYY-MM-DD'
//   helpOf({ hint, worked, codexEarly })  'clean' | 'nudged' | 'guided' | 'exposure' (the credit table)
//   CREDIT, creditLeft(help), HINT_COST   the XP a first solve earns after each kind of help, said before opening
//   nextCardId(ladder, life)              the first card in ladder order without a real solve (null: chapter done)
//   newToday(life, nowMs)                 the new concepts started today
//   paceCheck(card, life, nowMs, cap)     { ok, count, cap, message }: a new concept only while today's count is
//                                         under the cap (a card already started is never blocked again)
//   startCard(life, card, nowMs)          the card is served: its new concept counts toward today
//   recordSolve(life, card, { help, lang, casts, nowMs, practice }) -> { life, xp, spells: [{ id, unaided, outcome }] }
//   xpOf(life), solvedIds(life)
// Stateful:
//   createLife({ storage, key, now }) -> { life, save(), reset(), spellStore, ... the pure functions bound }
//   The spells of this life live inside the same record (life.spells), read and written through spells.js's
//   store with a storage adapter, so the HUD's Grimoire shows this life's progress.
import { createSpellStore } from './spells.js';

export const LIFE_KEY = 'grimoire.life.siso.v1';
export const CREDIT = Object.freeze({ clean: 10, nudged: 7, guided: 3, exposure: 0 });
// what each rung of the hint ladder costs, said on the button BEFORE it is opened
export const HINT_COST = Object.freeze([
  { level: 1, name: 'A nudge', costs: 'costs 3 XP of this ticket: the solve counts as "nudged"' },
  { level: 2, name: 'Which idea', costs: 'the solve becomes "guided": 3 XP, and no spell is written' },
  { level: 3, name: 'The Grimoire page', costs: 'guided as well: 3 XP, and no spell is written' },
  { level: 4, name: 'The worked example', costs: 'practice only: 0 XP, and the spells stay in pencil' },
]);
export const creditLeft = (help) => CREDIT[help] ?? 0;

const pad = (n) => String(n).padStart(2, '0');
export function dayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function freshLife(nowMs = Date.now()) {
  return { v: 1, startedMs: nowMs, tutorial: { done: false, step: 0, skipped: [] }, cards: {}, solves: [], days: {}, spells: {} };
}

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export function cleanLife(raw, nowMs = Date.now()) {
  const life = freshLife(nowMs);
  if (!isObj(raw) || raw.v !== 1) return life;
  life.startedMs = num(raw.startedMs) ?? nowMs;
  if (isObj(raw.tutorial)) {
    life.tutorial.done = raw.tutorial.done === true;
    life.tutorial.step = Number.isInteger(raw.tutorial.step) && raw.tutorial.step >= 0 ? raw.tutorial.step : 0;
    life.tutorial.skipped = Array.isArray(raw.tutorial.skipped) ? raw.tutorial.skipped.filter((s) => typeof s === 'string') : [];
  }
  if (isObj(raw.cards)) {
    for (const [id, c] of Object.entries(raw.cards)) {
      if (!isObj(c)) continue;
      life.cards[id] = { startedMs: num(c.startedMs), learnSeen: c.learnSeen === true, step: Number.isInteger(c.step) && c.step >= 0 ? c.step : 0 };
    }
  }
  if (Array.isArray(raw.solves)) {
    life.solves = raw.solves.filter((s) => isObj(s) && typeof s.card === 'string' && num(s.atMs) !== null && ['clean', 'nudged', 'guided', 'exposure'].includes(s.help))
      .map((s) => ({ card: s.card, atMs: s.atMs, help: s.help, assisted: s.help === 'guided' || s.help === 'exposure', unaided: s.unaided === true, lang: typeof s.lang === 'string' ? s.lang : 'sql', xp: num(s.xp) ?? 0, practice: s.practice === true }));
  }
  if (isObj(raw.days)) for (const [d, ids] of Object.entries(raw.days)) if (/^\d{4}-\d\d-\d\d$/.test(d) && Array.isArray(ids)) life.days[d] = ids.filter((x) => typeof x === 'string');
  if (isObj(raw.spells)) life.spells = raw.spells; // spells.js validates its own records
  return life;
}

export function helpOf({ hint = 0, worked = false, codexEarly = false } = {}) {
  if (worked || hint >= 4) return 'exposure';
  if (hint >= 2) return 'guided';
  if (hint === 1 || codexEarly) return 'nudged';
  return 'clean';
}

export const solvedIds = (life) => new Set(life.solves.filter((s) => !s.practice).map((s) => s.card));
export function nextCardId(ladder, life) {
  const done = solvedIds(life);
  return ladder.find((c) => !done.has(c.id))?.id ?? null;
}
const startedEver = (life, id) => Object.values(life.days).some((ids) => ids.includes(id));
export const newToday = (life, nowMs) => life.days[dayKey(nowMs)] || [];

export function paceCheck(card, life, nowMs, cap) {
  const count = newToday(life, nowMs).length;
  if (!card || !card.newConcept || startedEver(life, card.id) || count < cap) return { ok: true, count, cap, message: '' };
  return {
    ok: false, count, cap,
    message: `You've met ${count} new ideas today, which is about the most that sticks. The next new idea opens tomorrow: sleep is when today's learning settles in. Anything else tonight is practice on tickets you have already solved, with no credit.`,
  };
}

export function startCard(life, card, nowMs) {
  const next = structuredClone(life);
  next.cards[card.id] ??= { startedMs: nowMs, learnSeen: false, step: 0 };
  next.cards[card.id].startedMs ??= nowMs;
  if (card.newConcept && !startedEver(life, card.id)) (next.days[dayKey(nowMs)] ??= []).push(card.id);
  return next;
}

/* casts: the spells the learner's own code used (card.js castSpells, minus what the card showed him).
   A spell is written (unaided) only when: the solve was clean or nudged, the card can count as evidence
   (scaffolded on-ramp cards cannot), it is the first real solve of this card (a re-solve is not a fresh
   problem), and it is not practice. Everything else is recorded as exposure or guided. */
export function recordSolve(life, card, { help = 'clean', lang = 'sql', casts = [], nowMs = Date.now(), practice = false } = {}) {
  const next = structuredClone(life);
  const first = !solvedIds(life).has(card.id);
  const xp = first && !practice ? creditLeft(help) : 0;
  const fresh = first && !practice && card.evidence !== false;
  const unaided = fresh && (help === 'clean' || help === 'nudged');
  next.solves.push({ card: card.id, atMs: nowMs, help, assisted: help === 'guided' || help === 'exposure', unaided, lang, xp, practice: !!practice });
  const spells = [...new Set(casts)].map((id) => ({ id, unaided, outcome: unaided ? 'clean' : help === 'guided' ? 'guided' : 'exposure' }));
  return { life: next, xp, spells, first };
}
export const xpOf = (life) => life.solves.reduce((n, s) => n + (s.xp || 0), 0);

// ---------------------------------------------------------------- the stateful life (storage under one key)
function safeStorage() {
  try { const s = globalThis.localStorage; const k = '__grimoire_probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; }
}
export function createLife({ storage, key = LIFE_KEY, now = Date.now } = {}) {
  const S = storage === undefined ? safeStorage() : storage;
  let life;
  try { life = cleanLife(JSON.parse(S?.getItem(key) || 'null'), now()); } catch { life = freshLife(now()); }
  const existed = (() => { try { return !!S?.getItem(key); } catch { return false; } })();
  const save = () => { try { S?.setItem(key, JSON.stringify(life)); } catch { /* storage off or full: this life lasts the visit */ } };
  // the spell store reads and writes life.spells, inside the same record
  const adapter = {
    getItem: () => JSON.stringify(life.spells || {}),
    setItem: (_k, v) => { try { life.spells = JSON.parse(v); } catch { life.spells = {}; } save(); },
    removeItem: () => { life.spells = {}; save(); },
  };
  const makeStore = () => createSpellStore({ storage: adapter, key: 'spells', now });
  let spellStore = makeStore();
  return {
    get life() { return life; },
    set life(v) { life = v; save(); },
    get spellStore() { return spellStore; },
    existed, save,
    reset() { life = freshLife(now()); save(); spellStore = makeStore(); },
  };
}
