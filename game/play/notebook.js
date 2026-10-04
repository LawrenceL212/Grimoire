// notebook.js: Priya's paper notebook as a window (product arc, S0). Two pages, Rooms and Bookings, drawn as a
// grid on paper; every cell can be clicked (a row and a column at once). Each page can be re-sorted, so the
// tickets that ask "which one?" are answered by what a line says, not where it sits.
//
//   createNotebook(el, { onCell }) -> {
//     show(page)                 open a page ('rooms' | 'bookings')
//     sort(col | null)           re-sort the open page (null: as Priya wrote it)
//     highlight(page, rowKey)    open the page with one line marked (a Learn card's example)
//     picked                     the last { page, row, col } clicked
//     page, sorted               the page open, and its sort
//     clear()
//   }
// onCell({ page, row, col, value }) is told every click.
import { NOTEBOOK, sortedRows } from '../problems/arc/notebook.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function createNotebook(el, { onCell } = {}) {
  const api = { picked: null, page: 'bookings', sorted: null, mark: null };
  el.innerHTML = '<div class="nb-tabs" role="tablist" aria-label="Notebook pages"></div><div class="nb-tools"></div><div class="nb-page"></div>';
  const tabs = el.querySelector('.nb-tabs'), tools = el.querySelector('.nb-tools'), sheet = el.querySelector('.nb-page');
  function render() {
    const p = NOTEBOOK.pages[api.page];
    tabs.innerHTML = Object.entries(NOTEBOOK.pages).map(([id, pg]) => `<button type="button" role="tab" class="nb-tab${id === api.page ? ' is-on' : ''}" aria-selected="${id === api.page}" data-page="${id}">${esc(pg.title)}</button>`).join('');
    tools.innerHTML = p.sorts.map((s) => `<button type="button" class="nb-sort${api.sorted === s.col ? ' is-on' : ''}" data-sort="${s.col}">${esc(s.label)}</button>`).join('')
      + (api.sorted ? '<button type="button" class="nb-sort" data-sort="">As written</button>' : '');
    const rows = sortedRows(api.page, api.sorted);
    const head = p.columns.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('');
    const body = rows.map((r) => `<tr data-row="${r.key}" class="${api.mark === r.key ? 'is-marked' : ''}">${p.columns.map((c) => {
      const on = api.picked && api.picked.page === api.page && api.picked.row === r.key && api.picked.col === c.id;
      const label = `${p.title}, line ${r.key}, ${c.label}: ${r[c.id]}`;
      return `<td><button type="button" class="nb-cell${on ? ' is-picked' : ''}" data-row="${r.key}" data-col="${c.id}" aria-label="${esc(label)}">${esc(String(r[c.id]))}</button></td>`;
    }).join('')}</tr>`).join('');
    sheet.innerHTML = `<table class="nb-grid" aria-label="${esc(`Priya's notebook: ${p.title}`)}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      <p class="nb-foot">${api.page === 'bookings' ? 'Room is the number from the Rooms page.' : 'Priya numbered her rooms; the bookings use the number.'}</p>`;
  }
  el.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-page]');
    if (tab) { api.page = tab.dataset.page; api.sorted = null; api.mark = null; render(); return; }
    const s = e.target.closest('[data-sort]');
    if (s) { api.sorted = s.dataset.sort || null; render(); return; }
    const cell = e.target.closest('.nb-cell');
    if (!cell) return;
    const row = Number(cell.dataset.row), col = cell.dataset.col;
    const value = NOTEBOOK.pages[api.page].rows.find((r) => r.key === row)?.[col];
    api.picked = { page: api.page, row, col };
    render();
    onCell?.({ page: api.page, row, col, value });
  });
  render();
  return Object.assign(api, {
    show(page) { if (NOTEBOOK.pages[page]) { if (api.page !== page) { api.sorted = null; api.mark = null; } api.page = page; render(); } },
    sort(col) { api.sorted = col || null; render(); },
    highlight(page, row) { api.page = page; api.sorted = null; api.mark = row; render(); },
    clear() { api.picked = null; api.mark = null; render(); },
  });
}
