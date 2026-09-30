# Grimoire Game — Design Spec

Status: draft for review (2026-09-30). Not committed.

## 1. Purpose

Lawrence has a CS degree but has not coded properly for a long time, and barely
knows JavaScript and PostgreSQL. He needs to be able to **write code from a blank
editor and debug it** in the stack required at Siso Software: **PostgreSQL, PHP,
JavaScript (with HTML/CSS), REST/JSON**, plus a booking-domain mindset.

He has ADHD: text pages do not hold him. He needs a real **game** with dopamine,
short loops, and instant feedback, where he learns by **experimenting** (like *The
Farmer Was Replaced*) and by **discovering real functions and methods**, and where
the game **forces spaced review** so he actually remembers.

### Success criteria
- He can start from a near-zero on-ramp and reach the same working level in all
  three languages.
- Every level is a task against a live world; nothing is a page of text.
- Any valid solution passes (outcome-graded), and he can look up real functions.
- The forgetting curve is visible per skill (days since last used, fading, due).
- Review is scheduled and interleaved across the three languages.
- Animation and visual quality are a first-class requirement, not polish.

## 2. Scope

**In scope (new game):** the world, problem library, director, memory system,
renderer, and stack content (PostgreSQL first, then JavaScript and PHP).

**Out of scope for now:** migrating the existing 40+ dungeons (they keep running
in `index.html` unchanged and move over later, one at a time).

**Rule change:** the "`index.html` is the whole app" rule does **not** apply to
the new game. It stays zero-build (no bundler, no npm runtime deps) but is split
into native ES module files under `game/`, with its own entry page that shares
login and saved progress with the existing app.

## 3. Play loop

- A level shows the world and **one goal**, with a free editor in the real
  language. No instruction pages.
- The code runs in the real runtime. The level checks the **outcome** (world
  state, query results, returned values), so any valid solution passes. A neat
  solution may earn a bonus.
- **Codex:** real functions/methods of the language, always searchable; entries
  unlock when first used successfully. Discovery over instruction.
- **Playground:** ungraded sandbox on the same live world.
- **Stuck ladder:** nudge, concept hint, Codex entry, worked example. All free;
  heavy help makes the skill return for review sooner.
- Loops are 1–3 minutes; the next problem starts immediately.

## 4. The world

A **booking business** (lab equipment / rooms, in the spirit of Siso's Smarthub
and Smartlab). Facts about Siso itself stay limited to what is known.

- **Business size is the progress bar.** Growth (rooms, customers, staff,
  bookings/day) unlocks new problems. No floors or tiers on screen.
- **Scale creates difficulty:** 5 bookings you can eyeball a clash; 500 needs a
  query; 50,000 makes the query slow (indexes, constraints); then concurrency,
  roles/permissions, audit trail, JSON APIs, security.
- **Front-of-house view** (timetable + tables) renders from a **world snapshot**,
  whichever language changed it, and animates changes (bookings slide in, clashes
  flash, rejected entries bounce). Written once.
- **Problems are data events:** trigger conditions on world state, required
  skills, skills exercised, and an outcome check. Some hand-written, some
  generated (e.g. bulk data to make a slow query actually slow).
- **Director** chooses the next problem from business size, learned skills, and
  fading skills. Never serves a problem whose prerequisite skills are unmet.
- A problem may be solved in any of the three languages; the director may serve
  the same problem in another language as review.

### Runtime honesty
- PostgreSQL: PGlite, the canonical world state (already probed, 14/14).
- JavaScript: worker, world exposed as plain objects.
- PHP: php-wasm with `pdo_sqlite`; PHP works on a **synced SQLite copy** and
  changes are written back. PHP cannot reach real Postgres in the browser; levels
  say so, and Postgres-specific features (ranges, `EXCLUDE`, window functions)
  are taught in the SQL track.
- No fake execution: a skill is graded only where a runtime genuinely runs it.

## 5. Memory and progression

- Every **skill × language** has a memory meter: *last used N days ago*,
  fresh / fading / due, *review by DATE*, with a small curve of estimated recall.
  Scheduling builds on the existing SM-2 log.
- Codex tools are shown as **tools that dull** as memory fades; review sharpens.
- **Reviews are incidents from the past**, returning in a variation and often a
  different language. Sessions interleave languages deliberately.
- **Soft gate (assumed default):** when skills are *due now*, expansion is
  blocked ("firefighting") until a short review set (cap ~8–10) is cleared.
  *Fading* skills get a nudge only.
- Assisted solves shorten the next interval; clean solves lengthen it.
- Short sessions (5-minute option), streaks with a freeze, XP, revenue, Codex
  completion, office upgrades, occasional surprise rewards.

## 6. Architecture

Native ES modules under `game/`, one job each:

| Unit | Job |
|---|---|
| `world` | PostgreSQL state, checkpoints, JS/PHP views and write-back |
| `runners` | Reuse existing execution code (`Exec`, `RUNTIME_BACKENDS`) |
| `problems` | Problem cards and outcome checks |
| `director` | Selects the next problem |
| `memory` | Skill map, scheduling, meters; persistence reuses the existing Firestore + `localStorage` mirror (fail-soft, scoped to `request.auth.uid`) |
| `front-of-house` | Renderer, animations, editor, Codex |

