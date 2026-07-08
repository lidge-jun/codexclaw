# 010 - Plan: DIVERGE-TIER-01 Four-Repo Guidance Patch

Date: 2026-07-07. Phase: P (session 019f3945-d74f-7d72-826d-e3593a818ad9, HOTL,
host goal armed, goalplan slug `diverge-tier-01-divergence-cost-tiers-guidance-o`).

## Loop-Spec Header

- Archetype: spec-satisfaction (verifier defines done: section present once per
  target file, numbering/router sync, reviewer findings closed).
- Trigger: owner directive 2026-07-07 ("pabcd_initiative first, then patch all
  three repos guidance-only, verification loop per runtime").
- Goal: same DIVERGE-TIER-01 rule shipped in 4 repos, adapted per runtime.
- Non-goals: runtime/code changes, gate code, renumbering, commits/pushes.
- Verifier: rg section checks + per-repo read-only reviewer subagent + triage
  synthesis; deterministic checks where the repo offers them cheaply.
- Stop condition: all criteria met or terminal outcome named.
- Memory artifact: this unit + pabcd_initiative devlog record.
- Expected terminal states: DONE | BLOCKED | NEEDS_HUMAN | BUDGET_EXHAUSTED.
- Escalation: reviewer reveals genuine runtime contradiction -> NEEDS_HUMAN.
- Resource scope (HOTL): writes limited to the 6 planned files + devlog docs +
  goalplan; read-only subagents; no credentials; single-session wall-clock.

## Canonical Text (source of truth for all four adaptations)

### 11.8 Divergence cost tiers (DEFAULT, DIVERGE-TIER-01)

Divergence defaults to CONCEPTUAL candidates, not implemented ones. Choose the
cheapest tier that can kill the wrong option:

- Tier 0 - inline brainstorm. The planning session itself lists options with
  trade-offs inside the plan/interview. No dispatch. Default for ordinary
  uncertainty.
- Tier 1 - conceptual candidate docs (the divergence default). 2-3 parallel
  read-only explorers each write ONE one-page candidate direction doc (no code,
  no worktrees) with mandatory front-matter: assumptions, risks, kill-criteria,
  evidence-needed. The MAIN session (collapse owner) performs critique/triage
  directly - it holds the most context; a separate cross-critique round is
  waste. Collapse gate: N candidate docs with filled front-matter AND
  per-candidate provenance per existing divergence doctrine (a repo-evidence
  path or search-provenance source per candidate) - Tier 1 tightens the
  divergence/collapse rule, it never relaxes its provenance requirement.
  Cross-critique rounds are NOT a gate condition.
- Tier 2 - implementation spike (rare escalation). Parallel worktree
  implementations judged by the same verifier, ONLY when both hold: (a) the
  choice is load-bearing and Tier-1 candidates genuinely conflict on it, and
  (b) judging requires running code (performance assumptions, live API
  contracts, deceptive local metrics). Expected frequency: 0-1 per unit. Tier-2
  entry is a recorded P-level decision.

Budget rationale: subagent tokens may be near-free, but wall-clock and the
collapse owner's triage attention are not. Tier inflation (defaulting to Tier 2
because subagents are cheap) is a discipline violation; so is tier deflation
that lets a load-bearing conflict collapse from paper arguments alone.

Unknowns lane: the first Tier-1 dispatch of a research-heavy or
unfamiliar-surface unit SHOULD be a blindspot/unknowns pass (known unknowns,
unknown knowns recoverable from references, unknown unknowns from codebase/web
search), so candidates are sourced from evidence, not parameter tweaks.

Topology: explorers neither message each other nor spawn their own workers
(star, not mesh). Candidate/critique exchange is file-mediated through the
unit's archive; the collapse owner schedules rounds and owns the collapse.

## Per-Repo Insertion Plan (diff-level)

### R1. pabcd_initiative (canonical)

- MODIFY `skills/dev-pabcd/references/loop-engineering.md`: append after 11.5
  two explicit STUB headers ("11.6 Continuation doctrine" / "11.7
  Divergence/collapse") that point to the SKILL.md router where their full text
  lives, then the full 11.8 section. This keeps the "canonical full text" claim
  honest without moving or rewording 11.6/11.7 (F1 fix).
- MODIFY `skills/dev-pabcd/SKILL.md`: add router bullet "**11.8 Divergence
  cost tiers (DEFAULT, DIVERGE-TIER-01)**" after the 11.7 bullet, summary only,
  pointing to references/loop-engineering.md.
- ADD `devlog/260707_diverge_tier_01_adoption.md`: adoption record with
  genealogy (codexclaw interview unit path, Fable field-guide research paths).

### R2. cli-jaw

- MODIFY `skills_ref/dev-pabcd/SKILL.md`: append inline `### 11.8` AFTER the
  existing 11.7 section at end of file (11.6 at :477, 11.7 at :486; F2 fix).
  Adaptation: Boss = collapse owner; explorers = `cli-jaw dispatch` read-only
  employees; archive = worklog/devlog.

### R3. jawcode

- MODIFY `packages/coding-agent/src/prompts/jaw/orchestrate-p.md`: extend the
  loop-spec header divergence bullet with a compact tier clause: divergence
  plans default to Tier-1 conceptual candidate docs (front-matter:
  assumptions/risks/kill-criteria/evidence-needed; main session critiques;
  collapse gate = docs present WITH per-candidate provenance - a repo-evidence
  path or search source); Tier-2 worktree spike only for load-bearing
  conflicts needing running code, 0-1 per unit, recorded as a P decision.
  Prompt stays compact (it is runtime-injected); rule id cited inline.

### R4. codexclaw

- MODIFY `plugins/codexclaw/skills/loop/SKILL.md`: in "When divergence is ON",
  add tier discipline. Tier-1 candidate authors are native EXPLORER subagents
  (never minds - minds are interview-time contradiction lenses, F4 fix).
  Front-matter lives in the candidate DOC file; `cxc divergence candidate add`
  records the archive row (kind/title/rationale/--source) alongside it (F5
  fix). Tier-2 = existing worktree/evaluate.sh lane with the new entry
  criteria. No renumbering; additive bullets only.

## Verification Plan (WP3)

- Deterministic: `rg -c 'DIVERGE-TIER-01'` == expected count per file; section
  order check (11.5 -> 11.8 adjacency where applicable); router/full-text sync
  in initiative; `git diff --stat` per repo limited to planned files.
- Reviewer loop: one read-only high-effort reviewer subagent per repo, prompt =
  "audit the new section against THIS repo's actual runtime mechanisms; return
  contradictions with file:line only". Findings triaged with accept/rebut
  synthesis in `020_verification.md`; reviewer reuse per repair round.
- jawcode extra: run any existing test that snapshots/loads jaw prompts if one
  exists (check before claiming); cli-jaw/codexclaw: no code touched, so test
  suites are out of blast radius - rg checks + reviewer only.

## Plan Deviations

(record during B; none yet)
