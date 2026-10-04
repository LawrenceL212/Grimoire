// card.js: the ticket card format of the opening chapter (the Phase 1 card, extended with the fields the
// learning design lists in section 15), its validation, the world it starts from, and its outcome grading.
//
// A card (game/problems/chapter1/*.js) is plain data:
//   id, serve (position in the ladder), title, act
//   from: { name, role, sector }       the named person who reports it, and where they work
//   says                               the symptom, in their words (never an instruction)
//   kind: question | bug | feature | onramp | checkpoint
//   cause: one of CAUSES (why the ticket exists in the world: learning design section 10)
//   concept: the ONE new concept it teaches (or null), newConcept: 0 | 1 (counts toward the day's cap)
//   teaches: [concept ids] (0 or 1), uses: [concept ids it needs, each taught earlier or by this card]
//   needs: [card ids], revisits: [card ids], languages: ['sql' | 'js' | 'php']
//   grading: query (answers checked on the real AND the shadow world) | one-off (real world only) | interact
//   world: { stage: [named.js stage flags] }, setup?: SQL run after the seed, clock?: the office clock
//   learnCard: { title, lines: [3-5 lines], example: { lang, code, note } } | null (only on the first meeting)
//   workedExample: { lang, code, note }   a solved sibling on different data: runnable; using it = exposure
//   hints: [nudge, which concept, the Grimoire entry (a spell id)]   (hint 4 is the worked example)
//   spells: { teach: [spell ids introduced], recall: [spell ids a solve here can honestly write in] }
//   steps: [{ objective, level: L0 | L1 | L2 | L3, lang, starter, interaction?, prompt?, options?, checks }]
//   cheats: [{ name, step?, lang?, code?, answer? }]   wrong solutions that must fail
//   reference: [{ step, lang?, code?, answer? }]          a valid solution per step (the playthrough test runs them)
//   recap: [line, line], pattern?, explain?: { question, model, checklist }, calibrate?, evidence, timeMinutes
//
// Check kinds (all deterministic, all outcome checks on the real world state or on the learner's real result):
//   rows      { truth, mode: set | ordered | one-of, exactColumns?, sorted?: { column, dir } }  the result rows
//   value     { truth }        one row, and one of its values is the truth's value
//   return    { truth }        JavaScript's returned value equals the truth's value
//   output    { truth }        PHP's printed output contains the truth's value as a whole number or word
//   world     { sql, expect }  a query on the world after the run (Phase 1's kind)
//   unchanged { sql }          the query gives the same rows as when the ticket arrived
//   pick      { truth }        the booking clicked in the timetable or the office is the truth's id
//   choice    { truth }        the answer chosen or typed equals the truth's value
//   lookup    { spell }        that Grimoire entry was looked up and its example run
//   reply     { answer }       the reply chosen is the true root cause
//   ran       {}               the query was run (and came back without an error)
//   schema    { table, roles }  the product arc: his table exists, its key is `id`, and a column fills each role
//                              (catalogue.js: the room's name is his text column, whatever he called it)
//   probe     { table, roles, empty?, steps }   behaviour, inside BEGIN ... ROLLBACK (nothing he has is changed,
//                              and every sequence is put back, SP1): empty: his rows are set aside first (TRUNCATE in
//                              the transaction), so only the probe's rows count. Steps:
//                                { insert: [{ role: value }], expect?: 'ok' | SQLSTATE, why }   rows through HIS columns
//                                { query: 'SQL with {table} and {role}', values?: { role: [..] } | equal?: [{ role: v }],
//                                  why, whyCount?, whyMissing?, whyValue? }
//   cell      { page, where, cols }  the notebook cell picked is the one whose row matches `where` (by its content,
//                              never by where it sits on screen), in one of `cols`
// `truth` is SQL run on the same world the learner's answer came from; query-graded cards are checked on
// both worlds (the shadow world keeps the named rooms and people, and changes everything else). A product-arc card
// (world: { arc: true }) runs on HIS company database, which only his own runs ever built (world/ddl-log.js);
// `choice` and `cell` there take their truth from Priya's notebook (problems/arc/notebook.js) through `note`.
import { World } from '../world/world.js';
import { namedSeedSql, STAGES } from '../world/named.js';
import { runSql } from '../runners/sql.js';
import { runJs } from '../runners/js.js';
import { toObjects } from '../world/views.js';
import { readCatalogue, resolveRoles, quoteIdent, ROOM_ROLES, PERSON_ROLES } from '../world/catalogue.js';
import { noteValue, noteRowKey } from './arc/notebook.js';

