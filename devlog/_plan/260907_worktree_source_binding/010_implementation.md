# Implementation and acceptance

## Source and state boundary

`session-source.ts` owns an immutable `.codexclaw/sources/<session>.json` binding:
version, ownerSessionId, nativeCwd, sourceRoot, commonDir and gitDir. Creation is
`session source <absolute-worktree>`, after exact native identity and state checks.
Canonical realpaths must describe another worktree in the same Git common dir.
Atomic exclusive publication preserves a concurrent winner. Binding is pre-B;
repeating the same binding or restoring a previously pinned root is idempotent.
Malformed, nonregular, redirected, foreign or missing bound sources refuse.

`session-source-identity.ts` captures the resolved source using the existing
source-identity implementation. Explicit bindings add `sourceRoot`; unbound
captures retain the old shape. JSON receipt writers retain the field; state,
source-receipt and goalplan revivers validate/preserve it. Comparison rejects
unequal or missing roots. CLI and chat B-to-C have a separate root equality
refusal BEFORE comparing content: root changes are never implementation.

At B entry, CLI/chat persist optional `State.boundSourceRoot` alongside the B
snapshot. State reconstruction and subsequent transitions retain it. Resolution
checks this pin, including after B when the phaseEntrySource is cleared. Deleting
a binding during Check therefore cannot certify the native tree. No pin is
invented for legacy sessions. The source command may restore exactly the pinned
root without rewriting phase, baseline or receipts.

## Consumers

- CLI/chat B entry and B-to-C capture the bound tree. Missing bound baselines refuse.
- `receipt test` executes in the bound tree, checks before/after identities and
  stores its result in the native evidence directory. Failed/mutating checks
  cannot leave a passing receipt. Check verifies the same session/root/epoch.
- Goal completion and `loop validate --session` use the same source capture.
  Absolute worktree plan paths remain supported; plan/state paths stay native.
- `session current --json` exposes `sourceCwd` and a bound `sourceIdentity` snapshot.
  QA verdict, reviewer lane and final-gate producers use this at observation time.
  A snapshot is not proof that QA/review ran. Rootless receipts are not wildcards.
- QA validate-evidence validates and compares sourceRoot across scenarios and
  preserves it in emitted receipts. Goalplan read/write must retain the QA,
  final-gate and reviewer identities through final validation.
- Final-review spawn prerequisites load the shipped sibling pabcd-state dist
  source resolver with createRequire. This reuses canonical binding validation
  and dirty-content hashing instead of duplicating a weaker metadata-only hash.
  src and dist are at identical relative depth; both new dist files must ship.

## Verification and delivery

The existing Node test harness uses real temporary Git worktrees/native SQLite.
Acceptance covers source-only edits, native-only edits, CLI/chat parity, correct
check cwd/native receipt location, stale/foreign roots, binding deletion in B/C,
late/foreign/corrupt source commands, QA mixed roots, final validation roundtrip,
and clean/dirty final-review sources. Run source-identity, session-binding,
worktree-source-integration and QA tests, then build, full suite, gate and smoke.
Type diagnostics are compared against an untouched base; existing failures must
not be described as a passing typecheck. Outcomes live in 020_verification.md.

Only reviewed changed plugin src/dist/help/skill files are installed after a
hash-checked backup. Installed dist is tested with isolated state, without
advancing an existing user session. Publish one ordinary PR to dev; no merge or
release. Phase-control and visual-QA docs document capture/recovery semantics.
