// The rest of the opening chapter: the JavaScript and PHP on-ramp (O6-O8: a first program, its errors, and
// PHP asking the database), the Act 1 checkpoint (T18), then the overlap of two time ranges (T19) and the
// double-booking ticket (T21: Phase 1's double-booking-1, reskinned: Room 1 is the Boardroom), which comes
// where its prerequisites are met, not first.
import { PRIYA, SAM, TOM, ALL_STAGES, NO_OVERLAP } from './people.js';

const SEATS = 'SELECT sum(capacity) FROM rooms';

export const O6 = {
  id: 'O6', serve: 18, position: '#18', title: 'A first program', act: 1,
  from: PRIYA, says: 'Can the website work out things for itself, like how many seats we have in total?',
  kind: 'onramp', cause: 'client feature request', grading: 'one-off',
  concept: 'js-program', newConcept: 1, teaches: ['js-program'], uses: [], needs: ['T01'], revisits: ['T04', 'S2'],
  languages: ['js'], world: { stage: ALL_STAGES },
  learnCard: {
    title: 'A program and a variable',
    lines: [
      'A program is a list of instructions, run from top to bottom.',
      'A variable is a named box: const total = 8; puts 8 in a box called total.',
      'In JavaScript = only stores. (In SQL, = compared in WHERE and set a value in SET.)',
      'return total; hands the answer back.',
    ],
    example: { lang: 'js', code: 'const people = 5;\nreturn people;', note: 'Jay runs it: the answer, 5, floats over the office.' },
  },
  workedExample: { lang: 'js', code: 'const seats = 10 + 4;\nreturn seats;', note: 'A sibling: two rooms added up.' },
  hints: ['Every room\'s seats go into the sum.', 'A variable holds a value; return hands it back.', 'js-variable'],
  spells: { teach: ['js-variable'], recall: [] },
  steps: [
    { objective: 'Run your first program, and watch it answer.', level: 'L0', lang: 'js', starter: 'const seats = 10 + 4 + 6;\nreturn seats;',
      checks: [{ kind: 'return', name: 'the program answered 20', truth: 'SELECT 20' }] },
    { objective: "Add the Garden Room's 6 seats (the room you added).", level: 'L1', lang: 'js', starter: 'const seats = 10 + 4 + 6;\nreturn seats;',
      checks: [{ kind: 'return', name: 'the total of every room\'s seats', truth: SEATS }] },
  ],
  cheats: [{ name: 'the old total', step: 1, lang: 'js', code: 'return 20;' }],
  reference: [{ step: 0, lang: 'js', code: 'const seats = 10 + 4 + 6;\nreturn seats;' }, { step: 1, lang: 'js', code: 'const seats = 10 + 4 + 6 + 6;\nreturn seats;' }],
  recap: ['You stored a value in a variable and returned it.', 'The 10 is the Boardroom you corrected, the last 6 the Garden Room you added.'],
  evidence: false, timeMinutes: 2,
};

export const O7 = {
  id: 'O7', serve: 19, position: '#19', title: "'retrun is not defined'", act: 1,
  from: PRIYA, says: "The seat counter says 'retrun is not defined'. Is it broken?",
  kind: 'onramp', cause: "other people's code", grading: 'one-off',
  concept: 'js-errors', newConcept: 1, teaches: ['js-errors'], uses: ['js-program', 'read-error'], needs: ['O6', 'O4'], revisits: ['O6', 'O4'],
  languages: ['js'], world: { stage: ALL_STAGES },
  learnCard: {
    title: 'JavaScript errors',
    lines: [
      'JavaScript errors say what went wrong and where.',
      "'is not defined' means a word it doesn't know: often a typo.",
      'Capital letters matter: total and Total are different names.',
      'Same habit as in SQL: read the word it quotes.',
    ],
    example: { lang: 'js', code: 'const seats = 4;\nreturn seat;', note: '"seat is not defined": the box is called seats.' },
  },
  workedExample: { lang: 'js', code: 'const seats = 4;\nreturn seats;', note: 'The name fixed to match the box.' },
  hints: ['Look at the word the error quotes.', 'The spelling and the capital letters of a name.', 'js-variable'],
  spells: { teach: [], recall: [] },
  steps: [
    { objective: 'Read the error and fix the program (one word).', level: 'L1', lang: 'js', starter: 'const seats = 10 + 4 + 6 + 6;\nretrun(seats);',
      checks: [{ kind: 'return', name: 'it runs and returns the total', truth: SEATS }] },
    { objective: 'Another one: "Total is not defined". Fix it.', level: 'L1', lang: 'js', starter: 'const total = 10 + 4 + 6 + 6;\nreturn Total;',
      checks: [{ kind: 'return', name: 'it runs and returns the total', truth: SEATS }] },
  ],
  cheats: [{ name: 'the line deleted (nothing comes back)', step: 0, lang: 'js', code: 'const seats = 10 + 4 + 6 + 6;' }],
  reference: [{ step: 0, lang: 'js', code: 'const seats = 10 + 4 + 6 + 6;\nreturn(seats);' }, { step: 1, lang: 'js', code: 'const total = 10 + 4 + 6 + 6;\nreturn total;' }],
  recap: ['Same habit as in SQL: the error named the word, and you fixed it.', 'Spelling and capital letters are part of a name.'],
  evidence: false, timeMinutes: 2,
};