export const CAUSES = ['client feature request', 'growth and scale', 'messy real-world input', "other people's code", 'rules and security', 'misunderstanding', 'report or question'];
export const KINDS = ['question', 'bug', 'feature', 'onramp', 'checkpoint'];
export const LEVELS = ['L0', 'L1', 'L2', 'L3'];
export const GRADING = ['query', 'one-off', 'interact'];
const CHECK_KINDS = ['rows', 'value', 'return', 'output', 'world', 'unchanged', 'pick', 'choice', 'lookup', 'reply', 'ran', 'schema', 'probe', 'cell'];
const INTERACTIONS = ['pick', 'choice', 'lookup', 'reply', 'cell'];
export const ROLE_SETS = Object.freeze({ room: ROOM_ROLES, person: PERSON_ROLES });

// ---------------------------------------------------------------- validation (pure)
export function validateCard(c) {
  const bad = [];
  const need = (ok, why) => { if (!ok) bad.push(`${c?.id || '?'}: ${why}`); };
  need(c && typeof c.id === 'string', 'an id');
  if (!c) return bad;
  need(Number.isInteger(c.serve) && c.serve > 0, 'a serve position');
  need(c.from && c.from.name && c.from.role && c.from.sector, 'a reporter with a role and a sector');
  need(typeof c.says === 'string' && c.says.length > 10, 'a symptom in their words');
  need(KINDS.includes(c.kind), `a kind (${KINDS.join(', ')})`);
  need(CAUSES.includes(c.cause), `a cause category (${c.cause})`);
  need(GRADING.includes(c.grading), 'a grading mode');
  need(Array.isArray(c.teaches) && c.teaches.length <= 1, 'one new concept at most');
  need(c.newConcept === (c.teaches?.length ? 1 : 0), 'newConcept is 1 exactly when it teaches a concept');
  need((c.concept ?? null) === (c.teaches?.[0] ?? null), 'concept is the concept it teaches');
  need(Array.isArray(c.uses) && Array.isArray(c.needs) && Array.isArray(c.revisits), 'uses, needs and revisits lists');
  need(Array.isArray(c.languages) && c.languages.length > 0 && c.languages.every((l) => ['sql', 'js', 'php'].includes(l)), 'allowed languages');
  need(c.world && Array.isArray(c.world.stage) && c.world.stage.every((s) => STAGES.includes(s)), 'a world stage');
  if (c.world?.arc) {
    need(c.grading !== 'query', 'an arc card is graded on his own world (one-off or interact), never against a seeded shadow');
    need(Array.isArray(c.acceptance) && c.acceptance.length > 0 && c.acceptance.every((a) => typeof a === 'string' && a), 'the acceptance checks in plain words (the goal is shown, never the answer)');
    for (const s of c.steps || []) for (const k of s.checks || []) {
      if (k.kind === 'schema' || k.kind === 'probe') need(typeof k.table === 'string' && ROLE_SETS[k.roles], `${k.kind} check: a table and a known role set`);
      if (k.kind === 'probe') need(Array.isArray(k.steps) && k.steps.length && k.steps.every((p) => (p.insert || p.query) && typeof p.why === 'string'), 'probe check: steps, each with plain words for when it fails');
    }
  }
  for (const s of c.steps || []) for (const k of s.checks || []) if ((k.kind === 'schema' || k.kind === 'probe') && !c.world?.arc) need(false, `${k.kind} checks belong to product-arc cards`);
  if (c.teaches?.length && !c.lookupOnly) {
    need(c.learnCard && Array.isArray(c.learnCard.lines) && c.learnCard.lines.length >= 3 && c.learnCard.lines.length <= 5, 'a Learn card of 3-5 lines on a teaching ticket');
    need(c.learnCard?.example?.code || c.learnCard?.example?.show, 'a Learn card example tied to the world');
  }
  if (c.kind !== 'checkpoint') need(c.workedExample && ((c.workedExample.code && c.workedExample.lang) || c.workedExample.show), 'a runnable worked example');
  else need(!c.workedExample && !c.learnCard, 'a checkpoint has no worked example and no Learn card');
  need(Array.isArray(c.hints) && c.hints.length === 3 && c.hints.every((h) => typeof h === 'string' && h), 'three hints (nudge, concept, Grimoire entry)');
  need(c.spells && Array.isArray(c.spells.teach) && Array.isArray(c.spells.recall), 'Grimoire spell ids (teach and recall)');
  need(Array.isArray(c.steps) && c.steps.length > 0, 'at least one step');
  for (const [i, s] of (c.steps || []).entries()) {
    need(typeof s.objective === 'string' && s.objective, `step ${i + 1}: an objective`);
    need(LEVELS.includes(s.level), `step ${i + 1}: a scaffold level`);
    need(!s.interaction || INTERACTIONS.includes(s.interaction), `step ${i + 1}: a known interaction`);
    need(Array.isArray(s.checks) && s.checks.length > 0 && s.checks.every((k) => CHECK_KINDS.includes(k.kind)), `step ${i + 1}: outcome checks`);
    need(s.interaction || ['sql', 'js', 'php'].includes(s.lang || c.languages[0]), `step ${i + 1}: a language`);
    need(c.reference?.some((r) => (r.step ?? c.steps.length - 1) === i), `step ${i + 1}: a reference solution`);
  }
  need(Array.isArray(c.cheats) && c.cheats.length > 0, 'at least one cheat that must fail');
  need(Array.isArray(c.recap) && c.recap.length === 2, 'a two-line recap');
  need(typeof c.evidence === 'boolean', 'whether it can count as evidence');
  return bad;
}

