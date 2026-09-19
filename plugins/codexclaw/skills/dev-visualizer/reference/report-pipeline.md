# Report publication contract

Use this path for reader-facing reports, technical briefs and analytical PDFs,
regardless of length. Keep `cxc-dev-visualizer` as the entrypoint. Do not create
separate public skills for voice, typography or captions: they are stages of one
report. A single diagram, native spreadsheet, form or conversational visual keeps
its own format route. A one-page brief does not need a cover and contents page.

## Evidence before prose, prose before layout

1. Record audience, decision/question and scope. Build a report model with the
   `assets/report-model.example.json` shape. Every claim is an observation,
   inference, hypothesis, recommendation or attributed statement. Bind sources by
   stable IDs, locators and observation dates; preserve important limitations.
2. Write a dot-dash storyline: answer first, then situation, complication,
   supporting reasoning, alternatives, action and limits. Each main heading must
   summarize its evidence. Read only those headings to test the argument.
3. Apply REPORT-VOICE-01 before `kwrite`. Do not infer the designer's mind from
   line counts or architecture. Distinguish the observed mechanism, its likely
   consequence and a proposed change. Sentence polish must preserve that distinction.
4. Compose semantic HTML. Use `data-claim="C1"` on the governed claim and
   `data-source="S1"` on its visible source note. Choose page roles from
   `page-role-catalog.md`. A role is not permission to invent data or shrink text.
5. Resolve approved local font files, their exact weights and provenance into a
   private manifest. Export and inspect the final PDF, not only the source HTML.
6. Collect the seven completed checks below against the final PDF's SHA-256.
   Rerendering invalidates every old PASS receipt. Run the final receipt gate.

The model and annotations are a structural contract, not semantic verification.
The exporter can reject dangling IDs; it cannot prove that prose faithfully
represents a source. A fresh reader must inspect claims, caveats and final pages.

## Local font binding

`assets/font-spec.example.json` is an operator-filled specification, not a usable
font bundle. Use approved files already available locally; no download/install is
implicit. Keep private paths and font binaries outside the repository.

```sh
node scripts/report-fonts.mjs /private/local-font-spec.json /private/font-manifest.json
node scripts/export-paged-report.mjs assets/paged-report.html /private/report.pdf \
  --engine playwright --font-manifest /private/font-manifest.json \
  --contract assets/report-model.example.json --json > /private/export.json
```

Run commands from this skill directory. The sealing command refuses to overwrite
an existing manifest. Record truthful version, license, source and PostScript
names; hashing binds selected bytes but does not authenticate those metadata.
All declared faces must actually occur in the PDF, and all emitted font names
must belong to the manifest. Include required symbols/weights, not unused faces.
`roles.body` and `roles.heading` select the CSS `--sans` and `--serif` families.
Font bytes remain in memory and the rendered PDF; never publish raw font files,
base64 font data or a portable HTML bundle containing those bytes.

## Export engines and readiness

`--engine auto` uses an already installed Playwright/Playwright-core adapter and
local Chromium. `--engine playwright` fails closed when unavailable. No package
or browser is installed by the exporter. `--chrome` selects an existing executable.
The fallback `chromium-cli` produces a draft with BLOCKED/3 because it cannot
prove resource readiness or inspect the DOM/contents. It does not satisfy final
publication. Its network behavior is not an offline certification.

The Playwright route uses a fresh isolated browser context, print media, reduced
motion, `preferCSSPageSize`, background printing and explicit font/image waits.
HTTP(S) resources are denied unless `--allow-network` is explicitly supplied.
Dynamic content must set `window.__REPORT_READY__` to a completion promise (or
true after completion), or start with `data-report-ready="pending"` and set it
to `true` only when final marks and values exist. Rejection, false, invalid state,
timeout, page error and failed resources stop the export. A canvas without an
explicit completion signal fails. A promise itself does not prove chart semantics.

The same loaded page is used for both TOC passes, preserving selected state.
Full heading text must uniquely identify its page after the contents page. No
prefix guessing: unresolved, ambiguous, duplicate and missing targets/slots fail.
Repeated running-header titles or multi-page contents may need disambiguation;
inspect any failure instead of inventing page numbers. `--keep-html` writes a
non-overwriting diagnostic snapshot, not a portable/re-exportable font or canvas
bundle. `--qa-only <pdf>` runs only the automated PDF checks, not HTML readiness.

## Automated export is not final delivery

Exporter exit codes: **0** automated checks passed; **1** failed; **2** review
findings; **3** required checks not run. Its JSON always says `deliveryReady:false`.
Whitespace, apparent orphan fragments and density are review heuristics. Read
page images and justify intentional space by the page's role; never fill it with
unnecessary content to make a heuristic disappear.

For final delivery, supply a receipt with `artifact_sha256` and `checks`. Each
check has `id`, `status`, and, for PASS, the exact same `artifact_sha256` plus a
nonempty `evidence` locator. Required IDs:

| Check | Evidence producer must verify |
|---|---|
| `pdf-parse` | Actual file, parser, page geometry and count |
| `text-integrity` | Complete text, totals, last records and selected values |
| `font-and-glyphs` | Used/embedded faces and visibly correct Hangul, symbols and weights |
| `pagination` | TOC, page furniture, table continuations, breaks and role-appropriate whitespace |
| `visual-pages` | Render and inspect every final PDF page |
| `claim-evidence` | Sources support claims; comparisons and causal strength are justified |
| `editorial-review` | Fresh reader recovers answer, reason, action and limitations without author-intent narration |

```sh
node scripts/quality-gate.mjs /private/report.pdf /private/qa.json
```

FAIL wins over BLOCKED, which wins over REVIEW, which wins over PASS. Missing
checks, legacy `notRun`, empty evidence and stale hashes never pass. The CLI
compares the receipt to bytes on disk; it does not authenticate a reviewer or
read evidence locators. Never synthesize PASS receipts from a successful export.
Save the real reviewer, scope, page coverage, findings and resolutions in the
referenced evidence. This gate is an explicit command, not a hook-enforced skill.

## Maintenance proof

```sh
node --test plugins/codexclaw/test/report-*.test.mjs
node --test plugins/codexclaw/test/report-browser.smoke.mjs
```

These commands run from the repository root. The first is dependency-free; the
second explicitly needs an available browser/driver and fails instead of skipping
when missing. Keep real Korean PDF generation and page-image review in addition.
