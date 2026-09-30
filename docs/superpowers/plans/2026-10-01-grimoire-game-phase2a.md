# Grimoire Game — Phase 2a (Art Pack and the Real Game in 3D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat Phase 1 page with a real 3D game: our own procedural low-poly art pack (furniture, sector props, characters with knees and elbows, a readable drone, patterned floors, contact shadows), and the double-booking ticket played end to end inside the 3D office, where the learner's real SQL, JavaScript or PHP runs against the PostgreSQL world and the scene acts out what actually changed.

**Architecture:** Three layers under `game/`. `engine/` is the promoted spike kit (toon materials, outlines, tweens, the theme object and its tweak panel). `art/` is the art pack: a registry of asset factories with footprints and triangle budgets, reviewed in a turntable catalogue page. `play/` is the game: the tile-map office, HUD, floating code and ticket windows, and a bridge that diffs the world before and after each run and turns the diff into scene events. The Phase 1 modules (`world/`, `runners/`, `problems/`, `memory/`) are reused unchanged.

**Tech Stack:** Three.js 0.160.0 (import map, jsDelivr, pinned), native ES modules, canvas-drawn textures, PGlite 0.5.8, php-wasm 0.1.0, `node:test` and `playwright-core` 1.52.0.

**Spec:** `docs/superpowers/specs/2026-09-30-grimoire-game-design.md` (section 11 is the binding direction for this phase).

**Scope note:** Phase 2b (world in a `PGliteWorker`, PHP in a terminable Worker, runners in a sandboxed opaque-origin iframe) and Phase 2c (multi-tenant sector model, the director, more tickets, reopened tickets as review, the real skill log) get their own plans. The Phase 1 results doc lists them as prerequisites before the game shares auth or storage with the old app; this phase does not share either.

**Planning ruling:** art and scene tasks cannot be specified as verbatim code: their quality comes from visual iteration. Those tasks are specified by exact interfaces, file layout, measurable budgets, automated checks and visual acceptance criteria, and the implementer iterates with Browser-pane screenshots. Logic tasks (registry, bridge, state) keep the usual test-first steps with exact expectations.

## Global Constraints

- Zero build: no bundler, no npm runtime dependencies; Three.js `0.160.0` from `https://cdn.jsdelivr.net/npm/three@0.160.0/` via an import map; PGlite `0.5.8`; php-wasm `0.1.0` (as pinned in Phase 1).
- No downloaded art: every model is procedural geometry, every texture is drawn on a canvas at runtime, fonts are system fonts. The art pack is ours.
- Every visual constant lives in the theme object (`game/engine/theme.js`); assets read colours from the theme palette and recolour live when it changes.
- Performance: the full office scene stays under 600 draw calls and under 400k triangles at the default camera, and keeps a frame under 8 ms at 1280x720 in a visible pane (measured, not estimated).
- Reduced motion (`prefers-reduced-motion`) turns off camera drift, confetti bursts and shakes; the story still reads through colour and state.
- Never fake execution: scene events are derived from the real world diff and the real grade, never scripted from the expected answer.
- Learner-visible prose is British English; tickets describe symptoms, not instructions.
- The old app (`index.html`) is not modified except the one "Play the new 3D game" link already on `main`. Do not touch `package.json`, `content/` or any `CLAUDE.md`.
- Tests run with the static server on port 8011: `GRIMOIRE_BASE=http://127.0.0.1:8011/`, `CHROMIUM_PATH="$LOCALAPPDATA/ms-playwright/chromium-1169/chrome-win/chrome.exe"`; the whole suite is `node scripts/browser/run_game_tests.mjs` and must stay green.

## Review Focus

1. **A run that changes nothing, or fails**, must not animate as if something happened: the scene reacts only to a real diff, and an error shows in the code window.
2. **Rapid Run, Reset and window dragging together** must not leave duplicate people, orphaned tickets or a stuck drone (the event queue is cancelled and rebuilt on Reset).
3. **Every asset in the catalogue** builds without NaN geometry, within its footprint and triangle budget, in every theme preset.
4. **Phone width (390 px)**: the scene, HUD and windows are usable without horizontal scroll, and the code window is editable with an on-screen keyboard.
5. **The WebGL context is lost or unavailable**: the page says so plainly and still offers the code window (the game logic does not depend on the renderer).

## File Structure

