// home-rules.js: the home room's rules, with no 3D and no page in them (tested in node, game/play/home-rules.test.mjs).
//
// MONEY. The balance is earned only by honest solves, from ONE table (EARNINGS) read by progress.js's recordSolve:
//   the FIRST solve of an evidence card, done unaided (clean or after one nudge, the same "unaided" that writes a
//   spell), earns EARNINGS.unaidedEvidenceSolve. A teaching ticket, practice, a repeat, a guided solve or any solve
//   that used the worked example earns nothing. Every solve in the life record carries its own `gbp`, so the most the
//   life could ever have earned is the sum of those (earnedOf), and cleanHome() never lets the balance and the things
//   bought exceed it.
//
// THE ROOM. A bare bedroom, ROOM.w x ROOM.d tiles, x -3..3, z -2.5..2.5. The north wall has two windows; the west
// wall has the door (tile j = 3), whose inside tile must stay free, with a path of free tiles from it to every desk.
//
// ITEMS. life.home = { v: 1, balance, seq, items: [{ uid, id, tone, x, z, rot, starter? }] }. x === null: owned, not
// placed. Kinds: 'floor' (a footprint on the tile grid; a rug is `walk`: others may stand on it), 'top' (stands on a
// desk or table), 'wall' (hangs on a free wall slot: x, z is the slot's tile centre, rot 0 north wall / PI/2 west).
//
//   CATALOG, SHOP (ids for sale), defOf(id), nameOf(item), priceOf(id), sellPrice(item)
//   EARNINGS, earnFor({ first, practice, evidence, help }), earnedOf(solves)
//   newHome(), cleanHome(raw, earned), creditHome(home, gbp)
//   buy(home, id) / sell(home, uid) / place(home, uid, spot) / move(home, uid, spot) / unplace(home, uid) / recolour(home, uid, tone)
//        -> { ok: true, home, ... } or { ok: false, reason }   (never mutate their input)
//   checkPlacement(items, cand, { ignore }) -> { ok, reason }      snap(def, spot), findSpot(items, item), wallSlots()
const HALF_PI = Math.PI / 2;

export const EARNINGS = Object.freeze({ unaidedEvidenceSolve: 40 });
export function earnFor({ first = false, practice = false, evidence = true, help = 'exposure' } = {}) {
  if (!first || practice || evidence === false) return 0;
  return help === 'clean' || help === 'nudged' ? EARNINGS.unaidedEvidenceSolve : 0;
}
export const earnedOf = (solves = []) => solves.reduce((n, s) => n + (Number.isFinite(s?.gbp) ? s.gbp : 0), 0);

export const ROOM = Object.freeze({ w: 6, d: 5, x0: -3, z0: -2.5, doorTile: [0, 3], windows: [1, 4] });
const tileXZ = (i, j) => ({ x: ROOM.x0 + i + 0.5, z: ROOM.z0 + j + 0.5 });
export const DOOR_INSIDE = Object.freeze(tileXZ(...ROOM.doorTile));
export function wallSlots() {
  const out = [];
  for (let i = 0; i < ROOM.w; i++) if (!ROOM.windows.includes(i)) out.push({ wall: 'n', ...tileXZ(i, 0), rot: 0 });
  for (let j = 0; j < ROOM.d; j++) if (j !== ROOM.doorTile[1]) out.push({ wall: 'w', ...tileXZ(0, j), rot: HALF_PI });
  return out;
}

