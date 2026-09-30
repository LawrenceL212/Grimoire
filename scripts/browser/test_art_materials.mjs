/* Floors, materials and contact shadows (game/art/materials.js): what the generic catalogue
   test cannot see. Floor tiles share geometry and material per kind, recolour live from their
   theme keys, keep their pattern at game distance; contactShadow adds one multiply blob sized
   to the footprint; the catalogue's 6x6 floor patch works. */
import { openGame, makeReporter } from './game_lib.mjs';

const KINDS = ['wood', 'carpet', 'lino', 'concrete', 'rubber', 'ceramic'];
const KEYS = KINDS.map((k) => `palette.floor${k[0].toUpperCase()}${k.slice(1)}`);
const t = makeReporter();
const { page, errors, close } = await openGame('game/art/catalogue.html', { context: { viewport: { width: 1280, height: 800 } } });
try {
  await page.waitForFunction(() => window.__catalogue && window.__catalogue.ready === true, null, { timeout: 30000 });
} catch (e) {
  t.check('the catalogue signals ready', false, String(e).split('\n')[0]);
  await close(); t.finish();
}

const r = await page.evaluate(async ({ KINDS, KEYS }) => {
  const out = {};
  const THREE = await import('three');
  const reg = await import('./index.js');
  const th = await import('../engine/theme.js');
  let mat;
  try { mat = await import('./materials.js'); } catch (e) { return { importError: String(e) }; }
  th.resetTheme();

  // ---- registry ----
  out.tiles = KINDS.map((k) => reg.get(`tile-${k}`)).map((a) => a && { id: a.id, category: a.category, tiles: a.tiles, budget: a.budget });
  out.blob = reg.get('shadow-blob') && { category: reg.get('shadow-blob').category };
  out.samplesKept = ['sample-crate', 'sample-bench', 'sample-pillar'].every((id) => !!reg.get(id));

  // ---- tiles: budget, shape, sharing ----
  const meshOf = (o) => { let m = null; o.traverse((x) => { if (x.isMesh && !m) m = x; }); return m; };
  out.tileRows = KINDS.map((k) => {
    const a = reg.make(`tile-${k}`), b = reg.make(`tile-${k}`);
    const m = reg.measure(a), ma = meshOf(a), mb = meshOf(b);
    const n = ma.geometry.attributes.normal;
    let tilted = 0;
    for (let i = 0; i < n.count; i++) if (n.getY(i) > 0.2 && n.getY(i) < 0.98) tilted++;
    return {
      kind: k, tris: m.triangles - m.outlineTriangles, bounds: m.bounds,
      sameGeo: ma.geometry === mb.geometry, sameMat: ma.material === mb.material,
      hasMap: !!(ma.material.map && ma.material.map.isTexture), tilted,
      geo: ma.geometry.uuid, mat: ma.material.uuid,
      receive: ma.receiveShadow === true,
    };
  });
  out.oneGeometry = new Set(out.tileRows.map((x) => x.geo)).size === 1;
  out.sixMaterials = new Set(out.tileRows.map((x) => x.mat)).size === 6;
  out.api = ['tileGeometry', 'tileMaterial', 'tileField', 'contactShadow', 'FLOOR_KINDS'].filter((k) => !(k in mat));

  // ---- theme keys ----
  const merged = (name) => { const o = JSON.parse(JSON.stringify(th.DEFAULTS)); const w = (a, b) => { for (const k of Object.keys(b)) { if (b[k] && typeof b[k] === 'object') w(a[k] ??= {}, b[k]); else a[k] = b[k]; } }; w(o, th.PRESETS[name]); return o; };
  const hex = /^#[0-9a-f]{6}$/i;
  out.defaults = KEYS.filter((p) => !hex.test(p.split('.').reduce((o, k) => o?.[k], th.DEFAULTS)));
  out.presetsDiffer = Object.keys(th.PRESETS).filter((n) => n !== 'Warm dusk').map((n) => ({ n, own: KEYS.filter((p) => th.PRESETS[n].palette && hex.test(th.PRESETS[n].palette[p.split('.')[1]] || '')).length }));
  out.presetsResolve = Object.keys(th.PRESETS).every((n) => KEYS.every((p) => hex.test(p.split('.').reduce((o, k) => o?.[k], merged(n)))));
  const schemaPaths = th.SCHEMA.flatMap(([, rows]) => rows.map((r) => r[0]));
  out.schemaMissing = [...KEYS, 'light.contact'].filter((p) => !schemaPaths.includes(p));
  out.panelInputs = KEYS.filter((p) => !document.getElementById('gm-tw-' + p.replace('.', '-')));

  // ---- live recolour ----
  const wood = meshOf(reg.make('tile-wood')).material, carpet = meshOf(reg.make('tile-carpet')).material;
  const carpet0 = carpet.color.getHexString();
  th.set('palette.floorWood', '#ff0000');
  out.woodRed = wood.color.getHexString();
  out.carpetUntouched = carpet.color.getHexString() === carpet0;
  th.applyPreset('Night lab');
  out.woodNight = wood.color.getHexString() === new THREE.Color(th.PRESETS['Night lab'].palette.floorWood).getHexString();
  out.woodNightHex = wood.color.getHexString();
  th.resetTheme();
  out.woodBack = wood.color.getHexString() === new THREE.Color(th.DEFAULTS.palette.floorWood).getHexString();

  // ---- patterns survive game distance: shrink each texture to 32 px (about one tile at the
  //      default camera at 720p) and measure the luminance spread that is left ----
  out.contrast = KINDS.map((k) => {
    const src = mat.tileMaterial(k).map.userData.canvas;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, 32, 32);
    const d = g.getImageData(0, 0, 32, 32).data; const L = [];
    for (let i = 0; i < d.length; i += 4) L.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255);
    const mean = L.reduce((a, b) => a + b, 0) / L.length;
    return { k, sd: Math.sqrt(L.reduce((a, b) => a + (b - mean) ** 2, 0) / L.length), mean };
  });

  // ---- carpet reads as carpet, not ribbed plastic: no dominant stripe direction, no parity checker ----
  {
    const src = mat.tileMaterial('carpet').map.userData.canvas;
    const n = src.width, d = src.getContext('2d').getImageData(0, 0, n, n).data;
    const rows = new Array(n).fill(0), cols = new Array(n).fill(0);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = d[(y * n + x) * 4] / 255; rows[y] += v / n; cols[x] += v / n; }
    const sd = (a) => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
    out.carpetProfile = { rows: sd(rows), cols: sd(cols) };
    const cells = []; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) cells.push([i - 2.5, j - 2.5]);
    const f = mat.tileField('carpet', cells, { seed: 3 });
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), e = new THREE.Euler();
    const turnByParity = [[], []], shadeByParity = [[], []];
    cells.forEach(([x, z], i) => {
      f.getMatrixAt(i, M); M.decompose(p, q, s); e.setFromQuaternion(q);
      const odd = (Math.floor(x) + Math.floor(z)) & 1;
      turnByParity[odd].push(Math.round(((e.y % Math.PI) + Math.PI) % Math.PI / (Math.PI / 2)) % 2);
      f.getColorAt(i, c); shadeByParity[odd].push(c.r);
    });
    const mean = (a) => a.reduce((s2, v) => s2 + v, 0) / a.length;
    out.carpetChecker = {
      turnsFollowParity: turnByParity[0].every((v) => v === 0) && turnByParity[1].every((v) => v === 1),
      shadeGap: Math.abs(mean(shadeByParity[0]) - mean(shadeByParity[1])),
    };
  }

  // ---- contact shadows ----
  const isBlob = (c) => c.userData && c.userData.contactShadow === true;
  const blobRow = (id, opts) => {
    const o = reg.make(id);
    const before = reg.measure(o);
    const b1 = mat.contactShadow(o, opts);
    const b2 = mat.contactShadow(o, opts); // idempotent: replaces, never stacks
    const blobs = o.children.filter(isBlob);
    const bl = blobs[0];
    const bb = new THREE.Box3().setFromObject(bl);
    return {
      id, count: blobs.length, returned: b2 === bl && !!b1,
      multiply: bl.material.blending === THREE.MultiplyBlending, premult: bl.material.premultipliedAlpha === true,
      depthWrite: bl.material.depthWrite, cast: bl.castShadow,
      w: bb.max.x - bb.min.x, d: bb.max.z - bb.min.z, y: bb.max.y,
      bw: before.bbox.w, bd: before.bbox.d, tiles: reg.get(id).tiles,
      inFoot: bb.min.x >= -reg.get(id).tiles[0] / 2 - 1e-6 && bb.max.x <= reg.get(id).tiles[0] / 2 + 1e-6 && bb.min.z >= -reg.get(id).tiles[1] / 2 - 1e-6 && bb.max.z <= reg.get(id).tiles[1] / 2 + 1e-6,
      afterMeasure: reg.measure(o).bbox,
    };
  };
  out.blobCrate = blobRow('sample-crate');
  out.blobBench = blobRow('sample-bench', { opacity: 0.6 });
  // a person-shaped object with no asset id: sized from its own bounding box
  const person = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 3, 8), new THREE.MeshBasicMaterial());
  body.position.y = 0.67; person.add(body);
  const pb = mat.contactShadow(person);
  const pbb = new THREE.Box3().setFromObject(pb);
  out.person = { count: person.children.filter(isBlob).length, w: pbb.max.x - pbb.min.x, d: pbb.max.z - pbb.min.z };
  // strength follows the theme's light.contact, scaled by the per-object opacity
  const u = pb.material.uniforms;
  const s0 = u.strength.value;
  th.set('light.contact', 0.9);
  out.strength = { before: s0, after: u.strength.value, opacity: u.opacity.value };
  th.resetTheme();

  // ---- the blob fades with the scene fog: render a blob on white, with and without thick fog ----
  {
    out.blobFogFlag = pb.material.fog === true;
    const rt = new THREE.WebGLRenderTarget(32, 32);
    const ren = new THREE.WebGLRenderer();
    ren.setClearColor(0xffffff, 1);
    const scene = new THREE.Scene();
    const o = new THREE.Group(); scene.add(o);
    // a 3x3 invisible body to size the blob from, removed once the blob is made
    const body = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 3), new THREE.MeshBasicMaterial({ visible: false }));
    o.add(body); mat.contactShadow(o, { footprint: [4, 4], spread: 1 }); o.remove(body);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 6, 0.001); cam.lookAt(0, 0, 0);
    const px = () => { ren.setRenderTarget(rt); ren.render(scene, cam); const b = new Uint8Array(4); ren.readRenderTargetPixels(rt, 16, 16, 1, 1, b); ren.setRenderTarget(null); return b[0]; };
    out.blobClear = px();
    scene.fog = new THREE.Fog(0xffffff, 0.5, 1.0); // everything past 1 unit is fully fogged
    out.blobFogged = px();
    ren.dispose(); rt.dispose();
  }
  return out;
}, { KINDS, KEYS });

