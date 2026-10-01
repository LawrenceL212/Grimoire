// grimoire.js: the Grimoire, the book of spells, as an overlay over the game: a leather-bound book with a two-page
// spread (one page at a time on a phone), turned with a page-turn animation.
//
// The first page is the contents: every spell, and a meter per drone (how many of its forms are written in, and how
// well the ink is holding). Then one page per spell (spells.js SPELLS): its name, a one-line description, and its
// SQL, JavaScript and PHP forms, each marked by the drone that speaks that language (Sequel, Jay, Hex). Only the
// forms introduced so far are shown. A spell not met yet is a blank page; a spell met but never cast unaided is in
// faint pencil outline (UNWRITTEN); once cast unaided it is WRITTEN in ink, and the ink follows the memory meter:
// fresh = full ink, fading = faded, due = very faint with "re-ink soon"; "kept about N days" is how long it holds.
//
//   createGrimoire({ host = document.body, store (default: the page's default store, read at each render), now = Date.now } = {}) -> {
//     el, ready (a promise: the stylesheet has loaded), open(spellId?), close(), toggle(), isOpen(), show(pageIndex, { animate }), next(), prev(),
//     page (the first page showing), pages (count), refresh(), dispose() }
//   grimoire() -> the page's one Grimoire (made on first use; the HUD button opens it)
// Keys while open: Esc closes, Left / Right turn the page. The stylesheet (grimoire.css) is added on first use.
import { SPELLS, LANGS, inkOf, defaultStore, INK_WORDS } from './spells.js';
import { get as tget, onThemeChange } from '../engine/theme.js';

const PHONE = '(max-width: 720px)';
const RM = '(prefers-reduced-motion: reduce)';
const mq = (q) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];
const LANG_ORDER = ['sql', 'js', 'php'];

let styled = null; // resolves when the stylesheet has loaded (or failed: the book still works, unstyled)
function addStyles() {
  if (styled) return styled;
  const have = document.getElementById('gm-book-css');
  if (have) return (styled = Promise.resolve());
  const l = document.createElement('link');
  l.id = 'gm-book-css'; l.rel = 'stylesheet'; l.href = new URL('./grimoire.css', import.meta.url).href;
  styled = new Promise((res) => { l.onload = l.onerror = () => res(); });
  document.head.appendChild(l);
  return styled;
}
const ringOf = (lang) => tget(`palette.${LANGS[lang].ring}`) || '#d9a441';

