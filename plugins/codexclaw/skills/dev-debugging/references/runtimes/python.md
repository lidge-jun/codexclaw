# Python Debugging

Covers CPython 3.9+, pytest, asyncio, Django, FastAPI. Attach mechanisms,
state-query patterns, gotchas, silent-failure signatures.
Lineage: lazycodex `runtimes/python.md` + gpt-5.5 research (2026-07-07).

## Phase 0 — Environment Detection

```bash
which python; which python3; python --version
ls poetry.lock uv.lock Pipfile.lock requirements*.txt .python-version 2>/dev/null
pip list 2>/dev/null | grep -iE '^(ipdb|pudb|debugpy|py-spy|memray|rich)\s'
```

**Wrapper gotchas**: `poetry run python ...` / `uv run python ...` / `pipenv
run` — args before the runner go to the runner, not Python. Prefer
`uv run -- python -X dev` if flags collide. `./manage.py` (Django) follows its
shebang — verify it points to the right venv.

## Four Ways to Attach

| Method | When | Command |
| --- | --- | --- |
| `breakpoint()` inline (3.7+) | Can edit source, restart | Add `breakpoint()`, run normally |
| `python -m pdb <script>` | No source edit; breaks on entry | `python -m pdb script.py arg1` |
| Post-mortem `pdb.pm()` | Exception already happened | `import pdb; pdb.pm()` after exception |
| debugpy (remote/IDE) | IDE attach, container, remote | `python -m debugpy --listen 5678 --wait-for-client script.py` |

Prefer `ipdb` (tab-complete, syntax highlight) or `pudb` (full-screen TUI) over
plain `pdb` when available. Control globally: `export PYTHONBREAKPOINT=ipdb.set_trace`
(or `=0` to disable all breakpoints). Journal this env var.

## pdb Essentials

`l` list, `ll` whole function, `s` step into, `n` next, `r` return, `c` continue,
`b <line>` breakpoint, `w` where (backtrace), `u/d` up/down stack, `p`/`pp` print,
`!<stmt>` execute, **`interact`** drop into full REPL with frame locals (underused
— faster than 20 `p` commands).

## pytest Debugging

```bash
pytest --pdb              # pdb on first failure
pytest --trace            # pdb at START of each test
pytest --pdb -x -s path/to/test.py::test_name   # one test, capture off
pytest --pdb-trace        # collect-time breakpoints (conftest/fixture)
pytest -s                 # always add when using breakpoints (capture blocks prompt)
```

## asyncio Gotchas

- Breakpoints inside coroutines work but stepping across `await` is awkward —
  place breakpoints ABOVE the await, not inside the awaited function.
- `PYTHONASYNCIODEBUG=1` surfaces: never-awaited coroutines, slow callbacks,
  unhandled task exceptions. Always enable for timing/async bugs.
- `asyncio.gather` swallows the first exception and cancels the rest
  (use `return_exceptions=True` to see all).
- `asyncio.create_task(coro)` without storing the task: exception eaten at GC.
- Python 3.14: `asyncio` adds call-graph introspection APIs for
  external profilers (Tier-2 proven, docs.python.org/3/whatsnew/3.14).

## Python 3.14 — Safe External Attach (PEP 768)

Zero-overhead safe external attach for live processes (Python 3.14+ only).
No restart, no code change:

```python
import sys
sys.remote_exec(pid, "/path/to/script.py")  # inject into live process
```

Designed for debuggers and profilers attaching to production without restart.
Tier-2 proven: peps.python.org/pep-0768, docs.python.org/3/whatsnew/3.14.

## Sampling Profilers (for "why slow/stuck", not crashes)

```bash
py-spy top --pid <pid>                  # live top-like view (no restart)
py-spy record -o profile.svg --pid <pid>   # flamegraph
py-spy dump --pid <pid>                 # stack traces, all threads NOW
memray run script.py                    # memory allocation tracking
memray flamegraph output.bin
```

`py-spy dump` on a stuck process often finds the hung call without breakpoints.

## Silent-Failure Patterns

| Pattern | Why silent |
| --- | --- |
| `except Exception: pass` / `except: pass` | Discards everything incl. KeyboardInterrupt |
| `logging.exception(...)` with no handlers | Writes nowhere |
| `asyncio.create_task(coro)` not stored | GC eats the task and its exception |
| `return x.get("key")` (missing key) | Returns None, caller often unchecked |
| `subprocess.run(..., check=False)` ignored returncode | Non-zero treated as success |
| `contextlib.suppress(Exception)` | Explicit silencer, often wider than intended |

## Cleanup

```bash
git diff | grep -E '(breakpoint\(\)|import ipdb|import pudb|import pdb)'
git checkout <file>
unset PYTHONBREAKPOINT
pkill -f 'debugpy' || true
lsof -iTCP:5678 -sTCP:LISTEN -nP 2>/dev/null
```
