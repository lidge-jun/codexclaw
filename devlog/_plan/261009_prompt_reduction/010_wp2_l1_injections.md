# wp2 — L1 injections and loop CLI receipts

Goal: every always-on or recurring injected block carries a current fact, one cue and one owner pointer, within the 001 budgets. Guard decisions, dedupe, markers, trust delimiters and identities do not change. Source inventory and measurements: research/10_l1_injections.md (anchors there use `h=P/src/hook.ts`, `m=O/src/map-affordance.ts` etc.).

Before/after is measured with a pure-renderer script (`devlog/_plan/261009_prompt_reduction/evidence/measure-l1.mjs`, NEW) that imports the built `dist` renderers with a fixed 36-char session id and prints UTF-8 bytes per emitter. It runs before B and after C; both outputs are saved in `evidence/`.

## Lanes (disjoint write scopes; each lane edits src + test, main rebuilds dist once)

### Lane A — cxc-ops SessionStart bundle and compact marker (`components/cxc-ops/{src,test}`)

`src/map-affordance.ts` (anchors `m:122-340`). Before 4,346 B → target ≤ 900 B.

| Fragment | New text (shape) | Notes |
|---|---|---|
| binding (`m:158`) | `[codexclaw] Session <id>. Mutating cxc orchestrate/loop calls pass --session <id>; verify with <cxc> session current. Never use a parent or history id. Owner: $cxc-pabcd phase-control.` | keep id, command form; tests `mt:209` |
| map (`m:104`) | `[codexclaw] <N>+ source files: cxc map <dir> gives a ranked symbol map ($cxc-repo-map).` | keep ≥40 file condition |
| external catalogs (`m:122`) | removed | owner: dev `9 skill discovery |
| Korean prose (`m:140`) | removed | owner: kwrite (L2 selects it) |
| loop contract (`m:180`) | `[codexclaw] Loop work: load $cxc-loop and $cxc-pabcd. Stated user limits win; a mention grants no authority.` | |
| PR stacks (`m:192`) | removed | owner: dev `0.3 + stacked-prs.md |
| background terminals (`m:209`) | `[codexclaw] Long commands: exec_command with a short yield_time_ms, then poll the session_id with write_stdin.` | owner gap: one sentence is the owner; add it to dev/references/native-execution.md in wp3 |
| user questions (`m:223`) | `[codexclaw] Mid-work questions: request_user_input_async when exposed; do not wait; silence is not approval ($cxc-dev async-questions).` | |
| PATH note (`m:331`) | `[codexclaw] cxc invocation: <command>` | unchanged condition |
| compact marker (`m:260-289`) | reuse the loop, terminal and question lines (no stack line) | 2,332 → ~400 B |

Tests: `test/map-affordance.test.ts` (`:74,:84,:115,:148,:158,:209,:233,:254,:255`) and `test/compact-affordance.test.ts:43` — replace phrase locks with: block present, id/command present, removed blocks absent, total ≤ 900 B.

### Lane B — pabcd-state directives and worktree notices (`components/pabcd-state/{src,test}`)

`src/hook.ts`:

- Loop-arm directive (`h:491-533`, 3,242/3,472 B) → ≤ 600 B: `Loop requested; FSM is <phase>, goal <status>. Session <id>. Follow $cxc-loop (runtime-lifecycle) and $cxc-pabcd phase-control; stated user limits win; no push/merge/release without permission. Windows: --attest-file.` Keep the conditional search addendum but shorten to ≤ 250 B.
- Phase guidance bodies I/P/A/B/C/D (`h:324-420`, 295-1,960 B) → ≤ 300 B each: phase name, owner reference, active slice id/title for bound B. The P body keeps the two owner names `phase-plan` and `plan-output` (pinned by `ht:264`). Interview Mind prose (`P/src/minds.ts:66`) → pointer to interview mind-dispatch.
- Lexical authority note (`h:467`, 484 B) → ≤ 120 B: `Phase unchanged; a phase hint grants no authority. Transitions go through cxc orchestrate.`
- Footer (`h:556-572`, 690 B) → ≤ 200 B: `IPABCD: <phase> (<LABEL>) is a prompt-time snapshot; report the latest verified persisted phase.` Keep the `IPABCD: <phase> (<LABEL>)` marker exactly.
- Agbrowse block (`h:305`, 1,392 B) → ≤ 200 B pointer to $cxc-search and dev browser-routing.
- Dead `QUESTION_SHAPE_DIRECTIVE` (`h:428`) removed with its standalone test `hc:399`.

