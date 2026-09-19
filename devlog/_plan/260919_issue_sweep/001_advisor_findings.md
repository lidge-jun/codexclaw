# 001 — Advisor findings

Six read-only `gpt-6-astra` advisor subagents analysed the backlog in parallel on
2026-09-19, each bounded to one cluster, all forbidden from writing. Host-behaviour
claims had to cite `/Users/jun/Developer/codex/121_openai-codex`. That checkout sits on
`codex/spawn-agent-metadata-ux` at `fde7de4d04`; `main` was fast-forwarded to
`78245b47af` for this unit and the named revision was read with `git show` rather than
by switching the checkout. Three advisors flagged that discrepancy independently and
confirmed the relevant code is equivalent at both revisions.

This document records verdicts and anchors. The executable edits live in the decade
documents.

## Verdict table

| Issue | Verdict | One-line reason |
| --- | --- | --- |
| #175 | PARTIALLY-REAL | Cleanup script already protects `dev`; the live gap is repository configuration. |
| #184 | REAL | Lanes have isolation but no identity, collision or handoff contract. |
| #186 | PARTIALLY-REAL | Trust records really are absent, but `doctor` wrongly reports that drift blocks nothing. |
| #196 | REAL | Reproduced twice, including against this unit's own documents. |
| #185 | PARTIALLY-REAL | Extraction health is unobservable; "no signal anywhere" is false. |
| #187 | REAL | No `memory status` verb exists; unknown verbs exit 0 with usage. |
| #188 | PARTIALLY-REAL | 52 exhausted jobs confirmed; loss is not permanent, but no selective recovery exists. |
| #189 | PARTIALLY-REAL | Child sessions are excluded, yet parent synthesis is already an input route. |
| #190 | PARTIALLY-REAL | Cwd-scoped recall already exists; empty versus unavailable is conflated. |
| #191 | PARTIALLY-REAL | The auth/route guard mismatch is real; the proposed bypass does not work. |
| #178 | REAL | Empty waits are treated as failure. Already fixed by open PR #180. |
| #192 | REAL | No cross-turn wake contract before yielding a turn. |
| #193 | PARTIALLY-REAL | The documentation gap is real; the desktop wrapper is not in this repository. |
| #194 | REAL | No shared observation owner or polling budget across lanes. |
| #198 | REAL | V1 exposes the report through notification, wait and close, with no consumption rule. |
| #195 | PARTIALLY-REAL | Partial coverage exists in `stacked-prs.md`; §3 lacks the hosted-CI procedure. |
| #197 | REAL | The completed-job REST log route and its version-gated flag are undocumented. |
| #181 | REAL | The output directory is never created before Chrome is invoked. |
| #182 | PARTIALLY-REAL | Pointers do not resolve for consumers, but the evidence is tracked at HEAD. |
| #183 | REAL | Six references escape the skill root and break a standalone install. |
| #199 | REAL | Intake routes by format; there is no research or evidence handoff. |
| #200 | REAL | Decision-memo conventions are imposed on every genre. |

## #196 reproduced against this unit

Worth recording separately, because it decides the phase order. While writing this very
file, the `comment-lint` PreToolUse hook denied the `apply_patch` call. The prose
quoted the names of the three code patterns the linter scans for, and the linter matched
one of them inside ordinary Markdown:

```
Command blocked by PreToolUse hook: [codexclaw comment-lint] dynamic eval is forbidden;
refactor or add // justified: <reason>
```

The advisor had already reproduced the same defect independently, using the sentence from
the issue body itself, and got `ok:false` with a `permissionDecision:"deny"` envelope for
a Markdown target. So the issue is confirmed from two directions, and its consequence is
concrete: this bug obstructs every documentation phase in this unit. That is why wp3
lands before the other implementation phases, ahead of the original wp2 ordering.

## Anchors worth keeping

**#175.** `.github/scripts/closed-pr-branch-cleanup.cjs:17` already lists `dev` in
`PROTECTED_BRANCHES`; `:160` rejects protected names, `:172` rejects merged heads. Live
reads: `delete_branch_on_merge:true`, `dev.protected:false`, and
`GET repos/lidge-jun/codexclaw/rules/branches/dev` returns `[]`. Ruleset `protect-main`
(20884837) covers only `refs/heads/main`. No branch deletion exists in `release.yml`.
Fresh `node --test .github/scripts/closed-pr-branch-cleanup.test.cjs`: **15 passed**.
So the code is already right and the remaining exposure is repository configuration.

**#196.** `comment-lint.ts:30` holds the cast pattern; `lintApplyPatch()` at `:67-73`
scans every added line without knowing its target path, because `addedLines()` at
`:53-61` discards the file headers. All three scanned patterns share that scope error,
so restricting only the cast leaves prose false positives behind. The existing
`comment-lint.test.ts` reports **9 passed** — it has no prose or path case at all,
which is why the defect shipped.

