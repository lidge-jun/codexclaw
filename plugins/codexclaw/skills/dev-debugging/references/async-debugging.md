# Async Debugging Reference

Concurrency bugs are hard because they are non-deterministic. This reference
covers detection patterns and fix strategies for the most common async issues.

---

## Race Conditions

**Symptoms**: Intermittent failures. Tests pass individually but fail in suite.
Behavior changes with timing (fast machine vs slow CI). Order-dependent results.

**Detection**:

1. Add artificial delays (`setTimeout`, `asyncio.sleep`) between suspected operations — if behavior changes, timing is involved
2. Log timestamps at each async operation — look for unexpected ordering
3. Run under load (concurrent requests) to amplify the window
4. Check: are two operations reading/writing shared state without coordination?

**Fix Patterns**:

| Pattern | When to Use |
|---------|------------|
| Mutex / Lock | Single writer, exclusive access to shared state |
| Queue serialization | Operations must execute in order (use a job queue) |
| Optimistic locking | DB: add version column, reject stale writes |
| Atomic operations | Simple counters/flags (e.g., `INCR` in Redis) |
| Compare-and-swap | Lock-free update: read → compute → write-if-unchanged |

---

## Deadlocks

**Symptoms**: Process hangs without error. No timeout fires. CPU idle but
request never completes. Appears under specific concurrency patterns only.

**Detection**:

1. Thread dump: `kill -3 <pid>` (JVM), `process._getActiveHandles()` (Node.js)
2. Check for circular wait: A holds lock X, waits for Y; B holds Y, waits for X
3. `async_hooks` (Node.js): trace which async operations are pending
4. Database: `SELECT * FROM pg_locks WHERE NOT granted;` (PostgreSQL)

**Fix Patterns**:

| Fix | Description |
|-----|-------------|
| Lock ordering | Always acquire locks in the same global order (alphabetical, by ID) |
| Timeout + retry | Add timeout to lock acquisition; retry with backoff |
| Lock-free design | Replace locks with message passing or event sourcing |
| Reduce lock scope | Hold locks for the minimum critical section only |

---

## Event Loop Blocking

**Symptoms**: All requests slow simultaneously. Timeouts under load. Server
responds in bursts. Single slow endpoint degrades everything.

**Detection**:

1. Event loop lag metric: `perf_hooks.monitorEventLoopDelay()` (Node.js)
2. `--prof` flag: generate V8 CPU profile, look for long synchronous frames
3. `blocked-at` npm package: reports where the event loop blocked and for how long
4. Check for: `JSON.parse` on large payloads, `fs.readFileSync`, crypto operations, large loops

**Fix Patterns**:

| Fix | Description |
|-----|-------------|
| Worker threads | Offload CPU-bound work to `worker_threads` |
| Chunk work | Break large loops into batches with `setImmediate` between |
| Stream processing | Replace `readFileSync` / large `JSON.parse` with streaming |
| Move to background | Use job queue (BullMQ, Celery) for expensive operations |

---

## Promise / Callback Issues

**Unhandled Rejections**: Promise rejects but no `.catch()` or `try/catch` around `await`.

```javascript
// BAD: silent failure
fetchUser(id).then(user => process(user));

// GOOD: explicit error handling
fetchUser(id).then(user => process(user)).catch(err => {
  logger.error('fetchUser failed', { id, error: err.message });
});
```

**Lost Error Context**: Wrapping errors without preserving the original stack.

```javascript
// BAD: original stack lost
catch (err) { throw new Error('Processing failed'); }

// GOOD: chain cause
catch (err) { throw new Error('Processing failed', { cause: err }); }
```

**Callback Hell / Unstructured Async**: Deeply nested callbacks make error
propagation impossible to follow. Refactor to async/await with try/catch.

---

## Common Async Anti-Patterns

| Pattern | Symptom | Fix |
|---------|---------|-----|
| `await` in a loop | Requests serialize — N items take N x latency | `Promise.all()` or `Promise.allSettled()` for independent operations |
| Fire-and-forget without error handling | Silent failures, lost data | Always attach `.catch()` or `try/catch` — log at minimum |
| Shared mutable state across async ops | Intermittent wrong values | Isolate state per request, or use atomic operations |
| Missing `await` on async function | Returns Promise instead of value, downstream TypeError | Lint rule: `require-await`, check return types |
| `setTimeout` for sequencing | Brittle, fails under load | Use proper coordination: events, queues, or await |
| Catching and swallowing errors | Bug disappears but root cause persists | Catch, log with context, re-throw or handle meaningfully |

---

## Node.js Specific Tools

| Tool | Purpose |
|------|---------|
| `async_hooks` | Trace async operation lifecycle (init, before, after, destroy). Identify leaked contexts. |
| `wtfnode` | Detect what is keeping the process alive (open handles, timers, sockets) |
| `why-is-node-running` | Similar to wtfnode — prints active handles preventing exit |
| `clinic.js` | Suite: Doctor (event loop), Bubbleprof (async flow), Flame (CPU) |
| `--trace-warnings` | Shows stack trace for unhandled rejections and deprecation warnings |
| `process._getActiveHandles()` | Quick REPL check for open handles (sockets, timers, servers) |
| `node --inspect` + Performance tab | Record async timeline, identify gaps and queuing |
