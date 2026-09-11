#!/usr/bin/env bash
# dev-install.sh — install this checkout as a REAL Codex plugin copy (no symlinks).
#
# Codex does not reliably resolve a plugin whose cache entries are symlinks, so the
# dogfood track is a real `codex plugin add` from a LOCAL marketplace rooted at this
# repo. `codex plugin add` re-copies the payload and prunes files that no longer
# exist in the source, so re-running this after every edit is the whole update loop.
#
# What it does:
#   1. builds components (src/*.ts -> dist/*.js) unless --no-build
#   2. registers this repo as the local `codexclaw` marketplace if it is not already
#   3. clears any leftover symlinks in the plugin cache (legacy dev-symlink.sh state)
#   4. reinstalls the plugin as a real copy and prunes stale version directories
#
# Usage:
#   scripts/dev-install.sh              # build + reinstall
#   scripts/dev-install.sh --no-build   # reinstall only
#   scripts/dev-install.sh --status     # report install state, change nothing
set -euo pipefail

MARKETPLACE="codexclaw"
PLUGIN="codexclaw"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_SRC="$REPO_ROOT/plugins/$PLUGIN"
CXC_CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PLUGIN_CACHE="$CXC_CODEX_HOME/plugins/cache/$MARKETPLACE/$PLUGIN"

die() { echo "error: $*" >&2; exit 1; }

# The configured root for our marketplace, or empty when it is not registered.
# `codex plugin marketplace list` prints whitespace-aligned columns, so a naive
# `{print $2}` truncates any root containing a space and the repoint check below
# would then fire on every run. Take everything after the first field instead.
marketplace_root() {
  codex plugin marketplace list 2>/dev/null | awk -v m="$MARKETPLACE" '$1 == m {
    sub(/^[^[:space:]]+[[:space:]]+/, ""); sub(/[[:space:]]+$/, ""); print; exit
  }'
}

[ -d "$PLUGIN_SRC" ] || die "plugin source not found at $PLUGIN_SRC"
command -v codex >/dev/null 2>&1 || die "codex CLI not on PATH"

installed_version() {
  python3 - "$PLUGIN_SRC/.codex-plugin/plugin.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as fh:
    print(json.load(fh)["version"])
PY
}

report_status() {
  local version
  version="$(installed_version)"
  echo "source:      $PLUGIN_SRC"
  echo "manifest:    $version"
  echo "marketplace: $(marketplace_root)"
  if [ -d "$PLUGIN_CACHE" ]; then
    echo "cache roots:"
    for dir in "$PLUGIN_CACHE"/*; do
      [ -e "$dir" ] || continue
      echo "  $(basename "$dir")"
    done
    local links
    links="$(find "$PLUGIN_CACHE" -type l 2>/dev/null | wc -l | tr -d ' ')"
    echo "symlinks in cache: $links"
  else
    echo "cache roots: none (not installed)"
  fi
}

BUILD=1
for arg in "$@"; do
  case "$arg" in
    --status) report_status; exit 0 ;;
    --no-build) BUILD=0 ;;
    *) die "unknown argument: $arg (expected --status or --no-build)" ;;
  esac
done

VERSION="$(installed_version)"

if [ "$BUILD" = "1" ]; then
  echo "==> building components"
  (cd "$REPO_ROOT" && npm run --silent build)
fi

current_root="$(marketplace_root)"
if [ "$current_root" != "$REPO_ROOT" ]; then
  echo "==> pointing marketplace $MARKETPLACE at $REPO_ROOT (was: ${current_root:-unset})"
  if [ -n "$current_root" ]; then
    codex plugin remove "$PLUGIN@$MARKETPLACE" >/dev/null 2>&1 || true
    codex plugin marketplace remove "$MARKETPLACE" >/dev/null
  fi
  codex plugin marketplace add "$REPO_ROOT" >/dev/null
fi

# Legacy dev-symlink.sh left symlinked children behind; Codex does not resolve those.
if [ -d "$PLUGIN_CACHE" ]; then
  stale_links="$(find "$PLUGIN_CACHE" -type l 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$stale_links" != "0" ]; then
    echo "==> clearing $stale_links symlink(s) from the plugin cache"
    rm -rf "$PLUGIN_CACHE"
  fi
fi

echo "==> installing $PLUGIN@$MARKETPLACE ($VERSION) as a real copy"
codex plugin add "$PLUGIN@$MARKETPLACE" >/dev/null

# Keep only the version directory this manifest declares.
if [ -d "$PLUGIN_CACHE" ]; then
  for dir in "$PLUGIN_CACHE"/*; do
    [ -d "$dir" ] || continue
    if [ "$(basename "$dir")" != "$VERSION" ]; then
      echo "==> pruning stale cache root $(basename "$dir")"
      rm -rf "$dir"
    fi
  done
fi

VER_DIR="$PLUGIN_CACHE/$VERSION"
[ -d "$VER_DIR" ] || die "install did not produce $VER_DIR"
remaining_links="$(find "$VER_DIR" -type l 2>/dev/null | wc -l | tr -d ' ')"
[ "$remaining_links" = "0" ] || die "$remaining_links symlink(s) still present under $VER_DIR"

echo "installed real copy: $VER_DIR"
node "$VER_DIR/bin/cxc.mjs" doctor 2>&1 | tail -20 || true
echo "done. open a NEW Codex thread to pick up the update."
