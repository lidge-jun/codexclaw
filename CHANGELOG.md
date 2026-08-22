# Changelog

All notable changes to codexclaw are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.10] — 2026-08-22

### Added

- **A release guide.** The promotion path from `dev` to `main`, what the release
  gate actually checks, and two traps that only show up once: a failed release
  leaves a tag a repository ruleset forbids reusing, and a change to the
  target-branch workflow cannot vouch for its own promotion because
  `pull_request_target` always runs the base branch's copy.

### Changed

- **The build-test guide said "Node 22+".** CI pins 24, and Node 22 does not strip
  TypeScript types without a flag, so `npm test` under it fails on every file at
  once with `ERR_UNKNOWN_FILE_EXTENSION` - a version mismatch that reads like a
  catastrophically broken tree. The guide now names the version, the symptom, what
  the two CI lanes cover, and the defect classes that only appear on a real
  installation rather than a runner.

### Fixed

- **A test harness turned a failed port bind into a routing bug.** The bridge
  server harness fell back to port 0 when `address()` came back unusable, so the
  failure surfaced several assertions later as `fetch failed: bad port`. It throws
  at the bind now, naming what happened.

## [0.2.9] — 2026-08-22

### Changed

- **Two POSIX-only test cases now report as skips instead of silent passes.** They
  bailed with a bare `if (process.platform === "win32") return`, which reports "ok"
  while asserting nothing - the same pattern removed from the pabcd-state and
  cxc-ops suites in 0.2.7. Neither can genuinely run on Windows: process groups and
  a signal-0 liveness probe are POSIX concepts (Windows kills a tree with
  `taskkill /T`, which is covered separately), and Windows has no Unix permission
  bits, so `chmod` cannot build the world-readable file the refusal test needs.

### Fixed

- **A CRLF equivalence test compared a clock.** It invoked the CLI twice and
  compared the outputs verbatim, but the dispatch text embeds a launch id built
  from a second-resolution timestamp, so any pair of calls straddling a second
  boundary differed by one digit and failed for a reason unrelated to line
  endings. It passed locally on both platforms because the two calls usually land
  in the same second; a loaded CI runner is where the boundary gets crossed. The
  launch line is now asserted by shape and normalized before the comparison.

## [0.2.8] — 2026-08-22

### Fixed

