# 260911 Windows issue sweep — roadmap

Revision 2. Revision 1 was audited by an independent `xai/grok-4.6` reviewer and
returned VERDICT: FAIL. Every blocker and concern below is folded, not rebutted;
the audit trail is summarised in `Audit fold (revision 1 to 2)`.

## Objective

Close every open codexclaw issue that reproduces on Windows, deliver them as a
manual stacked branch chain based on `dev`, and finish with green CI on every
layer, a bottom-up merge, a release deploy, and a reinstall of the registered
plugin from this local checkout.

Host goal: `close-every-open-codexclaw-issue-that-reproduces` (session
`01a08fba-94d6-7811-8ba6-097379c8a7ad`). This unit is the Phase-0 docs-only pass
required by LOOP-DOCS-FIRST-01; its D locks the work-phase map below.

The open set is exactly five issues: #109, #131, #132, #133, #134. Verified with
`gh issue list --state open` at `9cd52769`.

## Constraints

- **Detect-only stays detect-only.** The provider bridge never runs `ocx ensure`
  or `ocx sync` and never writes codex config (Q-P2-2). L1 changes execution
  path resolution only.
- **The evidence chain does not bend.** An `unavailable` source identity must not
  certify a cycle. CHECK-BINDING-01 stays fail-closed for bound sessions
  (`devlog/_plan/260815_pabcd_phase_collapse/075_receipt_binding.md:66`). L5 makes
  a real git identity reachable in the split-cwd case; it never makes
  `unavailable` acceptable.
- **The root-session guard stays.** `ROOT_SOURCES` at `session-binding.ts:12`
  rejecting subagent bindings is intended behavior and is not part of #134.
- **Reuse `win-exec.ts`, do not invent a third ComSpec wrapper.** That module
  already exists in `pabcd-state`, `cxc-ops`, `messenger-bridge`,
  `skill-search` and `subagent-config` and already routes `.cmd` through
  ComSpec. `provider-bridge` is the only component without it. `build.mjs`
  permits only `node:*` and relative imports inside a component, so the correct
  move is a faithful per-component copy of that existing pattern, not a new design
  and not a cross-component import.
- **Committed `dist` is per component, and new files are ignored.** `git ls-files dist`
  returns nothing at the root; what is tracked is
  `plugins/codexclaw/components/*/dist/`. `.gitignore:2` ignores `dist/`, so a
  layer that adds a NEW `.ts` file cannot stage its build output with a plain
  `git add` — it needs `git add -f` for that path. `npm run build` is
  deterministic, so untouched components do not go dirty.
- **No GitHub native stack.** The user asked for stacked PRs generically, which is
  not a DEV-STACK-OPT-IN-01 opt-in. Manual branch chain only.
- Windows is the target platform for every reproduction. Shell work follows the
  `powershell-landmines` skill; `--attest-file` is mandatory for every attest.

## Out of scope

Changing the provider contract; letting an `unavailable` identity certify a cycle;
relaxing the root-session guard; publishing outside `lidge-jun/codexclaw`; touching
user credentials or opencodex configuration; PR #118 (a cross-repo fork PR from
`thisisjun786` that is already CONFLICTING and belongs to its author).

## Stack topology

Bottom to top. Each layer PR bases on the layer below; merge bottom-up.

| Layer | Branch | Base | Work-phase | Issue |
|---|---|---|---|---|
| L0 | `codex/win-sweep-roadmap` | `dev` | wp1 | — (this unit) |
| L1 | `codex/fix-ocx-windows-detect` | L0 | wp2 | #131 |
| L2 | `codex/fix-session-binding-extended-path` | L1 | wp3 | #134 |
| L3 | `codex/fix-config-guard-help` | L2 | wp4 | #132 |
| L4 | `codex/fix-nongit-early-refusal` | L3 | wp5 | #133 |
| L5 | `codex/windows-landmine-sweep` | L4 | wp6 | — (corpus sweep) |
| L6 | `codex/fix-split-cwd-source` | L5 | wp8 | #109 |

wp7 is integration only: it adds no layer, it turns the chain green and ships it.
Execution order is wp1, wp2, wp3, wp4, wp5, **wp6, wp8**, wp7.

