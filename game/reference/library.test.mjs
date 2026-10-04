import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRIES, LANGS, byId, forLang, categories, search, seeAlso, formatRows, normalise, matchesExpected, pushRecent } from './library.js';

const FIELDS = ['id', 'lang', 'category', 'name', 'signature', 'summary', 'example', 'mistake'];

test('every entry has its required fields, and exactly one kind of expected output', () => {
  for (const e of ENTRIES) {
    for (const f of FIELDS) assert.equal(typeof e[f], 'string', `${e.id}.${f}`);
    for (const f of FIELDS) assert.ok(e[f].trim().length > 0, `${e.id}.${f} is empty`);
    const kinds = ['expect', 'expectError'].filter((k) => typeof e[k] === 'string' && e[k].length);
    if (e.lang === 'web') assert.ok(Array.isArray(e.check) && e.check.length && typeof e.expect === 'string', `${e.id} needs expect and check`);
    else assert.equal(kinds.length, 1, `${e.id} needs expect or expectError`);
    assert.ok(Array.isArray(e.see), `${e.id}.see`);
    assert.ok(LANGS.some((l) => l.id === e.lang), `${e.id} language`);
  }
});

test('ids are unique and carry their language', () => {
  const seen = new Set();
  for (const e of ENTRIES) {
    assert.ok(!seen.has(e.id), `duplicate id ${e.id}`);
    seen.add(e.id);
    assert.ok(e.id.startsWith(`${e.lang}-`), `${e.id} should start with ${e.lang}-`);
  }
});

test('every see-also link resolves, within the same language, and not to itself', () => {
  for (const e of ENTRIES) for (const s of e.see) {
    assert.ok(byId(s), `${e.id} links to missing ${s}`);
    assert.equal(byId(s).lang, e.lang, `${e.id} -> ${s} crosses languages`);
    assert.notEqual(s, e.id);
  }
});

test('examples are short: 2 to 8 lines, one sentence summaries', () => {
  for (const e of ENTRIES) {
    const n = e.example.split('\n').length;
    assert.ok(n >= 1 && n <= 8, `${e.id} example has ${n} lines`);
    assert.ok(e.summary.length <= 200, `${e.id} summary is long`);
    assert.ok(e.mistake.length <= 330, `${e.id} mistake is long`);
  }
});

test('the library never holds the company: no rooms, bookings or people tables in examples', () => {
  for (const e of ENTRIES) {
    const text = `${e.setup || ''}\n${e.example}`;
    assert.ok(!/\b(rooms|bookings|people)\b/i.test(text), `${e.id} uses the company world`);
  }
});

test('the planned coverage is there', () => {
  assert.ok(forLang('sql').length >= 40, 'sql');
  assert.ok(forLang('js').length >= 30, 'js');
  assert.ok(forLang('php').length >= 30, 'php');
  assert.ok(forLang('web').length >= 5, 'web');
});

test('categories keep first-seen order and counts add up', () => {
  const c = categories('sql');
  assert.equal(c.reduce((n, x) => n + x.count, 0), forLang('sql').length);
  assert.equal(c[0].name, 'Tables');
});

test('search: a blank query lists everything, in order', () => {
  assert.equal(search('').length, ENTRIES.length);
  assert.deepEqual(search('', { lang: 'php' }).map((e) => e.id), forLang('php').map((e) => e.id));
});

test('search: the name beats the description, and the language and category narrow it', () => {
  assert.equal(search('where', { lang: 'sql' })[0].id, 'sql-where');
  assert.equal(search('having', { lang: 'sql' })[0].id, 'sql-having');
  assert.equal(search('map', { lang: 'js' })[0].id, 'js-array-map');
  assert.ok(search('join').every((e) => /join/i.test(`${e.name} ${e.signature} ${e.summary} ${e.category} ${e.id}`)));
  assert.ok(search('select', { lang: 'js' }).every((e) => e.lang === 'js'));
  assert.ok(search('', { lang: 'sql', category: 'Joins' }).every((e) => e.category === 'Joins'));
});

test('search: every word must match, case is ignored, a nonsense word finds nothing', () => {
  assert.ok(search('LEFT JOIN', { lang: 'sql' }).some((e) => e.id === 'sql-left-join'));
  assert.deepEqual(search('zzzqqq'), []);
  assert.deepEqual(search('left zzzqqq', { lang: 'sql' }), []);
  assert.ok(search('remove duplicate', { lang: 'sql' }).some((e) => e.id === 'sql-distinct'), 'finds by description');
});

test('search: does not modify the data it searches', () => {
  const before = ENTRIES.map((e) => e.id).join();
  search('a');
  assert.equal(ENTRIES.map((e) => e.id).join(), before);
});

test('seeAlso returns the linked entries', () => {
  assert.deepEqual(seeAlso(byId('sql-having')).map((e) => e.id), ['sql-group-by', 'sql-where']);
});

test('formatRows: header, rows, NULL, dates, and the empty result', () => {
  assert.equal(formatRows([{ a: 1, b: null }, { a: 2, b: 'x' }]), 'a | b\n1 | NULL\n2 | x');
  assert.equal(formatRows([]), '(no rows)');
  assert.equal(formatRows([{ d: new Date(Date.UTC(2026, 0, 31)) }]), 'd\n2026-01-31T00:00:00.000Z');
});

test('normalise and matchesExpected compare outputs the way the test does', () => {
  assert.equal(normalise('a  \r\nb\n\n'), 'a\nb');
  assert.ok(matchesExpected({ expect: 'a\nb' }, 'a \nb\n'));
  assert.ok(!matchesExpected({ expect: 'a\nb' }, 'a\nc'));
  assert.ok(matchesExpected({ expect: 'Seq Scan on fruit', loose: true }, 'QUERY PLAN\nSeq Scan on fruit  (cost=0.00..1.06)'));
  assert.ok(!matchesExpected({ expect: 'Index Scan', loose: true }, 'Seq Scan'));
});

test('pushRecent: newest first, no repeats, capped', () => {
  assert.deepEqual(pushRecent(['a', 'b'], 'c'), ['c', 'a', 'b']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'b'), ['b', 'a', 'c']);
  assert.equal(pushRecent(['1', '2', '3'], '4', 3).length, 3);
  assert.deepEqual(pushRecent(null, 'a'), ['a']);
});
