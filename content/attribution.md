# Attribution

Grimoire is the engine. Much of the curriculum is derived from open source
educational projects. Every source used is listed here with its licence and
exactly how it was used, as required by those licences.

---

## Imported sources

### Exercism language tracks — MIT

- **Repository:** `github.com/exercism/{track}` (e.g. `exercism/python`)
- **Licence:** MIT
- **Imported by:** `scripts/import_exercism.py`
- **Used for:** every language dungeon.

What is taken:

| From | Used as |
|---|---|
| `config.json` | syllabus: concept list, prerequisite graph, exercise order |
| `exercises/concept/{slug}/.docs/introduction.md` | lesson section bodies |
| `exercises/concept/{slug}/.meta/exemplar.*` | runnable lesson code examples |
| `exercises/concept/{slug}/{solution_file}` | starter code in the editor |
| `exercises/concept/{slug}/{test_file}` | practice test cases, converted to `{input, expected}` |

Test cases are **transformed**, not copied: the suites are parsed with Python's
`ast` and the input/expected pairs are re-expressed in Grimoire's own schema.
Exam questions are **not** taken from Exercism — they are written for Grimoire.

Each imported dungeon records `"source": "exercism/{track} (MIT)"` in its JSON,
and each imported challenge carries a `source` field naming the exercise it
came from.

### microsoft/Web-Dev-For-Beginners — MIT

- **Repository:** `github.com/microsoft/Web-Dev-For-Beginners`
- **Licence:** MIT
- **Imported by:** `scripts/import_webdev.py`
- **Used for:** JavaScript and HTML/CSS dungeons, floors 1–6.

| From | Used as |
|---|---|
| `{section}/{lesson}/README.md` | lesson section bodies and runnable examples |
| `quiz-app/src/assets/translations/en.json` | MCQ exam questions |

Quiz questions keep their original wording; the `explain` text on each one is
written for Grimoire.

### trekhleb/javascript-algorithms — MIT

- **Repository:** `github.com/trekhleb/javascript-algorithms`
- **Licence:** MIT
- **Used for:** Data Structures and Algorithms & Complexity theory dungeons.
- **How:** algorithm and data-structure implementations become runnable lesson
  code examples, with explanations rewritten for Grimoire's lesson format.

### The-Art-of-Hacking/h4cker — MIT

- **Repository:** `github.com/The-Art-of-Hacking/h4cker`
- **Licence:** MIT
- **Used for:** the Cryptography & Security theory dungeon.
- **How:** structured markdown provides the topic map and reference material
  for lessons on ethical hacking, DFIR and vulnerability research.

---

## Reference-only sources

Nothing is embedded from these. They shape syllabus ordering and topic
coverage; all lesson text derived from them is written for Grimoire.

### jwasham/coding-interview-university

- **Repository:** `github.com/jwasham/coding-interview-university`
- **Used for:** the topic checklist and ordering for every theory dungeon
  syllabus in `syllabi/`.

### ByteByteGoHq/system-design-101

- **Repository:** `github.com/ByteByteGoHq/system-design-101`
- **Used for:** the topic map for the Distributed Systems and Software
  Architecture & Design Patterns dungeons. Lesson text is original.

### codecrafters-io/build-your-own-x — CC0 (public domain)

- **Repository:** `github.com/codecrafters-io/build-your-own-x`
- **Used for:** boss floor (floor 10) project briefs. Grimoire provides the
  project spec and acceptance tests and links out to the original tutorial;
  tutorial text is not reproduced.

### SystemsApproach/book - CC BY 4.0

- **Repository:** `github.com/SystemsApproach/book` (branch `master`)
- **Work:** *Computer Networks: A Systems Approach*, Larry Peterson and
  Bruce Davie, published at `book.systemsapproach.org`.
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Imported by:** `scripts/import_systems_approach.py`
- **Used for:** the Networking dungeon, one floor per chapter.

| From | Used as |
|---|---|
| `index.rst` and `{chapter}.rst` toctrees | floor order and each chapter's section list |
| `{chapter}/{section}.rst` prose | lesson section bodies, converted from RST |
| `.. code-block::` and `::` literal blocks | lesson code examples, verbatim |

CC BY 4.0 permits adaptation with attribution. The prose is reformatted, not
rewritten: RST markup is converted to the renderer's subset and long sections
are cut at a paragraph boundary with a link to the full chapter. Figures are
not reproduced. Practice and exam questions are not taken from the book.

---

## Runtimes and libraries

| Component | Licence | Use |
|---|---|---|
| Pyodide | MPL-2.0 | in-browser Python execution, loaded from CDN |
| Piston (`emkc.org`) | MIT | remote execution for compiled languages |
| Firebase JS SDK | Apache-2.0 | auth and Firestore, loaded from CDN |
| Google Fonts | OFL | Playfair Display, Inter, JetBrains Mono |

---

## Reporting a problem

If content here is misattributed, or you are a maintainer of one of these
projects and want a change to how your work is credited, open an issue on the
Grimoire repository.
