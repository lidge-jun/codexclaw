# messenger_bridge — Phase 2: codex exec runner

Status: SHIPPED (D closed 2026-07-03; 31/31 messenger-bridge suite; live
exec+resume continuity PROVEN with real codex) · class C3

## A audit (2026-07-03): FAIL → 5 findings fixed

1. CLI arg shapes confirmed against codex-cli 0.142.5 (exec prompt via stdin;
   `exec resume [SESSION_ID] [PROMPT]`; -m/--json/--dangerously-bypass/
   --skip-git-repo-check all present).
2. Event names match cli-jaw parser — also parse `item.completed`/`item.started`
   command_execution as status (not just started).
3. `listRecentJobs` doesn't exist → used existing `listJobs(bindingId, n)`.
4. Missing-rollout text CONFIRMED by live probe (fake UUID, no quota spent):
   `thread/resume failed: no rollout found for thread id <id>` → RESUME_LOST_RE
   heuristic validated.
5. Design hardening applied: queue idle-key deletion + settled-tail cleanup;
   timeout = SIGTERM then SIGKILL after 3s grace; stdin written only after the
   child `spawn` event; AgentService child registry + shutdown() to reap
   in-flight codex processes on serve stop.

## D record (2026-07-03)

- Built: `src/runner.ts` (buildExecArgs, parseExecEvent, runTurn + re-seed
  fallback), `src/queue.ts` (SerialQueues), `src/agent-service.ts`
  (AgentService, buildReseedBlock). Tests: runner/queue/agent-service (+ fake
  hermetic codex bin at `test/fixtures/fake-codex.mjs`).
- KEY LEARNING (build constraint): Node strip-only mode rejects TS constructor
  parameter properties (`constructor(private x)`) — repo-wide rule. Rewrote to
  explicit field + assignment. Also: codex prints resume failures to STDERR and
  exits 0, so the runner treats "exit 0 without turn.completed" as failure.
- Verification: 31/31 unit; `npm run build` OK (65 files). Live (default model,
  real codex): TURN1 "remember 42"→"OK", TURN2 "which number?"→"42", identical
  thread id `019f2386-e4eb-...` — memory carried across resume.
- KNOWN LIMITATION → Phase 7: `gpt-5.3-codex-spark` rejects the run with
  "Unsupported value: 'none' is not supported" because the runner passes no
  reasoning-effort config and codex defaults spark to effort=none. buildExecArgs
  needs an `effort` param (cli-jaw: omit reasoning args for spark, pin
  context/compact) when the GUI model picker lands. Default model works today.

---
(original plan below)

Status: P DRAFT (2026-07-03; enters A after Phase 1 closes D) · class C3

## Part 1 — plain

The runner is the one place that talks to Codex. Give it a binding and a
prompt; it spawns stock `codex exec` (new thread) or `codex exec resume
<thread_id>` (continuation), full permissions, `--json`. It streams parsed
events to the caller (adapters render typing/status from them), captures the
thread id on first run, persists it, and serializes turns per binding so one
chat never runs two turns at once while different chats run in parallel. If a
resume is unrecoverable it re-seeds a fresh thread from the recent job log and
carries on — the binding survives.

## Evidence base (ground truth for event shapes)

| Fact | Source |
| --- | --- |
| session id: `thread.started` event carries `thread_id` | cli-jaw `src/agent/events/index.ts:31` + developers.openai.com/codex/noninteractive (checked 2026-07-02) |
| final text: `item.completed` with `item.type === "agent_message"`, text in `item.text` | cli-jaw `src/agent/events/codex.ts:24-27` |
| tool/status stream: `item.started` (`command_execution` etc.) | cli-jaw `src/agent/events/codex.ts:52-67` |
| turn end: `turn.completed` (usage) / `turn.failed` / `error` (error.message) | cli-jaw `src/agent/events/codex.ts:72-96` |
| new-run prompt goes via STDIN; resume passes prompt as positional arg | cli-jaw `src/agent/spawn.ts:1992-1996` + `src/agent/args.ts:345-357` |
| resume arg shape: `exec resume <sessionId> <prompt> --json` | cli-jaw `src/agent/args.ts:347-357` |

