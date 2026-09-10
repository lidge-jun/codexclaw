# Discovery ownership evaluation

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
model usage. Candidate behavior and exception results remain pending.

## Review and delivery

Architect reflection: ALIGNED. Independent A review initially failed on a compact
packet omitting common obligations and an unstated revision-to-install sync step.
Both were accepted, documented and rechecked PASS. This verdict covers plan
readiness only; native behavior and final revision checks require separate evidence.
