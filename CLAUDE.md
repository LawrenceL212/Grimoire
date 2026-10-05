# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

GRIMOIRE: a gamified "spellbook" for mastering computer science. You log study
sessions against tomes (topics), earn XP, level up and unlock spells.

The whole app is **one file, `grimoire.html` (~1,750 lines)**: CSS, markup and
one classic `<script>`. No build step, package manager, tests or service
worker. Grep for what you need rather than reading the whole file.

## Layout of grimoire.html

- **CSS** at the top; theme tokens on `:root` (`--gold`, `--bronze`, `--bg`,
  `--serif`/`--sans`/`--mono`, …). Use the tokens, don't hardcode colours.
- **Markup**: screens marked `<!-- ===== AUTH | LIBRARY | CAST | CASTER |
  CHRONICLE | TOME DETAIL ===== -->`.
- **Script**, in numbered sections:
  1. `firebaseConfig`
  2. Tome catalogue — `TOMES`, built with `T(id, name, cat, spells)`, grouped by
     category banners (LANGUAGES, WEB, THEORY, SYSTEMS, SPECIALISMS). Each spell
     is a `"Title | what mastery means"` string. This is most of the file;
     adding content means adding entries here.
  3. Progression maths — `THRESHOLDS`, `SPELL_BONUS`, `DIFF_MULT`, `COMP_MULT`,
     `sessionXP`, `casterLevel`, `xpForLevel`, `spellsUnlocked`.
  4. Storage — `initFirebase` and a store with the same interface backed by
     Firestore when configured, `localStorage` otherwise (`lsRead`/`lsWrite`).
  5. Rendering — `show(screen)` switches screens; `render*()` functions build
     HTML strings (escape user text with `esc()`); `castSession()` logs a session.
  6. Auth and boot — `doAuth`, `enterApp`, `wire()` (event listeners), `boot()`.

## Data

Firebase Auth + Firestore (compat SDK 10.12.2 from gstatic):
`users/{uid}` (profile), `progress/{uid}` (`tomes` map of xp/spells/sessions/
minutes), `sessions/{uid}/log/{autoId}` (session history).

## Rules

- **XP is stored, not recomputed.** Changing `sessionXP`, the multipliers,
  `THRESHOLDS` or `SPELL_BONUS` makes new sessions disagree with saved
  progress. Ask before touching progression maths.
- **Tome and spell ids are keys in saved progress.** Don't rename or reorder
  ids in `TOMES`; add new ones instead.
- Keep the Firestore and localStorage stores interface-compatible.
- The Firebase web `apiKey` in `firebaseConfig` is a public client identifier,
  not a secret; access control belongs in Firestore security rules.
- Mobile-first portrait layout (safe-area insets, bottom nav).

## Running

`python -m http.server 8000` in the repo, then open
`http://localhost:8000/grimoire.html`. Verification is manual in a browser.
