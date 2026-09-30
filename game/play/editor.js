// editor.js: the code editor. A plain <textarea> (so phones, screen readers, undo and IME all just work)
// laid exactly over a highlighted copy of its text, with line numbers in a gutter.
//
//   createEditor(host, { onRun, label }) -> { el, value (get/set), lang (get/set), focus(), refresh() }
//     Tab inserts two spaces (or indents the selected lines), Shift+Tab outdents, Ctrl/Cmd+Enter runs,
//     Escape leaves the editor so Tab moves focus on again (the keyboard is never trapped).
//   highlight(code, lang) -> HTML    pure: keywords, strings, comments and numbers per language
//   indent(value, start, end, out?)  pure: the text and selection after Tab (out = true: Shift+Tab)
// The font comes from the theme (ui.codeFont, ui.codeSize) and follows it live.
import { get as tget, onThemeChange } from '../engine/theme.js';

const WORDS = {
  sql: 'select from where and or not null is in like between join inner left right full outer cross on using as group by order having limit offset insert into values update set delete create table drop alter add column primary key foreign references unique check default constraint index view distinct union all except intersect case when then else end exists returning begin commit rollback with asc desc true false interval count sum min max avg coalesce cast',
  js: 'const let var function return if else for while do of in new class extends this super import export from async await try catch finally throw typeof instanceof switch case break continue default null undefined true false delete void yield',
  php: 'function return if else elseif for foreach as while do new class public private protected static echo print try catch finally throw null true false array fn match use namespace isset unset empty list',
};
const SETS = Object.fromEntries(Object.entries(WORDS).map(([k, v]) => [k, new Set(v.split(' '))]));
const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// one tokenizer per language: comments, strings, numbers, words (PHP variables are words with a $)
const TOKENS = {
  sql: /(--[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:[^']|'')*'?|"[^"]*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)/g,
  js: /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`(?:\\.|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][A-Za-z0-9_$]*)/g,
  php: /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|('(?:\\.|[^'\\])*'?|"(?:\\.|[^"\\])*"?)|(\b\d+(?:\.\d+)?\b)|(\$?[A-Za-z_][A-Za-z0-9_]*)/g,
};

export function highlight(code, lang = 'sql') {
  const re = TOKENS[lang] || TOKENS.sql, set = SETS[lang] || SETS.sql;
  re.lastIndex = 0;
  let out = '', at = 0, m;
  while ((m = re.exec(code))) {
    if (m[0] === '') { re.lastIndex++; continue; }
    out += esc(code.slice(at, m.index));
    const [tok, com, str, num, word] = m;
    let cls = '';
    if (com) cls = 'c';
    else if (str) cls = 's';
    else if (num) cls = 'n';
    else if (word) {
      if (lang === 'php' && word[0] === '$') cls = 'v';
      else if (set.has(lang === 'sql' ? word.toLowerCase() : word)) cls = 'k';
    }
    out += cls ? `<span class="${cls}">${esc(tok)}</span>` : esc(tok);
    at = m.index + tok.length;
  }
  return out + esc(code.slice(at));
}

const PAD = '  ';
export function indent(value, start, end, out = false) {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  if (!out && start === end) return { value: value.slice(0, start) + PAD + value.slice(end), start: start + PAD.length, end: start + PAD.length };
  // whole lines from the one holding the selection start to the one holding its end
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const block = value.slice(lineStart, last);
  const lines = block.split('\n');
  let first = 0, total = 0;
  const next = lines.map((l, i) => {
    if (!out) { if (i === 0) first = PAD.length; total += PAD.length; return PAD + l; }
    const cut = l.startsWith(PAD) ? PAD.length : l.startsWith(' ') ? 1 : 0;
    if (i === 0) first = -cut;
    total -= cut;
    return l.slice(cut);
  }).join('\n');
  return {
    value: value.slice(0, lineStart) + next + value.slice(last),
    start: Math.max(lineStart, start + first),
    end: Math.max(lineStart, end + total),
  };
}

export function createEditor(host, { onRun, label = 'Your code' } = {}) {
  host.classList.add('ed');
  host.innerHTML = '<div class="ed-lines" aria-hidden="true"></div><div class="ed-body"><pre class="ed-hl" aria-hidden="true"></pre><textarea id="editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off"></textarea></div>';
  const lines = host.querySelector('.ed-lines'), hl = host.querySelector('.ed-hl'), ta = host.querySelector('textarea');
  ta.setAttribute('aria-label', label);
  let lang = 'sql';
  let shown = -1;
  function refresh() {
    const v = ta.value;
    hl.innerHTML = highlight(v, lang) + '\n'; // the trailing newline keeps the last empty line's height
    const n = v.split('\n').length;
    if (n !== shown) { lines.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); shown = n; }
    sync();
  }
  function sync() {
    hl.style.transform = `translate(${-ta.scrollLeft}px, ${-ta.scrollTop}px)`;
    lines.style.transform = `translateY(${-ta.scrollTop}px)`;
  }
  function font() {
    host.style.setProperty('--code-font', tget('ui.codeFont'));
    host.style.setProperty('--code-size', `${tget('ui.codeSize')}px`);
  }
  const replace = ({ value, start, end }) => {
    // execCommand keeps the browser's undo stack; fall back to a plain assignment where it is gone
    ta.focus();
    ta.setSelectionRange(0, ta.value.length);
    let ok = false;
    try { ok = document.execCommand('insertText', false, value); } catch { ok = false; }
    if (!ok || ta.value !== value) ta.value = value;
    ta.setSelectionRange(start, end);
    refresh();
  };
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onRun?.(); return; }
    if (e.key === 'Escape') { ta.blur(); return; }
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = ta;
      if (!e.shiftKey && s === en) {
        let ok = false;
        try { ok = document.execCommand('insertText', false, PAD); } catch { ok = false; }
        if (!ok) { ta.setRangeText(PAD, s, en, 'end'); }
        refresh();
        return;
      }
      replace(indent(ta.value, s, en, e.shiftKey));
    }
  });
  ta.addEventListener('input', refresh);
  ta.addEventListener('scroll', sync);
  onThemeChange((p) => { if (!p || p.startsWith('ui.code')) font(); });
  font();
  refresh();
  return {
    el: ta,
    get value() { return ta.value; },
    set value(v) { ta.value = v; refresh(); },
    get lang() { return lang; },
    set lang(l) { lang = l; host.dataset.lang = l; refresh(); },
    focus() { ta.focus(); },
    refresh,
  };
}
