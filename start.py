#!/usr/bin/env python3
"""Exam Flashcards - a tiny local web app for studying flashcards.

Start it with:  python start.py      (or double-click start.bat / run ./start.sh)
Then study in the browser tab that opens. Press Ctrl+C here to stop.

Only the Python 3 standard library is used, so there is nothing to install.
"""

import argparse
import json
import mimetypes
import os
import sys
import tempfile
import threading
import time
import webbrowser
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

if sys.version_info < (3, 7):
    sys.exit("Exam Flashcards needs Python 3.7 or newer.")

ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
DECKS_DIR = ROOT / "decks"
DATA_DIR = ROOT / "data"
PROGRESS_FILE = DATA_DIR / "progress.json"
MATERIALS_FILE = ROOT / "materials.json"

LEVELS = ("not", "partial", "understand")
DEFAULT_PORT = 8765

progress_lock = threading.Lock()


# ---------------------------------------------------------------- data files

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def write_json_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
        for attempt in range(5):
            try:
                os.replace(tmp, path)
                break
            except PermissionError:
                # Windows: an antivirus/indexer may briefly hold the file open.
                if attempt == 4:
                    raise
                time.sleep(0.1)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def load_progress():
    data = read_json(PROGRESS_FILE, {})
    if not isinstance(data.get("cards"), dict):
        data = {"version": 1, "cards": {}}
    return data


def load_materials(errors):
    try:
        raw = read_json(MATERIALS_FILE, {"documents": []})
    except json.JSONDecodeError as e:
        errors.append("materials.json: invalid JSON ({})".format(e))
        return {}
    docs = {}
    for doc in raw.get("documents", []):
        if not isinstance(doc, dict) or not doc.get("id") or not doc.get("file"):
            errors.append("materials.json: every document needs an 'id' and a 'file'")
            continue
        if not (ROOT / doc["file"]).is_file():
            errors.append("materials.json: file not found for '{}': {}".format(doc["id"], doc["file"]))
        docs[doc["id"]] = {
            "id": doc["id"],
            "title": doc.get("title", doc["id"]),
            "short": doc.get("short", doc["id"]),
            "kind": doc.get("kind", "lecture"),
            "file": doc["file"],
        }
    return docs


def load_decks(materials, errors):
    """Read every decks/*.json file. Problems are collected in `errors`
    (and shown in the app) instead of crashing, so a typo in one deck
    never takes the others down."""
    decks = []
    seen_ids = set()
    if not DECKS_DIR.is_dir():
        return decks
    for path in sorted(DECKS_DIR.glob("*.json")):
        name = path.name
        try:
            with open(path, "r", encoding="utf-8") as f:
                deck = json.load(f)
        except json.JSONDecodeError as e:
            errors.append("{}: invalid JSON ({})".format(name, e))
            continue
        deck_id = deck.get("id")
        if not deck_id or not isinstance(deck.get("cards"), list):
            errors.append("{}: a deck needs an 'id' and a 'cards' list".format(name))
            continue
        if deck_id in seen_ids:
            errors.append("{}: duplicate deck id '{}' (skipped)".format(name, deck_id))
            continue
        seen_ids.add(deck_id)

        cards = []
        card_ids = set()
        for i, card in enumerate(deck["cards"]):
            where = "{} card #{}".format(name, i + 1)
            if not isinstance(card, dict) or not card.get("id"):
                errors.append("{}: missing 'id'".format(where))
                continue
            if card["id"] in card_ids:
                errors.append("{}: duplicate card id '{}'".format(where, card["id"]))
                continue
            if not card.get("front") or not card.get("back"):
                errors.append("{} ({}): needs both 'front' and 'back'".format(where, card["id"]))
                continue
            card_ids.add(card["id"])
            sources = []
            for src in card.get("sources", []):
                if not isinstance(src, dict) or src.get("doc") not in materials:
                    errors.append("{} ({}): unknown source document {!r}".format(
                        where, card["id"], src.get("doc") if isinstance(src, dict) else src))
                    continue
                sources.append({"doc": src["doc"], "page": int(src.get("page", 1)), "note": src.get("note", "")})
            cards.append({
                "id": card["id"],
                "front": card["front"],
                "back": card["back"],
                "sources": sources,
            })
        decks.append({
            "id": deck_id,
            "name": deck.get("name", deck_id),
            "description": deck.get("description", ""),
            "group": deck.get("group", "Decks"),
            "order": deck.get("order", 1000),
            "cards": cards,
        })
    decks.sort(key=lambda d: (d["group"], d["order"], d["name"]))
    return decks


def card_key(deck_id, card_id):
    return "{}::{}".format(deck_id, card_id)


