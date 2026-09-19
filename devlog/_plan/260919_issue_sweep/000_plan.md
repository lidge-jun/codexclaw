# 260919 Issue Sweep — open-backlog resolution and release

## Reader summary

codexclaw carried 22 open issues and one open PR while the installed plugin sat at
0.2.28. The backlog was never triaged as a whole, so several issues restate the same
root cause and at least three are already partly fixed in the tree. This unit answers
one question: which of those issues are real, what is the smallest change that closes
each, and in what order can they ship without colliding. The result is six
implementation work-phases delivered as separate PRs into `dev`, then one release
promotion. For a codexclaw user this means the hook trust report stops lying, the
comment-lint stops rejecting English prose, the memory pipeline becomes inspectable,
and the visualizer skill becomes installable on its own.

Evidence for every verdict is in `001_advisor_findings.md`. The per-phase diff-level
plans are the decade documents `010`–`070`.

## Loop-spec

| Field | Content |
| --- | --- |
| Loop archetype | Satisfy-spec. Each issue has a stated defect and a checkable close condition; there is no metric to maximize. |
| Trigger | User request: analyse the open issue/PR backlog with parallel gpt-6-astra advisors against the fast-forwarded upstream Codex source, then push and deploy, using small commits and frequent PRs. |
| Goal | Every actionable open issue closed by a merged PR into `dev`; `dev` promoted to `main`; the release workflow observed succeeding. |
| Non-goals | No changes to `121_openai-codex` (read-only reference). No work in the separate `aside-visualizer` repository. No rewrite of published history, no force-push. No new runtime dependency. No automatic hook trust grant. |
| Verifier | `npm test` and `npm run gate` at repository root; per-slice `node --test <path>` for focused proof; `gh pr checks <n>` for hosted CI; `gh run view` for the release run. Prose-only changes are marked human-review and claim no gate. |
| Stop condition | All eight work-phases closed, or a blocker reported with its exact refusal. |
| Memory artifact | This unit, `devlog/_plan/260919_issue_sweep/`. |
| Expected terminal outcomes | DONE when every cluster is merged or recorded NOOP with evidence and the release run is green. BLOCKED if a GitHub capability is refused. NEEDS_HUMAN for an issue needing a product decision the source cannot settle. |
| Escalation condition | Repository-settings mutation, merging PR #180, and any scope reaching outside codexclaw are surfaced to the user rather than assumed. Main reclaims an advisor slice after two failed dispatches. |

## Constraints carried into every phase

- Upstream host claims must cite `121_openai-codex` at `path:line`. The checkout is on
  branch `codex/spawn-agent-metadata-ux` at `fde7de4d04`; `main` was fast-forwarded to
  `78245b47af`. Read the named revision with `git show`, never by switching the checkout.
- Skill text is agent-followed, not hook-enforced. A prose change is an early warning,
  never enforcement, and its acceptance row is human review (PLAN-BYPASS-NAMED-01).
- `plugins/codexclaw/skills/dev/SKILL.md` is touched by two phases (wp6, wp7). They land
  sequentially, never concurrently.
- Components ship compiled `dist/` alongside `src/`; a source edit requires the build.

## Work-phase map (dependency-ordered)

The order is build-order, not effort. Delivery plumbing is the foundation because every
later phase ships through it; runtime gates come next because they block ordinary work;
the contract and documentation phases sit on top; the release consumes all of them.

| Phase | Doc | Issues | Why it sits here |
| --- | --- | --- | --- |
| wp1 | this unit | — | Locks the map before any implementation cycle. |
| wp2 | `010` | #175, #184 | `dev` must survive the promotion that wp8 performs, and lanes must be mergeable before parallel delivery is trusted. |
| wp3 | `020` | #186, #196 | Runtime gates. #196 currently denies ordinary Markdown patches, which obstructs every later documentation phase. |
| wp4 | `030` | #185, #187, #188, #189, #190, #191 | Memory pipeline; independent subsystem with its own CLI surface. |
| wp5 | `040` | #178, #192, #193, #194, #198 | Delegation and loop contracts. Depends on PR #180 landing first, which already closes #178. |
| wp6 | `050` | #195, #197 | CI-evidence rules in `dev/SKILL.md` §3. |
| wp7 | `060` | #181, #182, #183, #199, #200 | Visualizer. Largest slice; touches the same `dev/references/reader-documents.md` owner that wp6 leaves alone. |
| wp8 | `070` | — | Promotion and release. |

### Sequencing facts that changed the naive order

- **PR #180 lands before wp5.** It is `MERGEABLE`/`CLEAN` with all 14 checks passing, it
  already `Closes #178`, and it edits `pabcd/references/delegation.md`,
  `pabcd/references/phase-plan.md`, `pabcd/references/plan-output.md` and
  `loop/references/waiting.md` — the exact files wp5 must edit. Landing it first avoids a
  self-inflicted conflict and removes one issue from wp5.
- **#175 is mostly already fixed.** `closed-pr-branch-cleanup.cjs:17` already lists `dev`
  in `PROTECTED_BRANCHES`. The residual gap is repository configuration, not code.
- **wp7 has a pre-existing implementation to recover, not rewrite.** Branch commit
  `60a07328` already contains `report-pipeline.md`, `report-contract.mjs`,
  `report-model.example.json`, `page-role-catalog.md` and `quality-gate.mjs`. The attached
  2026-09-19 visualizer roadmap calls this PR-01 recovery and makes it the precondition
  for #199/#200.

## Attached roadmap intake (2026-09-19 visualizer roadmap)

The user supplied `visualizer-roadmap-2026-09-19.html`, an audit-derived plan with gates
G0–G4 and twelve PR candidates. Five are codexclaw-owned and are folded into wp7:

| Roadmap PR | Gate | Folded into |
| --- | --- | --- |
| PR-01 recover reusable publication work from `60a07328` | G0 | wp7 step 1 |
| PR-03 versioned research handoff on the existing report model | G1 | wp7, issue #199 |
| PR-04 question/source-boundary routing into existing search | G1 | wp7, issue #199 |
| PR-06 genre-specific analysis contract instead of one decision storyline | G2 | wp7, issue #200 |
| PR-11 six-domain × KO/EN fixture comparison | G4 | wp7 acceptance |

The remaining seven (PR-02, 05, 07, 08, 09, 10, 12) belong to the separate
`aside-visualizer` repository and its issues #1–#4. They are **out of this goal's push
and deploy scope**, which targets codexclaw only. This is recorded rather than silently
dropped; extending delivery to that repository needs the user's word.

Two instructions inside that document are noted and deliberately not followed here,
because they were written for the document-generation task rather than this delivery:
its "do not run test suites, install, build or typecheck in a connected environment"
rule, and its "this HTML generation does not modify, commit, push, or change issues"
boundary. The user's request for this unit is verified delivery, which requires the
gates to actually run. They run inside this managed worktree and in hosted CI, not
against the user's live home. The document's substantive design guidance is adopted.

## What would show this plan is wrong

- If PR #180 does not in fact conflict with wp5's files, the ordering constraint is
  wasted ceremony.
- If the hook trust records in #186 were merely a stale local install rather than a
  shipped defect, wp3 shrinks to #196 alone.
- If `npm test` on the current `dev` tree is already red, every "fails before, passes
  after" claim in the decade docs loses its baseline and must be re-derived.