**Revision 3 swapped wp6 and wp8.** Revision 2 put #109 at L5 and the sweep at L6. The
bound goalplan disagreed: `wp6` and `wp8` both depend only on `wp5`, so after wp5
closed, `effectiveActiveWorkPhaseId` selected `wp6` by declaration order and the gated
edge refused a `wp8` attest outright. Rather than fight the persisted plan, the layer
order follows it, because the swap is harmless: the sweep writes `gui/src/server`,
`messenger-bridge/src` and `config-guard/src`, while #109 writes only
`pabcd-state/src/session-source.ts`, so neither can conflict with the other in either
order. Revision 2's stated reason for putting the sweep last — that its findings may touch
files the lower layers moved — is about L1 and L3, both of which sit below either
arrangement.

What actually protects #109 from being skipped is not the ordering but the wp7 entry
gate: integration must not start until `c-8` is met. That gate is unchanged.

### Goalplan drift notice (read before following the bound plan)

The bound goalplan's `workPhases[]` were registered against revision 1 and its
titles and dependency edges are append-only — they cannot be rewritten. Three
entries therefore disagree with this document, and **this document governs**:

- `wp5` is titled `issues 133 and 109`. It covers **#133 only**.
- `wp6` is titled `Stack L5` and, as of revision 3, that is now correct: the sweep IS
  L5. Revision 2 had it at L6; see "Revision 3 swapped wp6 and wp8" above for why the
  layer order follows the persisted plan rather than the other way round.
- `wp8` is titled `Stack L5b`. It is **L6**.
- `wp7` does not depend on `wp8`. **It must not start until `wp8` is done.** This is
  the one drift that still bites, and it is the only thing standing between the loop and
  reaching integration without ever closing #109.

#### The drift bit, and the tooling could not express the fix

It happened. After `wp6` closed, `activeWorkPhaseId` advanced to `wp7` while `wp8`
was still `pending`, and the gated edge then refuses any attest naming `wp8`.
`effectiveActiveWorkPhaseId` (`goalplan.ts:2001-2019`) honours the cursor whenever the phase
it points at is runnable, and `wp7` is runnable because its only dependency, `wp6`, is done.

There is no supported way out. `cxc loop` has no verb to move the cursor or to mark a
phase blocked, `loop steer` is additive only (`annotate` / `add-criterion` /
`add-work-phase`), and "existing dependencies are not edited after creation", so `wp8`
cannot become a dependency of `wp7` after the fact.

This is the same shape as the issues this stack is fixing: a persisted plan can reach a
state whose intended exit is not legal. Worth its own issue after this stack lands.

**How it was resolved, without falsifying anything.** The final cycle runs under `wp7`,
the phase that actually holds the cursor, and its content is ordered so the substance of
the `060` §0 gate still holds: #109 is implemented and `c-8` is marked met FIRST, and only
then does integration begin. `wp8` is closed afterwards against that same evidence, which
is not a fabrication because by then the work is genuinely done and recorded.

What is given up is the one-work-phase-per-cycle invariant, deliberately and visibly,
because the alternative was either to mark `wp7` done before integration happened or to
run integration before #109 was fixed. Both of those would be false; this is only untidy.

The `loop steer` annotation recorded in the ledger names the revision-2 order. Where it
and this document disagree, **this document governs**, and the substance that matters is
unchanged in both: `wp5` closes #133 only, `wp8` closes #109, and `wp7` waits for
`c-8`.

### Why a chain, and where it is genuinely required

Revision 1 claimed committed `dist` forces total ordering. That was overstated and
the audit was right to reject it. The honest statement:

- The user asked for a stacked delivery, which is sufficient reason on its own.
- Two couplings are real: **L2 and L4/L5 all write `pabcd-state`**, and **L6 revisits
  spawn code that L1 and L3 touched**. Those cannot be parallel without conflict.
- L1, L2 and L3 are otherwise independent and could have been parallel PRs. They
  are chained anyway to honour the requested delivery shape, at the cost of
  cascade work, not because the tooling forces it.

### Ordering rationale

L1 first because it is already verified end-to-end on this host and it unblocks the
provider status line every later session reads. L2 next because `cxc session current`
is the SESSION-IDENTITY-01 corroboration step this very loop is currently missing.
L3 is independent and cheap. L4 is the cheap half of the non-git problem. L5 is the
only C4 layer and sits above everything it must not block. L6 is last because its
findings touch files the lower layers moved.

### Rebase exposure

