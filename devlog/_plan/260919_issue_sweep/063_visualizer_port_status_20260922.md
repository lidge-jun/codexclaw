# 063 — Visualizer upstream-first policy and port audit

Audited 2026-09-22. The current maintenance direction is **codexclaw shared fixes
first → Aside adaptation → downstream verification → Aside issue closure**.
This updates the earlier no-Aside-roadmap interpretation for explicitly requested
maintenance; ordinary artifact requests still grant no independent maintenance
mandate. The portable policy lives in
[port-maintenance.md](../../../plugins/codexclaw/skills/dev-visualizer/reference/port-maintenance.md).
Aside's README owns the downstream port ledger.

## Scope and source identity

This work audits implementation and records the requested maintenance policy.
It does not implement the remaining runtime features, push, publish, install,
modify GitHub issues or close any issue. Existing issue #1–#4 acceptance criteria
remain the completion boundary, not the smaller subset already implemented here.

| Source | Exact revision |
|---|---|
| codexclaw remote main | `1914fb679b2f625989be5af2322eec8a749663d4` |
| codexclaw remote dev | `d9d8a086a1da586008d88c8c9328b781f43e4ca0` |
| Aside remote main and local HEAD | `03b7794bbf72f1a36bae29592bc5e2ba00c68ced` |

`git diff origin/main origin/dev -- plugins/codexclaw/skills/dev-visualizer`
was empty. The relevant test files also had no main/dev difference. Local
codexclaw documentation work branches from the verified dev revision. Aside's
pre-existing untracked `.DS_Store` is unrelated and preserved. Installed skill
copies and Aside account activation were not audited.

## Implementation matrix

Paths in the codexclaw column are relative to
`plugins/codexclaw/skills/dev-visualizer/`; Aside paths are relative to its root.
Line anchors refer to the source revisions above, before these documentation edits.

| Aside issue | codexclaw main/dev | Aside main | Closure decision |
|---|---|---|---|
| [#1](https://github.com/lidge-jun/aside-visualizer/issues/1) | Exporter fix absent. `scripts/export-paged-report.mjs:124–128` records skipped tools; `:223–234` ignores them in verdict/exit. `scripts/quality-gate.mjs:31–33` blocks legacy NOT RUN only when invoked separately. | Same defect at `scripts/export-paged-report.mjs:100–103,199–210`. No-Chrome guide `reference/no-chrome-pdf-export.md:83` delegates QA to this exporter. No structured check outcomes or isolated regression fixtures. | Keep open; fix shared exporter first. |
| [#2](https://github.com/lidge-jun/aside-visualizer/issues/2) | Partial: shared model, optional versioned research section, source/output language separation, question/claim/source IDs, gaps and `researchReceipt` in `scripts/report-contract.mjs:39–121`. No complete host adapter, source-SHA/template/recipe receipt or full portable parity corpus. | Model, handoff and receipt absent. Intake in `SKILL.md:22–38` is supplied-material/output-format guidance. README records the old snapshot/adaptations. | Keep open; port the existing foundation and finish the remaining criteria. The new README ledger is documentation only. |
| [#3](https://github.com/lidge-jun/aside-visualizer/issues/3) | Partial foundation: language fields above; genre rules at `reference/report-writing.md:19–37`. No English-native genre examples or paired semantic/locale fixture suite. Genre tests check rule text, not bilingual meaning. | Korean templates at `assets/paged-report.html:2`, `assets/editorial-report.html:3`; no bilingual fixtures. Letter guidance at `reference/document-pdf.md:61` coexists with fixed A4 QA at exporter `:146`. | Keep open; upstream language field support is not English parity. |
| [#4](https://github.com/lidge-jun/aside-visualizer/issues/4) | General visual guidance and `reference/page-role-catalog.md:7–15` exist. No analytical recipe schema, domain-diverse recipe fixtures or misleading-encoding negative suite. | General question-based guidance at `reference/visual-design.md:20` and evidence guidance at `:153`; no analytical recipe contract/tests. | Keep open; page composition is not an analytical method. |

## What actually merged

- `ce6cba65871d227ff1d8800f99de83225c19947a` recovered the additive model, page
  roles, pipeline document and separate receipt gate. Its commit message explicitly
  excludes the exporter migration, browser/PDF/font helpers and their tests.
- `70155d239daf0935a1d64d28a5355e59b483399b` added the research handoff and closed
  codexclaw #199. `9db43d990d4bbf0d255916f4835655f216dbe4e0` added genre rules and
  closed #200. Both issues were confirmed CLOSED by GitHub, and all three commits
  are ancestors of current main. Their scopes do not satisfy all Aside criteria.
- Historical exporter fix `e4c90f67` is a recovery candidate, not a main/dev fix.
  Do not infer integration from its existence on another branch. The earlier
  [recovery matrix](062_wp7b_recovery_matrix.md) still identifies the runtime work.
- The recovered pipeline document describes exporter capabilities that did not
  ship with it. This change adds an implementation-status notice rather than
  presenting those target commands as available runtime behavior.

## Fresh verification

The six existing suites ran on the current source: `report-contract.test.mjs`,
`report-research-handoff.test.mjs`, `report-quality-gate.test.mjs`,
`report-genre-contract.test.mjs`, `report-export.test.mjs`, and
`visualizer-packaging.test.mjs`, under `plugins/codexclaw/test/`.
Result: **78 passed, 0 failed, 0 skipped**. These suites do not establish full
downstream parity, English semantics or analytical recipe quality.

Independent defect probe: create a temporary `%PDF-1.4` placeholder, run each
repository's exporter with the absolute Node executable and
`--qa-only <temporary.pdf> --json`, and set child PATH/HOME/TMPDIR to the isolated
temporary directory. This deliberately makes PDF tools unavailable without
uninstalling anything. No browser or real user data is involved. Both returned:

```json
{"exitCode":0,"verdict":"PASS","notRun":["pdftotext/pdfinfo missing: contents page numbers and layout QA NOT RUN"]}
```

The placeholder is not evidence of a valid PDF: the defect is that no parser
verified it, yet the exporter reported successful verification. Separate-gate
tests pass because that gate has the guard the exporter lacks. This distinguishes
documentation, a callable helper and behavior on the actual export path.

## Recorded changes and next boundary

Updated SKILL scope, English/Korean/Chinese README summaries, structure index and
pipeline implementation notice; added the portable maintenance workflow and this
audit in the existing issue-sweep record. Aside README now carries the same
direction, closure rules and dated issue ledger. No new runtime engine or test
was introduced. Next implementation work should repair #1 in codexclaw, preserve
the existing output-directory regression, then port and validate it in Aside.
