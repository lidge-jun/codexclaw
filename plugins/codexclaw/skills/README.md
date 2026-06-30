# codexclaw skills

This directory holds the Codex `SKILL.md` skills bundled by the codexclaw plugin.

## Skill set

- `dev/` — always-on universal dev discipline (work classifier C0-C5, modular limits,
  pre-write search, verification gate, safety rules). The hub that routes to the
  surface-specific routers below. `agents/openai.yaml` sets `allow_implicit_invocation: true`.
- `dev-*` — on-demand routers, each activated by its description matching the change surface:
  `dev-architecture`, `dev-backend`, `dev-code-reviewer`, `dev-data`, `dev-debugging`,
  `dev-devops`, `dev-frontend`, `dev-scaffolding`, `dev-security`, `dev-testing`,
  `dev-uiux-design`. Each ships `agents/openai.yaml` with `allow_implicit_invocation: false`.
- `pabcd/` — Codex-native PABCD workflow (Interview/Plan/Audit/Build/Check/Done) with
  class-scaled depth. Folds in the structured-development discipline.
- `interview/` — discoverable `cxc-interview` surface for persistent I-phase
  contradiction discovery, question/answer recording, and readiness gating.
- `orchestrate/` — discoverable `cxc-orchestrate` surface for explicit IPABCD
  phase control from chat and future terminal parity.
- `loop/` — discoverable `cxc-loop` surface for HOTL work-phase continuation.
- `goalplan/` — discoverable `cxc-goalplan` surface for durable criteria,
  checkpoints, steering, and quality gates.

## Conventions

- Frontmatter: `name` + a trigger-rich "MUST USE" `description` + `metadata.short-description`.
- Progressive disclosure via `references/`; supporting `scripts/`, `examples/`, and `assets/`
  travel with their skill.
- Content is project-agnostic Codex-native: no external orchestrator commands, no host-specific
  identity paths, and repo root is resolved via `pwd`/AGENTS.md rather than any fixed location.

See `devlog/_plan/` for the conversion sequence and the per-skill conversion delta.
