# wp2 — CLI: state path/sync/migrate, devlog path, plan surfaces (PR2)

Status: PLANNED

## Commands (pabcd-state cli.ts, new `state-cli.ts`)

- `cxc state path [--cwd p] [--json]`: mode, reason, volatile/durable/devlog dirs, project id, base, origin key, warnings. In `none` mode it states that durable gates cannot be satisfied.
- `cxc devlog path [--cwd p] [--json|--explain]`: bare devlog path on stdout (for `$(cxc devlog path)`); `--explain` adds mode and reason; exit 1 with a message in `none` mode.
- `cxc state sync [--cwd p] [--dry-run]`: operates on the resolved base. Not external → exit 0 "nothing to sync". Base not a git repo → exit 0 with a hint (`git init` + private remote). Else D11: ensure `.gitattributes`/`.gitignore`, `git pull --rebase --autostash` when an upstream exists (failure: `git rebase --abort` if a rebase is in progress, exit 1 "resolve manually in <base>"), `git add -A`, commit `cxc state sync: <hostname> <iso>` if dirty, `git push` when an upstream exists (failure: exit 1, never `--force`). Uses `spawnSync("git", [...])` with argv arrays.
- `cxc state migrate [--cwd p] [--apply]`: D12. Dry-run lists moves/conflicts/skips; `--apply` copies with `COPYFILE_EXCL`, verifies bytes, unlinks the source, prunes empty source dirs. Sources: `<cwd>/.codexclaw/{ledger.jsonl,goalplans,evidence,evidence-attempts,evidence-unrecordable,interviews,interview,plan}` → `<projectDir>/state/...`; `<cwd>/devlog/**` → `<projectDir>/devlog/**`. Git-tracked files (`git ls-files`) and symlinks are skipped. Refused when the configured mode (ignoring the legacy `local` downgrade) is `repo`. Target is always the external layout.

## Plan surfaces

- plan-cli.ts: `unitDir = resolve(devlogDir(cwd), "_plan", unit)`; `none` → exit 1; `local` → `ensurePrivacyExcludes`; repo mode in a repository whose owner is not allowlisted prints "warning: writing devlog/ into a repository owned by <owner>; set state mode external (cxc state path)". Output shows the absolute path when outside cwd, and the planUnit to pass at P>A.
- plan-gate.ts messages name the resolved devlog root; validation itself already accepts absolute units.
- orchestrate-cli.ts / hook.ts example attests keep `devlog/_plan/...` in repo mode and print the resolved absolute path otherwise (hook text is generated with cwd).
- `plugins/codexclaw/bin/cxc.mjs` and `bin/codexclaw.mjs`: route `state` and `devlog` to pabcd-state; help lines; the payload-bin parity test covers both tables.
- `plugins/codexclaw/scripts/gate.mjs`: resolve the devlog dir of REPO_ROOT through the built resolver (dist import, fallback `<root>/devlog` when the dist is absent) for `mvpHardDir` and `checkVerifierClaims`.

## Tests

`pabcd-state/test/state-cli.test.ts`: path/json output per mode; devlog path bare output; sync no-op (not external, not git), sync against a temp bare remote (commit + push, second sync clean, conflict path aborts and exits 1 without force), migrate dry-run lists without changing files, apply moves, re-apply is a no-op, conflicting destination reported and both copies kept, tracked file skipped, symlink skipped, refused in repo mode. plan init writes into the external devlog; P>A accepts that absolute unit.

## Verifier

Focused tests, `npm run build`, `npm test`, `npm run gate`.