```
game/engine/
  kit.js            toon materials, outlines, geometry cache, batching, canvas textures, glow, tweens (promoted from scene-spike/kit.js)
  theme.js          the theme object, presets, schema, persistence (promoted from scene-spike/settings.js; key grimoire.theme.v1)
  tweak-panel.js    the live tweak panel built from the schema
  renderer.js       renderer, camera rig (orbit, framing, per-event focus), lights, WebGL-loss handling
game/art/
  registry.js       register/make/list; footprint and budget checks
  index.js          imports every pack so the registry is populated
  materials.js      patterned floor textures (wood, carpet, lino, concrete, rubber, tile) and contact-shadow decals
  furniture.js      office core pack
  sectors.js        lab, gym, school, clinic, hall, co-working packs
  people.js         characters v2 (two-segment limbs, outfits, animation states)
  drone.js          drone v2
  fx.js             sparks, confetti, coins, rings, floating text, tickets, scan marks, emotes
  catalogue.html    turntable review page for every asset
  catalogue.js
game/play/
  index.html        the game page (replaces the Phase 1 page at game/index.html via a redirect)
  map.js            the office tile map as data plus the builder that places assets
  hud.js            top counters, warning, buttons
  windows.js        draggable floating windows: code editor window, ticket window
  editor.js         code editor (textarea plus line numbers plus highlight overlay; SQL, JS and PHP colouring)
  bridge.js         diffWorlds(before, after) -> events; pure
  story.js          event queue: turns events plus grade into drone and people animations
  state.js          counters derived from the real world and grade; pure
  main.js           boot: world, runners, problem card, scene, windows, story
scripts/browser/
  test_art_catalogue.mjs, test_play_boot.mjs, test_play_ticket.mjs, test_play_layout.mjs
game/play/bridge.test.mjs, game/play/state.test.mjs, game/art/registry.test.mjs
docs/superpowers/spikes/2026-10-01-phase2a-results.md
```

---

### Task 1: Promote the engine and theme

**Files:** create `game/engine/kit.js`, `game/engine/theme.js`, `game/engine/tweak-panel.js`, `game/engine/renderer.js`, `scripts/browser/test_engine.mjs`.

**Interfaces produced:**
- `kit.js`: the spike's exports unchanged in name and behaviour (`toon`, `toonOwn`, `rbox`, `sphere`, `capsule`, `cyl`, `cone`, `ico`, `torus`, `outlineMat`, `setOutlines`, `setToon`, `part`, `bakeStatic`, `canvasTex`, `glowTex`, `blobTex`, `glow`, `floorGlow`, `ease`, `tween`, `wait`, `updateTweens`, `killTweens`, `lerp`, `damp`, `dampAngle`, `rr`) plus `themed(path)` returning a toon material whose colour tracks `theme.get(path)` and updates on `onThemeChange`.
- `theme.js`: `theme` (object), `DEFAULTS`, `PRESETS` (Warm dusk, Bright day, Night lab, Cozy paper), `SCHEMA`, `get(path)`, `set(path, value)`, `applyPreset(name)`, `resetTheme()`, `onThemeChange(fn) -> unsubscribe`, persistence under `grimoire.theme.v1` wrapped in try/catch.
- `tweak-panel.js`: `mountTweakPanel(root)` (gear button and the T key; presets; Copy settings; Reset).
- `renderer.js`: `createStage(canvas, { reducedMotion }) -> { scene, camera, renderer, frame(fn), focus(target, { zoom }), frameAll(), onLost(fn), dispose() }`.

- [ ] **Step 1:** Write `scripts/browser/test_engine.mjs`: imports each module in the page; asserts the export list above; `set('palette.gold', '#ff0000')` changes a `themed('palette.gold')` material's colour; `onThemeChange` fires; `applyPreset('Night lab')` changes `palette.bg`; persistence survives a reload and a throwing `localStorage` (stub it to throw) does not break boot; `createStage` on a canvas returns the documented members.
- [ ] **Step 2:** Run it; confirm it fails (modules missing).
- [ ] **Step 3:** Promote the code from `game/scene-spike/kit.js` and `settings.js` (copy, then adapt; the spike stays untouched), add `themed`, `onThemeChange`, the tweak panel module and the stage module.
- [ ] **Step 4:** Run the test; confirm it passes; run the whole suite.
- [ ] **Step 5:** Commit: `feat: engine and theme promoted from the scene spike`.

### Task 2: Art registry and catalogue

