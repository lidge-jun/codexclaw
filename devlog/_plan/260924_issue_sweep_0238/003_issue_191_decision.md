# #191 decision: codexclaw does not override the native memory quota guard

Issue #191 asked codexclaw to (1) set `memories.min_rate_limit_remaining_percent = 0` when provider-bridge sees non-OpenAI ocx routing, (2) inject a recall-based read fallback when native memories are off, and (3) show the gating reason in `cxc memory status`. On 2026-09-24 the user chose to record codexclaw's decision and close the issue. This page is that record.

## Decision

| Request | Decision | Basis |
|---|---|---|
| Routing-aware quota override | Not implemented, by design | provider-bridge reads only `running`, `defaultProvider` and `port` from `ocx status`. None of those proves which provider or account a memory extraction used, so writing a global quota key from them would be a guess. Threshold zero is also not a reliable bypass: with `rate_limit_reached_type` present the core guard rejects before the threshold arithmetic runs (0.2.36 comment on #191). |
| Automatic read fallback when native memories are off | Declined | #191 asked SessionStart to inject a recall-based, cwd-scoped summary when `features.memories` or `use_memories` is off. codexclaw does not add that injection: the recall hook points to the recall commands (plugins/codexclaw/components/recall/src/hook.ts:648-652) and the manual alternative is `cxc memory search`, which falls back to chat search and does not depend on the native memory flag (plugins/codexclaw/components/recall/src/memory-search.ts:613-626, :671). An automatic summary for sessions whose memory the host deliberately disabled would override that host choice. |
| Show why extraction is blocked | Shipped in 0.2.36, limited to what can be observed | `cxc memory status` reports `observationSource`, `effectiveExtractionRoute: "unknown"` and `startupGuardDecision: "unknown"` on every path (plugins/codexclaw/components/recall/src/memory-status.ts:36-37, :76-77, :191). A quota-blocked start leaves no job row, so codexclaw cannot report the guard's decision without guessing. |

## Where the real fix lives

The Codex core memory guard keys on authentication (`auth.uses_codex_backend()`) while extraction routes through `config.model_provider`. Matching the guard to the effective extraction route is a change to Codex core (`memories/write/src/guard.rs`, `start.rs`), verified on both the native and provider sides. That code is outside this repository, so the issue closes here as a codexclaw decision rather than a codexclaw fix. If the core guard changes, codexclaw's memory status can report the real decision instead of `unknown`.

## Closing comment (posted to #191)

The comment repeats the table above in prose, links this file at the commit that adds it, and names the upstream boundary.

## Audit round 1 folds

- Finding 10: the read-fallback row now says the automatic cwd-scoped injection is declined, and names cxc memory search as the manual alternative.
