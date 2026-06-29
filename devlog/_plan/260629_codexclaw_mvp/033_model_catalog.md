# 033 — Model Catalog Source (n+1)

Status: TODO  ·  Phase 2

## Goal
Build the selectable model list = ocx-provided catalog + the main/default model (n + 1).

## Source
- When ocx present: query ocx for its synced model catalog (the same set ocx injects into codex).
- Always include the default/main model as a first-class choice.
- When ocx absent: catalog = [default model] only.

## Open item
- Exact ocx interface to read the catalog (CLI subcommand vs file vs proxy endpoint) — confirm
  against opencodex (`ocx sync` / catalog file).

## Verify
- With ocx: list = ocx models + main (n+1), no duplicates.
- Without ocx: list = [main] only.
