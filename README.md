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

1. **Pick decks.** Tick one or more decks; the cards from all of them are pooled together.
2. **Pick which cards show up:** *New*, *Don't understand*, *Kinda understand* and/or *Understand*. For example, choose only *Don't understand* to drill your weak spots.
3. **Start.** Cards always come in a completely random order.
4. Read the question, then **show the answer** and rate yourself:
   **Don't understand** · **Kinda understand** · **Understand**.
5. Under each answer you see which lecture and slide (or exam and page) it comes from. **Open slide** shows that slide beside the card; **New tab ↗** opens the whole PDF in its own tab.

When you finish (or end early) you get a summary, and can go again or repeat just the cards you didn't fully get.

| Key | Action |
|---|---|
| `Space` / `Enter` | Show answer |
| `1` `2` `3` | Don't understand / Kinda / Understand |
| `S` | Open the slide for this card |
| `U` / `Backspace` | Undo the last rating |
| `Esc` | Close the slide, or end the session |

## Your progress

Ratings are saved in `data/progress.json` on your own computer. That folder is **not** part of git, so everyone who clones the repo starts fresh and never sees anyone else's progress.

To start over, use **Reset progress…** in the top-right corner. You can reset only the selected decks or everything.

## Adding or editing cards

Every deck is one JSON file in `decks/`. New files show up when you reload the page; you don't need to restart.

```json
{
  "id": "lecture-03",
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

- **`id`s must stay the same.** Progress is stored per deck id and card id, so you can fix a card's text without losing its rating.
- `front` and `back` support simple Markdown: `**bold**`, `*italic*`, `` `code` ``, `- lists` (indent 2 spaces to nest), `1. numbered`, `| tables |`, `> notes` and code blocks.
- `sources` refer to documents in `materials.json` by `doc` id (`L1`–`L10` for lectures, `EX…` for exams). `page` is the page number in the PDF. An optional `note` is shown next to it, for example `"note": "Question 3c"`.
- If a deck file has a mistake, the app shows a red box on the start page explaining what's wrong, and still loads the other decks.

To add new material, put the PDF in `lectures/` or `exams/` and add an entry to `materials.json`. PowerPoint files have to be converted to PDF first; `lectures/LECTURE-4.pdf` is a conversion of `LECTURE-4.pptx`.

## Files

```
start.py         the local server (Python standard library only)
start.bat        Windows launcher
start.sh         Linux / macOS launcher
web/             the app itself (HTML, CSS, JavaScript)
decks/           flashcard decks (JSON)
materials.json   list of the lecture/exam PDFs that cards can link to
lectures/ exams/ course material
data/            your personal progress (created on first use, not in git)
```

The course slides and exams are included so the slide links work. Keep the repository **private** if you put it on GitHub.
