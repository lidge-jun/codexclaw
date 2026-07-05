# 010 — Phase 1: binding-level workdir is the exec source of truth

Class: C2 (two files + tests, no schema change — `bindings.workdir` already exists).

## Problem

`runOne()` passes `req.workdir` (the adapter's static per-agent value) to `runTurn`,
so the persisted `binding.workdir` is dead weight. To let `/cwd` steer exec, the
turn must read the binding row fresh each run.

## Diff plan

### MODIFY `src/db.ts`

Add next to `clearBindingThread`:

```ts
setBindingWorkdir(id: number, workdir: string): void {
  this.db
    .prepare("UPDATE bindings SET workdir = ?, updated_at = ? WHERE id = ?")
    .run(workdir, nowIso(), id);
}
```

### MODIFY `src/agent-service.ts`

In `runOne()`, `runTurn({ workdir: req.workdir, ... })` →
`runTurn({ workdir: binding.workdir || req.workdir, ... })`.
`binding` is already re-fetched fresh at the top of `runOne` (same pattern as the
per-turn agent-card read), so a `/cwd` change applies to the very next turn with
zero extra queries. Fallback to `req.workdir` is cheap defense only — audit
confirmed no writer can produce an empty workdir (NOT NULL + cli.ts resolve).

### MODIFY `test/fixtures/fake-codex.mjs` (audit finding 1)

The runner passes workdir as `spawn(..., { cwd })`, never argv, so the fake codex
must echo `process.cwd()` when `FAKE_CODEX_ECHO_CWD=1`. Assert against
`realpathSync(expected)` (macOS tmpdir → `/private/var/...`).

## Tests (extend `test/agent-service.test.ts`)

- setBindingWorkdir then handleIncoming → fake-codex ECHO_CWD reply proves the
  child ran in the binding workdir.
- Binding with untouched workdir → still receives the adapter workdir (regression).

## Accept criteria

- `npm test` green; new tests prove binding.workdir wins and default path intact.
