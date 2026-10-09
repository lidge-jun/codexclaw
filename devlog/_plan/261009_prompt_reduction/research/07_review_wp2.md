# wp2 independent C review

Read-only review of `11044a1f..e6b21c21` (plugins only). Physical cwd:
`/Users/jun/.codex/worktrees/55e8/codexclaw`; observed HEAD:
`e6b21c21e136de397def6280a107139f8841774b`. Reviewed against
`010_wp2_l1_injections.md`, including its amendments and B record. C4 care applies
to permission/trust preservation; no orchestration, goal commands, builds, test
execution, child spawning, branch operations or Git writes were performed.

Automated static pre-scan: no errors found. TypeScript AST comparisons over all
16 changed src files and 16 corresponding dist files found no changes to existing
permission/decision/state assignments or enforcement conditions. The added
`phase: state.phase` is a renderer fact, not a persisted transition. All 46
marker/cap/budget/token/MAX declarations compared remain identical. AST extraction
of assertions in every changed test file retained all 338 original assertions
concerning permissionDecision, decision, behavior, action, phase, orchestration
state, code and injection state. This is source evidence, not a test-pass claim.

1. **Low — background-terminal discovery commands lose their owner.**
   Location: `plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:127`;
   replacement owner: `plugins/codexclaw/skills/dev/references/native-execution.md:78`.
   Trigger: an agent/user needs to list active background terminals or stop them
   after receiving the shortened startup/compact notice. Impact: the old notice's
   `/ps` list and `/stop` current-session terminal instructions are no longer
   discoverable through this pointer. The new owner retains execution and polling
   but neither command. Falsification: `rg -n -F '/ps' plugins scripts` excluding
   dist/node_modules returned no matches; `/stop` matches are messaging/UI turn
   controls, not the former terminal explanation. The baseline emitter at
   `11044a1f:plugins/codexclaw/components/cxc-ops/src/map-affordance.ts:216` carries
   both commands. Remediation: retain supported host-specific list/stop guidance
   in native-execution.md, or explicitly document that this detail is intentionally
   retired. This is a non-blocking ownership omission, not a claim that those host
   commands were runtime-tested or that terminal execution regressed.
   `verification: verified` (text/owner loss only).

## Requested invariants

- **Guard branches/FSM:** inspected source diffs as well as parsed conditions.
  goal-gate, git-write-guard, memory-write-gate, worktree-guard,
  agent-thread-permissions and spawn-attach retain their allow/deny/advise paths.
  The hook's loop-arm addition only reads goal status for text; state writes,
  lexical trigger behavior, turn dedupe and Stop decisions remain unchanged.
  Other conditional changes are rendering: memory surface wording, worktree cwd
  abbreviation, recall date/source framing, removal of the copied skill catalog,
  and receipt selection. provider-bridge's new non-error early return is the
  planned healthy/native silence, with detect output preserved.
- **Compared markers:** distinct V1/V2 leaf/coordinator prefixes, public markers,
  grant token/regex and exact grant suffix remain intact. Full block bodies are
  deliberately shorter; dispatchSources and emission dedupe still compare the
  same selected block constants, not a bare marker. Consumer anchors:
  `subagent-config/src/spawn-attach-hook.ts:397` and `:941` (under components).
  New l1-injections tests cover reapplication, cross-surface guards, no-grant
  denial and one-use grant consumption/replay, with explicit decisions.
- **Recall trust/caps:** `<untrusted-recall-data>` and its closer, JSON/control and
  angle-bracket escaping, reserved-tail accounting and whole-entry admission are
  unchanged (`components/recall/src/hook.ts:308`, `:351`, `:358`). Freshness and
  “never instructions” remain outside the delimiter. Existing escaping/closer
  assertions survive. Shorter frames can admit more whole data rows under the
  same cap; the topN/snippet ceilings are unchanged.
- **Facts/pointers:** current session and command form remain in SessionStart;
  loop-arm has actual phase/goal-active/session facts and platform attest flags;
  bound B retains slice id/title; goal/worktree/memory reasons retain relevant
  paths and identifiers. IPABCD's phase/label marker and label table survive.
  All concrete `$codexclaw:cxc-*` names in changed emitters resolve to existing
  skill SKILL.md files. Named references resolve under their respective owners:
  pabcd phase-plan/plan-output/phase-audit/phase-check/phase-control/delegation;
  loop runtime-lifecycle/durable-goalplan; dev async-questions/browser-routing/
  native-execution; interview mind-dispatch. The configured-first-fallback
  heading exists in delegation.md:369. Generic `<name>` placeholders are templates,
  not missing concrete owners.
- **Removed guidance ownership:** skill catalogs remain in dev §9; Korean prose
  remains with kwrite; PR stacks with dev §0.3/stacked-prs; attestation recipes and
  session binding with phase-control; resume/goal conflicts with runtime-lifecycle;
  Mind dispatch with interview; fallback protocol with delegation. Config repair
  remains reachable via doctor's features check (`components/cxc-ops/src/doctor.ts:132`).
  Agent-thread user advice still carries its configuration remedy. Only finding 1
  survived the owner-loss search.
- **Loop receipts/consumers:** searched plugins and root scripts, including skill
  docs, for runGoalplanCli/goalplan-cli, mutation command names and former full
  output markers. No production in-repo consumer parsing mutation full-plan
  stdout was found. `components/pabcd-state/src/cli.ts:180` passes through output.
  Remaining full-plan assertions target show; GUI/runtime consumers read stored
  goalplan data. add-criterion's last-item id is correct because steering appends
  it (`components/pabcd-state/src/steering.ts:205`); lifecycle counts use the
  committed plan from the existing lock. show/validate stay full renders.

## Coverage and proof limits

All 56 changed plugin files accounted for: 16 production src files reviewed;
16 generated dist files reviewed for mirrored changes and invariant AST records;
all 23 test files reviewed (removed/added assertion comparisons included); the
native-execution owner edit reviewed. No changed plugin file skipped.

Read-only proof commands: `git diff 11044a1f e6b21c21 -- plugins`, targeted
`git show`, `rg` consumer/owner searches, and in-memory TypeScript AST walks over
both revisions. `git diff --check 11044a1f e6b21c21 -- plugins` emitted no errors.
No build, test suite or Windows-native delivery was independently verified here.
The plan's B record explicitly defers the aggregate SessionStart <=2400 B gate
to wp3 because the dispatch card remains unchanged; that acceptance proof remains
outstanding and is not being silently certified by this review.

blocking_issues: []

VERDICT: NEAR-PASS
