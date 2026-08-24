<!-- GENERATED:BEGIN - import_exercism.py rewrites this block -->
# Syllabus - Python (The Serpent's Descent)

Derived from `exercism/python (MIT)`. This is the contract: content must cover everything listed here.

| Floor | Name | Concepts | Exercism exercises |
|---|---|---|---|
| 1 | Threshold of Syntax | `basics`, `bools`, `numbers` | guidos-gorgeous-lasagna, ghost-gobble-arcade-game, currency-exchange |
| 2 | Hall of Branching Paths | `comparisons`, `conditionals`, `strings` | meltdown-mitigation, black-jack, little-sisters-vocab |
| 3 | The Bound Sigil | `list-methods`, `lists`, `string-methods` | little-sisters-essay, card-games, chaitanas-colossal-coaster |
| 4 | Vault of Collections | `loops`, `string-formatting`, `tuples` | making-the-grade, pretty-leaflet, tisbury-treasure-hunt |
| 5 | Chamber of Forms | `dict-methods`, `dicts`, `sets`, `unpacking-and-multiple-assignment` | inventory-management, mecha-munch-management, locomotive-engineer, cater-waiter |
| 6 | The Iterating Spiral | `classes`, `enums`, `generators`, `none` | ellens-alien-game, plane-tickets, log-levels, restaurant-rozalynn |

## Declared in the track but not yet on a floor

- `aliasing`
- `anonymous-functions`
- `binary-data`
- `binary-octal-hexadecimal`
- `bitflags`
- `bitwise-operators`
- `bytes`
- `class-composition`
- `class-customization`
- `class-inheritance`
- `class-interfaces`
- `collections`
- `complex-numbers`
- `context-manager-customization`
- `dataclasses`
- `decorators`
- `descriptors`
- `function-arguments`
- `functional-tools`
- `functions`
- `functools`
- `generator-expressions`
- `higher-order-functions`
- `iteration`
- `iterators`
- `itertools`
- `list-comprehensions`
- `memoryview`
- `number-variations`
- `operator-overloading`
- `other-comprehensions`
- `raising-and-handling-errors`
- `recursion`
- `regular-expressions`
- `rich-comparisons`
- `sequences`
- `string-methods-splitting`
- `testing`
- `text-processing`
- `type-hinting`
- `unicode-regular-expressions`
- `user-defined-errors`
- `walrus-operator`
- `with-statement`
- `random`
- `fractions`
- `secrets`
<!-- GENERATED:END -->



---

# Authored floors (7-10)

Not derived from Exercism. The track declares 67 concepts but ships concept
exercises for only 20, so these floors close real gaps rather than pad the
count. Approved 2026-08-24.

| Floor | Name | Concepts | Source |
|---|---|---|---|
| 7 | Sanctum of Structure | `functions`, `function-arguments`, `recursion` | authored |
| 8 | The Warded Gate | `raising-and-handling-errors`, `user-defined-errors`, `with-statement`, `class-inheritance` | authored |
| 9 | Depths of Abstraction | `list-comprehensions`, `iterators`, `decorators`, `higher-order-functions`, `type-hinting` | authored |
| 10 | The Archmage's Trial | boss project; `testing`, packaging and async taught in service of shipping it | authored + codecrafters-io/build-your-own-x (CC0) |

**Why floor 7 exists.** Exercism has no concept exercise for `functions`,
`function-arguments`, `recursion` or `higher-order-functions`. Functions are
used from the first exercise onward but never taught as a subject: parameters,
defaults, keyword arguments and return semantics are never the lesson. A
graduate who has not been taught those cannot write Python, so floor 7 teaches
them explicitly before the error-handling and abstraction floors build on them.

Floors 5 and 6 carry four exercises each so that no floor ends up below the
six-practice-challenge minimum.

## Floor 10 - boss project

A complete program built from scratch with an acceptance test suite. Brief
adapted from `codecrafters-io/build-your-own-x` (CC0, public domain);
Grimoire supplies the spec and the tests and links out to the original.

Candidate briefs, in preference order:

1. **Build your own shell** - argument parsing, process control, error paths.
2. **Build your own HTTP server** - sockets, protocol parsing, concurrency.
3. **Build your own JSON parser** - recursion, error handling, data modelling.

Testing, packaging and `async` are taught inside this floor as the project
needs them, never as standalone lectures.

## Concepts deliberately out of scope

`memoryview`, `bitflags`, `binary-octal-hexadecimal`, `complex-numbers`,
`fractions`, `secrets`, `unicode-regular-expressions`, `descriptors`,
`metaclasses`. Real Python, but not on the path from zero to professionally
capable. A later "Python Internals" dungeon can pick them up.
