---
created: 2026-07-11
tags: [codexclaw, pabcd-initiative, cli-jaw, jawcode, dispatch-economy, port, plan, diff-level]
---

# Loop 3 — downstream ports + GitHub publish (diff-level plan)

Status: PLANNED (rev 2 — A-gate round 1: 4 blockers, all ACCEPT; round-0
non-audit return was the evidence-file confusion, re-instructed)

## Loop-spec header

- Loop archetype: spec-satisfaction (verifier = rg presence/absence + commits/pushes).
- Trigger: user — "../pabcd*에도 전부 반영 + 깃허브 사이트 + 세개 패치 방법론에 따라
  거기도 패치, sol과 함께". The "three" = the README-named downstream adaptation
  targets: codexclaw (DONE this session), cli-jaw, jawcode. Port methodology per
  `pabcd_initiative/README.md:44-45`: "Ports are adapted, never blind-copied."
- Goal: (a) confirm pabcd_initiative reflection is complete + publish the repo and
  docs-site to GitHub (Pages workflow); (b) port DISPATCH-ECONOMY-01 into
  cli-jaw `skills_ref/dev-pabcd` (its own live deploy repo) with cli-jaw
  "employee" vocabulary + reconcile its absolute delegation claims; (c) port into
  jawcode `jwc/skills/team/SKILL.md` with jwc team vocabulary (no dev-pabcd doc
  there — README-recorded residence).
- Non-goals: committing unrelated dirty files in cli-jaw / cli-jaw/skills_ref /
  jawcode working trees (user changes — port-scoped paths only); enabling GitHub
  Pages remotely (no `gh` CLI on PATH — workflow file ships, activation is a
  one-click repo setting, stated in D); Fugu-rule backfill for jawcode (separate
  pending port, recorded).
- Verifier:
  1. initiative completeness: dev-pabcd attest wording already gate-accurate
     (rg "if present" / four-transitions) — anchors recorded; no further edits.
  2. `.github/workflows/pages.yml` exists in pabcd_initiative (deploy docs-site
     via actions/deploy-pages) + `git push origin` succeeds for pabcd_initiative
     AND codexclaw.
  3. cli-jaw: FULL-CONTRACT check (round-1 blocker #2) — per-element rg over
     skills_ref/dev-pabcd/SKILL.md, ALL present: "DISPATCH-ECONOMY-01",
     "specifiab", "verifiab", "judgment ownership", "NOT an axis",
     "accept/reject/merge", "verbatim anchor", "batch", "default-OFF";
     absolute-claim sweep (:202/:274/:371/:390-392 analogs) returns only
     economy-qualified wording; no new axis nouns (load-bearing|complex
     logic|critical code count unchanged vs pre-edit); pathspec-only commit in
     skills_ref repo + push; outer cli-jaw submodule POINTER BUMP committed
     pathspec-only (`git add skills_ref`) + pushed (round-1 blocker #4).
  4. jawcode: same FULL-CONTRACT per-element rg over team/SKILL.md (jwc-adapted
     wording, no cxc/cli-jaw commands); the SPECULATE clause explicitly
     classifies the intake-gate step-5 auto-researcher lane
     (team/SKILL.md:115) as a CURRENT-phase evidence dispatch outside
     speculative scope (round-1 blocker #1); pathspec-only commit + push.
  5. Anti-drift: rows 3/4's per-element checks ARE the drift gate; plus main
     reads both final blocks in full before commit (triage obligation).
  6. Commit hygiene (round-1 blocker #3): staging is pathspec-only
     (`git add <exact file>`); `git diff --cached --stat` is captured in 071
     and must list ONLY in-scope paths; any extra path aborts the commit.
- Stop condition: verifier rows 1-6 pass.
- Memory artifact: this plan + 071 impl record.
- Expected terminal outcome: DONE (Pages activation = one repo-settings click,
  noted, not BLOCKED).
- Escalation condition: upward — sol port draft failing packet twice (distinct
  agents) -> main writes the port directly (DISPATCH-RETIRE-01); downward — none
  beyond the planned dispatches.
- Write scope: `../pabcd_initiative/.github/workflows/pages.yml`,
  `../cli-jaw/skills_ref/dev-pabcd/SKILL.md`,
  `../jawcode/packages/coding-agent/src/defaults/jwc/skills/team/SKILL.md`,
  this devlog unit, port-scoped commits + pushes.

## Delegation plan (DISPATCH-ECONOMY-01)

| Slice | Axis call | Disposition |
| --- | --- | --- |
| A-gate review of this plan | audit, decorrelated | DISPATCH (gpt-5.6-sol, fresh reviewer) |
| cli-jaw port draft (locked source block + adaptation rules + bounded write scope: one file) | specifiable (decision boundary: vocabulary/section-number adaptation only, no semantic changes to the three axes) + rg-verifiable + no verdict ownership | DISPATCH (gpt-5.6-sol worker, write-capable) |
| jawcode port draft (same, one file, jwc vocab) | same | DISPATCH (gpt-5.6-sol worker, write-capable) |
| Pages workflow + pushes + initiative completeness anchors | small, credential-adjacent, main-owned close | MAIN |
| Triage of port drafts (accept/reject/merge before commit) | judgment-owned | MAIN |

Batch-spawn both port workers in one wave; single synthesis. Returns must list
changed lines (file:line) — verbatim anchors.

## Adaptation rules for both port workers (packet payload)

- Source of truth block: pabcd_initiative dev-pabcd §7.1 DISPATCH-ECONOMY-01
  (commit 71d5795) — three axes, complexity-is-not-an-axis, disposition
  obligation, verbatim-anchor returns, batch-wave preference, speculative
  default-OFF + external-research exception.
- cli-jaw: "worker/employee" vocabulary as the surrounding §7.1 uses; keep its
  §numbering; extend the existing Fugu adoption note (same parenthetical style);
  reconcile :202/:274/:371/:390-392 absolute claims exactly like the initiative
  reconciliation (safety default kept, write grant = economy pass + explicit
  write-capable dispatch, "Boss-led build" cells, verdicts stay with boss).
- jawcode: insert a `## Delegation economy (DISPATCH-ECONOMY-01)` section into
  team/SKILL.md near the dispatch/staffing contracts; jwc vocabulary (team,
  leader, worker dispatch); reference jwc dispatch surfaces, not cxc/cli-jaw
  commands; note adoption provenance (2026-07-11 fork-debate + Tier-2 ledger,
  codexclaw devlog pointer). RECONCILE with the Pre-context Intake Gate step 5
  (team/SKILL.md:115): the auto-delegated `researcher` evidence lane serves the
  CURRENT task's intake and is NOT speculative dispatch — the port's
  speculative-default-OFF clause must say so explicitly and scope itself to
  dispatching LATER-phase work.
- Both: do NOT touch any other file; do NOT revert unrelated dirty changes;
  return changed file + line ranges + a 3-line summary.

## Accept criteria (c-loop3)

Verifier rows 1-6, outputs captured in 071.
