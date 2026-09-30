/* The sector packs (game/art/sectors/*.js): what the generic catalogue test cannot see.
   Every sector has its assets (at least 4), each registered with its sector and category, standing on
   one contact shadow, outlined, toon-shaded, built from more than plain boxes in at least two tones;
   every Sectors palette key is in DEFAULTS, every preset, SCHEMA and the tweak panel, and recolours a
   material of its sector live; each sector corner (the catalogue's floor patch) stands on its own floor,
   shows every asset of its sector, keeps footprints apart and inside the patch, and stands benchtop
   props on a surface; the catalogue can open each corner. */
import { openGame, makeReporter } from './game_lib.mjs';

const EXPECT = {
  lab: ['lab-bench', 'microscope', 'centrifuge', 'fume-hood', 'beaker-set', 'lab-fridge', 'safety-shower'],
  gym: ['treadmill', 'bench-press', 'dumbbell-rack', 'yoga-mat', 'kettlebell-set', 'rowing-machine'],
  school: ['student-desk', 'chalkboard', 'locker-row', 'teacher-desk', 'projector-screen'],
  clinic: ['exam-bed', 'privacy-curtain', 'medicine-cabinet', 'wheelchair', 'clinic-desk'],
  hall: ['stage', 'folding-chair-row', 'podium', 'notice-board'],
  coworking: ['hot-desk-pod', 'phone-booth', 'bean-bag', 'standing-desk', 'coffee-bar'],
};
const FLOORS = { lab: 'lino', gym: 'rubber', school: 'wood', clinic: 'ceramic', hall: 'wood', coworking: 'carpet' };
// each Sectors key, and the sector whose assets must show it
const KEYS = {
  labTop: 'lab', fluid: 'lab', hazard: 'lab', rubber: 'gym', gymAccent: 'gym', yogaMat: 'gym', chalkboard: 'school', locker: 'school',
  mint: 'clinic', medical: 'clinic', velvet: 'hall', felt: 'coworking', coral: 'coworking',
};

const t = makeReporter();
const { page, errors, close } = await openGame('game/art/catalogue.html', { context: { viewport: { width: 1280, height: 800 } } });
try {
  await page.waitForFunction(() => window.__catalogue && window.__catalogue.ready === true, null, { timeout: 30000 });
} catch (e) {
  t.check('the catalogue signals ready', false, String(e).split('\n')[0]);
  await close(); t.finish();
}

