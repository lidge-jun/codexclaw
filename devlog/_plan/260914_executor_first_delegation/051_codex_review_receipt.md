# 051 — PR 177 review correction evidence

Codex finding [4007056665](https://github.com/lidge-jun/codexclaw/pull/177#discussion_r4007056665)
was accepted. The previous regex treated `gAAAAx` as ciphertext, suppressing task
guards and the configured prompt override. The correction recognizes canonical
base64url Fernet frame structure. It does not authenticate or decrypt a token.
Existing executor/architect ownership and routing policy remain unchanged.

## Regression and native execution

Evidence root: task-owned `cxc-architect-01a0a049-aah8dgrt` under `/var/tmp/`.
Raw runtime data and operator settings remain outside the repository.

| Check | Observed result |
|---|---|
| `pr177-boundary-probe.mjs` against previous installed dist | Exit 1: guard false, override false, false ciphertext notice true |
| Same probe against rebuilt corrected dist | Exit 0: guard true, override true, false ciphertext notice false |
| `npm run build` | Exit 0; 181 generated component files validated |
| `npm audit --json` | Exit 0; 0 reported vulnerabilities; dependency files unchanged |
| Isolated native V2 spawn and same-child follow-up | Exit 0; actual child replies `CHILD_OK` and `FOLLOWUP_OK`, with the actual hook preservation notice |

Native evidence: `pr177-native-envelope/{artifact,observations,exit}.json` in that
external root. Parent task `01a0a0d1-a298-7693-88d5-6fd0ac135742` records the hook's
developer notice at rollout line 17. Child
`01a0a0d1-c194-7db2-936a-734121d0ad90` records the two actual replies at lines 12
and 21. The probe's distributed hook bytes match the reviewed source build.
Its CLI process exited and was reaped; temporary authentication was removed.
Native V2 exposed interrupt rather than close; interrupt returned the child's
completed follow-up status. No probe process was left running.

The probe confirms the recognized native transport path. It does not identify the
emitter's padding variant or prove cross-provider transport compatibility.

## Independent review

Reviewer `01a0a0c1-efce-7c13-a6bb-d5424701cac4` approved the executable plan, then
returned a separate code-only PASS without findings on the source, generated dist
and matching search/routing documentation. Its read-only Node probes passed
20,878 assertions covering lengths 0–512, all version bytes at valid lengths,
padding variants, malformed encodings and old invalid fixtures. Source and dist
were both exercised; `git diff --check` passed. Final committed test coverage and
remote latest-head review are separate checks, recorded at completion.

Two pre-existing transport-parity tests failed in the review-named checkout
because their V2 fixtures omitted an explicit role. The repair makes them explorer
like their paired V1 inputs, retaining the routing assertions. The production
keyword inference quirk remains outside this repair.

## Implementation integration

Executor `01a0a0c3-aa3f-7070-ae55-530abed68915` authored the predicate and unit
regression patch. Repeated tool-call quoting errors prevented it from applying
the latter. Main stopped the worker, confirmed shutdown, preserved its source
changes and recovered the authored patch from its failed call. Main integrated
that patch, completed the planned e2e fixture alignment and added the missing
whitespace/lookalike cases during review. No model fallback or successful worker
completion is claimed; the unclassified dispatch failure remains recorded.
The first integrated focused run passed 123 tests. The final suite includes the
additional e2e short-lookalike case and three further negative table rows.

The final independent review returned PASS with no findings on test coverage and
raw native evidence. The first full run measured 3,162 tests and found one
overstrict test assertion: the plaintext path already trims trailing whitespace,
so its trailing-carriage-return case cannot demand ciphertext-style byte identity.
Main changed that assertion to preserve task text while retaining every guard,
affordance, prompt-override and omission-notice check. The corrected focused run
passed all 124 tests. Generated inventory uses the measured total of 3,162.

Final full-suite, published-head CI/review and local-install results are recorded
outside the repository against the fixed commit: the session's producer receipt,
PR conversation and the protected `cxc-pr177-review-20260914T163533Z` backup.
Those later checks must pass before task completion; this record does not claim
that a queued or historical remote review passed on a newer head.
