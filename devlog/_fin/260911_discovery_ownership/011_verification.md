# Discovery ownership evaluation

Fresh Astra and Sol runs now dispatch a bounded explorer before loading its source
and incorporate the returned evidence into three grounded proposals. Both complete
on the repaired guidance. The initial candidate exposed report-schema mistakes and
duplicate verification; these observations drove the repair. This local sample
does not demonstrate net cost savings or guarantee behavior on every host.

## Environment and boundary

Fresh `codex exec` primary sessions, normal installed CXC/OCX entrypoint, `xhigh`
effort, workspace-write sandbox. Baselines ran on CLI 0.153.4; candidate installation
subsequently observed CLI 0.154.0. This task did not request a CLI upgrade. The
version change confounds attribution of old/new differences to guidance alone.
Desktop tool exposure is a separate surface. No role or provider policy is changed
for these cases. An initial
WebSocket 426 fell back to the normal HTTP transport; completed runs exited zero.

A private 42-file source snapshot spans a service, web client, native client and
tests (358,834 bytes). Every source file is hashed and all case copies are checked
against the same manifest. Private logs, source, paths, account identities and
request identifiers remain outside Git. Only generic prompts and aggregates are
published. Two initial empty-copy setup runs were stopped and excluded, preserved
as invalid setup evidence. They are not behavioral failures or successful cases.

Each case uses a fresh native main, not an explorer asked to impersonate a main.
Normal user memory remains enabled and may influence findings; observed memory
lookups and task-directory names limit causal isolation. Results are a paired
local case study, not a randomized benchmark or a guarantee across all models.

## Reproduction contract

Freeze one representative multi-surface repository and inventory it before launch.
Use the same model, effort, source, user prompt and role config for each old/new
pair. Install the candidate from the preserved local integration revision and
verify installed guidance hashes before the candidate run. Verify the transcript
actually reads the intended guidance, rather than inferring delivery from disk.

```sh
codex exec -m <main-model> -c 'model_reasoning_effort="xhigh"' \
  -s workspace-write --skip-git-repo-check --json \
  -o <private-run>/final.txt -C <frozen-copy> - < <private-run>/prompt.txt
```

Generic prompts (translated from the actual Korean requests; no instruction to
spawn an explorer):

- Broad: investigate three valuable feature improvements, grounded in current
  implementation and file locations; no edits, services or external API calls.
- Narrow: report exported function names and lines in one named recommendation file.
- Restricted: inspect web and API for two improvements; explicitly do not delegate.
- Expanded: resume the completed narrow task and ask it to investigate stale web
  recommendation values, API refresh and whether the native client shares the
  issue; propose grounded improvements. The initial local lookup is retained in
  context, so this exercises a real change from narrow to multi-surface scope.

Use the supported `codex exec ... resume <native-id> -` surface for that second
turn. Capture each completed run's time cutoff: the narrow result excludes all
later calls/children; expanded totals explicitly include both turns.

Inspect native main/child transcripts for dispatch-before-source timing, useful
anchored return, separate main work, overlap, repeated broad reads and truncation.
Sum per-response native usage for main and children, including cached input (already
part of total input); correlate each usage tuple and time with provider records.
A unique tuple/time match supports served-model attribution, not an exact request
ID join. Ambiguous or absent matches remain unknown. Do not infer dollars or net
savings from token totals across different models or cache conditions.

## Baseline observations

Installed discovery guidance matched PR `1587ae6b`. Both main sessions read it and
completed useful source-grounded answers without children. Their served-model
records matched the requested main models uniquely for every response.

| Broad case | Children | Main commands | Main + child tokens | Elapsed |
| --- | ---: | ---: | ---: | ---: |
| Astra, old guidance | 0 | 17 | 381,695 | 134.7 s |
| Sol, old guidance | 0 | 34 | 1,064,171 | 432.6 s |

These totals include repeated context input across responses. The observed lack
of dispatch follows actual source reads; it is not inferred from aggregate helper
model usage.

## Repaired runs complete with useful discovery

Guidance/source revision `e38f3339`, matching compiled artifact `4e93b94d`.
The three installed guidance hashes remain identical before and after both runs.
The same inventory and generic broad prompt are used; no forced-spawn prompt.

| Broad case | Children | Main + child tokens | Elapsed | Result |
| --- | ---: | ---: | ---: | --- |
| Astra, initial candidate | 1 | 1,546,050 | 258.1 s | Completed; drove duplicate-read repair |
| Sol, initial candidate | 1 | 2,737,916 | 600.0 s | Timed out; no final answer |
| Astra, repaired | 1 | 1,025,672 | 205.1 s | Completed, 3 grounded proposals |
| Sol, repaired | 1 | 1,500,623 | 515.9 s | Completed, 3 grounded proposals |

