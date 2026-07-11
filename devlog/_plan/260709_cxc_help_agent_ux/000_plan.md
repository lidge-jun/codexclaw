# 000 — cxc Help + Agent UX Contract

**Unit:** `260709_cxc_help_agent_ux`
**Created:** 2026-07-09
**Work Class:** C3 (CLI-wide UX contract across top-level dispatch, PABCD orchestrate CLI, tests, and source-of-truth docs)

## Loop Spec

- **Loop archetype:** Spec-satisfaction. Done is defined by deterministic CLI output contracts and tests, not by an open-ended "better help" score.
- **Trigger:** User observed `cxc orchestrate --help` being parsed as an unknown verb and asked to broaden `cxc --help` into production-grade, agent-friendly help.
- **Goal:** Make `cxc` and `cxc orchestrate` self-explaining enough that a human or agent can recover the next valid command without reading source.
- **Non-goals:** No shared help framework for every component CLI in this pass; no wholesale rewrite of subcommand parsers; no state mutation during help rendering.
- **Verifier:** `npm run build`; focused `node --test plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts plugins/codexclaw/test/cli-usage.test.mjs`; final `npm test` if the focused gate is clean.
- **Stop condition:** Help commands exit 0 with useful output, invalid commands emit actionable hints, and every `cxc orchestrate ... --session <id>` path that can resolve a session surfaces the current phase before or alongside the result, including `reset` and already-IDLE reset no-op output.
- **Memory artifact:** This plan plus the follow-up implementation/check records in `devlog/_plan/260709_cxc_help_agent_ux/`.
- **Expected terminal outcome:** DONE.
- **Escalation condition:** If adding phase context requires changing FSM semantics, stop and re-plan; this unit should stay output/rendering-only except for existing legal transitions.

## Interview Decision

Chosen scope: **CLI-wide Contract**. This means top-level `cxc --help/help`, focused `cxc orchestrate --help`, phase-aware orchestrate output when `--session` is explicit, tests, and source-of-truth docs. The broader shared help-renderer framework and a machine-schema-first redesign are deferred.

## Current Signals