// ---------------------------------------------------------------- the world a card starts from
export const seedOf = (card, shadow = false) => namedSeedSql({ shadow, stage: card.world.stage });
export async function startWorld(card) {
  const world = await World.create({}, { seed: seedOf(card) });
  if (card.setup) await world.exec(card.setup);
  return world;
}
export async function startShadow(card) {
  const world = await World.create({}, { seed: seedOf(card, true) });
  if (card.shadowSetup) await world.exec(card.shadowSetup);
  return world;
}
// the rows the `unchanged` checks compare against, taken when the ticket arrives
export async function baselineOf(world, steps) {
  const out = {};
  for (const s of steps) for (const k of s.checks) if (k.kind === 'unchanged' && !(k.sql in out)) out[k.sql] = await world.query(k.sql);
  return out;
}

// ---------------------------------------------------------------- comparing answers (pure)
export function norm(v) {
  if (v === null || v === undefined) return 'NULL';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? String(v) : v.toISOString();
  if (typeof v === 'bigint') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string' && /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(v)) { const d = new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')); if (!Number.isNaN(d.getTime())) return d.toISOString(); }
  return String(v);
}
const cols = (rows) => (rows && rows.length ? Object.keys(rows[0]) : []);
const project = (rows, keys) => rows.map((r) => keys.map((k) => norm(r[k])).join('\u0001'));
const sameMultiset = (a, b) => a.length === b.length && [...a].sort().join('\u0002') === [...b].sort().join('\u0002');

/* got: the learner's rows; want: the truth's rows. `columns` are the columns the question asks for (every
   rows check names them, or asks for exactColumns): the answer must hold them, by name, or (an alias such as
   `AS seats`) by position when it has exactly that many columns. Other columns may come along only if they are
   real columns of the answer; a subset that leaves out what was asked for fails. */