**Files:** create `game/art/registry.js`, `game/art/registry.test.mjs`, `game/art/index.js` (empty packs list for now), `game/art/catalogue.html`, `game/art/catalogue.js`, `scripts/browser/test_art_catalogue.mjs`.

**Interfaces produced:**
- `register(id, { category, sector = 'core', tiles: [w, d], budget, build(opts) -> THREE.Object3D, anims? })`; ids are kebab-case and unique (duplicate throws).
- `make(id, opts) -> THREE.Object3D` with `userData.assetId`, origin at the floor centre of its footprint, +Z facing front.
- `list({ category, sector }?) -> [{ id, category, sector, tiles, budget }]`.
- `measure(object3d) -> { triangles, drawables, bbox: { w, h, d }, hasNaN }` (pure over the geometry).
- Budgets: furniture 3,000 triangles; large equipment 6,000; characters 7,000; floor tiles 200.

- [ ] **Step 1:** `registry.test.mjs` (node:test, no WebGL): register a test asset built from plain `THREE.BoxGeometry` (import `three` via its CDN URL is not available in node, so the registry must accept any object with the Object3D traversal shape; test with a tiny fake tree) checks duplicate ids throw, `list` filters, `measure` counts triangles and flags NaN.
- [ ] **Step 2:** `test_art_catalogue.mjs` (browser): opens `game/art/catalogue.html`, waits for `window.__catalogue.ready`, and for EVERY asset in `list()` and EVERY preset asserts: builds without throwing, `hasNaN === false`, triangles within budget, bbox footprint within `tiles` (plus 5% tolerance), height below 3.2 units unless category `structure`.
- [ ] **Step 3:** Run both; confirm they fail.
- [ ] **Step 4:** Implement the registry and `measure`; build the catalogue: a grid of turntables (one small render target per asset, or one scene with a pedestal per asset and a camera per cell), labelled with id, triangle count and footprint, with a preset switcher, a filter by category/sector, and a close-up viewer on click. It must stay under 12 ms/frame with every asset shown (render only visible cells, or render thumbnails once into canvases and animate only the selected one).
- [ ] **Step 5:** Run both tests; confirm they pass; commit `feat: art registry and turntable catalogue`.

### Task 3: Floors, materials and contact shadows

**Files:** create `game/art/materials.js`; register floor-tile assets (`tile-wood`, `tile-carpet`, `tile-lino`, `tile-concrete`, `tile-rubber`, `tile-ceramic`), `shadow-blob` and a `contactShadow(object3d)` helper.

- Canvas-drawn patterns (planks with grain and seams, carpet weave, lino speckle, concrete with subtle cracks, gym rubber, ceramic grout) tinted from theme palette keys `palette.floor*` (add keys to the theme schema). Tiles are instanced-friendly (share geometry and material per kind).
- Contact shadows: a soft multiply-blended blob under every placed prop and person (scaled to footprint), giving the ambient-occlusion contact darkness the spike lacked.
- [ ] Add the assets; extend the catalogue checks automatically (Task 2 test covers them); visual check in the catalogue and in a 6x6 test patch; commit `feat: patterned floors and contact shadows`.

### Task 4: Office core furniture pack

**Files:** `game/art/furniture.js` (registered in `art/index.js`).

Assets (each with bevelled edges, a readable silhouette from the steep camera, 2-3 material tones from the theme, and at least one small detail): `desk` (top with bevel, drawer unit with handles, legs), `office-chair` (five-star base with castors, gas lift, seat, curved back), `reception-counter` (L-shaped, front panel, bell, sign), `bookshelf` (varied book heights and colours), `monitor` (stand, bezel, canvas screen that accepts a draw function), `desk-lamp` (articulated arm, shade, emissive bulb), `filing-cabinet`, `whiteboard` (canvas scribbles), `pinboard`, `plant-small`, `plant-tall`, `plant-hanging`, `sofa`, `coffee-table`, `water-cooler`, `vending-machine`, `coat-rack`, `door` (frame and leaf, with an `open(t)` pose), `wall-segment` and `wall-window` (category `structure`), `rug`, `crate-stack`, `mug`, `paper-stack`.

- Visual acceptance: in the catalogue at the default preset, each asset is identifiable from a 45-degree top view at thumbnail size; nothing reads as a plain box; outlines and toon ramp apply.
- [ ] Build them with visual iteration (screenshots of the catalogue after each group); catalogue test green; commit `feat: office furniture pack`.

### Task 5: Sector packs

**Files:** `game/art/sectors.js`.

