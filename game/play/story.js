// story.js: the office acts out what the learner's code really did. It plays the events of bridge.js
// diffWorlds (the real diff of the world before and after a run) in their order, with the drone and the
// people, and nothing else: the story never looks at the expected answer.
//
//   createStory(office, { clock, reducedMotion, cue }) -> story
//     cue(name, [x, y, z]) is told the sounds of what really happens (sound.js): door-chime when someone
//     comes in or goes out of the front door, scan-ok when a room calms, alert when a room starts to clash
//     .play(events, { before, after, grade, wasOpen, changed }) -> Promise<{ cancelled }>
//         changed false (no row of any table changed): the drone shrugs and nothing else happens;
//         changed but no events (a name, a booking's person): no animation, the office is reconciled
//         booking-removed   the person (if their booking is running at the office clock) stands and leaves
//         booking-moved     a card shows the move; the drone escorts the person to the new room (or they
//                           leave, or arrive, if the move takes the booking out of, or into, the clock)
//         booking-retimed   the booking's card updates; the person leaves or arrives if that changes
//         booking-added     a person walks in from the door and sits (or a card: booked for later)
//         clash-cleared     the room calms (a green glow), its people are relieved
//         clash-started     the room pulses red and both people get "!"
//         no events         the drone shrugs (the page says the world did not change)
//       Bookings that are not running at the clock have no one in the office: their events show as a
//       line of text over the room. The story ends by making the office match the world exactly
//       (office.reconcile), setting the room glows from the world, and stamping the ticket card:
//       RESOLVED when the grade passed, or a scan of the room that still clashes when it did not.
//     .cancel()        stop now (Reset): the drone, the walkers and the story's cards; a cancelled play()
//                      resolves { cancelled: true } and touches nothing more
//     .setTicket(open, worldRoomId) the floating card of the open ticket (removed when not open); it reads
//                      "sorted" once stamped RESOLVED
//     .log             the events played by the last play(), in order
//     .busy            true while playing
//   Every wait is capped, so a stuck walk can never hang the page.
import { clashPairs } from './bridge.js';

const CANCEL = Symbol('story cancelled');
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
export function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export const roomName = (objects, id) => (objects?.rooms || []).find((r) => r.id === id)?.name || `room ${id}`;

