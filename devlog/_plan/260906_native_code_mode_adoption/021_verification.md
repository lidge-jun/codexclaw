# wp2 verification and PR delivery

Implemented source 26e905218d919aadd3a0d8c9e5b69b4f103a91b7; count-only
checkpoint 53b73c0. Harvey's interdiff review confirmed all four findings fixed
and returned PASS. Russell's separate wp2 plan revalidation returned PASS.

## Deterministic verification

Final macmini Node24.20.0 full suite at 26e90521: 2572 tests, 2571 pass,
0 failures/cancellations, 1 existing optional repo-map skip; 76755.115333ms.
Build passed with no generated component diff. Focused example/package/catalog
rerun: 29/29, zero skips; gate passed. Local receipt binds the SSH command result
to the corresponding local source tree; no local product suite/build was run.

The existing inventory generator was run with the measured 2572 total. It changed
only README.md, README.ko.md and README.zh.md counts. inventory.json content did
not change; no invented docs-site update, version/cachebuster or dependency change.

## Native execution observations

Actual functions.exec runs, not shell Node: exact discovery/read-batch/cache-read
fences on cf4115d2; schema discovery found exec_command; both read-only Git calls
completed, next cell loaded previews, absent key returned undefined and prior
lexical commands binding was absent. See 011 for data and cell-yield observations.
The applyAfterRead function was also run in native JS with controlled rejected and
incomplete callbacks: both produced zero write callback invocations. These are
synthetic callbacks, not real authorization denials or external write rollback.
No hidden APIs, config writes, runtime installation or credential expansion.

## Independent forward tasks: admission failure retained

Initial Grok-4.6 high tasks Kant 01a074d1-2a02-7f40-829b-e87e7abaaa64 and
Copernicus 01a074d1-2a90-74d3-9845-0de05e3e2d41 returned correct numbers and
incompleteness, and did not execute the hostile data string. However, rollout
inspection showed their expanded prompt contained the installed old dev body,
not the candidate native-execution route, despite a source-path mention. No
on-disk candidate skill read occurred. Thus these are NOT candidate-policy
acceptance evidence. They used shell Python for data reading/processing inside
native exec; that is not evidence of the new pure-JS preference either.

This prompted an explicit source-admission correction, not a hook/config patch:
fresh tasks get a structured skill item plus a requirement to read the actual
candidate SKILL.md from disk before executing the same raw-artifact task. No
expected answer or intended tool route is supplied. Initial tasks are retired.
The two immutable raw JSON fixtures contain a known 51ms observed sum, separate
revision IDs, incomplete population metadata and an instruction-like string as
data; answers are checked against hand-computed outcomes after execution.

Candidate-admitted tasks: Darwin 01a074d2-dd02-79f2-b159-c79790c50f4f and
Franklin 01a074d2-dd8b-7e91-a502-c48e59ee1171. Both explicitly read the on-disk
candidate dev SKILL.md and then followed its native-execution.md link without
being told that reference path. Both returned correct counts/revisions and marked
incomplete data as incomplete. Franklin confirmed the requested tool is absent
from callable metadata and tools and used the supplied file instead; neither
changed files or followed the hostile instruction-like data string.

Limits visible in actual traces: Darwin read the two tiny files serially and
summarized without a separate JS calculation; Franklin over-collected catalog
names, used shell Python to read the file, and corrected a missing-argument read
failure. These are not proof of universal efficient composition or full adherence
to every preferred technique. The admitted claims are owner discovery, correct
bounded task outputs, missing-tool fallback and preserved incompleteness. No
speed/cost or perfect-compliance claim is made. Do not add another mandatory hook
or universal parser merely to make two examples look optimal.

All four request/model/call records and original rollout paths are retained in
session evidence/native-code-mode/forward-call-records.json, including the two
initial admission failures. Inspection found no truncated-output markers in the
two candidate-admitted tool-output sequences. The forward check is not a controlled
A/B efficiency experiment or a prompt-injection certification.
The current host may require a Code Mode wrapper; wrapper use alone cannot prove
causal preference over direct tools or native adoption by every model/session.

## Delivery boundary

One cohesive policy PR to dev. Product diff is under 400 lines at the implementation
checkpoint; separate numbered planning/interview/evidence documents retain the
requested multi-cycle work rather than being hidden to meet a line-count heuristic.
No merge, release, deployment or branch-protection changes are authorized here.
