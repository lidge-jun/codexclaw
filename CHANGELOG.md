# Changelog

All notable changes to codexclaw are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
