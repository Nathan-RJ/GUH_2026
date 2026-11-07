#!/usr/bin/env bash
# Start the backend and frontend together:   ./dev.sh   (or: bash dev.sh)
# First run also sets everything up. Ctrl+C stops both.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# --- Backend: create the Python venv on first run -------------------------
if [ ! -d backend/.venv ]; then
  echo "Creating Python virtual environment..."
  if command -v py >/dev/null 2>&1; then
    py -m venv backend/.venv        # Windows
  else
    python3 -m venv backend/.venv   # Mac / Linux
  fi
fi

if [ -f backend/.venv/Scripts/python.exe ]; then
  PY="$ROOT/backend/.venv/Scripts/python"   # Windows
else
  PY="$ROOT/backend/.venv/bin/python"       # Mac / Linux
fi

echo "Installing backend packages (quick if already installed)..."
"$PY" -m pip install -q --disable-pip-version-check -r backend/requirements.txt

# --- Frontend: install packages on first run ------------------------------
if [ ! -d frontend/node_modules ]; then
  echo "Installing frontend packages..."
  (cd frontend && npm install --no-audit --no-fund)
fi

# --- Run both --------------------------------------------------------------
cleanup() {
  if [ -n "$BACKEND_PID" ]; then
    if [ -r "/proc/$BACKEND_PID/winpid" ]; then
      # Windows (Git Bash): kill the whole Python process tree
      taskkill //F //T //PID "$(cat "/proc/$BACKEND_PID/winpid")" >/dev/null 2>&1 || true
    else
      kill 0 2>/dev/null || true   # Mac / Linux: stop everything this script started
    fi
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

"$PY" backend/run.py &
BACKEND_PID=$!

echo ""
echo "Backend:  http://127.0.0.1:5000"
echo "Frontend: http://localhost:5173   <- open this"
echo "Press Ctrl+C to stop both."
echo ""

cd frontend
npm run dev
