# 900 — closeout: the fix, and the release it shipped in

Terminal outcome: **DONE**. `v0.2.13` is published at `35d7aba9`.

## The defect

`isInterviewReady` demanded level `max` on all four dimensions. No shipped writer
could produce it: `deriveLevel` tops out at `high`, and `--dim <d>=max` is
rejected by the parser with a message pointing at the override. So every HITL
interview either dead-ended or spent an attested override — and once the hatch
is the only door, its ledger row records "bypassed the gate" for the thorough
interview and the skipped one alike, which is the same as recording nothing.

## The design, and the two versions of it that were wrong

**Draft 1: accept `high`.** Measured before writing it down:

```
cxc scan record --session s --known goal=x --known constraint=x \
                --known success=x --known ontology=x
-> all four dimensions "high", scanRounds 1, in one command
```

`--known` is free text an agent types. That trades a gate nobody can pass for a
gate nobody can fail — the exact objection `scan-cli` already documents against
`--dim=max`, arriving through a different door.

**Draft 2: a `derived?: boolean` on `DimensionScore`.** Also probed first:

```
writeState(... derived: true)
on disk:         {"level":"high","known":["k"],"unknown":[],"confidence":1}
after readState: {"level":"high","known":["k"],"unknown":[],"confidence":1}
```

`reconstructScore` rebuilds from a four-field whitelist, so the flag does not
survive its own write. Widening the fail-closed reconstruct would have made the
provenance flag hand-editable — the objection again, spelled as a field.

**Shipped: ask the ledger.** `isInterviewReady` stays pure and becomes the SHAPE
half. `evaluateInterviewGate` composes it with `dimensionsBackedByAnswers`,
which re-reads the append-only Q&A ledger and returns the dimensions holding an
asked + answered + `--map`-attributed question. `scan_completed` events now
carry their map so the attribution survives the round that used it.

What the gate now costs: a real question and a real answer per dimension.
`request_user_input` is hard-denied in goal mode, so in HITL those answers come
from the human. Not unforgeable — the ledger is a file, and whoever can write
session state can append to it. It closes the accidental path and leaves forgery
a deliberate act, which is the right bar for a soft-gate whose honest bypass is
one attested command away.

## What the audits caught

Round 1 returned **FAIL** on draft 1, and round 2 **GO-WITH-FIXES** on draft 2.
Both of their substantive blockers were ones I had already measured and amended
before the verdict arrived — which is the argument for probing the runtime
instead of reasoning about it. What the auditor added that I had not: the
complete list of tests and comments encoding the old rule, and the observation
that my own sentence "data shape alone never proves a scan ran" was false for
this writer, since `runScanCli` increments `scanRounds` unconditionally.

The **release** audit is the one that paid for itself outright. It returned FAIL
on a tree I was about to tag:

> published tests=1961 but the measured suite reported 1995

`cxc release verify` compares the published badge against the suite it measures,
so the tag would have failed closed. The second blocker was worse in a quieter
way: the shipped interview skill still documented the `max` rule this unit had
just replaced, so agents installing 0.2.13 would have kept spending overrides for
interviews that now pass honestly.

## The release

| Step | Evidence |
|---|---|
| Version surfaces | twelve at 0.2.13; `check-versions.mjs 0.2.13` OK |
| Local gates | `gate.mjs` OK, `inventory --check` OK, `npm test` 1995/0 |
| `origin/dev` | `cd342bf0`, fast-forward, no force |
| Promotion | PR #52, merged as `35d7aba9` |
| Exact-head CI | **CI** and **Packed install lifecycle** both success at `35d7aba9` **before** the tag existed |
| Tag | `v0.2.13` on `35d7aba9` |
| Release run | `32826308916` — success |
| Artifact | downloaded; SHA256 matches `SHA256SUMS`; `plugin.json` reads `0.2.13+codex.260825074116`; `dimensionsBackedByAnswers`, `renderAttestShapeHint`, `TEST-FLAKE-ELIMINATE-01` and `ATTEST-SHAPE-01` all present in the payload |

The tag deliberately waited for the merge commit's own CI. Exact-head receipts
are looked up on `GITHUB_SHA`, so tagging a fresh merge commit before its
workflows finish fails the gate closed — `DEVOPS-EXACT-HEAD-01`, applied to the
release that shipped the rule.

## Deliberately not done

- **HMAC or signature on the interview ledger.** Named in the design as the only
  thing that would close filesystem forgery, and priced out of scope.
- **`check-versions.mjs` does not inspect `cli/` or `gui/`.** Both happen to be
  correct; widening the checker is its own unit.
- **The chat surface still discards `attestError`**, and the docs-site attest
  examples are still incomplete. Both were scoped out of the earlier train and
  stay out of this one.
