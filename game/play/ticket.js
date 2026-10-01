// ticket.js: the words of ticket #1 (double-booking-1) as Bea writes them, and what the page says back
// after a run. Pure. Every sentence after a run is built from the real diff and the real grade: it says
// what the code did, never what it should have done.
//
//   TICKET = { id, number, from, symptom }                 the ticket as it arrives: a symptom, not an instruction
//   outcome({ events, grade, before, after, lang, xp }) -> { resolved, reply, recap: [line, line], credit, note }
//     resolved   the grade passed
//     reply      Bea's answer when resolved (about what really happened to her booking), else ''
//     recap      two lines: what you just did, and what a double booking is (resolved only)
//     credit     the XP line (resolved only): +10 on the first clean solve, else why not
//     note       when not resolved: what is still wrong, in plain words (from the failed checks and the diff)
import { when, roomName } from './story.js';

export const TICKET = {
  id: 'double-booking-1',
  number: 1,
  from: 'Bea',
  who: 'Bea · booked Room 1',
  symptom: "I booked Room 1 for 08:30 and someone's already sitting there! Can you sort it out?",
};
const BEA = 21; // Bea's booking: the newer one (the setup of double-booking-1)
const LANG = { sql: 'SQL', js: 'JavaScript', php: 'PHP' };

function whatHappened(events, before, after) {
  const mine = events.find((e) => e.bookingId === BEA && e.type.startsWith('booking-'));
  if (!mine) return null;
  if (mine.type === 'booking-removed') return { kind: 'removed' };
  if (mine.type === 'booking-moved') return { kind: 'moved', room: roomName(after, mine.toRoomId), at: when(mine.to.start_at), retimed: Date.parse(mine.from.start_at) !== Date.parse(mine.to.start_at) };
  if (mine.type === 'booking-retimed') return { kind: 'retimed', room: roomName(after, mine.roomId), at: when(mine.to.start_at) };
  return null;
}

export function outcome({ events = [], grade, before, after, lang = 'sql', xp = 0 }) {
  const using = LANG[lang] || lang;
  if (grade?.passed) {
    const h = whatHappened(events, before, after);
    let reply, did;
    if (h?.kind === 'removed') {
      reply = "Oh, so mine was the one that clashed. Fair enough, the 08:00 was there first. I'll book another slot. Thanks!";
      did = `You cancelled the newer booking (${BEA}) with ${using} and left the earlier one alone.`;
    } else if (h?.kind === 'moved') {
      reply = `${h.room}${h.retimed ? ` on ${h.at}` : ''}? Perfect, I'll head there. Thank you!`;
      did = `You moved the newer booking (${BEA}) to ${h.room}${h.retimed ? `, ${h.at}` : ''} with ${using} and left the earlier one alone.`;
    } else if (h?.kind === 'retimed') {
      reply = `${h.at} in ${h.room} then. That works for me, thank you!`;
      did = `You moved the newer booking (${BEA}) to ${h.at} with ${using} and left the earlier one alone.`;
    } else {
      reply = 'The room is mine now, nobody in my chair. Thank you!';
      did = `You changed the timetable with ${using} so the two bookings no longer overlap.`;
    }
    return {
      resolved: true, reply,
      recap: [did, 'A double booking is two bookings for one room whose times overlap: one starts before the other ends.'],
      credit: xp > 0 ? `+${xp} XP: your first clean solve of this ticket.` : 'No XP this time: this ticket was already solved once. The fix still counts for Bea.',
      note: '',
    };
  }
  const failed = (grade?.results || []).filter((r) => !r.ok);
  const bits = [];
  for (const r of failed) {
    if (/double-booked/.test(r.name)) {
      const started = events.filter((e) => e.type === 'clash-started').map((e) => roomName(after, e.roomId));
      const rooms = [...new Set(started)];
      const n = Number(r.detail);
      if (rooms.length) bits.push(`${rooms.join(' and ')} ${rooms.length > 1 ? 'are' : 'is'} double-booked now.`);
      else bits.push(Number.isFinite(n) && n > 1 ? `${n} pairs of bookings still overlap.` : 'Two bookings in one room still overlap.');
    } else if (/untouched/.test(r.name)) {
      const n = Number(r.detail);
      bits.push(Number.isFinite(n) ? `Only ${n} of the 20 bookings that were there first are still there, and those customers will be upset.` : 'Some of the bookings that were there first have gone.');
    } else {
      bits.push(`${r.name}: not yet.`);
    }
  }
  return { resolved: false, reply: '', recap: [], credit: '', note: bits.join(' ') || 'The ticket is still open.' };
}