function keysFor(gc, wc, columns) {
  if (!columns) {
    const keys = gc.filter((c) => wc.includes(c));
    if (!keys.length || keys.length !== gc.length) {
      const odd = gc.filter((c) => !wc.includes(c));
      return { why: odd.length ? `the column${odd.length > 1 ? 's' : ''} ${odd.join(', ')} ${odd.length > 1 ? 'are' : 'is'} not part of the answer` : 'the answer\'s columns are not the ones asked for' };
    }
    return { mine: keys, theirs: keys };
  }
  if (columns.every((c) => gc.includes(c))) {
    const odd = gc.filter((c) => !wc.includes(c));
    if (odd.length) return { why: `the column${odd.length > 1 ? 's' : ''} ${odd.join(', ')} ${odd.length > 1 ? 'are' : 'is'} not part of the answer` };
    return { mine: columns, theirs: columns };
  }
  if (gc.length === columns.length) return { mine: gc, theirs: columns }; // renamed (AS ...): compared by position
  return { why: `the answer needs ${columns.length > 1 ? 'the columns' : 'the column'} ${columns.join(', ')}` };
}
const projectBy = (rows, keys) => rows.map((r) => keys.map((k) => norm(r[k])).join('\u0001'));
export function compareRows(got, want, { mode = 'set', exactColumns = false, sorted = null, columns = null } = {}) {
  got = got || []; want = want || [];
  const gc = cols(got), wc = cols(want);
  if (exactColumns && (gc.length !== wc.length || !gc.every((c) => wc.includes(c)))) {
    return { ok: false, why: got.length ? `the answer has the columns ${gc.join(', ') || '(none)'}; it should have ${wc.join(', ')}` : 'no rows came back' };
  }
  if (mode === 'one-of') {
    if (got.length !== 1) return { ok: false, why: `${got.length} rows came back; one was wanted` };
    const k = keysFor(gc, wc, columns);
    if (k.why) return { ok: false, why: k.why };
    return projectBy(want, k.theirs).includes(projectBy(got, k.mine)[0]) ? { ok: true } : { ok: false, why: 'that is not the row the question is after' };
  }
  if (!want.length) return got.length ? { ok: false, why: `${got.length} row${got.length === 1 ? '' : 's'} came back; none should` } : { ok: true };
  if (!got.length) return { ok: false, why: 'no rows came back' };
  const k = keysFor(gc, wc, columns);
  if (k.why) return { ok: false, why: k.why };
  const g = projectBy(got, k.mine), w = projectBy(want, k.theirs);
  if (!sameMultiset(g, w)) return { ok: false, why: got.length !== want.length ? `${got.length} row${got.length === 1 ? '' : 's'} came back; ${want.length} should` : 'the rows are not the right ones' };
  if (mode === 'ordered' && g.join('\u0002') !== w.join('\u0002')) return { ok: false, why: 'the right rows, in the wrong order' };
  if (sorted) {
    const i = k.theirs.indexOf(sorted.column);
    const col = i >= 0 ? k.mine[i] : gc.includes(sorted.column) ? sorted.column : null;
    if (!col) return { ok: false, why: `the answer needs the ${sorted.column} column to show its order` };
    const v = got.map((r) => Number(r[col]));
    for (let j = 1; j < v.length; j++) if (sorted.dir === 'desc' ? v[j] > v[j - 1] : v[j] < v[j - 1]) return { ok: false, why: 'the right rows, in the wrong order' };
  }
  return { ok: true };
}
/* One value: one row; a single column (any name) holds it, or the row has the asked-for column holding it.
   A row where some OTHER value happens to equal the answer does not pass. */
