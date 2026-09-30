/* The office furniture pack (game/art/furniture.js): what the generic catalogue test cannot see.
   Every asset is registered with its category, stands on a contact shadow, is outlined, toon-shaded
   and built from more than plain boxes in at least two theme tones; the monitor takes a draw
   function for its screen; the door opens; recolouring a palette key recolours the furniture;
   the new palette keys are in DEFAULTS, every preset, SCHEMA and the tweak panel; a whole room's
   worth bakes into a few draw calls. */
import { openGame, makeReporter } from './game_lib.mjs';

const EXPECT = {
  furniture: ['desk', 'office-chair', 'reception-counter', 'bookshelf', 'filing-cabinet', 'whiteboard', 'pinboard', 'sofa', 'coffee-table', 'water-cooler', 'vending-machine', 'coat-rack', 'rug'],
  prop: ['monitor', 'desk-lamp', 'plant-small', 'plant-tall', 'plant-hanging', 'crate-stack', 'mug', 'paper-stack'],
  structure: ['door', 'wall-segment', 'wall-window'],
};
const KEYS = ['woodLight', 'woodDark', 'metal', 'chrome', 'fabric', 'fabricAlt', 'plastic', 'leaf', 'leafLight', 'pot', 'sheet', 'cork', 'glass', 'bulb', 'plaster'].map((k) => `palette.${k}`);

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
  let fur;
  try { fur = await import('./furniture.js'); } catch (e) { return { importError: String(e) }; }
  th.resetTheme();
  const ids = Object.values(EXPECT).flat();
  out.exported = Array.isArray(fur.FURNITURE) ? [...fur.FURNITURE].sort() : null;
  out.registered = ids.map((id) => ({ id, meta: reg.get(id) && { category: reg.get(id).category, budget: reg.get(id).budget, reason: reg.get(id).budgetReason } }));
  out.samplesKept = ['sample-crate', 'sample-bench', 'sample-pillar'].every((id) => !!reg.get(id));

  // ---- per asset: contact shadow, outlines, toon, shapes, tones ----
  out.rows = ids.map((id) => {
    const o = reg.make(id);
    let blobs = 0, outlines = 0, meshes = 0, plainBoxes = 0, nonToon = [], bevelled = 0;
    const colours = new Set(), geos = new Set();
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
        if (m.userData.themeKey || m.color) colours.add(m.color.getHexString());
      }
    });
    const direct = o.children.filter((c) => c.userData.contactShadow).length;
    return { id, blobs, direct, outlines, meshes, geos: geos.size, plainBoxes, nonToon, tones: colours.size, bevelled };
  });

  // ---- monitor: draw function for the screen ----
  {
    let calls = 0, args = null;
    const mon = reg.make('monitor', { draw: (g, w, h) => { calls++; args = [typeof g.fillRect, w, h]; g.fillStyle = '#ff0000'; g.fillRect(0, 0, w, h); } });
    const s = mon.userData.screen;
    out.monitor = { hasScreen: !!s, calls, args };
    if (s) {
      const px = (c) => Array.from(c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data.slice(0, 3));
      out.monitor.red = px(s.canvas);
      let screenMesh = null; mon.traverse((x) => { if (x.isMesh && x.material.map === s.texture) screenMesh = x; });
      out.monitor.onMesh = !!screenMesh;
      const v0 = s.texture.version;
      s.draw((g, w, h) => { g.fillStyle = '#00ff00'; g.fillRect(0, 0, w, h); });
      out.monitor.green = px(s.canvas);
      out.monitor.bumped = s.texture.version > v0;
      // two monitors do not share a screen
      const other = reg.make('monitor');
      out.monitor.ownCanvas = other.userData.screen && other.userData.screen.canvas !== s.canvas;
      out.monitor.defaultDrawn = other.userData.screen && px(other.userData.screen.canvas).some((v) => v > 0);
    }
  }

  // ---- door: open(t) swings the leaf about its hinge ----
  {
    const d = reg.make('door');
    const leaf = d.userData.leaf;
    out.door = { open: typeof d.open, leaf: !!leaf, anim: !!(reg.get('door').anims && reg.get('door').anims.open) };
    if (typeof d.open === 'function' && leaf) {
      const box = () => { d.updateMatrixWorld(true); return new THREE.Box3().setFromObject(leaf); };
      d.open(0); const b0 = box(); const a0 = leaf.rotation.y;
      d.open(1); const b1 = box(); const a1 = leaf.rotation.y;
      d.open(0.5); const a5 = leaf.rotation.y;
      out.door.swing = Math.abs(a1 - a0) * 180 / Math.PI;
      out.door.half = Math.abs(a5 - a0) * 180 / Math.PI;
      out.door.closedDepth = b0.max.z - b0.min.z;
      out.door.openDepth = b1.max.z - b1.min.z;
      out.door.towardFront = b1.max.z > b0.max.z + 0.3;
      d.open(0);
      out.door.closedAgain = Math.abs(leaf.rotation.y - a0) < 1e-9;
    }
  }

  // ---- live recolour: palette.woodDark reaches the desk, palette.fabric the sofa ----
  {
    const desk = reg.make('desk'), sofa = reg.make('sofa');
    const find2 = (o, hex) => { let m = null; o.traverse((x) => { for (const mt of [].concat(x.material || [])) if (!m && mt.color && mt.color.getHexString() === hex) m = mt; }); return m; };
    const wd = new THREE.Color(th.get('palette.woodDark')).getHexString();
    const deskMat = find2(desk, wd);
    const sofaMat = find2(sofa, new THREE.Color(th.get('palette.fabric')).getHexString());
    out.recolour = { deskHas: !!deskMat, sofaHas: !!sofaMat };
    th.set('palette.woodDark', '#ff00ff');
    th.set('palette.fabric', '#00ffff');
    out.recolour.desk = deskMat && deskMat.color.getHexString();
    out.recolour.sofa = sofaMat && sofaMat.color.getHexString();
    th.applyPreset('Night lab');
    out.recolour.night = deskMat && deskMat.color.getHexString() === new THREE.Color(th.PRESETS['Night lab'].palette.woodDark).getHexString();
    th.resetTheme();
    out.recolour.back = deskMat && deskMat.color.getHexString() === wd;
  }

  // ---- theme keys ----
  const hex = /^#[0-9a-f]{6}$/i;
  const at = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
  out.keysDefaults = KEYS.filter((p) => !hex.test(at(th.DEFAULTS, p) || ''));
  out.keysPresets = Object.keys(th.PRESETS).filter((n) => n !== 'Warm dusk').map((n) => ({ n, missing: KEYS.filter((p) => !hex.test(at(th.PRESETS[n], p) || '')) }));
  const schemaPaths = th.SCHEMA.flatMap(([, rows]) => rows.map((x) => x[0]));
  out.keysSchema = KEYS.filter((p) => !schemaPaths.includes(p));
  out.keysPanel = KEYS.filter((p) => !document.getElementById('gm-tw-' + p.replace('.', '-')));

  // ---- a room's worth bakes down: every asset once, static-batched ----
  {
    const room = new THREE.Group();
    ids.forEach((id, i) => { const o = reg.make(id); o.position.set((i % 6) * 3, 0, Math.floor(i / 6) * 3); room.add(o); });
    let before = 0; room.traverse((x) => { if (x.isMesh || x.isSprite) before++; });
    kit.bakeStatic(room);
    let after = 0; room.traverse((x) => { if (x.isMesh || x.isSprite) after++; });
    out.bake = { before, after };
  }
  return out;
}, { EXPECT, KEYS });

