import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlight, indent } from './editor.js';

test('SQL keywords, strings, numbers and comments are marked, case-insensitively', () => {
  assert.equal(highlight("select * FROM rooms WHERE id = 1 -- one", 'sql'),
    '<span class="k">select</span> * <span class="k">FROM</span> rooms <span class="k">WHERE</span> id = <span class="n">1</span> <span class="c">-- one</span>');
  assert.equal(highlight("'it''s'", 'sql'), `<span class="s">'it''s'</span>`);
});

test('JavaScript keywords are case-sensitive, template strings are strings', () => {
  assert.equal(highlight('const Const = `a`;', 'js'), '<span class="k">const</span> Const = <span class="s">`a`</span>;');
  assert.equal(highlight('// x\nreturn 2', 'js'), '<span class="c">// x</span>\n<span class="k">return</span> <span class="n">2</span>');
});

test('PHP variables, # comments and keywords', () => {
  assert.equal(highlight('$pdo->exec("x"); # done', 'php'), '<span class="v">$pdo</span>-&gt;exec(<span class="s">"x"</span>); <span class="c"># done</span>');
  assert.equal(highlight('foreach ($a as $b)', 'php'), '<span class="k">foreach</span> (<span class="v">$a</span> <span class="k">as</span> <span class="v">$b</span>)');
});

test('markup in code is escaped, and an unclosed string or comment runs to the end', () => {
  assert.equal(highlight('a < b && c > d', 'js'), 'a &lt; b &amp;&amp; c &gt; d');
  assert.equal(highlight("'open", 'sql'), `<span class="s">'open</span>`);
  assert.equal(highlight('/* open', 'js'), '<span class="c">/* open</span>');
});

test('Tab inserts two spaces at the caret', () => {
  assert.deepEqual(indent('ab', 1, 1), { value: 'a  b', start: 3, end: 3 });
});

test('Tab indents every selected line, Shift+Tab outdents them', () => {
  const v = 'one\ntwo\nthree';
  const r = indent(v, 1, 6);
  assert.equal(r.value, '  one\n  two\nthree');
  assert.deepEqual([r.start, r.end], [3, 10]);
  const o = indent(r.value, r.start, r.end, true);
  assert.equal(o.value, v);
  assert.deepEqual([o.start, o.end], [1, 6]);
});

test('Shift+Tab on a line with no indent changes nothing', () => {
  assert.deepEqual(indent('abc', 1, 1, true), { value: 'abc', start: 1, end: 1 });
});
