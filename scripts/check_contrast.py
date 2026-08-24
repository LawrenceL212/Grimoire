#!/usr/bin/env python3
"""WCAG 2.1 contrast audit for the Grimoire palette.

    python scripts/check_contrast.py

Checks every text colour against every surface it can sit on. AA needs 4.5:1
for body text and 3:1 for large text (>=18.66px bold or >=24px) and for
non-text UI boundaries. Exits non-zero if any body-text pairing fails.
"""
import itertools
import sys

SURFACES = {
    "bg":       "#1A1410",
    "surface":  "#231C12",
    "elevated": "#2D2418",
    "code":     "#161008",
}

TEXT = {
    "text":       "#F5EDD8",
    "dim":        "#B8A882",
    "faint":      "#A08D72",   # lifted from #8A7455, which failed on all surfaces
    "gold":       "#C49A3C",
    "ok":         "#7A9E6E",
    "warn-ink":   "#CE8347",   # #C4783C is kept for fills, too low for text
    "danger-ink": "#D89684",   # #9E4E3C is kept for fills, far too low for text
}

# Kept for fills, borders and seals only - never used for text, so the 3:1
# non-text boundary threshold applies rather than 4.5:1.
FILL_ONLY = {"warn": "#C4783C", "danger": "#9E4E3C"}

# Colours only ever used for large display type or non-text boundaries.
LARGE_OR_UI_ONLY = set()

AA_BODY = 4.5
AA_LARGE = 3.0


def srgb(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hexstr):
    h = hexstr.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)


def ratio(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def suggest(fg, bg, target=AA_BODY):
    """Lighten fg in equal steps until it clears the target."""
    h = fg.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    for step in range(1, 120):
        nr, ng, nb = (min(255, int(v + step * (255 - v) / 120.0 * 1.6))
                      for v in (r, g, b))
        cand = "#%02X%02X%02X" % (nr, ng, nb)
        if ratio(cand, bg) >= target:
            return cand, ratio(cand, bg)
    return None, 0


def main():
    failures = []
    print("WCAG 2.1 contrast audit - Grimoire palette")
    print("=" * 72)
    print("%-9s %-9s %7s   %-6s %s" % ("TEXT", "ON", "RATIO", "AA", ""))
    print("-" * 72)

    for tname, tval in TEXT.items():
        worst = None
        for sname, sval in SURFACES.items():
            r = ratio(tval, sval)
            need = AA_LARGE if tname in LARGE_OR_UI_ONLY else AA_BODY
            ok = r >= need
            mark = "PASS" if ok else "FAIL"
            print("%-9s %-9s %6.2f:1   %-6s %s" % (
                tname, sname, r, mark,
                "" if ok else "needs >= %.1f:1" % need))
            if not ok:
                failures.append((tname, tval, sname, sval, r))
                if worst is None or r < worst[1]:
                    worst = (sval, r)
        if worst:
            fix, fr = suggest(tval, worst[0])
            if fix:
                print("%-9s %s" % ("", "-> lift %s to %s (%.2f:1 on its worst surface)"
                                   % (tval, fix, fr)))
        print("-" * 72)

    print("")
    if failures:
        print("%d failing pairing(s):" % len(failures))
        for tname, tval, sname, sval, r in failures:
            print("  %s %s on %s %s = %.2f:1" % (tname, tval, sname, sval, r))
        return 1
    print("All text/surface pairings meet WCAG 2.1 AA.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