export function compareValue(got, truth, column = null) {
  if (!got || got.length !== 1) return { ok: false, why: `${got ? got.length : 0} rows came back; one was wanted` };
  const t = norm(truth), row = got[0], keys = Object.keys(row);
  const v = keys.length === 1 ? row[keys[0]] : column && column in row ? row[column] : undefined;
  if (v === undefined) return { ok: false, why: column ? `the answer needs the ${column} column (or just the one value)` : 'one value was wanted' };
  return norm(v) === t ? { ok: true } : { ok: false, why: 'that is not the right answer' };
}
// PHP output: the truth as a whole number or word in the printed text
export function outputHas(stdout, truth) {
  const t = String(norm(truth)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w.])${t}($|[^\\w.])`).test(String(stdout || ''));
}

// ---------------------------------------------------------------- which spells the code really casts (PC-13, light)
const SHAPES = {
  sql: {
    'select-all': /\bselect\s+\*\s+from\b/i,
    'select-columns': /\bselect\s+(?!\*)[a-z_]\w*\s*,/i,
    where: /\bwhere\b/i,
    update: /\bupdate\s+\w+\s+set\b/i,
    insert: /\binsert\s+into\b/i,
    'create-table': /\bcreate\s+table\b/i,
    'order-by': /\border\s+by\b/i,
    compare: /(>=|<=|<>|!=|[^-<>=!]>(?!=)|<(?![=>]))/,
    delete: /\bdelete\s+from\b/i,
    and: /\bwhere\b[\s\S]*\band\b/i,
    'time-range': /\b(start_at|end_at)\s*(>=|<=|>|<)\s*'|'\s*(>=|<=|>|<)\s*(start_at|end_at)\b/i,
    limit: /\blimit\s+\d/i,
    overlap: /\bstart_at\s*<[\s\S]*\bend_at|\bend_at\s*>[\s\S]*\bstart_at/i,
  },
  js: { 'js-variable': /\b(const|let)\s+\w+\s*=[\s\S]*\breturn\b/ },
  php: { 'php-query': /\$pdo\s*->\s*(query|prepare|exec)\s*\(/ },
};
const stripComments = (code, lang) => (lang === 'sql' ? code.replace(/--[^\n]*/g, '') : code.replace(/\/\/[^\n]*/g, ''));
export function detectSpells(code, lang) {
  const c = stripComments(String(code || ''), lang);
  return Object.entries(SHAPES[lang] || {}).filter(([, re]) => re.test(c)).map(([id]) => id);
}
// what the learner wrote himself: the spells in his code that the starter did not already hold
export function castSpells(code, lang, starter = '') {
  const given = new Set(detectSpells(starter, lang));
  return detectSpells(code, lang).filter((id) => !given.has(id));
}

// ---------------------------------------------------------------- question tickets: nothing the learner runs is kept
/* A question (query-graded) ticket asks for an answer, so the learner's SQL runs inside a transaction that is
   always rolled back: changing the data first and then "answering" it cannot pass, and the world is never
   changed by a question. Transaction control in the learner's code would escape that, so it is refused. */
const TXN = /\b(begin|commit|rollback|start\s+transaction|savepoint|release|abort)\b/i;
export function refusesTxn(code) {
  const bare = String(code || '').replace(/--[^\n]*/g, '').replace(/'(?:[^']|'')*'/g, "''");
  return TXN.test(bare) ? 'This ticket asks a question, so nothing you run here is kept, and BEGIN, COMMIT and ROLLBACK are not allowed. Write the query that answers it.' : null;
}
export async function runQuestionSql(world, code) {
  const refused = refusesTxn(code);
  if (refused) return { ok: false, error: refused, refused: true };
  try {
    await world.exec('BEGIN');
    const results = await world.exec(code);
    const sets = results.filter((r) => r.fields && r.fields.length);
    const after = await toObjects(world); // what the code did, seen before it is undone
    return { ok: true, rows: sets.length ? sets[sets.length - 1].rows : [], stdout: '', after };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  } finally { try { await world.exec('ROLLBACK'); } catch { /* nothing open */ } }
}
// the truths of a step, computed from the world BEFORE the learner's code runs
export async function truthsOf(world, step) {
  const out = {};
  for (const k of step.checks) if (k.truth && !(k.truth in out)) out[k.truth] = await world.query(k.truth);
  return out;
}

// ---------------------------------------------------------------- the product arc: his schema and its behaviour
const lit = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`); // untyped: PostgreSQL types it by the column
const FILLER = { text: 'x', integer: '1', number: '1', boolean: 'false', timestamptz: '2026-01-05T09:00:00Z', timestamp: '2026-01-05 09:00', date: '2026-01-05' };
/* {table} becomes his table, {role} his column for that role (quoted). A role he has no column for cannot be filled. */
export function fillSql(sql, table, map) {
  return String(sql).replace(/\{(\w+)\}/g, (_, r) => {
    if (r === 'table') return quoteIdent(table);
    if (!map[r]) throw new Error(`no column for ${r}`);
    return quoteIdent(map[r]);
  });
}
/* rows given by role go in through HIS columns; any other column he made required (NOT NULL, no default) gets a
   plain value of its type, so an extra column of his never fails a probe that is not about it. */
