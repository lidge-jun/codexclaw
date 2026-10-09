

## Source: plugins/codexclaw/skills/dev-devops/SKILL.md

Sources: the OpenCodex v2.32.1 hotfix train and the operator-visibility train
that followed it (`devlog/_plan/260824_v2_32_1_hotfix_train/`,
`devlog/_plan/260825_operator_visibility_train/`). A freeze audit rejected the
first GO report there on three counts — unresolved review threads on merged PRs,
a red gate argued into an exception, and missing frozen-head receipts
(`900_go_nogo_readiness_report.md`:37-49).


## Source: plugins/codexclaw/skills/dev-devops/SKILL.md

Per-rule sources: FREEZE-SHA `900`:3-7; GATE-WEAKEN `900`:47-49; REVIEW-THREADS
`900`:40-46 and `080_wp8`:47; GATE-OWNER `090_wp9`:6-8 and
`000_baseline_scope_and_roadmap.md`:243-245.

**Why gate-weakening is the load-bearing rule.** In the case that produced it the
suite was red, the red tests were known to be load-sensitive, and the fix was
real — so the report explained the exception. The audit rejected that, correctly:
an exception argued *after* a gate fails is indistinguishable from an exception
argued *because* it failed. The honest move was to decompose the gate to match
what CI actually runs (`DEVOPS-SUITE-PARTITION-01`), which turned the general
suite green. One local `api-usage` failure remained and was waived separately,
on the `DEVOPS-BASELINE-DEFECT-01` triple — not by the partitioning.


## Source: plugins/codexclaw/skills/dev-devops/SKILL.md

**Why the merged/closed distinction is load-bearing.** `delete_branch_on_merge`
reads as complete branch hygiene, and a repository with it enabled looks solved.
It is not: OpenCodex had the setting on and still carried 59 dead remote
branches, because closed-unmerged PRs are outside what that setting covers. The
failure is silent and compounds — nothing reports it, and the branch list simply
degrades until triage stops using it.


## Source: plugins/codexclaw/skills/dev-testing/SKILL.md

**The two known violations were deleted, not repaired (260726).**
`loop-activation-doc-sync.test.mjs` (10 assertions) and the doctrine test inside
`emergence-doc-sync.test.mjs` (24) both asserted phrase existence across skills, doctrine
documents and an archived HTML page. Three repair designs were tried and all three were
worse than deletion:

- A structured `metadata.contract` block in each skill, compared between them: nothing at
  runtime reads such a field, so it would have been a third source of truth that passes
  whenever both copies are wrong together.
- Promoting the activation prose to a behavioural test against `handleStop`: the five
  guard combinations are already owned by `hook-continuation.test.ts`, so this only
  duplicated coverage while appearing to offset the deletion.
- Promoting the collapse doctrine the same way: there is no runtime branch that
  implements a collapse point, so there is no value to compare against.

What that costs, stated plainly: the collapse-point doctrine, `cxc-search`'s ownership of
the divergence `strong-1`/`add-1` provenance, and the archived falsifiability SOT now have
**no automated consistency check**. They are human-review items. The activation contract is
unaffected — `hook-continuation.test.ts` owns it and always did.

What survived: the tag-balance half of the emergence test counts opening tags against
closing ones, which is a value compared to a value rather than a phrase lookup. It moved to
`emergence-html-structure.test.mjs` and still runs.

The lesson worth citing: when prose has no counterpart in code, a test that reads it can
only check that the words are still there. Deleting it removes a false green; inventing a
second document to compare it against removes nothing and adds a lie.


## Source: plugins/codexclaw/skills/dev-code-reviewer/SKILL.md

There is no automated check, and there cannot be a useful one: codexclaw owns no registry
of available backends to compare the prose against — `web_search` is host-provided. The
scan that used to guard this read one prose file for phrase existence, broke on rewording,
and proved nothing, so it was deleted with the protection routed here on purpose
(`plugins/codexclaw/test/manifest-policy.test.mjs`, the TEST-PROMPT-SEAM-01 comment). This
is a reviewer's read, not a contract. If a backend registry ever lands in code, revisit
whether a real two-source check is possible.
