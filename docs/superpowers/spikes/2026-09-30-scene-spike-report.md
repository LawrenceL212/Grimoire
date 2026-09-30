# Scene spike: a procedural, zero-asset Three.js booking office

**Throwaway spike.** None of this is product code. It answers one question: how good can a procedural, zero-asset Three.js scene look in this project, using the composition of *The Farmer Was Replaced* (TFWR)?

- **URL:** http://127.0.0.1:8011/game/scene-spike/index.html
- **Files:** everything is under `game/scene-spike/` (about 2,100 lines):
  - `index.html`: page shell, import map, cache-busting loader
  - `style.css`
  - `settings.js`: the single settings/theme object, presets and the tweak schema
  - `kit.js`: toon materials, geometry cache, inverted-hull outlines, static batching, canvas textures, tweens
  - `world.js`: the tile grid, rooms, reception, door and props
  - `people.js`, `drone.js`, `fx.js`
  - `scene.js`: bootstrap, HUD, windows, tweak panel and the scripted story
- **Three.js:** version 0.160.0, pinned in an import map. Both URLs were checked and return 200:
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
  - `https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/` (addons used: `controls/OrbitControls.js`, `geometries/RoundedBoxGeometry.js`, `utils/BufferGeometryUtils.js`)
- **Assets:** none. There are no downloaded files of any kind: no models, images or fonts. Every shape is primitive geometry. Every texture (signs, tickets, monitor screens, rug, floor emblem, emote bubbles, avatar, glow) is drawn on a canvas at runtime. Text uses system fonts.

## What you see

### The diorama
- **Floor:** a floating diorama built as a TFWR-style tile grid of 17 × 13 one-unit tiles. It is a single InstancedMesh with per-tile colour jitter. Room floors are wood, the hall is a checker with occasional gold-tinted tiles, and the reception area has warm tiles.
- **Base:** a dark slab with rounded edges and a thin gold rim.
- **Background:** a warm vignette glow in CSS, plus drifting dust motes.

### Rooms and furniture
- **Three open-front rooms.** Each has:
  - low walls with gold caps, a pinboard with notes and a shelf of binders
  - a desk with a mug and papers, a chair and an angled monitor showing a glowing canvas UI
  - a desk lamp with a flickering point light and a glow sprite
  - a status bulb on the front wall, a floor glow used for the alarm, scan and "ok" states, and a floating, bobbing "Room N" sign
- **Reception:** an L-shaped counter with a bell, a monitor and a pendant lamp. Mo, the receptionist, stands behind it typing.

### Props and ambient life
- **Props, placed around the edges** so the walking diagonal stays clear:
  - a lab bench with glowing beakers and a microscope
  - a waiting bench with Dev reading, plus a coffee table
  - a vending machine, a floor lamp, a coat rack, crates and swaying potted plants
  - a sleeping office cat that breathes, with a "z z" sprite
- **Front door:** an open door with a warm glowing doorway. People appear from it with a pop and a puff of sparks.

### People and the drone
- **People:** chibi figures built from capsules and spheres. Each has a different shirt, hair style (bun, long, tuft, cap, short) and skin tone.
  - They have eyes with a highlight, blush and a smile.
  - They walk with swinging arms and legs and a body bob, and turn smoothly.
  - Sitting and standing use an eased hop with a squash-and-stretch spring.
  - When idle they breathe, blink at random and tilt their heads. Seated people glance up toward the camera so their faces read from above.
  - Emote bubbles are "!", "?", "…" and "✓". During the clash they also shake.
- **The drone** is the player's avatar:
  - a cream shell with a gold band and a gold crown cap, so it reads from the steep camera
  - a dark visor with two glowing eyes that blink, and an antenna tip that pulses
  - four spinning rotors with blur discs
  - a hover bob and sway, and it tilts into the direction it flies
  - when hovering it turns toward the camera and tips its visor up
  - an additive light cone down to the floor, a floor light spot and a small point light
  - a glowing point-sprite trail
  - scans briefly tint the cone, the eyes and the light red or green

### The story (driven by the SQL window)
- **Intro, on load and after Reset.** Ada walks in and sits in Room 1. A ticket card pops in and the drone dips to stamp it BOOKED, with sparks and a gold ring. Bookings go from 1 to 2 and revenue from £40 to £80.
- **"Run: the clash".**
  1. Bea walks in to Room 1 and stands in front of the desk.
  2. The drone blindly runs the INSERT and stamps a second BOOKED ticket.
  3. Line 7 turns red and the status reads "conflict!".
  4. Room 1 pulses red: lamp, status bulb and floor glow.
  5. Both tickets turn red and wobble. Ada and Bea get "!" bubbles and shake, with a red ring and red sparks.
  6. Reputation drops from 4.6 to 4.3 and open tickets go from 0 to 1.
  7. The warning icon pulses, and ticket window #42 slides in with Bea's avatar, her message and a red OPEN chip.