if (r.importError) {
  t.check('game/art/materials.js imports', false, r.importError);
  await close(); t.finish();
}
t.check('the six floor tiles are registered as category floor on a 1x1 footprint with the 200 budget',
  r.tiles.every((a) => a && a.category === 'floor' && a.tiles[0] === 1 && a.tiles[1] === 1 && a.budget === 200), JSON.stringify(r.tiles));
t.check('shadow-blob is registered (fx)', r.blob && r.blob.category === 'fx', JSON.stringify(r.blob));
t.check('the sample assets stay registered (ruling P2-6)', r.samplesKept === true);
t.check('materials.js exports tileGeometry, tileMaterial, tileField, contactShadow, FLOOR_KINDS', r.api.length === 0, r.api.join(', '));
t.check('every tile is within the 200-triangle floor budget', r.tileRows.every((x) => x.tris > 0 && x.tris <= 200), r.tileRows.map((x) => `${x.kind}:${x.tris}`).join(' '));
t.check('every tile top sits at y=0 and fills its 1x1 tile', r.tileRows.every((x) => Math.abs(x.bounds.max[1]) < 1e-6 && x.bounds.min[1] < -0.02 && Math.abs(x.bounds.max[0] - 0.5) < 1e-6 && Math.abs(x.bounds.min[2] + 0.5) < 1e-6),
  JSON.stringify(r.tileRows.map((x) => x.bounds)));