const r = await page.evaluate(async ({ EXPECT, KEYS }) => {
  const out = {};
  const THREE = await import('three');
  const reg = await import('./index.js');
  const th = await import('../engine/theme.js');
  const kit = await import('../engine/kit.js');
  let sec;
  try { sec = await import('./sectors/common.js'); } catch (e) { return { importError: String(e) }; }
  th.resetTheme();
  const ids = Object.values(EXPECT).flat();
  out.exported = Object.fromEntries(Object.keys(EXPECT).map((s) => [s, sec.SECTOR_ASSETS && sec.SECTOR_ASSETS[s] ? [...sec.SECTOR_ASSETS[s]].sort() : null]));
  out.bySector = Object.fromEntries(Object.keys(EXPECT).map((s) => [s, reg.list({ sector: s }).map((a) => a.id)]));
  out.registered = ids.map((id) => { const m = reg.get(id); return { id, meta: m && { category: m.category, sector: m.sector, budget: m.budget, reason: m.budgetReason, tiles: m.tiles } }; });
  out.samplesKept = ['sample-crate', 'sample-bench', 'sample-pillar'].every((id) => !!reg.get(id));

  // ---- per asset: contact shadow, outlines, toon, shapes, tones, budget ----
  out.rows = ids.map((id) => {
    const o = reg.make(id);
    let blobs = 0, outlines = 0, meshes = 0, plainBoxes = 0, bevelled = 0;
    const nonToon = [], colours = new Set(), geos = new Set();
    o.traverse((x) => {
      if (x.userData.contactShadow) { blobs++; return; }
      if (x.userData.outlineChild) { outlines++; return; }
      if (!x.isMesh) return;
      meshes++;
      geos.add(x.geometry.uuid);
      if (x.geometry.type === 'BoxGeometry') plainBoxes++;
      if (x.geometry.userData.hull) bevelled++;
      for (const m of [].concat(x.material)) {
        if (m.isMeshToonMaterial) { if (m.gradientMap !== kit.gradientMap && m.gradientMap !== kit.smoothRamp) nonToon.push(m.type); }
        else if (!m.isMeshBasicMaterial) nonToon.push(m.type);
        if (m.color) colours.add(m.color.getHexString());
      }
    });
    const direct = o.children.filter((c) => c.userData.contactShadow).length;
    const m = reg.measure(o);
    return { id, blobs, direct, outlines, meshes, geos: geos.size, plainBoxes, bevelled, nonToon, tones: colours.size, tris: m.triangles - m.outlineTriangles, problems: reg.check(reg.get(id), m) };
  });

  // ---- every Sectors key recolours a material of its sector, live ----
  out.recolour = Object.entries(KEYS).map(([k, s]) => {
    const path = `palette.${k}`;
    const objs = EXPECT[s].map((id) => reg.make(id));
    const was = th.get(path);
    const probe = `#${(0xa00000 + Object.keys(KEYS).indexOf(k) * 0x0101 + 0x1234).toString(16)}`;
    th.set(path, probe);
    let hit = false;
    for (const o of objs) o.traverse((x) => { for (const mt of [].concat(x.material || [])) if (mt.color && `#${mt.color.getHexString()}` === probe) hit = true; });
    th.set(path, was);
    return { k, s, hit };
  });
  {
    const board = reg.make('chalkboard');
    let mat = null; board.traverse((x) => { for (const mt of [].concat(x.material || [])) if (!mat && mt.color && mt.color.getHexString() === new THREE.Color(th.get('palette.chalkboard')).getHexString()) mat = mt; });
    th.applyPreset('Night lab');
    out.presetRecolours = !!mat && mat.color.getHexString() === new THREE.Color(th.PRESETS['Night lab'].palette.chalkboard).getHexString();
    th.resetTheme();
  }

  // ---- theme keys ----
  const hex = /^#[0-9a-f]{6}$/i;
  const at = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
  const paths = Object.keys(KEYS).map((k) => `palette.${k}`);
  out.keysDefaults = paths.filter((p) => !hex.test(at(th.DEFAULTS, p) || ''));
  out.keysPresets = Object.keys(th.PRESETS).filter((n) => n !== 'Warm dusk').map((n) => ({ n, missing: paths.filter((p) => !hex.test(at(th.PRESETS[n], p) || '')) }));
  const group = th.SCHEMA.find(([name]) => name === 'Sectors');
  out.keysSchema = paths.filter((p) => !(group && group[1].some((x) => x[0] === p)));
  out.keysPanel = paths.filter((p) => !document.getElementById('gm-tw-' + p.replace('.', '-')));

  // ---- the sector corners ----
  out.corners = Object.keys(EXPECT).map((s) => {
    const c = sec.CORNERS && sec.CORNERS[s];
    if (!c) return { s, missing: true };
    const res = { s, floor: c.floor, overlaps: [], outside: [], floating: [], unknown: [] };
    const placed = [];
    for (const [id, x, z, ry = 0, y = 0] of c.props) {
      const meta = reg.get(id);
      if (!meta) { res.unknown.push(id); continue; }
      // the footprint turned by ry, as an axis-aligned box
      const cs = Math.abs(Math.cos(ry)), sn = Math.abs(Math.sin(ry)), [w, d] = meta.tiles;
      const hw = (w * cs + d * sn) / 2, hd = (w * sn + d * cs) / 2;
      placed.push({ id, x, z, y, hw, hd, meta });
    }
    res.ids = placed.map((p) => p.id);
    const floorItems = placed.filter((p) => p.y === 0 && p.meta.category !== 'structure');
    const e = 1e-6;
    for (let i = 0; i < floorItems.length; i++) for (let j = i + 1; j < floorItems.length; j++) {
      const a = floorItems[i], b = floorItems[j];
      if (Math.abs(a.x - b.x) < a.hw + b.hw - e && Math.abs(a.z - b.z) < a.hd + b.hd - e) res.overlaps.push(`${a.id}/${b.id}`);
    }
    for (const p of placed) if (Math.abs(p.x) + p.hw > 3 + e || Math.abs(p.z) + p.hd > 3 + e) if (p.meta.category !== 'structure') res.outside.push(p.id);
    // anything lifted stands on a placed asset whose userData.surface is its height, inside that asset's footprint
    for (const p of placed.filter((q) => q.y > 0)) {
      const under = placed.find((q) => q !== p && q.y === 0 && Math.abs(p.x - q.x) <= q.hw && Math.abs(p.z - q.z) <= q.hd && Math.abs((reg.make(q.id).userData.surface ?? -1) - p.y) < 1e-6);
      if (!under) res.floating.push(p.id);
    }
    return res;
  });

  // ---- the catalogue opens each corner ----
  out.patchOptions = [...document.getElementById('patch-kind').options].map((o) => o.value);
  out.opened = [];
  for (const s of Object.keys(EXPECT)) {
    window.__catalogue.patch(`sector:${s}`);
    const cu = window.__catalogue.closeup;
    const seen = new Set(); let floor = null;
    cu && cu.obj && cu.obj.traverse((x) => { if (x.userData.assetId) seen.add(x.userData.assetId); if (x.userData.floorKind) floor = x.userData.floorKind; });
    out.opened.push({ s, mode: cu && cu.mode, floor, ids: [...seen], title: document.getElementById('cu-title').textContent });
  }
  window.__catalogue.close();

  // ---- a sector's worth bakes down ----
  out.bake = Object.keys(EXPECT).map((s) => {
    const room = new THREE.Group();
    EXPECT[s].forEach((id, i) => { const o = reg.make(id); o.position.set(i * 3, 0, 0); room.add(o); });
    let before = 0; room.traverse((x) => { if (x.isMesh) before++; });
    kit.bakeStatic(room);
    let after = 0; room.traverse((x) => { if (x.isMesh) after++; });
    return { s, before, after };
  });
  return out;
}, { EXPECT, KEYS });

