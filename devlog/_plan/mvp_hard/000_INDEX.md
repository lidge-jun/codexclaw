# codexclaw MVP-HARD — Parity Hardening Plan (mvp_hard)

Status: CANONICAL INDEX · 2026-06-30 · parity-hardening track that follows `../mvp_res/`

> `mvp_res/` shipped L1-L28 (the codex-native MVP). `mvp_hard/` is the **parity-hardening**
> track: it closes the gap between codexclaw's current `$`-mention + UserPromptSubmit-hook UX
> and the cli-jaw / jawcode harness experience (notably the `orchestrate I/P/A/B/C/D/reset`
> state-control surface), *without* re-adding a server runtime. Codex-native means: `$cxc-*`
> autocomplete (skill mentions) + hooks + file state + `cxc` CLI only — no SlashCommand enum
> edits to codex-rs, no external orchestrator.

## Naming convention (LOCKED — inherited from mvp_res)

- `000-009` = research / parity audit (this INDEX + inbound findings).
- Each hardening **loop Ln** owns a **decade**: `010=L1`, `020=L2`, ...
- Decade head doc is `0X0_L<n>_<slug>.md`; finer sub-passes are `0X1_L<n>.1_<slug>.md`.
- Directory sort order == execution order.
- Project shorthand `cxc` is primary in all examples; full `codexclaw` shown once per doc max.

## Why this track exists (one-liner)

cli-jaw exposes an explicit, user-drivable PABCD state machine via `cli-jaw orchestrate <phase>`
(a server CLI). codexclaw has the FSM logic (`pabcd-state` component: `transition()`, attest
gates) but **no user-facing way to drive it from the chat composer** — the UserPromptSubmit hook
only injects directives on loose text triggers and never writes `state.phase`. This track ports
the missing control surface using the codex-native `$ + hook` model.

## Constraints (LOCKED)

- No codex-rs fork. `/`-slash commands are a hardcoded `SlashCommand` enum and are OUT.
- `$cxc-*` skill mentions are the discovery surface (already live, 16 skills namespaced).
- State transitions are driven by the existing `UserPromptSubmit` hook parsing submitted prompt
  text, plus the `cxc` CLI (`bin/codexclaw.mjs`) for terminal-side control.
- File-based state only (`.codexclaw/sessions/<id>.json` + `ledger.jsonl`).
- SUB-CLOSE discipline + atomic conventional commits (inherited from mvp_res).

## Loop ledger — L1.. (filled as research lands)

| Ln | decade | scope | status |
|----|--------|-------|--------|
| L1 | 010 | Parity audit: cli-jaw/jawcode/omo vs codexclaw, `$`+hook UX gap map | ANALYZED |
| L2 | 020 | FSM legal-transition table + four-transition attest gate | PLANNED |
| L3 | 030 | `$cxc-orchestrate` grammar + hook wiring to `transition()` (the missing wire) | PLANNED |
| L4 | 040 | `cxc orchestrate` CLI over the same file state | PLANNED |
| L5 | 050 | `status` / `reset` / `D` chat affordances + ledger-on-transition | PLANNED |
| L6 | 060 | Stop-continuation loop with omo termination guards | PLANNED |
| L7 | 070 | human free-pass vs agent-gated discriminator + pabcd skill-doc rewrite | PLANNED |

## Research inbox

- `010_L1_parity_audit.md` — synthesized parity-gap findings (this pass).