const BED_TONES = ['fabric', 'fabricAlt', 'mint', 'coral', 'felt'];
const WOOD_TONES = ['woodLight', 'woodDark', 'mint', 'coral'];
const PRINT_TONES = ['fabric', 'fabricAlt', 'coral', 'mint', 'gold'];
// tiles must match the art pack (the browser test checks it); price in pounds, kind as above
const D = (id, o) => [id, Object.freeze({ id, asset: id, tones: null, ...o })];
export const CATALOG = Object.freeze(Object.fromEntries([
  D('bed-single', { name: 'Single bed', kind: 'floor', tiles: [1, 2], price: 60, tones: BED_TONES }),
  D('bed-double', { name: 'Double bed', kind: 'floor', tiles: [2, 2], price: 280, tones: BED_TONES }),
  D('desk-wobbly', { name: 'Wobbly desk', asset: 'desk', kind: 'floor', tiles: [2, 1], price: 0, surface: true, workstation: true, forSale: false }),
  D('desk', { name: 'Desk', kind: 'floor', tiles: [2, 1], price: 120, surface: true, workstation: true }),
  D('office-chair', { name: 'Office chair', kind: 'floor', tiles: [1, 1], price: 45 }),
  D('laptop', { name: 'Laptop', kind: 'top', tiles: [0.5, 0.5], price: 60 }),
  D('monitor', { name: 'Monitor', kind: 'top', tiles: [1, 0.5], price: 90 }),
  D('desk-lamp', { name: 'Desk lamp', kind: 'top', tiles: [0.5, 0.5], price: 20 }),
  D('bookshelf', { name: 'Bookshelf', kind: 'floor', tiles: [2, 1], price: 110 }),
  D('wardrobe', { name: 'Wardrobe', kind: 'floor', tiles: [2, 1], price: 150, tones: WOOD_TONES }),
  D('bedside-table', { name: 'Bedside table', kind: 'floor', tiles: [1, 1], price: 35, surface: true, tones: WOOD_TONES }),
  D('coffee-table', { name: 'Coffee table', kind: 'floor', tiles: [2, 1], price: 75, surface: true }),
  D('sofa', { name: 'Sofa', kind: 'floor', tiles: [2, 1], price: 220 }),
  D('rug', { name: 'Rug', kind: 'floor', tiles: [3, 2], price: 70, walk: true }),
  D('plant-small', { name: 'Small plant', kind: 'floor', tiles: [1, 1], price: 20 }),
  D('plant-tall', { name: 'Tall plant', kind: 'floor', tiles: [1, 1], price: 30 }),
  D('water-cooler', { name: 'Water cooler', kind: 'floor', tiles: [1, 1], price: 120 }),
  D('poster', { name: 'Poster', kind: 'wall', tiles: [1, 1], price: 20, tones: PRINT_TONES }),
  D('apron-hook', { name: 'Apron hook', kind: 'wall', tiles: [1, 1], price: 15 }),
]));
const STARTER_NAMES = { 'plant-small': 'Sad plant', laptop: 'Old laptop' };
export const SHOP = Object.freeze(Object.values(CATALOG).filter((d) => d.forSale !== false && d.id !== 'apron-hook').map((d) => d.id));
export const defOf = (id) => CATALOG[id] || null;
export const nameOf = (item) => (item.starter && STARTER_NAMES[item.id]) || CATALOG[item.id]?.name || item.id;
export const priceOf = (id) => CATALOG[id]?.price ?? 0;
// a starter thing was never paid for: it is worth nothing back
export const sellPrice = (item) => (item.starter ? 0 : Math.floor(priceOf(item.id) / 2));
const money = (n) => `£${n}`;

