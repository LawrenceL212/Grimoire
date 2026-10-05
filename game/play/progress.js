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
//                                         a teaching or scaffolded card (evidence: false) earns 0 XP; a practice solve
//                                         casts nothing (no spell state changes at all)
//   noteHelp(life, cardId, { hint, worked, codexEarly }) -> life   the help used on a card, kept in the record and
//                                         never lowered (a reload, Continue or a tutorial replay cannot wash it out)
//   helpSoFar(life, cardId) -> { hint, worked, codexEarly }
//   effectiveNow(life, nowMs) / touch(life, nowMs)   the clock never goes backwards: max(now, the record's high
//                                         water mark); every pace and meter decision uses it
//   xpOf(life), solvedIds(life), balanceOf(life)
//   life.home (home-rules.js): the spendable balance, what is owned and where it stands. recordSolve credits it from
//   the earnings table (only a first unaided solve of an evidence card pays); cleanHome() on load never lets the
//   balance and the things bought exceed what the life's own solves could have earned.
// Stateful:
//   createLife({ storage, key, now }) -> { life, save(), reset(), spellStore, ... the pure functions bound }
//   The spells of this life live inside the same record (life.spells), read and written through spells.js's
//   store with a storage adapter, so the HUD's Grimoire shows this life's progress.
import { createSpellStore, gameNow } from './spells.js';
import { earnFor, EARNINGS, earnedOf, newHome, cleanHome, creditHome } from './home-rules.js';
import { cleanLog } from '../world/ddl-log.js';

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
  return { v: 1, startedMs: nowMs, highMs: nowMs, tutorial: { done: false, step: 0, skipped: [] }, cards: {}, solves: [], days: {}, spells: {}, home: newHome(), arc: newArc() };
}
/* The product arc's part of the life: his company's name, and the log of every run that changed his database (the
   save of his world: replayed into an empty PostgreSQL on load, world/ddl-log.js). marks[cardId] is how long the
   log was when that ticket first opened (Reset goes back to it). A life saved before the arc has none: it keeps
   its spells, credit and home, and its company is rebuilt by the arc from empty (product arc, Q5).
   Milestone M-C adds: scripts[cardId], what a colleague's script did when that ticket arrived (shown to him: its text
   and a plain verdict per line; what went in is in the log, as that colleague's entry); variants[cardId], the
   variant of a card chosen when it first arrived (S5's branch); choices, the decisions in his schema the director
   will read later (catalogue.js schemaChoices). A save without them loads as before. */
