# Swift Debugging

Covers Xcode CLT, LLDB, Instruments, Swift concurrency (async/await + actors),
iOS simulator from CLI, crash log symbolication.
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
swift --version
xcodebuild -version 2>/dev/null || echo 'CLT only'
xcrun --find lldb
xcrun simctl list devices 2>/dev/null | head -10
ls *.xcodeproj *.xcworkspace Package.swift 2>/dev/null
```

**dSYM gotcha**: LLDB needs debug info (`.dSYM`), `.swiftmodule` files, and
correct source paths (`-debug-prefix-map` / `target.source-map`) to evaluate
Swift expressions. Missing any of these makes `po` unreliable — use `v`
(frame variable) or `p` as fallback, run `swift-healthcheck` inside LLDB.

## Debugging Hierarchy (use in order)

1. **Repro logs + XCTest** — `print()` / `os_log` / `Logger`, then a failing
   test if the bug is reproducible.
2. **LLDB breakpoints** — `b FileName.swift:42`, `p expr`, `po expr` (calls
   `debugDescription`), `v localVar` (no side effects). `po` can lie when
   modules or dSYMs are missing; prefer `v` when unsure.
3. **Instruments** — Time Profiler, Swift Concurrency (actor contention, async
   task scheduling — Xcode 27+), System Trace, Leaks. Profile RELEASE builds;
   Debug profiling can mislead (Apple guidance).
4. **Crash log symbolication** — `xcrun crashlog crash.ips`, verify dSYM UUIDs
   match (`dwarfdump --uuid`).

## iOS Simulator (CLI, no Xcode GUI)

```bash
xcrun simctl boot "iPhone 16"
xcodebuild -scheme MyApp -sdk iphonesimulator -derivedDataPath build/
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/MyApp.app
xcrun simctl launch --wait-for-debugger booted com.example.MyApp
# In another terminal:
lldb
process attach --name MyApp --waitfor
```

## Agent Gotchas

- `expression` evaluation can have side effects — prefer `v` for read-only.
- Async/actor values may be unevaluable while executors are paused.
- No GUI = weak visual trace analysis; capture `.trace` files for later review.
- Simulator reset (`simctl erase`) is destructive; prefer `simctl uninstall`.

## Silent-Failure Patterns

| Pattern | Symptom | Best probe |
| --- | --- | --- |
| Unsymbolicated crash | Hex addresses only | Verify `.dSYM` + UUID match |
| Actor/task stall | Hang without crash | Swift Concurrency instrument |
| `po` returns wrong value | Stale or generic output | Use `v` instead; `swift-healthcheck` |
| Force-unwrap on nil | Crash far from nil origin | Audit `!` usage; add guard/let |

## Cleanup

```bash
xcrun simctl shutdown booted 2>/dev/null || true
rm -rf build/ DerivedData/
# Preserve .dSYM if crash logs may need them later
```