if (r.importError) {
  t.check('game/art/furniture.js imports', false, r.importError);
  await close(); t.finish();
}
const all = Object.values(EXPECT).flat();
t.check('furniture.js exports FURNITURE, the list of its asset ids', JSON.stringify(r.exported) === JSON.stringify([...all].sort()), JSON.stringify(r.exported));
for (const [cat, ids] of Object.entries(EXPECT)) {
  const wrong = r.registered.filter((x) => ids.includes(x.id) && (!x.meta || x.meta.category !== cat)).map((x) => `${x.id}:${x.meta && x.meta.category}`);
  t.check(`the ${cat} assets are registered as ${cat}`, wrong.length === 0, wrong.join(', '));
}
const raised = r.registered.filter((x) => x.meta && x.meta.budget > 3000);
t.check('any budget above the category default carries a reason (ruling P2-5)', raised.every((x) => !!x.meta.reason), JSON.stringify(raised));
t.check('the sample assets stay registered (ruling P2-6)', r.samplesKept === true);
const rows = r.rows;
t.check('every asset stands on exactly one contact shadow, a direct child', rows.every((x) => x.blobs === 1 && x.direct === 1), rows.filter((x) => x.blobs !== 1 || x.direct !== 1).map((x) => `${x.id}:${x.blobs}`).join(', '));
t.check('every asset is outlined', rows.every((x) => x.outlines >= 1), rows.filter((x) => x.outlines < 1).map((x) => `${x.id}:${x.outlines}`).join(', '));
t.check('every lit material is toon-shaded with the kit ramp (unlit only for screens and bulbs)', rows.every((x) => x.nonToon.length === 0), rows.filter((x) => x.nonToon.length).map((x) => `${x.id}:${x.nonToon}`).join(', '));
t.check('no asset uses a plain BoxGeometry', rows.every((x) => x.plainBoxes === 0), rows.filter((x) => x.plainBoxes).map((x) => x.id).join(', '));
t.check('every asset is built from at least 4 meshes of at least 3 distinct shapes, most of them bevelled',
  rows.every((x) => x.meshes >= 4 && x.geos >= 3 && x.bevelled >= x.meshes * 0.5), rows.filter((x) => !(x.meshes >= 4 && x.geos >= 3 && x.bevelled >= x.meshes * 0.5)).map((x) => `${x.id}:${x.meshes}/${x.geos}/${x.bevelled}`).join(', '));
