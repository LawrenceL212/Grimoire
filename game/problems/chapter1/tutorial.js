// The first-day tutorial, guided by Sequel (the SQL drone). It teaches HOW TO PLAY and HOW TO LEARN in the
// same steps: the business is its data, tickets are symptoms, a query shown before it is typed, a one-word
// change, the hint ladder and its honest cost, the Grimoire (a spell is written only when cast unaided), and
// the forgetting meter. Each step can be skipped; the tutorial as a whole cannot, on the first play.
//
// Re-hosted for the product arc (S0): the company starts EMPTY, so the tutorial comes in two parts. Part 1
// (before the notebook tickets) happens on Priya's paper notebook: there is no database to query yet. Part 2
// (after S2) happens on HIS rooms table, the first data the company has: the query he is shown asks for his own
// rooms. Part 2 never changes his world (its runs are rolled back). Its ids are his: {room:Boardroom} is the id his
// own Boardroom got (card.js resolveCard), so a table whose rows were put in twice and fixed still reads true.
//
// It is ladder data too: it teaches how to play (play-* concepts, not counted toward the day's cap) and
// PREVIEWS three SQL ideas (a whole table, a row, and WHERE) that the cards then teach properly.
import { PRIYA } from './people.js';

export const TUTORIAL = {
  id: 'tutorial', serve: 0, title: 'Your first day', world: { stage: [], arc: true },
  teaches: ['play-world', 'play-ticket', 'play-run', 'play-hints', 'play-grimoire', 'play-meter'],
  previews: ['table-row', 'select-all', 'where'], uses: [], newConcept: 0,
  ticket: { from: PRIYA, says: "This is everything we've got: three rooms and the bookings, in my notebook. Sam wants to try us. Can the computer hold this?" },
  // part 2 opens once this card is solved (his rooms exist)
  part2After: 'S2',
  ticket2: { from: PRIYA, says: 'The rooms are in the computer now. Can it show me them?' },
  steps: [
    { id: 'hello', part: 1, task: 'company', say: "Hello, I'm Sequel. I speak SQL, the language of databases. This is your company: a desk, Priya's notebook, and nothing else yet. Every table and row it will ever have, you will make. First, what is it called?" },
    { id: 'world', part: 1, task: 'pick', say: "Right now the whole business is this notebook. Each line on its Bookings page is one booking. Click any line of the notebook to look at it." },
    { id: 'ticket', part: 1, task: 'read', say: "Work arrives as tickets. People tell you what they need, not what to type: that's a symptom, or a goal. Read Priya's ticket, then press I've read it." },
    { id: 'hints', part: 1, task: 'hint', say: "Stuck is normal. The hint ladder has four steps: a nudge, which idea, the Grimoire page, a worked example. Each costs some of the ticket's credit, and I always show the cost before you open one. Open the first hint now, on purpose." },
    { id: 'query', part: 2, task: 'run', lang: 'sql', starter: 'SELECT * FROM rooms;',
      say: "Your rooms are in a real database now, so we can ask it. Here is a question in SQL, typed for you: SELECT means show, * every column, FROM rooms your table, and ; ends it. Press Run.",
      checks: [{ kind: 'rows', truth: 'SELECT * FROM rooms', exactColumns: true }] },
    { id: 'change', part: 2, task: 'run', lang: 'sql', starter: 'SELECT * FROM rooms WHERE id = {room:Boardroom};',
      say: "This one keeps only the room whose id is {room:Boardroom}, your Boardroom (WHERE picks rows; you'll learn it properly soon). Your Studio's id is {room:Studio}: change the {room:Boardroom} to a {room:Studio}, one word, and run it.",
      checks: [{ kind: 'rows', truth: 'SELECT * FROM rooms WHERE id = {room:Studio}', exactColumns: true }] },
    { id: 'grimoire', part: 2, task: 'run', lang: 'sql', starter: '', recall: ['select-all'],
      say: "This is the Grimoire: your book of spells. A spell you've only seen is in pencil. It is written in ink only when you cast it on your own, in a real ticket. Here is a demonstration: with an empty editor and no help, show every room again.",
      checks: [{ kind: 'rows', truth: 'SELECT * FROM rooms', exactColumns: true }] },
    { id: 'meter', part: 2, task: 'read', say: "Ink fades. Easy today is not the same as kept: a spell sticks when you remember it again after a gap, when it is nearly forgotten. That one was a demonstration; spells you cast on your own in tickets are written for real, and the meter on each page shows how their ink is holding (reviews arrive in the next update). That's everything: your next ticket is here." },
  ],
};
export const PART2_START = TUTORIAL.steps.findIndex((s) => s.part === 2);
