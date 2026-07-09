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
- `pabcd/` — Codex-native PABCD workflow (Interview/Plan/Audit/Build/Check/Done) with
  class-scaled depth. Folds in the structured-development discipline.
- `interview/` — discoverable `cxc-interview` surface for persistent I-phase
  contradiction discovery, question/answer recording, and readiness gating.
- `orchestrate/` — discoverable `cxc-orchestrate (DEPRECATED -> cxc-pabcd)` surface for explicit IPABCD
  phase control from chat plus the live agent-gated `cxc orchestrate` terminal path.
- `loop/` — discoverable `cxc-loop` surface for HOTL work-phase continuation.
- `goalplan/` — discoverable `cxc-goalplan (DEPRECATED -> cxc-loop)` surface for durable criteria,
  checkpoints, steering, and quality gates.
- `search/` — discoverable `cxc-search` surface for external/current/public lookup
  discipline; not memory or chat search.
- `recall/` — discoverable `cxc-recall` surface for read-only past-session chat and
  memory search over `~/.codex` before asking the user to repeat context.
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
- `skill-hub/` — discoverable `cxc-skill-hub (DEPRECATED -> cxc-dev)` catalog for choosing the right
  on-demand skill.
- `sparksearch/` — discoverable `cxc-sparksearch` lane for cheap parallel public-web
  discovery that hands proof back to `cxc-search`.
- `ultraresearch/` — discoverable `cxc-ultraresearch (DEPRECATED -> cxc-search)` protocol for multi-wave
  research with journal and claim-ledger proof discipline.

## Conventions

- Frontmatter: `name` + a trigger-rich "MUST USE" `description` + `metadata.short-description`.
- Progressive disclosure via `references/`; supporting `scripts/`, `examples/`, and `assets/`
  travel with their skill.
- Content is project-agnostic Codex-native: no external orchestrator server, no
  host-specific identity paths, and repo root is resolved via `pwd`/AGENTS.md rather
  than any fixed location. The live `cxc orchestrate` CLI is a local component path
  over codexclaw file state, not a server runtime.

See `devlog/_plan/` for the conversion sequence and the per-skill conversion delta.
