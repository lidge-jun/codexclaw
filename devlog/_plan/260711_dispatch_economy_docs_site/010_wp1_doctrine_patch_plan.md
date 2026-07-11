---
created: 2026-07-11
tags: [codexclaw, dispatch-economy, doctrine, plan, diff-level]
---

# WP1 — doctrine patch plan (diff-level)

Status: PLANNED (rev 2 — post A-gate round 1)

## A-gate round 1 synthesis (REVIEW-SYNTHESIS-01)

Reviewer (Banach, gpt-5.6-sol, decorrelated) returned FAIL with 7 blockers. Dispositions:

| # | Sev | Disposition |
| --- | --- | --- |
| 1 move-list omission ("main agent owns plan/build" bullet, pabcd:416) | High | ACCEPT — added to move list |
| 2 model routing could override DIVERGE-TIER-01 / harden DECORRELATE | High | ACCEPT — reworded as non-overriding default, invariant = family independence |
| 3 packet lacks decision-boundary field for specifiability axis | Med | ACCEPT — packet amendment adds decision-boundary sentence |
| 4 pabcd summary scope undefined (SOT drift risk) | Med | ACCEPT — summary constrained to ONE non-normative pointer sentence |
| 5 no rollback procedure | Med | ACCEPT — baseline diff + verbatim-move verification added |
| 6 forbidden-claims description broader than actual regexes | Low | ACCEPT — narrowed to the three gate.mjs:123 patterns |
| 7 historical `pabcd:4xx` line refs go stale after move | Low | ACCEPT — declared immutable historical records, no index rewrite |

## Loop-spec header

- Loop archetype: spec-satisfaction repair (verifier = `npm run gate` + `npm test` + rg presence checks).
- Trigger: fork-debate verdicts (this session) concluded 5 amendments to the delegation principle.
- Goal: codify DISPATCH-ECONOMY-01 and the four AMEND verdicts without duplicating SOT.
- Non-goals: no hook/dist code changes, no new runtime enforcement claims, no cli-jaw ports.
- Verifier: `npm run gate` (forbidden-claims scan covers `skills/**/SKILL.md` + `structure/*.md`), `npm test`, `rg` presence of new rule ids.
- Stop condition: gate + tests PASS and criteria c1/c2 evidence captured.
- Memory artifact: this doc + goalplan ledger.
- Expected terminal outcome: DONE.
- Escalation condition: gate forbidden-claims false-positive on new wording that cannot be rephrased -> return to P; reviewer FAIL x3 -> LOOP-REPAIR-01 replan.
- Write scope: `structure/20_pabcd_dispatch_doctrine.md`, `plugins/codexclaw/skills/pabcd/SKILL.md`, `plugins/codexclaw/skills/loop/SKILL.md`, this devlog unit. Nothing else.
- Rollback (rev 3, round-2 fix): pre-edit VERBATIM COPIES of all three target files
  captured at `/tmp/wp1_snapshot/` (sha1: doctrine 8d61a89e, loop 88c2415f, pabcd
  e3f420d2) — restoration is a direct copy-back, preserving pre-existing user
  changes; the earlier `/tmp/wp1_baseline.diff` remains as provenance only. The
  section move is a verbatim cut-paste: after the move, verify with a normalized
  text diff against the snapshot that the moved block is identical except the two
  planned in-block edits. Never `git checkout --`.
- Historical references: devlog `_fin` docs pinning old `pabcd/SKILL.md:4xx` line
  numbers are immutable point-in-time evidence; they intentionally go stale and are
  NOT rewritten.

## File change map

### 1. `structure/20_pabcd_dispatch_doctrine.md` §3 (SOT)

