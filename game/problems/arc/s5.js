// S5 · "There is no room 7" (product arc, section 1; milestone M-C). Cause: messy real-world input. When the ticket
// first arrives Priya runs her script (arc/scripts.js 'paper': her notebook's bookings and Sam's two paper slips)
// through HIS tables; one slip says room 7. The new idea is the foreign key: a link column made to point only at a
// row that exists. On a table that already holds rows it is added with ALTER TABLE, and PostgreSQL checks every row
// first: the room-7 booking has to be put right (Sam says it was the Studio) or removed before the rule goes on.
// Acceptance: the catalogue holds a foreign key from bookings.room_id to rooms; no booking points at a missing
// room; Priya's other bookings are as she typed them; probes (rolled back): a booking for room 999 is refused with
// 23503, and a booking in a brand-new room is accepted (so CHECK (room_id BETWEEN 1 AND 4) fails).
// The branch (variant 'refused'): if his S4 bookings table already had REFERENCES rooms, Priya's script was
// refused on that one line, and the ticket is "Priya got an error: what does it mean?", answered in a reply, with
// the same acceptance (already true, because of what he built). Same concept, credit for what he produced.
import { PRIYA } from '../chapter1/people.js';

const LINKED = { kind: 'world', name: 'bookings.room_id can only point at a room that exists (a foreign key to rooms)',
  sql: "SELECT count(*)::int FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_class f ON f.oid = c.confrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE n.nspname = 'public' AND c.contype = 'f' AND r.relname = 'bookings' AND f.relname = 'rooms' AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey) AND a.attname = 'room_id')",
  expect: { atLeast: 1 } };
const NO_GHOSTS = { kind: 'world', name: 'no booking points at a room that does not exist', sql: 'SELECT count(*)::int FROM bookings b WHERE NOT EXISTS (SELECT 1 FROM rooms r WHERE r.id = b.room_id)', expect: { equals: 0 } };
const OTHERS = { kind: 'unchanged', name: "Priya's other bookings are as she typed them", sql: 'SELECT id, room_id, person_id, start_at, end_at FROM bookings WHERE id <> {booking:sam-room7} ORDER BY id' };
const PROBE = {
  kind: 'probe', name: 'a booking for room 999 is refused; a booking in a brand-new room is not', table: 'bookings', roles: 'booking',
  steps: [
    { into: 'people', roles: 'person', as: 'person', insert: [{ name: 'Test Person' }], tried: 'save a test person', why: 'a test person could not be saved' },
    { insert: [{ room_id: 999, person_id: '@person', start_at: '2026-01-07 09:00', end_at: '2026-01-07 10:00' }], expect: '23503',
      tried: 'save a test booking for room 999', why: 'a test booking for room 999 (there is no room 999) was let in: nothing stops a booking for a room that does not exist',
      whyOther: 'a test booking for room 999 was refused, but by another rule, not by a link to rooms: a rule that lists the room numbers you have today will refuse the next room you open too.' },
    { into: 'rooms', roles: 'room', as: 'room', insert: [{ name: 'Test new room', capacity: 6 }], tried: 'save a brand-new test room', why: 'a brand-new test room could not be saved' },
    { insert: [{ room_id: '@room', person_id: '@person', start_at: '2026-01-07 09:00', end_at: '2026-01-07 10:00' }],
      tried: 'book that brand-new room', why: 'a booking in a brand-new room was refused: your rule only lets in the rooms you have today, not any room that exists' },
  ],
};
const ACCEPT = [LINKED, NO_GHOSTS, OTHERS, PROBE];
const EXAMPLE = "CREATE TABLE loans (id SERIAL PRIMARY KEY, book_id INTEGER, lent_on DATE);\nINSERT INTO loans (book_id, lent_on) VALUES (2, '2026-01-06'), (99, '2026-01-07');\nALTER TABLE loans ADD FOREIGN KEY (book_id) REFERENCES books(id);";
const WORKED = "CREATE TABLE loans (id SERIAL PRIMARY KEY, book_id INTEGER, lent_on DATE);\nINSERT INTO loans (book_id, lent_on) VALUES (2, '2026-01-06'), (99, '2026-01-07');\nUPDATE loans SET book_id = 3 WHERE book_id = 99;\nALTER TABLE loans ADD FOREIGN KEY (book_id) REFERENCES books(id);\nSELECT * FROM loans;";
const LEARN = {
  title: 'A link that must point at something',
  lines: [
    'A link column can be made to point only at a row that exists: REFERENCES rooms(id). This is a foreign key.',
    'On a new table, write it on the column: room_id INTEGER REFERENCES rooms(id).',
    'On a table that already has rows, add it: ALTER TABLE bookings ADD FOREIGN KEY (room_id) REFERENCES rooms(id);',
    'The database checks every row already there first: a link to nothing must be put right before it will add the rule.',
  ],
  example: { lang: 'sql', code: EXAMPLE, note: "On Sequel's practice pad: the rule is refused while one loan points at book 99, which does not exist. That refusal is the rule doing its job." },
};