## Part 2 — diff-level

### NEW `plugins/codexclaw/components/messenger-bridge/src/runner.ts`

- `buildExecArgs({ threadId, model, fullAccess })` — pure, unit-testable:
  - new: `["exec", ...(model? ["-m", model]:[]), "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check", "--json"]` (prompt via stdin)
  - resume: `["exec", "resume", ...(model? ["--model", model]:[]), "--dangerously-bypass-approvals-and-sandbox", "--skip-git-repo-check", threadId, prompt, "--json"]`
  - `fullAccess` is always true per interview decision, but the flag exists so
    Phase 9 can add a read-only mode without contract change.
- `parseExecEvent(line: string): RunnerEvent | null` — pure JSONL line parser →
  discriminated union: `{kind:"thread", threadId}` | `{kind:"status", label}`
  (from item.started command_execution/tool calls) | `{kind:"message", text}`
  (agent_message) | `{kind:"done", usage}` | `{kind:"fail", message}`.
- `runTurn(opts: { workdir, prompt, threadId?, model?, codexBin?, onEvent?, timeoutMs? }): Promise<TurnResult>`
  — child_process.spawn, line-buffer stdout, feed parseExecEvent, write prompt
  to stdin for new runs; resolves `{ ok, threadId, text, usage?, error? }`.
  Timeout (default 600_000ms) kills the child and resolves fail.
- Re-seed fallback: when a resume run fails fast with a thread-not-found class
  error (stderr/errmsg match `no rollout|not found|resume`), retry ONCE as a
  new thread whose prompt is prefixed by a seed block built from the last N=10
  jobs (`prompt_preview` + `result_preview`) — explicit `[context re-seed]`
  header so the model knows history is summarized. Emits `{kind:"status",
  label:"re-seeding session"}`.

### NEW `plugins/codexclaw/components/messenger-bridge/src/queue.ts`

- `SerialQueues` — Map<key, tail promise + pending count>.
  `enqueue(key, task)` returns `{ position }` synchronously-knowable pending
  count so adapters can send "queued (n ahead)" before awaiting. Per-key strict
  FIFO; keys independent. Cap per key (default 20) → reject with QueueFullError.

### NEW `plugins/codexclaw/components/messenger-bridge/src/agent-service.ts`

- Glue over db + queue + runner (the API adapters/phase-5 routes call):
  `handleIncoming({ db, kind, chatId, text, workdir, onEvent }): Promise<{ ok, text?, error?, queued? }>`
  — getOrCreateBinding → createJob → enqueue(binding.id) → runTurn with
  binding.thread_id → on thread event persist setBindingThread → update job
  state (running→done/error, result_preview = text.slice(0,500)) → return final.

### MODIFY `src/db.ts` (Phase 1 file)

- jobs schema gains `result_preview TEXT` (amended INTO the v1 CREATE while
  Phase 1 is still unbuilt — no migration needed; recorded here for audit).
- `listRecentJobs(bindingId, n)` for the re-seed block.

### NEW tests `test/runner.test.ts`, `test/queue.test.ts`, `test/agent-service.test.ts`

- runner: buildExecArgs shapes (new vs resume, model flag); parseExecEvent on
  captured fixture lines (thread.started, item.completed agent_message,
  item.started command_execution, turn.completed, turn.failed, garbage line →
  null); runTurn against a FAKE codex bin (node script fixture emitting JSONL —
  no network, no real codex) incl. stdin-prompt delivery, timeout kill, resume
  thread-not-found → re-seed retry path.
- queue: FIFO per key, parallel across keys, position reporting, cap rejection.
- agent-service: fake runner injection — binding thread persisted once,
  job rows transition queued→running→done, error path records error.

## Verification (C gate)

- Unit suite green (fake-bin runner tests are hermetic).
- Live smoke (manual, quota-cheap): `node -e` invoking runTurn with real codex
  `-m gpt-5.3-codex-spark` "say hi", then resume same thread "say hi again" —
  verify same thread_id continuity and rollout visible to `codexclaw chat search`.
