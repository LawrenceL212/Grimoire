// timetable.js: the week's timetable as a window (the bookings table IS the timetable: one block per row) and a
// small row inspector. Clicking a block, or a person in the office, opens that booking's row with every column
// labelled; an id that points at another table (room_id, person_id) can be followed to the row it points at.
//
//   createTimetable(el, { onPick }) -> {
//     render(objects, { from = '2026-01-05', days = 5 })   draw the week from the world's objects
//     inspect(bookingId, { follow? })   open a booking's row (follow: 'room_id' | 'person_id' also opens the row it points at)
//     followed                          the last { table, id } followed (for tests)
//     picked                            the last booking id picked
//     clear()                           forget the pick (a new ticket)
//   }
// onPick(id) is told every pick (a click on a block, or a call from the office).
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const H0 = 8, H1 = 18; // the timetable shows 08:00 to 18:00
const hm = (iso) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const COLUMNS = {
  bookings: { id: 'its own number', room_id: 'points at a row of rooms', person_id: 'points at a row of people', start_at: 'when it starts (UTC)', end_at: 'when it ends' },
  rooms: { id: 'its own number', name: 'what it is called', capacity: 'how many it seats' },
  people: { id: 'its own number', name: 'their name', role: 'staff or customer' },
};

export function createTimetable(el, { onPick } = {}) {
  let objects = { rooms: [], people: [], bookings: [] };
  let opts = { from: '2026-01-05', days: 5 };
  const api = { picked: null, followed: null };
  el.innerHTML = '<div class="tt-grid" role="grid" aria-label="The week\'s timetable: one block per booking"></div><div class="tt-inspect" aria-live="polite"></div>';
  const grid = el.querySelector('.tt-grid'), insp = el.querySelector('.tt-inspect');

  function render(o, { from = opts.from, days = opts.days } = {}) {
    objects = o; opts = { from, days };
    const start = Date.parse(`${from}T00:00:00Z`);
    const cols = Array.from({ length: days }, (_, i) => new Date(start + i * 86400000));
    const roomIdx = new Map((o.rooms || []).map((r, i) => [r.id, i]));
    const head = cols.map((d) => `<div class="tt-day">${DAYS[d.getUTCDay()]} ${d.getUTCDate()}</div>`).join('');
    const body = cols.map((d) => {
      const d0 = d.getTime(), d1 = d0 + 86400000;
      const blocks = (o.bookings || []).filter((b) => { const t = Date.parse(b.start_at); return t >= d0 && t < d1; }).map((b) => {
        const t0 = (Date.parse(b.start_at) - d0) / 3600000, t1 = (Date.parse(b.end_at) - d0) / 3600000;
        const top = Math.max(0, (t0 - H0) / (H1 - H0)) * 100, h = Math.max(4, ((Math.min(t1, H1) - Math.max(t0, H0)) / (H1 - H0)) * 100);
        const room = (o.rooms || []).find((r) => r.id === b.room_id), who = (o.people || []).find((p) => p.id === b.person_id);
        const label = `Booking ${b.id}: ${room?.name || `room ${b.room_id}`}, ${hm(b.start_at)} to ${hm(b.end_at)}, ${who?.name || `person ${b.person_id}`}`;
        // each room has its own lane in the day, so two bookings at one time never cover each other
        const lanes = Math.max(1, roomIdx.size), lane = roomIdx.get(b.room_id) ?? 0;
        return `<button type="button" class="tt-block r${lane}${api.picked === b.id ? ' is-picked' : ''}" data-id="${b.id}" style="top:${top}%;height:${h}%;left:calc(${(lane / lanes) * 100}% + 1px);width:calc(${100 / lanes}% - 2px)" title="${esc(label)}" aria-label="${esc(label)}"><b>${hm(b.start_at)}</b> ${esc(room?.name || '')}</button>`;
      }).join('');
      return `<div class="tt-col">${blocks}</div>`;
    }).join('');
    const hours = Array.from({ length: H1 - H0 + 1 }, (_, i) => `<span style="top:${(i / (H1 - H0)) * 100}%">${String(H0 + i).padStart(2, '0')}</span>`).join('');
    const legend = (o.rooms || []).map((r, i) => `<span class="tt-key r${i}"><i></i>${esc(r.name)}</span>`).join('');
    grid.innerHTML = `<div class="tt-legend">${legend}</div><div class="tt-head"><div></div>${head}</div><div class="tt-body"><div class="tt-hours">${hours}</div>${body}</div>`;
    if (api.picked != null && !(o.bookings || []).some((b) => b.id === api.picked)) { api.picked = null; insp.innerHTML = ''; }
  }
  function rowHTML(table, row, follow) {
    if (!row) return `<p class="tt-none">There is no row ${esc(String(follow))} in ${table}.</p>`;
    const labels = COLUMNS[table] || {};
    return `<table class="tt-row"><caption>${table}: row ${row.id}</caption><tbody>${Object.entries(row).map(([k, v]) => {
      const link = table === 'bookings' && (k === 'room_id' || k === 'person_id') ? ` <button type="button" class="tt-follow" data-follow="${k}">follow ${k} ›</button>` : '';
      const shown = k.endsWith('_at') ? `${new Date(v).toUTCString().slice(0, 22)}` : v;
      return `<tr><th scope="row">${esc(k)}</th><td>${esc(String(shown))}${link}<small>${esc(labels[k] || '')}</small></td></tr>`;
    }).join('')}</tbody></table>`;
  }
  function inspect(id, { follow } = {}) {
    const b = (objects.bookings || []).find((x) => x.id === Number(id));
    api.picked = b ? b.id : null;
    grid.querySelectorAll('.tt-block').forEach((n) => n.classList.toggle('is-picked', Number(n.dataset.id) === api.picked));
    let html = `<p class="tt-tip">One block on the timetable is one row of the <b>bookings</b> table. Each line below is a <b>column</b>.</p>${rowHTML('bookings', b, id)}`;
    if (b && follow) {
      const table = follow === 'room_id' ? 'rooms' : 'people';
      const row = (objects[table] || []).find((r) => r.id === b[follow]);
      api.followed = { table, id: b[follow] };
      html += `<p class="tt-tip">${esc(follow)} = ${b[follow]} points at row ${b[follow]} of <b>${table}</b>:</p>${rowHTML(table, row, b[follow])}`;
    }
    insp.innerHTML = html;
    if (b) onPick?.(b.id);
    return b || null;
  }
  el.addEventListener('click', (e) => {
    const blk = e.target.closest('.tt-block');
    if (blk) { inspect(Number(blk.dataset.id)); return; }
    const f = e.target.closest('.tt-follow');
    if (f && api.picked != null) inspect(api.picked, { follow: f.dataset.follow });
  });
  function clear() { api.picked = null; api.followed = null; insp.innerHTML = ''; grid.querySelectorAll('.is-picked').forEach((n) => n.classList.remove('is-picked')); }
  return Object.assign(api, { render, inspect, clear, el });
}
