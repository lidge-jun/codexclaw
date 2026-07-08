# 000 - Codex-rs Native Tooling Research Plan

**Unit:** `260707_codex_rs_native_tooling_research`
**Created:** 2026-07-07 KST
**Work class:** C3/C5 documentation research. No runtime code changes.
**Terminal target:** DONE with durable research docs only.

## Objective

Create one devlog research unit that answers four requested ranges:

- `000-099`: inspect `codex-rs` and record non-native Codexclaw tool combinations that could attach more natively.
- `100-199`: record where Codexclaw/Codex-rs lags other agent harnesses.
- `200-299`: extract applicable practices from Thariq Shihipar's Fable field guide and adjacent loop-engineering sources.
- `300-399`: independent recommendations and next experiments.

## Scope

In scope:

- Read-only inspection of `/Users/jun/Developer/codex/120_codex-cli/codex-rs`.
- Read-only inspection of `/Users/jun/Developer/codex/171_oh-my-codex/docs`.
- Read-only inspection of Codexclaw source-of-truth docs under `structure/` and `plugins/codexclaw/`.
- Current-source web research for Fable, Claude Code, Cursor, Goose, and OpenHands.
- New markdown files under this folder only.

Out of scope:

- Product code changes.
- Config changes.
- Hook installation changes.
- Commits, pushes, dependency installs, destructive cleanup, or moving old devlog units.

## Evidence Collected

Local repo mapping:

- `cxc map .` highlighted Codexclaw owners such as `components/pabcd-state`, `components/subagent-config`, and `components/messenger-bridge`.
- `cxc map /Users/jun/Developer/codex/120_codex-cli/codex-rs` highlighted `exec-server/src/server/session_registry.rs`, `core/src/exec.rs`, `mcp-server`, hooks, app server protocol, state, and agent-job tests.
- `cxc map plugins/codexclaw/components/pabcd-state` identified FSM, orchestration, Stop, divergence, metrics, and subagent evidence owners.
- `cxc map plugins/codexclaw/components/subagent-config` identified spawn payload, spawn attach hook, role config, catalog, and MCP ownership.

Key local paths:

- `/Users/jun/Developer/codex/120_codex-cli/codex-rs/mcp-server/src/message_processor.rs`
- `/Users/jun/Developer/codex/120_codex-cli/codex-rs/mcp-server/src/codex_tool_config.rs`
- `/Users/jun/Developer/codex/120_codex-cli/codex-rs/mcp-server/src/codex_tool_runner.rs`
- `/Users/jun/Developer/codex/120_codex-cli/codex-rs/hooks/src/events/session_start.rs`
- `/Users/jun/Developer/codex/120_codex-cli/codex-rs/hooks/src/events/stop.rs`
- `/Users/jun/Developer/codex/120_codex-cli/codex-rs/ext/*`
- `structure/10_subagent_skill_routing.md`
- `structure/20_pabcd_dispatch_doctrine.md`
- `structure/40_enforcement_methods.md`
- `structure/60_native_capabilities.md`
- `/Users/jun/Developer/codex/171_oh-my-codex/docs/codex-native-hooks.md`
- `/Users/jun/Developer/codex/171_oh-my-codex/docs/contracts/rust-runtime-thin-adapter-contract.md`
- `/Users/jun/Developer/codex/171_oh-my-codex/docs/contracts/runtime-command-event-snapshot-schema.md`

Tier-2/public source checks:

- Anthropic/Claude blog, `A Field Guide to Claude Fable: Finding Your Unknowns`, by Thariq Shihipar, dated 2026-07-06: `https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns`
- Companion examples page: `https://thariqs.github.io/html-effectiveness/unknowns/`
- Claude Platform docs, `Prompting Claude Fable 5`: `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5`
- Claude blog, `Getting started with loops`: `https://claude.com/blog/getting-started-with-loops`
- Claude Code docs, scheduled tasks / `/loop`: `https://code.claude.com/docs/en/scheduled-tasks`
- Claude Code docs, hooks reference: `https://code.claude.com/docs/en/hooks`
- Cursor changelog 1.0: `https://cursor.com/changelog/1-0`
- Cursor docs landing metadata: `https://cursor.com/docs`
- Goose docs homepage: `https://goose-docs.ai/`
- OpenHands docs and official/source-backed pages: `https://docs.openhands.dev/overview/introduction`, `https://docs.openhands.dev/overview/skills`, `https://docs.openhands.dev/openhands/usage/customization/repository`, `https://github.com/OpenHands/openhands`

Ambiguity note:

- The Thariq source is verified as a Fable field guide published on 2026-07-06.
- A single verified source that is simultaneously "by Thariq" and titled "loop engineering guide" was not found. The loop-engineering portion is therefore synthesized from the Thariq field guide plus official Claude loop docs and the Fable prompting docs.

## File Map

- `001_codex_rs_native_surface.md`: requested `000-099` range.
- `100_harness_gap_ledger.md`: requested `100-199` range.
- `200_fable_loop_adoption.md`: requested `200-299` range.
- `300_recommendations.md`: requested `300-399` range.

## Loop Spec

- **Loop archetype:** spec-satisfaction research/documentation.
- **Trigger:** user requested numbered devlog research with cxc-loop and cxc-search.
- **Goal:** durable docs with local and public-source evidence.
- **Non-goals:** code changes, config changes, installs, commits.
- **Verifier:** file listing plus markdown/evidence grep.
- **Stop condition:** all requested numeric ranges have substantive docs and source/evidence sections.
- **Memory artifact:** this folder.
- **Expected terminal outcomes:** DONE, BLOCKED, NEEDS_HUMAN, or BUDGET_EXHAUSTED as defined in the host goal.
- **Resource bounds:** local filesystem reads, web fetch/open, read-only subagents, docs-only writes under this folder.

## Work-Phase Plan

1. Gather local evidence with `cxc map`, `rg`, and targeted `nl -ba` reads.
2. Gather public evidence with `cxc-search` discipline: discover, open/fetch, label ambiguity.
3. Write the four requested range documents.
4. Audit docs for numbering, source evidence, and unsupported claims.
5. Verify file layout and headings/evidence markers.