- **"Run: the fix".**
  1. The drone flies to Bea, who shows "?".
  2. On lines 11–15, the drone visibly evaluates the NOT EXISTS subquery room by room. Rooms 1 and 2 each get a red ✗ mark, flash and ring. Room 3 gets a green ✓.
  3. On lines 10 and 17, the drone leads Bea at walking pace to Room 3, where she sits down. Her ticket arcs across to Room 3 and the drone re-stamps it MOVED, with green sparks.
  4. Room 1 calms and Room 3 glows green. Ada and Bea do a happy arm-raise bounce.
  5. On lines 20–21 (the ALTER TABLE … EXCLUDE), the drone rises to the centre. A gold shock ring sweeps every room, then confetti, coins that bounce and settle, and a floating "+10 XP" appear.
  6. The counters tick up: reputation 4.8, open tickets 0, XP +10 with the bar filling. The warning icon stops.
  7. The ticket window turns green (RESOLVED) with a reply.
- **Reset** returns to the start and replays the intro. It works at any point, including mid-animation: every await goes through a tween queue, and Reset clears it.

## Changes made because of the TFWR reference screenshot
- **Tile-grid diorama.** The office became a big floating tile grid seen from a steep 3/4 angle (default pitch 32° from vertical). Rooms, desks, reception, lab bench, door and props are all placed on tiles, and the grid is full and busy with props, so it is not an empty stage.
- **Floating code window.** The code panel is now a draggable editor window over the scene: a title bar with a run/pause icon and a status (idle, running, conflict!, ✓ committed), a minimise button, monospace SQL with line numbers, a highlighted executing line, red error lines and green done lines. It auto-scrolls to the running line.
- **Second window: the ticket.** A draggable ticket window shows a message from a person, their small canvas-drawn avatar and a status chip (none, OPEN, RESOLVED). Tickets visibly arrive as windows.
- **Top HUD bar.** Icon-and-number counters: bookings, revenue, reputation, open tickets, and XP with a level bar. They count up with a gold bump, or a red bump for bad changes. There is a warning icon that pulses when a ticket arrives, and square buttons at top right (clash, fix, reset, tweak), like TFWR's corner buttons.
- **Framing.** The diorama is framed to the right of the editor windows (a screen-space view offset), as TFWR puts its editors beside the farm.
- **Drone.** It leaves a soft glowing trail and particles as it moves between jobs.
- **Kept our own style.** We kept our palette and art: ink, gold, dusk lamps and low-poly people. The Bright day preset gives a TFWR-like blue-grey sky if wanted.

## Live tweak panel (gear button or the T key)
- **Built from one object.** The panel is generated from `SCHEMA` in `settings.js` and edits the single `settings` object. That object holds every visual constant the panel exposes and can become the game's theme file.
- **Live updates.** All changes apply live, with no reload. Colours update shared materials, so even the batched static meshes recolour, and tiles are rebuilt only when tile settings change.
- **Persistence.** Values are saved to localStorage under `grimoire.sceneSpike.settings.v3` (every read and write is wrapped in try/catch).
- **Controls.**
  - A preset dropdown: Warm dusk (the default), Bright day, Night lab and Cozy paper.
  - "Copy settings" copies the full JSON to the clipboard, with an execCommand fallback.
  - "Reset" returns to the defaults.
  - Orbiting or zooming with the mouse writes pitch, yaw and zoom back into the settings, so a camera angle you like can be copied as JSON.

### Every tweakable setting
- **Palette:**
  - `palette.bg` (background/sky), `palette.bgGlow` (sky haze)
  - `palette.tileA`, `palette.tileB` (hall checker), `palette.tileWood` (room floors)
  - `palette.wall`, `palette.base` (diorama slab)
  - `palette.gold`, `palette.danger`, `palette.ok`
  - `palette.ink`, `palette.paper`, `palette.text` (UI)
