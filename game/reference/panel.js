// panel.js: the Library panel, a docked drawer over the play page. It is documentation, so opening it, searching it
// and running its examples never costs credit, marks help, or touches the world, the ticket or the progress record
// (nothing here imports them). Only two small preferences (last language, recently opened) are kept, in
// localStorage under 'grimoire.reference.v1', and only if storage works.
//
//   createReference({ host = document.body }) -> { el, ready, open(entryId?), close(), toggle(), isOpen() }
//   reference() -> the page's one panel (made on first use; the HUD's Library button opens it)
// Keys: Esc closes (while the panel has the focus). The panel does not dim or block the game, so it can stay open mid-ticket.
import { LANGS, ENTRIES, byId, categories, search, seeAlso, pushRecent } from './library.js';

const KEY = 'grimoire.reference.v1';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let styled = null;
function addStyles() {
  if (styled) return styled;
  const have = document.getElementById('rf-css');
  if (have) return (styled = Promise.resolve());
  const l = document.createElement('link');
  l.id = 'rf-css'; l.rel = 'stylesheet'; l.href = new URL('./reference.css', import.meta.url).href;
  styled = new Promise((res) => { l.onload = l.onerror = () => res(); });
  document.head.appendChild(l);
  return styled;
}

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return s && typeof s === 'object' ? s : {}; } catch { return {}; }
}
function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: preferences last this visit */ } }

