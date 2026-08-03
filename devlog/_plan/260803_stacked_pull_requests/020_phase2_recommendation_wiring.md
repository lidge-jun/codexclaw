# 020 — Phase 2: Recommendation wiring into the workflow skills

Unit: `260803_stacked_pull_requests` · Work-phase: WP3 · Depends on: WP2 (the
`DEV-STACK-*` ids and `dev/references/stacked-prs.md` must exist before anything points at
them). Deliverable: the family actually *recommends* stacking at the decision points where
stack-shaped work is produced, without duplicating the doctrine.

Independently verifiable: `rg -n "DEV-STACK-" plugins/codexclaw/skills` shows pointer-only
mentions in the four skills below; `npm run gate` + `npm test` exit 0.

## Scope

IN (4 files, all MODIFY):
`plugins/codexclaw/skills/pabcd/SKILL.md`,
`plugins/codexclaw/skills/loop/SKILL.md`,
`plugins/codexclaw/skills/dev-code-reviewer/SKILL.md`,
`plugins/codexclaw/skills/dev-devops/SKILL.md`.

OUT: `dev` (WP2 owns it — do not re-edit), frontmatter/keywords (WP4), any new file.

Stub discipline (rewritten after A-gate round 2 — compression was not enough; see
`001_audit_synthesis.md`). Every edit below is **at most 3 added lines** and carries
exactly three things:

1. the **local trigger** — what, in *this* skill's own workflow, means "consider stacking";
2. the **rule ids**;
3. the **canonical path** (`cxc-dev` `references/stacked-prs.md`).

No stub may contain topology, depth numbers, cascade steps, CI statements, review
mechanics, or merge semantics. **Acceptance test:** if a reader could act on the stub
without opening the owner file, it is still doctrine and must be cut. Round 2's reviewer
checklist was not shortened but *relocated* — it is now `DEV-STACK-05` in the owner.

## M1 — `pabcd/SKILL.md`: phase map → PR stack

**Anchor:** phase `1. **P — Plan**`, immediately after the PHASE-SPLIT-01 sentence that
ends "...Phase boundaries encode the system's build order, not the schedule."

```diff
 ... Phase boundaries encode the system's build order, not the schedule.
+**A dependency-ordered phase map may be publishable as a PR stack (`DEV-STACK-01`).** When
+the unit will produce dependent branches too large to review as one diff, P decides
+whether to stack and records it. Rules: `cxc-dev` `references/stacked-prs.md`.
```

**Anchor 2:** phase `3. **B — Build**`, after the existing `DEV-GIT-COMMIT-01` sentence.

```diff
 4. **B — Build**: Implement the audited plan in small atomic commits (DEV-GIT-COMMIT-01). ...
+   When P declared a stack, follow `DEV-STACK-02` in `cxc-dev`
+   `references/stacked-prs.md`.
```

Rationale: P is where the slicing decision is already being made; adding the stack
decision anywhere later means the branches already exist in the wrong shape.

## M2 — `loop/SKILL.md`: LOOP-GIT-01 gains the stack checkpoint

**Anchor:** `## Git discipline in loops (LOOP-GIT-01)`, as a third bullet after the
"Push requires explicit user approval" bullet (line ~317).

```diff
   named — do not extend it beyond that scope.
+- **A dependent work-phase chain may be publishable as a stack (DEFAULT).** A
+  `LOOP-UNIT-CHAIN-01` chain is stack-shaped: each cycle consumes the previous cycle's
+  verified output. Rules: `cxc-dev` `references/stacked-prs.md` (`DEV-STACK-01`).
```

Also extend the closing pointer line of that section:

```diff
-Canonical rule ids: `DEV-GIT-COMMIT-01` and `DEV-GIT-PUSH-01` in `cxc-dev` §5.
+Canonical rule ids: `DEV-GIT-COMMIT-01`, `DEV-GIT-PUSH-01`, and the `DEV-STACK-*` family
+in `cxc-dev` §5 / `references/stacked-prs.md`.
```

## M3 — `dev-code-reviewer/SKILL.md`: reviewing a stack

**Anchor:** `### Pre-Review Checklist` (line ~118), as a new subsection immediately after
that checklist block and before the `---` that precedes `## 2. Quality Thresholds`.

The checklist that lived here in rounds 1–2 has been **relocated** to the owner as
`DEV-STACK-05` (see `010`). Review mechanics for stacks are stack semantics. What remains
here is the trigger that sends a reviewer there:

```diff
 - The diff is small and structured enough to review.
+- If the PR is one layer of a stack, follow `DEV-STACK-05` in `cxc-dev`
+  `references/stacked-prs.md` — review scope, standalone judgment, base-ref and
+  force-push checks, and the merge boundary all live there.
```

## M4 — `dev-devops/SKILL.md`: CI/merge-queue interaction

**Anchor:** `### §2.1 Pipeline Stages (DEFAULT)`, appended after the pipeline code block
(line ~103), before `### §2.2`.

```diff
 [dev-devops]      build-image → scan → push-registry → deploy-staging → smoke → promote → deploy-prod
 ```
+
+**Stacked PRs change pipeline sizing (DEFAULT).** When sizing pipelines for a stack of
+pull requests, follow `DEV-STACK-03` in `cxc-dev` `references/stacked-prs.md`.
```

## Accept criteria (WP3)

1. Four files modified; each mention is a local trigger + rule ids + canonical path, **≤3
   added lines**, and none restates topology, depth numbers, cascade steps, CI arithmetic,
   review mechanics, or merge semantics. Apply the acceptance test above to each stub.
2. `rg -n "stacked-prs.md" plugins/codexclaw/skills` returns ≥5 hits (owner + 4 stubs).
3. `npm run gate` exits 0 — note `checkForbiddenClaims` scans SKILL.md text, so no new
   line may claim hook enforcement (all four edits are DEFAULT-class agent discipline).
4. `npm test` exits 0.
5. A reader landing in `pabcd` P or `loop` LOOP-GIT-01 is told *when* to stack and where
   the rules live, without needing the owner file to make the decision.
6. No stub contains a CI-rerun or "depth × cascades" claim (A-gate round 2, blocker 1).

## Risk (retired by A-gate round 1)

`gate.mjs::checkForbiddenClaims` scans the skills tree for false-enforcement phrasing. The
reviewer read the three regexes at `gate.mjs:123-127` against this phase's proposed text
and found no match; `checkCounts` (`gate.mjs:277-288`) only compares manifest hook
declarations to on-disk hook JSON, so a new `references/*.md` cannot affect it. Still run
`npm run gate` before the commit — the check is cheap and the accept criteria require the
fresh output.
