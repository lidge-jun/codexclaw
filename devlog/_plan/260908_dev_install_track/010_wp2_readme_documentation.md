# wp2 — README x3 dev-install documentation (diff-level)

Depends on wp1. Touches `README.md`, `README.ko.md`, `README.zh.md`, `scripts/dev-install.sh`,
and the already-edited `docs-site/` files. No `plugins/codexclaw/` changes in this phase.

**Execution order (AUDIT-A1/A4).** This phase runs AFTER wp3 has merged 92/91/93 and the local
branch has fast-forwarded. All three PRs edit these same READMEs, so every line number below is a
pre-merge reference only. **Re-derive each anchor by content**, not by line: the `</details>`
immediately preceding `## Architecture`, and the literal strings `22개 훅` / `22 个 hooks`.

## Target 1 — MODIFY `README.md`

Insert a new `## Development install (dogfooding)` section immediately AFTER the
`<details>` block that closes the `## Install` section (currently ends line 89, before
`## Architecture` at line 91).

Content contract — every one of these must appear:

1. **What it is.** Installing the working checkout as a real plugin copy from a local
   marketplace rooted at the repo. One sentence naming the two commands.
2. **Why not symlinks.** Codex does not resolve symlinked children of the plugin cache
   version directory reliably; the plugin can silently fail to load. State that
   `scripts/dev-symlink.sh` was retired for this reason and that `dev-install.sh` deletes any
   leftover symlinks it finds.
3. **Setup**, as a fenced bash block:
   ```bash
   codex plugin marketplace add /path/to/codexclaw   # local marketplace, not the git URL
   scripts/dev-install.sh
   ```
   Note that a git-source marketplace pins a commit, so a checkout under active development
   must use the local source.
4. **What `codex plugin add` actually does**: copies the payload into
   `~/.codex/plugins/cache/codexclaw/codexclaw/<version>/` and prunes files that no longer exist
   in the source, which is why a same-version reinstall is a true resync rather than a no-op.
5. **The flags table**:

   | Command | Effect |
   |---|---|
   | `scripts/dev-install.sh` | build components, repoint marketplace if needed, reinstall, prune, run doctor |
   | `scripts/dev-install.sh --no-build` | same without `npm run build`, for skill/hook/doc-only edits |
   | `scripts/dev-install.sh --status` | report source, manifest version, marketplace root, cache roots, symlink count; change nothing |

6. **The update loop**: edit -> `scripts/dev-install.sh` -> open a NEW Codex thread. State
   explicitly that skills, hooks and MCP tools are read at session start, so the current thread
   does not pick up the change.
7. **Hook trust**: trust is content-hashed, so a reinstall whose hook bytes changed makes Codex
   mark them **Modified** and they stop running until re-approved. Unchanged bytes keep trust —
   name `cxc doctor`'s `hook-trust` line as the check.
8. **Verification**, as a fenced bash block with the three commands and what each proves:
   ```bash
   diff -rq plugins/codexclaw ~/.codex/plugins/cache/codexclaw/codexclaw/<version>
   find ~/.codex/plugins/cache/codexclaw -type l | wc -l    # expect 0
   node ~/.codex/plugins/cache/codexclaw/codexclaw/<version>/bin/cxc.mjs doctor
   ```
9. **Returning to the published track**: `codex plugin marketplace remove codexclaw` then re-add
   the git URL.

Also add a `Development install` bullet to the `## Documentation` list pointing at
`https://lidge-jun.github.io/codexclaw/development/dogfood-dev-install/`.

## Target 2 — MODIFY `README.ko.md`

Same section at the same structural position, titled `## 개발 설치 (도그푸딩)`. Not a translation
of the English prose: Korean written per the kwrite register (no translationese, no
`~를 통해`/`~함으로써`, no 첫째/둘째 enumeration). Identical technical content and identical
command blocks.

**Also fix an existing defect**: line 59 says `22개 훅` while the badge on line 18 and the
architecture block on line 108 both say 23. The shipped manifest has 23 hook entries. Change to
`23개 훅`.

## Target 3 — MODIFY `README.zh.md`

Same section titled `## 开发安装（dogfooding）`, same content and command blocks.

**Same defect fix**: line 59 `22 个 hooks` -> `23 个 hooks`.

## Target 4 — VERIFY `scripts/dev-install.sh`

Already written in the preceding turn. Re-audit for:

- `--status` before `--no-build` argument handling (both parsed in the same loop; `--status`
  exits early, so order is irrelevant — confirm)
- the `awk` marketplace-root extraction tolerating a root path containing spaces (current
  `{print $2}` truncates at the first space). This repo's path has none, but the script is
  documented for other checkouts. **Decision: fix it** — use `$0` substring after the first field.
  **BOTH occurrences (AUDIT-A7)**: `scripts/dev-install.sh:47` in `report_status` and
  `scripts/dev-install.sh:78` in the repoint check. Factor them into one `marketplace_root()`
  helper so they cannot drift apart. Leaving line 47 unfixed would make `--status` report a
  truncated root in exactly the case the fix exists for.
- `CXC_CODEX_HOME` naming already avoids `$HOME`/`$CODEX_HOME` repurposing. Confirm.

## Target 5 — docs-site consistency

Already renamed to `development/dogfood-dev-install.md` with the sidebar, `installation.md` and
`troubleshooting.md` updated. Verify with `rg -n 'dev-symlink' docs-site` returning only the
retrospective paragraph inside `dogfood-dev-install.md`.

## Proof for wp2

- `rg -n 'dev-install' README.md README.ko.md README.zh.md` shows the new section in all three
- `rg -n '22개 훅|22 个 hooks' README.ko.md README.zh.md` returns NO matches (AUDIT-A5). The badge
  sync script only rewrites the shields.io URL and `alt=` attribute
  (`sync-readme-badges.mjs:41,48`); it cannot see the prose count, so it exits 0 both before and
  after this fix and proves nothing about it.
- `node plugins/codexclaw/scripts/sync-readme-badges.mjs` exits 0 (no badge drift)
- `npm run gate` OK
- `bash -n scripts/dev-install.sh` and a live `--status` run
