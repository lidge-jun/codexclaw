# Process Isolation

When to isolate work from the main process, and which mechanism to use.

**Origin:** ima2-gen SSE hang — a CPU-bound image generation task blocked the event loop, causing all SSE connections to stall. Process-level isolation would have contained the failure.

---

## Decision Matrix

| Workload Characteristic | Mechanism | Reason |
|------------------------|-----------|--------|
| CPU-bound (image resize, hashing, parsing) | `worker_threads` | Shares memory via SharedArrayBuffer, low overhead, same V8 isolate rules |
| Untrusted/unstable code (plugins, user scripts) | `child_process` with sandbox | Full process boundary; crash cannot corrupt parent; use `cgroup`/`seccomp` |
| Stateful long-running (queue consumer, WebSocket relay) | Separate service | Independent lifecycle, deploy, and scale; communicate over HTTP/gRPC |
| I/O-bound (DB queries, API calls) | **None — use async in main thread** | Node async I/O already non-blocking; extra process adds latency |

---

## Communication Patterns

| Mechanism | Use With | Characteristics |
|-----------|----------|-----------------|
| `MessagePort` (structured clone) | `worker_threads` | Zero-copy for ArrayBuffer via transfer list; structured clone for objects |
| IPC (JSON over pipe) | `child_process` | Serialization overhead; 200KB practical message limit before perf degrades |
| HTTP / gRPC | Separate service | Network boundary; retryable; load-balanceable; schema-enforced contracts |
| Shared memory (`SharedArrayBuffer` + `Atomics`) | `worker_threads` only | Lock-free perf-critical paths; complex — prefer MessagePort unless proven need |

---

## Resource Limits & Graceful Shutdown

| Concern | Rule |
|---------|------|
| Worker pool size | Cap at `os.cpus().length - 1`; never unbounded |
| Child process timeout | Always set `timeout` option; kill on exceed |
| Memory per worker | Set `--max-old-space-size` per worker; monitor RSS |
| Graceful shutdown | Signal workers to drain → wait (with deadline) → force kill |
| Health check | Parent must detect hung worker (heartbeat or watchdog timer) |

```
// Shutdown sequence
1. Stop accepting new tasks
2. Signal workers: "finish current, reject new"
3. Await with timeout (e.g., 10s)
4. SIGTERM remaining workers
5. After 5s grace: SIGKILL
```

---

## Anti-Patterns

| Banned | Fix |
|--------|-----|
| CPU-intensive work in main thread (event loop block) | Move to `worker_threads` with pool (e.g., piscina, workerpool) |
| Spawning unbounded workers per request | Use a fixed-size pool; queue excess work |
| `child_process` without timeout | Always pass `{ timeout: 30_000 }` or implement watchdog |
| No crash recovery for child processes | Restart with backoff; alert after N consecutive failures |
| Using `worker_threads` for untrusted code | Use `child_process` + `seccomp`/`cgroup` — threads share address space |
| Passing large objects via IPC (>1MB) | Stream via file/pipe or use shared memory for `worker_threads` |
| Fire-and-forget spawns (no `on('exit')` handler) | Always handle exit/error events; track active children |