`src/worktree-guard.ts`: managed-worktree SessionStart (`w:141-173,548`, 1,330 B) → ≤ 400 B keeping WORKTREE-GUARD-01, path, slot, "adopt in place, never delete/recreate/move the active checkout", owner $cxc-worktree-guardian; rename advice (`w:131,165`, 883 B) → ≤ 250 B.

`src/idle-edit.ts` advisory (548 B) → ≤ 200 B. Deny reasons in `goal-gate.ts`, `git-write-guard.ts`, `memory-write-gate.ts`: shorten shared reason strings to code + fact + remedy pointer, keeping every decision, rule ID and path fact (targets in research/10, "PreToolUse" table).

`src/goalplan-cli.ts` (`gp:401-445, 682, 799`): init/add-work-phase/add-criterion/add-task/complete-task/meet-criterion print a receipt `loop <verb>: <slug> <id> applied (phases=<n> remaining=<n>, criteria=<n> unmet=<n>); full plan: cxc loop show --session <id>`; `show` and `validate` keep the full render. Tests: `test/goalplan.test.ts:594,802`, `goalplan-public-surface.test.ts:204,499,544`, `steering.test.ts:120,324` — update to the receipt.

Tests to update: `test/hook.test.ts` (`:245,:253,:289,:341,:377,:432,:521,:568,:682,:720,:765,:782,:933,:944,:1110`), `hook-continuation.test.ts` (`:146,:226,:306,:399`), `minds.test.ts:24`, `worktree-guard.test.ts:225,248,267,327,424`, `idle-edit.test.ts:32`, `goal-gate.test.ts`, `git-write-guard.test.ts`, `memory-write-gate.test.ts`. Each keeps its decision assertion; phrase locks become marker/ID/owner/fact assertions plus a byte ceiling.

### Lane C — subagent-config notices and child scope (`components/subagent-config/{src,test}`)

- Fallback protocol notice (`src/fallback-dispatch-cli.ts:9-37`, 2,379 B) → ≤ 300 B: configured roles + `Follow $cxc-pabcd delegation.md#configured-first-fallback before a native spawn; only action=spawn grants one call.`
- Dispatch card (`src/dispatch-card.ts:24-46`, 938/1,162 B) → ≤ 300 B: family state + live-schema/owner pointer; keep the cap. Probe code and alias table move to delegation.md (wp3 lane).
- Unmanaged-spawn context (`src/spawn-attach-hook.ts:1081`, ~2,470 B) → ≤ 300 B.
- Child scope guards V1/V2 leaf/coordinator (`:287-340`, 461-1,091 B) → one shared ≤ 350 B text: parent owns FSM and goals; bounded write scope; shared checkout; no branch-level git; no spawn without a valid one-use grant. Recursion deny (`:450`) → ≤ 150 B with LEAF-TOPOLOGY-01.
- V2 self-load catalog (`:644-673`, 3,370 B) → ≤ 250 B: read explicitly mentioned skills at `<skillsDir>/<folder>/SKILL.md`; drop the copied catalog.
- Selected skill body transport and role prompts unchanged (that is L3 transport).

Tests: `test/fallback-dispatch-cli.test.ts:90,97,101`, `dispatch-card.test.ts:17,26,73`, `fallback-dispatch.test.ts:149`, `spawn-attach-hook.test.ts` (`:384,:434,:526,:537,:571,:631,:669,:999,:1049,:1096,:1134`).

### Lane D — recall, bg-wake, provider-bridge, config-guard, agent-thread permissions

- `components/recall/src/hook.ts`: availability line (`r:664,734`) → ≤ 120 B; history frame (`r:227,490,708`) → ≤ 200 B frame around unchanged snippets and caps; recall-intent advice (`r:116-199`) → ≤ 150 B + terms; unavailable → ≤ 60 B. Tests `components/recall/test/hook.test.ts` lines in research/10.
- `components/bg-wake/src/hook.ts` completion and adoption frames → ≤ 120 B each, rows unchanged and ≤ 5.
- `components/provider-bridge/src/cli.ts:71`: healthy/native status silent; errors keep a short line and a doctor pointer. Tests `detect.test.ts:21,36,42`.
- `components/config-guard/src/self-heal.ts:239` healed/failed → ≤ 100 B.
- `components/pabcd-state/src/agent-thread-permissions.ts:391` model text → ≤ 150 B (lane D owns only this file in pabcd-state).

## Accept criteria

