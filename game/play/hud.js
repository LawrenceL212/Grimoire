// hud.js: the top bar. Five counters read from the real world (bookings, revenue, reputation, open
// tickets, XP and level), the office clock, a warning lamp that pulses while a ticket is open, and the
// Grimoire, Reset, Tweak and Focus buttons (Grimoire opens grimoire.js's book unless onGrimoire is given).
//
//   summarise(objects, { openTickets, xp }) -> { bookings, revenue, reputation, clashes, openTickets, xp, level }
//       pure: bookings on the timetable day, £40 each; reputation 4.8 less 0.3 per clashing pair (the same overlap
//       rule as NO_OVERLAP_SQL: same room, a.start < b.end and b.start < a.end); level = 1 + xp / 100.
//       (state.js deriveState is the source; this wraps it.)
//   clashingRooms(objects) -> Set of room ids with an overlap (pure)
//   createHud(el, { onReset, onTweak, onFocus, onGrimoire?, onLibrary?, onHome, onShop, onEdit }) -> { set(counters), setClock(text), setBusy(on), setFocus(on),
//     setBalance(n), setHome(on), setEdit(on), setShop(on) }   (the balance chip and the Home / Shop / Edit buttons: home.js)
import { get as tget, onThemeChange } from '../engine/theme.js';
import { clashPairs } from './bridge.js';
import { deriveState, PRICE } from './state.js';

export function clashingRooms(objects) { return new Set(clashPairs(objects.bookings || []).map((p) => p.roomId)); }

// the Phase 2a counters, kept for callers that pass the open tickets and XP themselves (state.js derives them)
export function summarise(objects, { openTickets = 0, xp = 0 } = {}) {
  return { ...deriveState(objects, null, null), openTickets, xp, level: 1 + Math.floor(xp / 100) };
}