export const O8 = {
  id: 'O8', serve: 20, position: '#23', title: 'PHP asks the database', act: 1,
  from: TOM, says: 'Our website pages are PHP. Can you show me how one asks the database something?',
  kind: 'onramp', cause: 'report or question', grading: 'one-off',
  concept: 'php-query', newConcept: 1, teaches: ['php-query'], uses: ['query', 'js-program'], needs: ['O6', 'O3'], revisits: ['O3', 'O6'],
  languages: ['php'], world: { stage: ALL_STAGES },
  learnCard: {
    title: 'PHP wraps SQL',
    lines: [
      'PHP runs on the server and asks the database for data. Every variable starts with $.',
      "$pdo is the connection to the database; -> means 'use its ability': $pdo->query(\"SELECT ...\") sends SQL you already know.",
      "echo prints. A dot joins text: 'People: ' . $n (in JavaScript . meant 'the part called'; here it glues).",
      "count(*) counts rows. It is taught later: here, just run it.",
    ],
    example: { lang: 'php', code: "echo 'Hello from ' . 'PHP';", note: 'Hex runs it: two pieces of text glued together.' },
  },
  workedExample: { lang: 'php', code: '$n = $pdo->query("SELECT count(*) FROM bookings")->fetchColumn();\necho \'Bookings: \' . $n;', note: 'A sibling: counting the bookings.' },
  hints: ['Which table should it count?', 'PHP sends SQL through $pdo.', 'php-query'],
  spells: { teach: ['php-query'], recall: [] },
  steps: [
    { objective: 'Run the PHP script, and see what it prints.', level: 'L0', lang: 'php', starter: '$n = $pdo->query("SELECT count(*) FROM people")->fetchColumn();\necho \'People: \' . $n;',
      checks: [{ kind: 'output', name: 'it printed how many people there are', truth: 'SELECT count(*) FROM people' }] },
    { objective: 'Change one word so it counts the rooms.', level: 'L1', lang: 'php', starter: '$n = $pdo->query("SELECT count(*) FROM people")->fetchColumn();\necho \'People: \' . $n;',
      checks: [{ kind: 'output', name: 'it printed how many rooms there are', truth: 'SELECT count(*) FROM rooms' }] },
  ],
  cheats: [{ name: 'a number typed in', step: 1, lang: 'php', code: "echo 'Rooms: 3';" }],
  reference: [
    { step: 0, lang: 'php', code: '$n = $pdo->query("SELECT count(*) FROM people")->fetchColumn();\necho \'People: \' . $n;' },
    { step: 1, lang: 'php', code: '$n = $pdo->query("SELECT count(*) FROM rooms")->fetchColumn();\necho \'Rooms: \' . $n;' },
  ],
  recap: ['PHP wrapped SQL you already know, and printed the answer.', '$pdo->query sent it; echo printed it.'],
  evidence: false, timeMinutes: 3,
};

