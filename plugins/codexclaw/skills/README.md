# codexclaw skills

This directory holds the Codex `SKILL.md` skills bundled by the codexclaw plugin.

## Skill set

- `dev/` — always-on universal dev discipline (work classifier C0-C5, modular limits,
  pre-write search, verification gate, safety rules). The hub that routes to the
  surface-specific routers below. `agents/openai.yaml` sets `allow_implicit_invocation: true`.
- `dev-*` — surface routers, each activated by its description matching the change surface:
  `dev-architecture`, `dev-backend`, `dev-code-reviewer`, `dev-data`, `dev-debugging`,
  `dev-devops`, `dev-frontend`, `dev-scaffolding`, `dev-security`, `dev-testing`,
  `dev-uiux-design`. `dev-frontend` and `dev-uiux-design` ship
  `allow_implicit_invocation: true` (implicit-visible, mutually cross-referenced, so
  anti-slop design grammar reaches every UI-generating session); the rest ship
  `agents/openai.yaml` with `allow_implicit_invocation: false`.
- `dev-diagram-viewer/` — on-demand environment-aware diagram rendering: detects the
  runtime surface (Codex Desktop app vs CLI) and routes diagram output to native
  inline rendering (mermaid) or browser-based display (SVG, Chart.js, ECharts, D3,
  Leaflet, Three.js, interactive widgets). Ships `allow_implicit_invocation: false`;
  activates by description match or explicit `$cxc-dev-diagram-viewer`.
  Includes `scripts/diagram-to-html.sh` helper and `reference/html-templates.md`
  with self-contained HTML wrapper templates for all diagram types.
- `pabcd/` — Codex-native PABCD workflow (Interview/Plan/Audit/Build/Check/Done) with
  class-scaled depth. Folds in the structured-development discipline.
- `interview/` — discoverable `cxc-interview` surface for persistent I-phase
  contradiction discovery, question/answer recording, and readiness gating.
- `orchestrate/` — deprecated compatibility redirect from `cxc-orchestrate` to
  `cxc-pabcd`; it has no `agents/openai.yaml` registration of its own.
- `loop/` — discoverable `cxc-loop` surface for HOTL work-phase continuation.
- `goalplan/` — deprecated compatibility redirect from `cxc-goalplan` to
  `cxc-loop`; the `cxc goalplan` CLI remains an alias during migration.
- `search/` — discoverable `cxc-search` surface for external/current/public lookup
  discipline; not memory or chat search. Its opt-in Tier 3 protocol owns the former
  ultraresearch multi-wave journal and claim-ledger discipline.
- `recall/` — discoverable `cxc-recall` surface for read-only past-session chat and
  memory search over `~/.codex` before asking the user to repeat context.
- `qa/` — discoverable `cxc-qa` manual surface-driving QA gate for web, GUI, TUI,
  CLI, and HTTP API changes. It records scenario artifacts and teardown receipts;
  automated suites remain owned by `dev-testing`.
- `repo-map/` — on-demand `cxc-repo-map` structure overview using tree-sitter tags
  and PageRank. It orients unfamiliar codebases before exact `rg` or ast-grep work.
- `kwrite/` — discoverable `cxc-kwrite` surface for Korean prose polishing (윤문):
  AI-tell removal, register consistency, rhythm, meaning-exact revision of existing
  Korean text. On-demand: `agents/openai.yaml` sets `allow_implicit_invocation: false`;
  it activates by description match or explicit `$cxc-kwrite`.
- `remote/` — discoverable `cxc-remote` surface for messenger-bridge onboarding:
  agent-run Telegram/Discord connection ladder (serve -> token -> agent -> pair ->
  smoke) plus setup troubleshooting. On-demand like the `dev-*` routers:
  `agents/openai.yaml` sets `allow_implicit_invocation: false`; it activates by
  description match or explicit `$cxc-remote`.
- `ast-grep/` — discoverable `cxc-ast-grep` surface for optional AST-aware structural
  search/codemods, with `rg` first for ordinary text search.
- `skill-hub/` — deprecated compatibility redirect from `cxc-skill-hub` to
  `cxc-dev`; capability routing is canonical in `dev/SKILL.md`.
- `lunasearch/` — discoverable `cxc-lunasearch` lane for cheap parallel public-web
  discovery that hands proof back to `cxc-search`.
- `worktree-guardian/` — discoverable `cxc-worktree-guardian` surface for Codex-app
  managed-worktree safety: three namespaces (branch/worktree/thread), adopt-in-place
  renaming, the never-list, and the WORKTREE-GUARD-01/02/03 hook interplay.
  On-demand (`allow_implicit_invocation: false`; the pinned implicit set in
  `test/manifest-policy.test.mjs` S3 stays untouched) — the WORKTREE-GUARD hooks
  reference it explicitly.

## Conventions

- Frontmatter: `name` + a trigger-rich "MUST USE" `description` + `metadata.short-description`.
- Progressive disclosure via `references/`; supporting `scripts/`, `examples/`, and `assets/`
  travel with their skill.
- Content is project-agnostic Codex-native: no external orchestrator server, no
  host-specific identity paths, and repo root is resolved via `pwd`/AGENTS.md rather
  than any fixed location. The live `cxc orchestrate` CLI is a local component path
  over codexclaw file state, not a server runtime.

See `devlog/_plan/` for the conversion sequence and the per-skill conversion delta.
