# Layering standard (adopted)

This is the standard the rest of the unit applies. It adopts the architect proposal (research/00_architect_proposal.md, D1-D12) with the dispositions in 002. In wp3 it is published as `structure/70_prompt_architecture.md`, the maintainer's reference; it is never injected or preloaded.

## The layers

A layer is defined by how often the model sees the text, not by file type. Classify regions, not files: `hook.ts` holds both L0 predicates and L1 strings; a SKILL.md holds L2 frontmatter and an L3 body.

| Layer | What it is | Seen | Holds |
|---|---|---|---|
| L0 | Guard and state code (deny, refuse, validate) | never as text | Invariants with an observable predicate at a boundary the plugin owns |
| L1 | Hook-injected text: SessionStart, UserPromptSubmit, compact recovery, PreToolUse reasons | every session or turn it fires | Current facts (ids, phase, paths), one applicability cue, one owner pointer |
| L2 | Skill catalog: frontmatter `description`, `agents/openai.yaml` | every turn | When to select the skill, and discriminating trigger words |
| L3 | Selected SKILL.md body | when the skill is chosen | Scope boundary, the few rules every use of the skill needs, a condition → reference table |
| L4 | Reference files | when a router row applies | One cohesive procedure, schema, checklist or example set |
| L5 | Tests and the gate | never | Behavior of L0, delivery of L1, link/size/ownership of L2-L4 |

## Placement test

Ask in order and stop at the first yes. A rule may get an L0 predicate plus one pointer; it never gets two prose owners.

1. Does the host already provide it? Then do not restate it.
2. Must the forbidden action be stopped regardless of the model, and is there a sound predicate at a boundary the plugin owns? L0, with positive and negative tests. If no boundary can observe it, it stays guidance; do not call it enforcement.
3. Is it a property of the repository (size, links, ownership)? L5.
4. Must the model know it before it could pick any skill (a current fact, an otherwise undiscoverable owner)? L1, within budget.
5. Does it decide when a skill is selected? L2.
6. Does essentially every use of the selected skill need it? L3, one sentence or one table row.
7. Otherwise (a branch procedure, exception, recipe, example, measured host value): one L4 file, with an L3 row naming when to read it.

Importance decides authority and proof, not exposure. "Important" is never a reason to make a rule always-on.

## Ownership and pointers

- One semantic obligation has one canonical owner. Other places carry a pointer, or a one-sentence hazard boundary plus the pointer. They never restate thresholds, permissions, phase order or exceptions.
- `dev/references/skill-ownership.md` stays the directory of owners.
- Pointer forms: L3/L4 `Before <action>, read [topic](path#anchor) (RULE-ID).`; L1 `<fact>. Owner: $cxc-<skill> <reference> (RULE-ID).`
- Runtime text uses installed-root-resolvable paths or skill mentions, never repo-relative paths that would resolve against the user's cwd.
- Rule IDs name stable obligations. Give an ID only when the obligation is referenced across owners, checked by code or tests, or needs audit continuity. IDs survive rewording and relocation; a changed obligation gets a new ID; retired IDs are not reused.

## History stays out of instructions

Incident → dated devlog evidence → general rule at its owner → regression fixture. L1-L3 carry no historical incident identifiers: past dates, past session ids, counts of observed runs, "this happened twice" stories or rebuttals of old proposals. Live facts are different and belong in L1: the current session id, phase, paths and dated recall snippets labeled as data. L4 may keep one minimal counterexample when it teaches the rule; the story stays in the devlog with a link. Measured host values (limits, timeouts) live in one L4 host envelope and in test fixtures. Recall snippets in L1 are labeled data with provenance, never rules.

## Budgets

Measured in UTF-8 bytes for files and the emitted text for L1. Byte counts are deterministic editorial metrics, not token estimates. A budget failure is never permission to drop a safety rule; move detail to L4 instead.

| Layer | Budget | Enforced by |
|---|---|---|
| L1 static | Each notice ≤ 400 chars, except the named loop-arm directive (≤ 600 B). SessionStart static total ≤ 2,400 B; one UserPromptSubmit ≤ 1,200 B summed over every co-emitting hook; unrelated prompts emit 0 B | measure-l1 aggregate scenarios through the real hook commands, plus per-component tests (wp2) |
| L1 data | Recall excerpts keep their 1,400/800-char caps; completion rows ≤ 5 plus a retrieval pointer | existing component tests |
| L2 | description ≤ 320 chars; short_description ≤ 100 chars | check-prompt-architecture.mjs (hard) |
| L3 | whole SKILL.md file bytes: dev ≤ 12 KiB; loop, pabcd ≤ 8 KiB; other routers ≤ 10 KiB | check-prompt-architecture.mjs (hard, with the baseline below) |
| L4 | target ≤ 16 KiB per topic; above 24 KiB is reported | check-prompt-architecture.mjs (report only) |
| L5 | wording locks only for wire keys, markers, CLI flags, owner pointers and boundary messages | review |

Files over a budget are recorded in `plugins/codexclaw/scripts/prompt-architecture-baseline.json` with their exact current size. The gate fails when a listed file differs from its recorded size (so growth needs a visible baseline edit and shrinking needs the baseline lowered), when an unlisted file exceeds its budget, and when the baseline lists a skill outside the frozen eligible set written in the script. The bypass is editing the baseline or the eligible set in the same PR; both are reviewable diffs, so this is early warning, not enforcement (PLAN-BYPASS-NAMED-01).

## Enforcement

`plugins/codexclaw/scripts/check-prompt-architecture.mjs`, called from `gate.mjs`, offline and dependency-free:

- L2 and L3 sizes against the table and the baseline;
- every relative Markdown link in skills/** resolves to an existing file, and a `#fragment` resolves to a heading slug in that file;
- a rule ID is defined (heading containing the ID, or `ID (STRICT|DEFAULT|HEURISTIC|ESCALATE|STYLE_SAMPLE)`) in at most one file; legacy multi-definition IDs are frozen as exact ID → file lists in the baseline, may only lose files, and no new ID may join them;
- `--report` prints L4 sizes and sentences of 80+ characters repeated verbatim across files, as advice.

Semantic duplicates and contradictions stay a review task. The gate proves structure, not meaning or model compliance.
