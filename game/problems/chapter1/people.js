// The people who send the opening chapter's tickets (learning design, section 6, Act 1).
export const PRIYA = { name: 'Priya Shah', role: 'co-founder', sector: 'head office' };
export const SAM = { name: 'Sam Fletcher', role: 'manager, Harbour Street Co-working (pilot client)', sector: 'co-working' };
export const TOM = { name: 'Tom Okafor', role: 'support (just joined)', sector: 'head office' };
export const ALL_STAGES = ['boardroom10', 'garden', 'samFridayGone'];
// the overlap rule of the Phase 1 double-booking card (check.js NO_OVERLAP_SQL)
export const NO_OVERLAP = `SELECT count(*)::int AS n FROM bookings a JOIN bookings b
  ON a.room_id = b.room_id AND a.id < b.id AND a.start_at < b.end_at AND b.start_at < a.end_at`;
