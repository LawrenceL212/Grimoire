// The first-day tutorial, guided by Sequel (the SQL drone). It teaches HOW TO PLAY and HOW TO LEARN in the
// same steps: the world is the database, tickets are symptoms, a query shown before it is typed, a one-word
// change, the hint ladder and its honest cost, the Grimoire (a spell is written only when cast unaided), and
// the forgetting meter. Each step can be skipped; the tutorial as a whole cannot, on the first play.
//
// It is ladder data too: it teaches how to play (play-* concepts, not counted toward the day's cap) and
// PREVIEWS two SQL ideas (a whole table, and WHERE) that the on-ramp and T03 then teach properly.
import { PRIYA } from './people.js';

export const TUTORIAL = {
  id: 'tutorial', serve: 0, title: 'Your first day', world: { stage: [] },
  teaches: ['play-world', 'play-ticket', 'play-run', 'play-hints', 'play-grimoire', 'play-meter'],
  previews: ['table-row', 'select-all', 'where'], uses: [], newConcept: 0,
  ticket: { from: PRIYA, says: 'Can you show me everything that is booked? I want to see the whole week.' },
  steps: [
    { id: 'hello', say: "Hello, I'm Sequel. I speak SQL, the language of the database. Today I'll show you how to play, and how to learn. Nothing here can break." },
    { id: 'world', task: 'pick', say: 'This office IS the database. Every person in a room is a booking: one row of the bookings table. Click someone sitting in a room (or a block on the timetable) to see their row.' },
    { id: 'ticket', task: 'read', say: "Work arrives as tickets. People tell you what they see, not what to type. That's a symptom. Read Priya's ticket, then press I've read it." },
    { id: 'query', task: 'run', lang: 'sql', starter: 'SELECT * FROM bookings;',
      say: "Here is her question in SQL, typed for you. SELECT means show, * every column, FROM bookings the table, and ; ends it. Press Run and watch the bookings light up.",
      checks: [{ kind: 'rows', truth: 'SELECT * FROM bookings', exactColumns: true }] },
    { id: 'change', task: 'run', lang: 'sql', starter: 'SELECT * FROM bookings WHERE room_id = 1;',
      say: "This one keeps only room 1's bookings (WHERE picks rows; you'll learn it properly soon). Change the 1 to a 2, one word, and run it: the Studio's bookings light up.",
      checks: [{ kind: 'rows', truth: 'SELECT * FROM bookings WHERE room_id = 2', exactColumns: true }] },
    { id: 'hints', task: 'hint', say: "Stuck is normal. The hint ladder has four steps: a nudge, which idea, the Grimoire page, a worked example. Each costs some of the ticket's credit, and I always show the cost before you open one. Open the first hint now, on purpose." },
    { id: 'grimoire', task: 'run', lang: 'sql', starter: '', recall: ['select-all'],
      say: "This is the Grimoire: your book of spells. A spell you've only seen is in pencil. It is written in ink only when you cast it on your own, in a real ticket. Here is a demonstration: with an empty editor and no help, show everyone in the people table.",
      checks: [{ kind: 'rows', truth: 'SELECT * FROM people', exactColumns: true }] },
    { id: 'meter', task: 'read', say: "Ink fades. Easy today is not the same as kept: a spell sticks when you remember it again after a gap, when it is nearly forgotten. That one was a demonstration; spells you cast on your own in tickets are written for real, and the meter on each page shows how their ink is holding (reviews arrive in the next update). That's everything: your first ticket is here." },
  ],
};