// ---------------------------------------------------------------- geometry
const quarter = (rot) => (((Math.round((rot || 0) / HALF_PI) % 4) + 4) % 4);
const turned = (rot) => quarter(rot) % 2 === 1;
export function footOf(def, x, z, rot = 0) {
  let [w, d] = def.tiles;
  if (turned(rot)) [w, d] = [d, w];
  return { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
}
const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
const overlaps = (A, B, eps = 0.01) => overlap(A.x0, A.x1, B.x0, B.x1) > eps && overlap(A.z0, A.z1, B.z0, B.z1) > eps;
const within = (A, B, e = 1e-6) => A.x0 >= B.x0 - e && A.x1 <= B.x1 + e && A.z0 >= B.z0 - e && A.z1 <= B.z1 + e;
const ROOM_FOOT = { x0: ROOM.x0, x1: ROOM.x0 + ROOM.w, z0: ROOM.z0, z1: ROOM.z0 + ROOM.d };
const placed = (it) => it.x !== null && it.x !== undefined;

// the nearest legal-looking position: floor things on the tile grid, desk-top things on a quarter-tile grid, wall things on a slot
export function snap(def, { x, z, rot = 0 }) {
  if (def.kind === 'wall') {
    let best = null, bd = Infinity;
    for (const s of wallSlots()) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
    return { x: best.x, z: best.z, rot: best.rot };
  }
  if (def.kind === 'top') return { x: Math.round(x * 4) / 4, z: Math.round(z * 4) / 4, rot: quarter(rot) * HALF_PI };
  let [w, d] = def.tiles;
  if (turned(rot)) [w, d] = [d, w];
  return { x: ROOM.x0 + Math.round(x - w / 2 - ROOM.x0) + w / 2, z: ROOM.z0 + Math.round(z - d / 2 - ROOM.z0) + d / 2, rot: quarter(rot) * HALF_PI };
}

// ---------------------------------------------------------------- placement
function blockedTiles(items) {
  const blocked = new Set();
  for (const it of items) {
    const def = CATALOG[it.id];
    if (!def || !placed(it) || def.kind !== 'floor' || def.walk) continue;
    const f = footOf(def, it.x, it.z, it.rot);
    for (let i = 0; i < ROOM.w; i++) for (let j = 0; j < ROOM.d; j++) {
      const t = { x0: ROOM.x0 + i, x1: ROOM.x0 + i + 1, z0: ROOM.z0 + j, z1: ROOM.z0 + j + 1 };
      if (overlap(f.x0, f.x1, t.x0, t.x1) > 0.25 && overlap(f.z0, f.z1, t.z0, t.z1) > 0.25) blocked.add(`${i},${j}`);
    }
  }
  return blocked;
}
// 'door' | 'desk' | null: what the floor things leave in the way
function pathProblem(items) {
  const blocked = blockedTiles(items);
  const [di, dj] = ROOM.doorTile;
  if (blocked.has(`${di},${dj}`)) return 'door';
  const seen = new Set([`${di},${dj}`]), queue = [[di, dj]];
  while (queue.length) {
    const [i, j] = queue.shift();
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = [i + a, j + b], k = `${n[0]},${n[1]}`;
      if (n[0] < 0 || n[1] < 0 || n[0] >= ROOM.w || n[1] >= ROOM.d || seen.has(k) || blocked.has(k)) continue;
      seen.add(k); queue.push(n);
    }
  }
  for (const it of items) {
    const def = CATALOG[it.id];
    if (!def?.workstation || !placed(it)) continue;
    const f = footOf(def, it.x, it.z, it.rot);
    let reach = false;
    for (let i = 0; i < ROOM.w && !reach; i++) for (let j = 0; j < ROOM.d && !reach; j++) {
      if (!seen.has(`${i},${j}`)) continue;
      const t = { x0: ROOM.x0 + i, x1: ROOM.x0 + i + 1, z0: ROOM.z0 + j, z1: ROOM.z0 + j + 1 };
      // a free tile touching the desk along an edge
      const touchX = Math.abs(t.x1 - f.x0) < 1e-6 || Math.abs(t.x0 - f.x1) < 1e-6, touchZ = Math.abs(t.z1 - f.z0) < 1e-6 || Math.abs(t.z0 - f.z1) < 1e-6;
      if ((touchX && overlap(t.z0, t.z1, f.z0, f.z1) > 0.25) || (touchZ && overlap(t.x0, t.x1, f.x0, f.x1) > 0.25)) reach = true;
    }
    if (!reach) return 'desk';
  }
  return null;
}