const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`;
const ICON = {
  bookings: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  revenue: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 8.2c-.6-.9-1.5-1.3-2.6-1.3-1.9 0-3 1.3-3 3v5.3M7.8 12.3h5M7.8 16.2h7.4"/></svg>',
  reputation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
  tickets: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/></svg>',
  balance: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/></svg>',
  xp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/></svg>',
};
const LABEL = { bookings: 'Bookings', revenue: 'Revenue', reputation: 'Reputation', tickets: 'Open tickets', xp: 'XP', balance: 'Balance' };

export function createHud(el, { onReset, onTweak, onFocus, onGrimoire, onLibrary, onHome, onShop, onEdit } = {}) {
  el.innerHTML = `
    <div class="counters" role="group" aria-label="Your company">
      ${Object.keys(LABEL).map((k) => `<div class="ctr" data-ctr="${k}">${ICON[k]}<span class="lbl">${LABEL[k]}</span><b>–</b>${k === 'xp' ? '<small class="lvl">Lv 1</small>' : ''}</div>`).join('')}
    </div>
    <div class="hud-right">
      <div class="clock" id="hud-clock" title="The office clock">Day 1</div>
      <div class="warn" id="hud-warn" role="status" aria-label="No open tickets"><i></i></div>
      <button type="button" class="hud-btn" id="hud-grimoire" title="Open the Grimoire, your book of spells" aria-label="Grimoire" aria-expanded="false" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h11.5M9 8.5h6"/></svg><span>Grimoire</span></button>
      <button type="button" class="hud-btn" id="hud-library" title="The Library: look up any statement, function or operator, any time. It is documentation, free to use" aria-label="Library" aria-expanded="false" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/></svg><span>Library</span></button>
      <button type="button" class="hud-btn" id="hud-home" aria-pressed="false" title="Go home to your room, or back to the office">Home</button>
      <button type="button" class="hud-btn" id="hud-shop" aria-expanded="false" aria-haspopup="dialog" title="The furniture shop">Shop</button>
      <button type="button" class="hud-btn" id="hud-edit" aria-pressed="false" title="Move, turn, sell and recolour your furniture" hidden>Edit</button>
      <button type="button" class="hud-btn" id="hud-focus" aria-pressed="false" title="Focus the camera on the ticket (F)">Focus</button>
      <button type="button" class="hud-btn" id="hud-tweak" title="Tweak the look (T)">Tweak</button>
      <button type="button" class="hud-btn" id="hud-reset" title="Put the world back as it was when the ticket arrived">Reset</button>
    </div>`;
  const q = (s) => el.querySelector(s);
  q('#hud-reset').addEventListener('click', () => onReset?.());
  q('#hud-tweak').addEventListener('click', () => onTweak?.());
  q('#hud-home').addEventListener('click', () => onHome?.());
  q('#hud-shop').addEventListener('click', () => onShop?.());
  q('#hud-edit').addEventListener('click', () => onEdit?.());
  q('#hud-focus').addEventListener('click', () => onFocus?.());
  // the Grimoire: opened here (lazily) unless the page passes its own handler
  q('#hud-grimoire').addEventListener('click', () => (onGrimoire ? onGrimoire() : import('./grimoire.js').then((m) => m.grimoire().toggle())));
  // the Library: a lookup panel (reference/panel.js), opened lazily; free to open, it touches no credit or help
  q('#hud-library').addEventListener('click', () => (onLibrary ? onLibrary() : import('../reference/panel.js').then((m) => m.reference().toggle())));
  const scale = () => el.style.setProperty('--hud-scale', String(tget('ui.hudScale') || 1));
  onThemeChange((p) => { if (!p || p === 'ui.hudScale') scale(); });
  scale();
  const last = {};
  function put(k, text, title) {
    const c = q(`[data-ctr="${k}"]`), b = c.querySelector('b');
    if (b.textContent === text) return;
    const had = last[k] !== undefined;
    b.textContent = text; last[k] = text;
    c.title = title;
    if (had) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
  }
  return {
    set(s) {
      put('bookings', String(s.bookings), `${s.bookings} bookings today`);
      put('revenue', money(s.revenue), `£${PRICE} a booking`);
      put('reputation', `★ ${s.reputation.toFixed(1)}`, s.clashes ? `${s.clashes} double booking${s.clashes > 1 ? 's' : ''} (a pair of overlapping bookings in one room) costing 0.3 each` : 'No double bookings');
      put('tickets', String(s.openTickets), `${s.openTickets} open ticket${s.openTickets === 1 ? '' : 's'}`);
      put('xp', String(s.xp), `Level ${s.level}`);
      q('.lvl').textContent = `Lv ${s.level}`;
      const warn = q('#hud-warn');
      warn.classList.toggle('is-on', s.openTickets > 0);
      warn.setAttribute('aria-label', s.openTickets > 0 ? `${s.openTickets} open ticket${s.openTickets === 1 ? '' : 's'}` : 'No open tickets');
    },
    // the spendable balance (£), earned only by honest solves (home-rules.js)
    setBalance(n) { put('balance', money(n), 'Your spendable balance: earned only by solving fresh problems on your own'); },
    setHome(on) {
      const b = q('#hud-home'); b.textContent = on ? 'Office' : 'Home'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on);
      q('#hud-edit').hidden = !on;
      if (!on) { q('#hud-edit').setAttribute('aria-pressed', 'false'); q('#hud-edit').classList.remove('is-on'); }
    },
    setEdit(on) { const b = q('#hud-edit'); b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on); },
    setShop(on) { q('#hud-shop').setAttribute('aria-expanded', String(on)); q('#hud-shop').classList.toggle('is-on', on); },
    setClock(text) { q('#hud-clock').textContent = text; },
    setBusy(on) { q('#hud-reset').disabled = on; },
    setFocus(on) { q('#hud-focus').setAttribute('aria-pressed', String(on)); q('#hud-focus').classList.toggle('is-on', on); },
  };
}