if (r.importError) {
  t.check('game/art/sectors/common.js imports', false, r.importError);
  await close(); t.finish();
}
for (const [s, ids] of Object.entries(EXPECT)) {
  t.check(`${s}: SECTOR_ASSETS.${s} lists its assets`, JSON.stringify(r.exported[s]) === JSON.stringify([...ids].sort()), JSON.stringify(r.exported[s]));
  t.check(`${s}: at least 4 assets registered with sector "${s}"`, r.bySector[s].length >= 4 && ids.every((id) => r.bySector[s].includes(id)), JSON.stringify(r.bySector[s]));
}
const wrong = r.registered.filter((x) => !x.meta).map((x) => x.id);
t.check('every sector asset is registered', wrong.length === 0, wrong.join(', '));
const raised = r.registered.filter((x) => x.meta && x.meta.budget > 3000);
t.check('any budget above 3,000 carries a reason and a big-equipment category (rulings P2-5)', raised.every((x) => !!x.meta.reason), JSON.stringify(raised));
t.check('the sample assets stay registered (ruling P2-6)', r.samplesKept === true);
const rows = r.rows;
t.check('every sector asset stands on exactly one contact shadow, a direct child', rows.every((x) => x.blobs === 1 && x.direct === 1), rows.filter((x) => x.blobs !== 1 || x.direct !== 1).map((x) => `${x.id}:${x.blobs}`).join(', '));
t.check('every sector asset is outlined', rows.every((x) => x.outlines >= 1), rows.filter((x) => x.outlines < 1).map((x) => x.id).join(', '));
t.check('every lit material is toon-shaded with the kit ramp', rows.every((x) => x.nonToon.length === 0), rows.filter((x) => x.nonToon.length).map((x) => `${x.id}:${x.nonToon}`).join(', '));
t.check('no sector asset uses a plain BoxGeometry', rows.every((x) => x.plainBoxes === 0), rows.filter((x) => x.plainBoxes).map((x) => x.id).join(', '));
t.check('every sector asset has at least 4 meshes of at least 3 shapes, most bevelled',
  rows.every((x) => x.meshes >= 4 && x.geos >= 3 && x.bevelled >= x.meshes * 0.5), rows.filter((x) => !(x.meshes >= 4 && x.geos >= 3 && x.bevelled >= x.meshes * 0.5)).map((x) => `${x.id}:${x.meshes}/${x.geos}/${x.bevelled}`).join(', '));
