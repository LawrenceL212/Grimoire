#!/usr/bin/env python3
"""Import microsoft/Web-Dev-For-Beginners into Grimoire dungeon JSON.

    python scripts/import_webdev.py
    python scripts/import_webdev.py --dry-run
    python scripts/import_webdev.py --no-cache

Pulls the 24 structured lessons and the quiz bank:
  - lesson README.md      -> lesson sections with runnable examples
  - quiz-app translations -> MCQ exam questions, matched to their lesson

Lessons are routed to two dungeons by subject. Where content/javascript.json
already exists (from the Exercism import) the JavaScript lessons are merged
into it rather than overwriting: quiz questions land in each floor's exam,
and lesson sections top up floors that are short.

Source: github.com/microsoft/Web-Dev-For-Beginners (MIT).
See content/attribution.md.
"""
import argparse
import io
import json
import os
import re
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache", "webdev")
REPO = "microsoft/Web-Dev-For-Beginners"
RAW = "https://raw.githubusercontent.com/%s/main/%s"
TREE = "https://api.github.com/repos/%s/git/trees/main?recursive=1" % REPO

# Which lesson directories feed which dungeon, in floor order.
ROUTING = [
    ("html-css", "1-getting-started-lessons"),
    ("html-css", "3-terrarium"),
    ("javascript", "2-js-basics"),
    ("javascript", "4-typing-game"),
    ("javascript", "5-browser-extension"),
    ("javascript", "6-space-game"),
    ("javascript", "7-bank-project"),
]

DUNGEON_META = {
    "javascript": {"name": "The Shifting Sanctum", "subject": "JavaScript",
                   "sigil": "⚡", "lang": "javascript"},
    "html-css":   {"name": "The Woven Facade", "subject": "HTML & CSS",
                   "sigil": "◧", "lang": "html"},
}

FLOOR_NAMES = [
    "Threshold of Syntax", "Hall of Branching Paths", "The Bound Sigil",
    "Vault of Collections", "Chamber of Forms", "The Iterating Spiral",
    "Sanctum of Structure", "The Warded Gate", "Depths of Abstraction",
    "The Archmage's Trial",
]

FENCE = re.compile(r"```([a-zA-Z0-9+#-]*)\n(.*?)```", re.S)
RUNNABLE = {"javascript", "js", "json", "python", "html", "css", "bash", "sh"}
SKIP_LANGS = {"mermaid", ""}


def cache_key(name):
    """A filesystem-safe cache filename. Windows rejects ? : * " < > |."""
    safe = re.sub(r'[^A-Za-z0-9._-]', "_", name)
    return safe[-180:]


class Fetcher:
    def __init__(self, use_cache=True):
        self.use_cache = use_cache
        self.hits = self.misses = 0
        self.failures = []

    def get(self, path, absolute=None):
        key = os.path.join(CACHE, cache_key(absolute or path))
        if self.use_cache and os.path.exists(key):
            self.hits += 1
            return io.open(key, encoding="utf-8").read()
        url = absolute or (RAW % (REPO, path))
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "grimoire-importer"})
            with urllib.request.urlopen(req, timeout=30) as r:
                text = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            self.failures.append("%s -> HTTP %s" % (path, e.code))
            return None
        except Exception as e:
            self.failures.append("%s -> %s" % (path, e))
            return None
        self.misses += 1
        os.makedirs(os.path.dirname(key), exist_ok=True)
        io.open(key, "w", encoding="utf-8").write(text)
        return text


def strip_md(md):
    md = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", md)
    md = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md)
    md = re.sub(r"<[^>]+>", "", md)
    return md


def lesson_sections(md, lang, limit=4):
    """Level-2 sections that carry a runnable example."""
    blocks = []

    def mask(m):
        blocks.append((m.group(1).lower(), m.group(2).strip("\n")))
        return "\x00B%d\x00" % (len(blocks) - 1)

    masked = FENCE.sub(mask, md)
    parts = re.split(r"^##\s+(.+?)\s*$", masked, flags=re.M)
    if len(parts) < 3:
        return []

    out = []
    for i in range(1, len(parts) - 1, 2):
        title = re.sub(r"[✀-\U0001FAFF☀-➿]", "", parts[i]).strip()
        body_raw = parts[i + 1]
        if re.match(r"(pre|post)-lecture quiz", title, re.I) or "assignment" in title.lower():
            continue
        code = ""
        for bid in [int(x) for x in re.findall(r"\x00B(\d+)\x00", body_raw)]:
            blang, btext = blocks[bid]
            if blang in SKIP_LANGS or blang not in RUNNABLE:
                continue
            code = btext
            break
        if not code:
            continue
        body = re.sub(r"\x00B\d+\x00", "", body_raw)
        body = strip_md(body)
        body = re.sub(r"\n{3,}", "\n\n", body).strip()
        if len(body) < 40:
            continue
        out.append({"title": title, "body": body, "code": code, "lang": lang})
        if len(out) >= limit:
            break
    return out


