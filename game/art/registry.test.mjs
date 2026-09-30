/* Art registry: pure checks in node (no WebGL, no three). The trees here are
   tiny fakes with the THREE.Object3D shape: children, matrix.elements, geometry. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register, make, list, get, measure, check, BUDGETS } from './registry.js';

// ---- a tiny fake Object3D tree ----
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function translate(x, y, z) { const e = I(); e[12] = x; e[13] = y; e[14] = z; return e; }
function node(opts = {}) {
  const o = {
    children: [], visible: opts.visible ?? true, userData: {}, matrix: { elements: opts.matrix || I() },
    geometry: opts.geometry, isMesh: !!opts.geometry && !opts.isLine, isLine: !!opts.isLine,
    add(...cs) { this.children.push(...cs); return this; },
    traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); },
  };
  for (const c of opts.children || []) o.add(c);
  return o;
}
// A w x h x d box sitting on the floor (y from 0 to h), centred on x and z.
function boxGeometry(w, h, d, { indexed = true } = {}) {
  const pts = [];
  for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-d / 2, d / 2]) pts.push(x, y, z);
  if (indexed) return { index: { count: 36 }, attributes: { position: { count: 8, itemSize: 3, array: new Float32Array(pts) } } };
  const arr = new Float32Array(36 * 3);
  for (let i = 0; i < 36; i++) arr.set(pts.slice((i % 8) * 3, (i % 8) * 3 + 3), i * 3);
  return { index: null, attributes: { position: { count: 36, itemSize: 3, array: arr } } };
}
const box = (w, h, d, o = {}) => node({ geometry: boxGeometry(w, h, d, o), ...o });

test('register defaults the sector and the budget from the category', () => {
  register('t-reg-desk', { category: 'furniture', tiles: [2, 1], build: () => box(1, 1, 1) });
  const meta = list().find((a) => a.id === 't-reg-desk');
  assert.deepEqual(meta, { id: 't-reg-desk', category: 'furniture', sector: 'core', tiles: [2, 1], budget: 3000, budgetReason: null });
  assert.equal(BUDGETS.furniture, 3000);
  assert.equal(BUDGETS.equipment, 6000);
  assert.equal(BUDGETS.character, 7000);
  assert.equal(BUDGETS.floor, 200);
});

test('duplicate ids throw', () => {
  register('t-dup', { category: 'prop', tiles: [1, 1], build: () => box(1, 1, 1) });
  assert.throws(() => register('t-dup', { category: 'prop', tiles: [1, 1], build: () => box(1, 1, 1) }), /already registered/);
});

test('bad definitions throw', () => {
  const ok = { category: 'prop', tiles: [1, 1], build: () => box(1, 1, 1) };
  assert.throws(() => register('Not_Kebab', ok), /kebab-case/);
  assert.throws(() => register('t-bad-trailing-', ok), /kebab-case/);
  assert.throws(() => register('t-bad-cat', { ...ok, category: 'mystery' }), /budget/);
  assert.throws(() => register('t-bad-tiles', { ...ok, tiles: [0, 1] }), /tiles/);
  assert.throws(() => register('t-bad-tiles2', { ...ok, tiles: [1] }), /tiles/);
  assert.throws(() => register('t-bad-build', { ...ok, build: null }), /build/);
  assert.throws(() => register('t-bad-over', { ...ok, category: 'furniture', budget: 9000 }), /exceeds.*budgetReason/);
  assert.throws(() => register('t-bad-over2', { ...ok, category: 'furniture', budget: 9000, budgetReason: '   ' }), /budgetReason/, 'a blank reason is no reason');
  assert.equal(get('t-bad-over'), undefined);
  assert.equal(get('t-bad-cat'), undefined, 'a rejected asset is not registered');
  register('t-custom-cat', { ...ok, category: 'mystery', budget: 500 });
  assert.equal(get('t-custom-cat').budget, 500, 'an unknown category is fine with an explicit budget');
  register('t-lower', { ...ok, category: 'furniture', budget: 1200 });
  assert.equal(get('t-lower').budget, 1200, 'a budget may be tighter than the category default');
});

test('a budget above the category default is allowed with a reason, and list exposes it', () => {
  register('t-over-ok', { category: 'furniture', tiles: [3, 1], budget: 4500, budgetReason: 'three linked desks in one piece', build: () => box(1, 1, 1) });
  const meta = list().find((a) => a.id === 't-over-ok');
  assert.equal(meta.budget, 4500);
  assert.equal(meta.budgetReason, 'three linked desks in one piece');
  const within = list().find((a) => a.id === 't-reg-desk');
  assert.equal(within.budgetReason, null);
});

test('list filters by category and sector', () => {
  register('t-f-lab-bench', { category: 'furniture', sector: 't-lab', tiles: [2, 1], build: () => box(1, 1, 1) });
  register('t-f-lab-fridge', { category: 'equipment', sector: 't-lab', tiles: [1, 1], build: () => box(1, 1, 1) });
  register('t-f-gym-mat', { category: 'furniture', sector: 't-gym', tiles: [1, 2], build: () => box(1, 1, 1) });
  assert.deepEqual(list({ sector: 't-lab' }).map((a) => a.id), ['t-f-lab-bench', 't-f-lab-fridge']);
  assert.deepEqual(list({ sector: 't-lab', category: 'furniture' }).map((a) => a.id), ['t-f-lab-bench']);
  assert.deepEqual(list({ category: 'furniture', sector: 't-gym' }).map((a) => a.id), ['t-f-gym-mat']);
  assert.ok(list().length >= 3);
  assert.ok(list({ category: 'furniture' }).every((a) => a.category === 'furniture'));
  const copy = list()[0]; copy.tiles.push(99);
  assert.notEqual(list()[0].tiles.length, 3, 'list returns copies');
});

test('make passes options to build and stamps the asset id', () => {
  let seen = null;
  register('t-make', { category: 'prop', tiles: [1, 1], anims: { spin: () => {} }, build: (opts) => { seen = opts; return box(0.5, 0.5, 0.5); } });
  const o = make('t-make', { seed: 3 });
  assert.equal(o.userData.assetId, 't-make');
  assert.deepEqual(seen, { seed: 3 });
  make('t-make');
  assert.deepEqual(seen, {}, 'opts default to an empty object');
  assert.equal(typeof get('t-make').anims.spin, 'function');
  assert.throws(() => make('t-nope'), /unknown asset/);
  register('t-make-bad', { category: 'prop', tiles: [1, 1], build: () => null });
  assert.throws(() => make('t-make-bad'), /did not return/);
});

test('measure counts triangles, indexed and not, and drawables', () => {
  assert.equal(measure(box(1, 1, 1)).triangles, 12);
  assert.equal(measure(box(1, 1, 1, { indexed: false })).triangles, 12);
  const tree = node({ children: [box(1, 1, 1), box(1, 1, 1), node({ children: [box(1, 1, 1)] })] });
  const m = measure(tree);
  assert.equal(m.triangles, 36);
  assert.equal(m.drawables, 3);
  assert.equal(m.hasNaN, false);
});

test('outline hulls are reported separately and excluded from the budget (ruling P2-4)', () => {
  const body = box(1, 1, 1);
  const hull = box(1, 1, 1); hull.userData.outlineChild = true;
  body.add(hull);
  const m = measure(node({ children: [body] }));
  assert.equal(m.triangles, 24);
  assert.equal(m.outlineTriangles, 12);
  assert.equal(m.drawables, 2);
  // 12 mesh triangles against a budget of 12: within, although 24 are drawn with the hull
  assert.deepEqual(check({ id: 'x', category: 'prop', tiles: [1, 1], budget: 12 }, m), []);
  assert.match(check({ id: 'x', category: 'prop', tiles: [1, 1], budget: 11 }, m).join(), /over budget: 12 of 11/);
});

test('lines add a drawable but no triangles; hidden subtrees are skipped', () => {
  const line = node({ geometry: boxGeometry(1, 1, 1), isLine: true });
  const hidden = node({ visible: false, children: [box(5, 5, 5)] });
  const m = measure(node({ children: [box(1, 1, 1), line, hidden] }));
  assert.equal(m.triangles, 12);
  assert.equal(m.drawables, 2);
  assert.ok(m.bbox.w < 1.01, 'the hidden 5-unit box does not widen the bbox');
});

test('measure gives the bounding box through child transforms, in the root frame', () => {
  const tree = node({ matrix: translate(100, 100, 100), children: [
    box(1, 2, 1),
    node({ matrix: translate(1, 0, 0), children: [box(1, 1, 1)] }),
  ] });
  const m = measure(tree);
  assert.deepEqual(m.bbox, { w: 2, h: 2, d: 1 });
  assert.deepEqual(m.bounds, { min: [-0.5, 0, -0.5], max: [1.5, 2, 0.5] });
});

test('measure flags NaN in positions and in transforms', () => {
  const g = boxGeometry(1, 1, 1); g.attributes.position.array[4] = NaN;
  assert.equal(measure(node({ children: [node({ geometry: g })] })).hasNaN, true);
  const m = translate(NaN, 0, 0);
  assert.equal(measure(node({ children: [node({ matrix: m, children: [box(1, 1, 1)] })] })).hasNaN, true);
  assert.equal(measure(box(1, 1, 1)).hasNaN, false);
});

test('measure uses getX/getY/getZ when the attribute offers them (interleaved)', () => {
  const pts = [[-1, 0, -1], [1, 3, 1], [0, 0, 0]];
  const pos = { count: 3, getX: (i) => pts[i][0], getY: (i) => pts[i][1], getZ: (i) => pts[i][2] };
  const m = measure(node({ children: [node({ geometry: { index: null, attributes: { position: pos } } })] }));
  assert.deepEqual(m.bbox, { w: 2, h: 3, d: 2 });
  assert.equal(m.triangles, 1);
});

test('check reports budget, footprint, height, centring and NaN problems', () => {
  const meta = { id: 'x', category: 'furniture', tiles: [1, 1], budget: 20 };
  assert.deepEqual(check(meta, measure(box(1, 1, 1))), []);
  assert.deepEqual(check(meta, measure(box(1.04, 1, 1.04))), [], 'within the 5% tolerance');
  assert.match(check(meta, measure(box(1.2, 1, 1))).join(), /footprint/);
  assert.match(check(meta, measure(node({ matrix: I(), children: [node({ matrix: translate(0.4, 0, 0), children: [box(0.5, 1, 0.5)] })] }))).join(), /footprint/, 'off-centre content breaks the footprint');
  assert.match(check(meta, measure(box(1, 3.3, 1))).join(), /tall/);
  assert.deepEqual(check({ ...meta, category: 'structure' }, measure(box(1, 3.3, 1))), [], 'structures may be tall');
  assert.match(check({ ...meta, budget: 10 }, measure(box(1, 1, 1))).join(), /budget/);
  const g = boxGeometry(1, 1, 1); g.attributes.position.array[0] = NaN;
  assert.match(check(meta, measure(node({ children: [node({ geometry: g })] }))).join(), /NaN/);
  assert.match(check(meta, measure(node())).join(), /nothing/);
});