- **Characters:** `shirts.ada`, `shirts.bea`, `shirts.cy`, `shirts.dev`, `shirts.mo`, `chars.scale`
- **Camera:** `camera.pitch` (degrees from top), `camera.yaw`, `camera.zoom`, `camera.fov`
- **Light:**
  - `light.sun` (intensity), `light.sunColor`, `light.hemi` (sky fill), `light.lamps` (room and reception lamp strength)
  - `light.shadowSoft` (shadow blur radius), `light.dusk` (time of dusk: shifts the sun and sky colour, dims the sun, strengthens the lamps and rim light)
  - `light.exposure`, `light.rim`, `light.rimColor` (cool back rim light)
- **World:** `world.tileFill` (tile size relative to its cell, which controls the gap), `world.tileHeight` (tile thickness)
- **Drone:** `drone.scale`, `drone.speed`, `drone.trail` (trail length)
- **Motion and UI:** `anim.speed` (global animation speed multiplier), `ui.hudScale`, `ui.codeOpacity` (code and ticket window opacity)
- **Look toggles:** `toggles.outlines` (inverted-hull outlines), `toggles.toon` (stepped toon ramp vs a smooth ramp), `toggles.fog`, `toggles.glow` (all fake-bloom sprites, the drone cone, spot and trail, and the motes)

## Performance (measured, not estimated)
- **In a visible Browser pane (1614 × 914, devicePixelRatio 1):** `__measure(5)` gave 900 frames at an average of 5.56 ms and a p95 of 5.70 ms, which is 180 fps. That is the pane's vsync cap, so the real headroom is higher.
  - 379 draw calls per frame. This count includes the shadow-map pass and the outline hulls.
  - About 200k triangles, 116 geometries and 17 textures.
- **Frame cost with vsync removed:** I ran 120 fixed steps with `gl.finish()` after each render. Each step is story simulation, render and a full GPU sync:
  - 1280 × 720: 2.08 ms/frame
  - 1920 × 1080: 1.96 ms/frame
  - That leaves plenty of headroom for 60 fps on a normal laptop GPU. HiDPI (DPR 2) will cost more fill-rate; I did not measure it.
- **The HUD counter** under the canvas (`ms/frame · cpu · draw calls · tris`) shows the live numbers.
- **Where the cost goes:**
  - Static batching merges 172 static meshes into 42 batches.
  - Tiles are one instanced draw, and confetti and coins are one instanced draw each.
  - People, the drone and lamps stay dynamic, and each outlined part costs an extra draw.
  - If draw calls ever matter, the next cut is merging each person's parts. The outlines roughly double the draws for dynamic parts.
- **Caveat:** the Browser pane was often hidden while I worked, which throttles requestAnimationFrame to about 1 fps. To take screenshots I added `__spike.advance(sec)`, which steps the simulation deterministically. The fps numbers above come only from runs where the pane was visible.

## Visual iteration log (checked with Browser-pane screenshots each round)
1. **First render.** I found a solid gold plate under the tiles that made every tile gap glow orange; I replaced it with four thin rim strips. The scene was too dark and muddy, so I raised the toon ramp floor and brightened the tiles. The drone's light cone was a huge yellow pillar, so I cut its strength by more than half. The code window had a horizontal scrollbar, so I shortened the lines. The level bar did not match the level number, so I fixed it.
2. **Composition, following the TFWR reference.** Room 1 sat under the code window, so the diorama is now framed with a view offset to the right of the windows, and the ticket window moved below the code window to form a left editor column. I added a cool rim light and an exposure setting. Characters and tickets were too small, so I raised the character scale to 1.25 and moved the ticket card beside the person instead of over their face. Seated people now glance up so faces read from above.
3. **Busy grid.** I added a receptionist who types, the sleeping cat, crates, a vending machine, a floor lamp and a coat rack, and moved the rug to the visitor side of the counter. Signs, tickets and emotes are bigger, and the "+10 XP" text and confetti are larger. The alarm floor glow is stronger. The drone got a gold crown cap and a size of 1.4, and it faces the camera and tips its visor up while hovering, because from above it read as a white blob. Its trail is wider.
4. **Layouts.** At 390 px wide, the HUD now sits above the canvas in a single row of compact counters (labels hidden), the canvas is `min(60vh, 95vw)` tall and fits its width, and the windows stack below. `scrollWidth` equals 390, so there is no horizontal scroll. Between 761 and 1180 px, the action buttons become icon-only so the HUD stays one row, and the code window's height adapts so it does not collide with the ticket window. Stale CSS and JS were being served from cache during iteration, so the page now versions its own modules and stylesheet per load. Lawrence may need one hard reload (Ctrl+F5) to get the new loader itself.
5. **Final pass.** I checked every preset: Bright day gives a TFWR-like blue-grey look, Night lab is dark and moody with strong lamps, and Cozy paper is light and warm. I also checked the clash state, the room-by-room scan with ✗ ✗ ✓, the escort and the reward burst at 1280 × 720.

