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

Peer PR created: https://github.com/lidge-jun/codexclaw/pull/228, head 2cab4597,
base dev. Peer reports focused 124 pass, build 183 files/no drift, gate and two
independent reviews PASS. Local full suite and hosted CI pending; main has not yet
independently verified merge/release readiness. Peer owns dev merge then SHA handoff.

wp1 B: Sol disjoint workers E=01a0c811-c533-7fd2-9278-462ce6687666,
R=01a0c811-c5fd-78a0-828a-23c9316ad53f,
L=01a0c811-c6c6-7522-bd74-4332246fb789,
X=01a0c811-c792-7263-b237-85d3ffc7740f. Main edits only shared doc integration.
Additional policy-only reviewer 01a0c814-d0af-7ec3-ad3b-e73f21fb9aa9 checks that
static HTML relief survives all references. No worker controls branches or state.
Full baseline: 3322 tests, 3317 pass, 1 fail, 4 skipped. Sole failure: GUI router
could not import uninstalled react. npm ci completed (84 installed, audit 0 issues);
focused GUI router then passed 2/2. Full release suite will run after implementation.

Policy-only independent review: four medium ambiguities (delivered report scope,
PDF-only assurance selection, standard-profile image review, bounded static-edit
pipeline scope) accepted and corrected. Same reviewer interdiff VERDICT PASS; no
mandatory render or model rebuilding remains for bounded static HTML/SVG edits.

Peer update: PR228 head advanced to 2bb3e8a3 for KO/ZH README parity after review;
review thread resolved by actual fix. Peer full suite reports 3323 total/3319 pass/
4 skip/0 fail after npm ci. README.ko.md/.zh.md also overlap at distinct architect
paragraphs; preserve alongside this task's visualizer paragraphs. Hosted latest-head
CI still pending. No version/count change on peer branch.

Peer #228 MERGED verified live: merge 0943bec3c07f4a921f3fb18a608cfd08ba632964,
reviewed head 2bb3e8a3928fe9d1e7388b40ccac3360341f97ea. Peer reports CI
35701748645 and Packed install 35701748719 success, resolved threads. origin/dev
fetched; do not merge while shared-tree workers write. Main takes existing local
plugin update after release (no new installation/account); distinguish installed
bytes from already-injected session context. Verify actual supported updater first.

wp1 integration first run: 134 report/exhibit/packaging tests pass. Independent
research review found nested non-cloneable retrieval data escaping DataCloneError
and duplicate refs accepted; accepted both, R resumed with regression repair.
Bilingual review found attrition/cancellation metric drift, unsupported directional
wording, sample/population overstatement and missing accessible qualifications;
accepted all, L correcting actual visible prose while preserving invariant values.
Real PDF smoke produced A4/Letter PDFs, QA-only passes both (2 pages each), but
Chrome153 process nontermination exposed missing timeout; E resumed same boundary.
No final C success is claimed from these intermediate greens.

Current reviewer handles: exhibit correctness 01a0c828-db64-7b02-91d4-ead312327966;
exporter 01a0c82b-11a1-7133-a04c-fcd93ca312a5; bilingual content
01a0c828-0df9-7be2-a926-0c2d252d8f5e; research reviewer
01a0c829-3a2d-7411-a73c-97499453082c closed after FAIL and can be resumed for
interdiff after R repairs. R/E authors resumed same handles; L still active.
CLI smoke artifacts: .codexclaw/evidence/01a0c7e9-f184-7913-a61e-9b216d85c15a/visualizer-smoke.
Main opened all four PNGs: 2-page KO A4 and EN Letter, long labels/Hangul legible,
actual geometry correct. Requested print 2-column metric grid (old 3+1 leaves gray
empty area) and quote/source grouping; re-export after L's semantic/layout fixes.
Original Chrome PIDs 76919/76943 and waiting exporter 76941 terminated individually;
ps confirms absent. Useful PDFs retained; timeout is not successful export proof.

Independent exhibit review found two High defects: generic rendering discarded
interval bounds/chronology dates and disguised all quantitative encodings as bars;
recipe-specific invariants (waterfall/cohort/interval/date/percentile) not validated.
Also row count overflow and null/undefined method inconsistency. Accepted all after
source inspection; X resumed same scope with faithful exact-table fallback allowed,
per-encoding invariants and actual output/negative tests. No new renderer dependency.
R fixed two findings with 9 observed red regressions, 52 focused pass; same reviewer
resumed to confirm interdiff. Final C remains pending.

Real PDF smoke: Chrome CLI minimal/virtual-time/stages isolated probes all wrote a
PDF but failed to exit within8s. This disproves one bad flag as sole cause; bounded
exporter correctly reports FAIL1 on timeout (files retained). Existing bundled
Playwright controlling same Chrome153 completed both KO-A4/EN-Letter exports and
closed browser, page errors empty. Both actual PDFs pass patched --qa-only with2
pages, A4 594.96x841.92 / Letter612x792. Local CLI lifecycle limitation is retained,
not relabeled success; no renderer dependency added to shipped package.

Final locale output: both actual Playwright PDFs' raster bytes are identical to
main-inspected final CLI-produced raster pages. Independent PDF oracles Hilbert
01a0c838-14e0-77a0-9cd4-5639793766f6 and Dalton
01a0c838-15bc-72f0-81d1-c2cc89aecc6f both PASS: metric mapping, glyphs, long labels,
2x2 grids, margins/folios and page-break containment. No arbitrary semantic or
accessibility-conformance claim. Bilingual content recheck PASS separately.

C exporter review found3High: first-page-only geometry, destructive old-output
unlink, timeout only kills parent. All accepted; FSM returned C->B and E resumed
same scope with every-page parsing, staged atomic output and owned descendant
cleanup. Source revision for previous184pass was pre-repair; rerun relevant/final
suite after fixes. Exhibit same-reviewer48tests +11 independent probes PASS.
Peer dev postmerge CI35702498985, WSL35702498954, Packed35702498961 reported green;
main merged0943bec3 and independently matches both delegated policy SHA256 values.

Integrated full suite after peer merge at5c9f13f: 3429 total,3425pass,4skip,0fail.
This predates the final exporter three-boundary repair; retain as integration
baseline, rerun full suite after final code before measuring published counts.

Final E same-reviewer PASS: all3 reproduced issues resolved,72 focused pass,
POSIX descendant cleanup verified; Windows awaits hosted CI. Main real QA-only
recheck now records both pages' A4/Letter geometry and PASS. L final repair51pass;
valid six JSON/HTML examples unchanged, so recorded PDF glyph/layout proof remains
applicable to the actual output bytes. Same locale reviewer rechecks boundary delta.
