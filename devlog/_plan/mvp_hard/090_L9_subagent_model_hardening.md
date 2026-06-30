# L9 / 090 - Subagent/Model Hardening Parity Plan

Status: DONE (parity plan only; runtime deferred) · 2026-06-30 · mvp_hard loop L9 · class C3 (subagent/model parity; docs-created, runtime deferred)

## Goal

L9 turns the subagent/model parity findings into an executable implementation plan. The
current repo already ships role TOMLs, `.codexclaw/subagents.json` persistence, MCP/GUI
roundtrip, and `resolveSpawnConfig()` resolver tests. The remaining gap is that no production
spawn wrapper consumes that resolver when calling Codex `spawn_agent`, and the operator CLI /
catalog parity is still incomplete.

## Shipped Ground Truth

- Role prompt sources exist in `plugins/codexclaw/agents/{explorer,reviewer,executor}.toml`.
- Per-role config persistence exists in
  `plugins/codexclaw/components/subagent-config/src/store.ts`.
- `resolveSpawnConfig(cwd, role)` returns the selected model/prompt override, but current tests
  prove resolver behavior only; they do not prove a real `spawn_agent` call consumes it.
- GUI/MCP roundtrip the same `.codexclaw/subagents.json` role config.
- `buildCatalog()` merges native models plus ocx-provided model ids when those ids are handed to
  it, but the GUI provider bridge currently exposes status/port, not an ocx model list.
- Root `bin/codexclaw.mjs` still prints placeholder text for `cxc subagents` and `cxc provider`.

## Remaining Parity Gaps

1. **Production spawn wrapper**:
   - Add a codexclaw-owned wrapper that maps canonical roles to Codex `agent_type`, reads each
     role TOML, applies `resolveSpawnConfig()`, and passes model/prompt override into the actual
     `spawn_agent` call path.
   - Preserve default mode: `model: null` means inherit the main Codex model.
2. **Catalog slug parity**:
   - Read native/ocx catalog entries by `id` and `slug`.
   - Deduplicate by stable id/slug while keeping native entries first.
   - Treat routed provider ids like `provider/model` as selectable entries only when supplied by
     a real catalog surface; keep provider bridge detect-only.
3. **Operator surfaces**:
   - Replace root `cxc subagents` placeholder with a real get/set CLI over
     `.codexclaw/subagents.json`, or explicitly mark it non-shipped in help.
   - Replace root `cxc provider` placeholder with read-only provider/catalog status, not an
     `ocx ensure`/config mutator.
4. **OMO role variants**:
   - Keep canonical roles `explorer`, `reviewer`, and `executor`.
   - Model OMO-like variants as prompt presets or future bounded role variants only after a real
     spawn wrapper exists; do not invent first-class live roles without a spawn surface.

## Implementation Slice Map

| Slice | Scope | Acceptance |
|-------|-------|------------|
| L9.1 | Spawn wrapper contract | A configured reviewer/explorer/executor model + prompt override are applied by a real wrapper around `spawn_agent`; default roles inherit the main model. |
| L9.2 | Catalog slug parity | Fixtures prove native `id`, native `slug`, and routed provider/model slug entries are read/deduped correctly, native first. |
| L9.3 | CLI/operator surface | `cxc subagents` and GUI/MCP roundtrip the same state, or the CLI help explicitly marks the surface as non-shipped. |
| L9.4 | Role variant policy | OMO-like variants are implemented as bounded prompt presets or documented as deferred; README/agents/structure docs do not overclaim. |

## Out of Scope For This Pass

- No runtime spawn wrapper is implemented in this `090` pass.
- No new first-class Codex agent roles are registered.
- No `ocx ensure`, `ocx sync`, or global Codex config mutation is introduced.
- No `plugins/codexclaw/bin` path is referenced; the CLI entry is root `bin/codexclaw.mjs`.

## Verification For This Pass

- `test -f devlog/_plan/mvp_hard/090_L9_subagent_model_hardening.md`
- `rg -n "resolveSpawnConfig|spawn wrapper|bin/codexclaw.mjs|docs-created|runtime deferred" devlog/_plan/mvp_hard/090_L9_subagent_model_hardening.md plugins/codexclaw/agents/README.md`
- `git diff --check`
- `npm test`

## Audit Verdict

Independent reviewer `Helmholtz` returned **PASS**. Guardrails folded in:
root CLI placeholders live at `bin/codexclaw.mjs`, and S8/S10 must be described as
persistence + resolver evidence rather than proof of production spawn execution.

## Completion Evidence

L9 closes the parity-plan slice only. It does not implement the runtime spawn
wrapper, slug catalog parity, or operator CLI surfaces. Those remain explicit
follow-up slices (`L9.1` through `L9.4`) and must not be described as shipped.

Fresh closure review:

- `Fermat` (gpt-5.5 read-only plan audit): PASS - marking L9 as `DONE` is safe
  when the wording remains plan-only/runtime-deferred and does not overclaim
  implementation.
- Stop-audit blocker resolved: `000_INDEX.md` no longer leaves the L8-L12
  completion span with a single `PLANNED` L9 entry.

Verification for this closure:

- `rg -n "L9|runtime deferred|spawn wrapper|operator" devlog/_plan/mvp_hard/000_INDEX.md devlog/_plan/mvp_hard/090_L9_subagent_model_hardening.md`
- `git diff --check`
- `npm test`
- `node bin/codexclaw.mjs doctor`
