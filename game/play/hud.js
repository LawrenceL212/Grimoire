// hud.js: the top bar. Five counters read from the real world (bookings, revenue, reputation, open
// tickets, XP and level), the office clock, a warning lamp that pulses while a ticket is open, and the
// Reset, Tweak and Focus buttons.
//
//   summarise(objects, { openTickets, xp, day }) -> { bookings, revenue, reputation, clashes, openTickets, xp, level }
//       pure: bookings on the timetable day, £40 each; reputation 4.8 less 0.3 per clash (the same overlap
//       rule as NO_OVERLAP_SQL: same room, a.start < b.end and b.start < a.end); level = 1 + xp / 100.
//       (Task 9's state.js takes this over as deriveState.)
//   clashingRooms(objects) -> Set of room ids with an overlap (pure)
//   createHud(el, { onReset, onTweak, onFocus }) -> { set(counters), setClock(text), setBusy(on), setFocus(on) }
import { get as tget, onThemeChange } from '../engine/theme.js';

export const PRICE = 40, BASE_REPUTATION = 4.8, CLASH_COST = 0.3, XP_PER_LEVEL = 100;
const t = (iso) => Date.parse(iso);

function clashPairs(bookings) {
  const out = [];
  for (let i = 0; i < bookings.length; i++) {
    for (let j = i + 1; j < bookings.length; j++) {
      const a = bookings[i], b = bookings[j];
      if (a.room_id === b.room_id && t(a.start_at) < t(b.end_at) && t(b.start_at) < t(a.end_at)) out.push([a, b]);
    }
  }
  return out;
}
export function clashingRooms(objects) { return new Set(clashPairs(objects.bookings || []).map(([a]) => a.room_id)); }

export function summarise(objects, { openTickets = 0, xp = 0, day = '2026-01-01' } = {}) {
  const all = objects.bookings || [];
  const bookings = all.filter((b) => String(b.start_at).slice(0, 10) === day).length;
  const clashes = clashPairs(all).length;
  return {
    bookings,
    revenue: bookings * PRICE,
    reputation: Math.max(0, Math.round((BASE_REPUTATION - CLASH_COST * clashes) * 10) / 10),
    clashes,
    openTickets,
    xp,
    level: 1 + Math.floor(xp / XP_PER_LEVEL),
  };
}

const money = (n) => `£${Math.round(n).toLocaleString('en-GB')}`;
const ICON = {
  bookings: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  revenue: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.5 8.2c-.6-.9-1.5-1.3-2.6-1.3-1.9 0-3 1.3-3 3v5.3M7.8 12.3h5M7.8 16.2h7.4"/></svg>',
  reputation: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
  tickets: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/></svg>',
  xp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/></svg>',
};
const LABEL = { bookings: 'Bookings', revenue: 'Revenue', reputation: 'Reputation', tickets: 'Open tickets', xp: 'XP' };

export function createHud(el, { onReset, onTweak, onFocus } = {}) {
  el.innerHTML = `
    <div class="counters" role="group" aria-label="Your company">
      ${Object.keys(LABEL).map((k) => `<div class="ctr" data-ctr="${k}">${ICON[k]}<span class="lbl">${LABEL[k]}</span><b>–</b>${k === 'xp' ? '<small class="lvl">Lv 1</small>' : ''}</div>`).join('')}
    </div>
    <div class="hud-right">
      <div class="clock" id="hud-clock" title="The office clock">Day 1</div>
      <div class="warn" id="hud-warn" role="status" aria-label="No open tickets"><i></i></div>
      <button type="button" class="hud-btn" id="hud-focus" aria-pressed="false" title="Focus the camera on the ticket (F)">Focus</button>
      <button type="button" class="hud-btn" id="hud-tweak" title="Tweak the look (T)">Tweak</button>
      <button type="button" class="hud-btn" id="hud-reset" title="Put the world back as it was when the ticket arrived">Reset</button>
    </div>`;
  const q = (s) => el.querySelector(s);
  q('#hud-reset').addEventListener('click', () => onReset?.());
  q('#hud-tweak').addEventListener('click', () => onTweak?.());
  q('#hud-focus').addEventListener('click', () => onFocus?.());
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
      put('reputation', `★ ${s.reputation.toFixed(1)}`, s.clashes ? `${s.clashes} double booking${s.clashes > 1 ? 's' : ''} hurting your reputation` : 'No double bookings');
      put('tickets', String(s.openTickets), `${s.openTickets} open ticket${s.openTickets === 1 ? '' : 's'}`);
      put('xp', String(s.xp), `Level ${s.level}`);
      q('.lvl').textContent = `Lv ${s.level}`;
      const warn = q('#hud-warn');
      warn.classList.toggle('is-on', s.openTickets > 0);
      warn.setAttribute('aria-label', s.openTickets > 0 ? `${s.openTickets} open ticket${s.openTickets === 1 ? '' : 's'}` : 'No open tickets');
    },
    setClock(text) { q('#hud-clock').textContent = text; },
    setBusy(on) { q('#hud-reset').disabled = on; },
    setFocus(on) { q('#hud-focus').setAttribute('aria-pressed', String(on)); q('#hud-focus').classList.toggle('is-on', on); },
  };
}
