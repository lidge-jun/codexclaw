# 040 — Unit summary: stacked pull requests

Unit: `260803_stacked_pull_requests` · Written: 2026-08-03 · Class: C3
Status at time of writing: WP1-WP3 complete and committed; **WP4 in progress** — this
summary is itself a WP4 deliverable, so the metadata commit and the push to `origin/dev`
have not happened yet. Their evidence is appended in §Publish record below, after the
fact. Do not read this document as a completion claim until that section is filled in.

## What shipped

| Work-phase | Commit | Result |
|---|---|---|
| WP1 docs-only roadmap | `2146edf3` | 000 research ledger, 001 audit synthesis, 010/020/030 diff-level phase docs |
| WP2 canonical doctrine | `fe6af589` | NEW `dev/references/stacked-prs.md` (`DEV-STACK-01..05`), `dev/SKILL.md` pointer + reference row, ownership-map row |
| WP3 recommendation wiring | `cbe5a97b` | Pointer stubs in `pabcd` (P and B), `loop` (LOOP-GIT-01), `dev-code-reviewer`, `dev-devops` |
| WP4 discovery + publish | pending | Frontmatter description/keywords on `dev` and `dev-code-reviewer` (uncommitted at write time); this summary; then commit and push to `origin/dev` |

The capability answers the gap identified in `000_research.md` §1: the family's own
planning discipline (PHASE-SPLIT-01 dependency-ordered phase maps, LOOP-UNIT-CHAIN-01
work-phase chains) *produces* stack-shaped work and previously had no vocabulary to ship
it. Stacking is now both documented and recommended at the points where that shape is
created.

## Decisions recorded (WP4 no-ops, per `030` M3)

All three were independently verified by the A-gate reviewer:

- **docs-site: NO EDIT.** `docs-site/src/content/docs/guides/skills.md` carries a routing
  table (:59-68) and a per-skill table (:86-112); both are one-line **role** summaries that
  inventory neither rule families nor modular references. Stacking is a rule inside an
  existing role, not a new role, so the published docs do not under-report the skill.
- **`agents/openai.yaml`: NO EDIT.** All five touched skills' yaml files carry only
  `interface.display_name`, `interface.short_description`, and
  `policy.allow_implicit_invocation` — no trigger list exists to update.
- **README `skills-27` badge: NO EDIT.** No skill directory was added. This was the
  deciding factor in choosing `dev` as owner over a new `dev-git` skill
  (`000_research.md` §5): a new directory would cost manifest and badge churn for no
  doctrine benefit.

## Verification evidence

Run fresh during each work-phase — at the C gate for WP1-WP3, and as the latest
pre-publish evidence for WP4 (which is still open at the time of writing):

- `npm run gate` → exit 0, "no status drift, false-enforcement prose, or count mismatch"
- `npm test` → 1449/1449 pass, 0 fail, exit 0
- Ownership proof — `rg -n "DEV-STACK-" plugins/codexclaw/skills`: 5 rule definitions in
  `dev/references/stacked-prs.md` only; every other hit is a pointer.
- Frontmatter parse: both edited files' keyword arrays parse as valid JSON string arrays.

Audit coverage — **10 reviewer rounds** across two independent sol reviewers
(REVIEW-DECORRELATE-01: the WP2/WP4 reviewer was a different agent from the WP1/WP3 one).
Each row counts every round the gate actually ran, failures included:

| Gate | Rounds | Verdict sequence |
|---|---|---|
| WP1 plan | 4 | FAIL → FAIL → FAIL → PASS |
| WP2 landed doctrine | 2 | FAIL → PASS |
| WP3 landed stubs | 1 | PASS |
| WP4 metadata + whole unit | 3 | FAIL (missing this document) → FAIL (this document over-claimed) → see §Publish record |

The WP4 row is the reason this section exists in its current form: round 2 caught the
summary asserting a completed push, a `DONE` outcome, and a passing WP4 audit while
`HEAD` was still `cbe5a97b`, `origin/dev` was still `ecc644e7`, and the audit had just
returned FAIL. It also caught the round count reading "7" above a table summing to 9.
Both were exactly the over-claiming this unit's own doctrine warns against, in the
document meant to be the durable record.

## What did not go well (LOOP-PESSIMIST-01)

The audit loop caught the same failure family five separate times, each time in a new
disguise. It is worth naming because the pattern is not specific to this unit:

1. **Lead-as-fact** (WP1 R1) — discovery-grade claims from the search swarm were written
   into doctrine at shipping-grade confidence.
2. **Citation laundering** (WP1 R2) — I removed a weak source but kept the sentence it
   had justified.
3. **Compression-as-relocation** (WP1 R2/R3) — stubs got shorter without getting emptier;
   twice, because I applied the acceptance test only to the stubs I had rewritten most.
4. **Hedge-defeating restatement** (WP2 R1) — an anti-pattern table re-asserted, as flat
   fact, the exact threshold a paragraph 100 lines earlier had carefully labeled as
   practitioner experience.
5. **Premature completion claim** (WP4 R2) — the summary reported a push and a `DONE`
   outcome before either existed. The tell was writing the record in the tense of the
   plan rather than the tense of the repository.

The common root: **a claim's status has to travel with every copy of the claim.** A hedge
that lives in one paragraph does not protect a restatement elsewhere, and a source's
removal means nothing if its conclusion survives. Every one of these was caught by an
independent reviewer, not by self-review — which is the argument for the A gate existing
at all.

Also worth noting: the discovery swarm reported GitHub's stacked-PR feature as *private*
preview. Opening the page showed **public** preview. One Tier-2 fetch overturned a claim
four parallel search lanes had agreed on.

## Residuals / follow-ups

- **K20 unverified.** The specific stale-approval-dismissal-on-force-push mechanism was
  never confirmed: the GitHub rulesets page returned `blocked` on the HTTP rung and was not
  chased further up the browse ladder. Shipped text is hedged accordingly. A later cycle
  wanting to state the mechanism owes a Tier-2 pass via a rendering rung.
- **Vendor tool semantics stay leads.** Graphite / Git Town / `spr` flag-level behavior
  (K12-K14) is referenced only as "these tools exist, read their docs." Shipping per-tool
  recipes requires opening each vendor doc first.
- **Korean synonym coverage is partial.** The WP4 reviewer found a realistic phrasing that
  matches no added keyword: "연쇄 브랜치로 나눠 올려줘". Because `cxc-dev` is implicitly
  invoked for all coding work the request can still reach the doctrine semantically, but
  metadata alone does not guarantee it. Cheap fix for a later cycle: add 연쇄 브랜치 /
  브랜치 체인 / 쪼개서 올리기 variants to the `dev` keyword list.
- **No runtime enforcement.** `DEV-STACK-*` is agent-followed discipline. Nothing in the
  hook layer verifies a stack's base refs or merge order, and the `gate.mjs`
  false-enforcement scan exists precisely to stop the docs from claiming otherwise.

## Publish record

Filled in after the actions actually completed, per the WP4 R2 finding.

Sequence (fixed after the WP4 R3 finding that the original plan would have left the
remote one commit behind): commit metadata + this summary → push → append the receipt
below → commit that → **push again** → verify `origin/dev == HEAD`. The record cites the
first commit and push; the second commit needs no self-reference.

- Metadata + summary commit: _(appended after the commit lands)_
- `git push origin dev`: _(appended after the push succeeds)_
- Final `git log --oneline -1 origin/dev` with `origin/dev == HEAD`: _(appended after the
  second push)_
