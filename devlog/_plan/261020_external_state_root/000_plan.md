# External state root: keep codexclaw state out of enterprise repos

In a repository that does not belong to Jun, codexclaw currently leaves two kinds of trace in the checkout: `devlog/_plan` and `devlog/_fin` (plain, committable files) and the durable half of `.codexclaw/` (ledgers, goalplans, evidence), which is gitignored but dies with the worktree. This unit adds one resolver that decides where durable state lives, routes every durable read and write through it, and ships the CLI to inspect, migrate and sync that state. Jun's own repositories keep today's in-repo layout.

Reader: the maintainer reviewing the three PRs. Familiarity with pabcd-state, the evidence guard and the goalplan substrate is assumed.

Class: C4 (cross-cutting state-layout change, touches a security guard).

## Loop contract

- Archetype: satisfy-spec HOTL (Jun, 2026-10-20, "HOTL 제대로"). No questions; decisions are recorded here and in PR bodies.
- Goal: in non-allowlisted repos nothing codexclaw-related becomes committable, while devlog and the durable ledger accumulate in Jun's private storage, survive worktree removal and can be synced across Macs.
- Non-goals: changing guard decisions other than the evidence-root location; moving volatile state; symlinks; migrating any real user state; touching ~/.codex or Codex config.
- Verifier: per work-phase focused tests, then `npm run build`, full `npm test` (TAP totals) and `npm run gate` before every PR; sol code review, sol security review of the evidence guard change, re-review after fixes.
- Stop: three PRs open against `dev`, each reviewed and green with fresh evidence.
- Review independence: main is claude-opus-5-5; reviewers are gpt-6.1-sol in fresh contexts (argon is not in this host's catalog).

## Work-phase map

| WP | Doc | Output | PR |
|---|---|---|---|
| wp1 | 010 | `state-root.ts` resolver, durable/volatile consolidation, evidence guard on the resolved root, `none` no-op, dist | PR1 |
| wp2 | 020 | `cxc state path/sync/migrate`, `cxc devlog path`, plan init + plan-gate + gate.mjs + both dispatchers, devlog warning | PR2 |
| wp3 | 030 | skill/reference/structure wording that points at `cxc devlog path` and the resolved evidence root | PR3 |

Each PR is rebased on origin/dev before opening; the reviewer bot may merge PR1 before PR2 is opened.

## Design decisions (made autonomously under HOTL; rationale kept here)

D1 Modes. `repo` = today (durable in `<cwd>/.codexclaw`, devlog in `<cwd>/devlog`). `local` = same locations, but `.codexclaw/` and `devlog/` are added to the repository's shared `info/exclude` so nothing appears in `git status`. `external` = durable in `<base>/<projectId>/state`, devlog in `<base>/<projectId>/devlog`. `none` = durable writes refused with a clear error, readers see empty state, hooks keep running.

D2 Precedence: env `CODEXCLAW_STATE_MODE` > config `state.projects["<host>/<owner>/<repo>"]` > config `state.mode` (when not `auto`) > auto-detect. Auto: no origin or not a git repo → `repo` (today's behaviour for scratch dirs); origin owner in `state.ownerAllowlist` (default `lidge-jun`, `goat-si`, `lidge-ai`, the owners of the remotes visible from `gh api user/orgs` that Jun works in) → `repo`; otherwise `external`, with legacy in-checkout durable state reported as a migrate warning (004 #2).

D3 Config lives in the existing user config `$CODEXCLAW_HOME/config.json` (default `~/.codexclaw/config.json`) under a `state` key, read with the same rule as `agent-thread-permissions.ts`: a config file that resolves inside the checkout is ignored, so a repository cannot pick its own state root. `CODEXCLAW_HOME` and `CODEXCLAW_STATE_ROOT` must be absolute.

D4 Base root: `CODEXCLAW_STATE_ROOT` > `state.root` > `$CODEXCLAW_HOME/projects` > `~/.codexclaw/projects`. The base may itself be a private git repo; `cxc state sync` operates on it.

D5 Project id: the origin URL normalized to `host/owner/repo` (ssh, scp-like and https forms, credentials stripped, `.git` suffix dropped, lower-cased) and rendered as `host__owner__repo`. Without an origin: `local__<name>-<sha256(realpath(git common dir))[:12]>`, so every worktree of one repository maps to one id; outside git: `path__<name>-<sha256(realpath(cwd))[:12]>`. The git config is parsed from disk (worktree `.git` file → `commondir` → `config`), with no subprocess in the hook path.

D6 Partitioning. One state directory per project; partitioning comes from keys that already exist: `goalplans/<slug>/`, `evidence/<session>/`, `interviews/<session>.jsonl`, and session ids inside `ledger.jsonl`. A per-branch partition was rejected: agents routinely switch or create branches mid-session, and a receipt written before `git checkout -b` would then be invisible to the guard after it. Worktree removal survival comes from the root being outside the checkout and keyed by origin.

D7 Classification (verified against the code, see 010). Durable: `ledger.jsonl`, `goalplans/`, `evidence/`, `evidence-attempts/`, `evidence-unrecordable/`, `interviews/`, devlog. (`interview/` and `plan/` were reclassified volatile in 004 #7.) Volatile: everything else, including `attest.json`, which the spec listed as durable: no code reads it implicitly, it is a scratch input that each transition overwrites, and its content is persisted into `ledger.jsonl`; moving it would only change instructions agents already follow.

D8 No symlinks. The evidence guard keeps its four properties (lexically inside the root, leaf not a symlink, realpath inside the realpath of the root, regular non-empty file) but the root becomes `durableDir/evidence`. A receipt under the legacy in-checkout evidence directory does not count in external mode.

D9 Messages. A helper renders durable paths relative to cwd when they are inside it (repo/local: byte-identical to today's `.codexclaw/...` text) and absolute otherwise.

D10 `none` mode trade-off: gates that require durable evidence (goalplan C>D receipts, subagent evidence) cannot be satisfied; `cxc state path` says so. It is for repos where gated loops are not run.

D11 Sync: `git pull --rebase --autostash` (when an upstream exists) → `git add -A` + commit if dirty → `git push`. A failing pull aborts the rebase and stops with a message; nothing is forced. The first sync writes `.gitattributes` (`*.jsonl merge=union`, so two Macs appending to one ledger do not conflict) and `.gitignore` (`*.tmp`, goalplan lock dirs) if missing.

D12 Migrate: dry-run by default, `--apply` to move; per file, an identical destination counts as done (idempotent), a different one is a reported conflict and both copies stay; symlinks and git-tracked files are skipped and reported; git history and the index are never touched. Refused when the configured mode is `repo`.

## Scope

IN: `plugins/codexclaw/components/pabcd-state/src/**` (+ dist, tests), `subagent-config/src/final-gate-guard.ts`, `cxc-ops/src/reset.ts` (+ resolver copies with a parity test), `plugins/codexclaw/scripts/gate.mjs`, `plugins/codexclaw/bin/cxc.mjs`, `bin/codexclaw.mjs`, skills/structure docs (wp3), CHANGELOG.
OUT: volatile state locations, `rules/`, recall/bg-wake/messenger-bridge storage, Codex config.



## wp1 D summary (2026-10-20)

Conclusion: the resolver and the durable/volatile split are in place (PR1). Every durable read and write in pabcd-state, subagent-config's final-gate guard and cxc-ops reset goes through `state-root.ts`; repo mode paths and messages are byte-identical to before, which the unchanged existing suite confirms.

Evidence: clean worktree at e212079f — focused suites 2525 tests / 2522 pass / 0 fail; full `npm test` 3790 / 3776 pass with only the failures origin/dev shows in the same environment (3771 / 3757: messenger-bridge timer tests, the mcp staleModel timeout, the gui router file); `npm run gate` OK. Hook bench: no change beyond run-to-run noise (two paired runs, deltas of ±5 ms in both directions).

Reviews (gpt-6.1-sol, fresh contexts): code r1 FAIL (`..name` containment, disabled roots trusted, git quoting) → r2 FAIL (receipt cleared before root validation, line continuations) → r3 FAIL (comment ending in a backslash) → r4 PASS (128 configs × 5 copies against `git config`). Security r1 FAIL (containment, disabled roots, exclude symlink, post-check swap, 32-bit id collision) → r2 FAIL (receipt deletion) → r3 PASS.

What did not go well: the first file-based git parser was naive about git's quoting, comments and continuations and took three review rounds; the hypothesis that a regex per line is enough died. Evidence the direction is wrong would be a real config the resolver reads differently from `git config --get`; `cxc state path` shows the origin key so such a case is visible.

Deviations from 010: the SessionStart legacy-state warning was dropped (SessionStart emits nothing today and the prompt budget is tight); `cxc state path` and `plan init` carry it. `cxc-ops/doctor.ts` was left unchanged (it checks the volatile directory only).

Residuals accepted: same-user directory swaps can race the resolver's checks (no fd-pinned mkdir in Node); durable readers other than the evidence guard and receipt producers do not consult the disabled flag.

Next: wp2 per 020.



## wp2 D summary (2026-10-20)

Conclusion: `cxc state path/sync/migrate` and `cxc devlog path` ship in PR2, with `plan init`, the P>A gate messages and `gate.mjs` reading the devlog through the resolver. Rebuilt on origin/dev after #295 was squash-merged; also carries the Windows 8.3 short-path fix CI found on #295 after merge.

Evidence (clean worktree, 71100fcd): focused suites 2484 / 2481 pass / 0 fail; full `npm test` 3807 / 3793 pass with only the environment failures origin/dev shows locally (#296); `npm run gate` OK.

Reviews (gpt-6.1-sol, fresh contexts): code r1 FAIL (4), data-integrity r1 FAIL (9), r2 FAIL/FAIL (linked policy files, cross-drive gate path, CRLF duplicates), r3 FAIL/FAIL (legacy autocrlf base), r4 FAIL (text=auto rewrote binary evidence), r5 FAIL (UTF-8 compare equated different binaries), r6 PASS.

What did not go well: line-ending handling took four rounds; each fix (`* -text`, `text=auto`, UTF-8 compare) solved one case and broke another. The hypothesis that a repo-wide attribute could fix CRLF died; the working rule is byte-exact everywhere except the two file types codexclaw writes as LF text.

Residuals: a new 100755 file arrives as 0600 (state holds no executables); migrate's lock is not honored by hook writers (IDLE check bounds it); one goalplan must not be driven from two machines at once.


## wp3 D summary and unit closure (2026-10-20)

Conclusion: the unit is delivered. #295 (resolver, durable/volatile split, evidence guard), #298 (state path/sync/migrate, devlog path, plan init and gate via the resolver), #300 (Windows path spelling; tracked files never moved), #303 (CI follow-up: win32 test expectation, inventory, sync applies remote edits to untouched files) and #304 (docs and skills; manual migration).

What did not go well: every git-facing piece took several independent review rounds (git config parsing 4, sync line endings 6, tracked-file matching 4), and two regressions (#299, #302) only showed on the Windows CI legs after merge, because macOS could not reproduce 8.3 names and the crlf leg was never run locally. The hypothesis that died: that local macOS runs plus reviewer simulation are enough for path and line-ending code. Evidence that would refute the current direction: another Windows-only failure in state-cli after #303; running the suite with `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.autocrlf GIT_CONFIG_VALUE_0=true` locally is now part of the check for this area.

Residuals and follow-ups: same-user directory swaps can race the resolver (no fd-pinned mkdir); durable readers other than the evidence guard ignore the disabled flag; a writer rewriting the same non-ledger file between sync's final re-check and rename; migrate's lock is not honored by hook writers. Issues: #296 (local env test failures), #297 (l1-injections path-length budget), #299 and #302 (fixed), #301 (inventory drift per PR).