# ------------------------------------------------------------------- server

class Handler(SimpleHTTPRequestHandler):
    server_version = "ExamFlashcards/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB_DIR), **kwargs)

    def log_request(self, code="-", size="-"):
        # Keep the console quiet; only log failed requests.
        if str(getattr(code, "value", code)).startswith(("4", "5")):
            super().log_request(code, size)

    def end_headers(self):
        # Always serve fresh app files and decks; slide PDFs may be cached (see send_material).
        if not self.path.startswith("/files/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # --- helpers
    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    # --- routes
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/state":
            errors = []
            materials = load_materials(errors)
            decks = load_decks(materials, errors)
            with progress_lock:
                progress = load_progress()["cards"]
            return self.send_json({
                "decks": decks,
                "materials": materials,
                "progress": progress,
                "levels": LEVELS,
                "errors": errors,
            })
        if path.startswith("/files/"):
            return self.send_material(unquote(path[len("/files/"):]))
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self.read_body()
        except (ValueError, UnicodeDecodeError):
            return self.send_json({"error": "invalid JSON body"}, 400)

        if path == "/api/rate":
            level = body.get("level")
            if level not in LEVELS or not body.get("deck") or not body.get("card"):
                return self.send_json({"error": "need deck, card and a valid level"}, 400)
            key = card_key(body["deck"], body["card"])
            with progress_lock:
                data = load_progress()
                old = data["cards"].get(key) or {}
                entry = {"level": level, "updated": now_iso(), "reviews": int(old.get("reviews", 0)) + 1}
                data["cards"][key] = entry
                write_json_atomic(PROGRESS_FILE, data)
            return self.send_json({"key": key, "entry": entry})

        if path == "/api/restore":
            # Used by "undo": put a card back exactly how it was (null = never rated).
            if not body.get("deck") or not body.get("card"):
                return self.send_json({"error": "need deck and card"}, 400)
            key = card_key(body["deck"], body["card"])
            entry = body.get("entry")
            with progress_lock:
                data = load_progress()
                if entry is None:
                    data["cards"].pop(key, None)
                elif isinstance(entry, dict) and entry.get("level") in LEVELS:
                    data["cards"][key] = entry
                else:
                    return self.send_json({"error": "invalid entry"}, 400)
                write_json_atomic(PROGRESS_FILE, data)
            return self.send_json({"key": key, "entry": entry})

        if path == "/api/reset":
            deck_ids = body.get("decks")  # None/missing = reset everything
            with progress_lock:
                data = load_progress()
                if deck_ids is None:
                    removed = len(data["cards"])
                    data["cards"] = {}
                else:
                    prefixes = tuple(card_key(d, "") for d in deck_ids)
                    keep = {k: v for k, v in data["cards"].items() if not k.startswith(prefixes)}
                    removed = len(data["cards"]) - len(keep)
                    data["cards"] = keep
                write_json_atomic(PROGRESS_FILE, data)
            return self.send_json({"removed": removed})

        return self.send_json({"error": "not found"}, 404)

    def send_material(self, rel):
        """Serve lecture/exam files listed in materials.json (and nothing else)."""
        errors = []
        allowed = {doc["file"] for doc in load_materials(errors).values()}
        if rel not in allowed:
            return self.send_error(404, "Not a known material file")
        target = (ROOT / rel).resolve()
        if ROOT not in target.parents or not target.is_file():
            return self.send_error(404)
        ctype = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
        size = target.stat().st_size
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        self.send_header("Content-Disposition", "inline")
        self.send_header("Cache-Control", "private, max-age=3600")
        self.end_headers()
        with open(target, "rb") as f:
            while True:
                chunk = f.read(1 << 16)
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    break


def make_server(port):
    """Bind to `port`, or the next free one if it is taken."""
    last_error = None
    for candidate in range(port, port + 20):
        try:
            return ThreadingHTTPServer(("127.0.0.1", candidate), Handler)
        except OSError as e:
            last_error = e
    sys.exit("Could not find a free port near {}: {}".format(port, last_error))


def main():
    parser = argparse.ArgumentParser(description="Exam Flashcards local server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="port to use (default %(default)s)")
    parser.add_argument("--no-browser", action="store_true", help="don't open a browser tab automatically")
    args = parser.parse_args()

    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("application/pdf", ".pdf")

    httpd = make_server(args.port)
    url = "http://127.0.0.1:{}/".format(httpd.server_address[1])
    print("")
    print("  Exam Flashcards is running at  {}".format(url))
    print("  Keep this window open while studying. Press Ctrl+C to stop.")
    print("")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped. Your progress is saved in data/progress.json")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