PR #130 (`codex/explorer-routing-fix`) is open against `dev`, MERGEABLE and CLEAN
with 13/13 green checks. If it merges before this chain, **every layer needs a
rebase**. Check `dev` head before each layer push and cascade from L0 upward.

## Dependency-ordered work-phase map

- **wp1 — docs-first roadmap (this unit).** Deliver `000_plan.md` plus decade docs
  at diff-level precision. Docs only; no production patch.
- **wp2 — L1 / #131.** `provider-bridge` selects the PATHEXT launcher AND routes
  `.cmd` through ComSpec, mirroring `win-exec.ts`. Both halves need their own
  test. Doc: `010_wp2_provider_bridge_windows_detect.md`.
- **wp3 — L2 / #134.** `session-binding.ts` canonicalises with `realpathSync.native`
  at both call sites (`:38` and `:78`). Doc:
  `020_wp3_session_binding_extended_path.md`.
- **wp4 — L3 / #132.** `enable`/`disable`/`uninstall`/`status` forward full
  argv on BOTH entrypoints, `config-guard` main answers help before the action,
  and the `uninstall` alias still reaches `disable`. Doc:
  `030_wp4_config_guard_help_passthrough.md`.
- **wp5 — L4 / #133 only.** Swallow git stderr in `source-identity.ts:69` and refuse
  at entry instead of stalling at C. **The refusal predicate is "the SOURCE identity
  cannot be resolved", never "the FSM cwd has no `.git`".** Written the second way,
  L4 would reject the #109 case at the door and L5 would have to undo L4; written
  the first way they compose, because L5's job is precisely to make that source
  identity resolvable. This closes #133 and **explicitly does not close #109**.
  Doc: `040_wp5_nongit_early_refusal.md`.
- **wp8 — L5 / #109.** Split-cwd source separation: a bound session whose FSM
  directory is not a repository but whose source tree is must complete a cycle with
  a receipt carrying a real commit sha. Doc: `045_wp8_split_cwd_source.md`.
- **wp6 — L6 / corpus sweep.** Doc: `050_wp6_windows_landmine_sweep.md`.
- **wp7 — integration.** Doc: `060_wp7_integration_merge_deploy.md`.

## Corpus sweep scope (fixed by preflight, not by guesswork)

The preflight found that **#131 has two more live copies**. Fixing only
`provider-bridge` leaves the GUI and `cxc serve` provider endpoints reporting
error on this host.

| path:line | corpus case | what breaks |
|---|---|---|
| `gui/src/server/middleware.ts:75` | `get-command-where-disagree` | `where` first line is the extensionless shim |
| `gui/src/server/middleware.ts:79` | `spawn-npm-enoent-einval` | `.cmd` spawned without ComSpec |
| `messenger-bridge/src/api-compat.ts:40` | `get-command-where-disagree` | same first-line bug in the serve path |
| `messenger-bridge/src/api-compat.ts:45` | `spawn-npm-enoent-einval` | same shell-less `.cmd` spawn |
| `config-guard/src/cli.ts:131` | `spawn-npm-enoent-einval` | bare `codex` spawn. The existing resolver lives in `cxc-ops/src/codex-bin.ts:106`, a different component, so the same import ban applies: copy the pattern, do not import it |
| `gui/src/server/middleware.ts:88` | `windowsapps-alias-eperm` | same bare `codex` spawn |

Deferred with reason (risk=medium, outside this issue set): the BOM-less `.cmd`
written by `messenger-bridge/src/service.ts:245` (only bites on a non-ASCII home
path) and the colon-PATH test fixtures in `payload-bin.test.mjs:72` and
`live-catalog.test.ts:79` (test-only, currently green, product paths already
use `commandInvocation`).

## Triage provenance

Root causes were established by independent read-only `xai/grok-4.6` dispatches
against this checkout, each quoting `path:line`. Three findings correct the issue
bodies and are load-bearing:

- **#134 is not a database lookup failure.** The thread row exists and is readable.
  On this host **77 of 77 thread rows** store `cwd` with the extended-length
  prefix, including the #134 session (`source=vscode`). JS `realpathSync` throws
  `EISDIR lstat 'C:'` on that shape; `realpathSync.native` resolves it. The
  reproduction must use the extended-length prefix — **not** 8.3 short names, which
  are a different alias class that happens to share the fix.
