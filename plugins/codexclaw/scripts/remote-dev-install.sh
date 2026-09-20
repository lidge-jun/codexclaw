#!/usr/bin/env bash
# remote-dev-install.sh — reinstall codexclaw on one ssh host from its dev checkout.
#
# The manual version is a long ssh one-liner that is easy to get wrong in ways that look
# like success: a login shell that never loaded nvm, a pull that was not a fast-forward,
# an installer whose doctor failure is masked. This runs the same steps and refuses
# instead of guessing.
#
# It never repairs a remote checkout. No reset, clean, stash, force, branch switch, clone
# or delete: a host that is dirty or off dev is reported, not fixed, because that tree
# belongs to whoever left work in it.
#
# Usage:
#   remote-dev-install.sh <host> [--path <remote-checkout>] [--shell zsh|bash] [--check]
#   --check performs the read-only half only: branch, cleanliness and installed version.
set -euo pipefail

HOST=""
REMOTE_PATH="\$HOME/Developer/codexclaw"
REMOTE_SHELL="zsh"
CHECK_ONLY=0

die() { printf "remote-dev-install: %s\n" "$1" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --path) [ $# -ge 2 ] || die "--path needs a value"; REMOTE_PATH="$2"; shift 2 ;;
    --shell) [ $# -ge 2 ] || die "--shell needs a value"; REMOTE_SHELL="$2"; shift 2 ;;
    --check) CHECK_ONLY=1; shift ;;
    --help|-h) sed -n "2,15p" "$0"; exit 0 ;;
    --*) die "unknown option: $1" ;;
    *) [ -z "$HOST" ] || die "one host at a time"; HOST="$1"; shift ;;
  esac
done

[ -n "$HOST" ] || die "usage: remote-dev-install.sh <host> [--path <dir>] [--shell zsh|bash] [--check]"
# A host that looks like an option, or carries shell metacharacters, is refused rather
# than interpolated into a remote command line.
case "$HOST" in
  -*) die "host name must not start with a dash: $HOST" ;;
  *[!A-Za-z0-9._@-]*) die "host name may only contain letters, digits, dot, underscore, at or dash: $HOST" ;;
esac
case "$REMOTE_SHELL" in zsh|bash) ;; *) die "--shell must be zsh or bash" ;; esac
case "$REMOTE_PATH" in *[\;\&\|\`]*) die "--path contains shell metacharacters" ;; esac

# A login shell reading its script from stdin: no nested quoting, and nvm-managed node
# still resolves.
ssh_script() {
  ssh -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1 \
      -o ServerAliveInterval=15 -o ServerAliveCountMax=4 "$HOST" "$REMOTE_SHELL -l -s"
}

printf "==> %s: inspecting %s\n" "$HOST" "$REMOTE_PATH"
STATE="$(ssh_script <<EOF
cd $REMOTE_PATH 2>/dev/null || { echo MISSING_CHECKOUT; exit 0; }
echo "branch=\$(git rev-parse --abbrev-ref HEAD)"
echo "dirty=\$(git status --porcelain | awk 'END{print NR}')"
echo "head=\$(git rev-parse --short HEAD)"
echo "installed=\$(ls ~/.codex/plugins/cache/codexclaw/codexclaw/ 2>/dev/null | tail -1)"
EOF
)"
printf "%s\n" "$STATE"

case "$STATE" in
  *MISSING_CHECKOUT*) die "$HOST has no checkout at $REMOTE_PATH; clone it deliberately, this script will not" ;;
esac
BRANCH="$(printf "%s\n" "$STATE" | sed -n "s/^branch=//p")"
DIRTY="$(printf "%s\n" "$STATE" | sed -n "s/^dirty=//p")"
[ "$BRANCH" = "dev" ] || die "$HOST is on '$BRANCH', not dev; switch it yourself"
[ "$DIRTY" = "0" ] || die "$HOST has $DIRTY uncommitted change(s); that work is someone else's, so this stops here"

if [ "$CHECK_ONLY" = "1" ]; then
  printf "==> %s: check only, nothing installed\n" "$HOST"
  exit 0
fi

printf "==> %s: fast-forwarding dev and installing\n" "$HOST"
# ff-only by construction: a diverged remote fails here instead of being rewritten.
ssh_script <<EOF || die "$HOST: install failed, previous install left in place"
set -e
cd $REMOTE_PATH
git fetch origin --quiet
git pull --ff-only origin dev
scripts/dev-install.sh
EOF

AFTER_STATE="$(ssh_script <<EOF
cd $REMOTE_PATH
echo "installed=\$(ls ~/.codex/plugins/cache/codexclaw/codexclaw/ 2>/dev/null | tail -1)"
echo "expected=\$(sed -n 's/.*\"version\": \"\\([^\"]*\\)\".*/\\1/p' plugins/codexclaw/.codex-plugin/plugin.json | head -1)"
EOF
)"
AFTER="$(printf "%s\n" "$AFTER_STATE" | sed -n "s/^installed=//p")"
EXPECTED="$(printf "%s\n" "$AFTER_STATE" | sed -n "s/^expected=//p")"
printf "installed=%s expected=%s\n" "$AFTER" "$EXPECTED"
# Dispatching the command is not the outcome: the host has to show the version it now has.
[ -n "$AFTER" ] && [ "$AFTER" = "$EXPECTED" ] || die "$HOST reports '$AFTER' but its checkout declares '$EXPECTED'"
printf "==> %s: %s\n" "$HOST" "$AFTER"
printf "note: doctor failures are not visible here - dev-install.sh does not propagate them. Read its output above.\n"