The old app is untouched. The new entry page shares auth and progress storage.

## 7. Risks and spikes (before committing to the full build)

1. **World sync:** can PostgreSQL, PHP's SQLite copy, and JS stay consistent, and
   can 50,000 bookings load without freezing the browser?
2. **Outcome grading:** fairly accepting different valid solutions in all three
   languages.
3. **Vertical slice with real animation quality** to set the visual bar early.

## 8. Testing

- Every problem has a reference solution per declared language, run in the real
  runtime via the Playwright harnesses (extending `verify_fragments`), plus
  alternate valid solutions.
- Headless director simulation over a full playthrough: no dead ends, no jumps in
  difficulty.
- Visual quality: screenshots, frame-timing checks, reduced-motion support, and a
  play test by Lawrence. A slice is not done until the feel is right.

## 9. Build order

Spikes, then vertical slice (PostgreSQL: first task to first growth event, with
animation and one memory meter), then PHP and JS tracks, director with generated
problems, full memory system, and finally migration of old dungeons.

## 10. Open items

- Video ("Learn To Code Like a GENIUS and Not Waste Time") could not be read;
  techniques assumed to be retrieval practice and spaced repetition. Adjust if the
  video adds something specific.
- Soft-gate strictness: decided as soft, capped ~8–10 reviews (Lawrence gave
  full creative freedom on 2026-09-30); revisit after play testing.
- Working title: *Grimoire: Open for Business*.
- Visual direction (decided under that freedom): realistic booking data and
  tasks, Grimoire-branded presentation. Warm dark "living ledger", ink and gold
  accents, Codex tools as arcane instruments that dull with forgetting. Spring
  easing, optional sound, reduced-motion mode. Refine during the vertical slice.

## 11. Direction update (2026-09-30, after Phase 1)

Lawrence reviewed the Phase 1 slice ("janky, not really a game") and a 3D scene
spike ("i love what the scene spike is showing me"). These decisions supersede the
front-of-house parts of sections 3, 4 and 8 where they conflict.

**Look and feel.** The front-of-house is a real 3D game world in the manner of
*The Farmer Was Replaced*: a floating tile-grid diorama seen from above at a steep
angle; low-poly characters and a drone avatar; several draggable floating windows
over the scene (a code window per task, a ticket window per ticket); a top HUD of
icon-and-number counters with a warning icon that pulses when a ticket arrives;
warm low-poly lighting with soft shadows; particles, trails and confetti. Built
zero-build with Three.js pinned from a CDN and procedural geometry (no downloaded
art unless a CC0 pack is chosen later). Every visual constant lives in one
settings object edited by a live tweak panel (press T), and that object becomes the
game's theme. The flat timetable is retired as the main view; the world, runners,
grading and tests from Phase 1 stay and feed the 3D scene.

**Purpose and role.** The company is a booking platform (in the spirit of Siso's
Smarthub and Smartlab) whose purpose is to win clients from different sectors and
grow the business in users and features. The player is the main developer: the job
is to add the features clients want and to solve every issue that arises from being
the main developer.

**Problems arrive as tickets and conversations.** A client or colleague sends a
ticket or tells the player about an issue (a symptom, not instructions). Two kinds:
bugs (investigate with read-only queries and code, find the root cause, fix it,
reply to the client) and feature requests (design and build). Any valid fix passes
(outcome-graded). A weak fix can come back as a reopened ticket, which doubles as
the spaced-review mechanism.

**Growth by sector.** Each new client sector is a new district of the diorama with
its own needs, for example laboratories (equipment, maintenance, safety, audit),
gyms (classes, capacity, memberships), schools (timetables, term dates), clinics
(staff rotas, privacy), councils (public halls, payments), co-working (desks,
invoicing). Clients, users and features are the progress bar; scale makes problems
harder (data volume, roles, concurrency, security, performance). The data model
becomes multi-tenant (clients, sites, resources, users, bookings) so sector
requirements exercise real schema design, constraints, roles, APIs and security in
PostgreSQL, PHP and JavaScript.

**Consequences for the plan.** Phase 2 becomes "the real world inside the 3D
scene": drone actions driven by real runner results, tickets as windows, HUD
counters driven by real outcomes, the multi-tenant world model, the director
choosing tickets by growth and by fading skills. The Phase 1 results doc lists the
required infrastructure items (world in a PGliteWorker, PHP in a terminable Worker,
sandboxed runners) that remain prerequisites.

## 12. Worlds and drones (2026-10-01)

Each language is a drone character. The first world, the Siso-stack booking company, has three drones: Sequel (SQL), Jay (JavaScript) and Hex (PHP); the drone of the language used acts out each run. Other languages and subjects from the old Library become future worlds ("lives"): each is a company built around one language with its own drone, story, clients and Grimoire chapter, reusing the existing curriculum content as ticket material; the learner's skill map and Grimoire carry across worlds wherever concepts overlap. The first world ships first; future worlds get their own plan.
