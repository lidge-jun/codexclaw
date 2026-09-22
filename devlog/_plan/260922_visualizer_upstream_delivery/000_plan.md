# Visualizer shared fixes and Aside delivery

Make the shared visualizer truthful and useful, then port it to Aside: no mandatory
render round trip for simple static HTML/SVG, explicit failed/skipped verification
for PDFs, portable evidence handoff, English/bilingual semantics and analytical
exhibit recipes. Ship both repositories through dev and prove their releases.

## Loop contract

- Archetype: satisfy-spec, C3 implementation with C4 release boundary.
- Trigger: user authorized both repositories' fixes, dev integration, deployment,
  and gpt-5.6-sol subagents; preserve the existing simple-static verification policy.
- Goal/stop: issues #1–#4 fully satisfied downstream, verified dev integrations and
  published releases; then close the issues with evidence. No partial completion.
- Non-goals: unrelated codexclaw issues, renderer migration for its own sake, new
  research services, user-account tests, system-wide installs or remote fleet rollout.
- Verifier: isolated report/export/contract/locale/exhibit fixtures, relevant repo
  gate/build/suite, independent review, fresh per-PR CI and published archive hashes.
  Never count a skip, missing tool or mere version string as runtime proof.
- Memory artifact: this directory and session-bound goalplan. No durable user-memory writes.
- Outcomes: DONE only with all criteria; actual external failures stay unmet; no
  invented budget exhaustion. No user token/cost/wall-clock bound was specified.
- Credential scope: existing GitHub access to lidge-jun/codexclaw and
  lidge-jun/aside-visualizer only. Write scope: files listed in decade documents,
  related dev/main PRs/tags/releases/issues. No force pushes or unrelated settings.
- Escalation: permission/access loss or incompatible existing work; preserve work
  and report exact failure. Main reclaims failed packets only after safe retirement.

## Dependency order

| Cycle | Artifact | Outcome |
|---|---|---|
| wp0 | This roadmap + 010/020/030 | Audited docs-only design locked before code |
| wp1 | 010_shared.md | Shared contracts/export behavior and isolated fixtures |
| wp2 | 020_aside.md | Verified port on dev preserving Aside-specific adapters |
| wp3 | 030_delivery.md | Dev/main integrations, exact-SHA release proof, issue closure |

Main owns branch operations sequentially. Parallel workers are V1 subagents sharing
one codexclaw checkout with disjoint write scopes, not independent branch lanes.
All requested worker model overrides use gpt-5.6-sol. Actual served routing is not
claimed without runtime evidence. No artificial total agent limit is imposed.

## Baseline and evidence

See ../260919_issue_sweep/063_visualizer_port_status_20260922.md. Main and dev share
visualizer sources. Missing-Poppler probe returns PASS/0 in both exporters. Existing
78 report/packaging tests and gate/inventory checks passed before implementation.
Shared entrypoint already has VIZ-VERIFY-SCALE-01; Aside does not yet have it.
Prior documentation commits: codexclaw f26df4da, bda98d26; Aside 19633da.

## Consultation and review

Native V1 exposes no agent_type field, so a native architect transport is unavailable.
This is an explicitly disclosed procedure limitation, not completed native architect
consultation. Generic read-only Sol advisor 01a0c7fa-36e5-71e3-92b8-e4912015d723
provides design/reflection; independent Sol review checks the executable plan.
Main retains decisions. No role registration or restart is performed implicitly.

## Source-of-truth synchronization

Maintain shared SKILL.md and reference/report-pipeline.md, port-maintenance.md and
structure/INDEX.md; Aside README owns the downstream ledger. Historical audit remains
a dated snapshot; append new evidence rather than rewriting history as completion.

## Continuity

wp0 is in P. No production implementation has started in this loop.

## Verifier observations before implementation

- `node --test plugins/codexclaw/test/report-*.test.mjs plugins/codexclaw/test/visualizer-packaging.test.mjs`: exit 0, 78 pass, directly imports/executes the shared source paths.
- `node plugins/codexclaw/scripts/gate.mjs`: exit 0, declared skill/reference and structure scan; no semantic authoring proof.
- `node plugins/codexclaw/scripts/inventory.mjs --check`: exit 0, package inventory/count consistency only.
- `node --check plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs`: exit 0, target script syntax only.
- New locale/exhibit/intake verifiers do not exist before B; they are planned work,
  not a claimed existing guard. Their first observed execution is required in C.

## User-authorized release coordination (2026-09-22)

User assigned this task as main coordinator with peer
01a0c801-664b-75d0-b27a-4e0c7bc6e4df (Clarify Sol subagent approval prompt), cwd
/Users/jun/.codex/worktrees/b7ca/codexclaw. Peer owns v1 logical architect compatibility;
this task owns visualizer and final shared release integration. Requested peer to
prepare reviewed dev PR/CI, leave version bump/promotion/release dispatch to main,
and return exact revision evidence. Agreement pending reply; delivery is not acceptance.
No other peer work or task FSM authority is assumed. Shared release readiness must
include this peer's completed fix, not publish visualizer alone before reconciliation.

Peer accepted: branch codex/v1-architect-compat from d9d8a086, owns rules/payload
regressions, independent review, dev PR/CI/merge, leaves final bump/main promotion/
release dispatch to this task and does not touch visualizer. Peer requests final
release tag/SHA/run/payload evidence after publication. Agreement arrived through
native delegated message, not inferred from delivery ACK.

Design advisor reflection D1–D6: accepted D1/D4 unchanged. Accepted D2 check-ID reuse
and evaluateReport aggregation; D3 exact adapter/evidence/provenance shapes; D5 recipe
versus instance split; D6 README-only issue-status ownership. Exact interfaces added
to 010 and duplicate status field removed from 020. Same advisor asked to reflect on
amended docs before wp0 closes. These are source-grounded design decisions, not a
claim that native architect registration exists.

Peer scope refinement: runtime already supports v1 role markers/config/overrides/fork;
peer reports 124 related tests green and plans documentation-only compatibility fix.
Overlap is README.md and structure/INDEX.md at different sections; main will merge
fresh dev and preserve both. Peer will not change version/inventory. Main awaits
actual PR/SHA/test artifacts before treating that work complete.

Same-advisor final reflection after D2/D3/D5/D6 amendments: ALIGNED, no remaining
bounded architecture mismatch. Main accepts the decision mapping. Generic V1 prompt
transport limitation is disclosed; no claim of native architect permissions.

Independent A round 1 FAIL (reviewer 01a0c800-c374-7ac3-8e2d-57bcaa3f2450):
B1 hash-name mismatch, B2 package provenance ambiguous, B3 visible localization chain
missing. All accepted: canonical artifact_sha256, separate packageVersion, executable
renderLocalizedExample chain + output assertions/print smoke. Same reviewer rechecks
interdiff. No code was built under the failed audit.

wp0 audit round 2: VERDICT PASS, blocking_issues none. Same-advisor design-delta
reflection ALIGNED. Roadmap finalized with no production code changes. Planned D
conclusion: proceed to wp1 shared implementation under the locked interfaces,
then port verified source to Aside before any closure/release claim.
