// merge.js: mergeSaves(a, b), the safe merge of two save documents (doc.js). PURE, deterministic, commutative
// (merge(a, b) equals merge(b, a)) and idempotent (merge(a, a) equals a).
//
// THE PRINCIPLE: a merge may only ever return what one of the two devices really earned. It never adds a credit,
// never adds two devices' credits together, and never forgets help. Everything derived (XP, earnings, the unaided
// flag, the balance) is RECOMPUTED by the existing validators (cleanLife, cleanHome) from the merged facts, never summed.
//
// THE RULES, each one on purpose:
//  tutorial   done if either is done; step the furthest; the skipped lists joined (sorted).
//  cards      per card the WORST help state: hint the highest, worked / codexEarly true if either side recorded them
//             (help is sticky: "help is never forgotten", learning design section 1); step the furthest; learnSeen true
//             if either; startedMs the earliest.
//  solves     the UNION, keyed by (card, atMs): the same solve on both devices is one solve (worst help, minimum XP,
//             unaided only if both agree). Per card, the FIRST real solve is the earliest by atMs; every later one is a
//             re-solve and carries no XP, no money and is not "unaided" (a re-solve is not a fresh problem). So a card
//             solved on two devices pays once, from whichever solve came first. If the same card was solved clean on A
//             and with help on B, whichever happened first is the one that counts, and the other can never top it up:
//             no credit is upgraded and none is added. XP is the table's value (min of what the solve recorded and
//             CREDIT[help]), so a tampered record cannot raise it. A practice solve earns nothing, on either side.
//  days       the UNION of the new concepts started each day (a superset of "the max": the daily pace cap can only
//             get stricter, never be reopened by a merge); highMs the max (time never goes backwards), and never
//             before the latest solve.
//  spells     per spell: written ONLY if a record that is written (backed by an unaided, non-demo cast; spells.js writes
//             nothing else) exists on one side. If both are written, the record with the later lastMs wins, and the
//             stability is never below the larger of the two. If one is written, that one wins (the other side's
//             pencil marks do not erase ink; its "assisted" mark is kept). If neither is written, the result is not
//             written (never invent ink); introduced languages are joined and a demonstration stays a demonstration.
//             Per-language forms follow the same rule.
//  home       the side with the higher purchase counter `seq` wins (ties: the later document updatedAt, then a stable
//             text order, so it never depends on the argument order). Its balance is topped up ONLY by what the
//             merged solves earned beyond that side's own solves, then cleanHome clamps the balance and drops
//             anything unaffordable against the merged earnings: nothing can exceed what the merged solves earned.
//             seq becomes the larger of the two so the counter never goes back.
//  updatedAt  the later of the two.
import { cleanLife, CREDIT } from '../play/progress.js';
import { earnedOf } from '../play/home-rules.js';
import { cleanSpellRecord } from '../play/spells.js';
import { checkDoc, canon } from './doc.js';

const RANK = { clean: 0, nudged: 1, guided: 2, exposure: 3 };
const worse = (a, b) => (RANK[a] >= RANK[b] ? a : b);
const LANGS = ['sql', 'js', 'php'];
const maxOf = (...v) => v.reduce((m, x) => (x > m ? x : m), -Infinity);
const minPos = (...v) => { const p = v.filter((x) => typeof x === 'number' && x > 0); return p.length ? Math.min(...p) : 0; };
const byText = (x, y) => { const a = canon(x), b = canon(y); return a < b ? -1 : a > b ? 1 : 0; }; // a stable tie-break
const latest = (...v) => { const t = maxOf(...v.map((x) => x ?? -Infinity)); return t === -Infinity ? null : t; };

function mergeCards(a, b) {
  const out = {};
  for (const id of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = a[id], y = b[id];
    if (!x || !y) { out[id] = structuredClone(x || y); continue; }
    const hint = Math.max(x.hint, y.hint);
    const c = {
      startedMs: x.startedMs === null ? y.startedMs : y.startedMs === null ? x.startedMs : Math.min(x.startedMs, y.startedMs),
      learnSeen: x.learnSeen || y.learnSeen, step: Math.max(x.step, y.step), hint,
      worked: x.worked || y.worked || hint >= 4, codexEarly: x.codexEarly || y.codexEarly,
    };
    const predicts = [x.predict, y.predict].filter((p) => typeof p === 'string').sort();
    if (predicts.length) c.predict = predicts[predicts.length - 1];
    out[id] = c;
  }
  return out;
}

function mergeSolves(sa, sb) {
  const byKey = new Map();
  for (const s of [...sa, ...sb]) {
    const k = `${s.card}\u0000${s.atMs}`, o = byKey.get(k);
    byKey.set(k, !o ? { ...s } : {
      ...o, help: worse(o.help, s.help), unaided: o.unaided && s.unaided, practice: o.practice || s.practice,
      xp: Math.min(o.xp, s.xp), lang: o.lang < s.lang ? o.lang : s.lang,
    });
  }
  const all = [...byKey.values()].sort((p, q) => p.atMs - q.atMs || (p.card < q.card ? -1 : p.card > q.card ? 1 : 0));
  const seen = new Set();
  return all.map((s) => {
    if (s.practice) return { ...s, xp: 0, unaided: false };
    const first = !seen.has(s.card); seen.add(s.card);
    // the first real solve keeps its (table-capped) XP; a re-solve is not a fresh problem
    return first ? { ...s, xp: Math.min(s.xp, CREDIT[s.help] ?? 0) } : { ...s, xp: 0, unaided: false };
  });
}