// can `cand` ({ id, x, z, rot }) stand here among the placed items? `ignore`: a uid being moved
export function checkPlacement(items, cand, { ignore = null } = {}) {
  const def = CATALOG[cand.id];
  if (!def) return { ok: false, reason: 'That is not something this room knows.' };
  if (![cand.x, cand.z].every(Number.isFinite)) return { ok: false, reason: 'Pick a spot in the room.' };
  const others = items.filter((o) => placed(o) && o.uid !== ignore);
  if (def.kind === 'wall') {
    const slot = wallSlots().find((s) => Math.abs(s.x - cand.x) < 1e-6 && Math.abs(s.z - cand.z) < 1e-6 && quarter(s.rot) === quarter(cand.rot));
    if (!slot) return { ok: false, reason: 'Wall things hang on a bare bit of wall (not on a window or the door).' };
    if (others.some((o) => CATALOG[o.id]?.kind === 'wall' && Math.abs(o.x - slot.x) < 1e-6 && Math.abs(o.z - slot.z) < 1e-6)) return { ok: false, reason: 'Something already hangs there.' };
    return { ok: true, reason: '' };
  }
  const foot = footOf(def, cand.x, cand.z, cand.rot);
  if (!within(foot, ROOM_FOOT)) return { ok: false, reason: 'That is outside the room.' };
  if (def.kind === 'top') {
    const base = others.find((o) => CATALOG[o.id]?.surface && within(foot, footOf(CATALOG[o.id], o.x, o.z, o.rot)));
    if (!base) return { ok: false, reason: `The ${def.name.toLowerCase()} needs a desk or a table to stand on.` };
    const clash = others.find((o) => CATALOG[o.id]?.kind === 'top' && overlaps(foot, footOf(CATALOG[o.id], o.x, o.z, o.rot)) && within(footOf(CATALOG[o.id], o.x, o.z, o.rot), footOf(CATALOG[base.id], base.x, base.z, base.rot)));
    if (clash) return { ok: false, reason: `The ${nameOf(clash).toLowerCase()} is already there.` };
    return { ok: true, reason: '' };
  }
  for (const o of others) {
    const od = CATALOG[o.id];
    if (od.kind !== 'floor') continue;
    if (def.walk !== od.walk && (def.walk || od.walk)) continue; // a rug lies under things
    if (overlaps(foot, footOf(od, o.x, o.z, o.rot))) return { ok: false, reason: `That overlaps the ${nameOf(o).toLowerCase()}.` };
  }
  if (!def.walk) {
    const p = pathProblem([...others, { ...cand, uid: '?' }]);
    if (p === 'door') return { ok: false, reason: 'That would block the door.' };
    if (p === 'desk') return { ok: false, reason: 'That would block the way from the door to your desk.' };
  }
  return { ok: true, reason: '' };
}

// the first spot (room centre outwards) where this item can stand, or null
export function findSpot(items, item) {
  const def = CATALOG[item.id];
  const rest = items.filter((o) => o.uid !== item.uid);
  const rots = def.kind === 'wall' ? [0, HALF_PI] : [0, HALF_PI];
  if (def.kind === 'wall') {
    for (const s of wallSlots()) if (checkPlacement(rest, { id: item.id, x: s.x, z: s.z, rot: s.rot }).ok) return { x: s.x, z: s.z, rot: s.rot };
    return null;
  }
  if (def.kind === 'top') {
    for (const b of rest) {
      const bd = CATALOG[b.id];
      if (!bd?.surface || !placed(b)) continue;
      const f = footOf(bd, b.x, b.z, b.rot);
      for (let x = f.x0 + 0.25; x < f.x1; x += 0.25) for (let z = f.z0 + 0.25; z < f.z1; z += 0.25) {
        const c = { id: item.id, x, z, rot: 0 };
        if (checkPlacement(rest, c).ok) return { x, z, rot: 0 };
      }
    }
    return null;
  }
  const order = [];
  for (let i = 0; i < ROOM.w; i++) for (let j = 0; j < ROOM.d; j++) order.push(tileXZ(i, j));
  order.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  for (const rot of rots) for (const t of order) {
    const s = snap(def, { x: t.x, z: t.z, rot });
    if (checkPlacement(rest, { id: item.id, ...s }).ok) return s;
  }
  return null;
}

