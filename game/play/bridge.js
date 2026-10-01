// bridge.js: what the learner's code really changed. Pure: two snapshots of the world (views.js
// toObjects, before and after a run) in, a list of scene events out. The office acts out exactly this
// list and nothing else (never the expected answer).
//
//   diffWorlds(before, after) -> [event]
//     { type: 'booking-removed', bookingId, roomId }                   roomId: where it was
//     { type: 'booking-moved',   bookingId, roomId, fromRoomId, toRoomId, from, to }   the room changed
//                                                                       (from/to: { start_at, end_at }, the
//                                                                       times may have changed as well)
//     { type: 'booking-retimed', bookingId, roomId, from, to }         same room, other times
//     { type: 'booking-added',   bookingId, roomId }
//     { type: 'clash-cleared',   bookingId, otherId, roomId }          a pair (bookingId < otherId) that
//     { type: 'clash-started',   bookingId, otherId, roomId }          overlapped before and not after, or
//                                                                       the other way round
//   The order is fixed: removed, moved, retimed, added (each by booking id), then cleared, started (by
//   pair). The booking changes come first and their consequences (a room calming, a room clashing) after.
//   A change of person on a booking is not a scene event (who sits there is redrawn when the story ends).
//
//   overlaps(a, b)          the NO_OVERLAP_SQL rule: same room, a.start < b.end and b.start < a.end
//   clashPairs(bookings)    [{ a, b, roomId }] every overlapping pair, a < b, sorted
//   rowChanges(before, after) -> [{ table, added, removed, changed }]   every table, every column (only the
//                           tables with a change): what decides "the world did not change", since a
//                           change the scene has no event for (a person's name, a booking's person, a
//                           room's name) is still a change
//   describeRows(changes) -> '1 row in people changed' (plain words, for the code window)
const ms = (iso) => Date.parse(iso);

export function overlaps(a, b) {
  return a.id !== b.id && a.room_id === b.room_id && ms(a.start_at) < ms(b.end_at) && ms(b.start_at) < ms(a.end_at);
}

export function clashPairs(bookings = []) {
  const list = [...bookings].sort((x, y) => x.id - y.id);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (overlaps(list[i], list[j])) out.push({ a: list[i].id, b: list[j].id, roomId: list[i].room_id });
    }
  }
  return out;
}

const times = (b) => ({ start_at: b.start_at, end_at: b.end_at });
const sameTimes = (x, y) => ms(x.start_at) === ms(y.start_at) && ms(x.end_at) === ms(y.end_at);
const byId = (x, y) => x.bookingId - y.bookingId;

export function diffWorlds(before, after) {
  const was = new Map((before?.bookings || []).map((b) => [b.id, b]));
  const now = new Map((after?.bookings || []).map((b) => [b.id, b]));
  const removed = [], moved = [], retimed = [], added = [];
  for (const [id, b] of was) {
    const n = now.get(id);
    if (!n) { removed.push({ type: 'booking-removed', bookingId: id, roomId: b.room_id }); continue; }
    if (n.room_id !== b.room_id) {
      moved.push({ type: 'booking-moved', bookingId: id, roomId: n.room_id, fromRoomId: b.room_id, toRoomId: n.room_id, from: times(b), to: times(n) });
    } else if (!sameTimes(b, n)) {
      retimed.push({ type: 'booking-retimed', bookingId: id, roomId: n.room_id, from: times(b), to: times(n) });
    }
  }
  for (const [id, n] of now) if (!was.has(id)) added.push({ type: 'booking-added', bookingId: id, roomId: n.room_id });

  const key = (p) => `${p.a}-${p.b}@${p.roomId}`;
  const pairsBefore = clashPairs([...was.values()]), pairsAfter = clashPairs([...now.values()]);
  const keysBefore = new Set(pairsBefore.map(key)), keysAfter = new Set(pairsAfter.map(key));
  const clash = (type) => (p) => ({ type, bookingId: p.a, otherId: p.b, roomId: p.roomId });
  const cleared = pairsBefore.filter((p) => !keysAfter.has(key(p))).map(clash('clash-cleared'));
  const started = pairsAfter.filter((p) => !keysBefore.has(key(p))).map(clash('clash-started'));

  return [...removed.sort(byId), ...moved.sort(byId), ...retimed.sort(byId), ...added.sort(byId), ...cleared, ...started];
}

const TABLES = ['rooms', 'people', 'bookings'];
const same = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = a[k], y = b[k];
    if (x === y) continue;
    if ((k === 'start_at' || k === 'end_at') && ms(x) === ms(y)) continue;
    if (String(x) !== String(y)) return false;
  }
  return true;
};
export function rowChanges(before, after) {
  const out = [];
  for (const table of TABLES) {
    const was = new Map((before?.[table] || []).map((r) => [r.id, r]));
    const now = new Map((after?.[table] || []).map((r) => [r.id, r]));
    let added = 0, removed = 0, changed = 0;
    for (const [id, r] of was) { const n = now.get(id); if (!n) removed++; else if (!same(r, n)) changed++; }
    for (const id of now.keys()) if (!was.has(id)) added++;
    if (added || removed || changed) out.push({ table, added, removed, changed });
  }
  return out;
}
// the ids of the rows in one table that exist before and after but differ in ANY column (not only the ones the diff events watch)
export function changedIds(before, after, table) {
  const now = new Map((after?.[table] || []).map((r) => [r.id, r]));
  return (before?.[table] || []).filter((r) => now.has(r.id) && !same(r, now.get(r.id))).map((r) => r.id);
}
export function describeRows(changes) {
  const parts = [];
  for (const c of changes) {
    for (const [n, verb] of [[c.changed, 'changed'], [c.added, 'added'], [c.removed, 'removed']]) {
      if (n) parts.push(`${n} row${n === 1 ? '' : 's'} in ${c.table} ${verb}`);
    }
  }
  return parts.join(', ');
}