export const S5 = {
  id: 'S5', serve: 17, title: 'There is no room 7', act: 1, stage: 'S5',
  from: PRIYA, says: "I typed Sam's paper bookings in last night (my script and its log are below). One of his slips says room 7, and the system took it. We haven't got a room 7! Can it just refuse that? Sam says the slip was the Studio.",
  kind: 'bug', cause: 'messy real-world input', grading: 'one-off', arrives: 'paper',
  concept: 'foreign-key', newConcept: 1, teaches: ['foreign-key'], uses: ['id-link', 'update', 'where'], needs: ['S4', 'T04'], revisits: ['S4', 'T04', 'O2'],
  languages: ['sql'], world: { stage: [], arc: true }, adds: { people: ['Priya Shah', 'Sam Fletcher', 'Jo Bell', 'Omar Haddad', 'Lena Novak'], bookings: ['omar-mon-board', 'sam-fri-studio', 'sam-fri-board', 'sam-room7'] },
  acceptance: [
    'bookings.room_id can only point at a room that exists in rooms (the database refuses anything else).',
    "Priya's room-7 booking is put right (Sam says the Studio) or removed; her other bookings stay as she typed them.",
    'Checked by trying it, undone afterwards: a booking for room 999 is refused, and a booking in a brand-new room is accepted.',
  ],
  learnCard: LEARN,
  workedExample: { lang: 'sql', code: WORKED, note: 'The broken link put right first (book 99 becomes book 3), then the rule goes on, on the practice pad.' },
  hints: ['First find the booking that points at room 7, and put it right. Then make the rule.', 'foreign-key: ALTER TABLE ... ADD FOREIGN KEY (room_id) REFERENCES rooms(id).', 'foreign-key'],
  spells: { teach: ['foreign-key'], recall: ['update', 'where'] },
  steps: [{ objective: 'Make the database refuse a booking for a room that does not exist, and put the room-7 booking right.', level: 'L3', lang: 'sql', starter: '', checks: ACCEPT }],
  cheats: [
    { name: "a rule that only knows today's rooms (CHECK room_id BETWEEN 1 AND 4)", lang: 'sql', code: 'UPDATE bookings SET room_id = {room:Studio} WHERE room_id = 7;\nALTER TABLE bookings ADD CHECK (room_id BETWEEN 1 AND 4);' },
    { name: 'the booking put right, but no rule', lang: 'sql', code: 'UPDATE bookings SET room_id = {room:Studio} WHERE room_id = 7;' },
    { name: 'every booking thrown away, then the rule', lang: 'sql', code: 'DELETE FROM bookings;\nALTER TABLE bookings ADD FOREIGN KEY (room_id) REFERENCES rooms(id);' },
  ],
  reference: [{ step: 0, lang: 'sql', code: 'UPDATE bookings SET room_id = {room:Studio} WHERE room_id = 7;\nALTER TABLE bookings ADD FOREIGN KEY (room_id) REFERENCES rooms(id);' }],
  explain: { question: 'Sam asks: "Why did it refuse my room 7?"', model: 'bookings.room_id now has to point at a row in rooms, and there is no room with id 7. The database checks the link on every booking, so a typo cannot slip in. Tell it which room you meant.', checklist: ['room_id must point at a room that exists', 'there is no room 7', 'the database checks it on every booking'] },
  recap: ['You made a link column point only at rows that exist, after putting the bad row right.', 'Now the database itself refuses a booking for a room that is not there.'],
  pattern: 'Guard at every layer, guarantee in the database', evidence: true, timeMinutes: 12,
  variants: [{
    id: 'refused', when: { link: ['bookings', 'room_id', 'rooms'] },
    patch: {
      says: "I typed Sam's paper bookings in last night (my script and its log are below). The system gave me an error on one of Sam's slips and wouldn't take it. What does it mean? Is it broken?",
      kind: 'question', cause: 'misunderstanding', grading: 'one-off',
      adds: { people: ['Priya Shah', 'Sam Fletcher', 'Jo Bell', 'Omar Haddad', 'Lena Novak'], bookings: ['omar-mon-board', 'sam-fri-studio', 'sam-fri-board'] },
      acceptance: [
        'You read the error in the log and tell Priya what it means.',
        'Already true, because of how you built bookings: room_id can only point at a room that exists (a room 999 is refused, a brand-new room is not).',
      ],
      hints: ['Read the line of the log that was refused: what does it say is missing?', 'foreign-key: your REFERENCES rule refused a link to a room that does not exist.', 'foreign-key'],
      spells: { teach: ['foreign-key'], recall: [] },
      steps: [{ objective: 'Read the refused line in the log, and reply to Priya.', level: 'L3', interaction: 'reply', prompt: 'What do you tell Priya?',
        options: [
          { id: 'broken', text: 'The database is broken: it refused a booking. I will take the rule off.' },
          { id: 'link', text: 'It is working: room_id may only point at a room that exists, and there is no room 7. Ask Sam which room he meant (he says the Studio), then book that.' },
          { id: 'time', text: 'The time on that slip is wrong: Wednesday 16:30 is not allowed.' },
        ],
        checks: [{ kind: 'reply', name: 'the reply names the true cause', answer: 'link' }, LINKED, NO_GHOSTS, PROBE] }],
      cheats: [{ name: 'calling the database broken', answer: { reply: 'broken' } }, { name: 'blaming the time', answer: { reply: 'time' } }],
      reference: [{ step: 0, answer: { reply: 'link' } }],
      recap: ['Your bookings table already refused a room that does not exist, and you read why.', 'The rule you wrote at S4 is a foreign key: the database guards the link, for everyone.'],
      evidence: true,
    },
  }],
};
