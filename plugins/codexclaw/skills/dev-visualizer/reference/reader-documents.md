# Reader documents — portable contract

**Canonical owner:** `cxc-dev` `references/reader-documents.md` (READER-DOC-01..05).
This is a portable restatement carried inside the skill so `dev-visualizer` resolves
standalone when copied without its siblings (issue #183). When the two disagree, the
canonical file wins; a packaging test checks the rule headings still match.

## READER-DOC-01 Reader contract (DEFAULT)

Before drafting, write one line: **who reads this, what they decide or do after reading,
what they already know.** Then pick one document type and keep to it.

| Type | Reader question | Shape |
|---|---|---|
| Explanation / report | What is true and why? | Answer → why → evidence → next steps |
| Decision record | What did we choose and what does it cost? | Context → drivers → options → decision → consequences |
| How-to | How do I do X? | Goal → prerequisites → numbered steps → verification |
| Reference | What are the exact facts? | Tables and definitions, no narrative |
| Research report | What does the evidence say about Q? | Direct answer → analysis by sub-question → limits → sources |

Mixing types in one document degrades all of them; split instead.

## READER-DOC-02 Answer first (DEFAULT)

Open with the situation, complication, question and answer in one short paragraph; the
governing conclusion appears before any evidence. Korean documents use 두괄식.

Every heading carries what its section establishes, never a bare topic label. In a
decision document or an explanation that is a claim, and the sections walk the reader
from what they accept to what is being asked; what those documents avoid is the
narrative that withholds the conclusion until the end, not the progression itself.

**The genre decides whether there is an ask at all.** A research synthesis ends at what
remains unresolved, a history at what is contested, a reference at the definitions —
where a topic label is correct rather than a defect. Forcing any of them to close on a
requested decision spends uncertainty the evidence did not earn. The genre table lives
in `report-writing.md` REPORT-STORY-00.

## READER-DOC-03 Descending structure (DEFAULT)

Sections descend from the answer: each heading summarises what is under it, siblings do
not overlap and together cover the question, and their order follows the reader's
questions rather than the order the work happened. Add a table of contents past about one
screen. Decision documents also carry the three sections writers omit — **non-goals**,
**alternatives considered** with why each was rejected, and **consequences or costs**.
A one-paragraph decision stays one paragraph.

## READER-DOC-04 Evidence separated and anchored (STRICT for factual claims)

Probes, commands, receipts, screenshots and logs go to an appendix, an evidence section
or a linked ledger; the narrative cites them by anchor. Every factual claim resolves to
an evidence anchor, a source URL with its date, or a stated assumption. A claim with none
of those is removed or labelled unverified. Do not paste a transcript where the reader
expects a conclusion, and do not summarise the evidence away either.

## READER-DOC-05 Fresh-reader check (DEFAULT for C2+; STRICT for delivered reports)

A reader with no task context answers three questions in their own words: what is the
answer, why should I believe it, what do I do next. Fix the structure wherever they
stumbled, and record the check. A reader who has to read the document twice has found a
defect in the document.

For a rendered deliverable the fresh reader reads the **rendered pages as images**, not
the source, so page breaks, stranded headings and clipped figures are visible.

## Portability note

This file exists so the skill has no required dependency outside its own root. It is
deliberately a restatement rather than a copy: the canonical file carries repository-only
ledger pointers and cross-references that do not resolve for a standalone consumer.
