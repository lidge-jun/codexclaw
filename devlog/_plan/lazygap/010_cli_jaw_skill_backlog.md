# 010 — cli-jaw skills_ref Import Backlog (no-server prose skills)

Gap class: HARNESS (meta-skills) · evidence: 3 parallel explorers (Confucius/Chandrasekhar/Locke-class) cross-checking `cli-jaw/skills_ref/` against codexclaw's 20 bundled skills

> cli-jaw ships ~17 reusable meta-skills in `skills_ref/`. codexclaw already covers the
> dev/verification/review family. What it lacks is the **context-economy + agent-design**
> layer: how to budget tokens, compress, retrieve iteratively, and quantify "done".
> All top candidates are pure prose — zero server, zero external API — so they port like
> any other `$cxc-*` skill.

## Parity verdict (cross-checked, deduped)

| cli-jaw skill | what it is | codexclaw today | import value |
| --- | --- | --- | --- |
| `context-budget` | audit token spend of loaded skills/agents/MCP/rules; flag bloat | none (`dev` only *mentions* the trade) | HIGH — codexclaw runs 20 skills, self-diagnosis is direct |
| `agent-harness-construction` | action-space / observation / recovery / context-budget design (101 lines) | none (a few lines in `skill-hub`) | HIGH — codexclaw has no agent-design meta-skill |
| `context-compression` | anchored/opaque/regenerative summary + artifact-trail templates | partial (`loop` says "compaction bail", no method) | HIGH — fills the long-loop weakness |
| `eval-harness` | pass@k / pass^3 reliability gating | none (codexclaw is verification-only) | MED-HIGH — lifts goalplan success-criteria into a quantified gate |
| `strategic-compact` | decide *when* to compact at logical boundaries | partial (matches PABCD phase edges) | MED-HIGH — Claude hook script dropped, port the timing rules only |
| `iterative-retrieval` | DISPATCH->EVALUATE->REFINE 3-cycle subagent context discipline | none (general "search first" only) | MED — regulates the dispatch we already do |

## Non-goals (server-bound or already covered)

- `deep-research` — requires `GEMINI_API_KEY` + external API. Violates no-server.
- `mcp-builder` — the deliverable *is* an MCP server. Direct philosophy conflict.
- `dev-pabcd` / `autonomous-loops` / `continuous-agent-loop` — bound to `cli-jaw orchestrate`
  or Claude Code `/loop`; codexclaw's `pabcd`/`loop`/`goalplan` already re-implement these
  server-free. Only the prose-only details (questioning strategy, ready criteria) are worth
  selective lift — and those land in the PABCD-directive work (`011`), not a new skill.
- `verification-loop` / `requesting-code-review` / `differential-review` — covered by
  `dev` §3 + `dev-testing` + `dev-code-reviewer`. `differential-review`'s blast-radius
  quantification is the one thin spot; fold it into `dev-code-reviewer`, don't add a skill.
- `rules-distill` — its `scan-*.sh` assume a Claude `rules/` directory layout codexclaw
  doesn't model.
- `skill-creator` — host already ships `~/.codex/skills/.system/skill-creator`. Importing
  a bundled copy is pure duplication.

## How they get enforced (tier)

These are E7 (prose) by nature — guidance, not runtime gates. Two get teeth:
- `eval-harness` success-criteria can become an E8 out-of-band check inside the goalplan
  validate step (`001`).
- `context-budget` can ship a no-server audit script (ast-grep-style) and become an E8
  drift gate over the skill/hook manifest token cost.

The rest stay E7, attached to base roles per `008` (e.g. "explore this **with
`cxc` iterative-retrieval discipline**").

## Proposed slice

One loop (decade 260, `L26`): import the top-3 (`context-budget`,
`agent-harness-construction`, `context-compression`) as on-demand `$cxc-*` skills,
codex-native (strip Claude hooks/scripts). `eval-harness` + `strategic-compact` +
`iterative-retrieval` follow as a second pass once the long-loop substrate (`001`) lands,
so eval gates have a goalplan to attach to.
