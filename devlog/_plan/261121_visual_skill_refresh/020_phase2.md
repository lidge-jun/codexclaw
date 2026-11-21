# 020 — wp2: copy module

Research: [003](003_copywriting_research.md). Re-verify anchors and amend to diff level at this
cycle's P before B.

## Scope

IN: dev-frontend copy references, its router row, kwrite routing, dev-uiux-design product
microcopy pointer. OUT: the linter (wp3), visual rules.

## File change map (under plugins/codexclaw/skills/)

| Op | Path | Change |
|---|---|---|
| NEW | dev-frontend/references/core/copy-process.md | FE-COPY-PROCESS-01: fact sheet from the brief (every specific sourced, otherwise a plainer line); voice card; register choice; sections from the reader's questions; device budget per page; check. Korean-first examples. |
| NEW | dev-frontend/references/core/copy-tells.md | First and second generation tells (EN + KO), each with a positive move; over-correction table; not-tells list; ids that wp3's linter reuses (`copy-*`). Moves FE-APHORISM-01 and FE-CONTENT-REALISM-01 here as the single definition site (anti-slop.md keeps a pointer). |
| NEW | dev-frontend/references/core/copy-registers.md | Eight to ten registers written for codexclaw's surfaces (product, devtool, public/gov, Korean consumer, B2B, editorial), each with a short sample in Korean and English. |
| MODIFY | dev-frontend/references/core/ux-writing-ko.md | Product microcopy additions: verb-first buttons, links name the destination, settings describe the ON state, errors next to the field with the fix, undo over confirmation, empty states point forward, placeholders show an example. |
| MODIFY | dev-frontend/references/core/anti-slop.md | Copy Tells and Copy Self-Audit become pointers to copy-tells.md (no duplicate definitions). |
| MODIFY | dev-frontend/SKILL.md | Router row: "Any visible copy: landing, product, microcopy -> copy-process, copy-tells; Korean prose polish -> kwrite". |
| MODIFY | dev-visualizer/reference/report-writing.md | Point report prose at copy-tells for the shared tells. |

## Korean tells validation (before encoding)

Generate or collect at least 10 model-written Korean landing pages (no client material;
DEV-PRIVACY-01), count each candidate tell from 003, and encode only those that appear in at
least 3 pages. Record counts in `006_korean_copy_sample.md`.

## Acceptance

- Router bytes stay under budget; check-prompt-architecture exit 0; each `copy-*` and
  `FE-COPY-*` id defined once.
- A worked example in copy-process.md turns one brief into a fact sheet, voice card and
  hero/section drafts, in Korean.
- Independent reviewer pass (subagent) on the two new tells files: every ban has a positive
  move; no tell bans normal Korean.
