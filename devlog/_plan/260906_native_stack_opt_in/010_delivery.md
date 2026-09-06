# Explicit-only native-stack delivery

Loop archetype: satisfy-spec. Trigger: user rejects native-stack default.
Goal: ordinary PRs/manual chains by default; native GitHub stacks only on unmistakable,
strong, task-specific user request. Non-goals: remove safe inspection, weaken CI,
modify stack membership or unrelated repositories/settings. Stop: patch released
and four official installs verified. Memory: this numbered unit plus task evidence.
Expected outcomes: DONE with all proof, otherwise a concrete external blocker.
Escalation: main reclaims after two failed packets; added worker scope is a P amendment.
Tools: git/gh/cxc/node, existing authenticated SSH targets and native Codex plugin CLI.
No new token/time/cost bound was requested; bounded waits and no blind retries.

## Exact changes

MODIFY plugins/codexclaw/skills/dev/references/stacked-prs.md:
- Add a prominent native-opt-in policy before the model. Native usage is default-off;
  do not recommend/prompt to opt in or infer it from generic 'stack', PR splitting,
  dependency graphs, CI work, release authority, Can Stack or platform availability.
  One clear strong request naming GitHub native stacks is sufficient; no repeated
  confirmation or emotional-word/password test. A plain mention/question is insufficient.
- Replace 'use a registered native stack by default' and mandatory fallback permission
  with ordinary PR/manual-chain default and native registration only after this opt-in.
- Scope native tools/async merge instructions to explicitly requested native operations.
  Existing native membership is not new authorization: read safely, report collateral
  effects, continue independent work; do not auto-merge/unstack/retarget to escape it.
- A PABCD dependency map does not itself choose a PR stack or native registration.
  Keep useful manual-chain ordering and exact-head safety.

MODIFY plugins/codexclaw/skills/dev/SKILL.md stack pointer and
plugins/codexclaw/skills/dev-devops/SKILL.md stack-CI pointer:
state ordinary PR/manual-chain default and the strong explicit native opt-in, retain
owner reference and existing-membership/CI distinction. No proactive upsell.

MODIFY plugins/codexclaw/components/cxc-ops/src/map-affordance.ts renderStackedPrAffordance:
replace 'Publish GitHub stacks natively' with a bounded (<600 chars) emitted pointer:
'Use ordinary PRs/manual chains by default. Do not suggest or create native stacks
unless the user clearly and strongly requests GitHub native stacks for this task.'
Keep owner DEV-STACK-06/07, existing membership safety and separate CI verification.
No transport/tool permission enforcement is added; this is emitted guidance.

MODIFY plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts existing two-event test:
assert the runtime output's default/opt-in/no-suggestion contract for SessionStart
and post-compact UserPromptSubmit, reject the removed native-publication directive;
retain envelope/event/bounded-length tests. No extra test case/count needed.
REGENERATE plugins/codexclaw/components/cxc-ops/dist/map-affordance.js using shipped build.mjs.
Source-of-truth sync: owner and injected hint; no other architecture changes.

## Verification and delivery

Baseline: node --test plugins/codexclaw/components/cxc-ops/test/map-affordance.test.ts
14pass,0fail (reads the changed runtime function and both actual hook envelopes).
Run it after source/build changes; gate.mjs reads skills/references for drift.
Independent audit scenarios: ordinary PR; generic stack/manual chain; splitPR/CI;
strong explicit native request; plain native question; existing native stack without
new authorization; banned auto-conversion/unstack; no renewed permission prompt when
already strongly requested. Prose adherence is a review claim, not runtime enforcement.

Bump0.2.19->0.2.20 in11 package surfaces, root lock workspace versions, manifest with
fresh+codex UTC stamp and generated inventory. Preserve dependency graph/docs-site0.0.1.
Add changelog entry. Existing test count2579 remains unless observed evidence differs.
Use one ordinary PR to dev, then dev->main promotion. Opening promotion may overlap
dev checks, but merge only after both checks pass. Require exact-main CI/WSL/packed,
then normal release.yml dispatch version0.2.20. Download/verify tag/checksum and all
published files against frozen Git using the previous reviewed manifest verifier.

Deploy remote macmini-cf, suji, nativeWindows desktop-c795oh4, then local. All were
verified0.2.19 from officialGit27514499 earlier in this conversation; refresh before
writes. Reuse reviewed operator1a11ffc8 with only version literal/spec SHA/oldRoot,
all marketplace keys nowcodexclaw (localpersonal was migrated). Fresh private per-host
backups outside Codex cache, no bootstrap/restart/checkout edits. Full payload hash,
actual marketplace Git HEAD, core doctor/trust and unchanged otherconfig checks.
Use established encoding-aware Windows runner and verified empty-stage recovery only
if needed. C receipt follows final real delivery report. D archives this unit.
