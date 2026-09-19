# 060 — wp7: dev-visualizer (#181, #182, #183, #199, #200)

The largest slice, and the one the user's attached roadmap speaks to directly. It splits
cleanly into two halves: three packaging and delivery defects that are small and
independent, and two analysis-contract issues that depend on a prior decision.

## Ordering decision: the `60a07328` question comes first

Both the advisor and the attached roadmap (its PR-01) reach the same conclusion
independently: a work branch at commit `60a07328` already contains
`reference/report-pipeline.md`, `scripts/report-contract.mjs`,
`assets/report-model.example.json`, `reference/page-role-catalog.md` and
`scripts/quality-gate.mjs`. #199 and #200 both extend exactly those files. Building a
second evidence model beside the existing one is the specific failure the roadmap's G0
gate exists to prevent.

So step one is a recovery decision, recorded as a table of which commits are taken, which
are held, and why — not a blind merge of that branch. Its "review, merge, deploy, actually
loaded" states stay distinct; a branch existing is not a shipped feature.

If recovery proves too large for this unit, #199 and #200 are deferred with that reason
recorded, and only #181, #182 and #183 ship. That is an acceptable outcome and is
preferable to duplicating the report model.

## #181 — the exporter reaches Chrome with a missing output directory

`scripts/export-paged-report.mjs:41` resolves the output and `:42` validates only the
input. `:99` calls `printPdf` and `:67` hands the missing-directory destination to
Chrome. The failure surfaces at `:69` as `fail("chrome print failed: " + ...)`, exiting 1
at `:61` — an explicit handler producing a misleading message, not a crash.

**MODIFY** `plugins/codexclaw/skills/dev-visualizer/scripts/export-paged-report.mjs`

- Before: `import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";`
- After: the same plus `mkdirSync`.
- Before: `if (!flags.qaOnly) printPdf(input, output);`
- After: a guarded block running `mkdirSync(dirname(output), { recursive: true })`,
  catching failure and reporting the directory and filesystem error code, then calling
  `printPdf`. Never create directories under `--qa-only`.

**NEW** `plugins/codexclaw/test/report-export.test.mjs` — isolated temporary fixtures and
a fake Chrome executable: a missing nested parent succeeds; an existing parent succeeds;
a regular file occupying the parent path fails with a directory-specific diagnostic
*before* Chrome; `--qa-only` creates nothing.
`node --test plugins/codexclaw/test/report-export.test.mjs`.

If `60a07328` is integrated first, apply the equivalent guard before its staged-output
creation at `scripts/export-paged-report.mjs:67`; that version lacks the preparation too,
so the fix must not be lost in the merge.

## #182 — shipped provenance points outside the payload

Complete inventory: `reference/document-pdf.md:94`
(`devlog/_plan/260909_visualizer_report_quality/evidence/chrome-paged-probe.md`),
`document-pdf.md:132`
(`devlog/_plan/260909_visualizer_loop_merge/evidence/aside-G_cjk_typography.md`), and
`reference/report-writing.md:12` plus its implicit back-references at `:170-171`.

The issue overstates one thing: both cited files *are* tracked at HEAD `03541398`. They
are absent from the installed plugin and from a standalone copy, so the defect is
packaging, not fabrication. Copying the raw logs would import a second problem — the CJK
evidence at `:11` carries tool-specific citation IDs.

**NEW** `plugins/codexclaw/skills/dev-visualizer/reference/print-provenance.md` —
sanitized summaries with dates, version and scope, and real source locators, separating
measured Chromium observations from practice recommendations and unverified engine
claims. No session scratch paths, no internal citation IDs.

**MODIFY** `document-pdf.md` and `report-writing.md` — replace the three `devlog/_plan`
pointers with relative links to `print-provenance.md#chromium-probe`,
`#cjk-typography` and a report-writing provenance section.

## #183 — six references escape the skill root

`SKILL.md:45`, `:48`, `:60` and `:75` link `../dev/references/reader-documents.md`;
`reference/document-pdf.md:41` links `../../dev/references/reader-documents.md`; and
`reference/report-writing.md:5` names the dependency in prose, where a Markdown link
checker would miss it. All six lose their target when only `dev-visualizer/` is copied.

Everything else checked stays inside the skill. The remaining external paths are optional
capability defaults, not missing dependencies: `upstream/sync-check.sh:7,26` uses the
configurable visualize cache, `scripts/export-paged-report.mjs:46-48` probes browsers,
and `scripts/diagram-to-html.sh:20` uses `/tmp/codex-diagrams`.

**NEW** `plugins/codexclaw/skills/dev-visualizer/reference/reader-documents.md` — the
portable READER-DOC-01 to 05 contract with canonical-owner and version attribution.
Do not copy the canonical file blindly: `dev/references/reader-documents.md:127` itself
contains another repository-only ledger pointer, and its visualizer cross-references need
rebasing.

**MODIFY** the six references above to point at the local copy, retaining attribution.

