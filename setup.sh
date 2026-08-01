#!/usr/bin/env bash
# Build the Triage environment: a .venv with the app and its test tools installed.
#
# Two paths, because the repo is used two ways. `uv` is the fast one and is what
# the course deck uses; the stdlib `venv` fallback is for a machine without uv.
# Either way you end up with the same .venv and the same seeded state.
#
#   ./setup.sh
#
# Requires Python 3.10 or newer (pyproject.toml sets requires-python = ">=3.10").
# macOS ships 3.9.6, which cannot install this package — if that is all you have,
# this script says so and tells you what to do instead of failing inside pip.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)" || ROOT="$SCRIPT_DIR"
cd "$ROOT"

if command -v uv >/dev/null 2>&1; then
  echo "[setup] uv found — building .venv with uv"
  uv venv .venv
  uv pip install -e .
  uv pip install -e '.[dev]'
else
  echo "[setup] no uv — falling back to python3 -m venv"

  PY_OK="$(python3 -c 'import sys; print(1 if sys.version_info >= (3, 10) else 0)' 2>/dev/null || echo 0)"
  if [ "$PY_OK" != "1" ]; then
    HAVE="$(python3 -V 2>&1 || echo 'none')"
    cat >&2 <<EOF

[setup] STOP — Python is too old.

  found:    $HAVE
  required: 3.10 or newer (pyproject.toml, requires-python)

macOS ships Python 3.9.6, so the plain venv path cannot work on a stock Mac.
Install uv and re-run this script — it brings its own Python:

  curl -LsSf https://astral.sh/uv/install.sh | sh
  ./setup.sh

Or install Python 3.10+ yourself (e.g. brew install python@3.12) and re-run.

EOF
    exit 1
  fi

  # venv can succeed at creating the directory and still fail to install pip
  # into it (the bundled wheel does not work on every Python build). Check for
  # pip itself rather than trusting the exit code.
  python3 -m venv .venv || true
  if [ ! -x ".venv/bin/pip" ]; then
    cat >&2 <<EOF

[setup] STOP — the venv was created without pip.

Python's bundled pip wheel failed to install into .venv, so there is nothing
here to install the app with. This is a property of the Python build, not of
this repo, and it is not worth debugging before a class.

Install uv and re-run — it does not use ensurepip and brings its own Python:

  curl -LsSf https://astral.sh/uv/install.sh | sh
  ./setup.sh

EOF
    rm -rf .venv
    exit 1
  fi

  .venv/bin/pip install --quiet --upgrade pip
  .venv/bin/pip install -e .
  .venv/bin/pip install -e '.[dev]'
fi

echo
echo "[setup] done. The seeded state you should now see:"
echo
echo "  .venv/bin/pytest -q            ->  2 failed, 7 passed, 1 warning"
echo "  .venv/bin/python -m eval.run   ->  7/10 correct = 0.70 (baseline 0.80), exits 1"
echo
echo "Both are failing on purpose: one seeded bug, caught two ways. Fixing it is the lab."
echo "To install the commit gate:  git config core.hooksPath scripts"
