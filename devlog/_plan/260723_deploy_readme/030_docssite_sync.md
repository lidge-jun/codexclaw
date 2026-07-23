# 030 — docs-site factual sync (phase 3, diff-level plan)

Appended at A (LOOP-UNIT-CHAIN-01). The README optimization (020) switches the
primary docs link to `lidge-jun.github.io/codexclaw/`; this phase makes that
target true. Scope: FACTUAL SYNC ONLY — no redesign, no new pages.

Files (all under `docs-site/`):

## F1 — `src/content/docs/index.mdx`

- L137 + L194 "25 skills: ..." → 27 skills; rewrite the enumeration to match
  reality (dev parent + 12 routers, pabcd, loop, interview, search, recall,
  repo-map, qa, kwrite, orchestrate, goalplan, ast-grep, lunasearch, remote,
  skill-hub(deprecated)). Keep it one line — point to the skills guide for detail.
- L162 "green at 801 tests" → recompute at B (`npm test` tail; 1,201 as of
  2026-07-23).
- GUI-as-shipped claims (audit 001 #11): mark consistently with README E6 —
  dashboard runs from a repo-checkout build until gui/dist ships (D1).

## F2 — `src/content/docs/getting-started/installation.md`

- L52-60 "codexclaw ships twelve hooks" → 18 active hooks.
- Install wording: align with README E4 — add `codex plugin marketplace upgrade
  codexclaw` (update), `codex plugin remove codexclaw@codexclaw` (uninstall),
  hook re-approval note, and the repo-checkout scope line for `cxc` (D6).

## F3 — `src/content/docs/reference/hooks.md`

- L6 "registers twelve hooks" → 18; refresh the hook inventory against
  `plugins/codexclaw/.codex-plugin/plugin.json` (source of truth) — include the 4
  recall/bg-terminal registrations missing from the page.

## F4 — sweep (B-phase, evidence required)

- `rg -n "twelve hooks|14 hooks|25 skills|29 skills|801|1,110|13 surface"
  docs-site/src` must return ZERO after edits; paste output in C attest.
- Any other numeric capability claim found in the sweep joins this phase's edits.

## Verifier (C)

1. `npm run build` in `docs-site/` succeeds (Astro/Starlight).
2. F4 sweep output empty.
3. Numbers match the README values landed in WP2 (single source of truth table
   in the C attest: skills 27, hooks 18, routers 12, tests <fresh>, rule IDs
   <fresh per 001 #12 command>).
