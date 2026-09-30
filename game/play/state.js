// state.js: the company's counters, derived (never kept) from the real world, the real grade and the
// learner's history. Pure.
//
//   deriveState(worldObjects, grade, history) -> { bookings, revenue, reputation, clashes, openTickets, xp, level }
//     bookings     bookings that start on the timetable day (2026-01-01)
//     revenue      £40 for each of them
//     reputation   4.8 less 0.3 for each clashing PAIR (bridge.js clashPairs, the NO_OVERLAP_SQL rule, which
//                  also counts pairs), rounded to one place, never below 0. Pairs, not bookings: three
//                  bookings on one slot are three pairs, the number NO_OVERLAP_SQL reports.
//     openTickets  the ticket is open while its grade fails (with no grade: while any room clashes)
//     xp           10 for each ticket whose FIRST solve was clean. Re-solving a passed ticket earns nothing,
//                  and a solve that used the worked example earns nothing (and spends the ticket's credit).
//     level        1 + one for every 100 XP
//   recordSolve(history, ticket, { clean }) -> a new history with the solve added
//   creditFor(history, ticket, { clean }) -> the XP this solve would earn (10 or 0)
//   history = { solves: [{ ticket, clean }] }
import { clashPairs } from './bridge.js';

export const PRICE = 40, BASE_REPUTATION = 4.8, CLASH_COST = 0.3, XP_PER_SOLVE = 10, XP_PER_LEVEL = 100;
export const DAY = '2026-01-01';

function earned(history) {
  const first = new Map();
  for (const s of history?.solves || []) if (!first.has(s.ticket)) first.set(s.ticket, !!s.clean);
  let xp = 0;
  for (const clean of first.values()) if (clean) xp += XP_PER_SOLVE;
  return xp;
}

export function creditFor(history, ticket, { clean = true } = {}) {
  if ((history?.solves || []).some((s) => s.ticket === ticket)) return 0;
  return clean ? XP_PER_SOLVE : 0;
}

export function recordSolve(history, ticket, { clean = true } = {}) {
  return { ...history, solves: [...(history?.solves || []), { ticket, clean: !!clean }] };
}

export function deriveState(objects, grade, history) {
  const all = objects?.bookings || [];
  const bookings = all.filter((b) => String(b.start_at).slice(0, 10) === DAY).length;
  const clashes = clashPairs(all).length;
  const xp = earned(history);
  return {
    bookings,
    revenue: bookings * PRICE,
    reputation: Math.max(0, Math.round((BASE_REPUTATION - CLASH_COST * clashes) * 10) / 10),
    clashes,
    openTickets: grade ? (grade.passed ? 0 : 1) : (clashes > 0 ? 1 : 0),
    xp,
    level: 1 + Math.floor(xp / XP_PER_LEVEL),
  };
}
