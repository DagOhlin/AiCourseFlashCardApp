#!/usr/bin/env python3
"""Split "4 slides per page" handout PDFs into one slide per page.

    pip install pypdf
    python3 tools/split_nup.py multiprocessor/lectures/*_4p.pdf

Each input "Name_4p.pdf" becomes "Name.pdf" next to it. Nothing is
re-rendered: every output page is the original page with its visible area
(MediaBox/CropBox) set to one slide, so text stays sharp and selectable and
the file barely grows.

Handouts printed from PowerPoint/Keynote draw each slide inside a clipping
rectangle ("x y w h re W"). The slide frames are the large clipping
rectangles that occur most often in the document; a page only gets the
slides whose frame appears on it, so empty cells on the last page are left
out. Order is row by row, left to right (how the handout is printed).
"""
import logging
import re
import sys
from collections import Counter
from pathlib import Path

try:
    from pypdf import PdfReader, PdfWriter
    from pypdf.generic import RectangleObject
except ImportError:
    sys.exit("This tool needs pypdf: pip install pypdf")

logging.getLogger("pypdf").setLevel(logging.ERROR)

NUM = rb"(-?\d*\.?\d+)"
CLIP_RE = re.compile(NUM + rb"\s+" + NUM + rb"\s+" + NUM + rb"\s+" + NUM + rb"\s+re\s+W\b")


def clip_rects(page):
    contents = page.get_contents()
    if contents is None:
        return []
    return [tuple(round(float(v), 1) for v in m.groups()) for m in CLIP_RE.finditer(contents.get_data())]


def find_frames(reader):
    """The slide frames (x, y, w, h) on a full page, in reading order."""
    page_w = float(reader.pages[0].mediabox.width)
    counts = Counter()
    for page in reader.pages:
        for r in set(clip_rects(page)):
            if r[2] > page_w * 0.25:
                counts[r] += 1
    if not counts:
        return []
    # The frame size is the most common large size; tiny width rounding
    # differences (373.9 vs 373.9429) are merged by position.
    (_, _, w, h), _ = counts.most_common(1)[0]
    frames = {}
    for (x, y, rw, rh), n in counts.items():
        if abs(rw - w) < 2 and abs(rh - h) < 2:
            key = (round(x), round(y))
            frames[key] = (x, y, w, h)
    return sorted(frames.values(), key=lambda f: (-f[1], f[0]))


def split(path):
    src = Path(path)
    out = src.with_name(re.sub(r"_\d+p$", "", src.stem) + ".pdf")
    if out == src:
        out = src.with_name(src.stem + "_split.pdf")
    reader = PdfReader(str(src))
    frames = find_frames(reader)
    if len(frames) < 2:
        print("{}: could not find several slides per page, skipped".format(src))
        return
    writer = PdfWriter()
    for page in reader.pages:
        present = {(round(x), round(y)) for x, y, _, _ in clip_rects(page)}
        for x, y, w, h in frames:
            if (round(x), round(y)) not in present:
                continue
            new = writer.add_page(page)
            box = RectangleObject([x, y, x + w, y + h])
            new.mediabox = new.cropbox = new.trimbox = new.bleedbox = new.artbox = box
    writer.compress_identical_objects()
    with open(out, "wb") as f:
        writer.write(f)
    print("{} -> {}: {} pages -> {} slides ({} per page)".format(
        src.name, out.name, len(reader.pages), len(writer.pages), len(frames)))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for arg in sys.argv[1:]:
        split(arg)