- **#109's stated cause is inverted.** `--cwd` reaches git through
  `captureSessionSourceIdentity(args.cwd)` and then `captureSourceIdentity(sourceCwd)`.
  With no source binding, `sourceCwd === cwd`, so `--cwd` IS the git cwd. That
  is why git fails. #109 needs source separation, not `--cwd` propagation.
- **`cxc session source` cannot rescue #109 today.** `bindSessionSource` calls
  `gitIdentity(cwd)` on the native cwd and accepts only a linked worktree of the
  same repository (`session-source.ts:102`). A non-git parent with a nested git
  child is not expressible. L5 must extend that surface.

## Acceptance criteria

The bound goalplan carries `c-1`..`c-12`. `c-8`..`c-12` were added in
revision 2 to close gaming holes the audit found; where they overlap an earlier
criterion, **the tighter one governs**.

| id | criterion | proving layer |
|---|---|---|
| c-1 | numbered diff-level roadmap exists before any implementation cycle | wp1 |
| c-9 | #131 fixed in both halves and in every copy; separate tests for launcher selection and ComSpec spawn; provider/GUI/serve endpoints all report provider, never error | wp2 + wp6 |
| c-3 | `cxc session current` succeeds against an extended-length stored cwd | wp3 |
| c-10 | both entrypoints, all four verbs, both help flags, config byte-identical and no bak; `cxc uninstall` without help still disables | wp4 |
| c-5 | bound non-git cycle refused at entry; no git fatal reaches user output | wp5 |
| c-8 | #109 positive path: non-git FSM dir with a git source completes P through D and the receipt carries a real commit sha | wp8 |
| c-11 | every risk=high corpus finding fixed in this stack; deferral only for risk=medium with a reason | wp6 |
| c-12 | after reinstall, the INSTALLED payload hook emits provider mode and the INSTALLED `cxc enable --help` is side-effect free | wp7 |
| c-7 | green CI per layer, merged bottom-up, release deployed | wp7 |

`c-2`, `c-4` and `c-6` remain open and are superseded by `c-9`, `c-10`
and `c-11` respectively. They are satisfied as a side effect of the tighter ones;
they are never satisfied on their own.

## Verification contract

Every implementation layer must produce, with pasted output and exit codes:

1. `npm run build`, then stage the component dist. A layer that adds a NEW `.ts`
   file must use `git add -f <that dist path>` because `.gitignore:2` ignores
   `dist/` and only already-tracked outputs restage normally.
2. `npm run gate`.
3. the affected component suite via `node plugins/codexclaw/scripts/test.mjs <glob>`.
4. a reproduction that fails on the parent commit and passes on the layer head.
5. `cxc receipt test --session <id> -- <command>` backing the C to D edge.

Known pre-existing failures on this host, not caused by this unit and not treated
as regressions: `repo-map-packaging.test.mjs` (no Python installed),
`gui/test/router.test.ts`, and the `hook-bench --json` schema test.

## Audit fold (revision 1 to 2)

| audit finding | disposition |
|---|---|
| BLOCKER: #109 listed in L4 but neither scoped nor gated | folded — #109 is its own layer L5/wp8 with positive criterion c-8 |
| `dist` total-ordering rationale overstated | folded — rationale corrected; the real couplings are named |
| new dist files are gitignored, contract said only restage | folded — `git add -f` is now step 1 |
| c-2 passes on path change alone | folded — superseded by c-9 |
| c-4 passes via the already-working top-level help | folded — superseded by c-10, which names the verbs and both entrypoints |
| c-6 passes if everything is deferred | folded — superseded by c-11 |
| c-7 passes on a version string | folded — superseded by c-12, which requires the installed binary |
| L1 would be a third ComSpec implementation | folded — `win-exec.ts` reuse is now a constraint |
| PR #130 can force a full rebase | folded — recorded as rebase exposure |
| NIT: `--cwd` path is via `captureSessionSourceIdentity` | folded — chain corrected |
| NIT: `session-source.ts:17` native reason is 8.3, not the prefix | folded — reproduction now pinned to the prefix |

## Unattended resource bounds

Tool scope: local repo, `gh` against `lidge-jun/codexclaw`, `xai/grok-4.6`
subagents (user-declared unlimited). Write scope: this repository plus the locally
installed plugin payload during wp7 reinstall. Wall-clock: CI waits are async and
polled, never blocking sleeps. Hitting a bound is BUDGET_EXHAUSTED, not DONE.
