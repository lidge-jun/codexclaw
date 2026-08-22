# 050 - issue #40: the receipt runner could not run npm on Windows

## How it surfaced

Closing the first cycle needed a `testReceiptPath`, and `orchestrate C -> D` names
`cxc receipt test` as the way to produce one. It does not work on Windows:

```
PS> cxc receipt test --session <id> -- npm test
receipt test: the command did not run to completion (spawnSync npm ENOENT)

PS> cxc receipt test --session <id> -- npm.cmd test
receipt test: the command did not run to completion (spawnSync npm.cmd EINVAL)
```

So the documented path to close a work-phase was broken for the most common test
command there is, and the workaround - expanding `npm test` by hand and passing the
underlying `node --test ...` line - defeats the purpose of pinning the receipt to the
command the project actually runs.

## Root cause

`receipt-cli.ts:79` handed its argv straight to a shell-less `spawnSync`:

```ts
const run = spawnSync(bin, rest, { cwd: args.cwd, stdio: "inherit", shell: false });
```

Bare `npm` is `ENOENT` because PATHEXT resolution is a shell behavior that
`spawnSync` does not perform. Explicit `npm.cmd` is `EINVAL` because Node refuses
shell-less `.cmd` spawns after the CVE-2024-27980 hardening. Same class as #33, in a
different component.

`shell: true` is NOT an acceptable fix here: the command is user-supplied, and Node
does not escape cmd metacharacters in that mode, so a path containing `&` or `^`
becomes an injection.

## Fix

`win-exec.ts` already solves exactly this and is duplicated byte-for-byte across
cxc-ops, skill-search and messenger-bridge under SHARED-HELPER-01. pabcd-state gets
the fourth copy, and the receipt runner resolves through `commandInvocation`, which
routes only `.cmd`/`.bat` through a caret-escaped ComSpec line and spawns a resolved
`.exe` directly. `shell: false` still holds, and the RECORDED command stays the argv
the user typed.

## A second defect in all three existing copies

`resolveWindowsCommand` split PATH on `node:path`'s `delimiter`, which follows the
HOST. On a Linux runner exercising this win32-only walk that is `:`, so a
`;`-separated Windows PATH collapsed into one bogus directory entry and resolved
nothing. Windows PATH is always `;`-separated, so the separator is now literal. The
same bug was fixed in `codex-bin.ts` when it was written; the three older copies still
carried it, and they remain byte-identical afterwards.

## Verification

`receipt-spawn.test.ts`: 6 cases, all passing, covering the shim hop, the direct
`.exe` path, metacharacter escaping, the `;` split, the shared-helper contract, and a
byte-identity assertion against the cxc-ops original so the copies cannot drift.

End to end, `cxc receipt test -- npm test` now reaches the phase check instead of
dying on the spawn, and produces a receipt from Check.
