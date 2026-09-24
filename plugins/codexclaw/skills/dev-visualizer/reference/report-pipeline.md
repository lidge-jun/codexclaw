# Report publication contract

Use this path for new or substantively revised analytical reports/briefs, or
explicitly selected publication work. Bounded edits to an existing static HTML
report skip steps 1–4 below: preserve the supplied structure and review the source
without rebuilding its report model or forcing a render. Keep `cxc-dev-visualizer` as the entrypoint. Do not create
separate public skills for voice, typography or captions: they are stages of one
report. A single diagram, native spreadsheet, form or conversational visual keeps
its own format route. A one-page brief does not need a cover and contents page.

## Evidence before prose, prose before layout

1. Record audience, decision/question and scope. Build a report model with the
   `assets/report-model.example.json` shape. Every claim is an observation,
   inference, hypothesis, recommendation or attributed statement. Bind sources by
   stable IDs, locators and observation dates; preserve important limitations.
   When the report answers a question rather than reformatting supplied material,
   record the research handoff too (below). Composition begins after intake, not
   instead of it.
2. Write the storyline in the shape the genre asks for (REPORT-STORY-00 in
   `report-writing.md`). A decision document opens with the answer, then situation,
   complication, supporting reasoning, alternatives, action and limits. A research
   synthesis runs question, method, evidence, conflict and what is unresolved; it does
   not close on an action it has not earned. Each main heading summarizes its own unit.
   Read only those headings to test the sequence.
3. Apply REPORT-VOICE-01 before `kwrite`. Do not infer the designer's mind from
   line counts or architecture. Distinguish the observed mechanism, its likely
   consequence and a proposed change. Sentence polish must preserve that distinction.
4. Compose semantic HTML. Use `data-claim="C1"` on the governed claim and
   `data-source="S1"` on its visible source note. Choose page roles from
   `page-role-catalog.md`. A role is not permission to invent data or shrink text.
5. For requested PDF output, choose available approved fonts and record provenance
   without redistributing font files. Export and inspect the actual PDF at the
   chosen assurance depth; ordinary HTML authoring does not trigger this step.
6. For PDF delivery, choose the assurance profile for what this artifact actually is
   (REPORT-ASSURANCE-01), then collect that profile's completed checks against the
   final PDF's SHA-256. Rerendering invalidates every old PASS receipt. Run the
   receipt gate and report the verdict together with its profile.

The model and annotations are a structural contract, not semantic verification.

## Research handoff (REPORT-RESEARCH-01)

Choosing an output format does not record what was asked or how far the answer was
allowed to reach, so the publication step used to rediscover both from the prose. An
optional `research` section on the model carries it instead. It **extends** the model
above; it is not a second model, and a report without it stays exactly as valid as before.

| Field | Records |
|---|---|
| `contractVersion` | `1`. An unreadable version is refused, never treated as an upgrade. |
| `route` | `source-only`, `bounded-lookup` or `deep-research`. |
| `sourceBoundary` | What the answer was allowed to read. |
| `sourceLanguages`, `outputLanguage` | Source languages separately from output — translated quotations retain their original source and are labeled. |
| `questions[]` | `id`, `text`, and `answeredBy` claim ids. |
| `gaps[]` | What is still unresolved. |
| `budget`, `stopReason` | Optional: how much was spent and why it stopped. |

Three rules the validator enforces, each because its absence lets a document look
finished while hiding something:

- **A `source-only` route may not carry a discovered source.** If the answer went
  looking, it took a different route and should say so.
- **Snippets are leads.** A load-bearing claim — an inference or a recommendation —
  supported *only* by snippet-derived sources (`via: "snippet"`) has not been checked.
  One actually-read source alongside the snippet satisfies it; the rule is about sole
  support. An observation reporting what a snippet said is fine.
- **An unanswered question must appear in `gaps`.** A question with no answering claim
  is legitimate; a question that quietly disappears is not. Begin its gap with
  the complete literal question ID, followed by whitespace or `: ` (for example
  `q1: source unavailable`). `q10` never stands in for `q1`.

`scripts/report-intake.mjs <model.json> [--metadata <metadata.json>]` validates
source input and emits a generation receipt without network access. The optional
`prepareResearch` adapter accepts an explicitly provided retrieval function for
bounded/deep routes; absence is an issue, never an invitation to invent facts.
Source-only never calls that function. See `assets/research-handoff.example.json`.

Canonical research language fields are `sourceLanguages` and `outputLanguage`.
Legacy `languages.source/output` remains accepted with `legacyInput:true` in the
receipt; conflicting representations are invalid. Sources may provide spans
`{id,locator,language,excerpt?}`, claims may bind `{sourceId,spanId}`, and
`counterEvidence` preserves opposing source references and qualifications.

`generationReceipt` records skill/package versions, source SHA, host adapter,
genre, route/contract, template/recipe IDs, and executed versus omitted checks.
Unknown stays unknown. `researchReceipt` preserves the older boolean-check API.
Caller-provided check assertions are not authenticated review evidence. Validation
proves structure and reference integrity, not that a source supports a claim.

