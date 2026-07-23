# 010 — WP1: payload-resident cxc dispatcher + resolvable injected commands

Goal: on a payload-only install, every command the plugin tells the model to
run resolves. Two mechanisms: (1) ship a dispatcher inside the payload, (2)
make every emitted directive render an invocation that exists on that machine.

A-round synthesis (Sol reviewer, GO-WITH-FIXES blockers=4, all accepted):
H1 per-emit-site helper not string replace; H2 rewrite ordering vs the
`--session` regex; H3 plugin.json version bump + upgrade path for new `bin/`;
H4 `scan record` subcommand (double write). M1 dist mechanics, M2 parity
test folded below. Extra emit site found: idle-edit.ts:33.

## File change map

### NEW `plugins/codexclaw/bin/cxc.mjs`

Thin dispatcher mirroring root `bin/codexclaw.mjs` but payload-relative:
`here = dirname(fileURLToPath(import.meta.url))`; component CLIs at
`join(here, "..", "components", "<name>", "dist", "cli.js")`. Command set is
the subset that exists payload-only:

- `orchestrate|freeze|metric|divergence|loop|goalplan|plan` → pabcd-state cli
- `doctor|reset|hooks` → cxc-ops cli
- `enable|disable|uninstall|status` → config-guard cli
- `chat|memory` → recall cli, `skill` → skill-search cli
- `subagents` → subagent-config cli, `serve|service` → messenger-bridge cli
- `provider` → provider-bridge cli (detect)
- `map` → repo-map script via the same bootstrap ladder (import the ladder
  logic; see "shared ladder" below)
- `gui` → payload gui/ exists but node_modules may not; keep the existing
  install hint behavior.
- `help` → same top-level help but headed `cxc (payload dispatcher)`.

Implementation: to avoid a 400-line copy, extract the dispatch table from
`bin/codexclaw.mjs` is NOT feasible (root bin is outside payload). Instead the
payload bin is a standalone ~120-line delegator: `spawnSync(process.execPath,
[componentCli, ...argv], {stdio:"inherit"})` per family, plus the repo-map
ladder imported from a new shared module
`plugins/codexclaw/components/cxc-ops/dist/repomap-ladder.js` (move
`selectRepoMapCommand`/`repoMapVenvPython` from root bin into cxc-ops src,
re-export from root bin for back-compat with
`plugins/codexclaw/test/repo-map-packaging.test.mjs` imports).

Root `bin/codexclaw.mjs` MODIFY: delegate to the payload bin? No — keep root
bin as-is except importing the relocated ladder helpers, so local dev behavior
is byte-identical. (Two dispatchers, one ~120-line and one existing; the new
packaging test pins their command sets equal.)

### NEW `plugins/codexclaw/components/cxc-ops/src/cxc-resolve.ts`

Single source of truth for "how do I say cxc on this machine":

```ts
export function payloadRootFromModule(moduleUrl: string): string
  // dist/<file>.js -> ../../.. == payload root (components/<c>/dist)
export function cxcOnPath(env = process.env): boolean
  // scan PATH entries for an executable `cxc` file (no spawn)
export function cxcInvocation(moduleUrl: string, env?): string
  // "cxc" when on PATH, else `node "<payloadRoot>/bin/cxc.mjs"`
```

**H1 (blocker fold): NO free-text rewrite function.** A `"cxc "` string
replace corrupts noun-phrase emits ("owns cxc orchestration",
spawn-attach-hook.ts:310/318), prohibition lines, messenger-bridge output
("cxc service: not installed."), and Discord `!cxc` chat commands; recall
emits bare (un-backticked) commands so no delimiter rule is safe. Instead:
each COMMAND emit site builds its command string through the helper —
`const CXC = cxcInvocation(import.meta.url)` and template it:
`` `${CXC} orchestrate status --session <id>` ``. Non-command prose keeps the
literal word `cxc`. Table-driven tests assert (a) command lines resolve, (b)
the counterexample strings above are byte-identical after the change.

