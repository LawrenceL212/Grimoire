// ladder.js: the opening chapter of the SISO world, in the order it is served. Since the product arc (milestone
// M-A) it starts from an EMPTY company: the first-day tutorial (part 1, on Priya's paper notebook), S0 (O1, O2 on
// the notebook), S1 (his rooms table) and S2 (his three rooms), the tutorial's part 2 on his rooms; then the
// on-ramp O3-O5, the SQL foothold T01-T17, the JavaScript and PHP on-ramp O6-O8, the Act 1 checkpoint T18, then
// T19 (overlap) and T21, the double-booking ticket. (Until milestone M-B re-hosts them, the cards after S2 still
// start from the named seeded world, world/named.js.) T06 (insert) is retired: its idea moved to S2.
//
//   TUTORIAL, LADDER (cards in order), cardById(id), indexOf(id), RETIRED (cards no longer served, by id)
//   checkLadder(ladder = LADDER, tutorial = TUTORIAL) -> [problems]   pure: every card is valid; no card uses a
//       concept before the card that teaches it; one new idea per card; needs come earlier; serve order holds;
//       each preview of the tutorial is taught later by a card; the double-booking ticket is not first; every
//       table a schema or probe check reads was created by that card or an earlier one
//   heldConcept(card, solvedIds) -> bool   the card's new idea was already learnt on a retired card (an old life)
//   DAILY_CAP: at most 5 new concepts per calendar day (the pace rule, section 5)
import { TUTORIAL, PART2_START } from './chapter1/tutorial.js';
import { O3, O4, O5 } from './chapter1/onramp.js';
import { T01, T02, T03, T04, T06, T08, T10, T11, T13, T14, T16, T17 } from './chapter1/sql-foothold.js';
import { O6, O7, O8, T18, T19, T21 } from './chapter1/later.js';
import { O1, O2 } from './arc/s0.js';
import { S1 } from './arc/s1.js';
import { S2 } from './arc/s2.js';
import { validateCard } from './card.js';

export { TUTORIAL, PART2_START };
export const DAILY_CAP = 5;
// the serve number is the ticket's place in this order (shown as TICKET #n)
export const LADDER = Object.freeze([O1, O2, S1, S2, O3, O4, O5, T01, T02, T03, T04, T08, T10, T11, T13, T14, T16, T17, O6, O7, O8, T18, T19, T21]
  .map((c, i) => Object.freeze({ ...c, serve: i + 1, position: `#${i + 1}` })));
export const RETIRED = Object.freeze({ T06 });
export const cardById = (id) => LADDER.find((c) => c.id === id) || null;
export const indexOf = (id) => LADDER.findIndex((c) => c.id === id);
export function heldConcept(card, solved) {
  const idea = card?.teaches?.[0];
  return !!idea && Object.values(RETIRED).some((r) => r.teaches?.includes(idea) && solved.has(r.id));
}

const tablesRead = (c) => (c.steps || []).flatMap((s) => (s.on === 'pad' ? [] : s.checks || [])).filter((k) => k.kind === 'schema' || k.kind === 'probe').map((k) => k.table);
export function checkLadder(ladder = LADDER, tutorial = TUTORIAL) {
  const bad = [];
  const taught = new Set(tutorial?.teaches || []);
  const seen = new Set();
  const made = new Set();
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
    seen.add(c.id);
  }
  for (const p of tutorial?.previews || []) {
    if (!ladder.some((c) => (c.teaches || []).includes(p) || (c.spells?.teach || []).includes(p))) bad.push(`tutorial: previews ${p}, which no card goes on to teach`);
  }
  if (tutorial?.part2After && !ladder.some((c) => c.id === tutorial.part2After)) bad.push(`tutorial: part 2 waits for ${tutorial.part2After}, which is not in the chapter`);
  const db = ladder.findIndex((c) => c.reskinOf === 'double-booking-1');
  if (db <= 0) bad.push('the double-booking ticket must be in the chapter, and not first');
  return bad;
}