- Fresh measure-l1 output: SessionStart static total ≤ 2,400 B in the root, managed-worktree, fallback-configured fixture; loop-arm ≤ 600 B; each phase body ≤ 300 B; footer ≤ 200 B; loop CLI mutation receipt ≤ 250 B.
- Every guard test still asserts the same allow/deny decision (diff of `permissionDecision`/`decision` assertions shows no change).
- `npm run build`, focused component tests, `npm test`, `gate.mjs` pass; dist is fresh (`dist-freshness.test.mjs`).
- Activation: each shortened emitter is exercised by its existing fixture (the same trigger that produced the old text), so the reduction is observed on the real path, not on a constant.


## Amendments after A round 1 (research/02_audit_round1.md, research/01_architect_reflection.md)

- Blocker 2 (child scope). Lane C keeps every surface marker, the leaf and coordinator authority prefixes, the V1 and V2 forms, the grant suffix and the coordinator's disjoint-scope duty byte-identical where `dispatchSources` (`spawn-attach-hook.ts:428-435`) or emission dedupe (`:967-984`) compares them. Only the sentence bodies after those prefixes shrink; a shared body constant is allowed only when each surface still produces a distinct full block. New tests: reapplication dedupe, cross-surface (V1 block seen under V2), no-grant deny and one-use grant consumption, each with the same decision as before.
- Blocker 3 / G5 (owners first). The dispatch card (`dispatch-card.ts`) is not changed in wp2; it moves to wp3 together with its new owner text in `delegation.md` (main writes both, same PR). The background-terminal sentence gets its owner in this PR: lane A adds it to `skills/dev/references/native-execution.md`. No wp2 text points at a file created in wp3.
- Blocker 4 (scopes). Lane B owns `components/pabcd-state/{src,test}/**` except `src/agent-thread-permissions.ts` and `test/agent-thread-permissions.test.ts`, which belong to lane D. Lane A owns `components/cxc-ops/{src,test}/**` and `skills/dev/references/native-execution.md`. Lane C owns `components/subagent-config/{src,test}/**` except `dispatch-card.*`. Lane D owns recall, bg-wake, provider-bridge, config-guard (src, test) and the two agent-thread-permissions files. Main owns dist (one `npm run build`), `evidence/` and the measure script.
- Blocker 5 / G1 (aggregate proof). `evidence/measure-l1.mjs` runs the real hook commands from `plugins/codexclaw/hooks/*.json` (the hook-bench path) with fixture stdin in a temp HOME/cwd and sums `additionalContext` per event across all co-emitting hooks. Scenarios: root SessionStart (plain cwd, managed-worktree cwd, fallback configured); UPS ordinary prompt (static = 0 B); UPS loop request with search terms (POSIX and Windows); UPS phase hint with footer in P and bound B; UPS recall intent; first UPS after compaction (marker). Recall snippet bytes are reported as data, apart from static text. Exit 1 when SessionStart static > 2,400 B or any UPS static > 1,200 B. Provider-bridge healthy/native silence and error output are tested through `runSessionStartHook` (new test), not `renderStatusLine`. Recall escaping and the reserved closer (`recall/src/hook.ts:313-319,363-379`) keep their tests.
- G4 (resolvable pointers). L1 text names skills as `$codexclaw:cxc-<name>` (the form `hook.test.ts:232-244` accepts) and references by file name inside that skill.
- Loop-arm directive is the named ≤ 600 B exception in 001; every other notice ≤ 400 chars.

- R2 (round 2). measure-l1 runs the hook commands as subprocesses on this macOS host (POSIX delivery proof). The Windows loop-arm text is measured by calling the exported `handleUserPromptSubmit` with `platform: "win32"`, and the report labels it renderer proof, not subprocess delivery. Windows subprocess delivery is covered by the hosted CI Windows shards running the pabcd-state hook tests on the PR head.

## wp2 P revalidation (2026-10-09)

Continuity (LOOP-CONTINUITY-01), quoting the wp1 D summary: "the roadmap is locked ... Next: wp2 per 010, re-verified against the tree at P." Re-verification: `git diff 6520b7b8 HEAD -- plugins` is empty (the only commits since the audited snapshot are this unit's docs), so every anchor audited in research/02-05 still holds. The architect consultation and reflection for this doc are the wp1 records (002, research/01 and 03 ALIGNED); no design decision changed, so no new consultation. Branch: `codex/prompt-reduction` (PR A). Lane workers: four gpt-6.1-sol subagents with the amended scopes; main writes `evidence/measure-l1.mjs`, rebuilds dist once, and runs the gates.