t.check('every asset shows at least 2 theme tones', rows.every((x) => x.tones >= 2), rows.filter((x) => x.tones < 2).map((x) => `${x.id}:${x.tones}`).join(', '));
t.note('per asset (meshes / shapes / tones)', rows.map((x) => `${x.id} ${x.meshes}/${x.geos}/${x.tones}`).join(' · '));

const m = r.monitor;
t.check('monitor: make(\'monitor\', { draw }) calls draw(ctx, w, h) once for its screen', m.calls === 1 && m.args && m.args[0] === 'function' && m.args[1] > 100 && m.args[2] > 50, JSON.stringify(m));
t.check('monitor: the drawing lands on the screen canvas, shown by the screen mesh', m.hasScreen && m.red && m.red[0] > 200 && m.red[1] < 40 && m.onMesh === true, JSON.stringify(m));
t.check('monitor: userData.screen.draw(fn) redraws and flags the texture for upload', m.green && m.green[1] > 200 && m.green[0] < 40 && m.bumped === true, JSON.stringify(m));
t.check('monitor: each monitor has its own screen, drawn by default', m.ownCanvas === true && m.defaultDrawn === true, JSON.stringify(m));

const d = r.door;
t.check('door: exposes open(t), its leaf, and an open animation for the catalogue', d.open === 'function' && d.leaf && d.anim, JSON.stringify(d));
t.check('door: open(1) swings the leaf 80-120 degrees toward the front; open(0.5) is part-way; open(0) closes it',
  d.swing >= 80 && d.swing <= 120 && d.half > 20 && d.half < d.swing && d.towardFront && d.closedAgain, JSON.stringify(d));

const c = r.recolour;
t.check('setting palette.woodDark recolours the desk; palette.fabric the sofa', c.deskHas && c.sofaHas && c.desk === 'ff00ff' && c.sofa === '00ffff', JSON.stringify(c));
t.check('a preset recolours the desk and reset restores it', c.night === true && c.back === true, JSON.stringify(c));
t.check('DEFAULTS has a hex colour for each new furniture key', r.keysDefaults.length === 0, r.keysDefaults.join(', '));
t.check('every non-default preset sets its own furniture colours', r.keysPresets.every((p) => p.missing.length === 0), JSON.stringify(r.keysPresets));
t.check('SCHEMA lists the furniture keys', r.keysSchema.length === 0, r.keysSchema.join(', '));
t.check('the tweak panel shows an input for each furniture key', r.keysPanel.length === 0, r.keysPanel.join(', '));
t.check(`every asset once (${all.length}) bakes into a few draw calls (under 90 meshes after bakeStatic)`, r.bake.after < 90, JSON.stringify(r.bake));
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