export function insertSql(t, map, rows) {
  const roles = Object.keys(rows[0] || {});
  const cols = roles.map((r) => { if (!map[r]) throw new Error(`no column for ${r}`); return map[r]; });
  const extra = t.columns.filter((c) => !c.nullable && !c.hasDefault && !cols.includes(c.name));
  const names = [...cols, ...extra.map((c) => c.name)].map(quoteIdent).join(', ');
  const values = rows.map((row) => `(${[...roles.map((r) => lit(row[r])), ...extra.map((c) => lit(FILLER[c.cls] ?? null))].join(', ')})`).join(', ');
  return `INSERT INTO ${quoteIdent(t.name)} (${names}) VALUES ${values}`;
}
const normal = (v) => (v === null || v === undefined ? null : typeof v === 'number' || typeof v === 'bigint' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) ? Number(v) : String(v).trim().toLowerCase());
const fmt = (s, vars) => String(s || '').replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
/* Pure: the rows a probe query returned, against what the step wants. */
export function judgeProbeRows(got, p) {
  got = got || [];
  if (p.values) {
    for (const [role, want] of Object.entries(p.values)) {
      const g = got.map((r) => normal(r[role])).map(String).sort(), w = want.map(normal).map(String).sort();
      if (g.join('\u0001') !== w.join('\u0001')) return { ok: false, why: p.why };
    }
    return { ok: true };
  }
  if (p.equal) {
    const key = p.key || Object.keys(p.equal[0] || {})[0];
    if (got.length !== p.equal.length) return { ok: false, why: fmt(p.whyCount || p.why, { n: got.length, want: p.equal.length }) };
    for (const w of p.equal) {
      const hits = got.filter((r) => normal(r[key]) === normal(w[key]));
      if (hits.length !== 1) return { ok: false, why: fmt(hits.length ? p.whyCount || p.why : p.whyMissing || p.why, { key: w[key], n: got.length, want: p.equal.length }) };
      for (const [role, v] of Object.entries(w)) {
        if (normal(hits[0][role]) !== normal(v)) return { ok: false, why: fmt(p.whyValue || p.why, { key: w[key], role, got: hits[0][role], want: v }) };
      }
    }
    return { ok: true };
  }
  return { ok: true };
}
async function tableFor(world, k) {
  const cat = await readCatalogue(world);
  const t = cat.tables[k.table];
  if (!t) return { why: `there is no table called ${k.table} yet` };
  const { map, missing } = resolveRoles(t, ROLE_SETS[k.roles]);
  return { cat, t, map, missing };
}
const ROLE_WORDS = { name: "the room's name (words)", capacity: 'how many people fit (a whole number)', role: "the person's role" };
export async function checkSchema(world, k) {
  const r = await tableFor(world, k);
  if (r.why) return { ok: false, why: r.why };
  if (!(r.t.pk.length === 1 && r.t.pk[0] === 'id')) return { ok: false, why: `${k.table} needs a primary key column called id (the house convention: every row gets its own number)` };
  if (r.missing.length) return { ok: false, why: `${k.table} needs a column for ${r.missing.map((m) => ROLE_WORDS[m] || m).join(' and ')}` };
  return { ok: true, map: r.map };
}
/* Inside one transaction that is always rolled back; every sequence of his is put back afterwards (a rolled-back
   INSERT still moves a SERIAL on, SP1), so a probe never changes his next id or any row. */
