# Go Debugging

Covers goroutines, Delve (`dlv`), pprof, the race detector. Most Go bugs are
about goroutines doing something quiet and wrong.
Lineage: lazycodex `runtimes/go.md` + gpt-5.5 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
go version; cat go.mod | head -5
which dlv; dlv version
grep -r '// +build\|//go:build' cmd/ internal/ pkg/ 2>/dev/null | head
grep -r 'net/http/pprof\|runtime/pprof' --include='*.go' | head -3
```

## Delve (`dlv`) — the Go Debugger

**Use dlv, not gdb.** Plain gdb on a Go binary misses goroutine state and
prints garbage for interface values (Tier-2: go.dev/doc/gdb).

### Launch Modes

```bash
dlv debug ./cmd/server -- --port=8080       # build + debug (like go run)
dlv test ./internal/handler/                # debug test binary
dlv exec ./bin/myserver                     # existing binary
dlv attach $(pgrep myserver)                # running process
dlv debug --headless --listen=:2345 --api-version=2 ./cmd/server  # IDE attach
```

### Debuggable Build

```bash
go build -gcflags="all=-N -l" -o ./bin/server ./cmd/server
# -N disables optimization, -l disables inlining
```

### Essential Commands

`b main.main`, `b handler.go:42` breakpoints; `c` continue; `n` next;
`s` step; `so` stepout; `bt`/`stack` backtrace; `goroutines` list all;
`goroutine <id>` switch; `goroutine <id> bt` stack of specific goroutine;
`locals`, `args`, `p <expr>`, `vars <regex>`.

**`trace <location>`** — like a logpoint: logs without stopping. Underused.
**`on <bpid> print <expr>`** — auto-print on breakpoint hit.

## Goroutine-Centric Debugging

| `goroutines` shows | Usually means |
| --- | --- |
| 100s stuck at `chan receive` | Producer died; consumers leak |
| 100s stuck at `semacquire` | Lock contention / deadlock |
| One stuck at `select` with no default | Missing case or closed channel |
| Growing count over time | Goroutine leak |

## Race Detector — Run FIRST for Intermittent Bugs

```bash
go test -race ./...
go run -race ./cmd/server
```

Wraps memory accesses; catches concurrent R/W without sync. Output gives both
stacks + both goroutines. Costs ~5-10x memory, 2-20x time — use deliberately
in tests/stress/CI, not production (Tier-2: go.dev/doc/articles/race_detector).

## pprof — Performance / Memory / Goroutine Leaks

```go
import _ "net/http/pprof"    // wire up (usually already present)
```

```bash
go tool pprof http://localhost:6060/debug/pprof/profile?seconds=30  # CPU
go tool pprof http://localhost:6060/debug/pprof/heap                # heap
go tool pprof http://localhost:6060/debug/pprof/goroutine           # goroutine leaks
```

For goroutine leaks, take two snapshots 30s apart and diff:
```bash
go tool pprof -base prof1.pb.gz prof2.pb.gz
```

Inside pprof: `top`, `list main.handler`, `web` (SVG callgraph).

## `GODEBUG` — Runtime Observability

```bash
GODEBUG=gctrace=1 ./myserver              # GC stats
GODEBUG=schedtrace=1000 ./myserver        # scheduler trace every 1s
```

## Silent-Failure Patterns

| Pattern | Why silent |
| --- | --- |
| `if err != nil { return err }` to ignoring caller | Error bubbles up then discarded |
| `defer func() { recover() }()` bare, no log | Panic swallowed, state corrupted |
| `_, _ = conn.Write(data)` | Intentionally discarded error |
| `go func() { ... }()` no error path | Goroutine dies silently on panic |
| Context canceled but operation continues | Ignored `ctx.Err()` |
| `json.Unmarshal` zero-value struct field | Missing key returns zero silently |
| Closed channel read without `ok` check | Reads zero forever |

## Cleanup

```bash
pkill -f 'dlv' || true
lsof -iTCP:2345 -sTCP:LISTEN -nP 2>/dev/null
lsof -iTCP:6060 -sTCP:LISTEN -nP 2>/dev/null
git diff | grep -E 'fmt\.Println\("DEBUG|log\.Printf\("DEBUG'
git checkout <file>
unset GODEBUG
```