def load_quizzes(fetcher):
    """lesson number -> list of MCQ dicts, from the quiz app's bank."""
    raw = fetcher.get("quiz-app/src/assets/translations/en.json")
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except ValueError:
        return {}
    root = data[0] if isinstance(data, list) else data
    by_lesson = {}
    for q in root.get("quizzes", []):
        title = q.get("title", "")
        m = re.search(r"Lesson\s+(\d+)", title)
        if not m:
            continue
        n = int(m.group(1))
        for item in q.get("quiz", []):
            opts = item.get("answerOptions", [])
            choices = [o.get("answerText", "") for o in opts]
            correct = [i for i, o in enumerate(opts)
                       if str(o.get("isCorrect", "")).lower() == "true"]
            if not choices or len(correct) != 1:
                continue
            by_lesson.setdefault(n, []).append({
                "type": "mcq",
                "prompt": item.get("questionText", "").strip(),
                "choices": choices,
                "answer": correct[0],
                "explain": "TODO: explain why the other options are wrong.",
                "xp": 8,
                "tags": [],
                "source": "Web-Dev-For-Beginners quiz %s" % q.get("id"),
            })
    return by_lesson


def lesson_dirs(tree, top):
    """Sub-lesson directories under a top-level section, in order."""
    seen = []
    for path in tree:
        m = re.match(r"^%s/([^/]+)/README\.md$" % re.escape(top), path)
        if m:
            seen.append((top + "/" + m.group(1), m.group(1)))
    seen.sort(key=lambda t: natural_key(t[1]))
    if not seen and (top + "/README.md") in tree:
        seen = [(top, top)]
    return seen


def natural_key(s):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


def build(fetcher, dry_run):
    tree_raw = fetcher.get("tree.json", absolute=TREE)
    if not tree_raw:
        raise SystemExit("Could not read the repository tree (GitHub API may be "
                         "rate-limited). Try again later or use the cache.")
    tree = [e["path"] for e in json.loads(tree_raw).get("tree", [])]
    quizzes = load_quizzes(fetcher)

    dungeons, report = {}, {"lessons": 0, "sections": 0, "mcq": 0,
                            "no_sections": [], "overflow": {},
                            "quiz_lessons": len(quizzes)}

    for dungeon_id, top in ROUTING:
        meta = DUNGEON_META[dungeon_id]
        d = dungeons.setdefault(dungeon_id, {
            "id": dungeon_id, "name": meta["name"], "subject": meta["subject"],
            "category": "language", "sigil": meta["sigil"], "unlock": None,
            "source": "microsoft/Web-Dev-For-Beginners (MIT)",
            "importedBy": "scripts/import_webdev.py", "floors": [],
        })
        for path, slug in lesson_dirs(tree, top):
            if len(d["floors"]) >= 10:
                # A dungeon is ten floors. Anything past that is recorded so
                # it can be folded into earlier floors by hand, not dropped
                # silently.
                report["overflow"].setdefault(dungeon_id, []).append(path)
                continue
            md = fetcher.get(path + "/README.md")
            if not md:
                continue
            report["lessons"] += 1
            title = re.sub(r"^#\s+", "", md.strip().split("\n")[0]).strip()
            secs = lesson_sections(strip_md_keep_fences(md), meta["lang"])
            if not secs:
                report["no_sections"].append(path)
            n = len(d["floors"]) + 1
            lesson_no = guess_lesson_no(path)
            exam = list(quizzes.get(lesson_no, [])) if lesson_no else []
            for i, q in enumerate(exam):
                q["id"] = "%s-%d-e-%02d" % (dungeon_id[:2], n, i + 1)
                q["tags"] = [slug]
            report["sections"] += len(secs)
            report["mcq"] += len(exam)
            d["floors"].append({
                "n": n,
                "name": FLOOR_NAMES[n - 1] if n <= len(FLOOR_NAMES) else "Floor %d" % n,
                "concepts": [slug],
                "exercises": [path],
                "title": title,
                "lesson": {"sections": secs},
                "practice": [],
                "exam": exam,
                "_todo": ["practice: author 6-10 coding challenges with test cases"]
                         + ([] if len(secs) >= 2 else
                            ["lesson needs %d more section(s)" % (2 - len(secs))])
                         + ([] if len(exam) >= 8 else
                            ["exam needs %d more question(s)" % (8 - len(exam))]),
            })
    return dungeons, report