export const T18 = {
  id: 'T18', serve: 21, position: '#26', title: 'The smallest room for five', act: 1,
  from: PRIYA, says: "Sam's team of five needs a room on Monday. What's the smallest room that can take them? I don't want to waste the Boardroom.",
  kind: 'checkpoint', cause: 'report or question', grading: 'query', calibrate: true,
  concept: null, newConcept: 0, teaches: [], uses: ['compare', 'order-by', 'limit', 'where'], needs: ['T10', 'T08', 'T17'], revisits: ['T10', 'T08', 'T17'],
  languages: ['sql'], world: { stage: ALL_STAGES },
  learnCard: null,
  workedExample: null, // a checkpoint has no worked example and no label
  hints: ['Big enough first, then the smallest of those.', 'Filter, then sort and take the top.', 'limit'],
  spells: { teach: [], recall: ['compare', 'limit', 'order-by', 'select-columns', 'where'] },
  steps: [{ objective: 'Find the smallest room that can take five.', level: 'L3', lang: 'sql', starter: '',
    checks: [{ kind: 'rows', mode: 'one-of', name: 'one room: the smallest that seats five',
      truth: 'SELECT * FROM rooms WHERE capacity = (SELECT min(capacity) FROM rooms WHERE capacity >= 5)', columns: ['name'] }] }],
  cheats: [{ name: 'the biggest room', lang: 'sql', code: 'SELECT name FROM rooms ORDER BY capacity DESC LIMIT 1;' }],
  reference: [{ step: 0, lang: 'sql', code: 'SELECT name, capacity FROM rooms WHERE capacity >= 5 ORDER BY capacity LIMIT 1;' }],
  recap: ['Filter, then sort and take the top: two patterns combined.', 'Nothing on this ticket was new: it was all recall.'],
  evidence: true, timeMinutes: 3,
};

const THU = { from: "'2026-01-08 14:00+00'", to: "'2026-01-08 15:00+00'" };
export const T19 = {
  id: 'T19', serve: 22, position: '#27', title: 'Thursday, two till three', act: 2,
  from: SAM, says: 'Is the Boardroom free on Thursday from two till three? A client wants it.',
  kind: 'question', cause: 'report or question', grading: 'query',
  concept: 'overlap', newConcept: 1, teaches: ['overlap'], uses: ['time-range', 'and', 'where'], needs: ['T16'], revisits: ['T16', 'T14'],
  languages: ['sql'], world: { stage: ALL_STAGES },
  learnCard: {
    title: 'Two times overlap',
    lines: [
      'Two time periods overlap when each starts before the other ends.',
      "For two till three: start_at < '15:00' AND '14:00' < end_at.",
      'A meeting from 13:30 to 14:30 is still there at two; one that ends at exactly 14:00 is not.',
    ],
    example: { lang: 'sql', code: "SELECT * FROM bookings WHERE room_id = 3 AND start_at < '2026-01-05 10:30+00' AND '2026-01-05 09:30+00' < end_at;", note: 'What is in the Library between half nine and half ten on Monday.' },
  },
  workedExample: { lang: 'sql', code: "SELECT * FROM bookings WHERE room_id = 2 AND start_at < '2026-01-05 11:00+00' AND '2026-01-05 10:00+00' < end_at;", note: 'A sibling: is the Studio free on Monday from ten till eleven?' },
  hints: ['A meeting that starts at half one is still there at two.', 'Overlapping time periods.', 'overlap'],
  spells: { teach: ['overlap'], recall: [] },
  steps: [{ objective: 'Find what is in the Boardroom between two and three on Thursday.', level: 'L2', lang: 'sql', starter: 'SELECT * FROM bookings WHERE room_id = 1',
    checks: [{ kind: 'rows', name: 'exactly the bookings that overlap two till three', truth: `SELECT * FROM bookings WHERE room_id = 1 AND start_at < ${THU.to} AND ${THU.from} < end_at`, columns: ['id'] }] }],
  cheats: [{ name: 'bookings that start between two and three', lang: 'sql', code: `SELECT * FROM bookings WHERE room_id = 1 AND start_at >= ${THU.from} AND start_at <= ${THU.to};` }],
  reference: [{ step: 0, lang: 'sql', code: `SELECT * FROM bookings WHERE room_id = 1 AND start_at < ${THU.to} AND ${THU.from} < end_at;` }],
  explain: { question: 'Sam asks: "Why is a meeting from 13:30 a clash at two?"', model: 'It starts before three and ends after two, so it is still going when the client arrives. Two periods overlap when each starts before the other ends.', checklist: ['it starts before 15:00', 'it ends after 14:00', 'each starts before the other ends'] },
  recap: ['You found every booking that overlaps an hour, not just the ones that start in it.', 'Each starts before the other ends: that is the overlap rule.'],
  pattern: 'Overlap of two time ranges', evidence: true, timeMinutes: 3,
};

