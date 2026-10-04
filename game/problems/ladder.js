// ladder.js: the opening chapter of the SISO world, in the order it is served. Since the product arc it starts
// from an EMPTY company: the first-day tutorial (part 1, on Priya's paper notebook), S0 (O1, O2 on the notebook),
// S1 (his rooms table) and S2 (his three rooms), the tutorial's part 2 on his rooms; then S3 (milestone M-B): the
// on-ramp O3-O5 and the SQL foothold T01-T04, G1 (the Garden Room, which he types in), T08, T10 and T11, all on
// HIS rooms table (templated by his column and row names, card.js resolveCard). After them the cards that need
// people and bookings (T13-T17, O6-O8, T18, T19, T21) still start from the named seeded world (world/named.js)
// until milestone M-C has him build those tables (S4-S6). T06 (insert) is retired: its idea moved to S2, its
// Garden Room to G1.
//
//   TUTORIAL, LADDER (cards in order), cardById(id), indexOf(id), RETIRED (cards no longer served, by id)
//   checkLadder(ladder = LADDER, tutorial = TUTORIAL) -> [problems]   pure: every card is valid; no card uses a
//       concept before the card that teaches it; one new idea per card; needs come earlier; serve order holds;
//       each preview of the tutorial is taught later by a card; the double-booking ticket is not first; and, for
//       his company (world.arc): every table a schema or probe check reads was created by that card or an earlier
//       one; no SQL that must run on his world (a truth, a check, a reference, an example marked on: 'company')
//       reads a table no earlier card had him create; every room a template names ({room:Boardroom}) was put in
//       by an earlier card; examples and steps on Sequel's practice pad read only the pad's tables (or ones they
//       make themselves); the tutorial's part 2 reads only what exists when it opens
//   heldConcept(card, solvedIds) -> bool   the card's new idea was already learnt on a retired card (an old life)
//   DAILY_CAP: at most 5 new concepts per calendar day (the pace rule, section 5)
import { TUTORIAL, PART2_START } from './chapter1/tutorial.js';
import { O3, O4, O5 } from './chapter1/onramp.js';
import { T01, T02, T03, T04, T06, T08, T10, T11, T13, T14, T16, T17 } from './chapter1/sql-foothold.js';
import { O6, O7, O8, T18, T19, T21 } from './chapter1/later.js';
import { O1, O2 } from './arc/s0.js';
import { S1 } from './arc/s1.js';
import { S2 } from './arc/s2.js';
import { G1 } from './arc/s3.js';
import { validateCard, templatesOf, tablesIn, PAD_TABLES } from './card.js';

export { TUTORIAL, PART2_START };
export const DAILY_CAP = 5;
// the serve number is the ticket's place in this order (shown as TICKET #n)
export const LADDER = Object.freeze([O1, O2, S1, S2, O3, O4, O5, T01, T02, T03, T04, G1, T08, T10, T11, T13, T14, T16, T17, O6, O7, O8, T18, T19, T21]
  .map((c, i) => Object.freeze({ ...c, serve: i + 1, position: `#${i + 1}` })));
export const RETIRED = Object.freeze({ T06 });
export const cardById = (id) => LADDER.find((c) => c.id === id) || null;
export const indexOf = (id) => LADDER.findIndex((c) => c.id === id);
export function heldConcept(card, solved) {
  const idea = card?.teaches?.[0];
  return !!idea && Object.values(RETIRED).some((r) => r.teaches?.includes(idea) && solved.has(r.id));
}

const tablesRead = (c) => (c.steps || []).flatMap((s) => (s.on === 'pad' ? [] : s.checks || [])).filter((k) => k.kind === 'schema' || k.kind === 'probe').map((k) => k.table);
/* The SQL of a card, split by where it runs: on his company (truths, checks, references) or on the pad. Starters
   are left out (a starter is text to change, and may name the wrong table on purpose: T01's one-word change), and
   so are cheats (they are meant to fail). */
