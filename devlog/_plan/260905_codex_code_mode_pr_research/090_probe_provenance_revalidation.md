# Promotion review repair: immutable provenance at snapshot boundaries

C4 bounded evidence-integrity repair for PR66 review thread
PRRT_kwDOTLf_586fk9jM. The finding is accepted: unrestricted children can alter
approval/install files or the source checkout after preflight; current metadata
hashes some inputs only after execution. Publication remains blocked until fixed.

## Scope and actual boundary

Modify only the recorder and its existing recording fixtures/tests, plus measured
README count blocks after verification. No model calls, permission/profile changes,
new runtime, report rewriting or source/worktree reset. Tests run on macmini.
Directory isolation is not a security sandbox. Before/after snapshots detect drift
at those boundaries; they do not prove absence of transient write-and-restore or
provide an OS-level immutable audit trail against an unrestricted process.

## Exact changes

MODIFY plugins/codexclaw/scripts/probe-recorder.mjs:
- Extend existing cleanSource to fingerprint actual Git-tracked file bytes after
  checking exact HEAD and clean status. One NUL-delimited git ls-files snapshot;
  validate canonical contained regular files. This also catches assume-unchanged
  byte drift that Git status alone misses. Current source tree has no tracked
  symlinks/submodules; unsupported source entries fail preflight rather than hiding.
- Carry expected sourceSha in the prepared in-memory context. Every existing
  snapshot revalidates source HEAD/status/content along with all current paths.
- Include approval.md, install.json and prompt.txt in the existing contained-file
  snapshot; include the resolved Codex entrypoint and recorder module bytes too.
- Persist approval/install/Codex-entrypoint/recorder hashes from the BEFORE
  snapshot, not a child-rewritten afterimage. Check the actual prompt buffer
  against its pinned hash before dispatch. Keep all existing after-child and
  after-doctor comparisons and rejection paths.
- Preserve schema1 and existing fields. Additional before/after identities strengthen
  newly recorded attempts; historical records are not retroactively strengthened.

MODIFY plugins/codexclaw/test/probe-fixtures/recorder.mjs: reuse fake dispatcher and
fake Codex; bind fixture source paths before serializing those scripts. Add scoped
mutation scenarios for preflight doctor, execution and postflight doctor: approval,
install, prompt, source bytes, source HEAD, hidden source byte drift and Codex
entrypoint. All mutations remain inside that fixture's temp root. A separate
copied-recorder scenario must never modify the real repository recorder.

MODIFY plugins/codexclaw/test/probe-recorder.test.mjs: preserve originals. Show RED
before the recorder fix, then GREEN for those reachable boundaries; assert no
inference on preflight drift, postflightError/ok:false for later drift, original
provenance hashes retained, and analyzer rejection. Include removed-input failure
and a harmless copied-recorder mutation with retained failed report.
No test assertions removed, skipped or derived from the modified recorder.

## Verification and review closure

Focused recorder/analyzer tests and full suite on remote Node24, build/gate/
inventory checks, source-bound independent review, exact-head CI/packed/WSL.
Capture RED/GREEN and measured test total before updating README badges. Publish
the focused fix to dev, reply to the actual PR66 review thread with code/test proof,
and resolve it only after verification. Then revalidate the promoted head; previous
green CI and the already-passing packaging lifecycle do not waive this finding.
