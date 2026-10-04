// pad.js: Sequel's practice pad, the product arc's scratch database. It is never his company: it is wiped before
// every use and filled with the same small, neutral data (a fruit stall and a bookshelf), so every Learn card
// example, worked example and Grimoire look-up in his company has something real to run on, and nothing it does
// can touch his rooms. Scaffold steps (S1's one-word change) run here too.
//
//   PAD_TABLES       the tables the pad always has
//   PAD_SQL          the SQL that fills a wiped pad (run inside the empty public schema)
//   PAD_NOTE         one line that says what the pad is, for the result panel
export const PAD_TABLES = Object.freeze(['fruit', 'authors', 'books']);
export const PAD_NOTE = "Sequel's practice pad: a fruit stall and a bookshelf, never your company";
export const PAD_SQL = `CREATE TABLE fruit (id SERIAL PRIMARY KEY, name TEXT NOT NULL, colour TEXT, price NUMERIC(5,2), stock INTEGER, delivered_at TIMESTAMPTZ);
INSERT INTO fruit (name, colour, price, stock, delivered_at) VALUES
  ('apple', 'red', 0.50, 10, '2026-01-05 08:00+00'), ('banana', 'yellow', 0.25, 0, '2026-01-06 09:30+00'),
  ('cherry', 'red', 4.00, 5, '2026-01-06 14:00+00'), ('plum', 'purple', 0.75, 12, '2026-01-07 08:15+00'),
  ('lime', 'green', 0.30, 8, '2026-01-08 10:00+00');
CREATE TABLE authors (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
INSERT INTO authors (name) VALUES ('Ada'), ('Brin'), ('Cleo');
CREATE TABLE books (id SERIAL PRIMARY KEY, title TEXT NOT NULL, author_id INTEGER REFERENCES authors(id), pages INTEGER, lent_from TIMESTAMPTZ, lent_to TIMESTAMPTZ);
INSERT INTO books (title, author_id, pages, lent_from, lent_to) VALUES
  ('Engines', 1, 240, '2026-01-08 09:00+00', '2026-01-08 14:30+00'), ('Notes', 1, 96, NULL, NULL),
  ('Maps', 2, 310, '2026-01-08 15:00+00', '2026-01-08 17:00+00'), ('Orchards', 3, 180, '2026-01-07 10:00+00', '2026-01-09 10:00+00');`;
