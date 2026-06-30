# 006 — Compaction Recovery + SessionStart Scope

Gap class: HARNESS (one real add, rest non-goal) · evidence: explorer Beauvoir

> omo recovers deliberately after context compaction (3 PostCompact hooks). codexclaw has
> no PostCompact hook; it only re-injects a stage header on the next UserPromptSubmit.

## Parity table

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 |
| --- | --- | --- | --- |
| `rules/hooks/hooks.json:40-52` + `rules/src/post-compact-directive.ts:3-39` + `lsp/...:106-109` + `git-bash/...:83-87` (3 PostCompact hooks: rule cache reset, LSP probe reset, reminder reset) | no PostCompact in `plugin.json:20-27`; only UserPromptSubmit re-inject (`hook.ts:156-176,265-303`) | omo recovers right after compaction; codexclaw waits for the next prompt | one `PostCompact` hook that resets the `.codexclaw/sessions` re-inject flag / ledger cursor and re-points the agent at local state files |
| `telemetry/...` + `bootstrap/...` + `session-start-checking-auto-update.json` (SessionStart telemetry + bootstrap spawn + auto-update) | `session-start-ensuring-provider-bridge.json` + `provider-bridge/src/detect.ts` (detect-only, no ensure/sync, no config write) | omo auto-provisions/updates; codexclaw is detect-only by design | keep detect-only; at most strengthen the `doctor`/status line |

## Reinforcement shape (no-server)

One genuine add: `hooks/post-compact-*.json` -> pabcd-state CLI `hook post-compact`:

- Reset the session re-injection flag and ledger cursor so the next turn re-surfaces the
  PABCD stage + the local state files to read (goalplan, ledger).
- No daemon recovery, no cache server — just a one-shot state-pointer reset.

## Non-goals (reaffirmed)

- Auto-update / telemetry / bootstrap provisioning at SessionStart — out. Provider bridge
  stays detect-only (`structure/00_philosophy.md` §2).

## Enforcement tier

E4 (post-compaction directive re-inject). Single new hook surface (PostCompact).

---

## cli-jaw memory/context parity (second sweep, folded from 012)

Evidence: 2 explorers reading `cli-jaw/src/memory/*` + `src/prompt/builder.ts`.

> cli-jaw's memory system is a 3-tier server + SQLite stack: History Block, Memory Flush,
> Task Snapshot, FTS5/embedding index, HTTP `/api/memory/*`, dashboard federation. The
> host-native boundary makes most of this a **structural** non-goal: codexclaw is a Codex
> plugin whose only context-injection channel is one `UserPromptSubmit` `additionalContext`
> string — and that carries PABCD directives, not recalled memory. cli-jaw can do memory
> because it *is* the orchestrator that assembles the system prompt and spawns the CLI;
> a plugin owns neither. L10 already declares memory a non-goal, and this confirms it honest.

| cli-jaw feature | no-server possible? |
| --- | --- |
| History Block — raw recent transcript prepended on new session (`spawn.ts:567-613`) | PARTIAL — Codex passes `transcript_path` to the hook (`hook.ts:31`); a tail-read could inject, but cli-jaw's `messages` DB + working-dir scoping needs a server for true parity |
| Memory Flush — every N responses a separate spawn extracts to `episodes/*.md` (`memory-flush-controller.ts:85`) | NO — needs a response-loop + extractor spawn the hook layer can't drive |
| Advanced Prompt Injection — Profile/Soul/Task-Snapshot into the system prompt (`injection.ts:19`) | NO — a plugin doesn't own the system prompt; cli-jaw is the orchestrator that assembles it |
| Task Snapshot — index-search the prompt, inject <=4 hits (`builder.ts:536`) | PARTIAL — a local FTS5 index built/queried by CLI could inject via the hook |
| Core Memory — static `MEMORY.md` + session memory injected (`builder.ts:423`) | YES — read a static `.codexclaw/` md and inject; genuinely server-free |
| Indexing FTS5 / embedding / HTTP `/api/memory/*` / dashboard federation | NO — server, multi-instance sync, background catchall |

### Verdict

The memory non-goal is honest — most is structurally impossible for a single no-server
plugin. Three items are genuinely no-server *candidates* (not commitments), and all overlap
the PostCompact recovery above + the deferred external OS scheduler (`mvp_res/290`):
1. transcript-tail History Block via `UserPromptSubmit` (Codex already passes the path);
2. static `.codexclaw/` Core Memory md injection;
3. local FTS5 index built/queried by CLI for a Task-Snapshot-style inject.

No new commitment — the PostCompact hook above is the only memory-adjacent add this track
proposes, and it is a state-pointer reset, not a memory store.

### chat-search drift (RESOLVED 2026-06-30 by 301aa0b)

L10 had listed `cxc chat-search` (a `thread/search` wrapper) as in-scope, but the code
retired it (`cxc-ops.test.ts:131-163` asserts the subcommand is gone). This was the same
false-DONE class flagged before. A parallel session corrected it: `100_L10_*` now carries a
SUPERSEDED-IN-PART banner, `110_L11_*` strikes the command with a RETIRED note, and the
contradiction register B-cluster is marked RESOLVED (gate-guarded). Recorded for the audit
trail; no action remains. Thread search is host-native (Codex owns it), not a codexclaw command.

### Enforcement tier (memory)

All memory items are E7-or-impossible. The drift fix was an E8 truthfulness correction
(doc made to match the test that already enforces retirement), now landed. No runtime work.