export async function runProbe(world, k) {
  const r = await tableFor(world, k);
  if (r.why) return { ok: false, why: r.why };
  const seqs = await world.query("SELECT format('%I.%I', schemaname, sequencename) AS s, last_value AS v, start_value AS st FROM pg_sequences WHERE schemaname = 'public'");
  let verdict = { ok: true };
  await world.exec('BEGIN');
  try {
    if (k.empty) await world.exec(`TRUNCATE ${Object.keys(r.cat.tables).map(quoteIdent).join(', ')} CASCADE`);
    for (const p of k.steps) {
      let sql;
      try { sql = p.insert ? insertSql(r.t, r.map, p.insert) : fillSql(p.query, k.table, r.map); } catch (e) { const role = /no column for (\w+)/.exec(e.message)?.[1]; verdict = { ok: false, why: `${k.table} needs a column for ${ROLE_WORDS[role] || role}` }; break; }
      await world.exec('SAVEPOINT probe');
      let rows = null, code = null, msg = '';
      try { const res = await world.exec(sql); rows = res.filter((x) => x.fields?.length).pop()?.rows || []; } catch (e) { code = e?.code || 'error'; msg = String(e?.message ?? e); }
      await world.exec(code ? 'ROLLBACK TO SAVEPOINT probe' : 'RELEASE SAVEPOINT probe');
      const want = p.expect || 'ok';
      if (want === 'ok' && code) { verdict = { ok: false, why: `${p.why} (the database said: ${msg})` }; break; }
      if (want !== 'ok' && code !== want) { verdict = { ok: false, why: p.why }; break; }
      if (p.query && !code) { const j = judgeProbeRows(rows, p); if (!j.ok) { verdict = j; break; } }
    }
  } finally {
    try { await world.exec('ROLLBACK'); } catch { /* nothing open */ }
    for (const s of seqs) await world.query(s.v == null ? 'SELECT setval($1, $2, false)' : 'SELECT setval($1, $2, true)', [s.s, s.v ?? s.st]);
  }
  return verdict;
}

// ---------------------------------------------------------------- grading one step
async function shadowRun(shadow, lang, code, php) {
  if (lang === 'sql') {
    if (refusesTxn(code)) return { ok: false, error: refusesTxn(code) };
    // the shadow is never changed: the learner's code runs inside a transaction that is rolled back
    try {
      await shadow.exec('BEGIN');
      const results = await shadow.exec(code);
      const sets = results.filter((r) => r.fields && r.fields.length);
      return { ok: true, rows: sets.length ? sets[sets.length - 1].rows : [] };
    } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } finally { try { await shadow.exec('ROLLBACK'); } catch { /* nothing open */ } }
  }
  const objects = await toObjects(shadow);
  if (lang === 'js') return runJs(code, objects);
  if (lang === 'php' && php) return (await php()).run(code, objects);
  return { ok: false, error: 'no runtime' };
}
const one = async (world, sql) => { const r = await world.query(sql); return r[0] ? Object.values(r[0])[0] : undefined; };

/* ctx: { world, shadow (a World or a promise of one), lang, code, res (the runner's result), baseline,
          truths (truthsOf before the run: the real world's answers are taken from before the code ran),
          act: { picked, choice, lookup: { opened: Set, ran: Set }, reply, ran }, php: () => runner }
   -> { passed, results: [{ name, ok, why, where }] } */
