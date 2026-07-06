# BEAM Debugging (Elixir / Erlang)

Covers OTP 26+, Elixir 1.16+, IEx, Observer, :dbg, recon, crash dumps.
The BEAM VM's supervision trees make crashes look like "nothing happened" —
the supervisor restarts the child before you notice.
Lineage: gpt-5.5 Tier-2 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
elixir -v
erl -eval 'erlang:display(erlang:system_info(otp_release)),halt().' -noshell
mix deps 2>/dev/null | grep recon || true
# In IEx:
# :erlang.system_info(:atom_count)
# :erlang.system_info(:atom_limit)
# :erlang.memory()
```

**WX gotcha**: minimized Erlang installs may lack WX bindings — Observer and
Crashdump Viewer will fail silently. Check with `:wx.new()`.

## Debugging Hierarchy (use in order)

1. **`IO.inspect` / `dbg`** — inline value logging. `dbg(expr)` shows the
   expression AST + result, pipeable.
2. **Logger + Telemetry spans** — structured, filterable, production-safe.
3. **IEx.pry** — `iex --dbg pry -S mix`, then `IEx.pry()` in source. Pauses
   the process and drops into IEx with its state.
4. **Observer / LiveDashboard** — visual process tree, message queues, memory,
   ETS tables. Observer: `:observer.start()`. For remote nodes:
   `erl -sname observer -hidden -setcookie COOKIE -run observer`.
5. **Targeted `:dbg` / `recon`** — `:dbg.tracer(); :dbg.p(pid, [:m, :c]);
   :dbg.tpl(Mod, Fun, :x)`. In production, prefer bounded `recon_trace` over
   broad `:dbg` (can flood the node).
6. **Crash dump viewer** — `erl_crash.dump` files readable via Observer's
   Crashdump Viewer or `crashdump_viewer:start/1`.

## Attach Recipes

```bash
# Local dev
iex -S mix
iex --dbg pry -S mix                    # enable pry mode

# Remote release (distributed Erlang)
# From the running release: bin/my_app remote
# Or: iex --name debug@host --cookie COOKIE
# Then: Node.connect(:"app@host")
```

## BEAM-Specific Gotchas

- **Supervisor restart hides crash**: check supervisor logs, `:sys.get_state`,
  Observer tree, restart intensity/period.
- **Mailbox overflow**: `Process.info(pid, :message_queue_len)` or Observer
  `MsgQ` column. Fix: backpressure, selective receive audit.
- **Atom exhaustion**: atoms are never GC'd. Default limit 1,048,576. Avoid
  `String.to_atom/1` on user input; use `String.to_existing_atom/1`.
- **Binary memory**: refc binaries live off-process-heap; sub-binaries retain
  the full original. Use `:binary.copy/1` to release large originals.
- **`:dbg` flood**: unbounded tracing on a hot function can crash the node.
  Always set `max_msg_count` or use `recon_trace:calls/3`.

## Silent-Failure Patterns

| Pattern | Symptom | Best probe |
| --- | --- | --- |
| Supervisor restart hides crash | Nothing visible | Supervisor logs, Observer tree |
| Mailbox overflow | Process memory grows, responses slow | `Process.info(pid, :message_queue_len)` |
| Atom leak | Eventually crashes with "atom table full" | `:erlang.system_info(:atom_count)` trending |
| Binary memory leak | Off-heap memory grows | `Process.info(pid, :binary)`, recon |
| Silent GenServer timeout | `:timeout` returned, caller gets error | Check `handle_call` return timing |

## Cleanup

```bash
# In IEx:
# :dbg.stop_clear()
# :telemetry.detach("debug-handler-id")
# Remove dbg() / IEx.pry() from source
rg 'dbg\(|IEx\.pry' --type elixir
git checkout <file>
# Archive crash dumps if needed, then remove
rm -f erl_crash.dump
```
