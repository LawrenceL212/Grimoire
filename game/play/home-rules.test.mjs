// Pure tests for the home room's rules: earnings (honest vs not), purchase and sell maths, placement rules, persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EARNINGS, earnFor, earnedOf, newHome, cleanHome, buy, sell, place, unplace, recolour, checkPlacement, findSpot, CATALOG, SHOP, ROOM, sellPrice } from './home-rules.js';
import { freshLife, recordSolve, cleanLife, balanceOf } from './progress.js';

const HALF = Math.PI / 2;
const rich = (n = 1000) => ({ ...newHome(), balance: n });
const card = (id, evidence = true) => ({ id, evidence, newConcept: false });

test('earnings: only a first unaided solve of an evidence card pays', () => {
  const E = EARNINGS.unaidedEvidenceSolve;
  assert.equal(E, 40);
  assert.equal(earnFor({ first: true, evidence: true, help: 'clean' }), E);
  assert.equal(earnFor({ first: true, evidence: true, help: 'nudged' }), E);
  assert.equal(earnFor({ first: true, evidence: true, help: 'guided' }), 0);
  assert.equal(earnFor({ first: true, evidence: true, help: 'exposure' }), 0, 'the worked example earns nothing');
  assert.equal(earnFor({ first: true, evidence: false, help: 'clean' }), 0, 'a teaching ticket earns nothing');
  assert.equal(earnFor({ first: true, evidence: true, help: 'clean', practice: true }), 0, 'practice earns nothing');
  assert.equal(earnFor({ first: false, evidence: true, help: 'clean' }), 0, 'a repeat earns nothing');
});

test('earnings flow through recordSolve into the balance, once per card', () => {
  let life = freshLife(1000);
  let r = recordSolve(life, card('T02'), { help: 'clean', nowMs: 2000 });
  assert.equal(r.gbp, 40); life = r.life; assert.equal(balanceOf(life), 40);
  r = recordSolve(life, card('T02'), { help: 'clean', nowMs: 3000 }); // a repeat
  assert.equal(r.gbp, 0); life = r.life; assert.equal(balanceOf(life), 40);
  r = recordSolve(life, card('T03'), { help: 'clean', nowMs: 4000, practice: true });
  assert.equal(r.gbp, 0); life = r.life;
  r = recordSolve(life, card('O1', false), { help: 'clean', nowMs: 5000 });
  assert.equal(r.gbp, 0); life = r.life;
  r = recordSolve(life, card('T04'), { help: 'exposure', nowMs: 6000 });
  assert.equal(r.gbp, 0); life = r.life;
  assert.equal(balanceOf(life), 40);
  assert.equal(earnedOf(life.solves), 40);
});

test('purchases: deduct exactly, never overdraw, say how much more is needed', () => {
  const h = { ...newHome(), balance: 100 };
  const b = buy(h, 'desk-lamp');
  assert.ok(b.ok); assert.equal(b.home.balance, 80);
  assert.equal(b.home.items.at(-1).x, null, 'bought things are owned, unplaced');
  const no = buy(h, 'sofa');
  assert.equal(no.ok, false); assert.match(no.reason, /£120 more to go/);
  assert.equal(h.balance, 100, 'the input is never changed');
  assert.equal(buy({ ...h, balance: 19 }, 'desk-lamp').ok, false);
  assert.equal(buy({ ...h, balance: 20 }, 'desk-lamp').home.balance, 0);
  assert.equal(buy(h, 'desk-wobbly').ok, false, 'not for sale');
  assert.ok(SHOP.every((id) => CATALOG[id].price >= 15 && CATALOG[id].price <= 300));
});

test('selling back refunds half (rounded down); starter things are worth nothing', () => {
  const b = buy(rich(300), 'sofa');
  const s = sell(b.home, b.uid);
  assert.ok(s.ok); assert.equal(s.refund, 110); assert.equal(s.home.balance, 300 - 220 + 110);
  const b2 = buy(rich(300), 'plant-tall'); assert.equal(sell(b2.home, b2.uid).refund, 15);
  assert.equal(sell(newHome(), 'i1').ok, false);
  assert.equal(sellPrice({ id: 'sofa', starter: true }), 0);
  let h = rich(500); const start = h.balance; // buying and selling never makes money
  for (const id of SHOP) { const x = buy(h, id); if (x.ok) h = sell(x.home, x.uid).home; }
  assert.ok(h.balance <= start);
});