def strip_md_keep_fences(md):
    """Drop images/HTML but leave fenced code intact for the section splitter."""
    parts, out, i = FENCE.split(md), [], 0
    # FENCE.split gives [text, lang, code, text, lang, code, ...]
    while i < len(parts):
        if i % 3 == 0:
            t = parts[i]
            t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
            t = re.sub(r"<[^>]+>", "", t)
            out.append(t)
        else:
            if i % 3 == 1:
                out.append("```" + parts[i] + "\n")
            else:
                out.append(parts[i] + "```")
        i += 1
    return "".join(out)


def guess_lesson_no(path):
    nums = re.findall(r"/(\d+)-", path + "/")
    if nums:
        return int(nums[-1])
    m = re.match(r"^(\d+)-", os.path.basename(path))
    return int(m.group(1)) if m else None


def merge_into(existing, incoming, report):
    """Add quiz questions and top-up sections to an already-imported dungeon."""
    added_q = added_s = 0
    for i, floor in enumerate(existing.get("floors", [])):
        if i >= len(incoming["floors"]):
            break
        src = incoming["floors"][i]
        for q in src["exam"]:
            q = dict(q)
            q["id"] = "%s-%d-e-%02d" % (existing["id"][:2], floor["n"], len(floor["exam"]) + 1)
            floor.setdefault("exam", []).append(q)
            added_q += 1
        if len(floor["lesson"]["sections"]) < 4:
            room = 4 - len(floor["lesson"]["sections"])
            floor["lesson"]["sections"].extend(src["lesson"]["sections"][:room])
            added_s += min(room, len(src["lesson"]["sections"]))
    # anything the existing dungeon had no floor for is appended
    if len(incoming["floors"]) > len(existing.get("floors", [])):
        for src in incoming["floors"][len(existing["floors"]):]:
            if len(existing["floors"]) >= 10:
                break
            src["n"] = len(existing["floors"]) + 1
            existing["floors"].append(src)
    existing["source"] = existing.get("source", "") + " + microsoft/Web-Dev-For-Beginners (MIT)"
    report["merged_questions"] = added_q
    report["merged_sections"] = added_s
    return existing


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-cache", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    f = Fetcher(use_cache=not args.no_cache)
    print("importing %s ..." % REPO)
    dungeons, report = build(f, args.dry_run)

    written = []
    for did, d in dungeons.items():
        out = os.path.join(ROOT, "content", "%s.json" % did)
        if did == "javascript" and os.path.exists(out):
            try:
                existing = json.load(io.open(out, encoding="utf-8"))
                if existing.get("importedBy") == "scripts/import_exercism.py":
                    d = merge_into(existing, d, report)
            except ValueError:
                pass
        if not args.dry_run:
            os.makedirs(os.path.dirname(out), exist_ok=True)
            json.dump(d, io.open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        written.append((out, d))

    print("")
    print("=" * 66)
    print("  IMPORT SUMMARY - Web-Dev-For-Beginners")
    print("=" * 66)
    print("  network: %d fetched, %d from cache%s" % (
        f.misses, f.hits, ", %d failed" % len(f.failures) if f.failures else ""))
    print("  lessons read              : %d" % report["lessons"])
    print("  lesson sections imported  : %d" % report["sections"])
    print("  quiz questions imported   : %d (from %d quiz lessons)"
          % (report["mcq"], report["quiz_lessons"]))
    if "merged_questions" in report:
        print("  merged into javascript    : %d questions, %d sections"
              % (report["merged_questions"], report["merged_sections"]))
    print("")
    print("  NEEDS MANUAL WORK")
    print("    practice challenges     : 0 imported - this source has no test suites")
    print("    lessons with no usable section : %d %s"
          % (len(report["no_sections"]), report["no_sections"][:3]))
    for did, paths in report.get("overflow", {}).items():
        print("    %s: %d lessons past floor 10, fold in by hand: %s"
              % (did, len(paths), ", ".join(p.split("/")[-1] for p in paths[:4])))
    print("")
    for out, d in written:
        print("  %-28s %d floors, %d sections, %d exam"
              % (os.path.relpath(out, ROOT), len(d["floors"]),
                 sum(len(fl["lesson"]["sections"]) for fl in d["floors"]),
                 sum(len(fl["exam"]) for fl in d["floors"])))
    if args.dry_run:
        print("\n  (dry run - nothing written)")
    print("=" * 66)


if __name__ == "__main__":
    main()
