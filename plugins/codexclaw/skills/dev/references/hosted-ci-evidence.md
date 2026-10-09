# Hosted CI evidence

### Hosted CI evidence (DEV-CI-EVIDENCE-01, DEFAULT)

Zero failing checks is not the same as passing tests. Hosted CI has several ways to
report nothing while looking like an answer, and each one reads as green:

1. **Required jobs never started.** A rollup filtered for failures returns an empty list
   when only lightweight checks ran. Fork-approval gating is one possible cause, not an
   automatic diagnosis — investigate rather than conclude.
2. **An aggregate fails with no failing test.** Executed legs succeed, a dependency is
   cancelled or skipped, and the aggregate rejects the run. Cancellation is missing
   completion evidence, not proof of a defect.
3. **A partial rerun regenerates nothing.** `gh run rerun --failed` requests
   `rerun-failed-jobs`; its zero exit means the request was accepted, not that the
   missing evidence now exists.
4. **Exit zero while pending or cancelled.** `gh run view --exit-status` keys on failure
   states, so a cancelled or still-pending conclusion exits 0. It is not a success
   predicate.
5. **Evidence from the wrong event.** Selecting the newest run for a SHA can return a
   manual dispatch. A matching SHA does not establish equivalent coverage.

So before claiming hosted CI passed: confirm the expected jobs actually ran, and identify
the PR head, the SHA the checks really ran against, the workflow event, the run id and
the attempt. Distinguish approval-blocked, absent, skipped, cancelled, pending and failed
— they need different responses. Inspect an aggregate's dependencies rather than its
headline. Approving a workflow or triggering a rerun is a separate authorization from
diagnosing one, and a full rerun is warranted only when inspection shows a partial rerun
cannot regenerate what is missing.

```sh
gh pr view <PR> -R <REPO> --json headRefOid,statusCheckRollup
gh api --paginate 'repos/<REPO>/commits/<HEAD_SHA>/check-runs?per_page=100'
gh run list -R <REPO> --commit <HEAD_SHA> \
  --json databaseId,event,headSha,status,conclusion,workflowName
gh run view <RUN> -R <REPO> --json event,headSha,attempt,status,conclusion,jobs
```

Compare the returned jobs against what the workflow should have produced, and correlate
merge-ref checks where they apply. An empty check-run list is not proof of why the checks
are absent.

**Reading a completed job's log while its workflow is still running.** `gh run view
--job <JOB> --log` checks that the parent RUN finished, not just the job, so it refuses a
job that is already complete inside a run that is not. Fetch the job log endpoint
directly instead, and read the command's status, stderr and returned content before
concluding the logs are unavailable:

```sh
gh api 'repos/<REPO>/actions/jobs/<JOB>' --jq '{id,run_id,head_sha,status,conclusion}'
gh api 'repos/<REPO>/actions/jobs/<JOB>/logs'
```

If that raw response is rejected for escape sequences, newer CLI versions expose
`--allow-escape-sequences`. Treat it as conditional, not standard: it does not exist in
every installed version, and it relaxes a deliberate protection — read the result through
a non-executing text reader rather than printing it to a terminal. Keep the run id,
attempt and job id when comparing reruns, and remember old logs are subject to retention.