Each asset carries `sector` and reads as that sector at thumbnail size:
- `lab`: `lab-bench`, `microscope`, `centrifuge`, `fume-hood`, `beaker-set`, `lab-fridge`, `safety-shower`.
- `gym`: `treadmill`, `bench-press`, `dumbbell-rack`, `yoga-mat`, `kettlebell-set`, `rowing-machine`.
- `school`: `student-desk`, `chalkboard`, `locker-row`, `teacher-desk`, `projector-screen`.
- `clinic`: `exam-bed`, `privacy-curtain`, `medicine-cabinet`, `wheelchair`, `clinic-desk`.
- `hall`: `stage`, `folding-chair-row`, `podium`, `notice-board`.
- `coworking`: `hot-desk-pod`, `phone-booth`, `bean-bag`, `standing-desk`, `coffee-bar`.
- [ ] Build with visual iteration; catalogue test green; commit `feat: sector prop packs`.

### Task 6: Characters v2

**Files:** `game/art/people.js`.

- A `Person` class compatible with the spike's usage (`new Person(opts)`, `.root`, `walkTo(points)`, `sit(seat)`, `stand()`, `emote(kind)`, `update(dt)`) plus `play(state)` for states `idle`, `walk`, `sit`, `type`, `talk`, `celebrate`, `frustrated`, `carry`, `wave`.
- Two-segment arms and legs (thigh and shin, upper arm and forearm) so sitting bends at the knee and typing bends at the elbow; hips, shoulders and head with look-at.
- Outfits by role and sector: `office` (shirt, jacket), `lab` (lab coat, goggles), `gym` (sportswear), `school` (cardigan, lanyard), `clinic` (scrubs), `council` (blazer, badge); 8 hair styles; skin tones from a theme list; optional glasses, badge, clipboard or laptop prop in hand.
- Faces readable from the steep camera: a slightly larger head, eyes placed so they read from above, and a clear expression per emote.
- Register a `person` asset whose `build({ role, seed })` returns a posed person for the catalogue; a character sheet page in the catalogue shows every state animating.
- Acceptance: in `sit`, the knee angle is between 70 and 110 degrees and the feet are on the floor (automated check reads bone rotations); budgets met; no overlap between people walking the same path (simple separation steering).
- [ ] Build with visual iteration; tests green; commit `feat: characters with knees, outfits and states`.

### Task 7: Drone v2 and effects

**Files:** `game/art/drone.js`, `game/art/fx.js`.

- The drone reads as a character from above: a face screen on its top-front with large expressive eyes (`happy`, `focus`, `worried`, `proud`), a gold ring light, rotors; actions `flyTo`, `scan(target, verdict)` (beam turns red or green), `stamp(target)`, `escort(person, seat)`, `carry(object)`, `celebrate()`; a soft trail.
- Effects: sparks, confetti in three shapes, coins with an embossed "G" and a rim, shock ring, floating text, ticket cards (canvas), scan marks (tick and cross), emote bubbles. All respect reduced motion.
- [ ] Build with visual iteration; catalogue entries for the drone and every effect; tests green; commit `feat: drone with a face, and a polished effects set`.

### Task 8: The office map and the play page shell

