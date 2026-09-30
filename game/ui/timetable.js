const DAY_START_HOUR = 8;
const DAY_HOURS = 8; // 08:00 to 16:00
const HOUR_MS = 3600000;
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const wantsReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* The front-of-house view. render() takes a world snapshot and diffs it against
   what is on screen: new bookings spring in, removed ones fade out, and a
   booking that overlaps an earlier one in the same room is flagged as a clash.
   It draws from plain objects, so it does not care which language changed the
   world. */
export function createTimetable(root, { day = '2026-01-01', reduceMotion } = {}) {
  const dayStart = Date.parse(`${day}T00:00:00Z`) + DAY_START_HOUR * HOUR_MS;
  const dayEnd = dayStart + DAY_HOURS * HOUR_MS;
  const known = new Map(); // booking id -> element currently live
  const tracks = new Map(); // room id -> track element
  const reduced = () => (reduceMotion !== undefined ? reduceMotion : wantsReducedMotion());
  root.classList.add('timetable');

  const ensureRow = (room) => {
    if (tracks.has(room.id)) return tracks.get(room.id);
    const row = document.createElement('div');
    row.className = 'tt-row';
    row.dataset.roomId = room.id;
    const label = document.createElement('div');
    label.className = 'tt-label';
    label.textContent = room.name;
    const track = document.createElement('div');
    track.className = 'tt-track';
    row.append(label, track);
    root.appendChild(row);
    tracks.set(room.id, track);
    return track;
  };

  const clashIds = (bookings) => {
    const flagged = new Set();
    const sorted = [...bookings].sort((a, b) => a.id - b.id);
    for (let i = 0; i < sorted.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = sorted[j];
        const b = sorted[i];
        if (a.room_id === b.room_id &&
            Date.parse(a.start_at) < Date.parse(b.end_at) &&
            Date.parse(b.start_at) < Date.parse(a.end_at)) flagged.add(b.id);
      }
    }
    return flagged;
  };

  const place = (el, b) => {
    const s = Math.max(Date.parse(b.start_at), dayStart);
    const e = Math.min(Date.parse(b.end_at), dayEnd);
    el.style.left = `${((s - dayStart) / (dayEnd - dayStart)) * 100}%`;
    el.style.width = `${(Math.max(e - s, 0) / (dayEnd - dayStart)) * 100}%`;
  };

  const inDay = (b) => Date.parse(b.end_at) > dayStart && Date.parse(b.start_at) < dayEnd;

  function render(objects) {
    const still = !reduced();
    for (const room of objects.rooms) ensureRow(room);
    const bookings = objects.bookings.filter(inDay);
    const clashes = clashIds(bookings);
    const wanted = new Set(bookings.map((b) => b.id));

    for (const [id, el] of [...known]) {
      if (wanted.has(id)) continue;
      known.delete(id); // gone from the model now, even while it fades
      if (!still) { el.remove(); continue; }
      el.classList.add('is-leaving');
      const anim = el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.9)' }],
        { duration: 220, easing: 'ease-in', fill: 'forwards' });
      anim.finished.then(() => el.remove(), () => el.remove());
    }

    for (const b of bookings) {
      const track = tracks.get(b.room_id);
      if (!track) continue;
      let el = known.get(b.id);
      const isNew = !el;
      if (isNew) {
        el = document.createElement('div');
        el.className = 'tt-booking';
        el.dataset.bookingId = b.id;
        el.textContent = `#${b.id}`;
        known.set(b.id, el);
        track.appendChild(el);
      }
      place(el, b);
      const wasClash = el.classList.contains('is-clash');
      el.classList.toggle('is-clash', clashes.has(b.id));
      if (still && isNew) {
        el.classList.add('is-entering');
        const anim = el.animate(
          [{ opacity: 0, transform: 'translateY(-14px) scale(0.94)' }, { opacity: 1, transform: 'none' }],
          { duration: 320, easing: SPRING });
        anim.finished.then(() => el.classList.remove('is-entering'), () => el.classList.remove('is-entering'));
      }
      if (still && clashes.has(b.id) && !wasClash) {
        el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 360, easing: 'ease-out' });
      }
    }
  }

  return { render, destroy() { root.replaceChildren(); known.clear(); tracks.clear(); } };
}