function sqlOf(c) {
  const his = [], pad = [];
  const isSql = (lang) => !lang || lang === 'sql';
  for (const [i, s] of (c.steps || []).entries()) {
    const where = s.on === 'pad' ? pad : his;
    if (!isSql(s.lang || c.languages?.[0]) && !s.interaction) continue;
    for (const k of s.checks || []) if (k.kind !== 'schema' && k.kind !== 'probe') for (const q of [k.truth, k.sql]) if (q) where.push(q);
    for (const r of c.reference || []) if ((r.step ?? c.steps.length - 1) === i && r.code && isSql(r.lang)) where.push(r.code);
  }
  for (const ex of [c.learnCard?.example, c.workedExample]) if (ex?.code && isSql(ex.lang)) (ex.on === 'company' ? his : pad).push(ex.code);
  return { his, pad };
}
export function checkLadder(ladder = LADDER, tutorial = TUTORIAL) {
  const bad = [];
  const taught = new Set(tutorial?.teaches || []);
  const seen = new Set();
  const made = new Set();
  const rows = new Set(); // rooms (by Priya's name) some card had him put in
  let serve = 0;
  for (const c of ladder) {
    bad.push(...validateCard(c));
    if (!(c.serve > serve)) bad.push(`${c.id}: served out of order (${c.serve} after ${serve})`);
    serve = c.serve;
    for (const n of c.needs || []) if (!seen.has(n)) bad.push(`${c.id}: needs ${n}, which does not come before it`);
    for (const t of c.teaches || []) if (taught.has(t)) bad.push(`${c.id}: teaches ${t}, which was already taught`);
    const now = new Set([...taught, ...(c.teaches || [])]);
    for (const u of c.uses || []) if (!now.has(u)) bad.push(`${c.id}: uses ${u} before any card teaches it`);
    for (const t of c.teaches || []) taught.add(t);
    for (const t of c.creates || []) made.add(t);
    for (const t of tablesRead(c)) if (!made.has(t)) bad.push(`${c.id}: checks the table ${t}, which no card before it (or it) creates`);
    if (c.world?.arc) {
      const { his, pad } = sqlOf(c);
      for (const q of his) for (const t of tablesIn(q).used) if (!made.has(t)) bad.push(`${c.id}: runs SQL on his company that reads the table ${t}, which he has not been asked to create yet`);
      for (const q of pad) for (const t of tablesIn(q).used) if (!PAD_TABLES.includes(t)) bad.push(`${c.id}: runs SQL on the practice pad that reads ${t}, which the pad does not have`);
      const tpl = templatesOf(c);
      for (const k of tpl.cols) if (!made.has(k.split('.')[0])) bad.push(`${c.id}: names his column {${k}} before he has made that table`);
      // a card may name a room it has him add (G1 "added twice" names the Garden Room it puts in)
      for (const r of tpl.rows) if (!rows.has(r) && !(c.adds?.rooms || []).includes(r)) bad.push(`${c.id}: needs the ${r} in his rooms table, which no earlier card had him put in`);
    }
    for (const r of c.adds?.rooms || []) rows.add(r);
    seen.add(c.id);
    if (tutorial?.part2After === c.id) {
      for (const s of tutorial.steps.filter((x) => x.part === 2)) {
        for (const q of [s.starter, ...(s.checks || []).map((k) => k.truth)]) for (const t of tablesIn(q).used) if (!made.has(t)) bad.push(`tutorial: part 2 reads the table ${t}, which does not exist when it opens`);
        for (const r of templatesOf(s).rows) if (!rows.has(r)) bad.push(`tutorial: part 2 needs the ${r} in his rooms table, which is not there when it opens`);
      }
    }
  }
  for (const p of tutorial?.previews || []) {
    if (!ladder.some((c) => (c.teaches || []).includes(p) || (c.spells?.teach || []).includes(p))) bad.push(`tutorial: previews ${p}, which no card goes on to teach`);
  }
  if (tutorial?.part2After && !ladder.some((c) => c.id === tutorial.part2After)) bad.push(`tutorial: part 2 waits for ${tutorial.part2After}, which is not in the chapter`);
  const db = ladder.findIndex((c) => c.reskinOf === 'double-booking-1');
  if (db <= 0) bad.push('the double-booking ticket must be in the chapter, and not first');
  return bad;
}
