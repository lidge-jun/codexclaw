# 012 — Memory / Context Parity (mostly confirmed non-goal + one drift fix)

Gap class: STRUCTURAL (architecturally server-bound) · evidence: 2 parallel explorers (Parfit/Locke-class) reading `cli-jaw/src/memory/*` + `src/prompt/builder.ts` against the plugin hook layer

> cli-jaw's memory system is a 3-tier, server + SQLite stack: History Block, Memory Flush,
> Task Snapshot, FTS5/embedding index, HTTP `/api/memory/*`, dashboard federation. codexclaw
> is a Codex *plugin* whose only context-injection channel is one `UserPromptSubmit`
> `additionalContext` string — and that string carries PABCD directives, not recalled memory.
> L10 already declares memory a non-goal. This doc confirms that's honest, separates the few
> no-server-possible items, and fixes one real doc drift.

## Parity table

| cli-jaw feature | codexclaw | no-server possible? |
| --- | --- | --- |
| History Block — raw recent transcript (8000 chars/10 sessions) prepended on new session (`spawn.ts:567-613`) | none (`UserPromptSubmit` injects directives only) | PARTIAL — Codex passes `transcript_path` to the hook (`hook.ts:31`); a tail-read could inject. But cli-jaw's `messages` DB + working-dir scoping needs a server for true parity |
| Memory Flush — every N responses, separate spawn extracts to `episodes/live/*.md` (`memory-flush-controller.ts:85-137`) | none | NO — needs a response-loop + extractor spawn the hook layer can't drive |
| Advanced Prompt Injection — `## Memory Runtime` + Profile + Soul + Task Snapshot into system prompt (`injection.ts:19-44`) | none — plugin doesn't own the system prompt | NO — cli-jaw is the orchestrator that spawns the CLI; a plugin can't assemble the system prompt |
| Task Snapshot — index-search the user prompt, inject <=4 hits (`builder.ts:536`) | none (no index) | PARTIAL — a local FTS5 index built/queried by CLI could inject via the hook |
| Core Memory — `MEMORY.md` + session memory injected (10000/1500 chars) (`builder.ts:423-480`) | none | YES — read a static `.codexclaw/` md and inject; genuinely server-free |
| Indexing — FTS5 BM25 + trigram + synonym RRF (`indexing.ts:209`) | none | PARTIAL — local SQLite FTS5 is server-free, but cli-jaw ties it to dashboard/federation |
| Embedding/vector/hybrid (`embedding/*`) | none | NO — dashboard add-on, multi-instance sync, background catchall = server |
| HTTP `/api/memory/*` | none | NO — codexclaw runs no HTTP server (L10 non-goal) |
| dashboard cross-instance federation | none | NO — server + multi `~/.cli-jaw*` |

## Verdict

The memory non-goal in L10 is **honest** — most of this is structurally impossible for a
single no-server plugin. Three items are genuinely no-server and remain *candidates* (not
commitments), all already noted elsewhere:
1. transcript-tail History Block via `UserPromptSubmit` (Codex already passes the path).
2. static `.codexclaw/` Core Memory md injection.
3. local FTS5 index built/queried by CLI for a Task-Snapshot-style inject.

These overlap with the deferred post-compaction recovery (`006`) and the deferred external
OS scheduler (`mvp_res/290`). No new commitment here — just keeping the door honest.

## Drift fix (RESOLVED 2026-06-30 by commit 301aa0b)

L10 lists `cxc chat-search` (a `thread/search` wrapper) as **in-scope/shipped**, but the
code **retired it**: there is no `chat-search.ts`, and `cxc-ops.test.ts:131-163` asserts the
subcommand is *gone* (`cli.ts:24-37` exposes only doctor/reset). The doc is more optimistic
than the code. This was corrected by a parallel session: `100_L10_*` now carries a dated
SUPERSEDED-IN-PART banner (chat-search retired L13/WP1, history kept), `110_L11_*` strikes
the command from the live list with a RETIRED note, and the contradiction register B-cluster
is marked RESOLVED (gate-guarded). Recorded here for the audit trail; no action remains.

## Enforcement tier

All memory items are E7-or-impossible. The drift fix is an E8 truthfulness correction
(doc must match the test that already enforces retirement). No runtime work.

## Proposed slice

No new loop for memory itself (confirmed non-goal). The chat-search drift correction is
already resolved (301aa0b), so nothing remains to schedule here.