Final Astra delegates analytics/history and reads web/native UI itself. Its return
checks select history/analytics spans, rather than repeating the delegated source
set. Final Sol delegates the native client and owns the web/data investigation;
its final answer uses the child's native-client anchors without rereading that
whole area. Broader searches and repeated reads within main's own area still occur;
this is not a claim of zero redundant I/O. Child answers are compact relative to
the source and contain actionable findings, anchors and unresolved boundaries.

Both final runs use valid `action:report` / `outcome:created|complete` messages and
avoid the earlier action-schema error. Sol still initially constructs an invalid
attempt ID; the dispatcher rejects it, then Sol reads status and uses the returned
ID. This is a recorded, recoverable caller error, not silent acceptance or fallback.

| Boundary case, initial candidate | Astra | Sol |
| --- | --- | --- |
| Exact one-file lookup | Completed, 0 children | Completed, 0 children |
| Explicit no-delegation | Completed, 0 children | Completed, 0 children |
| Narrow task resumed with wider scope | 1 child, completed | 2 children, then main timed out |

The narrow/no-delegation rules were not changed by the report/verification repair;
their evidence is retained at `61a0c1ca`, not relabeled as new executions. The scope
change activates redispatch in both models, but the timed-out Sol case is not a
successful end-to-end result. Timeouts are judged from the recorder flag and absent
final artifact even when SIGTERM causes a zero process exit. Owned probe processes
and child work are no longer running.

Every measured main/child response has a unique usage-tuple/time match. Actual
main routes are Astra/Sol, and the configured explorer is served as `deepseek-flash`.
[OpenCode's official model table](https://opencode.ai/docs/go/#endpoints), checked
2026-09-11, identifies that ID as DeepSeek V4.1 Flash; the older V4 Flash catalog
row is not substituted silently. User role/provider configuration was preserved.

## Costs use served-model rates, not token totals

The local OpenCodex `estimateAttemptCost` function applies input/cache/output rates
and actual tier provenance per attempt. Its installed catalog lacks the new exact
DeepSeek ID. For the evidence calculation only, use the verified official
[OpenCode Go rates](https://opencode.ai/docs/go/#usage-limits): off-peak input
$0.15, output $0.60, cached input $0.003 per million tokens. All measured child
requests occurred off-peak. No runtime price configuration was changed.

| Broad case | Main USD | Child USD | Total USD |
| --- | ---: | ---: | ---: |
| Astra, old guidance | 1.31667 | 0 | 1.31667 |
| Sol, old guidance | 1.08392 | 0 | 1.08392 |
| Astra, repaired | 2.21483 | 0.01392 | 2.22875 |
| Sol, repaired | 1.38556 | 0.01463 | 1.40019 |

These are API/allowance valuations, not subscription invoices or marginal cash
bills. Child cost is small; main context and coordination dominate this sample.
The CLI-version change, memory, cache and timing differences prevent causal or
universal savings claims. Economic tuning is not a completion gate for every
ordinary discovery task, and the user requested no further pricing investigation.

## Review and delivery

Architect reflection: ALIGNED. Independent A review initially failed on a compact
packet omitting common obligations and an unstated revision-to-install sync step.
Both were accepted, documented and rechecked PASS. This verdict covers plan
readiness. The independent C reader then caught the unqualified parallel-output
claim, invalid adjacent JSON examples and an unconditional pricing obligation;
all were corrected and rechecked PASS. The reader's findings improved the same
guidance without adding runtime enforcement.

Executed checks: fallback suites 30/30; native-execution examples 21/21; gate and
inventory (3019 test inventory) pass; build compiles 179 files. The original PR's
transport regression suite evidence remains in its owning unit; no new test count
is invented for prose. Local installation matches 10 audited source/artifact hashes,
preserves account-catalog and explorer transport patches, and doctor reports all
29 hook hashes trusted. No deployment or upstream merge is included.

Private evidence filenames: `source-manifest.json`, `analysis.json`, `cost.json`,
per-case `events.jsonl` / `run.json` / `final.txt`, `repair-installed.json`,
`fallback-check.log`, `native-examples-repair.log`, `pr-build.log`. These retain raw
timestamps, native identities and provider correlation without publishing private
material. Final publication/check status belongs to PR #130's current head.
