#!/usr/bin/env python3
"""agbrowse_helper.py — lazy agbrowse resolver for cxc-search Tier 2 (lazygap_impl 070.1).

agbrowse is cli-jaw's browse layer extracted as a server-free npm package: HTTP-first proof
with a local browser only as escalation. codexclaw adopts it as an OPT-IN, lazily-resolved
Tier-2 PROOF helper for known URLs — never a hard dependency. If it cannot be resolved, this
prints an actionable install hint and exits 3; Tier 2 then falls back to Browser Use exactly
as before. (Mirrors the ast-grep helper's resolve-or-hint contract, but agbrowse is a package
bin shim, not a lone binary, and has NO Homebrew path.)

Resolution order (LOCKED — no runtime/cache/Homebrew steps, agbrowse has none):
  1. $CODEXCLAW_AGBROWSE_PATH   explicit override (abs path to `agbrowse` or bin/agbrowse.mjs)
  2. `agbrowse` on PATH          (npm -g install)
  3. an adjacent checkout        (../agbrowse/bin/agbrowse.mjs relative to common roots)
  4. else: print an install hint and exit 3 (never crash)

Usage:
  agbrowse_helper.py doctor              # resolve or print the install hint
  agbrowse_helper.py path                # print the resolved runnable command, or exit 3
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import List, Optional


def err(msg: str = "") -> None:
    print(msg, file=sys.stderr)


def env_override() -> Optional[List[str]]:
    raw = os.environ.get("CODEXCLAW_AGBROWSE_PATH")
    if not raw:
        return None
    p = Path(raw).expanduser()
    if p.is_file():
        # a .mjs shim is run via node; an executable bin is run directly
        if p.suffix == ".mjs":
            return ["node", str(p)]
        if os.access(p, os.X_OK):
            return [str(p)]
    return None


def path_binary() -> Optional[List[str]]:
    found = shutil.which("agbrowse")
    return [found] if found else None


def adjacent_checkout() -> Optional[List[str]]:
    """Look for a sibling agbrowse checkout near common project roots."""
    here = Path(__file__).resolve()
    # search upward from this script for a sibling `agbrowse/bin/agbrowse.mjs`
    roots: List[Path] = []
    for ancestor in list(here.parents)[:8]:
        roots.append(ancestor / "agbrowse" / "bin" / "agbrowse.mjs")
    # also a couple of common dev layouts relative to $HOME
    home = Path.home()
    roots.append(home / "Developer" / "agbrowse" / "bin" / "agbrowse.mjs")
    for cand in roots:
        if cand.is_file():
            return ["node", str(cand)]
    return None


def resolve_command() -> Optional[List[str]]:
    for fn in (env_override, path_binary, adjacent_checkout):
        cmd = fn()
        if cmd:
            return cmd
    return None


def install_hint() -> None:
    err("agbrowse not found (OPT-IN Tier-2 proof helper).")
    err("")
    err("Resolution order: $CODEXCLAW_AGBROWSE_PATH -> `agbrowse` on PATH -> adjacent checkout.")
    err("")
    err("Install / point at it via one of:")
    err("  npm install -g agbrowse                       # global bin on PATH")
    err("  export CODEXCLAW_AGBROWSE_PATH=/abs/agbrowse/bin/agbrowse.mjs")
    err("  (or clone agbrowse next to your projects; this helper finds ../agbrowse/bin/agbrowse.mjs)")
    err("")
    err("agbrowse is OPTIONAL: without it, cxc-search Tier 2 falls back to Browser Use / Computer Use.")


def main(argv: List[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "doctor"
    resolved = resolve_command()
    if cmd == "doctor":
        if resolved:
            print(f"agbrowse: {' '.join(resolved)}")
            return 0
        install_hint()
        return 3
    if cmd == "path":
        if resolved:
            print(" ".join(resolved))
            return 0
        install_hint()
        return 3
    err(f"unknown subcommand '{cmd}' (expected doctor|path)")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
