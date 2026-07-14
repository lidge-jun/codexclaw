# Codex app-server background-terminal runtime guide

Date: 2026-07-13  
Upstream anchor: [openai/codex PR #26041](https://github.com/openai/codex/pull/26041)  
Merge commit: [`a1a8807e9d67fad4b95f2730a9669eca5a9d27d0`](https://github.com/openai/codex/commit/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0)  
First containing release: [`rust-v0.140.0`](https://github.com/openai/codex/releases/tag/rust-v0.140.0)

## 1. What the feature is

The feature is an experimental v2 app-server control surface over long-lived processes created by a thread's unified-exec tool manager:

- `thread/backgroundTerminals/list`
- `thread/backgroundTerminals/terminate`
- `thread/backgroundTerminals/clean`

It is not a new model-visible shell command. The model still starts and interacts with the process through `exec_command` and `write_stdin`. An app-server client, such as Codex Desktop, uses the methods above to discover and stop processes left alive after their initiating tool call or turn.

It is also not a durable job system. There is no restart guarantee, completion callback, retry policy, persisted job record, cron schedule, or cross-host ownership contract.

## 2. Source-level ownership map

```text
JSON-RPC request
  ↓
app-server-protocol/src/protocol/common.rs
  ClientRequest variants + experimental method markers
  ↓
app-server/src/message_processor.rs
  initialize gate + experimentalApi check + method dispatch
  ↓
app-server/src/request_processors/thread_processor.rs
  load_thread(threadId) + pagination + processId parsing
  ↓
core/src/codex_thread.rs
  public thread-scoped façade
  ↓
core/src/tasks/mod.rs
  Session delegates through its unified_exec_manager field
  ↓
core/src/unified_exec/process_manager.rs
  UnifiedExecProcessManager: active-process store, list ordering, confirmed termination
  ↓
core/src/unified_exec/process.rs
  OS/exec-server termination mechanics
```

### Protocol definitions

- [`codex-rs/app-server-protocol/src/protocol/common.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server-protocol/src/protocol/common.rs#L574-L597) registers `list` and `terminate` with `#[experimental(...)]`; `clean` is the existing sibling method.
- [`codex-rs/app-server-protocol/src/protocol/v2/thread.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server-protocol/src/protocol/v2/thread.rs#L929-L986) owns request and response shapes.
- [`codex-rs/app-server-protocol/src/export.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server-protocol/src/export.rs#L39-L48) includes `ThreadBackgroundTerminal` in experimental generated bindings.

The serialized terminal shape is:

```json
{
  "itemId": "item/tool-call identifier",
  "processId": "42",
  "command": "python3 -m http.server",
  "cwd": "/absolute/path",
  "osPid": null,
  "cpuPercent": null,
  "rssKb": null
}
```

`processId` is the app-server/unified-exec identifier, serialized as a string. It must not be treated as a verified OS PID. At the merge commit and current `main`, the app-server explicitly fills `osPid`, `cpuPercent`, and `rssKb` with `None`.

### Capability gate and dispatch

- [`codex-rs/app-server/src/message_processor.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server/src/message_processor.rs#L838-L846) rejects experimental requests unless the initialized connection enabled the experimental API.
- The same file dispatches the three `ClientRequest` variants to `ThreadProcessor` at [lines 1124-1137](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server/src/message_processor.rs#L1124-L1137).

Required initialization payload:

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"background-terminal-client","version":"0.1.0"},"capabilities":{"experimentalApi":true}}}
{"method":"initialized","params":{}}
```

The app-server examples omit a `jsonrpc` member; newline-delimited stdio requests in the live `0.144.0-alpha.4` probe used the same shape successfully.

### Thread processor

[`codex-rs/app-server/src/request_processors/thread_processor.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server/src/request_processors/thread_processor.rs#L1730-L1791) defines the behavior:

- `clean` loads the thread and submits `Op::CleanBackgroundTerminals`.
- `list` loads the thread, calls `list_background_terminals()`, maps core fields, and paginates.
- `terminate` parses the string `processId` as `i32`, loads the thread, and returns the boolean from `terminate_background_terminal()`.

`load_thread()` is the critical scope boundary. Its exact lookup is visible in [`thread_processor.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server/src/request_processors/thread_processor.rs#L683-L698). The core manager stores loaded threads in memory ([`thread_manager.rs#L199-L204`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/thread_manager.rs#L199-L204)) and returns `ThreadNotFound` when the ID is absent ([`thread_manager.rs#L1001-L1008`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/thread_manager.rs#L1001-L1008)). A persisted rollout ID is not enough by itself. The target thread must be materialized in the app-server instance handling the request. A second app-server process does not inherit the Desktop process's in-memory thread or unified-exec registry.

Pagination uses a process-ID cursor. The processor tests cover page continuation, a vanished anchor, and invalid cursors in [`thread_processor_tests.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server/src/request_processors/thread_processor_tests.rs#L39-L96).

### Core thread and session façade

- [`codex-rs/core/src/codex_thread.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/codex_thread.rs#L162-L168) defines `BackgroundTerminalInfo`.
- Its methods at [lines 407-415](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/codex_thread.rs#L407-L415) delegate into the session.
- [`codex-rs/core/src/tasks/mod.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/tasks/mod.rs#L779-L795) delegates list, single terminate, and clean-all to the session's `unified_exec_manager`.

This explains why `turn/interrupt` and terminal cleanup are different. Interrupt cancels the active task; it does not drain the session's unified-exec process store. The upstream README states this explicitly at [`app-server/README.md#L852-L900`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/app-server/README.md#L852-L900).

### Unified-exec manager

The upstream type is `UnifiedExecProcessManager`, defined in [`core/src/unified_exec/mod.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/unified_exec/mod.rs#L133-L149). The session field that stores it is named `unified_exec_manager`. [`codex-rs/core/src/unified_exec/process_manager.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/unified_exec/process_manager.rs#L1286-L1354) owns the process registry behavior:

- `terminate_all_processes()` drains the store, clears reserved IDs, unregisters network approval, and terminates each process.
- `list_processes()` filters out exited entries, sorts by numeric process ID, and returns call ID, app-server process ID, command, and cwd.
- `terminate_process()` returns `false` for an unknown ID, waits for confirmed termination for a live process, and removes the entry safely.

The upstream test `unified_exec_persists_across_requests` now proves list → terminate true → terminate false → list empty in [`core/src/unified_exec/mod_tests.rs`](https://github.com/openai/codex/blob/a1a8807e9d67fad4b95f2730a9669eca5a9d27d0/codex-rs/core/src/unified_exec/mod_tests.rs#L344-L392).

Additional tests cover termination while the initial `exec_command` response or an empty `write_stdin` poll is in flight. These tests matter because lifecycle control can race with model-tool polling.

## 3. What is and is not listed

### Listed

- A process created by the thread's unified `exec_command` path.
- The process is still in the session's `UnifiedExecProcessManager`, reached through the `unified_exec_manager` field.
- The process has not exited.
- The request reaches the same app-server instance where the thread is loaded.

### Not listed

- A process already exited and filtered out by `has_exited()`.
- An arbitrary OS process discovered by PID scanning.
- A shell launched outside Codex.
- A `command/exec` app-server utility process.

`command/exec` is deliberately separate. Current `main` stores it in `CommandExecManager`, keyed by `(connectionId, processId)`, in [`app-server/src/command_exec.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/command_exec.rs#L47-L74). Its processor owns `command/exec/write`, `resize`, and `terminate` in [`request_processors/command_exec_processor.rs`](https://github.com/openai/codex/blob/main/codex-rs/app-server/src/request_processors/command_exec_processor.rs#L31-L79). It does not register the process in the thread's `UnifiedExecProcessManager`, so `thread/backgroundTerminals/list` is not a general `command/exec` inspector.

## 4. Generate and inspect the exact local contract

Use the binary that owns the runtime you are testing, not an unrelated `codex` found earlier on `PATH`:

```bash
CODEX_BIN="/Applications/ChatGPT.app/Contents/Resources/codex"
"$CODEX_BIN" --version

SCHEMA_DIR="$(mktemp -d /tmp/codex-app-schema.XXXXXX)"
"$CODEX_BIN" app-server generate-json-schema --experimental --out "$SCHEMA_DIR"

rg -n 'backgroundTerminals|experimentalApi' "$SCHEMA_DIR"
sed -n '1,180p' "$SCHEMA_DIR/v2/ThreadBackgroundTerminalsListParams.json"
sed -n '1,220p' "$SCHEMA_DIR/v2/ThreadBackgroundTerminalsListResponse.json"
sed -n '1,180p' "$SCHEMA_DIR/v2/ThreadBackgroundTerminalsTerminateParams.json"
```

Expected local version during this research: `codex-cli 0.144.0-alpha.4`.

## 5. Start an app-server you can actually control

### Stdio

```bash
codex app-server --stdio
```

The client writes one compact JSON message per line and continuously reads responses and notifications. Keep the child process and its stdin/stdout open for the entire lifecycle.

### WebSocket

```bash
codex app-server --listen ws://127.0.0.1:8765
```

Loopback listeners are the suitable development form. Non-loopback listeners require the app-server's WebSocket authentication options. Do not expose an unauthenticated control endpoint.

The crucial rule is ownership: create/resume the thread and run its turns through this same server instance. Launching another app-server and sending a Desktop thread ID to it does not attach to the Desktop process.

## 6. End-to-end JSON-RPC sequence

### Step 1: initialize experimental methods

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"cxc-probe","version":"0.1.0"},"capabilities":{"experimentalApi":true}}}
{"method":"initialized","params":{}}
```

Without `experimentalApi:true`, the message processor returns an invalid-request error for these methods.

### Step 2: materialize the thread in this app-server

For an existing rollout:

```json
{"id":2,"method":"thread/resume","params":{"threadId":"019f...","excludeTurns":true}}
```

For a new test thread, call `thread/start` with the normal configuration required by the generated schema. Capture the returned `thread.id`; do not substitute a rollout ID owned only by another process.

### Step 3: create a real unified-exec background process

Start a normal turn and ask the model to use `exec_command` with a command that outlives its first yield. A harmless test command is:

```bash
for _ in 1 2 3 4 5 6; do
  date '+background-probe %Y-%m-%dT%H:%M:%S%z'
  sleep 10
done
```

This probe ends by itself after roughly one minute if teardown fails. The test still must terminate it explicitly and confirm an empty final list; bounded duration is a safety backstop, not a substitute for cleanup.

The model-side tool must return a live session/process identifier. A direct app-server `command/exec` request does not satisfy this test because it uses the separate manager described above.

### Step 4: list

```json
{"id":3,"method":"thread/backgroundTerminals/list","params":{"threadId":"019f...","limit":20}}
```

Expected success shape:

```json
{"id":3,"result":{"data":[{"itemId":"...","processId":"42","command":"for _ in 1 2 3 4 5 6; do ...; done","cwd":"/workspace","osPid":null,"cpuPercent":null,"rssKb":null}],"nextCursor":null}}
```

If the response is `thread not found`, first check whether the request went to a second app-server instance. Do not interpret this as method absence. A missing method normally fails at dispatch; `thread not found` means the method was recognized and reached thread loading.

### Step 5: interact through the model tool path when needed

Use the matching `write_stdin` session handle for input or polling. An empty write/poll reads new output without inventing a new process. The app-server list method is an inventory/control surface, not a replacement for terminal I/O.

### Step 6: terminate one process

Use the `processId` returned by `list`; do not guess from `osPid` or shell output.

```json
{"id":4,"method":"thread/backgroundTerminals/terminate","params":{"threadId":"019f...","processId":"42"}}
```

Expected result:

```json
{"id":4,"result":{"terminated":true}}
```

A second termination may return `false`, which is the expected idempotent/unknown-process result after removal.

### Step 7: verify teardown

```json
{"id":5,"method":"thread/backgroundTerminals/list","params":{"threadId":"019f..."}}
```

Expected:

```json
{"id":5,"result":{"data":[],"nextCursor":null}}
```

For explicit all-process cleanup:

```json
{"id":6,"method":"thread/backgroundTerminals/clean","params":{"threadId":"019f..."}}
```

`clean` returns acceptance (`{}`); follow it with `list` to prove the observable state.

## 7. Desktop-specific limitation

Codex Desktop `0.144.0-alpha.4` was observed starting:

```text
/Applications/ChatGPT.app/Contents/Resources/codex \
  -c features.code_mode_host=true app-server --analytics-default-enabled
```

Its fd 0/1 connection is a private Unix socket pair to the Electron parent. There is no public TCP listener for a second client. Injecting bytes into that stream would corrupt request IDs and framing, so codexclaw must not attempt it.

Safe choices are:

1. let the Desktop frontend call the API on its existing connection;
2. run and own a separate app-server plus its threads end to end; or
3. wait for the host to expose an authenticated endpoint or model-visible lifecycle tool.

## 8. Ephemeral observation captured during planning

The output below came from the interactive planning turn and has no repository transcript. Treat it as an observation that motivated the plan, not durable verification. Phase 3 must save a redacted fresh probe artifact and use that artifact as the authoritative evidence.

Experimental initialization succeeded against the bundled binary:

```json
{"id":1,"result":{"userAgent":"Codex Desktop/0.144.0-alpha.4 (Mac OS 27.0.0; arm64) dumb (codex-runtime-probe; 0.1.0)","codexHome":"<redacted>","platformFamily":"unix","platformOs":"macos"}}
```

A list request sent to the separate probe instance returned:

```json
{"error":{"code":-32600,"message":"thread not found: …b161d"},"id":2}
```

The same task then created unified-exec session `46623` with the heartbeat loop. The Desktop background-terminal surface showed it, proving the same-instance happy path. The process was stopped with `Ctrl-C`; the terminal session exited with code `1`, which is expected for an interrupted loop.

## 9. Failure interpretation table

| Symptom | Meaning | Action |
|---|---|---|
| Experimental-method error | `experimentalApi` was not negotiated | Reinitialize the connection with the capability. |
| `thread not found` | Target thread is not loaded in this app-server instance | Start/resume it on the same instance; do not attach by rollout ID alone. |
| `data: []` | No live unified-exec entries remain | Confirm the command used model `exec_command`, not app-server `command/exec`, and that it has not exited. |
| Invalid process ID | `processId` was non-numeric or malformed | Use the exact string returned by `list`. |
| `terminated: false` | Unknown/already removed process or confirmed termination failure | Re-list before retrying; do not fall back to blind OS kill. |
| Turn interrupted but shell remains | Expected separation between task cancellation and process lifecycle | Call `terminate` or `clean`, then re-list. |
| Fields `osPid/cpuPercent/rssKb` are null | Current server does not populate host metrics | Do not treat null as probe failure. |

## 10. Codexclaw integration rule

Codexclaw should describe a two-surface lifecycle:

- Model surface: `exec_command` creates; `write_stdin` polls/writes/interrupts the known session.
- App-server surface: `list` discovers all live unified-exec terminals for a loaded thread; `terminate` stops one; `clean` stops all.

If the current tool surface exposes no app-server lifecycle call, the agent must stay with its known unified-exec session handle and report the limitation. It must not start a second app-server, scan arbitrary OS processes, or claim that `turn/interrupt` cleaned the terminal.
