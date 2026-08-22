# 020 - wp02: issue #32, symlink guards vs an unprivileged Windows host

## Symptom

`plugins/codexclaw/components/pabcd-state/test/goalplan.test.ts` tests 4 and 5 fail on a
stock Windows checkout:

```
not ok 4 - goalplan slug is an identifier ... EPERM: operation not permitted, symlink
not ok 5 - goalplan reads and ledger appends refuse symlink leaf files ... EPERM
```

Creating a symbolic link on Windows requires Developer Mode or elevation. The tests call
`symlinkSync` to BUILD the hostile input, so they die on the setup line and never reach
the guard they exist to verify.

## What the fix must not do

Two tempting shortcuts are both wrong:

- `if (process.platform === "win32") return;` passes the whole case silently. A test
  that reports "ok" while asserting nothing is worse than a red one.
- Dropping the symlink assertions entirely removes the coverage on the platforms where
  the guard actually matters.

## Fix

A memoized `supportsSymlinks()` probe creates a throwaway file link and directory link
in its own temp dir, removes it, and reports `{ file, dir }`. Any failure counts as
unsupported, so the probe can never itself fail the suite.

`symlinkDirSync` routes directory links through `"junction"` on win32 and `"dir"`
elsewhere. Junctions do not need elevation, which means test 4's linked-root case
genuinely RUNS on Windows now - `lstatSync().isSymbolicLink()` is true for a junction,
so the production refusal is exercised rather than skipped.

Test 5 needs a link whose target is a FILE, which a junction cannot express. It probes
`file` support and calls `t.skip()` with a precise reason when unavailable.

## Verification

`node --test --experimental-strip-types .../pabcd-state/test/goalplan.test.ts`
-> 24 tests, 23 pass, 0 fail, 1 skipped (native Windows, non-admin).

Test 4 passes for real. Test 5 reports:
`# SKIP file symlinks unavailable on this host: leaf-symlink refusal not exercised`

## Follow-on

The same bare-`return` pattern hides in `worktree-guard.test.ts`,
`source-receipt.test.ts`, `subagent-evidence.test.ts` and the `cxc-ops` symlink tests.
Swept in the same work-phase using the same probe.