// ---------------------------------------------------------------- the home record
const STARTERS = [
  { id: 'bed-single', x: 2.5, z: -1.5, rot: 0 },
  { id: 'desk-wobbly', x: 0, z: -2, rot: 0 },
  { id: 'laptop', x: -0.25, z: -2, rot: 0 },
  { id: 'apron-hook', x: -2.5, z: 0, rot: HALF_PI },
  { id: 'plant-small', x: -2.5, z: -2, rot: 0 },
];
export function newHome() {
  return { v: 1, balance: 0, seq: STARTERS.length, items: STARTERS.map((s, k) => ({ uid: `i${k + 1}`, tone: null, starter: true, ...s })) };
}
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
// a stored home, field by field: unknown things dropped, nothing bought that the life never earned, bad spots unplaced
export function cleanHome(raw, earned = 0) {
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.items)) return newHome();
  const seen = new Set(), items = [], starterLeft = new Map();
  for (const s of STARTERS) starterLeft.set(s.id, (starterLeft.get(s.id) || 0) + 1);
  for (const r of raw.items) {
    if (!isObj(r) || typeof r.uid !== 'string' || seen.has(r.uid) || !CATALOG[r.id]) continue;
    seen.add(r.uid);
    const def = CATALOG[r.id];
    const it = { uid: r.uid, id: r.id, tone: def.tones && def.tones.includes(r.tone) ? r.tone : null, x: null, z: null, rot: 0 };
    if (r.starter === true && (starterLeft.get(r.id) || 0) > 0) { it.starter = true; starterLeft.set(r.id, starterLeft.get(r.id) - 1); } // only the five things he began with
    if (placed(r) && [r.x, r.z, r.rot].every((v) => Number.isFinite(v))) { it.x = r.x; it.z = r.z; it.rot = r.rot; }
    items.push(it);
  }
  const worth = (list) => list.reduce((n, it) => n + (it.starter ? 0 : priceOf(it.id)), 0);
  while (items.length && worth(items) > earned) { // more than the life could have bought: the newest purchases go
    let k = items.length - 1; while (k >= 0 && items[k].starter) k--;
    if (k < 0) break; items.splice(k, 1);
  }
  const rawBal = Number.isFinite(raw.balance) ? Math.floor(raw.balance) : 0;
  const balance = Math.max(0, Math.min(rawBal, earned - worth(items)));
  // placements: each checked against the ones already accepted (surfaces and floor things before what stands on them)
  const accepted = [];
  const rank = (it) => ({ floor: 0, top: 1, wall: 0 }[CATALOG[it.id].kind]);
  for (const it of [...items].sort((a, b) => rank(a) - rank(b))) {
    if (!placed(it)) { accepted.push(it); continue; }
    const s = snap(CATALOG[it.id], it);
    const ok = Math.abs(s.x - it.x) < 1e-6 && Math.abs(s.z - it.z) < 1e-6 && checkPlacement(accepted, { id: it.id, x: it.x, z: it.z, rot: it.rot }).ok;
    if (!ok) { it.x = null; it.z = null; it.rot = 0; }
    accepted.push(it);
  }
  const seq = Number.isInteger(raw.seq) && raw.seq >= items.length ? raw.seq : items.length;
  return { v: 1, balance, seq, items };
}
export const creditHome = (home, gbp) => ({ ...home, balance: home.balance + Math.max(0, gbp || 0) });

