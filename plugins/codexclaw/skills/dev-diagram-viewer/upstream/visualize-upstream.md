# Visualize Upstream Tracking

This file tracks the bundled upstream `visualize` skill used to maintain the
embedded contract in `../reference/visualize-contract.md`. It is the source of
truth for detecting upstream changes that may require the embedded contract to
be refreshed.

- Current upstream path: `/Users/jun/.codex/plugins/cache/openai-bundled/visualize/1.0.11/skills/visualize/SKILL.md`
- Current SHA-256: `174968af443c48fa2ace0fb73c35b86be6d63a3049fb88312e59e500d337db4d`
- Version: `1.0.11`
- Last synced: `2026-07-13`

## Extracted contract sections

`../reference/visualize-contract.md` extracts the operative contract body from
these upstream areas:

- visualization selection, Mermaid-versus-HTML routing, response behavior, and
  context-compaction guidance;
- the inline HTML file, fragment, content, response-directive, and external
  resource contracts;
- standalone HTML and Sites handoff behavior;
- composition rules relevant to diagrams, graphs, plots, maps, and interactive
  explainers;
- layout, accessibility, typography, color, and design-system constraints;
- chart, icon, mockup, interaction, and runtime-verification requirements.

The reference embeds the complete operative skill body with heading levels
adapted for the diagram-viewer reference. Upstream plugin metadata and
frontmatter remain upstream-only.

## Updating after upstream changes

1. Run `./sync-check.sh` and inspect the reported upstream path, version, and
   hash change.
2. Compare the installed upstream `SKILL.md` with the rules currently embedded
   in `../reference/visualize-contract.md`.
3. Re-extract the diagram-viewer-relevant sections and update the embedded
   contract for additions, removals, and changed requirements.
4. Update the upstream path, SHA-256, version, and last-synced date in this
   file.
5. Add a changelog entry summarizing the contract changes, then rerun
   `./sync-check.sh` and confirm that it reports `upstream in sync`.

## Changelog

- 2026-07-13 — v1.0.11 — Initial sync.