export const newArc = () => ({ company: null, log: [], marks: {}, scripts: {}, variants: {}, choices: {} });
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const idKey = (k) => typeof k === 'string' && k.length > 0 && k.length <= 40 && !['__proto__', 'constructor', 'prototype'].includes(k);
function cleanScript(x) {
  if (!isObj(x)) return null;
  const lines = Array.isArray(x.lines) ? x.lines.slice(0, 60).filter(isObj).map((l) => ({ label: str(l.label, 120), verdict: str(l.verdict, 400), ok: l.ok === true })) : [];
  return { title: str(x.title, 120), by: str(x.by, 20), when: str(x.when, 40), intro: str(x.intro, 600), text: str(x.text, 20000), lines, ...(x.error ? { error: str(x.error, 300) } : {}) };
}
export function cleanArc(raw) {
  const arc = newArc();
  if (!isObj(raw)) return arc;
  if (typeof raw.company === 'string' && raw.company.trim()) arc.company = raw.company.trim().slice(0, 40);
  arc.log = cleanLog(raw.log);
  // card ids only as keys: a stored '__proto__' (JSON.parse makes it an own key) must never reach an assignment
  if (isObj(raw.marks)) for (const [id, n] of Object.entries(raw.marks)) if (idKey(id) && Number.isInteger(n) && n >= 0) arc.marks[id] = Math.min(n, arc.log.length);
  if (isObj(raw.scripts)) for (const [id, x] of Object.entries(raw.scripts)) { const c = idKey(id) && cleanScript(x); if (c) arc.scripts[id] = c; }
  if (isObj(raw.variants)) for (const [id, v] of Object.entries(raw.variants)) if (idKey(id) && typeof v === 'string' && /^[a-z-]{1,20}$/.test(v)) arc.variants[id] = v;
  if (isObj(raw.choices)) for (const [k, v] of Object.entries(raw.choices)) if (/^[a-zA-Z]{1,20}$/.test(k) && (typeof v === 'boolean' || (typeof v === 'string' && v.length <= 20) || v === null)) arc.choices[k] = v;
  return arc;
}

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
export function cleanLife(raw, nowMs = Date.now()) {
  const life = freshLife(nowMs);
  if (!isObj(raw) || raw.v !== 1) return life;
  life.startedMs = num(raw.startedMs) ?? nowMs;
  life.highMs = Math.max(nowMs, num(raw.highMs) ?? 0);
  if (isObj(raw.tutorial)) {
    life.tutorial.done = raw.tutorial.done === true;
    life.tutorial.step = Number.isInteger(raw.tutorial.step) && raw.tutorial.step >= 0 ? raw.tutorial.step : 0;
    life.tutorial.skipped = Array.isArray(raw.tutorial.skipped) ? raw.tutorial.skipped.filter((s) => typeof s === 'string') : [];
  }
  if (isObj(raw.cards)) {
    for (const [id, c] of Object.entries(raw.cards)) {
      if (!isObj(c)) continue;
      const hint = Number.isInteger(c.hint) ? Math.max(0, Math.min(4, c.hint)) : 0;
      life.cards[id] = { startedMs: num(c.startedMs), learnSeen: c.learnSeen === true, step: Number.isInteger(c.step) && c.step >= 0 ? c.step : 0,
        hint, worked: c.worked === true || hint >= 4, codexEarly: c.codexEarly === true, ...(typeof c.predict === 'string' ? { predict: c.predict } : {}) };
    }
  }
  if (Array.isArray(raw.solves)) {
    // a solve dated after the record's own latest moment cannot have happened; XP can never exceed the credit table
    life.solves = raw.solves.filter((s) => isObj(s) && typeof s.card === 'string' && num(s.atMs) !== null && s.atMs <= life.highMs && ['clean', 'nudged', 'guided', 'exposure'].includes(s.help))
      .map((s) => ({ card: s.card, atMs: s.atMs, help: s.help, assisted: s.help === 'guided' || s.help === 'exposure', unaided: s.unaided === true && (s.help === 'clean' || s.help === 'nudged') && s.practice !== true, lang: typeof s.lang === 'string' ? s.lang : 'sql',
        xp: s.practice === true ? 0 : Math.max(0, Math.min(CREDIT[s.help], num(s.xp) ?? 0)), practice: s.practice === true }));
    // only the first real solve of a card can carry XP, and only an unaided first solve earns money (home-rules.js EARNINGS)
    const paid = new Set();
    for (const s of life.solves) {
      if (s.practice) { s.gbp = 0; continue; }
      const dup = paid.has(s.card);
      if (dup) s.xp = 0;
      paid.add(s.card);
      s.gbp = !dup && s.unaided ? EARNINGS.unaidedEvidenceSolve : 0;
    }
  }
  if (isObj(raw.days)) for (const [d, ids] of Object.entries(raw.days)) if (/^\d{4}-\d\d-\d\d$/.test(d) && Array.isArray(ids)) life.days[d] = ids.filter((x) => typeof x === 'string');
  if (isObj(raw.spells)) life.spells = raw.spells; // spells.js validates its own records
  // the home: never worth more than the solves could have earned
  life.home = cleanHome(raw.home, earnedOf(life.solves));
  life.arc = cleanArc(raw.arc);
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

// the clock never goes backwards: a device clock set back cannot open a fresh day's cap or un-fade the ink
export const effectiveNow = (life, nowMs) => Math.max(nowMs, life?.highMs ?? 0);
export function touch(life, nowMs) {
  if ((life.highMs ?? 0) >= nowMs) return life;
  const next = structuredClone(life); next.highMs = nowMs; return next;
}
export function helpSoFar(life, cardId) {
  const c = life.cards[cardId] || {};
  return { hint: c.hint || 0, worked: !!c.worked, codexEarly: !!c.codexEarly };
}
export function noteHelp(life, cardId, { hint = 0, worked = false, codexEarly = false } = {}) {
  const next = structuredClone(life);
  const c = next.cards[cardId] ??= { startedMs: null, learnSeen: false, step: 0 };
  c.hint = Math.max(c.hint || 0, Math.min(4, hint));
  c.worked = !!c.worked || !!worked || c.hint >= 4;
  c.codexEarly = !!c.codexEarly || !!codexEarly;
  return next;
}

export function paceCheck(card, life, nowMs, cap) {
  nowMs = effectiveNow(life, nowMs);
  const count = newToday(life, nowMs).length;
  if (!card || !card.newConcept || startedEver(life, card.id) || count < cap) return { ok: true, count, cap, message: '' };
  return {
    ok: false, count, cap,
    message: `You've met ${count} new ideas today, which is about the most that sticks. The next new idea opens tomorrow: sleep is when today's learning settles in. Anything else tonight is practice on tickets you have already solved, with no credit.`,
  };
}

export function startCard(life, card, nowMs) {
  nowMs = effectiveNow(life, nowMs);
  const next = touch(structuredClone(life), nowMs);
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
  nowMs = effectiveNow(life, nowMs);
  const next = touch(structuredClone(life), nowMs);
  const first = !solvedIds(life).has(card.id);
  // XP pays for solving fresh problems on your own: a teaching or scaffolded ticket earns none
  const xp = first && !practice && card.evidence !== false ? creditLeft(help) : 0;
  const fresh = first && !practice && card.evidence !== false;
  const unaided = fresh && (help === 'clean' || help === 'nudged');
  // money follows the same honesty: only the first unaided solve of an evidence card (home-rules.js earnFor)
  const gbp = earnFor({ first, practice: !!practice, evidence: card.evidence !== false, help });
  next.solves.push({ card: card.id, atMs: nowMs, help, assisted: help === 'guided' || help === 'exposure', unaided, lang, xp, gbp, practice: !!practice });
  next.home = creditHome(next.home || newHome(), gbp);
  // practice changes no spell at all: a passed ticket is not a fresh problem, and help is not a review
  const spells = practice ? [] : [...new Set(casts)].map((id) => ({ id, unaided, outcome: unaided ? help : help === 'guided' ? 'guided' : 'exposure' }));
  return { life: next, xp, gbp, spells, first };
}
export const xpOf = (life) => life.solves.reduce((n, s) => n + (s.xp || 0), 0);
export const balanceOf = (life) => life?.home?.balance ?? 0;

// ---------------------------------------------------------------- the stateful life (storage under one key)
function safeStorage() {
  try { const s = globalThis.localStorage; const k = '__grimoire_probe'; s.setItem(k, '1'); s.removeItem(k); return s; } catch { return null; }
}
export function createLife({ storage, key = LIFE_KEY, now = gameNow } = {}) {
  const S = storage === undefined ? safeStorage() : storage;
  let life;
  try { life = cleanLife(JSON.parse(S?.getItem(key) || 'null'), now()); } catch { life = freshLife(now()); }
  const existed = (() => { try { return !!S?.getItem(key); } catch { return false; } })();
  const save = () => {
    try { S?.setItem(key, JSON.stringify(life)); } catch { /* storage off or full: this life lasts the visit */ }
    try { globalThis.__sync?.notifyLocalChange(); } catch { /* cloud sync is optional */ }
  };
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