// ---------------------------------------------------------------- doing things (each returns a new home)
const fail = (reason) => ({ ok: false, reason });
const clone = (h) => ({ ...h, items: h.items.map((i) => ({ ...i })) });
export const shortBy = (home, id) => Math.max(0, priceOf(id) - home.balance);
export function buy(home, id) {
  const def = CATALOG[id];
  if (!def || def.forSale === false) return fail('That is not for sale.');
  if (home.balance < def.price) return fail(`${money(def.price - home.balance)} more to go for the ${def.name.toLowerCase()}.`);
  const next = clone(home);
  next.balance -= def.price; next.seq += 1;
  const item = { uid: `i${next.seq}`, id, tone: null, x: null, z: null, rot: 0 };
  next.items.push(item);
  return { ok: true, home: next, uid: item.uid, spent: def.price };
}
const find = (home, uid) => home.items.find((i) => i.uid === uid);
// what stands on a desk or table: its riders (they travel with it and go away with it)
function ridersOf(items, base) {
  const bd = CATALOG[base.id];
  if (!bd?.surface || !placed(base)) return [];
  const bf = footOf(bd, base.x, base.z, base.rot);
  return items.filter((o) => o !== base && placed(o) && CATALOG[o.id].kind === 'top' && within(footOf(CATALOG[o.id], o.x, o.z, o.rot), bf));
}
export function sell(home, uid) {
  const it = find(home, uid);
  if (!it) return fail('That is not yours to sell.');
  if (it.starter) return fail('Your starter things are not worth anything: keep it, or move it.');
  const next = clone(home);
  const base = find(next, uid);
  for (const r of ridersOf(next.items, base)) { r.x = null; r.z = null; r.rot = 0; }
  next.items = next.items.filter((i) => i.uid !== uid);
  const back = sellPrice(it);
  next.balance += back;
  return { ok: true, home: next, refund: back };
}
export function unplace(home, uid) {
  if (!find(home, uid)) return fail('That is not yours.');
  const next = clone(home);
  const it = find(next, uid);
  for (const r of ridersOf(next.items, it)) { r.x = null; r.z = null; r.rot = 0; }
  it.x = null; it.z = null; it.rot = 0;
  return { ok: true, home: next };
}
// put an unplaced thing, or move a placed one (its riders go with it)
export function place(home, uid, spot) {
  const it = find(home, uid);
  if (!it) return fail('That is not yours.');
  const def = CATALOG[it.id];
  const s = snap(def, spot);
  const next = clone(home);
  const me = find(next, uid);
  const riders = placed(me) ? ridersOf(next.items, me) : [];
  const from = { x: me.x, z: me.z, rot: me.rot };
  const rest = next.items.filter((i) => i !== me && !riders.includes(i));
  const r = checkPlacement(rest, { id: me.id, ...s });
  if (!r.ok) return fail(r.reason);
  me.x = s.x; me.z = s.z; me.rot = s.rot;
  // riders: turned about the base's centre by the change of rotation, then carried by its move
  const turn = quarter(s.rot) - quarter(from.rot);
  const th = ((turn % 4) + 4) % 4 * HALF_PI;
  for (const rd of riders) {
    const dx = rd.x - from.x, dz = rd.z - from.z;
    const nx = dx * Math.cos(th) + dz * Math.sin(th), nz = -dx * Math.sin(th) + dz * Math.cos(th);
    rd.x = Math.round((s.x + nx) * 4) / 4; rd.z = Math.round((s.z + nz) * 4) / 4; rd.rot = ((quarter(rd.rot) + turn) % 4 + 4) % 4 * HALF_PI;
  }
  for (const rd of riders) {
    const c = checkPlacement([...rest, me, ...riders.filter((x) => x !== rd)], { id: rd.id, x: rd.x, z: rd.z, rot: rd.rot });
    if (!c.ok) return fail(`The ${nameOf(rd).toLowerCase()} on it would not fit there.`);
  }
  return { ok: true, home: next, spot: s };
}
export const move = place;
export function recolour(home, uid, tone) {
  const it = find(home, uid);
  if (!it) return fail('That is not yours.');
  const def = CATALOG[it.id];
  if (!def.tones) return fail(`The ${def.name.toLowerCase()} only comes in one colour.`);
  if (!def.tones.includes(tone)) return fail('That colour does not suit it.');
  const next = clone(home);
  find(next, uid).tone = tone;
  return { ok: true, home: next };
}
