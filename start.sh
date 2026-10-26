#!/usr/bin/env sh
# Starts Exam Flashcards (Linux / macOS). Needs Python 3.
cd "$(dirname "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 start.py "$@"
elif command -v python >/dev/null 2>&1; then
  exec python start.py "$@"
fi
echo "Python 3 was not found. Install it (e.g. 'sudo apt install python3') and try again."
exit 1
