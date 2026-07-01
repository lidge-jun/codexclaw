# 000 — Research & Context Anchor

Date: 2026-06-29
Status: REFERENCE (durable — read this first after any context loss)

## What codexclaw is (one line)
A single Codex plugin that **reuses the OpenAI `codex` runtime** and layers cli-jaw-style
dev discipline (`dev-*` skills + IPABCD) plus multi-model subagents, with an **optional**
opencodex provider bridge.

## The three-layer model (do not confuse them)

| Layer | Thing | Role | Owned by |
|-------|-------|------|----------|
| Harness | OpenAI `codex` (codex-cli 0.142.3) | the actual agent runtime | OpenAI |
| Provider routing | `opencodex` / `ocx` (@bitkyc08/opencodex 2.6.4) | **provider proxy**, NOT a harness | jun (lidge-jun) |
| Plugin | `codexclaw` | dev skills + IPABCD + subagents + GUI | this repo |

### Critical correction (verified 2026-06-29)
- "opencodex 하네스"는 **존재하지 않는다.** `ocx --help` 첫 줄: *"Universal provider proxy for Codex"*.
- `ocx stop` → "restore native Codex" : codex는 ocx와 독립적으로 멀쩡히 작동.
- 따라서 "하네스를 따라간다"의 대상은 opencodex가 아니라 OpenAI `codex`다.
- opencodex가 따라가게 해주는 것은 **프로바이더/모델 라우팅**뿐.

## Verified facts (commands run)
- `which codex` → `~/.bun/bin/codex`, `codex-cli 0.142.3` (harness, current runtime).
- `which opencodex` → `/opt/homebrew/bin/opencodex` → `/Users/jun/Developer/new/700_projects/opencodex/bin/ocx.mjs`.
- opencodex package: `@bitkyc08/opencodex`, repo `github.com/lidge-jun/opencodex`, deps `bun, zod`.
- opencodex has a GUI already: `gui/` = Vite + React, pages `Providers.tsx`, `Subagents.tsx`,
  `Usage.tsx`, `Logs.tsx`, `CodexAuth.tsx`. Dashboard at `localhost:10100`.
- Subagent spawn in this env already lists `openai/small-model` as "Routed via opencodex → openai"
  → multi-model subagent routing partly works through ocx today.

## Reference implementation: lazycodex → omo
Cloned to `devlog/.lazycodex/` (gitignored). Structural lessons:
- **Single plugin namespace** (`omo`) with `components/` isolation; build aggregates into one plugin.
- **Hooks ARE the state-transition mechanism** (no server):
  - `SessionStart` → bootstrap/provisioning (download/ensure external deps).
  - `UserPromptSubmit` → trigger detection + `additionalContext` injection (idempotent).
  - `Stop` / `SubagentStop` → continuation decision, evidence verification.
  - `PreToolUse` → `permissionDecision: "deny"` gate (forced behavior).
  - `PostCompact` → reset/reload cached state.
- **State in files**, not server memory: `.omo/ulw-loop/` goals + `ledger.jsonl` (FSM).
- **Plugin CAN have npm deps + run external binaries** (`.mcp.json` command entries; omo's
  `package.json` has dependencies). So "plugins can't depend on externals" is FALSE.
- **Deployment = real Codex plugin**, two channels:
  - npx installer (`lazycodex-ai` → forwards to `oh-my-openagent omo install --platform=codex`) — convenience wrapper.
  - marketplace: `codex plugin marketplace add <repo>` → `codex plugin add omo@sisyphuslabs`.
  - The marketplace path is the real one; npx is optional sugar. **codexclaw uses marketplace only.**

## cli-jaw conventions to mirror

### devlog _plan numbering (this folder follows it)
- `0X0_` groups a phase; IPABCD steps are suffixes within: `plan → audit → build → check → verification → done`.
- Fine-grained increments (`001`, `011`, `021`...) are allowed for sub-items.
- Example from cli-jaw: `010_000_004_..._plan.md`, `014_..._done.md`, `020_..._plan.md`.

### skill format: cli-jaw vs codex (MUST convert in phase 060)
| Field | cli-jaw `skills_ref/dev` | codex (omo) target |
|-------|--------------------------|--------------------|
| `description` | feature prose | **"MUST USE for ..." trigger dictionary** (auto-routing) |
| `metadata` | `{ "keywords": [...] }` | `short-description: ...` |
| body | assumes `cli-jaw orchestrate`, orchestrator injection | runtime-agnostic pure guide |
| routing | orchestrator injects | codex auto-selects via description triggers |

Conversion = (a) rewrite description as trigger phrases, (b) convert metadata shape,
(c) strip cli-jaw-only paths/commands (`dist/`, `verify-counts.sh`, `devlog/`, `cli-jaw orchestrate`).

cli-jaw `dev-*` family to port: `dev`, `dev-architecture`, `dev-backend`, `dev-code-reviewer`,
`dev-data`, `dev-debugging`, `dev-devops`, `dev-frontend`, `dev-pabcd`, `dev-scaffolding`,
`dev-security`, `dev-testing`, `dev-uiux-design`. (Plus `claude-devfleet` — review for relevance.)

## Confirmed design decisions (jun)
- D1: Reuse codex runtime. opencodex is a provider proxy, not a harness — do not fork a harness.
- D2: opencodex is OPTIONAL. ocx-free users still get dev skills + IPABCD + default-model subagents.
- D3: Interfaces = CLI commands + web GUI. No TUI, no install wizard.
- D4: codexclaw ships its OWN GUI (subagent default/multi-model config + prompt tuning) AND shows
  a link bar to `localhost:10100` when ocx is detected.
- D5: opencodex stays an EXTERNAL dependency (not vendored) so "updates tracked upstream, zero
  maintenance" holds. SessionStart hook only *ensures* it when present.

## Phase map (see numbered files)
- 010 repo & plugin skeleton — DONE
- 020 provider bridge (ocx ensure / graceful skip)
- 030 IPABCD state machine (file FSM + hooks)
- 040 subagent config (default/multi-model + prompt overrides)
- 050 GUI (subagent config + 10100 link bar)
- 060 dev-* skills migration (format conversion above)
- 070 packaging & marketplace