export const T21 = {
  id: 'T21', serve: 23, position: '#29', title: 'Two people, one Boardroom', act: 2,
  from: SAM, says: 'Two people turned up for the Boardroom at half past eight this morning, both with bookings. Whoever booked first should have it.',
  kind: 'bug', cause: 'growth and scale', grading: 'one-off', reskinOf: 'double-booking-1',
  concept: 'fix-clash', newConcept: 1, teaches: ['fix-clash'], uses: ['overlap', 'delete', 'update', 'investigate'], needs: ['T19', 'T13', 'T04'], revisits: ['T19', 'T13', 'T04'],
  languages: ['sql', 'php'], world: { stage: ALL_STAGES }, clock: '2026-01-05T08:45:00Z',
  setup: "INSERT INTO bookings (room_id, person_id, start_at, end_at) VALUES (1, 3, '2026-01-05 08:30+00', '2026-01-05 09:30+00');",
  learnCard: {
    title: 'Fixing a clash',
    lines: [
      'A double booking is two bookings in one room whose times overlap.',
      'Find the pair with the overlap rule, then decide which one changes.',
      'Ids grow in booking order, so the lower id was booked first: it stands.',
      'Then remove the newer one, or move it to a free slot.',
    ],
    example: { lang: 'sql', code: "SELECT * FROM bookings WHERE room_id = 2 AND start_at < '2026-01-05 11:00+00' AND '2026-01-05 10:00+00' < end_at;", note: 'The overlap rule finds who is in the Studio from ten till eleven.' },
  },
  workedExample: { lang: 'sql', code: "UPDATE bookings SET start_at = '2026-01-07 16:00+00', end_at = '2026-01-07 17:00+00' WHERE id = 20;", note: 'A sibling: a Studio booking moved to a free slot (then the office is put back).' },
  hints: ['Find every Boardroom booking that overlaps 08:30.', 'Overlap, then choose which row to change.', 'overlap'],
  spells: { teach: [], recall: ['delete'] },
  steps: [{ objective: 'Sort out the double booking. Whoever booked first keeps the room.', level: 'L3', lang: 'sql', starter: '',
    checks: [
      { kind: 'world', name: 'no room is double-booked', sql: NO_OVERLAP, expect: { equals: 0 } },
      { kind: 'unchanged', name: 'the bookings that were there first are untouched', sql: 'SELECT * FROM bookings WHERE id <= 23 ORDER BY id' },
    ] }],
  cheats: [
    { name: 'delete every booking', lang: 'sql', code: 'DELETE FROM bookings;' },
    { name: 'delete the older booking', lang: 'sql', code: 'DELETE FROM bookings WHERE id = 1;' },
  ],
  reference: [{ step: 0, lang: 'sql', code: 'DELETE FROM bookings WHERE id = 24;' }],
  alternates: [
    { lang: 'php', name: 'cancel the newer booking from PHP', code: "$pdo->exec('DELETE FROM bookings WHERE id = 24');" },
    { lang: 'sql', name: 'move the newer booking to a free slot', code: "UPDATE bookings SET start_at = '2026-01-07 16:00+00', end_at = '2026-01-07 17:00+00' WHERE id = 24;" },
  ],
  explain: { question: 'Sam asks: "Why keep the older booking?"', model: 'Whoever booked first had the room first; the newer booking is the one that should never have been allowed. Ids grow in booking order, so the lower id is the older one.', checklist: ['the first booking stands', 'the lower id was booked first', 'the newer one is moved or cancelled'] },
  recap: ['You found the clash with the overlap rule and changed only the newer booking.', 'A double booking is two bookings in one room whose times overlap.'],
  pattern: 'Overlap of two time ranges', evidence: true, timeMinutes: 3,
};
