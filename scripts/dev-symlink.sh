#!/usr/bin/env bash
# dev-symlink.sh — make the installed Codex plugin cache point live at this repo.
#
# Codex copies a local plugin into ~/.codex/plugins/cache/<marketplace>/<plugin>/<version>/
# on `codex plugin add`, so repo edits do NOT show up until you reinstall.
# For dogfooding we keep the version dir as a REAL directory (Codex ignores it
# if the version dir itself is a symlink) but replace each child entry with a
# symlink back into the repo. Edits in the repo are then live in the next
# Codex thread with no reinstall.
#
# Re-run this after `codex plugin add` (which overwrites the links with copies)
# or after adding a new top-level entry under plugins/codexclaw/.
#
# Usage: scripts/dev-symlink.sh [--status]
set -euo pipefail

MARKETPLACE="codexclaw"
PLUGIN="codexclaw"
VERSION="0.1.0"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/plugins/$PLUGIN"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
VER_DIR="$CODEX_HOME/plugins/cache/$MARKETPLACE/$PLUGIN/$VERSION"

if [ ! -d "$PLUGIN_SRC" ]; then
  echo "error: plugin source not found at $PLUGIN_SRC" >&2
  exit 1
fi

if [ "${1:-}" = "--status" ]; then
  if [ -d "$VER_DIR" ]; then
    echo "version dir: $VER_DIR"
    ls -la "$VER_DIR"
  else
    echo "not installed: $VER_DIR missing (run: codex plugin add $PLUGIN@$MARKETPLACE)"
  fi
  exit 0
fi

if [ ! -e "$VER_DIR" ] && [ ! -L "$VER_DIR" ]; then
  echo "note: $VER_DIR does not exist yet."
  echo "      run 'codex plugin add $PLUGIN@$MARKETPLACE' first, then re-run this script."
  exit 1
fi

# Rebuild the version dir as a real directory full of symlinks into the repo.
rm -rf "$VER_DIR"
mkdir -p "$VER_DIR"

linked=0
shopt -s dotglob nullglob
for entry in "$PLUGIN_SRC"/*; do
  base="$(basename "$entry")"
  # node_modules / build junk should not leak into the plugin tree
  case "$base" in
    node_modules) continue ;;
  esac
  ln -s "$entry" "$VER_DIR/$base"
  linked=$((linked + 1))
done
shopt -u dotglob nullglob

echo "linked $linked entries: $VER_DIR -> $PLUGIN_SRC"
echo "done. open a NEW Codex thread to pick up live changes."