## What looks good
- **The overall read is right.** It feels like a small cozy management game seen from above: warm lamp-lit rooms, a busy tile grid, and editor windows floating beside it. The TFWR composition carries over well.
- **The characters are charming for pure primitives.** The big head, the blink, the squash-and-stretch sit and the glance up give them personality at close zoom.
- **The story reads clearly without words.** Red pulsing room, "!" bubbles and shaking; then ✗ ✗ ✓ marks as the drone scans; the escort; the ring; the confetti. The code highlight moves in step with it, which is exactly the TFWR feeling that code drives the world.
- **Cheap glow is enough.** Outlines, the toon ramp, emissive and additive sprites and the drone's light cone give a finished look without any postprocessing.
- **The tweak panel is useful.** Palette and presets swing the look a long way, and every change is live.

## What still looks weak
- **Small at the default zoom.** From the TFWR-like overview, people and tickets are small (about 20–30 px tall at 1280 × 720). Faces and ticket text only read when zoomed in. A real game would want a closer default camera, or per-room zoom on events.
- **The drone from above** is better with the gold cap but still reads mainly as "a light". Its personality (the visor eyes) shows only at lower pitch or close zoom.
- **Primitive furniture reads as "blocks".** Desks, chairs and counters are plain rounded boxes and look generic. There is no bevelled detail, no texture and no wear.
- **Flat, uniform floors.** The tiles are flat colours with no pattern or material variation beyond jitter. TFWR's crop-filled tiles carry far more detail per tile.
- **Rough animation.** Walks are single-segment legs with no knees, so sitting has straight legs sticking forward. Path turns are sharp, with no steering or avoidance, and characters could overlap if more walked at once.
- **Simplified lighting.** There is no ambient occlusion (corners and under-desk areas lack contact darkness) and no real bloom. Shadows are one directional map, and lamps cast no shadows.
- **Particles** are fine but generic: soft dots, flat confetti quads and plain cylinder coins.

## Rough build time per part (a guide for the cost of a full art pass)
These are my own working times as an agent in one session (about 2.5 hours in total including browser iteration). A human artist or developer would spend more wall-clock time on each item but iterate faster by eye.
- Tile grid, rooms, reception, door and props (`world.js`): about 45 min, the largest share, because placement and readability need many visual passes.
- Characters, with walk, sit, squash, blink and emotes (`people.js`): about 25 min, plus 10 min of fixes (face visibility, scale).
- Drone, with rotors, cone, spot, trail and camera-facing hover (`drone.js`): about 20 min.
- Effects: sparks, confetti, coins, rings, floating text, tickets and scan marks (`fx.js`): about 20 min.
- HUD, floating windows, the SQL highlighter and the scripted story (`scene.js`, `style.css`): about 35 min.
- Tweak panel, settings and presets: about 15 min.
- Layout and responsive work, cache busting and measurement: about 20 min.

For a full art pass on a larger game world, expect each new prop type to cost 5–15 minutes procedurally, and each new character behaviour (for example a proper two-segment leg rig, sitting in different chairs, or carrying objects) to cost 30–60 minutes.

## Honest opinion: procedural zero-asset versus a CC0 pack
- **Where procedural works.** It reaches "charming indie prototype" quality: a cozy diorama, readable storytelling and a consistent style. It is good enough for a learning game whose star is the code window, and it is very cheap to theme, since one settings object recolours everything. For the drone, the effects, tiles, rooms and UI glow, procedural is the right call and I would keep it.
- **Where it falls short of "real game" quality.** It is the object-level detail: furniture, props, the variety of people, and the per-tile richness that makes TFWR's field feel alive. Hand-modelled low-poly assets carry bevels, silhouettes and small details that primitives cannot match without a large amount of code per prop.
- **Recommendation: a hybrid.**
  - Keep the procedural engine: tiles, lighting, outlines/toon, drone, effects, UI and theming.
  - Bring in a CC0 low-poly pack for furniture, props and characters. Kenney's Furniture Kit, Mini Characters and similar are consistent in style, licence-free, and tiny as glTF.
  - Recolour those assets through the same settings palette, and run them through the same toon ramp and outline pass, so they sit in our ink-and-gold style.
- **Without a pack**, expect the scene to plateau at about where this spike is, plus modest gains from a couple more polish passes: two-segment legs, AO-ish contact shadows, patterned floor tiles and a closer default camera.
