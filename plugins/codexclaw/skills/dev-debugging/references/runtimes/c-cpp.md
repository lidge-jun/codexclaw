# C/C++ Debugging

Covers GCC/Clang, CMake, sanitizers (ASan/TSan/MSan/UBSan), GDB/LLDB,
Valgrind, core dumps. C/C++ silent failures are mostly undefined behavior —
sanitizers catch them before you need a symbolic stepping session.
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
uname -a
cc --version || gcc --version
c++ --version || clang++ --version
cmake --version
gdb --version || true
lldb --version || true
valgrind --version || true
ulimit -c                                # core dump limit
cat /proc/sys/kernel/core_pattern 2>/dev/null || true
file ./app 2>/dev/null                   # stripped? debug symbols?
```

## Debugging Hierarchy (use in order)

1. **Reproduce + logs + assertions** — `assert()`, `fprintf(stderr, ...)`.
   Cheapest, often sufficient for logic bugs.
2. **ASan + UBSan** — first-pass sanitizers for memory and UB bugs. Default
   choice for any crash or corruption suspicion.
3. **TSan / MSan** — targeted builds for data races (TSan, high overhead) or
   uninitialized reads (MSan, requires clean instrumented deps).
4. **GDB / LLDB** — attach or core-dump analysis. GDB strongest on Linux;
   LLDB native on macOS/LLVM. Use AFTER sanitizers narrow the area.
5. **Valgrind** — when you cannot rebuild with sanitizers, or need
   Memcheck's origin-tracking / leak detail.
6. **rr** (Linux) — time-travel debugging for order-dependent bugs.

## Build Recipes

```bash
# Debug build (symbols, no optimization)
cmake -S . -B build-debug -G Ninja -DCMAKE_BUILD_TYPE=Debug
cmake --build build-debug -j

# ASan + UBSan build
cmake -S . -B build-asan -G Ninja \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo \
  -DCMAKE_C_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer" \
  -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer"
cmake --build build-asan -j
ASAN_OPTIONS=abort_on_error=1:detect_leaks=1 ./build-asan/app
```

**CMake gotcha**: `CMAKE_BUILD_TYPE` only applies to single-config generators
(Make/Ninja). Multi-config generators (Xcode, VS) ignore it — use
`--config Debug` at build time instead.

## Attach / Core Dump

```bash
gdb --args ./build-debug/app arg1        # launch under gdb
gdb -p "$PID"                            # attach to running
gdb ./build-debug/app core               # core dump analysis
lldb -- ./build-debug/app arg1           # macOS/LLVM default
valgrind --leak-check=full --track-origins=yes ./build-debug/app
```

GDB essentials: `bt` backtrace, `frame N`, `info locals`, `p expr`,
`watch var`, `b file:line`, `c` continue, `n` next, `s` step.

## Silent-Failure Patterns

| Pattern | Symptom | Best probe |
| --- | --- | --- |
| UB / invalid lifetime | Works until optimization/compiler changes | ASan + UBSan |
| Signed overflow | Bad branch, impossible values | `-fsanitize=signed-integer-overflow` |
| Dangling pointer | Later crash far from cause | ASan + core backtrace |
| Data race | Flaky corruption | TSan |
| Uninitialized read | Rare wrong branch/output | MSan or Valgrind `--track-origins=yes` |
| Mismatched alloc/free | Heap corruption/leaks | ASan or Valgrind Memcheck |

## Cleanup

```bash
rm -rf build-debug build-asan build-tsan build-msan
unset ASAN_OPTIONS UBSAN_OPTIONS TSAN_OPTIONS MSAN_OPTIONS
ulimit -c 0
rm -f core core.* vgcore.* *.dSYM
```