t.check('every tile has a bevelled edge (tilted normals between top and side)', r.tileRows.every((x) => x.tilted >= 4), r.tileRows.map((x) => `${x.kind}:${x.tilted}`).join(' '));
t.check('builds of one kind share geometry and material (instancing-friendly)', r.tileRows.every((x) => x.sameGeo && x.sameMat));
t.check('all kinds share one geometry; each kind has its own textured material', r.oneGeometry && r.sixMaterials && r.tileRows.every((x) => x.hasMap));
t.check('tiles receive shadows', r.tileRows.every((x) => x.receive));
t.check('DEFAULTS has a hex colour for each palette.floor* key', r.defaults.length === 0, r.defaults.join(', '));
t.check('every non-default preset sets its own six floor colours', r.presetsDiffer.every((p) => p.own === 6), JSON.stringify(r.presetsDiffer));
t.check('every preset resolves all six floor colours', r.presetsResolve === true);
t.check('SCHEMA lists the six floor keys and light.contact', r.schemaMissing.length === 0, r.schemaMissing.join(', '));
t.check('the tweak panel shows an input for each floor key', r.panelInputs.length === 0, r.panelInputs.join(', '));
t.check('setting palette.floorWood recolours an existing wood tile', r.woodRed === 'ff0000', r.woodRed);
t.check('... and leaves the other kinds alone', r.carpetUntouched === true);
t.check('a preset recolours the tile, and reset brings the default back', r.woodNight === true && r.woodBack === true, r.woodNightHex);
t.check('every pattern still reads at game distance (luminance s.d. >= 0.035 at 32 px)', r.contrast.every((c) => c.sd >= 0.035), r.contrast.map((c) => `${c.k}:${c.sd.toFixed(3)}`).join(' '));
for (const b of [r.blobCrate, r.blobBench]) {
  t.check(`contactShadow(${b.id}) adds exactly one blob, and a second call replaces it`, b.count === 1 && b.returned, JSON.stringify(b));
  t.check(`the ${b.id} blob multiplies (premultiplied), writes no depth and casts nothing`, b.multiply && b.premult && b.depthWrite === false && b.cast === false);
  t.check(`the ${b.id} blob sits on the floor, sized to the object and within its ${b.tiles.join('x')} footprint`,
    b.inFoot && b.y > 0 && b.y < 0.03 && b.w >= b.bw * 0.95 && b.d >= b.bd * 0.95, `blob ${b.w.toFixed(2)}x${b.d.toFixed(2)} for ${b.bw.toFixed(2)}x${b.bd.toFixed(2)}`);
}
t.check('the bench blob is long and thin like the bench', r.blobBench.w > r.blobBench.d * 2);
t.check('a person with no asset id gets a blob sized from its own bounds', r.person.count === 1 && r.person.w > 0.44 && r.person.w < 0.8 && r.person.d > 0.44 && r.person.d < 0.8, JSON.stringify(r.person));
t.check('contact shadow strength follows light.contact live', r.strength.after > r.strength.before && Math.abs(r.strength.after - 0.9) < 1e-6, JSON.stringify(r.strength));
t.check('the carpet pattern has no dominant stripe (row and column profiles within 1.6x)', r.carpetProfile.rows < r.carpetProfile.cols * 1.6 && r.carpetProfile.cols < r.carpetProfile.rows * 1.6, JSON.stringify(r.carpetProfile));
t.check('a carpet field is not a quarter-turn checker, and odd tiles are not shaded darker', !r.carpetChecker.turnsFollowParity && r.carpetChecker.shadeGap < 0.02, JSON.stringify(r.carpetChecker));
t.check('the contact-shadow material takes part in fog', r.blobFogFlag === true);
t.check('a blob darkens the floor without fog, and fades out inside thick fog', r.blobClear < 200 && r.blobFogged > 245, JSON.stringify({ clear: r.blobClear, fogged: r.blobFogged }));