test('placement: inside the room, no overlaps, desk-top things on surfaces, wall things on free wall', () => {
  const items = newHome().items;
  assert.ok(items.every((i) => i.x !== null), 'the starter things are all placed');
  assert.equal(checkPlacement(items, { id: 'desk', x: 0, z: -2, rot: 0 }).ok, false);
  assert.match(checkPlacement(items, { id: 'desk', x: 0, z: -2, rot: 0 }).reason, /overlaps the wobbly desk/);
  assert.equal(checkPlacement(items, { id: 'sofa', x: 0, z: 2, rot: 0 }).ok, true);
  assert.match(checkPlacement(items, { id: 'sofa', x: 3, z: 2, rot: 0 }).reason, /outside the room/);
  assert.match(checkPlacement(items, { id: 'monitor', x: 0, z: 1, rot: 0 }).reason, /needs a desk or a table/);
  assert.equal(checkPlacement(items, { id: 'monitor', x: 0.5, z: -2, rot: 0 }).ok, true, 'a monitor on the desk');
  assert.match(checkPlacement(items, { id: 'monitor', x: -0.25, z: -2, rot: 0 }).reason, /already there/, 'not on top of the laptop');
  assert.equal(checkPlacement(items, { id: 'poster', x: -1.5, z: -2, rot: 0 }).ok, false, 'not on a window');
  assert.equal(checkPlacement(items, { id: 'poster', x: 0.5, z: -2, rot: 0 }).ok, true, 'a bare bit of north wall');
  assert.equal(checkPlacement(items, { id: 'poster', x: -2.5, z: 1, rot: HALF }).ok, false, 'not on the door');
  assert.match(checkPlacement(items, { id: 'poster', x: -2.5, z: 0, rot: HALF }).reason, /already hangs/, 'the apron hook is there');
  assert.equal(checkPlacement(items, { id: 'rug', x: 0, z: 1, rot: 0 }).ok, true);
  const withRug = [...items, { uid: 'r', id: 'rug', x: 0, z: 1, rot: 0 }];
  assert.equal(checkPlacement(withRug, { id: 'sofa', x: 0, z: 1.5, rot: 0 }).ok, true, 'things stand on a rug');
  assert.equal(checkPlacement(withRug, { id: 'rug', x: 0, z: 1, rot: 0 }).ok, false, 'rugs do not overlap each other');
});

test('placement: the door and the way to the desk stay clear', () => {
  const items = newHome().items;
  const [di, dj] = ROOM.doorTile;
  const doorTile = { x: ROOM.x0 + di + 0.5, z: ROOM.z0 + dj + 0.5 };
  const r = checkPlacement(items, { id: 'plant-tall', ...doorTile, rot: 0 });
  assert.equal(r.ok, false); assert.match(r.reason, /block the door/);
  // wall the desk off: wardrobes across the room, leaving no way through
  const row = [{ uid: 'w1', id: 'wardrobe', x: -2, z: -1, rot: 0 }, { uid: 'w2', id: 'wardrobe', x: 0, z: -1, rot: 0 }];
  const t = [...items, ...row, { uid: 'w3', id: 'wardrobe', x: 2, z: -1, rot: 0 }].filter((i) => i.uid !== 'i1');
  assert.equal(checkPlacement(t.slice(0, -1), { id: 'wardrobe', x: 2, z: -1, rot: 0 }).ok, false, 'a closed row of wardrobes under the desk');
  assert.match(checkPlacement(t.slice(0, -1), { id: 'wardrobe', x: 2, z: -1, rot: 0 }).reason, /way from the door to your desk/);
  // fencing the door tile in
  const fence = [...items, { uid: 'p1', id: 'plant-tall', x: -1.5, z: 1, rot: 0 }, { uid: 'p2', id: 'plant-tall', x: -2.5, z: 0, rot: 0 }];
  assert.match(checkPlacement(fence, { id: 'plant-tall', x: -2.5, z: 2, rot: 0 }).reason, /block the (way|door)/);
  assert.equal(checkPlacement(items, { id: 'rug', x: -1.5, z: 1, rot: 0 }).ok, true, 'a rug never blocks anything');
});

