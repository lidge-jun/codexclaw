# Architect and first-fallback integration

Date: 2026-09-10 (Asia/Seoul)

Local integration candidate on `codex/architect-dev-integration` combines upstream
`dev` at `fc12bde530dcf31c51464cfface186c54f9f071b` with PR #110 at
`57c60900fd4559ee990ea7969d7a55ef4d72994a`. No installed plugin, global role,
provider setting, remote branch or PR was changed by this integration.

## Resolution

- Keep the CLI's nested `RolePatch` fallback updates and the architect/executor
  registration command together. Preserve both help entries.
- Preserve explicit architect identity and producer-header role routing alongside
  the upstream managed fallback hook.
- Keep both MCP test blocks. Iterate canonical `ROLES` so architect also exercises
  fallback persistence; the existing dispatch suite already iterates `ROLES`.
- Rebuild tracked component output from source. Refresh README test counts from
  the measured combined suite, rather than choosing either branch's old badge.

Owner search used `architect`, `ROLES`, `RolePatch`, `fallback` and `register` in
the store, CLI, spawn hook/wrapper, fallback dispatch, MCP and GUI consumers.
Existing implementations were reused; no new runtime abstraction or dependency.

## Verification

- `npm run build`: 171 component files compiled; layout validation passed.
- `npm test`: 2,857 tests, 2,782 passed, 71 skipped, four environment-dependent
  failures in `gui/test/project-root.test.ts`. The host's `/tmp/.git` marker makes
  ancestor traversal resolve `/tmp` instead of the fixture path.
- Re-ran that entire eight-test file with a fresh `TMPDIR` under `/var/tmp`, using
  the repository's isolated test runner: eight passed, zero failed. No production
  code change or deletion of the host marker was needed. All runnable tests have
  passing evidence across the full run and focused rerun; this is not a claim of
  a single all-green full-suite invocation.
- Full-run evidence includes architect fallback reconciliation, four-role MCP
  fallback persistence, architect settings independence, native type preservation,
  registration preservation, and GUI API validation.
- GUI Vite build with `--configLoader native`: passed. This avoids writing Vite's
  config cache through the temporary shared dependency symlink.
- GUI `tsc --noEmit`: passed. Linux `npm run smoke`: passed.
- Inventory check with measured total 2,857 and `npm run gate`: passed.
- Independent reviewer `01a086d3-02b1-7732-81fd-4279d138dc45`: PASS, no blockers
  in integration-critical native dispatch, inference, registration, store, GUI
  and fallback source. Reviewer did not independently rerun the full suite or
  validate provider execution. Delegated executor completed the MCP test merge;
  its runtime verification was supplied by the main agent's full-suite run.

Local fixtures do not establish actual architect provider execution, live host
role discovery, or host read-only enforcement. Installation, registration, a fresh
session, and real use remain subsequent steps. Hosted CI was not run for this
local candidate.
