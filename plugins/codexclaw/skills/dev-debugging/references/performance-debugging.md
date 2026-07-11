# Performance Debugging Protocol (DEBUG-PERF-01, DEFAULT)

Source: sol research (addyosmani/agent-skills performance-optimization, obra/superpowers).

## Workflow: Measure → Identify → Fix → Verify → Guard

### 1. Measure (baseline)

- Define the controlled workload: input size, concurrency, warm-up iterations
- Capture baseline distribution: p50, p95, p99, max (not just average)
- Record resource profile: CPU, memory, I/O, network, GC pressure
- Use framework-appropriate profiler: Chrome DevTools, `perf`, `pprof`, `py-spy`, `cargo flamegraph`
- Warm up before measuring; discard cold-start samples

### 2. Identify (bottleneck)

- Attribute time to specific functions/queries/network calls
- Distinguish CPU-bound vs I/O-bound vs memory-pressure vs GC-bound
- For database: EXPLAIN (ANALYZE, BUFFERS) before and after
- For frontend: Lighthouse, Core Web Vitals, rendering waterfall
- For API: request timeline breakdown (network, parse, process, serialize, send)

### 3. Fix (targeted change)

- Change ONE thing at a time
- Keep the workload identical to baseline
- Re-measure with the same methodology

### 4. Verify (evidence)

- Compare post-fix distribution against baseline at the SAME percentiles
- Report effect size, not just "it's faster"
- Verify no regression in adjacent metrics (memory for CPU fix, latency for throughput fix)

### 5. Guard (regression prevention)

- Add a performance test with the workload and threshold
- Threshold = baseline p99 × safety factor (typically 1.2-1.5x)
- Run in CI on a consistent environment (not developer laptops)
- Alert on regression, don't just log

## Anti-patterns

- Measuring only averages (hides tail latency)
- Optimizing without profiling (guessing the bottleneck)
- Micro-benchmarking in isolation (misses system-level effects)
- Claiming improvement without controlled comparison
- Premature optimization before correctness