**#186.** Host trust is per-hook-identity:
`codex-rs/hooks/src/engine/discovery.rs:775-808` hashes normalized configuration and
classifies absent hashes Untrusted and mismatches Modified; `:713-718` excludes both from
execution unless `bypass_hook_trust` is set. Approval writes `current_hash` at
`codex-rs/tui/src/hooks_rpc.rs:58-87`, and startup review already exists at
`codex-rs/tui/src/startup_hooks_review.rs:69-80,142-165`. Absent records therefore
justify "untrusted" but do not by themselves prove the five hooks never ran. The shipped
defect is `cxc-ops/src/doctor.ts:464` claiming drift blocks nothing and `:497` claiming
hooks still run.

**#198.** The duplicate is structural, not one broken path: spawn installs a watcher at
`codex-rs/core/src/agent/control/spawn.rs:407` which independently injects the completed
status at `control.rs:533`; `wait.rs:188` returns terminal `AgentStatus`;
`close_agent.rs:62,125` captures and returns that status before closing. `wait.rs:274`
exposes no suppression option. Observed first-party during this unit: the A6 report
arrived in the `wait_agent` result and again as a notification.

**#193.** `thread_processor.rs:3756` (filtered, paginated stored listings) differs from
`:2183` (loaded IDs); thread start emits `ThreadStarted` at `:1328`. Absence from a
listing therefore does not prove a thread is unaddressable. `SessionMeta.id`, the field
filesystem recovery must read instead of guessing a filename, is at
`protocol/src/protocol.rs:3014`.

**#187 and #188.** Live read-only SQL: **224 stage-1 done, 52 exhausted errors, 1
consolidation done**. The 52 break down as 35 context-window, 5 capacity, 6
incomplete-response, 5 stream-closed, 1 other. Host
`state/src/runtime/memories.rs:996` decrements retries uniformly and `:728` resets them
when the source watermark advances, so exhaustion is not permanent loss.
`bin/codexclaw.mjs:589` already forwards memory verbs to recall, so `memory status`
needs no new dispatcher. At `78245b47af` the host supports memory V1/V2 dual-write
including `memories_v2_1.sqlite`, so any status reader must name the store it read or
report unsupported rather than assuming V1.

**#191.** `memories/write/src/guard.rs:16` gates on authentication while
`runtime.rs:256` routes extraction through `config.model_provider` — the mismatch is
real. But `guard.rs:50` rejects `rate_limit_reached_type` before the threshold
arithmetic, so the threshold-zero bypass proposed in the issue does not work.

**#197.** `gh run view --job <JOB> --log` checks parent-run completion, not only job
completion (CLI `pkg/cmd/run/view/view.go:313-320`). The working route is
`GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`. The escape-sequence flag is
`--allow-escape-sequences`, registered at `pkg/cmd/api/api.go:303` with its guard at
`:530-542`. It ships with CLI v2.97.0; the local CLI is **2.96.0** and rejects it as an
unknown flag, so the documentation must qualify the version instead of prescribing it.

**#199 and #200.** Commit `60a07328` already contains `reference/report-pipeline.md:11-17`
(evidence model before storyline), `scripts/report-contract.mjs:4` (claim kinds
`observation`, `inference`, `hypothesis`, `recommendation`, `attribution`) and `:7-25`
(schema v1), plus `reference/page-role-catalog.md` and `scripts/quality-gate.mjs`. The
shipped fixture `assets/paged-report.html` contradicts itself — `:224` says random
allocation while `:236` and `:295` say alternating — and `60a07328` already corrects it.

## Baseline

`CODEXCLAW_SKIP_REPOMAP_SMOKE=1 npm test` on `dev` at `03541398`: **3149 tests, 3144
pass, 1 fail, 4 skipped**. The single failure is `plugins/codexclaw/gui/test/router.test.ts`
with `ERR_MODULE_NOT_FOUND: Cannot find package 'react'`. This worktree had no
`node_modules` at all; the GUI workspace declares `react` as a dependency and CI runs
`npm ci` at `.github/workflows/ci.yml:39,89,125`. It is a missing-install artifact, not a
regression, and `npm ci` is the fix. Every later "fails before, passes after" claim in
this unit is measured after that install.

## Cross-slice constraints the advisors surfaced

1. PR #180 must land before wp5. Two advisors reached this independently.
2. `plugins/codexclaw/skills/dev/SKILL.md` is edited by wp5 (§8 budget) and wp6 (§3 CI),
   and wp7 touches its `references/reader-documents.md`. These land serially.
3. `loop/references/waiting.md` is edited for #178, #192, #194 and #198 — all inside
   wp5, so that is one PR, not four.
4. wp7 must settle the `60a07328` recovery question before #199 and #200, which matches
   PR-01 of the attached roadmap.
5. #187's status reader is the shared foundation for #185, #188 and the doctor check.
