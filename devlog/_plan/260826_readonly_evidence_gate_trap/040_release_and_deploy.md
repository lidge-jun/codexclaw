---
created: 2026-08-26
workPhase: wp5
---

# 040 — Release and local deploy

Status: PLANNED

Source: `.codexclaw/evidence/260826_readonly_gate_release.md` (read-only research lane).

## Version surfaces (12, moved together)

Bare SemVer: root `package.json`, `cli/package.json`, and the 9 workspace packages
(`components/{config-guard,cxc-ops,messenger-bridge,pabcd-state,provider-bridge,recall,skill-search,subagent-config}`
plus `gui`). Manifest `plugins/codexclaw/.codex-plugin/plugin.json` takes
`<VERSION>+codex.<stamp>` — the stamp is the local-install cachebuster and MUST change
or `codex plugin add` will not repopulate the cache directory.

Target: 0.2.13 -> 0.2.14 (behavior change to a shipped gate; patch-level since the
default path for existing dispatches is unchanged).

## Known checker gap

`scripts/check-versions.mjs` does NOT inspect `cli/package.json` or `gui/package.json`.
A green run does not prove all 12 moved. Verify those two explicitly.

## Sequence

```bash
npm test                     # capture the tests total, require fail 0
node plugins/codexclaw/scripts/inventory.mjs --write --tests "$TESTS"
node plugins/codexclaw/scripts/check-versions.mjs 0.2.14
npm run build                # dist/ must be regenerated or dist-freshness fails
node --test plugins/codexclaw/test/dist-freshness.test.mjs
npm run gate
node plugins/codexclaw/scripts/inventory.mjs --check
git diff --exit-code plugins/codexclaw/components   # after build: expect clean
```

## Deploy (local)

```bash
codex plugin add --json codexclaw@codexclaw
bash scripts/dev-symlink.sh --status
```

**Do NOT run `scripts/dev-symlink.sh` without `--status`.** Its non-status path deletes
the resolved cache version directory and replaces payload entries with symlinks. The
file is also MODIFIED in the working tree by the user — read it, never touch it.

## Live verification (the point of the whole unit)

Against the INSTALLED plugin, not the checkout. Auditor r2 #8: verifying only the 4th
stop lets the installed proof go green while the parent consumer is missing. The
installed E2E must walk the whole contract:

```bash
PLUGIN_ROOT="$HOME/.codex/plugins/cache/codexclaw/codexclaw/<version>"
CLI="$PLUGIN_ROOT/components/pabcd-state/dist/cli.js"
```

1. Six consecutive no-receipt stops -> `block, block, block, "", "", ""`.
2. The session JSON carries an unresolved `unverifiedSubagents` entry.
3. `update_goal{status:"complete"}` through the PreToolUse goal-complete hook -> DENY.
4. `update_goal{status:"blocked"}` -> still allowed (the honest escape hatch).
5. Bare `cxc evidence resolve` with no receipt -> REFUSED.
6. `cxc evidence resolve --receipt <valid>` -> succeeds and ledgers the event.
7. `update_goal{status:"complete"}` -> now ALLOWED.
8. A read-only-shaped worker (no writable evidence dir) is released, not trapped.

A remembered pass is not evidence. Step 3 is the one that proves the fail-closed
verdict actually shipped; steps 1 and 8 prove the child is never trapped.

## Git

Commit locally as we go (LOOP-GIT-01). Preserve the user's modified
`scripts/dev-symlink.sh` and the untracked `devlog/_plan/` user units — never stage them.
**Do not push without explicit user approval.**

## Accept criteria (c7)

- 12 surfaces at 0.2.14, manifest carries a fresh stamp.
- npm test green at exact head; build clean; gate clean; dist fresh.
- Commit sha recorded; installed plugin version confirmed.
- Live 4th-stop-releases receipt captured from the INSTALLED dist.