export function createStory(office, { clock, reducedMotion = false, timeScale = () => 1, cue = () => {} } = {}) {
  const { map, fx } = office;
  // the drone acting now (office.useDrone picks the one of the run's language), read at each use
  const D = { get drone() { return office.drone; } };
  const door = () => { const d = map.doors[0].outside; return [d.x, 1, d.z]; };
  const sound = (g, name, at) => { if (g === gen) { try { cue(name, at); } catch (err) { console.error('story sound:', err); } } };
  // someone walks out of the front door: the bell rings when they reach it
  const leave = (g, id) => office.leave(id).then((ok) => { if (ok) sound(g, 'door-chime', door()); return ok; });
  // someone comes in from the front door
  const enter = (g, b, room, objects) => { const r = office.enter(b, room, objects); sound(g, 'door-chime', door()); return r; };
  let gen = 0;
  let busy = false;
  let log = [];
  let cards = []; // the booking cards of the story playing now
  let ticket = null; // the open ticket's card
  const isStaff = (p) => office.staff.some((s) => s.person === p);

  const sleep = (s) => new Promise((r) => setTimeout(r, (s * 1000) / Math.max(0.1, timeScale() || 1))); // the page's time scale (tests speed it up)
  const check = (g) => { if (g !== gen) throw CANCEL; };
  async function step(g, p, max = 12) {
    const v = await Promise.race([p, sleep(max).then(() => 'timeout')]);
    check(g);
    return v;
  }
  const pause = (g, s) => step(g, sleep(reducedMotion ? s * 0.6 : s), s + 1);
  const at = (room, y = 0) => ({ x: room.center.x, y, z: room.center.z });

  // a booking card over a room, stamped by the drone (only a few per story: more is a line of text)
  async function card(g, ctx, room, title, line, state, from = 'BOOKED') {
    if (!room) return;
    if (ctx.cardsLeft-- <= 0) { fx.text([room.center.x, 1.9, room.center.z], line, { color: 'palette.gold', size: 0.8 }); return; }
    const c = fx.ticket({ title, line, state: from, width: 1.25 });
    c.root.position.set(room.center.x, 2.15, room.center.z - 0.3);
    cards.push(c);
    await step(g, D.drone.stamp(c, state));
  }
  // events of bookings nobody is in the office for: counted per room and said once
  function offstage(ctx, room, verb) {
    if (!room) return;
    const k = `${room.id}|${verb}`;
    ctx.off.set(k, { room, verb, n: (ctx.off.get(k)?.n || 0) + 1 });
  }
  function sayOffstage(ctx) {
    for (const { room, verb, n } of ctx.off.values()) {
      fx.text([room.center.x, 1.7, room.center.z], `${n} later booking${n === 1 ? '' : 's'} ${verb}`, { color: verb === 'cancelled' ? 'palette.danger' : 'palette.gold', size: 0.75 });
    }
    ctx.off.clear();
  }
  async function walksDone(g, ctx, max = 15) {
    if (!ctx.walks.length) return;
    const w = ctx.walks; ctx.walks = [];
    await step(g, Promise.all(w), max);
  }

  // ------------------------------------------------ one handler per event type
  const handlers = {
    async 'booking-removed'(g, e, ctx) {
      const entry = office.people.get(e.bookingId);
      if (!entry) { offstage(ctx, office.roomFor(ctx.before, e.roomId), 'cancelled'); return; }
      const p = entry.person.root.position;
      fx.text([p.x, 1.8, p.z], `Booking ${e.bookingId} cancelled`, { color: 'palette.danger', size: 0.8 });
      entry.person.emote('?', { hold: 1.1 });
      ctx.walks.push(leave(g, e.bookingId)); // they get up and go now; the drone comes over to see them out
      ctx.walks.push(D.drone.flyTo({ x: p.x + 0.4, z: p.z + 1.2 }));
      await pause(g, 0.35);
    },
    async 'booking-moved'(g, e, ctx) {
      const entry = office.people.get(e.bookingId);
      const b = ctx.afterById.get(e.bookingId);
      const to = office.roomFor(ctx.after, e.toRoomId);
      const from = entry?.room || office.roomFor(ctx.before, e.fromRoomId);
      const here = !!to && ctx.running.has(e.bookingId);
      const retimed = Date.parse(e.from.start_at) !== Date.parse(e.to.start_at);
      if (!entry && !here) {
        await card(g, ctx, to || from, `BOOKING ${e.bookingId}`, `${roomName(ctx.before, e.fromRoomId)} → ${roomName(ctx.after, e.toRoomId)}${retimed ? `, ${when(e.to.start_at)}` : ''}`, 'MOVED');
        return;
      }
      await card(g, ctx, from || to, `BOOKING ${e.bookingId}`, `${roomName(ctx.before, e.fromRoomId)} → ${roomName(ctx.after, e.toRoomId)}${retimed ? `, ${when(e.to.start_at)}` : ''}`, 'MOVED');
      if (entry && !here) { ctx.walks.push(leave(g, e.bookingId)); await pause(g, 0.4); return; }
      if (!entry && here) { await step(g, D.drone.flyTo(map.doors[0].inside)); await step(g, enter(g, b, to, ctx.after).done, 20); return; }
      // the drone walks them over
      const seat = office.freeSeat(to, entry);
      entry.room = to; entry.seat = seat; entry.booking = b;
      const target = seat ? map.approach(seat) : office.standSpot(to);
      if (seat) {
        const path = map.route(entry.person.root.position, target) || [target];
        await step(g, D.drone.escort(entry.person, seat, 0, { path }), 25);
        entry.person.play('talk');
      } else {
        await step(g, Promise.all([map.traffic.send(entry.person, target), D.drone.flyTo(at(to))]), 20);
        entry.person.face(Math.PI);
      }
    },
    async 'booking-retimed'(g, e, ctx) {
      const entry = office.people.get(e.bookingId);
      const b = ctx.afterById.get(e.bookingId);
      const room = office.roomFor(ctx.after, e.roomId);
      const here = !!room && ctx.running.has(e.bookingId);
      if (!entry && !here && ctx.cardsLeft <= 0) { offstage(ctx, room, 'retimed'); return; }
      await card(g, ctx, room, `BOOKING ${e.bookingId}`, `${when(e.from.start_at)} → ${when(e.to.start_at)}`, 'MOVED');
      if (entry && !here) { ctx.walks.push(leave(g, e.bookingId)); await pause(g, 0.4); }
      else if (!entry && here) await step(g, enter(g, b, room, ctx.after).done, 20);
      else if (entry) entry.booking = b;
    },
    async 'booking-added'(g, e, ctx) {
      const b = ctx.afterById.get(e.bookingId);
      const room = office.roomFor(ctx.after, e.roomId);
      if (!room) return;
      if (!ctx.running.has(e.bookingId)) {
        if (ctx.cardsLeft <= 0) { offstage(ctx, room, 'added'); return; }
        await card(g, ctx, room, `BOOKING ${e.bookingId}`, `${room.name}, ${when(b.start_at)}`, 'BOOKED');
        return;
      }
      await step(g, D.drone.flyTo(map.doors[0].inside));
      const { done } = enter(g, b, room, ctx.after);
      await step(g, done, 20);
    },
    async 'clash-cleared'(g, e, ctx) {
      sayOffstage(ctx);
      await walksDone(g, ctx);
      const room = office.roomFor(ctx.before, e.roomId);
      if (!room) return;
      await step(g, D.drone.flyTo(at(room)));
      map.setRoomState(room.id, 'ok');
      sound(g, 'scan-ok', [room.center.x, 1, room.center.z]);
      fx.ring([room.center.x, 0.03, room.center.z], { color: 'palette.ok', from: 0.3, to: 2.4, dur: 0.9 });
      for (const en of office.people.values()) if (en.room === room) en.person.emote('ok', { hold: 1.4 });
      await pause(g, 0.7);
    },
    async 'clash-started'(g, e, ctx) {
      sayOffstage(ctx);
      const room = office.roomFor(ctx.after, e.roomId);
      if (!room) return;
      await step(g, D.drone.flyTo(at(room)));
      map.setRoomState(room.id, 'clash');
      sound(g, 'alert', [room.center.x, 1, room.center.z]);
      fx.ring([room.center.x, 0.03, room.center.z], { color: 'palette.danger', from: 0.3, to: 2.4, dur: 0.9 });
      for (const id of [e.bookingId, e.otherId]) office.people.get(id)?.person.emote('!', { hold: 2 });
      D.drone.express('worried', 1.6);
      await pause(g, 0.9);
    },
  };

  // the glows from the world: red where a room clashes; the green "sorted" glow a cleared room got during
  // the story stays only when the ticket is resolved (after a failed grade nothing is shown as sorted)
  function roomsFromWorld(after, passed) {
    const clashing = new Set(clashPairs(after.bookings || []).map((p) => office.roomOf(p.roomId)).filter(Boolean));
    for (const r of map.rooms) map.setRoomState(r.id, clashing.has(r) ? 'clash' : passed && r.state === 'ok' ? 'ok' : 'calm');
    return map.rooms.filter((r) => clashing.has(r));
  }
  function stampNow(state) { // no drone: the card just says it
    if (!ticket || ticket.state === state) return;
    if (state === 'RESOLVED') ticket.set({ line: labels.done(ticketRoom) });
    else ticket.set({ line: labels.open(ticketRoom) });
    ticket.stamp(state);
  }

  // changed: some row in the world changed (bridge.js rowChanges), even when no booking event came of it
  async function play(events, { before, after, grade, wasOpen = true, changed = events.length > 0 }) {
    const g = ++gen;
    busy = true;
    log = [];
    fx.clearMarks();
    const ctx = {
      before, after, walks: [], off: new Map(), cardsLeft: 3,
      afterById: new Map((after.bookings || []).map((b) => [b.id, b])),
      running: new Set(office.running(after, clock).map((x) => x.booking.id)),
    };
    try {
      if (!changed) { // truly nothing: every row of every table is as it was
        await step(g, D.drone.shrug());
        return { cancelled: false };
      }
      for (const e of events) {
        check(g);
        log.push(e);
        try { await handlers[e.type]?.(g, e, ctx); } catch (err) { if (err === CANCEL) throw err; console.error('story:', e.type, err); }
      }
      sayOffstage(ctx);
      await walksDone(g, ctx);
      // the office now matches the world exactly, whatever the animation managed to show
      office.reconcile(after, clock);
      const clashing = roomsFromWorld(after, !!grade?.passed);
      if (grade?.passed && ticket) {
        if (ticket.state !== 'RESOLVED') {
          ticket.set({ line: labels.done(ticketRoom) });
          await step(g, D.drone.stamp(ticket, 'RESOLVED')); await step(g, D.drone.celebrate());
        }
      } else if (grade && !grade.passed) {
        if (ticket && ticket.state === 'RESOLVED') { ticket.set({ line: labels.open(ticketRoom) }); await step(g, D.drone.stamp(ticket, 'OPEN')); } // it broke again
        if (clashing[0] && events.length) await step(g, D.drone.scan(clashing[0].desk, false));
        else D.drone.express('worried', 1.6);
      }
      await pause(g, 0.6);
      for (const c of cards) c.dispose();
      cards = [];
      await step(g, D.drone.flyTo(office.rest));
      return { cancelled: false };
    } catch (err) {
      if (err === CANCEL) return { cancelled: true };
      console.error('story:', err);
      office.reconcile(after, clock);
      roomsFromWorld(after, !!grade?.passed);
      for (const c of cards) c.dispose();
      cards = [];
      if (grade) stampNow(grade.passed ? 'RESOLVED' : 'OPEN');
      return { cancelled: false };
    } finally {
      if (g === gen) busy = false;
    }
  }

  /* A read-only query changes nothing, but its answer is rows of the world: show them where they live.
     Bookings: a ring under each person whose booking came back (and a line for the ones on other days);
     rooms: the room glows and says what came back about it; people: a ring under them if they are in.
     Anything else (a number, a total): the drone says it over the desk. Never shown for a failed run. */
  async function showRows(rows, objects, { label } = {}) {
    const g = ++gen;
    busy = true;
    try {
      if (!rows || !rows.length) { await step(g, D.drone.shrug()); return { shown: 0 }; }
      const k = Object.keys(rows[0]);
      const roomsById = new Map((objects.rooms || []).map((r) => [r.id, r]));
      const nowIds = new Set(office.running(objects, clock).map((x) => x.booking.id));
      let shown = 0;
      const ring = (p) => { fx.ring([p.x, 0.04, p.z], { color: 'palette.gold', from: 0.15, to: 0.9, dur: 1.1 }); shown++; };
      if (k.includes('room_id') && (k.includes('start_at') || k.includes('person_id')) || (k.includes('id') && k.includes('start_at'))) {
        const off = new Map();
        for (const r of rows) {
          const e = office.people.get(Number(r.id));
          if (e && nowIds.has(Number(r.id))) ring(e.person.root.position);
          else if (r.room_id != null) off.set(r.room_id, (off.get(r.room_id) || 0) + 1);
        }
        const first = rows.map((r) => office.people.get(Number(r.id))).find(Boolean);
        if (first) await step(g, D.drone.flyTo({ x: first.person.root.position.x + 0.5, z: first.person.root.position.z + 0.8 }), 6);
        for (const [roomId, n] of off) {
          const m = office.roomOf(roomId);
          if (m) { fx.text([m.center.x, 1.7, m.center.z], `+${n} at other times`, { color: 'palette.gold', size: 0.7 }); shown++; }
        }
      } else if (k.includes('capacity') || (k.includes('name') && rows.some((r) => [...roomsById.values()].some((x) => x.name === r.name)))) {
        for (const r of rows) {
          const w = r.id != null && roomsById.has(Number(r.id)) ? roomsById.get(Number(r.id)) : [...roomsById.values()].find((x) => x.name === r.name);
          const m = w && office.roomOf(w.id);
          if (!m) continue;
          map.setRoomState(m.id, 'ok');
          fx.text([m.center.x, 1.8, m.center.z], r.capacity != null ? `${w.name}: ${r.capacity} seats` : w.name, { color: 'palette.gold', size: 0.75 });
          shown++;
        }
        const firstRoom = rows.map((r) => [...roomsById.values()].find((x) => x.name === r.name || x.id === Number(r.id))).find(Boolean);
        const m = firstRoom && office.roomOf(firstRoom.id);
        if (m) await step(g, D.drone.flyTo(at(m)), 6);
      } else if (k.includes('role') || (k.includes('name') && rows.some((r) => (objects.people || []).some((p) => p.name === r.name)))) {
        for (const r of rows) {
          for (const e of office.people.values()) if (e.booking.person_id === Number(r.id) || e.person.name === r.name) ring(e.person.root.position);
        }
      }
      if (!shown) {
        const v = Object.values(rows[0])[0];
        const here = D.drone.root.position;
        fx.text([here.x, 1.6, here.z], label || (rows.length === 1 ? String(v instanceof Date ? when(v.toISOString()) : v) : `${rows.length} rows`), { color: 'palette.gold', size: 0.9 });
      }
      await pause(g, 1.6);
      for (const r of map.rooms) if (r.state === 'ok') map.setRoomState(r.id, 'calm');
      office.setRooms(new Set(clashPairs(objects.bookings || []).map((p) => p.roomId)));
      await step(g, D.drone.flyTo(office.rest), 6);
      return { shown };
    } catch (err) {
      if (err === CANCEL) return { cancelled: true };
      console.error('story rows:', err);
      return { shown: 0 };
    } finally { if (g === gen) busy = false; }
  }
  // a value a JavaScript or PHP run answered with, floated over the office by its drone
  async function say(text) {
    const g = ++gen;
    busy = true;
    try {
      const here = D.drone.root.position;
      fx.text([here.x, 1.7, here.z], String(text).slice(0, 40), { color: 'palette.gold', size: 0.9 });
      await step(g, D.drone.celebrate(), 4);
      return {};
    } catch (err) { return err === CANCEL ? { cancelled: true } : {}; } finally { if (g === gen) busy = false; }
  }

  function cancel() {
    gen++;
    busy = false;
    D.drone.cancel();
    map.traffic.clear(isStaff);
    for (const c of cards) c.dispose();
    cards = [];
    fx.reset();
  }

  let ticketRoom = 'Room 1';
  const BEA = { title: 'TICKET #1', open: (room) => `Bea · ${room} double-booked`, done: (room) => `Bea · ${room} sorted` };
  let labels = BEA;
  // text: optional { title, open(room), done(room) } for a chapter ticket (default: Bea's double booking)
  function setTicket(open, worldRoomId, text = null) {
    if (ticket) { ticket.dispose(); ticket = null; }
    labels = text ? { ...BEA, ...text } : BEA;
    if (!open) return;
    const r = office.roomOf(worldRoomId) || map.rooms[0];
    ticketRoom = r.name;
    ticket = fx.ticket({ title: labels.title, line: labels.open(r.name), state: 'OPEN', width: 2.6 });
    ticket.root.position.set(r.center.x, 3.2, r.center.z - 1.4); // over the back wall of the room
  }

  return {
    play, cancel, setTicket, showRows, say,
    get log() { return log.slice(); },
    get busy() { return busy; },
    get ticket() { return ticket; },
  };
}