**H2 (blocker fold): ordering vs the session-append regex.** hook.ts:723-724
rewrites `/cxc orchestrate (\w+)/` to insert `--session`. Fix: build
STOP_NEXT_COMMAND already parameterized by `CXC` at emit time, and update the
session-append regex to match the invocation-agnostic form
`/ orchestrate (\w+)/` anchored to the known command template (or insert the
session id in the template function itself, removing the regex). Regression
test: degraded-mode stop block still carries `--session <id>`.

Placement decision (A2 round, resolved): cxc-ops, single copy, no duplicate
fallback. Cross-component dist imports are established precedent
(messenger-bridge api-compat.ts:17-19 imports subagent-config/provider-bridge
dist) and runtime-only — build.mjs strips types per file with no import
resolution, so COMPONENTS order cannot break it; cxc-ops src imports nothing
from other components, so no cycle.

**B1 (A2 blocker fold): deterministic resolution seam.** `cxcInvocation`
reads env override `CODEXCLAW_CXC` FIRST (test seam + power-user override),
then PATH scan, then payload-bin fallback. All existing literal `cxc ...`
test assertions become PATH-dependent otherwise; the full node --test run
sets nothing, so tests that assert literal `cxc` MUST pin
`CODEXCLAW_CXC=cxc` (or call with injected env) in setup. Affected files
(enumerated, A2): pabcd-state `hook-continuation.test.ts`
(292/298/303/310/358/547-553/585/597 — 358/585 reach handleStop which has no
deps param, hence the env seam), `hook.test.ts` (277-278),
`idle-edit.test.ts` (27); recall `hook.test.ts` (54-55/66/77-78),
`memory-search.test.ts` (107); cxc-ops `map-affordance.test.ts`
(59-60/68-69/83-84). Byte-identity test hook-continuation 541-543 stays green
because resolution is deterministic per-process.

### MODIFY emit sites (wrap final emitted strings)

- `components/pabcd-state/src/hook.ts`: LOOP_ARM_DIRECTIVE (343-363),
  STOP_NEXT_COMMAND + buildStopBlock (686-724), goal-idle continue (787-803),
  RESCAN_REINJECT_DIRECTIVE (968) — convert the command lines to
  `CXC`-templated builders applied at emit time (handlers), so the PATH check
  happens per-machine and constants-only tests stay stable.
- `components/pabcd-state/src/idle-edit.ts` (33): IDLE-EDIT advisory
  `cxc orchestrate status` (reviewer-found extra site).
- `components/pabcd-state/src/goal-gate.ts` deny remedies.
- `components/cxc-ops/src/map-affordance.ts` (85, 105, 138, 160): banners.
- `components/recall/src/hook.ts` (71-72, 191-250) recall injections.
- `components/skill-search/src/preamble.ts` (18) external-skill preamble.
- `components/subagent-config/src/minds.ts` effort hint; spawn-attach hook if
  it emits `cxc `.
- SKILL.md files: NOT rewritten (static text). Instead the SessionStart
  banner (map-affordance session binding, line ~137) appends one line when
  cxc is NOT on PATH: "`cxc` is not on PATH here; wherever docs say `cxc`,
  run: node "<payloadRoot>/bin/cxc.mjs" ...". One line, only in the
  degraded case.

### FIX `cxc scan evidence` phantom command (H4 fold: subcommand is the ONLY option)

`RESCAN_REINJECT_DIRECTIVE` (hook.ts:968) tells the model to run
`cxc scan evidence`, which exists nowhere — and reviewer verified
`appendInterviewEvent` (state.ts:257) has ZERO production callers and nothing
increments `tracker.scanRounds`, so the I→P readiness soft-gate
(interview.ts:297) is only passable via `override:true` today. Fix: add a
`scan` kind to pabcd-state cli.ts — `scan record --session <id>
[--contradictions N] [--high N]` — that does BOTH writes:

1. Ledger: append a `scan_completed` InterviewEvent (shape state.ts:237-244)
   with `roundId` from `computeNextScanRound(state.interview)`
   (rescan-coordinator.ts:107-113).
2. Tracker via `writeState`: if `state.interview === null`, init the empty
   tracker shape (interview.ts:167) first; then `scanRounds += 1` AND
   `lastScanRoundId = roundId` (B2 fold: both counters move together or they
   drift; interview.ts:69,71).

Update the directive text to the real command; route `scan` in BOTH
dispatchers. Tests: null-tracker init path, roundId derivation, both-counter
update, ledger append, gate passes after 1 record.

### Tests (NEW/MODIFY)

- NEW `plugins/codexclaw/test/payload-bin.test.mjs`: (1) payload bin exists,
  executable header; (2) spawn `node plugins/codexclaw/bin/cxc.mjs help` exits
  0; (3) command-set parity with root bin table; (4) payload-only sandbox sim:
  copy payload to tmpdir, `orchestrate status` + `P` + attested edge with
  `env PATH` stripped of repo bin — asserts CR-B end-to-end.
  Parity (M2 fold, A2-resolved): EXPORT a verb→component table from each
  dispatcher and assert set equality. This is a behavior-identical additive
  export to root bin (precedent: it already exports selectRepoMapCommand for
  tests) — "root bin as-is" means dispatch behavior unchanged, exports may
  grow. Sandbox uses `cp -R` of the payload dir (L1: remote-install copy
  semantics are an assumption; local plugin add symlinks per top-level entry).
- NEW `components/cxc-ops/test/cxc-resolve.test.ts`: PATH detection, payload
  root derivation, rewrite table incl. counterexamples.
- MODIFY component tests covering changed emit sites (pabcd-state hook tests,
  recall hook tests, map-affordance tests): directives on a cxc-on-PATH
  machine unchanged; degraded mode rewrites correctly (inject fake env/deps).
- Existing suites must stay green: `npm test`, `node plugins/codexclaw/scripts/gate.mjs`.

### Build/dist

M1 fold — exact mechanics: `npm run build` recompiles COMPONENTS src→dist;
root `.gitignore` ignores `dist/` wholesale so every new/changed dist file
needs `git add -f`; `plugins/codexclaw/test/packaging.test.mjs` ENTRYPOINTS
list must gain any new runtime entry; `bin/cxc.mjs` is plain .mjs OUTSIDE the
build (no dist), so the new payload-bin test is its only freshness contract.
Constraint (L2): WP1 must NOT touch any `hooks/*.json` (hook content-hash
re-approval) — dist-only changes ride the existing trust.

### Manifest + version (H3 fold)

`.codex-plugin/plugin.json` has no file whitelist; payload = whole
`plugins/codexclaw/` tree, so `bin/` ships for fresh installs. BUT the local
install cache (`~/.codex/plugins/cache/codexclaw/codexclaw/0.1.0/`) symlinks
per TOP-LEVEL entry at install time — an added `bin/` dir does NOT appear in
existing installs. Therefore bump 0.1.0 → 0.1.1 across ALL version carriers
(B3 fold, 12 sites): `.codex-plugin/plugin.json`, root `package.json`, 8
component `package.json`s, `gui/package.json`, PLUS the hardcoded
`SERVER_INFO.version` in `subagent-config/src/mcp.ts:23` (src change →
rebuild dist → `git add -f`). WP2 README notes the upgrade path
(`codex plugin marketplace upgrade codexclaw` or re-add).

## IN/OUT

- IN: files above; OUT: root bin behavior change, npm packaging, GUI deps,
  SKILL.md mass rewrite, ~/.codex config.

## Accept criteria

- Payload-only sandbox: `command -v cxc` fails, yet SessionStart banner names
  the working invocation and `node <payload>/bin/cxc.mjs orchestrate status/P/A`
  all exit 0 (CR-B).
- All rewrite counterexamples pass; suites + gate green (CR-C).