**NEW** `plugins/codexclaw/test/visualizer-packaging.test.mjs` — shared by #182 and #183.
Resolve every shipped local link and anchor against an isolated single-skill copy, assert
required dependencies cannot escape the skill root, and reject `devlog/_plan` pointers in
the portable skill. Add synchronization coverage between the portable copy and the
canonical source with explicitly allowed provenance differences.
`node --test plugins/codexclaw/test/visualizer-packaging.test.mjs`.

Duplicate rule text can drift; that risk is accepted and bounded by the synchronization
test. Symlinks and a second mandatory sibling dependency are both rejected.

## #199 — no research/evidence handoff

`SKILL.md:22` collects a general brief, `:38-51` routes chiefly by output format, and
`:59-62` proceeds into composition. The reverse handoff does not exist. The capability it
should connect to already does: `skills/search/references/deep-research.md:12`, `:45-58`
and `:113-124` own explicit deep-research entry, budgets, contradictions and the ledger,
and its delivery route already points at visualizer at `:128`.

This is the roadmap's PR-03 and PR-04 combined, and it extends the existing model rather
than adding a second one.

**MODIFY** `SKILL.md` — before: `Infer the audience, question to answer, source material
and output format`; after: require report intake before composition, routed to the local
publication contract.

**MODIFY** `reference/report-pipeline.md` — before: `Record audience, decision/question
and scope. Build a report model...`; after: a versioned intake carrying audience,
question, domain, genre, the supplied-source boundary, freshness and stakes, source and
output languages, route, and a bounded budget. Map questions to existing claim IDs to
source locators and spans, carrying dates, scope, status, alternatives, counter-evidence
and unresolved gaps.

**MODIFY** `scripts/report-contract.mjs` and `assets/report-model.example.json` — extend
the existing model with a versioned research-handoff section, retaining the existing claim
kinds (`observation`, `inference`, `hypothesis`, `recommendation`, `attribution` at
`report-contract.mjs:4`; schema v1 at `:7-25`). Validate the handoff when supplied; never
silently upgrade a legacy v1 document into a research-complete report.

Three routes, per the roadmap's route selection: supplied-source only, bounded lookup of
specific gaps, and explicitly requested deep research. Source-only performs no external
retrieval and must not acquire implicit browsing.

**Verification.** MODIFY `plugins/codexclaw/test/report-contract.test.mjs` (arrives with
the `60a07328` recovery); NEW `test/fixtures/report-research/` with frozen policy, UX and
software cases covering all three routes plus empty evidence, discovered-only sources,
unresolved conflicts and exhausted budgets. Tests prove shape, reference integrity and
route constraints. Whether a source actually supports a claim is human review, and the
document says so.

## #200 — one storyline imposed on every genre

`reference/report-writing.md:19` makes "the document is one argument" strict, `:49-55`
require every H2 to be a claim ending at an ask, and `:68-78` make the summary a
decision. The canonical owner repeats it: `dev/references/reader-documents.md:24`
distinguishes genres but `:36-43` redirects them all back into claim headings and a
requested decision.

This is the roadmap's PR-06.

**MODIFY** `reference/report-writing.md` — genre-selected structure instead of one
argument. Decision memos keep status quo, alternatives, tradeoffs and triggers. Research
syntheses carry questions, method, conflicting evidence and unresolved findings.
Explanation and history carry mechanism or chronology with competing interpretations.
How-to and reference carry task steps or definitions. Scope summary, exhibit titles and
the fresh-reader requirement stay consistent across all of them. Do not force length or
section counts.

**MODIFY** `SKILL.md:77-82` — the claim-headings-to-an-ask requirement becomes the genre
contract.

**MODIFY** `plugins/codexclaw/skills/dev/references/reader-documents.md` — required
expansion, not optional: leaving "Every heading below it states a claim" and "decision
being asked" in place would make the canonical guidance contradict the fix. #183's
portable copy synchronizes with it.

**Fixture.** `assets/paged-report.html` contradicts itself — `:224` says random
allocation while `:236` and `:295` say alternating. `60a07328` already corrects this in
`assets/report-model.example.json:7-14` with nonrandom and short-observation limitations.
Take that correction and keep the contradictory version as a negative fixture rather than
the live example.

**Verification.** MODIFY `test/report-contract.test.mjs` and
`test/report-quality-gate.test.mjs`; NEW `test/fixtures/report-analysis/manifest.json`
with the roadmap's twelve frozen cases (policy, economics/business, UX, science, history,
software/operations, each Korean and English), plus negatives for random-versus-alternating
methods, unsupported probabilities, unlabeled illustrative values and denominator changes.
Structural coverage and missing-review failure are automated. Semantic detection and the
baseline-versus-research-versus-genre comparison are human review on identical sources —
the roadmap's PR-11, whose 48 comparison slots are a plan, with executed count and
omissions recorded separately.

No page count, chart count, search count or agent count is used as a quality score.

## Out of scope

The seven `aside-visualizer` PRs from the attached roadmap (PR-02, 05, 07, 08, 09, 10,
12) belong to a different repository with its own issues #1-#4. They are recorded in
`000_plan.md` and not delivered here.
