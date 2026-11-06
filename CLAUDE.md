# CLAUDE.md

Notes for AI sessions working on this repo. README.md explains how the app works for its users (course/deck/material formats, the split tool, the `show` flag); read it first. This file records how the owner wants things done, plus useful things learned along the way.

**Keep this file up to date. It is your memory between sessions.** Update it in the same session, without being asked, whenever:
- the owner states a new preference or corrects how something should be done (add or change the rule here)
- you learn something non-obvious that would save a future session time (a pitfall, a tool quirk, a workflow that worked)
- the project changes in a way that makes something here wrong (new course, new tool, renamed files): fix or remove the stale part
- you finish a piece of work: add a line to the **Log** at the bottom (date, what was done, what's next)

Keep it short and current. Edit existing sections rather than piling on. When you commit other work, include changes to this file in the commit.

## Project in one paragraph

A local flashcard app (`start.py`, Python stdlib only, plus `web/`). Courses are in `courses.json`, decks are in `decks/*.json`, and the PDFs cards link to are listed in `materials.json`. Progress is kept in `data/` (gitignored, never touch it). Two courses: **DV2618 Applied AI** (`dv2618`, lectures L1–L10 + past exams, in `lectures/` and `exams/`) and **Multiprocessor Programming** (`mpp`, DV2597/DV2606, in `multiprocessor/`).

## Workflow rules

- **Commit only when the user says so.** Finish the work, verify it, then ask. Commit straight to `main` (no branches/PRs so far). Never push unless asked.
- **Never delete the user's files.** Move them aside instead (e.g. the 4-up originals went to a subfolder rather than being removed).
- **Don't change card or deck ids** once committed: progress is keyed on them.
- Run the app with the `flashcards` preview config (`.claude/launch.json`, port 8765). Restart it after changing `start.py`; deck/material JSON changes only need a page reload.
- When testing in the browser, **don't rate cards**. Ratings write to the user's real progress. Flip with Enter, leave with Escape.

## New lecture slides (Multiprocessor Programming)

The teacher hands out PDFs with **4 slides per page** (`*_4p.pdf`).
1. The user puts them in `multiprocessor/lectures/4p-originals/` (gitignored).
2. Split: `pip install pypdf` (a scratch venv is fine), then `python3 tools/split_nup.py multiprocessor/lectures/4p-originals/*_4p.pdf`. This writes `Name.pdf` into `multiprocessor/lectures/`. It crops on each slide's clipping rectangle without re-rendering anything, and skips empty cells on the last page. Check that the slide counts look right.
3. Add each split PDF to `materials.json` with an id like `MPP-F4-<TOPIC>` (ids must be unique across courses) and a short label like `F4 Topic`.

## Making decks: how the owner wants them

- **One deck per lecture (F1, F2, …)**, covering *every* PDF of that lecture. Deck id `mpp-fN`, card ids `mpp-fN-001…`, `"group": "Lectures"`, `"order": N`, `"course": "mpp"`.
- **Thorough.** Cover everything exam-relevant on the slides, ~40–50 cards per lecture. Skip course-admin slides (schedule, lab logistics, exam points).
- **Answers are fairly long (~800–1000 characters) with examples**: worked numbers, small code snippets (C/Pthreads/MPI), tables, analogies. Include exercise-style cards too (calculations, "which X fits this situation", "find all dependencies in…").
- **Figures: don't draw ASCII art.** If a slide's picture explains the answer, mark that source `"show": true`. The slide then opens next to the answer by itself. Describe patterns in words if needed.
- **Read every slide as an image, not just `pdftotext`.** Many slides are pictures of text, or diagrams whose text extraction is garbled (formulas, figures). Render with `pdftoppm -r 110 -png` and look at them, zooming into dense figures.
- **Check the facts against the slides.** When a slide has a mistake (off-by-one, missing argument, a misleading graph edge), say so in the card. When you add something that goes beyond the slides, make that clear.
- `sources[].page` is the page number in the **split** PDF (= slide number).
- A good way to build a deck is a small Python script in the scratchpad that writes the JSON (`json.dump(..., indent=2, ensure_ascii=False)`). It avoids escaping trouble in long markdown.

## Verifying a deck

- `GET /api/state` must return no `errors`, and the deck must have the expected card count.
- Render every card with `window.renderMarkdown` in the page and check that no raw `**`, backticks or `|---` leak outside code blocks (`void **` inside code is a false positive).
- Check that every `page` is ≤ the PDF's page count, and spot-check that the `show` pages are the right slides (e.g. pdf.js `getTextContent` of the page title).
- The browser pane is often hidden: pdf.js page *rendering* can stall there, but DOM/JS checks still work. Set a desktop viewport (≥1001 px) to test auto-open, and reset it afterwards.

## Log

Newest last. One or two lines per entry: what was done, and what's next.

- 2026-11-06: added the `mpp` course, the split tool, the `show` auto-open feature, and decks F1 (41 cards), F2 (47), F3 (49). Next: F4 when its slides arrive (week 46: performance analysis, R&R Chap 4; F5 principles for parallel algorithm design).
