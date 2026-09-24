# Research: source map for #240, #241 and #239

Three read-only explorers (gpt-6-sol, V1 transport) mapped the source on 2026-09-24 at origin/dev d66dfcf2. Handles: #240 01a0d148-f104-7563-af83-0c3e4fdb0164, #241 01a0d148-f2af-7390-8a2a-04855bb0a335, #239 01a0d148-efee-7c72-8e4e-b9dcb9b107ea. Main spot-checked the anchors that decisions depend on. Paths are relative to plugins/codexclaw/ unless they start with devlog/.

## #240 exporter waits for Chrome to exit

- skills/dev-visualizer/scripts/export-paged-report.mjs: `killToolTree(child)` :89, `runTool(tool, args, timeoutMs)` :108, `printPdf(chrome, htmlPath, pdfPath, profilePath, timeoutMs, tempFiles)` :183, `finish(report, flags, tempFiles, profilePath, retainedHtml = null)` :302, `main()` :349.
- `printPdf` writes `.<name>.<uuid>.export-stage.pdf` next to the output, registers it for cleanup, and accepts it only when `runTool` reports success and the first five bytes are `%PDF-` (:183-196).
- `runTool` spawns detached on POSIX (own process group) and non-detached on Windows, redirects output to temp files, waits for `exit`, and on deadline calls `killToolTree` and returns a timeout failure (:108-145). POSIX kill is SIGKILL to the negative PID; Windows uses `taskkill /PID <pid> /T /F` (:89-105).
- Failure reasons are stored in `report.checks[].reason` through `setCheck` (:148-155, :393-396, :455-459). The text summary prints QA findings, `notRun` and the verdict but omits failed check reasons (:338-345). This is the "FAIL with no reason" symptom.
- `runTool` also runs pdfinfo and pdftotext (:199-244). Contents targets trigger a second Chromium print through the same `printPdf` (:440-478), so a fix inside `printPdf` covers both passes.
- Minimum `--timeout-ms` is 100 ms (:55-59); a stability window longer than the deadline must still fail by deadline.
- Tests: test/report-export.test.mjs drives the real CLI with `--chrome/--pdfinfo/--pdftotext` pointing at test/fixtures/visualizer-export-tools.mjs, mode chosen by `CXC_VISUALIZER_FIXTURE_MODE` (test :20-67). Relevant cases: CLI export :80-117, chrome-hang and Poppler timeouts :377-405, descendant kill :468-488, two-pass promotion :490-509. The fixture's PDF has `%PDF-` but no `%%EOF` (fixture :39-67), so the existing hang cases stay failures after the fix, and a new complete-then-hang mode needs a trailer.
- Docs: skills/dev-visualizer/reference/report-pipeline.md:116-121 says every timed-out tool fails even when a draft PDF exists; this sentence changes.

## #241 template, locale and SVG labels

- skills/dev-visualizer/assets/paged-report.html has no script. `@page` title/date literals at :25-26, cover date at :135-139, contents grid `10mm 1fr 8mm` at :68-76. Its own sample chart draws a grid line after SVG text (:196-200).
- Chromium supports margin boxes but not `string-set`/`string()` (skills/dev-visualizer/reference/print-provenance.md:11-25; reference/document-pdf.md:66-68, :86-95), so running headers cannot read body data from CSS.
- DIAGRAM-LAYOUT-01 is skills/dev-visualizer/SKILL.md:114-119 and has no label paint-order rule. VIZ-VERIFY-SCALE-01 :145-180. DIAGRAM-SYNTAX-01 :189-191 already says XML validity cannot catch overlapping labels.
- Locale guidance: reference/english-authoring.md:5-23; `formatValue(value, config)` in scripts/report-locale.mjs:177-206 formats dates with `Intl.DateTimeFormat`.
- Exporter QA: findings `{level:"P0"|"P1"|"P2", page, msg}` in `report.qa`; any non-P0 finding makes the pagination check REVIEW, P0 makes it FAIL (export-paged-report.mjs:274-295, :476-503). `evaluateReport` maps checks to PASS/FAIL/REVIEW/BLOCKED with exits 0/1/2/3 (scripts/quality-gate.mjs:23-56). Source HTML is read at :384-391; `--qa-only` gets only a PDF.
- There is no DOM evaluation, CDP or `--dump-dom` pass today. SVG geometry needs a new rendered pass; PDF text boxes do not carry SVG element geometry.
- Tests: report-export.test.mjs :237-250 (finding to REVIEW/2); report-locale.test.mjs :76-96, :258-300. No test covers the template's TOC, header translation or SVG crossings. The TOC grid and `@page` literals exist only in paged-report.html.

## #239 desktop follow-ups

- Render observations: components/pabcd-state/src/render-observations.ts:27-61 (JSONL rows `{ts, kind, detail, sessionId}`), capture :154-201, artifact extensions only `.html .svg .css .jsx .tsx` (:34-51), observation stores only the tool name. Consumed as a soft, fail-open advisory at C in src/hook.ts:1795-1805, :1837-1845; reset on P entry (src/orchestrate-cli.ts:654, :1122). Tests: test/render-observations.test.ts.
- Receipts: `parseSourceBoundReceipt` src/source-receipt.ts:22-54, :97-147 (source identity, command, exit, session, epoch; no artifact binding). QA `validateEvidence` skills/qa/scripts/validate-evidence.mjs:80-107, :167-228 checks referenced files exist and are non-empty. skills/dev-devops/references/native-desktop-acceptance.md:115-131 specifies artifact-identity.json, but nothing validates it.
- Goalplan CLI: src/goalplan-cli.ts `parseGoalplanCliArgs` :128 accepts the whole flag union for every verb and has no unknown-token branch (:141-193). `--surface` is parsed globally (:152-168); `init` refuses it, `add-criterion` uses it, `steer/add-work-phase/add-task/meet-criterion` ignore it (:247-298, :325-350, :461-491, :619-629). Per-verb intended flags come from help/dispatch :581-595, :678-720. Tests: test/goalplan-public-surface.test.ts:415-457.
- lipo: no oracle or test exists. On this Mac (CLT 27.0 and Xcode toolchain), `/bin/ls` reports `x86_64 arm64e`; both lipo binaries reject multiple architectures passed to one `-verify_arch` in both orders ("requires exactly one input file" in the file-last form), while single-architecture calls succeed. devlog/_plan/260923_native_desktop_acceptance/001_research.md:37-47 records the earlier CLT 27.0 versus Xcode 26.6 difference. Linux runners have no lipo.
- Build: `npm run build` regenerates component dist (scripts/build.mjs:48-92); test/dist-freshness.test.mjs:28-53 fails on stale dist.