// ---- the catalogue's 6x6 floor patch ----
const p = await page.evaluate(async () => {
  const THREE = await import('three');
  const th = await import('../engine/theme.js');
  const out = {};
  if (typeof window.__catalogue.patch !== 'function') return { missing: true };
  window.__catalogue.patch('wood');
  await new Promise((res) => setTimeout(res, 400));
  const cu = window.__catalogue.closeup;
  out.open = document.getElementById('closeup').open;
  out.mode = cu && cu.mode;
  const inst = []; let blobs = 0, props = 0;
  cu.pivot.traverse((o) => { if (o.isInstancedMesh) inst.push(o); if (o.userData.contactShadow) blobs++; if (o.userData.assetId && !o.userData.assetId.startsWith('tile-')) props++; });
  out.instances = inst.reduce((a, m) => a + m.count, 0);
  out.instMeshes = inst.length;
  out.blobs = blobs; out.props = props;
  out.frames = cu.frames;
  out.calls = cu.stage.renderer.info.render.calls;
  // the camera sits at the game's distance by default
  out.dist = cu.camera.position.length();
  const woodMat = inst[0].material;
  th.set('palette.floorWood', '#00ff00');
  out.recoloured = woodMat.color.getHexString() === '00ff00';
  th.resetTheme();
  const sel = document.getElementById('patch-kind');
  out.kinds = [...sel.options].map((o) => o.value);
  sel.value = 'mixed'; sel.dispatchEvent(new Event('change'));
  await new Promise((res) => setTimeout(res, 200));
  const inst2 = []; window.__catalogue.closeup.pivot.traverse((o) => { if (o.isInstancedMesh) inst2.push(o); });
  out.mixed = { meshes: inst2.length, count: inst2.reduce((a, m) => a + m.count, 0), mats: new Set(inst2.map((m) => m.material.uuid)).size };
  // pixels: the patch renders something that is not the background
  const cv = document.querySelector('#closeup canvas');
  out.canvas = !!cv;
  window.__catalogue.close();
  await new Promise((res) => setTimeout(res, 100));
  out.closed = !document.getElementById('closeup').open && window.__catalogue.closeup === null && document.querySelectorAll('#closeup canvas').length === 0;
  return out;
});
if (p.missing) t.check('the catalogue exposes a floor patch view', false, 'window.__catalogue.patch missing');
else {
  t.check('the floor patch opens in the close-up dialog in patch mode', p.open === true && p.mode === 'patch', JSON.stringify({ open: p.open, mode: p.mode }));
  t.check('the patch is a 6x6 instanced floor (one instanced mesh, 36 tiles)', p.instMeshes === 1 && p.instances === 36, JSON.stringify(p));
  t.check('props stand on the patch, each with its contact shadow', p.props >= 2 && p.blobs === p.props, `${p.props} props, ${p.blobs} blobs`);
  t.check('the patch renders', p.frames > 2 && p.calls > 0, `${p.frames} frames, ${p.calls} calls`);
  t.check('the patch opens at the game camera distance (about 35 units)', p.dist > 28 && p.dist < 42, p.dist.toFixed(1));
  t.check('the patch floor recolours live', p.recoloured === true);
  t.check('the floor select offers the six kinds and a mixed patch', ['wood', 'carpet', 'lino', 'concrete', 'rubber', 'ceramic', 'mixed'].every((k) => p.kinds.includes(k)), p.kinds.join(', '));
  t.check('the mixed patch has one row per kind (6 instanced meshes, 36 tiles, 6 materials)', p.mixed.meshes === 6 && p.mixed.count === 36 && p.mixed.mats === 6, JSON.stringify(p.mixed));
  t.check('closing the patch releases its canvas', p.closed === true);
}
t.check('no page errors', errors.length === 0, errors.join(' | '));
await close();
t.finish();
