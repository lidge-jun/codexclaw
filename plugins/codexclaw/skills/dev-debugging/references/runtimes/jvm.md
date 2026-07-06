# JVM Debugging (Java / Kotlin)

Covers JDK 21+, Kotlin coroutines, GraalVM native-image. The JVM has
world-class live diagnostics — `jcmd` is the workhorse, JFR is the profiler,
JDWP is the attach protocol.
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
java -version
javac -version
which java jcmd jdb jfr jstack jmap || true
jcmd -l                                # list running JVMs
printf '%s\n' "$JAVA_HOME"
```

**Gotcha**: `jcmd -l` must run as the same user as the target JVM;
containerized JVMs may not be visible from the host.

## Debugging Hierarchy (use in order)

1. **Logs + health endpoint** — structured logging is always the first probe.
2. **`jcmd` live diagnostics** — thread dumps (`Thread.print -l`), class
   histograms (`GC.class_histogram`), heap dumps (`GC.heap_dump`), VM
   command line (`VM.command_line`). Prefer `jcmd` over `jstack`/`jmap`
   (deprecated paths in JDK 24+).
3. **JFR short profile** — `jcmd $PID JFR.start name=debug settings=profile
   duration=120s filename=debug.jfr`, then `jfr view hot-methods debug.jfr`.
   Low overhead, production-safe.
4. **JDWP attach (JDB / IntelliJ)** — for stepping/breakpoints. Launch with
   `-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005`,
   then `jdb -attach 5005`. IntelliJ remote debug is richer for Kotlin/watches.
5. **Kotlin coroutine debugger** — `kotlinx-coroutines-debug` +
   `DebugProbes.dumpCoroutines()` or IntelliJ's coroutine tab.
6. **GraalVM native-image GDB** — `native-image -g -O0 -jar app.jar
   app-native`, then `gdb ./app-native`. NOT JDWP — native images are not JVMs.

## Launch Recipes

```bash
# JDWP listener (attach from JDB or IntelliJ)
java -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:5005 -jar app.jar
jdb -attach 5005

# Live diagnostics
jcmd "$PID" Thread.print -l              # thread dump with locks
jcmd "$PID" GC.class_histogram           # top classes by instance count
jcmd "$PID" GC.heap_dump filename=heap.hprof

# JFR
jcmd "$PID" JFR.start name=debug settings=profile duration=120s filename=debug.jfr
jfr summary debug.jfr
jfr view hot-methods debug.jfr

# Kotlin coroutines
java -Dkotlinx.coroutines.debug -jar app.jar
```

## Silent-Failure Patterns

| Pattern | Symptom | Best probe |
| --- | --- | --- |
| Swallowed exceptions | Missing result, no crash | Break on thrown exceptions / log audit |
| Thread pool starvation | Requests hang, CPU maybe low | `jcmd Thread.print -l`, JFR |
| Deadlock / lock contention | Freeze | `Thread.print -l`, JFR locks |
| Classloader leak/conflict | Metaspace growth, `ClassCastException` | `jmap -clstats`, heap dump |
| Coroutine lost context | Work disappears after suspension | IntelliJ coroutine debugger / DebugProbes |
| Native-image reachability | Works on JVM, fails native | native-image diagnostics + GDB debug image |

## Cleanup

```bash
jcmd "$PID" JFR.stop name=debug 2>/dev/null || true
rm -f *.jfr *.hprof hs_err_pid*.log replay_pid*.log
unset JAVA_TOOL_OPTIONS _JAVA_OPTIONS
# Remove -agentlib:jdwp from launch args when done
```