export async function gradeStep(card, step, ctx) {
  const results = [];
  const add = (name, ok, why = '', where = 'real') => results.push({ name, ok: !!ok, why, where });
  const res = ctx.res || {};
  let shadowRes = null;
  const useShadow = card.grading === 'query' && !step.interaction && ctx.shadow;
  for (const k of step.checks) {
    const name = k.name || k.kind;
    try {
      switch (k.kind) {
        case 'rows': case 'value': {
          if (!res.ok) { add(name, false, res.error || 'the code did not run'); break; }
          const judge = async (w, rows, where) => {
            const want = where === 'real' && ctx.truths?.[k.truth] ? ctx.truths[k.truth] : await w.query(k.truth);
            const r = k.kind === 'value' ? compareValue(rows, want[0] ? Object.values(want[0])[0] : undefined, want[0] ? Object.keys(want[0])[0] : null) : compareRows(rows, want, k);
            add(name, r.ok, r.why || '', where);
            return r.ok;
          };
          if (!(await judge(ctx.world, res.rows, 'real'))) break;
          if (useShadow) {
            const sh = await ctx.shadow;
            shadowRes ??= await shadowRun(sh, ctx.lang, ctx.code, ctx.php);
            if (!shadowRes.ok) { add(name, false, `on other data it failed: ${shadowRes.error}`, 'shadow'); break; }
            await judge(sh, shadowRes.rows, 'shadow');
          }
          break;
        }
        case 'return': {
          if (!res.ok) { add(name, false, res.error || 'the code did not run'); break; }
          const t = ctx.truths?.[k.truth] ? Object.values(ctx.truths[k.truth][0] || {})[0] : await one(ctx.world, k.truth);
          add(name, norm(res.result) === norm(t), res.result === undefined ? 'nothing was returned' : `it returned ${res.result}`);
          break;
        }
        case 'output': {
          if (!res.ok) { add(name, false, res.error || 'the code did not run'); break; }
          const t = ctx.truths?.[k.truth] ? Object.values(ctx.truths[k.truth][0] || {})[0] : await one(ctx.world, k.truth);
          add(name, outputHas(res.stdout, t), (res.stdout || '').trim() ? `it printed ${String(res.stdout).trim().slice(0, 60)}` : 'nothing was printed');
          break;
        }
        case 'world': {
          const v = await one(ctx.world, k.sql);
          const e = k.expect;
          const ok = 'equals' in e ? norm(v) === norm(e.equals) : 'atLeast' in e ? Number(v) >= e.atLeast : Number(v) <= e.atMost;
          add(name, ok, String(norm(v)));
          break;
        }
        case 'unchanged': {
          const now = await ctx.world.query(k.sql);
          const was = ctx.baseline?.[k.sql];
          add(name, was && JSON.stringify(now.map((r) => Object.values(r).map(norm))) === JSON.stringify(was.map((r) => Object.values(r).map(norm))), 'it changed');
          break;
        }
        case 'pick': {
          const t = await one(ctx.world, k.truth);
          add(name, ctx.act?.picked != null && norm(ctx.act.picked) === norm(t), ctx.act?.picked == null ? 'nothing picked yet' : 'that is not the one');
          break;
        }
        case 'schema': { const v = await checkSchema(ctx.world, k); add(name, v.ok, v.why || ''); break; }
        case 'probe': { const v = await runProbe(ctx.world, k); add(name, v.ok, v.why || ''); break; }
        case 'cell': {
          const c = ctx.act?.cell;
          const key = noteRowKey(k.page, k.where);
          add(name, !!c && c.page === k.page && String(c.row) === String(key) && (!k.cols || k.cols.includes(c.col)), c ? 'that is not the one' : 'nothing picked yet');
          break;
        }
        case 'choice': {
          const t = k.note ? noteValue(k.note) : await one(ctx.world, k.truth);
          const c = ctx.act?.choice;
          add(name, c != null && String(c).trim().toLowerCase() === String(norm(t)).toLowerCase(), c == null ? 'no answer yet' : 'that is not the answer');
          break;
        }
        case 'lookup': add(name, !!ctx.act?.lookup?.ran?.has(k.spell), 'that entry\'s example has not been run yet'); break;
        case 'reply': add(name, ctx.act?.reply === k.answer, ctx.act?.reply ? 'that is not what happened' : 'no reply chosen yet'); break;
        case 'ran': add(name, !!ctx.act?.ran, 'not run yet'); break;
        default: add(name, false, `unknown check ${k.kind}`);
      }
    } catch (e) {
      add(name, false, String(e?.message ?? e));
    }
  }
  return { passed: results.length > 0 && results.every((r) => r.ok), results };
}
export { runSql };