**Files:** `game/play/index.html`, `game/play/map.js`, `game/play/hud.js`, `game/play/windows.js`, `game/play/editor.js`, `game/play/main.js` (boot only), `scripts/browser/test_play_boot.mjs`, `scripts/browser/test_play_layout.mjs`; change `game/index.html` to a redirect to `play/index.html` (keep Phase 1's `game/main.js` and its tests working by moving the Phase 1 page to `game/classic.html`, updating `test_game_slice.mjs` and `test_game_boot.mjs` paths).

- `map.js`: the office as data (`{ size: [w, d], floors: [...], place: [{ id, x, z, rot, name? }], rooms: [{ id, name, tiles, seat, desk }] }`) and `buildMap(stage, mapData) -> { rooms, seats, doors, lookup(name) }`. The starter office is the spike's layout rebuilt from the art pack (three rooms, reception, a lab corner, props), with a clear walking lane.
- HUD: bookings, revenue, reputation, open tickets, XP and level, the warning icon, and buttons for Reset, Tweak and a camera "focus" toggle.
- Windows: draggable and resizable on desktop, stacked panels on phones; positions persisted (try/catch); a code window (language tabs SQL, JavaScript, PHP; the editor; Run; Reset; the PHP note from Phase 1 Ruling 8), a ticket window, and a small output/result strip inside the code window.
- Editor: textarea with line numbers and a highlight overlay (keywords, strings, comments, numbers per language), Tab inserts spaces, Ctrl+Enter runs, font from the theme.
- WebGL unavailable or lost: a plain message over the scene area; the windows still work.
- `test_play_boot.mjs`: page boots, `window.__play.ready`, HUD values match the real world, windows present, no page errors; WebGL-lost path (`WEBGL_lose_context`) shows the message and keeps the editor usable.
- `test_play_layout.mjs`: at 1280x720 and 390x844, no horizontal scroll, windows on screen, the editor accepts typing.
- [ ] Test first, implement, visual iteration, suite green, commit `feat: the 3D office play page`.

### Task 9: World-to-scene bridge and the real ticket

**Files:** `game/play/bridge.js`, `game/play/bridge.test.mjs`, `game/play/state.js`, `game/play/state.test.mjs`, `game/play/story.js`, `game/play/main.js` (wire-up), `scripts/browser/test_play_ticket.mjs`.

- `diffWorlds(before, after) -> events` (pure): `{ type: 'booking-added' | 'booking-removed' | 'booking-moved' | 'booking-retimed' | 'clash-started' | 'clash-cleared', bookingId, roomId?, fromRoomId?, toRoomId? }` in a deterministic order; clashes computed with the same overlap rule as `NO_OVERLAP_SQL` (same room, `a.start < b.end && b.start < a.end`).
- `deriveState(worldObjects, grade, history) -> { bookings, revenue, reputation, openTickets, xp, level }` (pure): revenue = £40 per booking on the timetable day; reputation drops 0.3 per active clash from a base of 4.8; XP +10 per first clean solve of a ticket.
- `story.js`: an event queue that plays events in order with the drone and people (add: a person walks in and sits; remove: the person stands and leaves; move: the drone escorts the person; clash: the room pulses red and both people get "!"), cancellable (`story.cancel()` on Reset), and a "nothing changed" path (the drone shrugs and the code window says the world did not change).
- The ticket: `double-booking-1` presented as a ticket from Bea with a symptom (for example "I booked Room 1 for 08:30 and someone is already sitting there. Can you sort it out?"), the reply on success, and the ticket staying OPEN with a hint chip on a wrong result. Grading is the Phase 1 `gradeProblem`.
- Tests: `bridge.test.mjs` and `state.test.mjs` (pure, exact expectations: added, removed, moved between rooms, retimed within a room, clash started and cleared, no-op); `test_play_ticket.mjs` (browser): the SQL, JavaScript and PHP reference fixes each end with the ticket RESOLVED, the room calm, counters updated from the real world, and the event log containing exactly the real diff; the cheat leaves the ticket OPEN; an SQL error shows in the code window and produces no scene events; Reset mid-story leaves exactly the seeded people and no stray tickets (Review Focus 2).
- [ ] Test first, implement, suite green, commit `feat: the real ticket played in 3D, driven by the world diff`.

### Task 10: Results, retire the spike, publish

- [ ] Measure the play page (frame time, draw calls, triangles at 1280x720 in a visible pane) and the catalogue; take screenshots of the catalogue and of the ticket before and after; write `docs/superpowers/spikes/2026-10-01-phase2a-results.md` (what was built, numbers, screenshots referenced, what still looks weak, the Phase 2b and 2c next steps).
- [ ] Keep `game/scene-spike/` for comparison but add a line at the top of its page linking to the new game.
- [ ] Update the Library button in `index.html` to point at `game/play/index.html` (one attribute change).
- [ ] Suite green, commit `docs: Phase 2a results`, and publish to `main` (Lawrence's standing instruction: publish finished code to main).

### Task 11: Player look settings and Night lab candles (runs after Task 8, before Task 9)

Requested by Lawrence on 2026-10-01: players choose whatever preset they like in the game, and under the Night lab preset characters carry candles that light a path around them when they enter.

**Files:** create `game/play/settings-menu.js`, `game/art/candle.js`; modify `game/engine/theme.js` (user presets), `game/art/people.js` (or `people/*`) (carry a light), `game/play/main.js` (mount the menu); tests `scripts/browser/test_play_settings.mjs`, `scripts/browser/test_art_candles.mjs`.

**Interfaces:**
- `theme.js`: `listPresets() -> [{ name, builtIn }]`, `saveUserPreset(name) -> void` (captures the current theme), `deleteUserPreset(name)`, `applyPreset(name)` works for built-in and user presets; user presets persist under `grimoire.theme.userPresets.v1` (try/catch); the active preset name persists and is restored on load.
- `settings-menu.js`: `mountSettingsMenu(root, { onChange })`: a player-facing Settings button in the HUD opening a small menu: a preset picker with a live preview swatch per preset, "Save current look as...", delete for user presets, a reduced-motion toggle and a sound toggle (placeholder, off). It is separate from the developer tweak panel (T key), which stays available.
- `candle.js`: `register('candle', ...)` (a candle in a small brass holder, emissive flickering flame) and `lantern` (a hand lantern); `attachLight(person, { kind })` puts it in the person's hand (the `carry` pose with one hand) and adds a glow; `setCandleMode(on)` on the scene.
- Night lab behaviour: when the active preset is Night lab (or any preset with `toggles.candles` true; add `toggles.candles` to the SCHEMA so a user preset can turn it on), every person who enters carries a candle: a flickering flame sprite, a warm additive floor light pool (radius about 1.6 tiles) and wall glow that move with them; when they sit, the candle goes on the desk beside them and keeps glowing; when they leave, they take it. At most 4 real `PointLight`s are pooled and assigned to the people nearest the camera (so furniture near them is lit); everyone else uses the cheap pool and glow only (no shader recompiles as people come and go: fixed light count, intensity 0 when unused). Reduced motion stops flicker.
- Tests: switching presets from the menu changes `palette.bg` and persists across reload; a saved user preset appears in the list, applies and deletes; with Night lab active, a person who enters has a candle child and a floor pool that follows them within 0.2 units; at most 4 PointLights exist regardless of the number of people (spawn 12); the light count never changes while people spawn and leave (no recompiles: `renderer.info.programs.length` stable); switching away from Night lab removes candles.
- Visual: screenshots of the office under Night lab with several people walking in with candles and seated with candles on desks.

**Task 11 amendment (Lawrence, 2026-10-01): the Night preset is a fantasy / Halloween skin.** Under Night lab (rename its label to "Night of the Grimoire"; keep the id `Night lab` for saved settings), people appear in fantasy costumes through the costume hook Task 6 provides: witches (pointed hat, cloak, broom on the back), wizards (robe with stars, tall hat, staff, beard option), monster hunters (long coat, tricorn or wide-brim hat, crossbow on the back, lantern), alchemists (goggles, apron, vial belt), rangers (hood, bow), bards (lute) and similar; the role maps to a costume family (for example lab -> alchemist, gym -> ranger, clinic -> healer, school -> apprentice, hall -> bard, office -> wizard or witch) with seeded variety. They carry candles or lanterns as specified above. Decor overlay registered as art assets and placed by the map only under this preset: jack-o'-lanterns, pumpkins, candelabras, floating candles (bobbing), cobwebs in wall corners, spellbooks replacing some shelf books, a cauldron by reception with a gentle bubble, bats that occasionally cross the sky, violet mist; the violet sky and fog come from the preset. Costume and decor switch live when the preset changes, with no reload, and every costume and decor asset passes the catalogue checks (budgets, footprints, no NaN) and appears in the catalogue under a `fantasy` sector filter. Tests add: switching to Night lab puts a costume on every person and places the decor; switching back removes both; costume parts stay within the 7,000 character budget.

**Order change (Lawrence, 2026-10-01): "we will only add that at the end when we have the game functional."** Task 11 (look settings, candles, fantasy Night skin) runs LAST: after Task 9 (the real ticket in 3D) and Task 10 (results and publish). The functional game is published first; Task 11 is then built and published as its own update. Task 6 keeps only the small costume and hold-item hooks.

**Skin clarification (Lawrence, 2026-10-01): "it's more of a skin that I can use if I want."** The fantasy look is an OPTIONAL SKIN, independent of the colour preset. The settings menu offers Skin: `Standard` (default) or `Fantasy`, persisted as `people.skin` / a theme key `skin` (`standard` | `fantasy`), and any skin combines with any colour preset (built-in or user). The Fantasy skin brings the costumes, the candles/lanterns and the decor overlay; the Standard skin brings none of them, whatever the colour preset. The Night lab preset keeps only its colours, sky and fog (its label stays "Night lab"). Tests change accordingly: switching the skin (not the preset) adds and removes costumes, candles and decor; switching presets never changes the skin.
