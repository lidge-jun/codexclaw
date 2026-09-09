# Reader documents — structure for people who were not in the loop

Canonical owner of reader-facing document structure (READER-DOC-01..05). Other
skills point here; they do not restate it. These are agent-followed rules, not
runtime gates.

## When this applies

Anything a person reads to understand or decide: reports, explainers, visual
documents, research reports, PR descriptions, the reader summary at the top of a
devlog `000_plan.md`, and D-phase summaries. It does not apply to audit artifacts
(receipts, ledgers, probe logs, test output, journals): those keep their raw form
and are linked from the document, never rewritten into prose.

The failure this prevents: an agent that ran twelve probes writes a document that
lists the twelve probes. The reader wanted the answer, the reason to believe it,
and what to do next. The probes belong in an appendix.

## READER-DOC-01 Reader contract (DEFAULT)

Before drafting, write one line: **who reads this, what they decide or do after
reading, what they already know.** Then pick one document type and keep to it:

| Type | Reader question | Shape |
|---|---|---|
| Explanation / report | What is true and why? | Answer → why → evidence → next steps |
| Decision record | What did we choose and what does it cost? | Context → drivers → options → decision → consequences |
| How-to | How do I do X? | Goal → prerequisites → numbered steps → verification |
| Reference | What are the exact facts? | Tables and definitions, no narrative |
| Research report | What does the evidence say about Q? | Direct answer → analysis by sub-question → limits → sources |

Mixing types in one document degrades all of them; split instead.

## READER-DOC-02 Answer first (DEFAULT)

Open with the situation, the complication, the question and the answer (SCQA) in
one short paragraph; the governing conclusion appears before any evidence. Every
heading below it states a claim, not a topic ("Cost drops 12% under the selected
scenario", not "Analysis"). Korean documents use 두괄식: 결론·전망·요약을 맨 앞에.
기승전결 (문제 제기→전개→전환→결론) is for narrative pieces and never for reports.

## READER-DOC-03 Descending structure (DEFAULT)

Sections descend from the answer: each heading is a summary of what is under it,
siblings do not overlap and together cover the question, and their order follows
the reader's questions rather than the order the work happened. Include a table
of contents once the document exceeds about one screen. Decision documents
also carry three sections writers omit: **non-goals**, **alternatives considered**
with the reason each was rejected, and **consequences or costs** of the choice.
Small changes get a short document; do not inflate a one-paragraph decision.

## READER-DOC-04 Evidence separated and anchored (STRICT for factual claims)

Probes, commands, receipts, screenshots, and logs go to an appendix, an evidence
section or a linked ledger. The narrative cites them by anchor. Every factual
claim in the narrative resolves to one of: an evidence anchor, a source URL with
its date, or a stated assumption. A claim with none of these is removed or labeled
as unverified. Do not paste a command transcript where the reader expects a
conclusion; do not summarize away the evidence either. Both live in the document,
in their own places.

## READER-DOC-05 Fresh-reader check (DEFAULT for C2+; STRICT for user-delivered reports)

An agent or subagent with no task context reads the draft and answers three
questions in its own words: what is the answer, why should I believe it, what do
I do next. Where it stumbled, fix the structure. Record the check (who read,
where they stumbled, what changed) in the evidence section. A reader who has to
read the document twice has found a defect in the document.

## Skeletons

Report or explainer:

```markdown
# <Claim-shaped title>
<SCQA paragraph ending with the answer>
## Contents            (when longer than one screen)
## <Claim 1>           supporting reasoning, figure with a caption that states what changes
## <Claim 2>
## What this does not cover / limits
## Next steps          who does what
## Appendix: evidence  A1..An anchors; commands, receipts, screenshots, sources with dates
```

Decision record (MADR-shaped):

```markdown
# <Decision as a sentence>
Status · Date · Deciders
## Context and problem
## Decision drivers
## Options considered   each with pros, cons, why rejected
## Decision
## Consequences         good, bad, follow-ups
```

Visual explainer: question → one figure whose caption states what changes and why
→ detail on demand → sources. Composition and rendering rules stay with
`dev-visualizer`.

## Layer order for polish

Structure first (this reference), sentences second. Korean sentence polish is
`kwrite`; general output hygiene is `dev` FAMILY-SLOP-01. Limit a revision to one
or two structural interventions; a document that is rearranged wholesale on every
pass loses the reader's map.

## Sources

Patterns adopted from opened sources with dates and licenses:
`devlog/_plan/260908_narrative_documents/001_sources.md` (Minto Pyramid/SCQA and
MECE, Korean 두괄식 guidance, Amazon narrative memos, Google design docs, MADR,
Diátaxis, Anthropic doc-coauthoring, executive-summary skills). No text is vendored.