- **`cxc receipt test` could not run `npm` on Windows (#40).** The receipt runner
  handed user argv to a shell-less `spawnSync`, so bare `npm` was `ENOENT`
  (PATHEXT resolution is a shell behavior `spawnSync` does not perform) and an
  explicit `npm.cmd` was `EINVAL` (Node refuses shell-less `.cmd` spawns after
  the CVE-2024-27980 hardening). That matters more than a normal CLI papercut:
  `orchestrate C -> D` requires a `testReceiptPath` and names this command as the
  way to produce one, so the documented path to close a work-phase did not work
  on Windows for the most common test command there is.

  The runner now resolves through the shared `win-exec` helper, which routes only
  `.cmd`/`.bat` through a caret-escaped `ComSpec` line and spawns a resolved
  `.exe` directly. `shell: true` was deliberately not used: the command is
  user-supplied, and Node does not escape cmd metacharacters in that mode, so a
  path containing `&` or `^` would become an injection. `shell: false` still
  holds, and the recorded command stays the argv you typed.

- **A Windows PATH was split with the host's separator.** `resolveWindowsCommand`
  used `node:path`'s `delimiter`, which follows the platform it runs on. When the
  win32-only resolution walk was exercised from a Linux runner that is `:`, so a
  `;`-separated Windows PATH collapsed into a single bogus directory entry and
  resolved nothing. The separator is literal now, and a test asserts that the four
  copies of the helper stay byte-identical so they cannot drift apart silently.

## [0.2.7] — 2026-08-22

### Fixed

- **`cxc hooks retrust` could not verify its own write on Windows (#33).** The
  post-write `codex features list` check spawned a bare `codex` with no shell,
  which fails two different ways on a Codex-desktop host: the first PATH match is
  the Store-packaged `WindowsApps\...\codex.EXE`, which is readable, is not a
  reparse point, and still fails `CreateProcess` with `EPERM`; and the npm shim
  beside it is `codex.CMD`, which Node refuses to spawn shell-less after the
  CVE-2024-27980 hardening (`EINVAL`). Verification failed for reasons that had
  nothing to do with the config, so a correct write was rolled back every time.

  The command is now resolved before it is spawned: an explicit `CODEX_BIN` wins,
  then a PATH/PATHEXT walk that skips `WindowsApps` entries, then a `cmd.exe`
  hop with caret-escaped arguments (the only route that starts a Store-aliased
  `codex`). The injected runner seam is unchanged.

- **`cxc doctor` now names the recovery command for untrusted hooks (#33).** On a
  fresh Windows install no `[hooks.state.*]` entry exists yet, so every hook read
  `actual=(none)` with no next step printed. Writing those entries is the host
  Codex binary's job, performed when the user approves the plugin's hooks;
  codexclaw does not forge them, because that would silently bypass the trust
  prompt. Doctor now distinguishes never-trusted from drifted and prints the exact
  `cxc hooks retrust` invocation for each case, including `--bootstrap-ok` only
  when the entries genuinely do not exist yet.

- **The GUI dashboard could resolve your entire home directory as the project
  root.** `resolveProjectRoot` accepted any ancestor holding a `.codexclaw/`
  directory, and `~/.codexclaw` is codexclaw's own global store (recall index,
  skill cache). Any start directory outside a repository therefore walked to the
  filesystem root and answered with `~`, so dashboard reads and writes landed in
  the global store. The home directory is now excluded from that marker, compared
  case-insensitively on Windows where `c:\users\me` and `C:\Users\me` are the
  same directory.

- **Symlink-refusal tests could not run on a stock Windows checkout (#32).**
  Creating a symlink needs Developer Mode or elevation, so the tests died on the
  `symlinkSync` that BUILT their hostile input, never reaching the guard under
  test. Several sibling suites hid the same problem behind a bare
  `if (process.platform === "win32") return`, which passes the whole case while
  asserting nothing. A shared capability probe now gates only the link-creating
  half, and directory cases use junctions - which need no elevation and still
  report `isSymbolicLink()` - so most of these guards are genuinely exercised on
  Windows now. Only the three cases that require a link to a FILE report a skip,
  with the reason stated.

- **The `enforce-target` check blocked the release path it documents.** Every PR
  had to target `dev`, with no exemption for the `dev` -> `main` promotion, so the
  release PR was prefixed `[WRONG BRANCH]` and told to retarget itself to the
  branch it was being promoted from. Same-repository promotions are now exempt;
  a fork branch merely named `dev` is not. The check also failed outright when
  `convertPullRequestToDraft` came back `FORBIDDEN`, which the default token is
  not always granted - a refused draft is now a warning, and a refused
  ready-for-review restoration is reported instead of being announced as success.

- **A photo-only Telegram turn raced a fixed sleep in CI.** The test waited 30ms
  for a getFile + download + agent round-trip, which is enough on an idle machine
  and not on a loaded Windows runner, so the `windows-latest` cell failed
  intermittently on an assertion about work that simply had not finished. It now
  polls for the observable outcome and fails with a named cause on timeout.

## [0.2.6] — 2026-08-18

### Changed

- **The plan-audit round no longer blocks `A>B` (LEAN-REVIEW-01).** The gate
  required a verdict only the `SubagentStop` observer could write, so every reason
  that hook did not fire became a cycle that could never leave A: a matcher that
  missed the runtime's role vocabulary, a reviewer whose closing lines did not
  parse, a reinstall that moved `PLUGIN_ROOT` out from under a live session. The
  documented escape was to feed the hook a hand-written payload — a gate whose
  normal recovery is forging its own input is not a gate.

  The round is now opt-in and the honesty moved to where it can be enforced: no
  round, or a round still in flight, advances on the attest; a round carrying a
  RECORDED verdict is binding, and still refuses an attest that contradicts the
  reviewer, an approval spent across a re-plan, or one spent on a plan whose files
  changed after approval. Verification belongs to whichever phase needs it —
  subagent review lanes at B and C are the intended shape, not A-only review.

### Fixed

- **`cxc doctor` now reports when the installed payload moved (STALE-ROOT-01).**
  `codex plugin add` keeps exactly one version directory per plugin, so a reinstall
  DELETES the path a running session already resolved `${PLUGIN_ROOT}` to. Every
  hook in that session then exits with "Cannot find module" and reports nothing —
  a hook that cannot start also cannot complain. Four reinstalls in one day each
  silently disarmed the sessions that predated them.

  The installer is not ours to change, so doctor names the condition instead of
  hiding it: an `install-root` check FAILs when this payload's version is not the
  installed one, and says the only thing that actually works — restart Codex.

- **hook-trust counted "nothing verified" as PASS.** `diagnoseHookTrust` skips a
  handler it cannot hash, so an empty result set reported `0 hook hash(es)` and a
  green check. It is now a WARN that says nothing was verified. The doctor fixture
  was itself an example: its hook file was `{}`, so the suite had been asserting
  PASS over zero examined handlers.

## [0.2.5] — 2026-08-18

### Fixed

- **A subagent spawned on the v1 surface was given a link to a skill instead of
  the skill.** The spawn hook rewrote `$cxc-dev` into a
  `[$cxc-dev](skill://…/SKILL.md)` link and stopped there, because inlining the
  SKILL.md body was gated on the V2 spawn shape. The reasoning was that upstream
  resolves a mention on v1 and only V2 needs the body carried in the message.
  Upstream does not resolve it — to a child, that link is just text in the
  prompt, and nothing expands it.

  Measured across 120 real v1 children in a single session: 120 received the
  link, 0 received a body, and 51 never opened the file at all. Roughly half of
  every delegated task ran without a line of the discipline it was dispatched
  with, which is what "the subagent answers are useless" actually was.

  Inlining is what delivers a skill, so it is no longer conditional on the
  surface. The "repair a mention, never invent one" rule is unchanged:
  `inlineSkillBodies` returns the message untouched when nothing leaf-safe was
  mentioned, so a spawn that asked for no skills is byte-identical on both
  surfaces. Two older assertions had pinned the caller's text as the TAIL of the
  rewritten v1 message; the attached body now follows it, so both assert
  containment plus the presence of the body.

## [0.2.4] — 2026-08-18

### Fixed

- **A reviewer's verdict never reached the observer, so plan audits could not
  close.** The `SubagentStop` hook was registered with the matcher
  `^(explorer)?$`, which admits only `""` and `"explorer"`. codex-rs normalises a
  child spawned without a role to the agent_type `default`, and every
  `multi_agent_v1` spawn is such a child — that tool's schema has no
  `agent_type` argument at all, so a dispatch cannot label its reviewer. Handler
  selection dropped the event before the hook command was ever spawned.

  0.2.3 aimed one step past this. It read the same symptom as "the v1 payload
  reaches us blank" and widened the matcher to accept a blank type; the payload is
  not blank, it says `default`, so the observer stayed unreachable and the round
  stayed `in_flight` with `A>B` refused. One session spent eight audit rounds on
  it, closing each by hand.

  The failure was silent by construction: the code that records why a verdict was
  dropped lives inside the observer, so a hook that never ran could not explain
  itself. The matcher is now `.*` — the worker exclusion already lives in the
  observer, so the receipt gate and this observer still cannot race over one
  child. A negative lookahead is not available (the runtime's regex engine rejects
  look-around), and enumerating role names would break again the next time the
  runtime adds one. Tests bind the matcher to the runtime's real role vocabulary.

- **The hook dispatcher assigned the observer's result to an undeclared `out`.**
  That throws `ReferenceError` in an ESM module. The observer's write had already
  landed (the call is evaluated before the assignment) and the surrounding catch
  swallowed the throw, so nothing surfaced — but every statement after it was
  skipped, and any real dispatcher error was masked the same way.

- **Drops before the round was identified said nothing.** 0.2.3 made every refusal
  past that point explain itself, which left the earlier ones as the remaining
  blind spot. A child that exits without a parseable sign-off while a plan-audit
  round is in flight, or one naming a launch id nobody minted, now writes a
  diagnostic line to the goalplan ledger. Both stay fail-open.

## [0.2.3] — 2026-08-17

### Fixed

- **A re-plan could strand an audit round forever.** Reported as "the gate
  recorded a verdict but cannot read it": the round was genuinely approved,
  verdict and all, while the session's `planEpoch` had gone null — so the `A>B`
  binding check compared two different plans and refused a cycle that had done
  everything asked of it.

  The observer picked its round by cursor while the gate picked the highest one,
  so a sign-off could land on a round the gate was not watching. It now looks the
  round up by the launch id the sign-off carries; a verdict names its own round,
  and making the observer guess which one is "active" is what let an answer land
  nowhere. `recordVerdict` goes through the same lookup, since fixing only the
  observer would have left the write path guessing.

  Supersession is decided before the CAS now. A verdict arriving for a round that
  has been rolled past is stale, not a second verdict on a live one, and ordering
  rather than status decides it. A re-plan also closes the rounds it invalidates,
  reading the old epoch from the rounds rather than from state — that edge is
  entered from P, and state read at P has already dropped the A-only binding.

  Chat `P>A` mints a plan binding like the CLI does. Only the CLI was wired, so a
  cycle entered from chat reached A with nothing bound and the audit refused to
  open before it could start. The checks are the CLI's rather than a looser copy:
  without the plan-gate and work-phase checks, an attest naming any directory with
  numbered docs would bind through chat what the CLI turns away.

  Underneath all three, the observer used to drop a verdict without a word — which
  is why this took a session to find rather than a minute. Every refusal past the
  point where the round is identified now says why, in the goalplan ledger, and
  stays fail-open: a note that cannot be written must not break a subagent's exit.

## [0.2.2] — 2026-08-15

### Fixed

- **The audit and check edges could be crossed without an audit or a check.**
  0.2.1 closed the three gates around them; these are the two edges themselves,
  and `A>B` was the worst of the four — 124 of 323 crossings under a second, 38%.

  `REVIEW-BINDING-01` — the verdict is written by a SubagentStop observer when a
  reviewer subagent actually ends its turn, and by nothing else. An open/close CLI
  pair was designed first and discarded: closing a round with a verdict you supply
  is the same self-attestation, spelled with two commands. So there is no close
  verb. A round binds to the session, the work-phase, the plan unit `P>A`
  validated, and a nonce minted on that edge — without the nonce, re-planning
  through `A>P` and back leaves an older approval indistinguishable from a current
  one. Sign-off is read only from the closing two lines of the reviewer's final
  message; the child transcript is never scanned, since a `LAUNCH`/`VERDICT`
  example inside the dispatch packet would otherwise sign off on itself.

  `CHECK-BINDING-01` — `C>D` first requires an `exitCode` at all (it was optional,
  so `checkOutput: "passed"` cleared the edge with nothing to say how the check
  ended), and then, on a bound session, a receipt produced by `cxc receipt test`.
  That producer runs the command and records what happened, so the number is
  observed rather than chosen. Identity is captured before and after the run: a
  command that rewrites tracked files produces no receipt, because a check cannot
  certify the tree it just changed. Receipts carry the session and a check epoch,
  so one from an earlier check of the same tree cannot be spent again.

  The shared receipt parser keeps its acceptance rules exactly as they were —
  tightening `kind: "test"` there would have invalidated every existing final-gate
  receipt, since final-gate calls the same function. Only the return shape widened;
  the extra requirements live in `check-gate.ts`, on the one edge that needs them.

  Both gates run before any write, so a refusal leaves state, the PABCD ledger and
  the goalplan untouched. Chat `orchestrate b` remains a human free-pass, as the
  phase contract has always said.

  What this does not do: neither gate authenticates provenance. A dummy reviewer
  that returns PASS is accepted, and a hand-written receipt still parses. They
  refuse the absent, the stale and the reused — not the forged.

### Changed

- Hooks 21 → 22. The new one observes explorer subagent exits and never blocks;
  the worker receipt gate is untouched.

## [0.2.1] — 2026-08-15

### Fixed

- **PABCD cycles could be recorded without happening.** Reported as "five or six
  cycles done as one or two, everything built in B, the audit skipped entirely."
  The first hypothesis was missing hooks; all 21 are registered and the installed
  cache is diff-identical to the repo, so that was wrong. Reading
  `.codexclaw/ledger.jsonl` instead: across 990 gated edges, `A>B` clears in under
  a second 124 times out of 323 (38%), 70 runs show two or more gated edges
  clearing in the same second, and the rate is rising — 20% in June, 23% in July,
  27% in August.

  Three gates now refuse the shapes behind it.

  `CYCLE-COMPLETION-01` — a work-phase can no longer be closed while its tasks are
  open. `advanceWorkPhase()` marked a phase done without reading its tasks and
  `remainingWorkPhases()` only checks phase status, so one D-close could retire a
  phase holding five unfinished units with nothing to show for it. The preflight
  runs before any write, so a refusal leaves state, the PABCD ledger and the
  goalplan untouched, and a bound session whose goalplan cannot be read is
  refused rather than waved through.

  `TRIGGER-AUTHORITY-01` — natural language can enter a cycle from IDLE but can no
  longer move one that is running. A phrase like "구현해" used to write `phase`
  directly, with no adjacency check, no attest and no ledger row, so IDLE jumped
  to B leaving no trace the ledger could show. The loop-arm branch now also runs
  before the trigger branch: "pabcd 여러 번 돌려서 구현해" reads as both, and the
  prompt that most clearly asks for a loop was getting a BUILD directive.

  `SOURCE-DELTA-01` — `B>C` is refused when the source is byte-identical to what it
  was on entry to B, since B is the implementation phase. Reuses
  `captureSourceIdentity()` rather than adding another tree hash. Advisory by
  design: committing work made in P also moves HEAD and passes, and a shared
  worktree attributes another session's edits to this one.

  Two things worth recording. The gate refused the very cycle that built it,
  because the work had been committed before entering B — the same shape observed
  one cycle earlier when nothing stopped it. And the first source-delta test
  failed because writing session state under `.codexclaw/` registered as a tree
  change, so the gate counted its own machinery as implementation work.

  What this does not do: cycle count is set by how many work-phases the roadmap
  lock registers, and no runtime gate can supply that after the fact. These gates
  hold the declared completion conditions and make violations visible.

### Added

- **Enforcement for the release gates.** Two repository rulesets:
  `protect-release-tags` (`v*`: no deletion, no update, no non-fast-forward) and
  `protect-main` (no deletion, no force-push, and eight required GitHub Actions
  contexts). Until now every gate shipped in 0.2.0-beta.1 was an early warning:
  `gh api rulesets` returned `[]`, so nothing stopped a direct push to `main` or a
  moved tag.

  Proven by refusal rather than by reading the configuration back — an unchecked
  commit pushed to a protected branch was rejected with *"8 of 8 required status
  checks are expected"*, and force-push and deletion were rejected by name.

  Scope, stated precisely: rulesets protect refs, not the Releases API, so
  `gh release create` by hand still skips the release gate. What it buys is that a
  published tag can no longer be re-pointed or deleted, which is what 050's rollback
  policy depends on. A repository admin can still edit a ruleset — the cleanup step
  in `devlog/_plan/260815_release_train_production/060_enforcement_layer.md` does
  exactly that, on purpose, so the residual is demonstrated instead of described.

## [0.2.0] - 2026-08-15

The first stable release since 0.1.0, and the first this project can point at and
say what is actually in it.

0.2.0-beta.1 shipped the release train but stayed a prerelease, so the releases
page still advertised 0.1.0 — 25 skills, 12 hooks, 801 tests — as the current
version. This release is that payload, verified and labelled honestly.

### Added

- **Scoped receipt requirements.** A release receipt now declares the release line
  it becomes mandatory in, so the nine MLB 1.0 tracks no longer block a 0.2.x
  release while still blocking the entire 1.0 line — including `1.0.0-rc.1`,
  because an rc of 1.0 owes 1.0 evidence.
- `cxc release classify`, one SemVer parser shared with the release workflow.
- `check-versions.mjs`: the published archive cannot claim a version other than the
  one being released.

### Fixed

- **An empty receipt array verified as ready.** The gate only inspected receipts
  that happened to exist, so a 1.0.0 candidate with `receipts: []` passed. The
  canonical set is now required, and omissions, duplicates and unknown names are
  rejected.
- **`requiredFrom` could have been self-authenticated.** `--candidate` accepts
  arbitrary JSON, so a manifest could have claimed its own evidence was out of
  scope. The canonical policy in code is authoritative and a disagreeing manifest
  is rejected.
- **The workflow's prerelease test was a substring match.** `case $VERSION in *-*)`
  classified the stable `1.0.0+build-with-hyphen` as a prerelease.
- **`--allow-deferred` no longer waives anything.** It would have cancelled out the
  scoping rule: an rc classified `prerelease` would have been handed the flag and
  skipped its due receipts. Exemption comes from scope alone; the flag survives only
  as manifest provenance.

### Notes

- Contents are identical in substance to 0.2.0-beta.1 plus the gate corrections
  above. Everything in that release ships here under an honest stable label.
- `v0.1.0` and `v0.2.0-beta.1` remain published and unmodified; both tags are
  protected by `protect-release-tags`.
## [0.2.0-beta.1] - 2026-08-15

The first release cut by the release train rather than by hand, and the first to
carry the runtime hardening merged as `dac77cc7` on 2026-08-09.

### Added

- **Inventory source of truth.** `plugins/codexclaw/scripts/inventory.mjs` derives
  the shipped skill/hook/component inventory from the payload and gates on SET
  equality in both directions. The previous gate compared cardinality only, so an
  equal-count manifest substitution passed while published docs drifted to 18
  hooks and 25 skills. `inventory.json` stores identities only — no counts, no
  commit SHA — so a number cannot be edited independently of the list it
  summarizes.
- **An executable release gate.** `cxc release init|receipt|platform|tests|
  inventory|verify` assembles a candidate manifest and refuses publication when a
  receipt is missing, stale, or captured on another commit. Schema v2 adds
  `capturedSha`/`capturedAt`, `testSuite`, `inventoryHash`, and `publishedCounts` —
  the last binds the published test badge to the measured suite, so a release
  cannot ship a fresh green run beside a stale public number.
- **A release train.** `release.yml` (tag or dispatch) measures, builds, reads
  exact-SHA CI conclusions, records receipts, verifies fail-closed, publishes with
  a payload archive plus `SHA256SUMS` and the candidate manifest, then re-reads the
  release to confirm the assets exist.
- **Packed-install lifecycle CI.** `packed-install.yml` proves the installed
  product, not just the source tree: an artifact lane (build, dist freshness,
  archive, dispatcher smoke with `cxc` absent from PATH) and a real `codex` lane
  (clean `CODEX_HOME`, `marketplace add --ref <sha>`, retrust, doctor, downgrade to
  v0.1.0, upgrade back with an asserted version change, remove, residue check).
- **macOS CI.** The primary development platform was previously untested.

### Fixed

- Every published inventory number now matches the payload: 28 skills, 21 hooks,
  8 components, 1,659 tests. The READMEs claimed 1,213 tests, the Korean and
  Chinese ones claimed 18 hooks and 27 skills, and the docs site claimed 25 skills.
- The three managed-worktree hooks shipped in the manifest but appeared in no
  published hook table.
- `cxc-ultraresearch` was advertised as a shipping skill across the docs site,
  `structure/INDEX.md` and the skill-hub catalog. It has not shipped since the
  protocol was absorbed into `cxc-search` Tier 3.
- Dead `devlog/_plan/mvp_*` references in `structure/INDEX.md`, and the missing
  `skill-search` component section.
- Committed `cxc-ops` build output had drifted behind source.

### Notes

- PR #1 was squash-merged as `dac77cc7`; the PR head `8f2efab` is not in `main`
  ancestry because GitHub rewrote it. That hardening ships publicly for the first
  time here.
- Marked a prerelease: the packed-install lane is new, and the MLB 1.0 receipts are
  recorded as deferred in the published candidate manifest rather than quietly
  omitted.
## [0.1.0] - 2026-07-06

First public release. 25 skills, 12 hooks, 801 tests.

[Unreleased]: https://github.com/lidge-jun/codexclaw/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lidge-jun/codexclaw/compare/v0.2.0-beta.1...v0.2.0
[0.2.0-beta.1]: https://github.com/lidge-jun/codexclaw/compare/v0.1.0...v0.2.0-beta.1
[0.1.0]: https://github.com/lidge-jun/codexclaw/releases/tag/v0.1.0
# Changelog

## 0.2.7 (2026-08-22)

Windows/Linux cross-platform optimization campaign (11 PABCD cycles,
devlog/_plan/260821_win-linux-optimization). Closes #29, #30, #31.

- attest gates batch every missing field into one rejection; new --attest-file
  for PowerShell (BOM-tolerant); reviewer agent_type wording corrected (#31)
- plan init no longer doubles a supplied YYMMDD prefix and preserves underscores;
  decade docs use 3-digit numbering (#30)
- loop criteria are registrable: init --criteria persists, add-criterion and
  add-work-phase verbs steer additively; goalplan loader names the exact failing
  field instead of "no plan found" (#29)
- scouting bundle: homedir-safe redaction, case- and 8.3-aware path matching
  (P0 security fixes); doctor version regex repaired
- win-exec command ladder across bin, cxc-ops, skill-search, messenger-bridge:
  PATHEXT x PATH resolution, ComSpec route for .cmd/.bat, Store-stub 9009
  handling, venv Scripts\python.exe on win32, taskkill tree kill
- filesystem-based WSL residency detection (no wsl.exe subprocess) surfaced in
  doctor check 9 and the steering lock tier note
- CRLF-tolerant parsing via splitLines copies in six packages; hook-bench runs
  from a real tmpdir; .gitattributes eol policy
- worktree guard covers Remove-Item/ri/del/erase/rd with rmdir semantics
  preserved; UNC errors normalize to one signature
- hooks: lazy-load terminal-only verb modules (-22% win32 overhead, measured)
- CI: platform-smoke real-subprocess verifier, WSL lane (drvfs + ext4),
  autocrlf=true matrix cell, receipts upload