- `bin/codexclaw.mjs:255-336` treats `help` as the default branch and prints a single one-line command list.
- `bin/codexclaw.mjs:271-294` delegates `orchestrate`, `freeze`, `metric`, `divergence`, `loop`, and `goalplan` to the PABCD-state CLI.
- `bin/codexclaw.mjs:177-190` already has a precedent that `--help` should bypass expensive runtime setup for `cxc map`.
- `plugins/codexclaw/components/pabcd-state/src/cli.ts:61-70` parses `orchestrate` before running it; parse errors currently go to stderr and exit 1.
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:50-53` validates the first token as a verb before scanning flags, so `--help` becomes `unknown orchestrate verb '--help'`.
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:121-123` renders status, but only the explicit `status` command currently exposes phase/flags.
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:150-170` has strong session safety errors; the new phase context must preserve this anti-fork collision contract.
- `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts:186-236` already covers status/reset/no-session behavior and is the right place for phase-context regression tests.
- `plugins/codexclaw/test/cli-usage.test.mjs:11-13` is the current top-level usage test and should be expanded rather than replaced.
- `structure/INDEX.md:122` documents `pabcd-state` ownership; `structure/INDEX.md:234-246` documents command routing and should stay in sync.

## User-Facing Contract

1. `cxc help`, `cxc --help`, and `cxc -h` exit 0 and print a multi-section top-level usage page:
   - synopsis;
   - command table grouped by purpose;
   - agent notes for `--session`, `--json`, and where help lives;
   - examples for the highest-friction paths (`orchestrate`, `loop`, `map`, `chat search`).
2. Unknown top-level commands exit 1 and include:
   - the unknown command;
   - the same concise command list or a pointer to `cxc --help`;
   - no accidental delegation to a component.
3. `cxc orchestrate --help`, `cxc orchestrate -h`, and `cxc orchestrate help` exit 0 and print:
   - synopsis: `cxc orchestrate <I|P|A|B|C|D|status|reset> [--session <id>] [--attest <json>] [--cwd <path>] [--json]`;
   - phase model: `D` closes to `IDLE`;
   - agent safety: mutating verbs require explicit `--session`;
   - attestation examples for gated edges;
   - `status` examples, including `--json`.
4. If `--session <id>` is explicit and the session can be read, every `cxc orchestrate` output should expose phase context immediately:
   - successful transition: include before/after, e.g. `current=P -> A`.
   - refused transition or malformed attest after parse: include `current=P` before the refusal reason.
   - reset: include `current=<phase> -> IDLE`, and `current=IDLE` for no-op reset.
   - `status`: keep the existing phase line but include `session=<id>` in text mode.
   - `--json`: preserve existing JSON status shape and add fields only if tests pin the compatibility decision.
5. Unknown orchestrate verbs should become recoverable:
   - without `--session`: print `unknown orchestrate verb ...; run cxc orchestrate --help`.
   - with a resolvable `--session`: additionally print `current=<phase>` without mutating state.
6. Help paths must not create `.codexclaw/sessions/*.json`, append ledger rows, or reset render ledgers.
7. Unknown-verb recovery with `--session <id>` must be proven through the compiled `dist/cli.js` entry as well as the pure parser/renderer path.

## Planned Edits

### MODIFY `bin/codexclaw.mjs`

- Add a small `renderTopLevelHelp()` function near the dispatcher.
- Treat `help`, `--help`, and `-h` as explicit help commands.
- For unknown commands, print a short error plus a help hint and exit 1.
- Keep command delegation unchanged for real subcommands.

Acceptance scenarios:
- `node bin/codexclaw.mjs --help` exits 0 and mentions `orchestrate`, `loop`, `map`, `chat search`, and `skill search`.
- `node bin/codexclaw.mjs nope` exits 1 and mentions `cxc --help`.
- `node bin/codexclaw.mjs help` still exits 0.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts`

- Extend the parse model with a help result, or parse flags before verb validation so `--help`, `-h`, and `help` are handled before unknown-verb errors.
- Add `renderOrchestrateHelp()` for the focused contract.
- Add a lightweight explicit-session scanner for parse errors so an unknown verb plus `--session <id>` can render phase context without weakening verb validation.
- Add a `renderPhaseContext(state, sessionId)` helper used by success and refusal paths after state is read.
- Keep session safety intact:
  - no implicit session fallback for mutating verbs;
  - unknown explicit session still refuses;
  - reserved `cli` behavior remains as documented.

Acceptance scenarios:
- `parseOrchestrateCliArgs(["--help"], cwd)` returns a help result, not an unknown-verb error.
- `runOrchestrateCli(helpArgs)` exits 0 and performs no state IO.
- `runOrchestrateCli({ verb: "A", session: "s1", cwd, attest: null })` from phase `P` includes `current=P` in the refusal output.
- `runOrchestrateCli({ verb: "status", session: "s1", cwd })` includes both `session=s1` and `phase=<phase>`.
- `runOrchestrateCli({ verb: "reset", session: "s1", cwd })` includes `current=<phase> -> IDLE`, and already-IDLE reset includes `current=IDLE`.
- CLI parse error for `["wat", "--session", "s1"]` includes current phase when `s1` exists.

### MODIFY `plugins/codexclaw/components/pabcd-state/src/cli.ts`

- Route orchestrate help results to stdout with exit 0.
- For parse errors, use the enriched parse output so recoverable hints and session phase context reach stderr/stdout consistently.
- Preserve current exit-code semantics for real parse failures.

Acceptance scenarios:
- `node plugins/codexclaw/components/pabcd-state/dist/cli.js orchestrate --help` exits 0.
- `node .../cli.js orchestrate wat --session binsess --cwd <tmp>` exits 1 but reports the current phase when the session file exists; this is a required end-to-end assertion, not only a renderer unit test.

### MODIFY tests

- Expand `plugins/codexclaw/test/cli-usage.test.mjs` for top-level `--help`, `-h`, and unknown-command behavior.
- Expand `plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts` for parser help, help no-mutation (sessions dir, existing session JSON, ledger, and render ledger), phase-aware refusals, phase-aware malformed attest, phase-aware reset/status, dist CLI help, and dist CLI unknown-verb phase reporting.
- Prefer focused tests first; run full gate only after focused failures are resolved.

### MODIFY source-of-truth docs

- Update `structure/INDEX.md` command routing rows for the new help contract.
- Update README only if its command list claims a conflicting or incomplete usage surface.

## Scope Boundary

**IN:**
- Top-level `cxc` help output.
- `cxc orchestrate` help output.
- Phase-aware `cxc orchestrate ... --session <id>` text output where the session is resolvable.
- Tests and source-of-truth docs for those contracts.

**OUT:**
- Shared renderer refactor for all component CLIs.
- New `--help` implementations for every delegated subcommand.
- Machine-readable help schema beyond existing `--json` status behavior.
- Changes to legal phase edges, attestation validation, or ledger semantics.

## Risks And Controls

- **Risk:** Phase context accidentally reintroduces implicit latest-session mutation.
  **Control:** Only render phase after explicit `--session` on non-status paths; keep `status` read-only fallback unchanged.
- **Risk:** Help rendering accidentally creates a session or writes ledger rows.
  **Control:** Add no-mutation tests around sessions dir and ledger file.
- **Risk:** Existing scripts rely on one-line top-level usage.
  **Control:** Keep command names stable and only improve output; unknown commands exit non-zero because they are errors.
- **Risk:** JSON consumers break if status JSON changes.
  **Control:** Preserve current JSON fields unless tests pin a backward-compatible addition.

## Verification Plan

1. `npm run build`
2. `node --test plugins/codexclaw/components/pabcd-state/test/orchestrate-cli.test.ts plugins/codexclaw/test/cli-usage.test.mjs`
3. `npm test`
4. Manual smoke:
   - `node bin/codexclaw.mjs --help`
   - `node bin/codexclaw.mjs orchestrate --help`
   - `cxc orchestrate status --session 019f4757-93cd-7e91-979c-80f687a91fc1`
   - `cxc orchestrate A --session 019f4757-93cd-7e91-979c-80f687a91fc1`