test('place, move (what stands on a desk travels with it), unplace and recolour', () => {
  const h = newHome();
  const desk = h.items.find((i) => i.id === 'desk-wobbly');
  const m = place(h, desk.uid, { x: 1, z: 2, rot: 0 });
  assert.ok(m.ok, m.reason);
  const lap = m.home.items.find((i) => i.id === 'laptop');
  assert.ok(Math.abs(lap.x - 0.75) < 1e-9 && Math.abs(lap.z - 2) < 1e-9, `the laptop travelled: ${lap.x}, ${lap.z}`);
  const r = place(m.home, desk.uid, { x: 1, z: 1.5, rot: HALF });
  assert.ok(r.ok, r.reason);
  assert.equal(r.home.items.find((i) => i.id === 'laptop').rot, HALF);
  assert.equal(place(h, desk.uid, { x: -2.5, z: 1, rot: 0 }).ok, false);
  assert.equal(unplace(h, desk.uid).home.items.find((i) => i.id === 'laptop').x, null, 'putting a desk away puts what stood on it away');
  const bed = h.items.find((i) => i.id === 'bed-single');
  assert.equal(recolour(h, bed.uid, 'coral').home.items.find((i) => i.uid === bed.uid).tone, 'coral');
  assert.equal(recolour(h, bed.uid, 'nonsense').ok, false);
  assert.equal(recolour(h, desk.uid, 'coral').ok, false, 'a desk has one colour');
  const b = buy(rich(), 'bed-double');
  assert.equal(place(b.home, b.uid, { x: 2, z: -1.5, rot: 0 }).ok, false, 'not on top of the single bed');
  const spot = findSpot(b.home.items, b.home.items.find((i) => i.uid === b.uid));
  if (spot) assert.ok(checkPlacement(b.home.items.filter((i) => i.uid !== b.uid), { id: 'bed-double', ...spot }).ok);
});

test('persistence: a stored home is checked field by field', () => {
  const earned = 80;
  const h = { ...newHome(), balance: 30 };
  assert.equal(cleanHome(JSON.parse(JSON.stringify(h)), earned).balance, 30);
  assert.equal(cleanHome({ ...h, balance: 9999 }, earned).balance, 80, 'more than ever earned is clamped');
  assert.equal(cleanHome({ ...h, balance: -5 }, earned).balance, 0);
  assert.equal(cleanHome({ ...h, balance: 'lots' }, earned).balance, 0);
  const dirty = { ...h, items: [...h.items, { uid: 'z9', id: 'golden-throne', x: 0, z: 0, rot: 0 }, { ...h.items[0] }] };
  assert.equal(cleanHome(dirty, earned).items.length, h.items.length, 'unknown things and duplicate uids are dropped');
  const bought = buy(rich(300), 'sofa').home;
  const poor = cleanHome({ ...bought, balance: 0 }, 100);
  assert.ok(!poor.items.some((i) => i.id === 'sofa'), 'bought more than was ever earned: the purchase goes');
  assert.ok(poor.balance + poor.items.reduce((n, i) => n + (i.starter ? 0 : CATALOG[i.id].price), 0) <= 100);
  const overlapped = { ...h, items: [...h.items, { uid: 'q1', id: 'sofa', tone: null, x: 0, z: -2, rot: 0 }] };
  const fixed = cleanHome(overlapped, 1000);
  assert.ok(fixed.items.find((i) => i.uid === 'q1') && fixed.items.find((i) => i.uid === 'q1').x === null, 'an invalid placement goes back to the unplaced list');
  const odd = { ...h, items: [{ uid: 'a', id: 'plant-tall', x: 0.37, z: 0, rot: 0 }, { uid: 'b', id: 'plant-tall', x: 40, z: 0, rot: 0 }, { uid: 'c', id: 'bed-double', starter: true, x: null }] };
  const oddFixed = cleanHome(odd, 1000);
  assert.ok(oddFixed.items.slice(0, 2).every((i) => i.x === null), 'off the grid or outside the room: unplaced');
  assert.equal(oddFixed.items.find((i) => i.uid === 'c')?.starter, undefined, 'only the five starter things can be starters');
  for (const raw of [null, 5, 'x', [], { v: 2 }, { v: 1, items: 'no' }]) assert.deepEqual(cleanHome(raw, 100), newHome());
});

test('persistence inside the life record: the balance cannot exceed what the solves earned', () => {
  let life = freshLife(1000);
  life = recordSolve(life, card('T02'), { help: 'clean', nowMs: 2000 }).life;
  const raw = JSON.parse(JSON.stringify(life));
  raw.home.balance = 5000;
  assert.equal(cleanLife(raw, 3000).home.balance, 40);
  const raw2 = JSON.parse(JSON.stringify(life));
  raw2.solves[0].gbp = 999; // the stored gbp is ignored: the table decides
  assert.equal(cleanLife(raw2, 3000).solves[0].gbp, 40);
  const raw3 = JSON.parse(JSON.stringify(life));
  raw3.solves.push({ ...raw3.solves[0], atMs: 2500 }); // a repeat in the stored record earns nothing
  assert.equal(cleanLife(raw3, 3000).solves.reduce((n, s) => n + s.gbp, 0), 40);
  assert.equal(cleanLife(JSON.parse(JSON.stringify(freshLife(1))), 2).home.items.length, 5);
  const old = JSON.parse(JSON.stringify(life)); delete old.home;
  assert.equal(cleanLife(old, 3000).home.balance, 0, 'an older save without a home gets a bare one');
});