export function createGrimoire({ host = document.body, store = null, now = Date.now } = {}) {
  const book = () => store || defaultStore(); // the life's store may be handed over after the book is made
  const ready = addStyles();
  const el = document.createElement('div');
  el.className = 'gm-book-overlay';
  el.hidden = true;
  el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'The Grimoire');
  el.innerHTML = `
    <div class="gm-book">
      <button type="button" class="gm-close" aria-label="Close the Grimoire" title="Close (Esc)">×</button>
      <div class="gm-spread"></div>
      <nav class="gm-nav" aria-label="Pages">
        <button type="button" class="gm-turn gm-prev" aria-label="Previous page">‹ <span>Back</span></button>
        <span class="gm-folio" aria-live="polite"></span>
        <button type="button" class="gm-turn gm-next" aria-label="Next page"><span>Next</span> ›</button>
      </nav>
    </div>`;
  host.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const spread = $('.gm-spread');
  const pages = SPELLS.length + 1; // the contents, then one page per spell
  let page = 0, opened = false, returnFocus = null, leafTimer = 0;

  const perSpread = () => (mq(PHONE) ? 1 : 2);
  const first = (p) => (perSpread() === 2 ? p - (p % 2) : p);

  // ---- one page's HTML
  function contentsHTML() {
    const t = now();
    const rows = SPELLS.map((s, i) => {
      const st = book().getSpellState(s.id), ink = inkOf(st, t);
      const name = st.introduced ? esc(s.name) : '· · ·';
      const said = st.introduced ? `${s.name}: ${INK_WORDS[ink.status]}` : `Spell ${ROMAN[i] || i + 1}: ${INK_WORDS.unknown}`;
      return `<li><button type="button" class="gm-toc is-${ink.status}" data-goto="${i + 1}" style="--ink-a:${ink.opacity}" aria-label="${esc(said)}">
        <span class="gm-toc-name">${name}</span><span class="gm-toc-dots"></span><span class="gm-toc-num">${ROMAN[i] || i + 1}</span></button></li>`;
    }).join('');
    const meters = LANG_ORDER.map((lang) => {
      let met = 0, written = 0, ink = 0;
      for (const s of SPELLS) {
        const st = book().getSpellState(s.id);
        if (!st.langs.includes(lang)) continue;
        met++;
        const f = st.forms[lang];
        if (f && f.written) { written++; ink += inkOf({ ...st, ...f, introduced: true }, t).opacity; }
      }
      const pct = written ? Math.round((ink / written) * 100) : 0;
      const L = LANGS[lang];
      return `<div class="gm-meter" data-lang="${lang}" style="--ring:${ringOf(lang)}">
        <div class="gm-meter-who"><i></i><b>${L.droneName}</b> <span>${L.name}</span></div>
        <div class="gm-meter-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${L.droneName}'s ink"><div style="width:${pct}%"></div></div>
        <div class="gm-meter-note">${met ? `${written} of ${met} written${written ? ` · ink ${pct}%` : ''}` : 'Not met yet'}</div></div>`;
    }).join('');
    return `<article class="gm-page gm-contents" data-page="0">
      <h2 class="gm-title">Grimoire</h2>
      <p class="gm-epigraph">Every spell you truly learn will be written in here. Stop using it, and the ink fades.</p>
      <ol class="gm-toc-list">${rows}</ol>
      <div class="gm-meters">${meters}</div>
    </article>`;
  }
  function spellHTML(i) {
    const s = SPELLS[i], st = book().getSpellState(s.id), t = now(), ink = inkOf(st, t);
    const num = ROMAN[i] || String(i + 1);
    if (ink.status === 'unknown') {
      return `<article class="gm-page gm-spell is-unknown" data-page="${i + 1}" data-spell="${s.id}" data-status="unknown">
        <header><span class="gm-num">${num}</span></header>
        <p class="gm-blank">A blank page. Something will be written here once you meet it.</p></article>`;
    }
    const forms = st.langs.map((lang) => {
      const L = LANGS[lang], f = st.forms[lang];
      const fInk = f && f.written ? inkOf({ ...st, ...f, introduced: true, written: true }, t) : inkOf({ ...st, written: false, introduced: true }, t);
      return `<section class="gm-form is-${fInk.status}" data-lang="${lang}" style="--ring:${ringOf(lang)};--ink-a:${fInk.opacity}">
        <div class="gm-by"><i aria-hidden="true"></i><b>${L.droneName}</b><span>${L.name}</span><em>${fInk.status === 'unwritten' ? 'pencil' : fInk.status === 'fresh' ? 'ink' : fInk.status === 'fading' ? 'fading' : 'faint'}</em></div>
        <pre class="gm-ink"><code>${esc(s.forms[lang])}</code></pre></section>`;
    }).join('');
    const label = ink.status === 'unwritten' ? 'UNWRITTEN' : 'WRITTEN';
    return `<article class="gm-page gm-spell is-${ink.status}" data-page="${i + 1}" data-spell="${s.id}" data-status="${ink.status}" style="--ink-a:${ink.opacity}">
      <header><span class="gm-num">${num}</span><h3 class="gm-name gm-ink">${esc(s.name)}</h3><span class="gm-seal">${label}</span><span class="gm-sr">${esc(INK_WORDS[ink.status])}</span></header>
      <p class="gm-line gm-ink">${esc(s.line)}</p>
      <div class="gm-forms">${forms}</div>
      <footer class="gm-status">${esc(ink.line)}</footer>
    </article>`;
  }
  const pageHTML = (p) => (p === 0 ? contentsHTML() : p <= SPELLS.length ? spellHTML(p - 1) : '<article class="gm-page gm-end" aria-hidden="true"></article>');

  function render() {
    const n = perSpread(), p0 = first(page);
    el.classList.toggle('is-single', n === 1);
    spread.innerHTML = Array.from({ length: n }, (_, k) => pageHTML(p0 + k)).join('');
    const last = Math.min(pages, p0 + n);
    $('.gm-folio').textContent = n === 1 ? `Page ${p0 + 1} of ${pages}` : `Pages ${p0 + 1}–${last} of ${pages}`;
    $('.gm-prev').disabled = p0 === 0;
    $('.gm-next').disabled = p0 + n >= pages;
  }

  // ---- the page turn: the old page, as a leaf, swings over the spine while the new spread shows under it
  function turn(dir) {
    if (mq(RM) || !opened) return;
    const side = dir > 0 ? spread.lastElementChild : spread.firstElementChild;
    if (!side) return;
    const leaf = side.cloneNode(true);
    leaf.classList.add('gm-leaf', dir > 0 ? 'gm-leaf-next' : 'gm-leaf-prev');
    leaf.setAttribute('aria-hidden', 'true');
    leaf.style.left = `${side.offsetLeft}px`; leaf.style.top = `${side.offsetTop}px`;
    leaf.style.width = `${side.offsetWidth}px`; leaf.style.height = `${side.offsetHeight}px`;
    return leaf;
  }
  function show(p, { animate = true } = {}) {
    p = Math.max(0, Math.min(pages - 1, p | 0));
    const before = first(page), after = first(p);
    const leaf = animate && after !== before ? turn(after > before ? 1 : -1) : null;
    page = p;
    render();
    if (leaf) {
      clearTimeout(leafTimer);
      spread.querySelectorAll('.gm-leaf').forEach((x) => x.remove());
      spread.appendChild(leaf);
      const done = () => leaf.remove();
      leaf.addEventListener('animationend', done, { once: true });
      leafTimer = setTimeout(done, 900);
    }
    return page;
  }
  function open(spellId) {
    if (spellId) { const i = SPELLS.findIndex((s) => s.id === spellId); if (i >= 0) page = i + 1; }
    returnFocus = document.activeElement;
    opened = true; el.hidden = false;
    expanded(true);
    render();
    requestAnimationFrame(() => el.classList.add('is-open'));
    $('.gm-close').focus({ preventScroll: true });
  }
  function close() {
    if (!opened) return;
    opened = false; el.classList.remove('is-open'); el.hidden = true;
    expanded(false);
    spread.querySelectorAll('.gm-leaf').forEach((x) => x.remove());
    if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus({ preventScroll: true });
  }
  // the HUD's book button says whether the book is open
  function expanded(on) { document.getElementById('hud-grimoire')?.setAttribute('aria-expanded', String(on)); }
  const next = () => show(first(page) + perSpread());
  const prev = () => show(first(page) - perSpread());

  // ---- input
  $('.gm-close').addEventListener('click', close);
  $('.gm-next').addEventListener('click', next);
  $('.gm-prev').addEventListener('click', prev);
  el.addEventListener('click', (e) => {
    if (e.target === el) { close(); return; } // a click on the dimmed backdrop
    const g = e.target.closest('[data-goto]');
    if (g) show(Number(g.dataset.goto));
  });
  const onKey = (e) => {
    if (!opened) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight' && !e.target.closest?.('pre')) { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' && !e.target.closest?.('pre')) { e.preventDefault(); prev(); }
    else if (e.key === 'Tab') { // keep the focus inside the book
      const f = [...el.querySelectorAll('button:not([disabled])')];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', onKey, true);
  const phone = typeof matchMedia === 'function' ? matchMedia(PHONE) : null;
  const onPhone = () => { if (opened) render(); };
  phone?.addEventListener?.('change', onPhone);
  const offTheme = onThemeChange((p) => { if (opened && (!p || p.startsWith('palette.drone'))) render(); });

  return {
    el, ready, open, close, show, next, prev,
    toggle() { if (opened) close(); else open(); },
    isOpen: () => opened,
    get page() { return first(page); },
    pages,
    refresh() { if (opened) render(); },
    dispose() { close(); document.removeEventListener('keydown', onKey, true); phone?.removeEventListener?.('change', onPhone); offTheme(); el.remove(); },
  };
}

let ONE = null;
export function grimoire() { return (ONE ??= createGrimoire()); }
