# Exam Flashcards

A small flashcard app for studying for the **DV2618 Applied AI** exam. It runs in your browser, every answer links to the lecture slide (or exam page) it is based on, and the slide opens right next to the card with one click.

## Start it

You only need **Python 3** (3.7 or newer). Nothing else to install.

```bash
git clone <this repo>
cd AiExamFlashCards
```

- **Windows:** double-click `start.bat`
- **Linux / macOS:** run `./start.sh` (or `python3 start.py`)

Your browser opens at <http://127.0.0.1:8765>. Keep the terminal window open while you study; close it (or press Ctrl+C) to stop.

> No Python on Windows? Install it from [python.org](https://www.python.org/downloads/) and tick **"Add python.exe to PATH"** in the installer.

## How studying works

1. **Pick a course** in the menu on the left (a strip across the top on a phone). Everything below belongs to that course, and the app remembers which one you used last.
2. **Pick decks.** Tick one or more of the course's decks; the cards from all of them are pooled together.
3. **Pick which cards show up:** *New*, *Don't understand*, *Kinda understand* and/or *Understand*. For example, choose only *Don't understand* to drill your weak spots.
4. **Start.** Cards always come in a completely random order.
5. Read the question, then **show the answer** (or tap the card) and rate yourself:
   **Don't understand** · **Kinda understand** · **Understand**.
6. Under each answer you see which lecture and slide (or exam and page) it comes from. **Open slide** shows that slide beside the card. Browse with ‹ › (or swipe on a phone); **↗** opens the whole PDF in a new tab.

When you finish (or end early) you get a summary, and can go again or repeat just the cards you didn't fully get.

| Key | Action |
|---|---|
| `Space` | Show answer; press again for **Understand** and the next card |
| `1` `2` `3` | Don't understand / Kinda / Understand |
| `Enter` | Show answer |
| `S` | Open the slide for this card |
| `←` `→` | Previous / next slide while the slide is open |
| `U` / `Backspace` | Undo the last rating |
| `Esc` | Close the slide, or end the session |

## Use it on your phone or another computer

The app keeps running on the computer where you started it, and other devices on the same Wi-Fi can use it from there. They share the same progress.

1. Click **Other devices** in the top bar and switch on **Share on my home network**.
2. Copy the link it shows (it looks like `http://192.168.1.23:8766/?key=…`) and open it on your phone or the other computer.

- The link includes a secret key. Anyone on the network without it gets nothing.
- Sharing stays on until you switch it off or close the app. To start with it already on, run `python start.py --lan`.
- **Windows:** the first time, Windows Firewall asks whether Python may use the network. Click **Allow access** (private networks are enough).
- **Linux:** if the other device can't connect and you use a firewall (e.g. `ufw`), allow the port shown in the link.
- If the link doesn't work, the dialog may list other addresses for this computer. Try those.

## Getting new and updated cards

Cards are just files in the repository, so to get the latest ones:

```bash
git pull
```

Then reload the page (no restart needed). Your ratings are kept: they live outside git and are linked to each card's id, so a reworded card keeps its rating. Newly added decks start unticked if you had saved a selection; tick them, or use **Select all**.

**Applied AI:** there is one deck per lecture (L1–L10, about 315 cards). Answers are based on the slides and past exams, and worked exam problems (search traces, genetic-algorithm calculations, normalization, regression) are included as cards.

The **Past exam questions** deck has one card for every unique question in the past exams (71 cards):

- Questions that appear in several exams are one card that links to every exam where they appear.
- Each card links to the question in the exam, to the official solution when there is one, and to the slides on that topic.
- Answers start with **Official solution** (2020 and 2024 exams) or *No official solution exists – suggested answer*.
- Where an official solution contains a mistake, or an exam question is misprinted, the card says so in a note.

**Multiprocessor Programming:** one deck per lecture (F1, F2, …), added as the course goes on. Cards whose answer is easiest to understand from a diagram open that slide automatically when you show the answer.

## Your progress

Ratings are saved in `data/progress.json` on your own computer. That folder is **not** part of git, so everyone who clones the repo starts fresh and never sees anyone else's progress. (`data/settings.json` holds your share key.)

To start over, use **Reset progress…** in the top-right corner. You can reset only the selected decks or the whole course you are looking at; other courses keep their progress.

## Adding a course

Courses are listed in `courses.json`; the order there is the order in the menu:

```json
{
  "courses": [
    { "id": "dv2618", "code": "DV2618", "name": "Applied AI", "description": "Shown under the course name" }
  ]
}
```

Add an entry, then create decks for it by setting `"course"` to its `id` (see below). `code` and `description` are optional. A deck with an unknown course is skipped with an error on the start page; a deck without a `course` goes into the first course.

## Adding or editing cards

Every deck is one JSON file in `decks/`. New files show up when you reload the page; you don't need to restart.

```json
{
  "id": "lecture-03",
  "course": "dv2618",
  "name": "L3 · Graphs and Search in AI",
  "description": "Shown under the deck name",
  "group": "Lectures",
  "order": 3,
  "cards": [
    {
      "id": "l3-007",
      "front": "In A* search, what is f(n)?",
      "back": "**f(n) = g(n) + h(n)**\n\n- g(n): cost so far\n- h(n): heuristic estimate to the goal",
      "sources": [{ "doc": "L3", "page": 49 }]
    }
  ]
}
```

- **`id`s must stay the same.** Progress is stored per deck id and card id, so you can fix a card's text without losing its rating. Deck ids must be unique across all courses.
- `front` and `back` support simple Markdown: `**bold**`, `*italic*`, `` `code` ``, `- lists` (indent 2 spaces to nest), `1. numbered`, `| tables |`, `> notes` and code blocks.
- `sources` refer to documents in `materials.json` (shared by all courses, so document ids must be unique) by `doc` id (`L1`–`L10` for lectures, `EX…` for exams). `page` is the page number in the PDF. An optional `note` is shown next to it, for example `"note": "Question 3c"`. Add `"show": true` to a source when its slide has a figure that explains the answer: that slide then opens by itself next to the card when the answer is shown (on screens wide enough to show both; on phones its button is highlighted instead), and `S` opens it.
- If a deck file has a mistake, the app shows a red box on the start page explaining what's wrong, and still loads the other decks.

To add new material, put the PDF in the course's folder and add an entry to `materials.json`. Applied AI uses `lectures/` and `exams/`; Multiprocessor Programming uses `multiprocessor/lectures/` and `multiprocessor/exams/`. Give each new course its own folder like that, and use document ids that don't clash with other courses (e.g. `MPP-L1`). If the PDF is a handout with several slides per page (like the Multiprocessor Programming `*_4p.pdf` files), split it first so that every slide is its own page: put the handouts in `multiprocessor/lectures/4p-originals/`, run `pip install pypdf` once, then `python3 tools/split_nup.py multiprocessor/lectures/4p-originals/*_4p.pdf`. That writes `Name.pdf` for each `Name_4p.pdf` into `multiprocessor/lectures/` without re-rendering anything; the originals folder is ignored by git. PowerPoint files have to be converted to PDF first; `lectures/LECTURE-4.pdf` is a conversion of `LECTURE-4.pptx`.

## Files

```
start.py         the local server (Python standard library only)
start.bat        Windows launcher
start.sh         Linux / macOS launcher
web/             the app itself (HTML, CSS, JavaScript)
web/vendor/pdfjs Mozilla's PDF.js, used to draw the slides (Apache 2.0 license)
courses.json     the courses shown in the menu
decks/           flashcard decks (JSON), each belonging to a course
materials.json   list of the lecture/exam PDFs that cards can link to
tools/split_nup.py splits handouts with several slides per page (needs pypdf)
lectures/ exams/ Applied AI course material
multiprocessor/  Multiprocessor Programming course material (lectures/, exams/)
data/            your personal progress (created on first use, not in git)
```

The course slides and exams are included so the slide links work. Keep the repository **private** if you put it on GitHub.
