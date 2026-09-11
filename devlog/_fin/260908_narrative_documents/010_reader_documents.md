# wp2 — Reader-facing document structure (diff-level)

Depends on 000/001. Class C2 within the C3 unit. Verifiers (run in 002_verifiers.md):
`node --test plugins/codexclaw/test/skill-catalog.test.mjs` (catalog only; does not read
prose), `quick_validate.py` per touched skill (frontmatter), a link-existence script
over changed Markdown, and an independent forward-use trial (Opus-5 leaf given a raw
probe-style evidence dump and asked to produce a report for a newcomer; PASS when the
output leads with the answer, has a reader ToC, and keeps evidence in a separate
appendix with anchors).

## NEW plugins/codexclaw/skills/dev/references/reader-documents.md (~120 lines)

Canonical owner of "reader-facing document structure" (rule ids READER-DOC-01..05).
Contents, in order:

1. **When this applies** — any artifact a person reads to understand or decide:
   reports, explainers, visual documents, devlog 000 summaries, D summaries, PR
   descriptions, research reports. Not: raw evidence files, receipts, ledgers, test
   output, which remain audit artifacts and stay unchanged.
2. **READER-DOC-01 Reader contract (DEFAULT)** — before drafting, write one line:
   who reads, what they decide or do next, what they already know. Choose the
   document type (explanation / how-to / reference / decision record / research
   report); one document, one type.
3. **READER-DOC-02 Answer first (DEFAULT)** — open with situation, complication,
   question, answer (SCQA) in at most one short paragraph; the governing conclusion
   appears before any evidence. Korean documents use 두괄식; 기승전결 is for narrative
   pieces only, never for reports.
4. **READER-DOC-03 Descending structure (DEFAULT)** — sections descend the pyramid:
   each heading states a claim, its body supports it, siblings are MECE-ish and
   ordered by the reader's question, not by the order work happened. Provide a
   table of contents when the document exceeds roughly one screen. Required
   sections for decision documents: non-goals, alternatives considered with why
   rejected, consequences/costs.
5. **READER-DOC-04 Evidence separated and anchored (STRICT for claims)** — probes,
   commands, receipts, screenshots go to an appendix, evidence section or linked
   ledger. The narrative cites them by anchor; every factual claim in the narrative
   must resolve to an anchor, a source URL or a stated assumption. Unanchored
   claims are removed or labeled. Never paste a command log where a reader expects
   a conclusion.
6. **READER-DOC-05 Fresh-reader check (DEFAULT for C2+, STRICT for user-delivered
   reports)** — an agent or subagent with no task context reads the draft and
   answers three questions: what is the answer, why should I believe it, what do I
   do next. Fix where it stumbled. Record the check in the evidence section.
7. **Templates** — three compact skeletons: report (answer → why → evidence →
   next steps → appendix), decision record (MADR-shaped), visual explainer
   (question → figure with caption stating what changes → detail → sources).
8. **Layer order for polish** — structure first (this reference), then sentence
   polish (kwrite for Korean; dev anti-slop otherwise); at most one or two
   structural interventions per revision.
9. **Sources** — pointer to devlog unit 001_sources.md and the diagram-viewer
   source-patterns ledger; no vendored text.

## MODIFY plugins/codexclaw/skills/dev/references/skill-ownership.md

Insert after the "Visual document composition" row:

`| Reader-facing document structure (READER-DOC-*) | \`dev/references/reader-documents.md\` | \`dev-diagram-viewer\`, \`pabcd\` plan-output/phase-check, \`dev-scaffolding\` implementation-log, \`kwrite\`, \`search\` deep-research |`

## MODIFY plugins/codexclaw/skills/dev/SKILL.md

In §Family Invariants (line ~197 onward) add one invariant bullet:
"Reader deliverables follow [Reader documents](references/reader-documents.md):
answer first, evidence separated and anchored. Audit artifacts keep their raw form."
No trigger/description change.

## MODIFY plugins/codexclaw/skills/dev-diagram-viewer/SKILL.md

- Under "## Compose before styling" (line 55), replace the sentence starting "Use a
  compact design read" so it begins with the reader contract and links
  `../dev/references/reader-documents.md`; keep the design read.
- Under "Examples of structure that earns its form" replace the existing bullet at
  line 71 ("Introduce the decision in a report, show its evidence, then expose detail
  and sources.") with a stub: "Reports and explainers follow [Reader documents]
  (../dev/references/reader-documents.md): answer first, evidence in an appendix."
  No second sentence is added; the canonical text lives in the reference.
- Add `[Reader documents](../dev/references/reader-documents.md)` to the route
  table rows "HTML report..." and "PDF, print report or handout" in the "Read when
  selected" column.

## MODIFY plugins/codexclaw/skills/dev-diagram-viewer/reference/document-pdf.md

"## Build the reading order" (line 39): prepend one line "Structure follows
[Reader documents](../../dev/references/reader-documents.md); the rest of this
section is print-specific." Keep existing bullets.

## MODIFY plugins/codexclaw/skills/pabcd/references/plan-output.md

After the nine-field table add a short section "Reader summary": a C2+ plan's
000_plan.md opens with a reader-facing summary per READER-DOC-02 (problem, answer,
what changes for whom) before the loop-spec table; research/evidence stays in 00x
docs (LEXICO-SPLIT-01 unchanged).

## MODIFY plugins/codexclaw/skills/pabcd/references/phase-check.md

After the SoT-sync paragraph add "C-READER-01 (DEFAULT): when the work-phase
delivers a document, report or visualization to a person, C includes the
fresh-reader check from reader-documents.md and records where the reader stumbled."

## MODIFY plugins/codexclaw/skills/pabcd/SKILL.md

D bullet (line 84): append "The D summary is written for a reader who was not in
the loop: conclusion, what changed, evidence pointers (READER-DOC-02/04)."

## MODIFY plugins/codexclaw/skills/dev-scaffolding/references/implementation-log.md

Before "## Class-scaled documentation" (line 70) add "## Reader narrative vs evidence":
000_plan.md carries the reader narrative (answer, why, what changed); evidence,
receipts and probe logs live under evidence/ or a numbered evidence doc and are
linked, never inlined into the narrative. Link reader-documents.md.

## MODIFY plugins/codexclaw/skills/kwrite/SKILL.md

Scope guard (line 67): add bullet "Structure is out of scope here; when the draft is
a report or explainer, run [Reader documents](../dev/references/reader-documents.md)
first (두괄식 check), then this protocol on the sentences."

## MODIFY plugins/codexclaw/skills/README.md and top-level README.md

No new skill folder, so the catalog block is unchanged. Add one line in the skills
README family description: dev references now own reader-document structure.

## Acceptance

- All links resolve; frontmatter valid; catalog test passes.
- Forward-use trial: PASS criteria above, recorded in evidence/wp2-forward/.
- Fresh-reader check performed on reader-documents.md itself by a second leaf.