t.check('every sector asset shows at least 2 tones', rows.every((x) => x.tones >= 2), rows.filter((x) => x.tones < 2).map((x) => x.id).join(', '));
t.check('every sector asset passes the registry checks (budget, footprint, height)', rows.every((x) => x.problems.length === 0), rows.filter((x) => x.problems.length).map((x) => `${x.id}: ${x.problems}`).join(' | '));
t.note('triangles', rows.map((x) => `${x.id} ${x.tris}`).join(' · '));

const miss = r.recolour.filter((x) => !x.hit).map((x) => `${x.k} (${x.s})`);
t.check('each Sectors key recolours a material of its sector live', miss.length === 0, miss.join(', '));
t.check('a preset recolours the chalkboard', r.presetRecolours === true);
t.check('DEFAULTS has a hex colour for each Sectors key', r.keysDefaults.length === 0, r.keysDefaults.join(', '));
t.check('every non-default preset sets each Sectors key', r.keysPresets.every((p) => p.missing.length === 0), JSON.stringify(r.keysPresets.filter((p) => p.missing.length)));
t.check('SCHEMA has a "Sectors" group listing the keys', r.keysSchema.length === 0, r.keysSchema.join(', '));
t.check('the tweak panel shows an input for each Sectors key', r.keysPanel.length === 0, r.keysPanel.join(', '));

for (const c of r.corners) {
  if (c.missing) { t.check(`${c.s} corner: CORNERS.${c.s} exists`, false); continue; }
  t.check(`${c.s} corner: on ${FLOORS[c.s]}, with every ${c.s} asset and only known ids`, c.floor === FLOORS[c.s] && EXPECT[c.s].every((id) => c.ids.includes(id)) && c.unknown.length === 0,
    JSON.stringify({ floor: c.floor, missing: EXPECT[c.s].filter((id) => !c.ids.includes(id)), unknown: c.unknown }));
  t.check(`${c.s} corner: floor footprints do not overlap and stay on the 6x6 patch`, c.overlaps.length === 0 && c.outside.length === 0, JSON.stringify({ overlaps: c.overlaps, outside: c.outside }));
  t.check(`${c.s} corner: lifted props stand on a surface`, c.floating.length === 0, c.floating.join(', '));
}
const wantOpts = Object.keys(EXPECT).map((s) => `sector:${s}`);
t.check('the floor patch offers a corner for each sector', wantOpts.every((o) => r.patchOptions.includes(o)), JSON.stringify(r.patchOptions));
for (const o of r.opened) {
  t.check(`the catalogue opens the ${o.s} corner on its floor with its assets`, o.mode === 'patch' && o.floor === FLOORS[o.s] && EXPECT[o.s].every((id) => o.ids.includes(id)), JSON.stringify(o));
}
t.check('each sector\'s assets bake into a few draw calls (under 40 meshes)', r.bake.every((b) => b.after < 40), JSON.stringify(r.bake));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
