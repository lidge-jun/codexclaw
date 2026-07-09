# 002 — Subagent Evidence Gate (SubagentStop)

Gap class: HARNESS (missing hook surface) · evidence: explorer Darwin

> This is the single biggest harness hole. omo registers a `SubagentStop` hook that
> refuses to let a subagent "finish" without an evidence receipt. codexclaw has **zero**
> `SubagentStop` hooks — a dispatched subagent's "done" claim is never verified at runtime.
>
> RUNTIME-VERIFIED (2026-07-01, see `010`): `SubagentStop` is a real Codex hook event, it
> FIRES on plugin thread-spawned children, its stdin carries the child's `last_assistant_message`
> + `agent_type` + `agent_id` + `transcript_path`, and `decision:"block"` + `reason` forces the
> child to continue. So this gate is genuine **E1**, not doctrine. codex-rs: `protocol.rs:1355`,
> `schema.rs:578-595`, `hook_runtime.rs:294-355`, `stop.rs:263-274`, `turn.rs:330-340`.

## Parity table

| omo 실측 | codexclaw 실측 | 격차 | jaw식 보강 |
| --- | --- | --- | --- |
| `lazycodex-executor-verify/hooks/hooks.json:3` (`SubagentStop` matcher `^lazycodex-executor$`) | none in the 6 registered hooks | omo verifies executor completion; codexclaw cannot | add a 7th hook: `SubagentStop` with a matcher scoped to the executor/verify role |
| `lazycodex-executor-verify/src/codex-hook.ts:15` + `directive.md:5` (require `EVIDENCE_RECORDED: <path>` last line, else `decision:"block"`) | absent | omo blocks on missing receipt; codexclaw has no completion gate | `SubagentStop` checks the child's final message for a receipt marker; block + inject verifier directive if missing |
| `codex-hook.ts:52` (`.omo/evidence` root only; resolve/realpath; no symlink; non-empty file) | absent | omo path-validates the receipt; codexclaw has no `.codexclaw/evidence` check | port the path guard to a `.codexclaw/evidence` root |
| `codex-hook.ts:19` (attempt state; block up to `MAX_ATTEMPTS` then release) | absent | omo bounds the block so it can't trap; codexclaw has nothing to bound | `.codexclaw/evidence-attempts/*.json`; bounded block, then release |

## Reinforcement shape (no-server)

New hook `hooks/subagent-stop-verifying-evidence.json` -> pabcd-state CLI
`hook subagent-stop`:

0. Hook JSON keys the matcher on `agent_type` (omo: `"matcher": "^lazycodex-executor$"`),
   so it only fires for write/verify dispatches, not every child. The runtime matches the
   `agent_type` value the parent passed to `spawn_agent` (verified `010` Q1).
1. Read the child's final assistant text from stdin — field is `last_assistant_message`
   (verified present on `SubagentStopCommandInput`, `schema.rs:578-595`); `transcript_path`
   is also available for a context-pressure bail (omo `CONTEXT_PRESSURE_MARKERS`).
2. Look for `EVIDENCE_RECORDED: <relpath>` (or codexclaw's `--evidence` convention).
3. Validate the path is inside `.codexclaw/evidence/`, real (no symlink), non-empty
   (port omo's `isNonEmptyFileInsideEvidenceRoot` realpath/symlink guard).
4. Missing/invalid + under attempt cap -> `decision:"block"` with a verifier directive
   (runtime turns the `reason` into a continuation prompt, `stop.rs:263-274`).
5. Over the cap or valid -> release (fail-open so it can never trap a session); also bail
   if the transcript shows a context-pressure marker.

This is E1-strength (it can actually refuse the stop), but on the SubagentStop surface
rather than PreToolUse. It is the cleanest single addition that closes the largest gap.

## Important scope note (steering principle)

This does NOT add a new role. The matcher targets the existing `executor`/`reviewer`
base role when it carries a write/verify task. The receipt requirement is what makes a
skill-attached red-team dispatch (`008`) trustworthy: a `reviewer` told to "red-team per
`cxc-dev-frontend`" must return an evidence receipt, not just prose.

## Enforcement tier

NEW surface: SubagentStop block — confirmed **E1** (runtime-verified `010` Q1, not "E1-class
if it works"). The hook can refuse the child's stop and force continuation. No prose
equivalent exists today. This is the single highest-value add in the lazygap track.

## Depends on / feeds

Uses the `.codexclaw/evidence` convention; pairs with `001` (criterion evidence) and
`008` (skill-attached dispatch needs a receipt to be trustworthy).
