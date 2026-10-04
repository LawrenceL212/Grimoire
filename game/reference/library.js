// library.js: the reference library's data and its pure functions (no DOM, so node:test covers it).
// It is documentation: nothing here reads or writes the learner's progress, credit or help state.
//
//   ENTRIES                         every entry, all languages
//   LANGS                           [{ id, name }] in tab order
//   byId(id) -> entry | undefined
//   forLang(lang, entries?) -> entries of that language
//   categories(lang, entries?) -> [{ name, count }] in the order they first appear
//   search(query, { lang, category, entries? }) -> entries, best matches first (a blank query lists them in order)
//   seeAlso(entry) -> the entries it links to
//   formatRows(rows) -> the text an SQL result is shown (and tested) as
//   normalise(text) -> text with line ends and trailing space tidied, for comparing outputs
//   matchesExpected(entry, actual) -> true when an example's real output is what the entry says it is
//   pushRecent(list, id, max?) -> a new recently-opened list, newest first, no repeats
import { SQL } from './data/sql.js';
import { JS } from './data/js.js';
import { PHP } from './data/php.js';
import { WEB } from './data/web.js';

export const LANGS = [
  { id: 'sql', name: 'SQL' },
  { id: 'js', name: 'JavaScript' },
  { id: 'php', name: 'PHP' },
  { id: 'web', name: 'HTML/CSS' },
];
export const ENTRIES = [...SQL, ...JS, ...PHP, ...WEB];

const INDEX = new Map(ENTRIES.map((e) => [e.id, e]));
export const byId = (id) => INDEX.get(id);
export const forLang = (lang, entries = ENTRIES) => entries.filter((e) => e.lang === lang);

export function categories(lang, entries = ENTRIES) {
  const out = new Map();
  for (const e of forLang(lang, entries)) out.set(e.category, (out.get(e.category) || 0) + 1);
  return [...out].map(([name, count]) => ({ name, count }));
}

const words = (s) => String(s || '').toLowerCase().split(/[^a-z0-9_$>.]+/).filter(Boolean);

// a lower score is a better match; null means it does not match
function score(e, terms) {
  const name = e.name.toLowerCase(), id = e.id.toLowerCase(), sig = e.signature.toLowerCase();
  const sum = e.summary.toLowerCase(), cat = e.category.toLowerCase();
  let total = 0;
  for (const t of terms) {
    let s;
    if (name === t) s = 0;
    else if (name.startsWith(t)) s = 1;
    else if (words(e.name).some((w) => w.startsWith(t))) s = 2;
    else if (name.includes(t) || id.endsWith(`-${t}`)) s = 3;
    else if (sig.includes(t)) s = 4;
    else if (cat.includes(t)) s = 5;
    else if (sum.includes(t)) s = 6;
    else return null;
    total += s;
  }
  return total;
}

export function search(query, { lang = null, category = null, entries = ENTRIES } = {}) {
  let list = entries;
  if (lang) list = list.filter((e) => e.lang === lang);
  if (category) list = list.filter((e) => e.category === category);
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return list.slice();
  return list
    .map((e, i) => ({ e, i, s: score(e, terms) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((x) => x.e);
}

export const seeAlso = (entry) => (entry.see || []).map(byId).filter(Boolean);

const cell = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};
export function formatRows(rows) {
  if (!rows || !rows.length) return '(no rows)';
  const cols = Object.keys(rows[0]);
  return [cols.join(' | '), ...rows.map((r) => cols.map((c) => cell(r[c])).join(' | '))].join('\n');
}

export const normalise = (text) => String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').trim();

export function matchesExpected(entry, actual) {
  const got = normalise(actual), want = normalise(entry.expect);
  if (entry.loose) return want.split('\n').every((l) => got.includes(l));
  return got === want;
}

export function pushRecent(list, id, max = 8) {
  return [id, ...(Array.isArray(list) ? list : []).filter((x) => x !== id)].slice(0, max);
}
