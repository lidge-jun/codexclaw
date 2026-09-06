# Review, integrate and deploy 0.2.18

## Loop spec

C4 satisfy-spec delivery. User explicitly requests discussion of all open PRs,
merging and deployment. Current candidates: PR69 ffaa60f2 and PR70 ba9df21a, both
target dev and have 11 successful checks. Latest release is v0.2.17.
One delivery work phase: repair/review, integrate, release, installed verification.
This is an authorized execution task; no host goal was requested or activated.
Non-goals: new credentials, native Codex/OCX updates, unrelated PRs, rewriting
history, branch/worktree cleanup, removing existing guards or bypassing protection.
All product suites/builds run on macmini or CI; local docs/Git/generated metadata
and normal installation smoke remain allowed. No imposed total time/token budget;
individual operations and SSH connection attempts stay bounded.
Verifier: current-head PR CI/reviews, remote focused/negative/full tests and build,
normal release gate, downloaded checksums/file identity, per-install doctor/trust.
Stop: requested integrations published/applied; unreachable targets reported as
unknown, never quietly certified. Record exact failure/partial state if blocked.
Evidence: this unit and .codexclaw/evidence/<session>/release-0.2.18/.
Escalate actual new authority or unsafe host identity; routine repair choices stay
with main after independent Grok review. No earlier temporary rule waiver is reused.

## Discussion and source findings

PR70 adds one common native-execution owner and conditional references, not a new
runtime or hook. Fresh tests/review are clean and the raw-JS wording issue resolved.
PR69 preserves synchronous Interview and native permission branches; its async
question policy is compatible with agent-owned tool selection. It does contain an
unresolved P2: PostCompact hookSpecificOutput.additionalContext cannot deliver
model context. Native source at d2d5b7, hooks/src/schema.rs:181 defines that output
as universal fields only; pabcd-state/src/hook.ts:1899-1919 already defers its
phase recovery to the next eligible prompt. Existing shape-only tests are not
delivery proof. Fix before merging/releasing69; do not waive the finding on green CI.

Grok-4.6 reviewer Avicenna (01a074ea-a9a1-7840-bb14-04366d3bbdfa) inspects
the compatibility and repair. Main owns source edits, GitHub and deployment.
Proposed repair is detailed in010; no new registered hook entry is introduced.

## Delivery order

1. Fix69 in a separate working branch based on its exact head, preserving the
   author's worktree. Push a fast-forward correction to the existing PR head only
   after remote tests/review. No force update if another actor moves it.
2. Merge70 and corrected69 into dev using pinned heads, retain both features and
   verify any shared skill/SOT overlap. Fetch and prove actual ancestry.
3. Prepare0.2.18 and one fresh cachebuster across canonical manifest/workspaces/
   lockfile/inventory; measure combined full suite and regenerate published counts.
   Publish required prep/promotion PRs through dev then main. Do not retarget feature
   PRs to bypass the repo's dev-first rule. Extra PRs are normal release steps.
4. On frozen main, wait for CI/packed/WSL, then use the canonical release workflow.
   Verify tag, release manifest, archive hashes and contents before installation.
5. Inventory normal local/SSH installations freshly. Preserve Git/source-linked
   versus copied modes and runtime cache extras. Use supported native CLI install,
   host-local private backups and normal no-bootstrap retrust. Compare every
   required released file and doctor manifest/hooks/trust/install-root afterward.

Known previous targets: macmini-cf, suji, desktop-c795oh4; local cache also needs
fresh inspection. win/oracle/ocx-ci were unreachable last time and are not presumed
absent. Do not install on hosts with no existing install or repair network/auth.
Do not terminate apps/services or claim existing conversations hot-reloaded.
All conditional failure paths retain logs and use verified backup/recovery state.

## Independent discussion and A synthesis

Avicenna approves70 first and the queued marker/next UserPromptSubmit repair shape,
with one High: child hooks may share the parent session_id, so both enqueue and
consume must reject child agent_id/agent_type before any IO. Main accepts it and
adds explicit negatives. Also accepted: place the extra event in the existing
compact-affordance hook file (do not change PABCD trigger identity), clear markers
on explicit state reset, keep both ownership rows and renumber the duplicate2.2.
No immediate same-turn recovery claim; no new PreToolUse/Stop path or protection
bypass. Main near-pass judgment: all concrete findings folded in010 before B.
