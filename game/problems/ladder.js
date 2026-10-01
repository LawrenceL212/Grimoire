// ladder.js: the opening chapter of the SISO world, in the order it is served (learning design, section 8):
// the first-day tutorial, the on-ramp O1-O5, the SQL foothold T01-T17, the JavaScript and PHP on-ramp O6-O8,
// the Act 1 checkpoint T18, then T19 (overlap) and T21, the double-booking ticket, where its prerequisites
// are met. (The design's JavaScript and PHP tickets T05, T09, T12, T07, T15 and T20 come in the next chapter;
// this chapter is SQL first, with the other two languages' first steps.)
//
//   TUTORIAL, LADDER (cards in order), cardById(id), indexOf(id)
//   checkLadder(ladder = LADDER, tutorial = TUTORIAL) -> [problems]   pure: every card is valid; no card uses a
//       concept before the card that teaches it; one new idea per card; needs come earlier; serve order holds;
//       each preview of the tutorial is taught later by a card; the double-booking ticket is not first
//   DAILY_CAP: at most 5 new concepts per calendar day (the pace rule, section 5)
import { TUTORIAL } from './chapter1/tutorial.js';
import { O1, O2, O3, O4, O5 } from './chapter1/onramp.js';
import { T01, T02, T03, T04, T06, T08, T10, T11, T13, T14, T16, T17 } from './chapter1/sql-foothold.js';
import { O6, O7, O8, T18, T19, T21 } from './chapter1/later.js';
import { validateCard } from './card.js';

export { TUTORIAL };
export const DAILY_CAP = 5;
export const LADDER = Object.freeze([O1, O2, O3, O4, O5, T01, T02, T03, T04, T06, T08, T10, T11, T13, T14, T16, T17, O6, O7, O8, T18, T19, T21]);
export const cardById = (id) => LADDER.find((c) => c.id === id) || null;
export const indexOf = (id) => LADDER.findIndex((c) => c.id === id);

export function checkLadder(ladder = LADDER, tutorial = TUTORIAL) {
  const bad = [];
  const taught = new Set(tutorial?.teaches || []);
  const seen = new Set();
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
    seen.add(c.id);
  }
  for (const p of tutorial?.previews || []) {
    if (!ladder.some((c) => (c.teaches || []).includes(p) || (c.spells?.teach || []).includes(p))) bad.push(`tutorial: previews ${p}, which no card goes on to teach`);
  }
  const db = ladder.findIndex((c) => c.reskinOf === 'double-booking-1');
  if (db <= 0) bad.push('the double-booking ticket must be in the chapter, and not first');
  return bad;
}
