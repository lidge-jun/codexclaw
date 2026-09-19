# 050 — wp6: CI evidence and job logs (#195, #197)

Both issues land in `plugins/codexclaw/skills/dev/SKILL.md` §3 as one inserted
subsection, so they ship together. This phase must not run concurrently with wp5, which
edits §8 of the same file.

## #195 — green-looking CI that proves nothing

§3 at `:342` says "Full output. Check exit code. Count failures", and the tests-pass row
at `:348` requires zero failures without requiring that the expected jobs ran at all.
Partial protection already exists at `references/stacked-prs.md:105`, which demands
event, head and attempt identification and rejects missing, skipped or cancelled tests as
passing evidence — but that is scoped to stack diagnosis. Fork approval and aggregate
rerun handling are absent everywhere.

The concrete silent-nothing modes, each with the command that produces it:

1. **Required jobs never started.**
   `gh pr view <PR> -R <REPO> --json statusCheckRollup --jq '[.statusCheckRollup[] | select(.conclusion == "FAILURE")]'`
   returns `[]` when only lightweight checks exist. Fork approval is one possible cause,
   not an automatic diagnosis.
2. **Aggregate failure with no failing test.** `gh run view <RUN> -R <REPO> --json conclusion,jobs`
   can show successful legs, cancelled or skipped dependencies, and a failed aggregate.
   Upstream precedent: `.github/scripts/check_ci_results.py:17` rejects every dependency
   result other than success, and `.github/workflows/blocking-ci.yml:48` runs it
   unconditionally.
3. **Partial rerun that regenerates nothing.** `gh run rerun <RUN> -R <REPO> --failed`
   exits successfully without proving execution; the CLI selects `rerun-failed-jobs`
   rather than `rerun` (`pkg/cmd/run/rerun/rerun.go:188-201`).
4. **Exit zero while pending or cancelled.** `gh run view <RUN> --exit-status` is not a
   success predicate: `pkg/cmd/run/view/view.go:436` uses `IsFailureState`, and
   `pkg/cmd/run/shared/shared.go:313-319` excludes cancellation and an empty pending
   conclusion.
5. **Evidence from the wrong event.** `gh run list -R <REPO> --commit <SHA> --limit 1`
   can select a manual dispatch. A matching SHA does not establish equivalent coverage.

**MODIFY** `plugins/codexclaw/skills/dev/SKILL.md`

- Before: `| "Tests pass" | Test command output: 0 failures | Previous run, "should pass" |`
- After: `| "Tests pass" | Expected tests executed; fresh output reports 0 failures | Previous run, absent/skipped/cancelled tests, "should pass" |`
- Before: `**Per-class verification floor (DEV-VERIFY-FLOOR-01).**`
- After: insert a **Hosted CI evidence** subsection immediately before that heading.
  Require expected-job coverage as well as status and conclusion; identify PR head,
  actual check/run SHA, event, run ID and attempt; distinguish approval-blocked, absent,
  skipped, cancelled, pending and failed; inspect aggregate dependencies; and keep any
  approval or rerun authorization separate from diagnosis. Prefer a full rerun only when
  inspection shows a partial rerun cannot regenerate the missing evidence. Include the
  four read-only inspection commands:

```sh
gh pr view <PR> -R <REPO> --json headRefOid,statusCheckRollup
gh api --paginate 'repos/<REPO>/commits/<HEAD_SHA>/check-runs?per_page=100'
gh run list -R <REPO> --commit <HEAD_SHA> --json databaseId,event,headSha,status,conclusion,workflowName
gh run view <RUN> -R <REPO> --json event,headSha,attempt,status,conclusion,jobs
```

  An empty check-run list is not proof of the reason for absence.

**MODIFY** `plugins/codexclaw/skills/dev/references/stacked-prs.md`

- Before: `Inspect required checks, not only a green summary or check count. Missing, skipped or cancelled tests are not passing tests.`
- After: keep both sentences and append `Apply the hosted-CI evidence procedure in dev §3.`

## #197 — reading a completed job's log mid-run

`gh run view --job <JOB> --log` checks parent-run completion, not only job completion
(`pkg/cmd/run/view/view.go:313-320` at CLI v2.97.0; the installed v2.96.0 has the same
guard). The route that works is
`GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`, which redirects to plain-text
logs. The escape-sequence flag is `--allow-escape-sequences`, registered at
`pkg/cmd/api/api.go:303` with its guard and diagnostic at `:530-542`; redirecting stdout
does not disable that guard.

Version qualification is the part the issue misses. A fresh local `gh --version` returned
**2.96.0**, and `gh api --allow-escape-sequences --help` returned `unknown flag`. The flag
ships with v2.97.0 alongside a security fix. So the documentation must qualify the version
and treat the flag as conditional, never prescribe it unconditionally.

**MODIFY** `plugins/codexclaw/skills/dev/SKILL.md` — extend the #195 subsection with a
log-reading paragraph: for a completed job whose workflow is still running, inspect the
job metadata and fetch the job-logs endpoint, because `gh run view --job --log` may reject
it for parent-run incompleteness. Check status, stderr and returned content before
concluding logs are unavailable. On versions exposing the flag, use it only if the raw log
is rejected, and read the result through a non-executing text reader. Preserve run ID,
attempt and job ID when comparing reruns; old logs remain subject to retention.

```sh
gh api 'repos/<REPO>/actions/jobs/<JOB>' --jq '{id,run_id,head_sha,status,conclusion}'
gh api 'repos/<REPO>/actions/jobs/<JOB>/logs'
```

## Verification

Human review only, and the document says so rather than naming a gate that does not
observe prose. No automated check reads whether this wording produces correct hosted-CI
interpretation. Review the five scenarios and the version caveat against the new text.
Do not trigger reruns merely to validate documentation.

This phase does have one live proof opportunity: the wp3-wp7 PRs opened by this unit are
real hosted runs, so the job-log route can be exercised read-only against one of them
while its workflow is still running.

## Risk

A blanket full-rerun rule wastes CI. Treating every missing job as approval-blocked
misdiagnoses workflow filters. Treating only head-SHA checks as relevant misses merge-ref
evidence. Unconditional use of the flag breaks older CLI installations, and printing
untrusted escape sequences to a terminal defeats an intentional protection.
