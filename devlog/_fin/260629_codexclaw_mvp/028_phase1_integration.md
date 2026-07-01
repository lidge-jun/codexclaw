# 028 — Phase 1 Integration

Status: TODO  ·  Phase 1

## Goal
Wire the pieces and prove the end-to-end MVP loop.

## Flow
1. Build: `scripts/build.mjs` compiles components → dist, aggregates skills/hooks/agents.
2. Install: marketplace add + plugin add.
3. Skill discovery: pabcd + pilot dev skill visible/routable.
4. IPABCD round-trip: trigger → state P→A→...; ledger records.
5. Subagent: spawn explorer on default model.
6. Config guard: config.toml unchanged.

## Verify
- All Phase 1 success criteria S1–S5 (see 020) pass.
