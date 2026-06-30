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
