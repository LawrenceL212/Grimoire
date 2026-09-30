import { openGame, makeReporter } from './game_lib.mjs';

const t = makeReporter();
const scenario = async (page) => page.evaluate(async () => {
  const { createTimetable } = await import('/game/ui/timetable.js');
  const root = document.createElement('div');
  document.body.appendChild(root);
  const tt = createTimetable(root);
  const rooms = [{ id: 1, name: 'Room 1', capacity: 4 }, { id: 2, name: 'Room 2', capacity: 5 }];
  const b = (id, room, s, e) => ({ id, room_id: room, person_id: 1, start_at: `2026-01-01T${s}:00Z`, end_at: `2026-01-01T${e}:00Z` });
  const A = { rooms, people: [], bookings: [b(1, 1, '08:00', '09:00'), b(2, 2, '08:00', '09:00'), b(3, 1, '10:00', '11:00')] };
  const B = { ...A, bookings: [...A.bookings, b(4, 2, '09:00', '10:00')] };
  const C = { ...A, bookings: [...A.bookings, b(5, 1, '08:30', '09:30')] };
  const live = () => root.querySelectorAll('.tt-booking:not(.is-leaving)');
  const out = {};

  tt.render(A);
  out.rows = root.querySelectorAll('.tt-row').length;
  out.first = live().length;

  tt.render(B);
  const added = root.querySelector('[data-booking-id="4"]');
  out.added = { count: live().length, animating: added.getAnimations().length, entering: added.classList.contains('is-entering') };

  tt.render(C);
  out.clash = root.querySelectorAll('.tt-booking.is-clash:not(.is-leaving)').length;
  out.clashId = root.querySelector('.tt-booking.is-clash:not(.is-leaving)')?.dataset.bookingId;

  tt.render(A);
  out.leavingNow = root.querySelectorAll('.is-leaving').length;
  await new Promise((r) => setTimeout(r, 700));
  out.afterFade = { live: live().length, leaving: root.querySelectorAll('.is-leaving').length };

  tt.render(B); tt.render(A); tt.render(B);
  const ids = [...live()].map((e) => e.dataset.bookingId);
  out.rapid = { count: ids.length, unique: new Set(ids).size };

  const big = { rooms, people: [], bookings: Array.from({ length: 500 }, (_, i) => b(1000 + i, 1 + (i % 2), '08:00', '09:00')) };
  const t0 = performance.now();
  tt.render(big);
  out.bigMs = Math.round(performance.now() - t0);
  return out;
});

{
  const { page, errors, close } = await openGame();
  const r = await scenario(page);
  t.check('one row per room', r.rows === 2, String(r.rows));
  t.check('the first render shows every booking', r.first === 3, String(r.first));
  t.check('a new booking is added and animates in', r.added.count === 4 && r.added.animating > 0 && r.added.entering, JSON.stringify(r.added));
  t.check('an overlapping booking is flagged as a clash', r.clash === 1 && r.clashId === '5', `${r.clash} / ${r.clashId}`);
  t.check('a removed booking fades out first', r.leavingNow >= 1, String(r.leavingNow));
  t.check('faded blocks are removed from the page', r.afterFade.live === 3 && r.afterFade.leaving === 0, JSON.stringify(r.afterFade));
  t.check('rapid re-renders leave no duplicate or stale blocks', r.rapid.count === 4 && r.rapid.unique === 4, JSON.stringify(r.rapid));
  t.note('render 500 bookings', r.bigMs + ' ms');
  t.check('no page errors', errors.length === 0, errors.join(' | '));
  await close();
}
{
  const { page, close } = await openGame('game/classic.html', { context: { reducedMotion: 'reduce' } });
  const r = await page.evaluate(async () => {
    const { createTimetable } = await import('/game/ui/timetable.js');
    const root = document.createElement('div');
    document.body.appendChild(root);
    const tt = createTimetable(root);
    const rooms = [{ id: 1, name: 'Room 1', capacity: 4 }];
    const b = (id) => ({ id, room_id: 1, person_id: 1, start_at: '2026-01-01T08:00:00Z', end_at: '2026-01-01T09:00:00Z' });
    tt.render({ rooms, people: [], bookings: [b(1)] });
    tt.render({ rooms, people: [], bookings: [b(1), { ...b(2), start_at: '2026-01-01T10:00:00Z', end_at: '2026-01-01T11:00:00Z' }] });
    const added = root.querySelector('[data-booking-id="2"]');
    const animations = added.getAnimations().length;
    tt.render({ rooms, people: [], bookings: [b(1)] });
    return { animations, leaving: root.querySelectorAll('.is-leaving').length, blocks: root.querySelectorAll('.tt-booking').length };
  });
  t.check('reduced motion: nothing animates', r.animations === 0, JSON.stringify(r));
  t.check('reduced motion: removal is immediate', r.leaving === 0 && r.blocks === 1, JSON.stringify(r));
  await close();
}
{
  const { page, close } = await openGame();
  const r = await page.evaluate(async () => {
    const { createTimetable } = await import('/game/ui/timetable.js');
    const mk = (opts) => { const root = document.createElement('div'); document.body.appendChild(root); return [root, createTimetable(root, opts)]; };
    const rooms = [{ id: 1, name: 'Room 1', capacity: 4 }, { id: 2, name: 'Room 2', capacity: 4 }];
    const b = (room, s = '08:00', e = '09:00') => ({ id: 1, room_id: room, person_id: 1, start_at: `2026-01-01T${s}:00Z`, end_at: `2026-01-01T${e}:00Z` });
    const out = {};
    {
      const [root, tt] = mk({ reduceMotion: true });
      tt.render({ rooms, people: [], bookings: [b(1)] });
      const el = root.querySelector('[data-booking-id="1"]');
      tt.render({ rooms, people: [], bookings: [b(1, '10:00', '11:00')] });
      out.still = { td: getComputedStyle(el).transitionDuration, anims: el.getAnimations().length };
    }
    {
      const [root, tt] = mk();
      tt.render({ rooms, people: [], bookings: [b(1)] });
      tt.render({ rooms, people: [], bookings: [b(2)] });
      const els = root.querySelectorAll('[data-booking-id="1"]:not(.is-leaving)');
      out.moved = { n: els.length, room: els[0]?.closest('.tt-row').dataset.roomId, all: root.querySelectorAll('[data-booking-id="1"]').length };
    }
    {
      const [root, tt] = mk({ reduceMotion: true });
      tt.render({ rooms, people: [], bookings: [b(1)] });
      tt.render({ rooms, people: [], bookings: [b(9)] });
      out.orphan = root.querySelectorAll('[data-booking-id="1"]').length;
      tt.render({ rooms, people: [], bookings: [b(9)] });
      out.orphanNew = root.querySelectorAll('[data-booking-id]').length;
    }
    return out;
  });
  t.check('reduceMotion option stops the CSS transition too', r.still.td === '0s' && r.still.anims === 0, JSON.stringify(r.still));
  t.check('a booking that changes room moves row, with no duplicate', r.moved.n === 1 && r.moved.room === '2' && r.moved.all === 1, JSON.stringify(r.moved));
  t.check('a booking whose room has no row is not left on screen', r.orphan === 0 && r.orphanNew === 0, `${r.orphan} / ${r.orphanNew}`);
  await close();
}
t.finish();
