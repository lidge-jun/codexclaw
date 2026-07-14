#!/usr/bin/env bash

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRACKING_FILE="$SCRIPT_DIR/visualize-upstream.md"
VISUALIZE_ROOT="$HOME/.codex/plugins/cache/openai-bundled/visualize"

if [[ ! -f "$TRACKING_FILE" ]]; then
  printf 'unable to check visualize upstream: tracking file not found\n' >&2
  printf 'expected: %s\n' "$TRACKING_FILE" >&2
  exit 1
fi

stored_path="$(awk -F'`' '/^- Current upstream path:/ { print $2; exit }' "$TRACKING_FILE")"
stored_hash="$(awk -F'`' '/^- Current SHA-256:/ { print $2; exit }' "$TRACKING_FILE")"
stored_version="$(awk -F'`' '/^- Version:/ { print $2; exit }' "$TRACKING_FILE")"

if [[ ! "$stored_hash" =~ ^[[:xdigit:]]{64}$ ]]; then
  printf 'unable to check visualize upstream: stored SHA-256 is missing or invalid\n' >&2
  printf 'tracking file: %s\n' "$TRACKING_FILE" >&2
  exit 1
fi

shopt -s nullglob
candidates=("$VISUALIZE_ROOT"/*/skills/visualize/SKILL.md)
shopt -u nullglob

if (( ${#candidates[@]} == 0 )); then
  printf 'unable to check visualize upstream: installed SKILL.md not found\n' >&2
  printf 'searched: %s\n' "$VISUALIZE_ROOT/*/skills/visualize/SKILL.md" >&2
  exit 1
fi

version_is_newer() {
  local left="${1#v}"
  local right="${2#v}"
  local left_part right_part length index
  local IFS=.
  local -a left_parts right_parts

  read -r -a left_parts <<< "$left"
  read -r -a right_parts <<< "$right"

  length=${#left_parts[@]}
  if (( ${#right_parts[@]} > length )); then
    length=${#right_parts[@]}
  fi

  for (( index = 0; index < length; index++ )); do
    left_part="${left_parts[index]:-0}"
    right_part="${right_parts[index]:-0}"
    left_part="${left_part%%[^0-9]*}"
    right_part="${right_part%%[^0-9]*}"
    left_part="${left_part:-0}"
    right_part="${right_part:-0}"

    if (( left_part > right_part )); then
      return 0
    fi
    if (( left_part < right_part )); then
      return 1
    fi
  done

  return 1
}

upstream_file="${candidates[0]}"
upstream_version="${upstream_file#"$VISUALIZE_ROOT"/}"
upstream_version="${upstream_version%%/skills/visualize/SKILL.md}"

for candidate in "${candidates[@]:1}"; do
  candidate_version="${candidate#"$VISUALIZE_ROOT"/}"
  candidate_version="${candidate_version%%/skills/visualize/SKILL.md}"
  if version_is_newer "$candidate_version" "$upstream_version"; then
    upstream_file="$candidate"
    upstream_version="$candidate_version"
  fi
done

if command -v sha256sum >/dev/null 2>&1; then
  current_hash="$(sha256sum "$upstream_file" | awk '{ print $1 }')"
elif command -v shasum >/dev/null 2>&1; then
  current_hash="$(shasum -a 256 "$upstream_file" | awk '{ print $1 }')"
else
  printf 'unable to check visualize upstream: no SHA-256 tool found\n' >&2
  printf 'install sha256sum or shasum and rerun this script\n' >&2
  exit 1
fi

if [[ "$current_hash" == "$stored_hash" ]]; then
  printf 'upstream in sync (version %s, hash %s)\n' "$upstream_version" "$current_hash"
  exit 0
fi

printf 'visualize upstream drift detected\n'
printf '\nChange summary:\n'
printf '  version: %s -> %s\n' "${stored_version:-unknown}" "$upstream_version"
printf '  path:    %s -> %s\n' "${stored_path:-unknown}" "$upstream_file"
printf '  SHA-256: %s -> %s\n' "$stored_hash" "$current_hash"
printf '\nUpdate required:\n'
printf '  1. Compare the installed SKILL.md with ../reference/visualize-contract.md.\n'
printf '  2. Re-extract changed diagram-viewer contract sections.\n'
printf '  3. Update the path, hash, version, date, and changelog in %s.\n' "$TRACKING_FILE"
printf '  4. Rerun this script until it prints "upstream in sync".\n'
exit 1
