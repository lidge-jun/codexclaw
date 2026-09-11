# 060 — wp7 integration: CI, bottom-up merge, release, reinstall

Not a stack layer. This is the execution procedure that turns the chain green and
ships it. Criteria **c-7** and **c-12**.

## 0. Entry gate — do not start wp7 early

**c-8 must be `met` before this work-phase begins.** The bound goalplan's `wp7` has no
`dependsOn` edge to `wp8` because `workPhases[]` is append-only and `wp8` was added
in roadmap revision 2 (see `000_plan.md` "Goalplan drift notice"). Following the raw
goalplan edges would reach integration without closing #109.

```powershell
cxc loop show --session <id> | Select-String -Pattern "c-8"
```

Proceed only when that line reads `[met]`.

## 1. Stack facts as of this document

| fact | value |
|---|---|
| `origin/main` | `6aae1c97` (promotion PR #145, merged 2026-09-11) |
| `origin/dev` | `a267b398` (includes #130) |
| L0 base | `a267b398` — already fast-forwarded |
| open cross-repo PR | #118, CONFLICTING, fork `thisisjun786`, out of scope |

PR #130 is **merged**, so the rebase exposure recorded in `000_plan.md` for that
specific PR is discharged. The exposure itself is not: any new merge into `dev` while
this chain is open forces a cascade. §4 keeps the check.

## 2. Per-layer PR creation

Each layer's PR bases on the layer **below**, never on `dev` (except L0).
`enforce-pr-target.yml` requires `dev` as the target and exempts only `dev`→`main`, so a
child PR targeting its parent branch will be flagged `[WRONG BRANCH]`. That is expected
for a manual chain and is not a failure: the workflow prefixes the title and comments,
it does not block the merge. Do not "fix" it by retargeting a layer at `dev` — that
would collapse the chain into overlapping diffs.

Write the body to a file. A multi-paragraph `--body` string does not survive PowerShell
argument parsing (corpus: `oss-native-arg-quoting`, `dq-regex-interpolates`).

```powershell
# once per layer; $head and $base are branch names
gh pr create --repo lidge-jun/codexclaw --base $base --head $head `
  --title "<layer thesis>" --body-file .codexclaw/pr-body-$head.md
```

Every PR body carries the same stack map so a reviewer can see the position:

```markdown
Stack (bottom to top), merge bottom-up:

| layer | branch | base | issue |
|---|---|---|---|
| L0 | codex/win-sweep-roadmap | dev | roadmap |
| L1 | codex/fix-ocx-windows-detect | L0 | #131 |
| L2 | codex/fix-session-binding-extended-path | L1 | #134 |
| L3 | codex/fix-config-guard-help | L2 | #132 |
| L4 | codex/fix-nongit-early-refusal | L3 | #133 |
| L5 | codex/fix-split-cwd-source | L4 | #109 |
| L6 | codex/windows-landmine-sweep | L5 | sweep |

This is a manual branch chain, not a registered GitHub stack.
```

## 3. CI, observed asynchronously

Never block a turn on CI. Poll, and do other work between polls.

```powershell
gh pr view <n> --repo lidge-jun/codexclaw --json mergeStateStatus --jq .mergeStateStatus
gh pr checks <n> --repo lidge-jun/codexclaw 2>&1 | Select-String -Pattern "pending|fail"
```

Use `--jq` with a **bare path** (`.mergeStateStatus`). A `--jq` expression containing
quotes, e.g. `[.a,.b]|join("/")`, is mangled before `gh` sees it and `gh` reports
`accepts at most 1 arg(s)`. Observed on this host.

`mergeStateStatus` vocabulary that matters here:

| value | meaning | action |
|---|---|---|
| `CLEAN` | mergeable, nothing pending or failing | merge |
| `UNSTABLE` | mergeable, a non-required check pending or failed | inspect the named check; do not merge on "mergeable" alone |
| `BLOCKED` | required check or review missing | wait |
| `DIRTY` | conflicts | cascade first |

**`main` and `dev` have no branch protection** (`gh api .../branches/main/protection` →
`404 Branch not protected`), so there are **no required checks** and `UNSTABLE` will not
stop a merge. The wait is a deliberate discipline, not an enforced gate. Wait for
`CLEAN`.

### DEV-STACK-07 record, per layer

Record these four separately; do not collapse them into "CI green":

1. branch topology (head branch, base branch, parent head sha),
2. native membership (none — manual chain; `gh api repos/.../stacks?pull_request=<n>` for the record),
3. the layer's current head sha and the sha each check ran against,
4. workflow event, ref and concurrency group.

CI runs per layer. That is correct for a manual chain, not duplication — there is no
native stack to deduplicate. The slowest job on this repository is `wsl (drvfs /mnt/c)`
at roughly 12-15 minutes; it is the usual reason a PR sits at `UNSTABLE`.

## 4. Bottom-up merge and cascade

Invariant: **merge bottom-up, and re-verify every layer above after any merge.**

Before pushing or merging any layer, confirm `dev` has not moved:

```powershell
git fetch origin dev
git rev-parse origin/dev
```

If it differs from the sha L0 was built on, cascade from L0 upward before touching a PR.

For each layer from the bottom:

```powershell
gh pr merge <n> --repo lidge-jun/codexclaw --squash --delete-branch
git fetch origin dev
# retarget and rebase the next layer onto the new dev
git checkout <next-layer>
git rebase --onto origin/dev <old-parent-branch>
npm run build
git add -A plugins/codexclaw/components
# a NEW dist file needs -f; .gitignore:2 ignores dist/
git add -f <new dist paths>
git commit --amend --no-edit   # or a fresh build commit
git push --force-with-lease
gh pr edit <next-n> --repo lidge-jun/codexclaw --base dev
```

`--force-with-lease`, never `--force`. Use `--squash` for layer merges, matching how #130
was merged into `dev`; `dev`→`main` promotion uses `--merge` to match the existing
`Merge pull request #N from lidge-jun/dev` history on `main`.

After each rebase, re-run the layer's own reproduction from `000_plan.md` §Verification.
A rebase that compiles is not a rebase that still fixes the issue.

## 5. Promote `dev` → `main`

The promotion path is a PR from `dev` to `main`, merged with a merge commit.
`enforce-pr-target.yml` exempts exactly this combination (`PROMOTION_BASE = "main"`,
`PROMOTION_HEAD = "dev"`).

```powershell
gh pr create --repo lidge-jun/codexclaw --base main --head dev `
  --title "release: <summary>" --body-file .codexclaw/pr-body-promote.md
# wait for CLEAN, then
gh pr merge <n> --repo lidge-jun/codexclaw --merge
```

Do **not** pass `--delete-branch` on the promotion. `dev` is the permanent integration

### 5.1 The promotion deletes `dev` anyway — measured, not theoretical

Omitting `--delete-branch` is **not sufficient**. This repository has
`delete_branch_on_merge: true`:

```powershell
gh api repos/lidge-jun/codexclaw --jq .delete_branch_on_merge   # -> true
```

GitHub applies that setting to the merged PR's **head** branch. On a `dev`→`main`
promotion the head is `dev`, so merging the promotion PR deletes the permanent
integration branch. Observed on PR #145: immediately after the merge,
`git ls-remote --heads origin` listed only `main` and the feature branch, and
`gh api repos/.../branches/dev` returned `404 Branch not found`.

A local `git fetch origin dev` fails with `couldn't find remote ref dev` while a stale
`origin/dev` ref still resolves, so `git rev-parse origin/dev` keeps answering the old
sha and hides the deletion. Check `git ls-remote --heads origin`, not the local ref.

Nothing is lost: the old tip survives as the second parent of the promotion merge
commit on `main`.

**Preventive (preferred).** Disable the setting for the duration of the promotion:

```powershell
gh api -X PATCH repos/lidge-jun/codexclaw -f delete_branch_on_merge=false
gh pr merge <n> --repo lidge-jun/codexclaw --merge
gh api -X PATCH repos/lidge-jun/codexclaw -f delete_branch_on_merge=true
```

**Remedial.** If the promotion already merged, restore `dev` at the pre-merge tip. Take
it from the merge commit's second parent rather than trusting a stale local ref:

```powershell
git fetch origin main
$tip = git rev-parse "origin/main^2"
git push origin ($tip + ":refs/heads/dev")
git ls-remote --heads origin        # confirm refs/heads/dev is back
```

Restore before opening any further PR: `enforce-pr-target.yml` requires `dev` as the
target for every non-promotion PR, so while `dev` is missing the whole stack is
unmergeable.
branch.

## 6. Release deploy

`.github/workflows/release.yml` has two triggers: a `v*` tag push, and
`workflow_dispatch` with `version`, `prerelease`, `dry_run` and `expected_sha`.

The dispatch is fail-closed in three independent ways, all of which must be satisfied:

1. it must run from `refs/heads/main`,
2. `expected_sha` is required and must equal the run's `GITHUB_SHA` — this is the
   "main moved after the release audit" guard,
3. the version's tag and any zero-asset GitHub Release must not already exist
   (a zero-asset release may be resumed).

```powershell
git fetch origin main
$sha = git rev-parse origin/main
gh workflow run release.yml --repo lidge-jun/codexclaw --ref main `
  -f version=<x.y.z> -f expected_sha=$sha -f prerelease=true -f dry_run=true
```

Run `dry_run=true` first: it exercises the whole gate without publishing. Then repeat
with `dry_run=false`.

**The version number is a human decision.** The payload manifest currently declares
`0.2.24`. This document does not pick the next version; obtain it from the user and
pin `expected_sha` to the audited `main` commit.

## 7. Reinstall from the local checkout

### 7.1 Blocker found on this host — `dev-install.sh` requires Python

`scripts/dev-install.sh` reads the manifest version with `python3`:

```bash
installed_version() {
  python3 - "$PLUGIN_SRC/.codex-plugin/plugin.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as fh:
    print(json.load(fh)["version"])
PY
}
```

`VERSION="$(installed_version)"` runs on **every** path, not only `--status`. This host
has no Python (`python`, `python3` and `py` all resolve to the Microsoft Store alias or
nothing), so the script dies under `set -euo pipefail` before it builds anything.

This is a Windows landmine in the project's own dogfood path: a Node project whose dev
install depends on Python. **Fix it in L6** (`050`) with the one-line Node equivalent:

```bash
installed_version() {
  # node, not python3: the toolchain this repo already requires. A Windows host with
  # no Python otherwise kills the whole dev-install under `set -e`.
  node -e 'process.stdout.write(require(process.argv[1]).version)' "$PLUGIN_SRC/.codex-plugin/plugin.json"
}
```

Until that lands, the reinstall cannot be performed with the shipped script, and c-12
is unprovable. Treat the Node rewrite as a **prerequisite** of wp7, not an optional
cleanup.

### 7.2 Running it on Windows

The script is bash. Git Bash is present at `C:\Program Files\Git\usr\bin\bash.exe`.

```powershell
& "C:\Program Files\Git\usr\bin\bash.exe" scripts/dev-install.sh --status
& "C:\Program Files\Git\usr\bin\bash.exe" scripts/dev-install.sh
```

Run `--status` first and read the `marketplace:` line.

### 7.3 The marketplace repoint is expected, and it is destructive

The currently registered install does **not** come from this checkout:

```text
codexclaw@codexclaw  installed, enabled  0.2.24+codex.20260908031619
marketplace root: C:\Users\super\.codex\.tmp\marketplaces\codexclaw
```

Because that root is not `$REPO_ROOT`, `dev-install.sh` will
`codex plugin remove`, `codex plugin marketplace remove`, then
`codex plugin marketplace add $REPO_ROOT`. It also `rm -rf`s any cache version
directory that is not the manifest version.

This is exactly what "reinstall from local dev" means, and it is what the user asked
for — but it replaces a working installation. Before running it, back up the installed
payload and note the current role configuration (`cxc subagents --global`), per the
"Preserve a local integration track" guidance in `docs-site/src/content/docs/development/dogfood-dev-install.md`.

### 7.4 After installing

Hooks and skills are read at session start, so **open a new Codex thread** before
trusting any live observation. Hook trust covers the hook *declaration*, not the files
it runs, so rebuilding `dist/` keeps trust while editing a `hooks/*.json` matcher or
command would require re-approval in Codex. This stack changes no hook declaration.

## 8. c-12 proof — run the INSTALLED binary, not the checkout

c-12 exists because c-7 could be satisfied by a version string. Both probes below must
target `$CACHE\<version>`, never `plugins/codexclaw` in the repo.

```powershell
$cache = "C:\Users\super\.codex\plugins\cache\codexclaw\codexclaw"
$ver = (Get-ChildItem $cache -Directory | Select-Object -First 1).Name
$root = Join-Path $cache $ver
```

### 8.1 The installed session-start hook reports provider mode (#131)

```powershell
node (Join-Path $root "components\provider-bridge\dist\cli.js") hook session-start
```

Must contain `"mode":"provider"` and an `ocx.cmd` path. Before this stack the same
command emits `"mode":"error"` with `"reason":"ocx status exited null"`.

### 8.2 The installed `cxc enable --help` is side-effect free (#132)

Compare the config by hash, not by eye, and check for new `.bak` files:

```powershell
$cfg = "C:\Users\super\.codex\config.toml"
$before = (Get-FileHash $cfg -Algorithm SHA256).Hash
$baksBefore = (Get-ChildItem "C:\Users\super\.codex" -Filter "config.toml.codexclaw-*.bak").Count
node (Join-Path $root "bin\cxc.mjs") enable --help
$after = (Get-FileHash $cfg -Algorithm SHA256).Hash
$baksAfter = (Get-ChildItem "C:\Users\super\.codex" -Filter "config.toml.codexclaw-*.bak").Count
"hash equal: $($before -eq $after); baks added: $($baksAfter - $baksBefore)"
```

Required: `hash equal: True` and `baks added: 0`, with usage text on stdout.

Repeat for `disable --help`, `uninstall --help` and `status --help`. Run these against
the installed payload with the **real** `CODEX_HOME` only after the L3 tests have passed
against a temporary one — before the fix, `enable --help` mutates the real config.

### 8.3 Session identity (#134), opportunistic

```powershell
node (Join-Path $root "bin\cxc.mjs") session current --json
```

From the native cwd of a root desktop thread this must stop returning
`Cannot resolve the native session's working directory.`. It is not part of c-12, but it
is the cheapest live confirmation of L2 and it unblocks SESSION-IDENTITY-01
corroboration for later loops. A subagent thread will still be refused by
`ROOT_SOURCES`, which is correct and unchanged.

## 9. Criteria

**c-7**: every stack layer has green hosted CI, the chain is merged bottom-up into
`dev`, and the release is deployed. Proved by the per-layer §3 records, the §4 merge
log, and the §6 release run URL.

**c-12**: after the local reinstall, the installed payload's session-start hook emits
provider mode and the installed `cxc enable --help` is side-effect free, proven by
running the installed binary. Proved by §8.1 and §8.2, and blocked until §7.1 lands.