// ---- spells
// the later cast wins; a tie falls to the larger stability, then to a stable text order
const ahead = (x, y) => (x.lastMs !== y.lastMs ? (x.lastMs > y.lastMs ? x : y) : x.stability !== y.stability ? (x.stability > y.stability ? x : y) : byText(x, y) >= 0 ? x : y);
function mergeForm(x, y) {
  if (!x || !y) return { ...(x || y) };
  if (x.written && y.written) return { ...ahead(x, y), written: true, stability: Math.max(x.stability, y.stability) };
  if (x.written) return { ...x };
  if (y.written) return { ...y };
  return { written: false, lastMs: latest(x.lastMs, y.lastMs), stability: Math.max(x.stability, y.stability) };
}
// a form can only be written inside a record that is written: ink never appears on a pencil page
const normRec = (r) => { if (r.written) return r; const c = structuredClone(r); for (const f of Object.values(c.forms)) f.written = false; return c; };
function mergeRec(x0, y0) {
  if (!x0 || !y0) return structuredClone(x0 || y0);
  const x = normRec(x0), y = normRec(y0);
  let out;
  if (x.written && y.written) { const w = ahead(x, y); out = { ...w, written: true, stability: Math.max(x.stability, y.stability) }; }
  else if (x.written) out = { ...x, assisted: x.assisted || y.assisted };
  else if (y.written) out = { ...y, assisted: x.assisted || y.assisted };
  else out = { written: false, demo: x.demo || y.demo, assisted: x.assisted || y.assisted, lastMs: latest(x.lastMs, y.lastMs), stability: Math.max(x.stability, y.stability) };
  out.langs = LANGS.filter((l) => x.langs.includes(l) || y.langs.includes(l));
  out.forms = {};
  for (const l of LANGS) if (x.forms[l] || y.forms[l]) out.forms[l] = mergeForm(x.forms[l], y.forms[l]);
  return cleanSpellRecord(out); // the existing validator has the last word (demo only while unwritten, etc.)
}
function mergeSpells(a, b) {
  const out = {};
  for (const id of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) out[id] = mergeRec(a[id] && cleanSpellRecord(a[id]), b[id] && cleanSpellRecord(b[id]));
  return out;
}

// ---- home: the side with the higher seq, topped up only by what the merged solves earned beyond its own
function pickHome(A, B) {
  const ha = A.siso.life.home, hb = B.siso.life.home;
  const c = ha.seq - hb.seq || A.updatedAt - B.updatedAt || byText(ha, hb);
  return c >= 0 ? { home: ha, life: A.siso.life } : { home: hb, life: B.siso.life };
}

export function mergeSaves(a, b, { now } = {}) {
  const ra = a == null ? null : checkDoc(a, { now }), rb = b == null ? null : checkDoc(b, { now });
  const A = ra?.ok ? ra.doc : null, B = rb?.ok ? rb.doc : null;
  if (!A || !B) return structuredClone(A || B || null);
  const la = A.siso.life, lb = B.siso.life;

  const days = {};
  for (const d of [...new Set([...Object.keys(la.days), ...Object.keys(lb.days)])].sort()) days[d] = [...new Set([...(la.days[d] || []), ...(lb.days[d] || [])])].sort();
  const solves = mergeSolves(la.solves, lb.solves);
  const life = {
    v: 1,
    startedMs: minPos(la.startedMs, lb.startedMs),
    highMs: maxOf(la.highMs, lb.highMs, ...solves.map((s) => s.atMs)),
    tutorial: { done: la.tutorial.done || lb.tutorial.done, step: Math.max(la.tutorial.step, lb.tutorial.step), skipped: [...new Set([...la.tutorial.skipped, ...lb.tutorial.skipped])].sort() },
    cards: mergeCards(la.cards, lb.cards), solves, days,
  };
  // the chosen home gains only the earnings its own solves did not already hold
  const pick = pickHome(A, B);
  const earned = earnedOf(cleanLife({ ...life, home: null }, 0).solves); // what the merged solves earn, by the table
  const delta = Math.max(0, earned - earnedOf(pick.life.solves));
  life.home = { ...structuredClone(pick.home), seq: Math.max(la.home.seq, lb.home.seq), balance: pick.home.balance + delta };

  const r = checkDoc({ schema: 1, updatedAt: Math.max(A.updatedAt, B.updatedAt), siso: { life, spells: mergeSpells(A.siso.spells, B.siso.spells) } }, { now });
  return r.ok ? r.doc : structuredClone(A); // cannot happen for valid inputs; never return something unchecked
}
