# A-gate round 1 synthesis

Reviewer verdict: `FAIL`.

## Blocker synthesis and dispositions

1. **High — in-worktree full build deletes ignored live artifact. Accepted.**
   - Root cause: `build.mjs` recursively removes every component `dist/`; the user's active diagnostic hook points to ignored `components/subagent-config/dist/diag-hook.mjs`, so Git cannot show the deletion.
   - Plan change: no full build or full `npm test` in the real dirty tree. Build/test a copied tree, stabilize the diagnostic entry only inside that copy, and transfer only the four planned `pabcd-state/dist` outputs.
2. **Medium — impossible GitHub close remains in the goal objective. Accepted with host-API constraint.**
   - Root cause: the main agent over-inferred an issue target from a pasted reproduction; GitHub proves this repository has no issue to comment on or close.
   - Plan change: amend the durable goalplan objective and criterion so zero-issue evidence is completion and unrelated opencodex issues remain untouched. The host goal API has no objective-edit operation, so the immutable host text is superseded by this evidence-backed steering record rather than satisfied through invented external state.
3. **Medium — baseline says one failure but the declared command has five. Accepted.**
   - Root cause: four hook-E2E tests cannot parse the user's diagnostic command shape, in addition to the known IDLE invariant failure.
   - Plan change: record all five exact names, run the new behavior with a targeted name pattern, and compare the complete before/after failure-name set.
4. **Medium — corrupt/race/IO branches lack activation proof. Accepted.**
   - Root cause: direct `wx` publication can expose a partial file on interruption; the plan did not choose a corrupt-file policy or force non-`EEXIST` failure.
   - Plan change: publish a fully written same-directory temp file via exclusive hard link, never overwrite any existing bytes (including corrupt bytes), prove two-process race behavior, and activate `ENOTDIR` fail-open. Corrupt existing bytes stay untouched at SessionStart and are normalized only by a later successful FSM mutation through the existing `readState`/`writeState` path.
5. **Medium — whitespace and child reachability under-specified. Accepted.**
   - Root cause: a whitespace-only ID sanitizes to `missing`; SessionStart child agent fields are defensive rather than proven host behavior.
   - Plan change: validate `trim().length > 0` while preserving valid original values; add whitespace tests; label the agent-field test synthetic defense, not production activation evidence.

## Cross-blocker check

The atomic no-clobber publication and copied-tree build are compatible: both protect pre-existing bytes rather than normalizing them opportunistically. The GitHub objective correction does not weaken the code verifier. Targeted real-tree tests plus full copied-tree failure-set comparison avoid both destructive verification and false green claims.

Round 2 must re-use the same reviewer and may advance only on PASS or main-judged near-pass with all blockers folded in.