- **Amend DISPATCH-RETIRE-01** (the existing bullet): add the packet-failure clause —
  when two DIFFERENT agents fail the same TASK packet, the packet itself has failed
  the specifiability bar; the main session reclaims the slice instead of dispatching
  a third copy. (Fork-debate verdict #4-upward: avoids a counter conflict with the
  existing "at most ONE retry then fresh-spawn" rule — the reclaim triggers on the
  fresh-spawn's failure, i.e. second distinct agent.)
- **Add DISPATCH-ECONOMY-01 (E7 doctrine, agent-followed)** as a new bullet after
  DISPATCH-RETIRE-01:
  - Three-axis delegability test: specifiability (the TASK packet can carry the full
    spec) x verifiability (a mechanical check can prove the return) x judgment
    ownership (load-bearing decisions — collapse/crux verdicts, API contract shape,
    plan amendments — stay with the main session; re-derivation of a crux may be
    dispatched per SPECIALIST-CRUX-01, the verdict on it may not). Complexity is NOT
    an axis: a complex-but-specified algorithm with a test oracle is a valid worker
    task; an easy-but-ambiguous naming/boundary decision is not.
  - Triage disposition obligation (output-side, replaces any "max concurrent
    dispatch" self-report): every returned lane gets a recorded disposition —
    accept / reject / merge + one-line rationale — before the next wave spawns;
    wave-granular judgment is allowed so cxc-search Tier-3 wave floors are not cut.
    Un-triaged returns + new spawns = violation, auditable in ledger/devlog.
  - Model routing (a DEFAULT, not an override): standardized implementation slices
    ride cheap/fast model families by default; crux re-derivation and adversarial
    review default to a decorrelated family. This preserves DIVERGE-TIER-01's tier
    selection untouched (conceptual-tier work is not force-promoted to strong
    models) and adds nothing to REVIEW-DECORRELATE-01 beyond its existing
    invariant: family independence from the producing model is the requirement;
    "strong" is a default choice, not a mandate.
  - Batch-spawn preference: fan out a full wave then synthesize once; drip-feed
    spawning taxes the main context per return (arXiv evidence in WP2 ledger:
    selection bottleneck 2603.20324, MacNet logistic saturation 2406.07155).

### 2. `plugins/codexclaw/skills/pabcd/SKILL.md`

- **Fill `## Delegation Model (subagents)`** (currently an empty header at ~369):
  MOVE the delegation bullets that are misplaced under `## Catalog Discovery
  routing` (DISPATCH-DISCOVER-01, the "main agent owns the plan and the build by
  default" bullet, lifecycle patterns, LEAF-TOPOLOGY-01, CSV fan-out note,
  reviewer-at-A bullet, disjoint-write bullet, DISPATCH-ISOLATION-01,
  SPECIALIST-CRUX-01, REVIEW-DECORRELATE-01, plan-travels bullet,
  background-verification bullet, and the DISPATCH-TASK-01 packet paragraph) into
  this section verbatim (content unchanged except the two edits below). Add the
  ECONOMY-01 pointer as EXACTLY ONE non-normative sentence naming the rule id and
  its SOT ("delegability and triage economy: DISPATCH-ECONOMY-01, normative
  wording in `structure/20_pabcd_dispatch_doctrine.md` §3") — it must not restate
  the axes, the disposition rule, or the model policy (SOT drift guard,
  fork-debate conditional-objection honored).
- **`## Catalog Discovery routing`** keeps only its intro paragraph (Interview
  sub-modes + `references/catalog-discovery.yaml` pointer).
- **DISPATCH-TASK-01**: (a) RETURN FORMAT — add the verbatim-anchor obligation: summary
  returns must carry verbatim anchors (exact `path:line` quotes, exact figures,
  URLs) so the main session can spot-check without re-reading the source; anchor
  grounding: Memex 2603.04257 ("summary-only is fundamentally lossy;
  summaries + stable indices + dereference"). A summary without anchors is a
  candidate, not evidence. (b) Packet completeness — one added sentence: the packet
  must state its DECISION BOUNDARY (which judgments the subagent may settle vs must
  return unresolved); a packet whose decision boundary cannot be written fails the
  DISPATCH-ECONOMY-01 specifiability axis and the slice stays with the main session.
- **P-phase loop-spec `Escalation condition`** (~line 137): name it bidirectional —
  upward (packet reclaimed by main after two distinct-agent failures, per amended
  DISPATCH-RETIRE-01) and downward (main pushing a slice down to a worker is a
  P-phase amendment, not a mid-B improvisation).

### 3. `plugins/codexclaw/skills/loop/SKILL.md`

- **Add `## Speculative dispatch (DISPATCH-SPECULATE-01, HEURISTIC)`** after the
  Wait-visibility section: speculative phase-N+1 dispatch during phase N is
  default-OFF — DIFFLEVEL-ROADMAP-01 already front-loads roadmap research at the
  first P, and stale checks need the post-landing tree, so the speculative window
  is narrow. The one allowed lane: phase-invariant EXTERNAL research (arXiv,
  library docs — nothing that reads the repo tree), quarantined as
  `candidate — unverified` until the next P re-validates it, discarded by default
  when the phase map is amended. Grounding: speculation self-limits by prediction
  accuracy and cost (2510.04371, 2606.07846).

## Ordering

1. doctrine §3 (SOT first) 2. pabcd SKILL (move + pointer) 3. loop SKILL 4. verify.

## Accept criteria

- c1: `npm run gate` exit 0, `npm test` exit 0 (no regression).
- c2: `rg "DISPATCH-ECONOMY-01" structure/ plugins/codexclaw/skills/` hits doctrine §3 + pabcd pointer; `## Delegation Model` section non-empty; `DISPATCH-SPECULATE-01` present in loop SKILL; the pabcd ECONOMY mention is a single pointer sentence (manual check) and the moved block passes the verbatim-move diff.
- New wording avoids the three forbidden-claims patterns actually scanned by
  `gate.mjs:123` (`hook loads/reads/injects the`, `automatically ... the <x> skill`,
  `hook enforces skill load/read`) — and, beyond the regexes, makes no runtime
  enforcement claim at all (E7 agent-followed labels throughout).
