# 002 — host verification baseline

Every layer in this stack has to prove itself with `npm run build` and `npm test`
on THIS host before its PR goes up. `npm test` does not exit 0 here, and it did not
exit 0 before this unit existed. A layer that reports "tests fail" without this
baseline cannot tell its own regression apart from the host's.

Measured on `codex/memory-recall-roadmap` at `dc1aca69`, whose tree differs from
`origin/dev` (`a267b398`) only by `devlog/_plan/260911_memory_recall_sweep/`.

## Install first, or you will chase a ghost

This worktree had no `node_modules` at all. The suite still ran — almost every test
is dependency-free — but `plugins/codexclaw/gui/test/router.test.ts` failed with
`ERR_MODULE_NOT_FOUND: Cannot find package 'react'`. That is not a defect:

```powershell
npm ci    # no lockfile write; restores the gui workspace deps
```

After `npm ci` the router test passes. Run it once per fresh worktree.

## The baseline

```text
npm run build   exit 0    179 files compiled, layout validated
npm test        exit 1    tests 3032, pass 2944, fail 2, skipped 86
```

Exactly two failures, both environmental, both reproducible on a clean checkout of
`dev` with no changes from this unit:

### 1. `hook-bench produces valid JSON schema with --json --iterations 1`

`plugins/codexclaw/test/hook-bench.test.mjs:17` spawns the bench with
`cwd: "/tmp"`, a POSIX path that does not exist on Windows, so `spawnSync` never
starts the child and `result.status` is `null`:

```text
AssertionError [ERR_ASSERTION]: hook-bench exited non-zero:
null !== 0
    at .../plugins/codexclaw/test/hook-bench.test.mjs:21:10
```

The Windows guard one line above only fires under CI:
`if (process.platform === "win32" && process.env.CI) return;`. Locally on Windows
it runs and fails. The irony is that the sibling test
`hook-bench builds no hard-coded /tmp path` passes — the harness is clean, the test
that checks it is not. One-line fix: `cwd: tmpdir()`.

This is a Windows landmine in a test fixture, which the peer Windows sweep owns.
It is recorded here and deliberately NOT fixed in this stack.

### 2. `cxc map --help exits 0 without python deps`

`plugins/codexclaw/test/repo-map-packaging.test.mjs:71` requires `cxc map --help`
to exit 0 on a host without Python. It exits 1:

```text
stderr: codexclaw map: py could not be run (exit spawn error). Install Python 3.9+
from python.org (the Microsoft Store alias exits 9009 without running), or set
CODEXCLAW_PYTHON.
1 !== 0
```

On this host `python` IS on PATH but `py` is not, and the win32 rung tries `py`
first. The test name states the contract the product breaks: `--help` must not need
the interpreter. It is the same failure class as #139 in this stack
(`chat index --help` running a full ingest) and #132 in the peer stack
(`cxc enable --help` running enable), in a third component. Also recorded, also
not fixed here — `cxc map` is outside this unit's file scope.

## What each layer must use as its gate

```powershell
npm run build                                    # must exit 0
npm test                                         # must show exactly the 2 failures above
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/recall/test/*.test.ts"
node plugins/codexclaw/scripts/test.mjs "plugins/codexclaw/components/pabcd-state/test/*.test.ts"
```

The two focused commands MUST exit 0 with zero failures — they cover every file this
stack touches. Measured today: recall `tests 191, pass 191, fail 0`.

A layer is proven when the focused suite for its component is green AND the full run
shows the same two environmental failures and no third. A third failure is that
layer's regression, and the baseline above is what makes that statement checkable.

CI runs on Ubuntu with Python present and `CI=1` set, so both failures disappear
there. Do not read a green CI run as evidence that the local gate was run.