For bilingual output use [English authoring](english-authoring.md), with paired
examples and locale helpers that preserve raw values. Select paper size explicitly,
not from language. Review visible prose against source facts separately from layout.
[Exhibit recipes](exhibit-recipes.md) separate analytical prerequisites from a
bound data instance; page roles specify composition, not analytical validity.

## Export only when requested

Ordinary static HTML/SVG authoring follows VIZ-VERIFY-SCALE-01: reread source,
save it and deliver it without a mandatory browser/render round trip. The model,
intake helpers and PDF receipt are not prerequisites for a small static edit.
Computed visuals require actual execution; exported PDFs require actual export
and checks appropriate to the stated assurance profile.

The exporter uses an existing local Chromium executable. It does not install a
browser, select Playwright, or promise font/resource readiness from a fixed wait.
For dynamic charts, first settle the state using the available browser owner and
verify that the actual printed values match. The separate `--qa-only` path accepts
a PDF from any engine, including Aside's own Chromium, and needs no system Chrome.

```sh
node scripts/export-paged-report.mjs report.html report.pdf --paper-size A4 --json
node scripts/export-paged-report.mjs --qa-only report.pdf --paper-size Letter --json
```

Select available Poppler tools with `--pdfinfo` and `--pdftotext` when they are not
on PATH. Each tool has a 30-second deadline; `--timeout-ms` accepts 100–300000.
An incomplete or changing stage fails at the deadline even when it has a useful
draft PDF or a `%PDF-` prefix. During Chromium export, a stage with a `%PDF-`
header and a final `%%EOF` trailer whose size and modification time remain
unchanged for 1.5 seconds may complete through the bounded stability probe. The
exporter then kills the owned Chromium tree and requires the child to exit within
5 seconds before promoting the stage. Stable-stage completion is accepted only
when the exit matches that kill request: SIGKILL on POSIX, or a zero-status
taskkill followed by child exit on Windows. A natural nonzero exit still fails,
even after the stage looks complete; cleanup failure also fails. Verify
any preserved or independently completed file separately with `--qa-only` and
record which engine completed the export. The output records per-check status,
reasons, and the completion method for each print pass. Missing tools block
verification; a process failure or empty extraction fails it. A4/Letter is an
explicit choice independent of output language.

When HTML is available, export also attempts the bounded SVG text/connector
diagnostic on final filled print HTML. `--qa-only` records it as a `report.notes`
entry because it has no HTML source; DOM process failure does not invalidate an
otherwise passing PDF receipt, and the note remains visible in JSON and under
`notes:` in human output.

Use approved local fonts, inspect required glyphs for exported output, and retain
license provenance. This package does not ship font binaries or a font-manifest
binding tool. Missing font evidence cannot become a publication PASS.

## Automated export is not final delivery

Exporter exit codes: **0** automated checks passed; **1** failed; **2** review
findings; **3** required checks not run. Its JSON always says `deliveryReady:false`.
Whitespace, apparent orphan fragments and density are review heuristics. Read
page images and justify intentional space by the page's role; never fill it with
unnecessary content to make a heuristic disappear.

Exporter check IDs reuse the receipt vocabulary, but its evidence states only
the automated scope. Nonempty extraction is not proof that every source record
or qualification survived. Review those items before claiming final delivery.

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
| `editorial-review` | Fresh reader recovers the answer, the reason, the limitations, and — where the genre calls for one — the action, without author-intent narration |

### Choose the assurance profile first (REPORT-ASSURANCE-01)

Rendering and reading every page is the expensive half of this gate. A published
deliverable earns that cost; a draft shared for comment usually does not. So the
profile is a stated choice, not something the gate infers:

| Profile | Requires | Use for |
|---|---|---|
| `draft` | nothing | Work in progress, internal preview, an artifact nobody will cite yet |
| `standard` | `pdf-parse`, `text-integrity`, `pagination` | A shared document whose text and pagination must be right, without full page-image review |
| `publication` (default) | all seven | Anything published, sent to a client, or presented as verified |

Pass it as `--profile <name>` or as `"profile"` in the receipt; the argument wins
when both are present. An unnamed profile stays `publication`, and an unknown name
fails rather than falling back to something cheaper.

A lighter profile reduces what is *required*. It never turns an unexecuted check into
a pass: the result carries `profile` and an `omitted` list naming every publication
check that did not complete, and a FAIL or REVIEW finding still propagates from a check
outside the profile. Report a draft verdict as what it is — "PASS at profile draft,
five checks omitted" — never as a verified publication.

```sh
node scripts/quality-gate.mjs /private/report.pdf /private/qa.json
node scripts/quality-gate.mjs /private/draft.pdf /private/qa.json --profile draft
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
node --test plugins/codexclaw/test/exhibit-contract.test.mjs plugins/codexclaw/test/visualizer-packaging.test.mjs
```

These commands run from the repository root and use isolated fixtures. They do not
certify arbitrary prose or installed consumer behavior. When export/layout changes,
add one real mixed-script PDF smoke and inspect the output. Do not render simple
static HTML merely because these maintenance tests exist.