export function createReference({ host = document.body } = {}) {
  const ready = addStyles();
  const prefs = load();
  let lang = LANGS.some((l) => l.id === prefs.lang) ? prefs.lang : 'sql';
  let recent = (Array.isArray(prefs.recent) ? prefs.recent : []).filter((id) => byId(id)).slice(0, 8);
  let category = null, query = '', entryId = null, opened = false, returnFocus = null, runToken = 0;

  const el = document.createElement('aside');
  el.className = 'rf-panel';
  el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Reference library');
  el.innerHTML = `
    <header class="rf-head"><h2>Library</h2><span class="rf-free">Docs: free to use, any time</span>
      <button type="button" class="rf-close" aria-label="Close the library" title="Close (Esc)">×</button></header>
    <div class="rf-tabs" role="group" aria-label="Language">${LANGS.map((l) => `<button type="button" class="rf-tab" data-lang="${l.id}" aria-pressed="false">${l.name}</button>`).join('')}</div>
    <div class="rf-browse">
      <input type="search" class="rf-search" placeholder="Search names and descriptions" aria-label="Search the library" autocomplete="off" spellcheck="false">
      <div class="rf-cats" role="group" aria-label="Category"></div>
      <div class="rf-recent" hidden><span>Recently opened</span><div class="rf-recent-list"></div></div>
      <p class="rf-count" aria-live="polite"></p>
      <ul class="rf-list"></ul>
    </div>
    <article class="rf-entry" hidden></article>`;
  host.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const $$ = (s) => [...el.querySelectorAll(s)];

  const remember = () => save({ lang, recent });

  // ---- the list
  function renderCats() {
    const cats = categories(lang);
    $('.rf-cats').innerHTML = [`<button type="button" class="rf-chip${category === null ? ' is-on' : ''}" data-cat="" aria-pressed="${category === null}">All</button>`,
      ...cats.map((c) => `<button type="button" class="rf-chip${category === c.name ? ' is-on' : ''}" data-cat="${esc(c.name)}" aria-pressed="${category === c.name}">${esc(c.name)} <small>${c.count}</small></button>`)].join('');
  }
  function renderRecent() {
    const items = recent.map(byId).filter(Boolean);
    $('.rf-recent').hidden = !items.length;
    $('.rf-recent-list').innerHTML = items.map((e) => `<button type="button" class="rf-chip rf-chip-recent" data-open="${e.id}" data-lang="${e.lang}">${esc(e.name)}</button>`).join('');
  }
  function renderList() {
    const list = search(query, { lang, category });
    $('.rf-count').textContent = query.trim() ? `${list.length} match${list.length === 1 ? '' : 'es'}` : `${list.length} entries`;
    $('.rf-list').innerHTML = list.length
      ? list.map((e) => `<li><button type="button" class="rf-row" data-open="${e.id}"><b>${esc(e.name)}</b><span>${esc(e.summary)}</span></button></li>`).join('')
      : '<li class="rf-none">Nothing matches. Try one word, or pick All.</li>';
  }
  function renderTabs() { $$('.rf-tab').forEach((b) => { const on = b.dataset.lang === lang; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on); }); }
  function renderBrowse() { renderTabs(); renderCats(); renderRecent(); renderList(); }

  // ---- one entry
  function chips(ids) { return ids.map((e) => `<button type="button" class="rf-chip" data-open="${e.id}">${esc(e.name)}</button>`).join(''); }
  function renderEntry(e) {
    const web = e.lang === 'web';
    const sees = seeAlso(e);
    $('.rf-entry').innerHTML = `
      <button type="button" class="rf-back">‹ Back to the list</button>
      <h3 class="rf-name">${esc(e.name)}</h3>
      <code class="rf-sig">${esc(e.signature)}</code>
      <p class="rf-sum">${esc(e.summary)}</p>
      ${e.setup ? `<details class="rf-setup"><summary>Starting data</summary><pre><code>${esc(e.setup)}</code></pre></details>` : ''}
      <div class="rf-label">Example</div>
      <pre class="rf-code"><code>${esc(e.example)}</code></pre>
      ${e.norun ? `<p class="rf-norun">${esc(e.norun)}</p>`
        : `<button type="button" class="rf-try" data-try="${e.id}">${web ? 'Show it ▶' : 'Try it ▶'}</button>`}
      <div class="rf-out" aria-live="polite" data-state="idle"></div>
      <div class="rf-label">You should see</div>
      <pre class="rf-expect">${esc(e.expectError ? `An error from PostgreSQL: "${e.expectError}"` : e.expect)}</pre>
      <div class="rf-label">Common mistake</div>
      <p class="rf-mistake">${esc(e.mistake)}</p>
      ${sees.length ? `<div class="rf-label">See also</div><div class="rf-see">${chips(sees)}</div>` : ''}`;
  }
  async function tryIt(e) {
    const out = $('.rf-out'), btn = $('.rf-try');
    const token = ++runToken;
    out.dataset.state = 'running'; out.textContent = 'Running…';
    if (btn) btn.disabled = true;
    try {
      if (e.lang === 'web') {
        out.textContent = '';
        const frame = await (await import('./run.js')).renderWeb(e, out);
        if (token !== runToken) return;
        out.dataset.state = 'ok';
        out.insertAdjacentHTML('beforeend', `<p class="rf-tag is-ok">${esc(e.expect)}</p>`);
        void frame;
      } else {
        const res = await (await import('./run.js')).runEntry(e);
        if (token !== runToken) return; // another entry was opened or run since
        const body = res.ok ? (res.text || '(it printed nothing)') : `${res.text ? res.text + '\n' : ''}${e.expectError ? '' : 'Error: '}${res.error}`;
        out.dataset.state = res.ok ? 'ok' : (e.expectError && res.matches ? 'refused' : 'error');
        out.innerHTML = `<pre>${esc(body)}</pre><p class="rf-tag ${res.matches ? 'is-ok' : 'is-bad'}">${res.matches ? 'Matches what this page says.' : 'Differs from what this page says. Please report it.'}</p>`;
      }
    } catch (err) {
      if (token === runToken) { out.dataset.state = 'error'; out.textContent = `Could not run it: ${String((err && err.message) || err)}`; }
    } finally {
      if (btn && token === runToken) btn.disabled = false;
    }
  }

  function showEntry(id) {
    const e = byId(id);
    if (!e) return;
    runToken++;
    entryId = id;
    lang = e.lang;
    recent = pushRecent(recent, id); remember();
    renderEntry(e); renderBrowse();
    $('.rf-browse').hidden = true; $('.rf-tabs').hidden = false; $('.rf-entry').hidden = false;
    $('.rf-entry').scrollTop = 0;
    $('.rf-back').focus({ preventScroll: true });
  }
  function showList({ focus = true } = {}) {
    runToken++;
    entryId = null;
    $('.rf-entry').hidden = true; $('.rf-browse').hidden = false;
    renderBrowse();
    if (focus) $('.rf-search').focus({ preventScroll: true });
  }

  // ---- open / close
  function open(id) {
    returnFocus = document.activeElement;
    opened = true; el.hidden = false;
    document.getElementById('hud-library')?.setAttribute('aria-expanded', 'true');
    if (id && byId(id)) showEntry(id); else if (entryId) $('.rf-back').focus({ preventScroll: true }); else showList();
    requestAnimationFrame(() => el.classList.add('is-open'));
  }
  function close() {
    if (!opened) return;
    opened = false; runToken++; el.classList.remove('is-open'); el.hidden = true;
    document.getElementById('hud-library')?.setAttribute('aria-expanded', 'false');
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
  }

  // ---- input
  let typing = 0;
  $('.rf-search').addEventListener('input', (ev) => {
    query = ev.target.value;
    cancelAnimationFrame(typing);
    typing = requestAnimationFrame(renderList); // instant: the filter runs over a few hundred short entries
  });
  el.addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    if (t.classList.contains('rf-close')) close();
    else if (t.classList.contains('rf-back')) showList();
    else if (t.dataset.open) showEntry(t.dataset.open);
    else if (t.dataset.try) { const e = byId(t.dataset.try); if (e) tryIt(e); }
    else if (t.classList.contains('rf-tab')) { lang = t.dataset.lang; category = null; remember(); if (entryId) showList({ focus: false }); else renderBrowse(); }
    else if (t.classList.contains('rf-chip') && t.dataset.cat !== undefined) { category = t.dataset.cat || null; renderCats(); renderList(); }
  });
  // keys typed here are for the panel: the game's own shortcuts (F, T, arrows) must not fire
  for (const type of ['keydown', 'keyup']) {
    el.addEventListener(type, (ev) => {
      if (type === 'keydown' && ev.key === 'Escape') { ev.preventDefault(); if (query && ev.target.classList.contains('rf-search')) { query = ''; ev.target.value = ''; renderList(); } else close(); }
      ev.stopPropagation();
    });
  }

  renderBrowse();
  return {
    el, ready, open, close,
    toggle() { if (opened) close(); else open(); },
    isOpen: () => opened,
    get count() { return ENTRIES.length; },
  };
}

let ONE = null;
export function reference() { return (ONE ??= createReference()); }
