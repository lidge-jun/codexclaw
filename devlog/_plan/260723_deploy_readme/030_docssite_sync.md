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
- L138 "12 hook JSON files" → 18 active hooks, with the event-family breakdown:
  session-start 4, user-prompt-submit 2, pre-tool-use 5, post-tool-use 2,
  stop 1, subagent-stop 1, post-compact 3 (= 18; source of truth:
  `plugins/codexclaw/.codex-plugin/plugin.json`).
- L162 "green at 801 tests" → recompute at B (`npm test` tail; 1,201 as of
  2026-07-23).
- GUI-as-shipped claims (audit 001 #11): mark consistently with README E6 —
  dashboard runs from a repo-checkout build until gui/dist ships (D1).
- A-round-3 expansion (B-CLI repair across the page):
  - :97-99 "a shipped GUI dashboard" → build-from-source wording.
  - :101-104 "Everything ships … and a small `cxc` CLI" → marketplace payload =
    skills/hooks/MCP/components; `cxc` rides with the repo checkout for v0.1.0.
  - :72-93 terminal demo (marketplace add → immediate `cxc`) → add the
    repo-checkout prerequisite note right after the block.
  - :121-127 architecture diagram → GUI "build from source", CLI "repo checkout
    only".
  - :141 `cxc` CLI surface-map row → repo-checkout scope.
  - :150-160 Quick start → split marketplace install/verify
    (`codex plugin list`) from repo-checkout CLI usage.

## F2 — `src/content/docs/getting-started/installation.md`

- L52-60 "codexclaw ships twelve hooks" → 18 active hooks.
- Install wording: align with README E4 — add `codex plugin marketplace upgrade
  codexclaw` (update), `codex plugin remove codexclaw@codexclaw` (uninstall),
  hook re-approval note, and the repo-checkout scope line for `cxc` (D6).
- A-round-3 expansion:
  - :49-50 "(npm link or codexclaw marketplace install)" is FALSE under B-CLI —
    marketplace install never places `cxc` on PATH; replace with
    npm-link/shell-alias wording.
  - :68-75 Verify section — `cxc doctor` cannot be the unconditional
    marketplace verification; marketplace-native check = `codex plugin list`,
    CLI checks scoped to checkout.

## F3 — `src/content/docs/reference/hooks.md`

- L6 "registers twelve hooks" → 18; refresh the hook inventory against
  `plugins/codexclaw/.codex-plugin/plugin.json` (source of truth). The page is
  missing SIX active registrations: session-start-injecting-recall-context,
  user-prompt-submit-detecting-recall-intent, post-compact-injecting-recall-
  context, post-compact-injecting-bg-terminal-affordance,
  pre-tool-use-guarding-goal-complete, session-start-bootstrapping-pabcd-state.
  Acceptance: the page documents exactly the 18 manifest registrations — generate
  the inventory FROM plugin.json at B, diff against the page, zero delta.

## F4 — sweep (B-phase, evidence required)

- CASE-INSENSITIVE (A-round-3 fix — `Twelve hooks` at concepts/how-it-works.md:36
  escaped the case-sensitive form):
  `rg -ni "twelve hooks|12 hook|14 hooks|25 skills|29 skills|801|1,110|13 surface"
  docs-site/src` must return ZERO after edits; paste output in C attest.
- Any other numeric capability claim found in the sweep joins this phase's edits.

## F5 — `src/content/docs/concepts/how-it-works.md` (A-round-3)

- :36-47 "Twelve hooks" + event table → 18 active hooks; new event table:
  SessionStart x4 (provider-bridge, pabcd-bootstrap, map-affordance,
  recall-context), UserPromptSubmit x2 (pabcd-trigger, recall-intent), Stop x1,
  PreToolUse x5 (goal-budget, interview-in-goal, goal-complete, skill-attach,
  edit-lint), PostToolUse x2, SubagentStop x1, PostCompact x3 (reinject-cursor,
  recall-context, bg-terminal-affordance).
- :15 mermaid + :57-65 CLI section → add the boundary: `cxc` ships with the
  repository checkout for v0.1.0; the marketplace payload does not place it on
  PATH.

## F6 — CLI/GUI scope statements (A-round-3)

- `src/content/docs/guides/gui.md` :6 "ships a local dashboard" → build-from-
  source marking + `cxc` checkout prerequisite in Launch.
- `src/content/docs/reference/commands.md` top → caution block: binaries are
  repo-checkout/npm-link surfaces for v0.1.0, not marketplace-installed commands.
- `src/content/docs/getting-started/quickstart.md` → prerequisite line: source
  checkout with `cxc` activated (Installation Track 3).

## Verifier (C)

1. `npm run build` in `docs-site/` succeeds (Astro/Starlight).
2. F4 sweep output empty.
3. Numbers match the README values landed in WP2 (single source of truth table
   in the C attest: skills 27, hooks 18, routers 12, tests <fresh>, rule IDs
   <fresh per 001 #12 command>).
