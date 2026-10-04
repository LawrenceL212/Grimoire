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
//             nothing else) exists on one side, and the merged doc still holds a real unaided solve that could have cast it
//             (doc.js: otherwise the spell goes back to pencil). If both are written, the WHOLE record with the later
//             lastMs wins and keeps its own stability (a stability is never paired with the other record's lastMs). Raising
//             it to the other's when that one was unaided ink is NOT done: with `assisted` ORed (help is never forgotten)
//             the "was it unaided" fact is lost after one merge, so such a raise would depend on the order of merging
//             (checked by the three-way fuzz in harden.test.mjs). `assisted` is the OR of both. If one is written, that one wins (the other side's pencil marks do not erase
//             ink; its "assisted" mark is kept). If neither is written, the result is not written (never invent ink);
//             introduced languages are joined and a demonstration stays a demonstration. Forms follow the same rule.
//  home       a pure TOTAL ORDER on the home itself, so the result never depends on argument order or grouping: the home
//             with the higher purchase counter `seq` wins, ties go to the stable canonical text of its items (the stamp is
//             the home's own content, so it travels inside the merged doc with no extra field). The balance is carried as
//             "slack" = balance minus what that side's solves earned (what it had spent), and the merged balance is the
//             winner's slack (the best among exact ties) plus what the merged solves earned, floored at 0. So each solve is
//             paid once however the devices are merged, and a purchase made on the losing device is set aside with its
//             money returned (a notice says so). PURCHASES ARE NEVER DELETED because merged earnings fell (the earliest
//             solve of a card earns, so a guided first solve on one device can cancel a later clean one on another):
//             the items are kept, the balance is floored at 0, and a notice says so. doc.js bounds the items by what the
//             solves could have earned, so a forged home still cannot mint furniture.
//             (Corner: a side in debt that had also SOLD furniture lost the half-price loss from its slack, so its balance can come
//             out a little higher than a different merge order would give; it never exceeds earnings minus the worth owned.)
//             KNOWN LIMIT: when merged earnings fall below what a side had spent, the balance floors at 0 and the exact slack is
//             lost; a later merge in a different grouping can then give a different balance (always between 0 and earned minus
//             the worth owned, so never minted). Everything else, and the balance whenever the floor is not engaged, is
//             order-independent (fuzzed in harden.test.mjs).
//  updatedAt  the later of the two (a stamp only; it decides nothing).
//  A card marked "worked" (help recorded on the CARD) can still have its first solve unaided and paid when that solve was
//  made before the help was taken, on another device: the credit belongs to the solve and the help to the card, exactly
//  as on one device where a replay after the solve can raise the card's help. That is acceptable: the credit was earned
//  clean at the time, and no later help ever raises or repeats it.
//  KNOWN LIMITS (self-attested saves, documented rather than hidden):
//   (a) the pace cap (DAILY_CAP new concepts a day) only truncates days[date]; it is NOT enforced on solves. What a forged save
//       can claim is bounded instead by the finite ladder: at most one earning solve per card, so at most 14 evidence cards
//       x 40 = 560 pounds in all.
//   (b) two solves of one card with the same atMs and the same practice flag are the same solve and collapse to the worst help
//       (a re-sync of one solve must not count twice). That makes the merge order-dependent only for forged saves with
//       colliding timestamps (a 0.3% corner in the fuzz, unreachable by real play, whose clock never repeats a card's time).
//   (c) spell ink is backed by existence facts (see doc.js), so a save that really did solve the tickets cannot be told from
//       one that merely lists them: the gate stops spells with no solve behind them, not a forged solve.
//  Notices: mergeDetailed() returns { doc, notices[] }; mergeSaves() returns just the doc.
import { cleanLife, CREDIT } from '../play/progress.js';
import { earnedOf, priceOf } from '../play/home-rules.js';
import { cleanSpellRecord } from '../play/spells.js';
import { checkDoc, canon, solveOrder } from './doc.js';

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
    const k = `${s.card}\u0000${s.atMs}|${s.practice ? 1 : 0}`, o = byKey.get(k);
    byKey.set(k, !o ? { ...s } : {
      ...o, help: worse(o.help, s.help), unaided: o.unaided && s.unaided, practice: o.practice || s.practice,
      xp: Math.min(o.xp, s.xp), lang: o.lang < s.lang ? o.lang : s.lang,
    });
  }
  const all = [...byKey.values()].sort(solveOrder);
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
const ahead = (x, y) => (x.lastMs !== y.lastMs ? (x.lastMs > y.lastMs ? x : y) : x.stability !== y.stability ? (x.stability > y.stability ? x : y) : byText({ ...x, assisted: 0 }, { ...y, assisted: 0 }) >= 0 ? x : y);
function mergeForm(x, y) {
  if (!x || !y) return { ...(x || y) };
  if (x.written && y.written) return { ...ahead(x, y), written: true };
  if (x.written) return { ...x };
  if (y.written) return { ...y };
  return { written: false, lastMs: latest(x.lastMs, y.lastMs), stability: Math.max(x.stability, y.stability) };
}
// a form can only be written inside a record that is written: ink never appears on a pencil page
const normRec = (r) => { if (r.written) return r; const c = structuredClone(r); for (const f of Object.values(c.forms)) f.written = false; return c; };
function mergeRec(x0, y0) {
  if (!x0 || !y0) return structuredClone(x0 || y0);
  const x = normRec(x0), y = normRec(y0);
  const assisted = x.assisted || y.assisted;
  let out;
  if (x.written && y.written) {
    out = { ...ahead(x, y), written: true, assisted };
  } else if (x.written) out = { ...x, assisted };
  else if (y.written) out = { ...y, assisted };
  else out = { written: false, demo: x.demo || y.demo, assisted, lastMs: latest(x.lastMs, y.lastMs), stability: Math.max(x.stability, y.stability) };
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

// ---- home: a total order on (seq, items); the balance travels as slack
const homeKey = (h) => canon(h.items);
const worthOf = (items) => items.reduce((n, it) => n + (it.starter ? 0 : priceOf(it.id)), 0);
const boughtIds = (h) => h.items.filter((i) => !i.starter).map((i) => i.id).sort();
function pickHome(sides) {
  let best = [];
  for (const s of sides) {
    const h = s.life.home;
    let c = 1;
    if (best.length) { const g = best[0].life.home; c = h.seq - g.seq || (homeKey(h) < homeKey(g) ? -1 : homeKey(h) > homeKey(g) ? 1 : 0); }
    if (c > 0) best = [s]; else if (c === 0) best.push(s);
  }
  return best;
}

export const NOTICE_SPENT = 'Your fix on another device had earned money earlier; your purchases were kept.';
export const NOTICE_SET_ASIDE = 'A purchase made on your other device was set aside, and its money returned.';

export function mergeDetailed(a, b, { now } = {}) {
  const ra = a == null ? null : checkDoc(a, { now }), rb = b == null ? null : checkDoc(b, { now });
  const A = ra?.ok ? ra.doc : null, B = rb?.ok ? rb.doc : null;
  const notices = [...(ra?.ok ? ra.notices : []), ...(rb?.ok ? rb.notices : [])];
  if (!A || !B) return { doc: structuredClone(A || B || null), notices: [...new Set(notices)] };
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
  const earned = earnedOf(cleanLife({ ...life, home: null }, 0).solves); // what the merged solves earn, by the table
  const winners = pickHome([{ life: la }, { life: lb }]);
  // slack = what the side had spent. A side that is IN DEBT (it owns more than its solves earned, which a merge can cause) has
  // balance 0 and lost the exact figure, so its slack is taken as minus the worth of what it owns: the same figure whichever way
  // the merges were grouped.
  const slackOf = (l) => { const e = earnedOf(l.solves), w = worthOf(l.home.items); return e >= w ? l.home.balance - e : -w; };
  const slack = Math.max(...winners.map((s) => slackOf(s.life)));
  life.home = { ...structuredClone(winners[0].life.home), balance: Math.max(0, slack + earned) };

  const r = checkDoc({ schema: 1, updatedAt: Math.max(A.updatedAt, B.updatedAt), siso: { life, spells: mergeSpells(A.siso.spells, B.siso.spells) } }, { now });
  if (!r.ok) return { doc: structuredClone(A), notices: [...new Set(notices)] }; // cannot happen for valid inputs; never return something unchecked
  if (worthOf(r.doc.siso.life.home.items) > earnedOf(r.doc.siso.life.solves)) notices.push(NOTICE_SPENT);
  const kept = boughtIds(r.doc.siso.life.home);
  for (const l of [la, lb]) {
    const mine = [...kept];
    const lost = boughtIds(l.home).some((id) => { const k = mine.indexOf(id); if (k < 0) return true; mine.splice(k, 1); return false; });
    if (lost) { notices.push(NOTICE_SET_ASIDE); break; }
  }
  return { doc: r.doc, notices: [...new Set([...notices, ...r.notices])] };
}

export const mergeSaves = (a, b, opts) => mergeDetailed(a, b, opts).doc;
