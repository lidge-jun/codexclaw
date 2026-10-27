# 000 — frontend_skill_audit: Plan

When someone asks an agent "does this product meet WCAG 2.2 AA?" or "audit our design
against good interface guidelines and fix everything", codexclaw's two design skills give it
scattered contrast and target-size lines, a few wrong WCAG levels, and no procedure for
personas, journeys, an ideal state, a ruthless gap list, per-violation verification or
before/after PR evidence. This unit gives dev-uiux-design an experience audit and
platform-neutral principles distilled from Apple's HIG, gives dev-frontend one WCAG 2.2 AA
owner and a visual audit loop, and corrects the conflicting sentences. Agents doing design
audits and the people reviewing their PRs are who it changes things for. Research:
[001 HIG foundations](001_hig_foundations.md), [002 HIG patterns](002_hig_patterns_journey.md),
[003 current gaps](003_current_skill_gaps.md), [004 architect record](004_architect_consultation.md),
[005 WCAG 2.2 criteria](005_wcag22_criteria.md).

## Loop-spec

- **Loop archetype:** satisfy-spec (work until fixed acceptance criteria hold), run unattended
  (HOTL, human out of the loop) under cxc-loop, which starts multi-cycle work with this
  docs-only roadmap cycle.
- **Trigger:** user request 2026-10-28: are WCAG 2.2 AA checks, goal setting and loop routing
  in cxc-dev-frontend and cxc-dev-uiux-design; improve both from the frontend and UI/UX
  perspective, run as cxc-loop with sol subagents, ultrawork/ulw excluded; multiple PRs with
  before/after.
- **Goal:** the five outcomes in the Codex goal set for this session (mirrored in the
  goalplan under .codexclaw/goalplans/): WCAG 2.2 AA owner, HIG-derived universal
  principles, experience audit procedure, visual audit loop with before/after gate, routers
  and indexes that point to them; conflicting sentences fixed.
- **Non-goals:** other skills' rule content; runtime TypeScript; product apps; Apple visual
  styling; merging PRs; releases; recounting README rule-id totals; ulw.
- **Verifier:** `node plugins/codexclaw/scripts/check-prompt-architecture.mjs` (exit 0 at
  baseline, reads every skills markdown file for links, ids, budgets);
  `node plugins/codexclaw/scripts/gate.mjs` (exit 0, includes the former and inventory);
  `node plugins/codexclaw/scripts/test.mjs` on prompt-architecture, skill-catalog,
  manifest-policy, inventory and packaging tests (46/46 pass at baseline); the seeded axe
  fixture (020_phase2.md section H, before exit 1, after exit 0, run 2026-10-28); full `npm test` through
  `cxc receipt test` at the head of the last PR. Procedure quality is reviewed by the independent audit-phase
  reviewer (a gpt-6-sol subagent); no command observes it.
- **Stop condition:** all eight goalplan criteria met with captured evidence and three PRs
  open with green checks; or a BLOCKED/NEEDS_HUMAN condition below.
- **Memory artifact:** this unit, the goalplan
  `.codexclaw/goalplans/improve-the-codexclaw-frontend-skills-plugins-co/` and its ledger.
- **Expected terminal outcomes:** DONE (criteria met, PRs open and green); BLOCKED (a gate
  cannot run, CI unavailable); NEEDS_HUMAN (a reviewer FAIL that needs a product decision,
  push rejected); BUDGET_EXHAUSTED only on a host limit (no user bound stated). NOOP is ruled
  out by 003.
- **Escalation condition:** any change outside the IN scope of a phase doc; a reviewer FAIL
  after two repair rounds (LOOP-DOOM-01); push or PR rejection; merge requests.
- **Resource bounds:** none stated; host limits apply. Tools: local shell, gh (push and PR
  creation authorized by the user's PR request this session), sol subagents (gpt-6-sol),
  scratch npm installs in /tmp only.

## Work-phase map (one phase = one full PABCD cycle; dependency order)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp0 | this 000 + 001-005 + 010/020/030 | Docs-only roadmap | — |
| wp1 | [010](010_phase1.md) | dev-uiux-design: universal principles, experience audit, routing | wp0 |
| wp2 | [020](020_phase2.md) | dev-frontend: WCAG 2.2 AA owner, visual audit loop, routing, fixture proof | wp1 (visual-audit-loop links the experience audit) |
| wp3 | [030](030_phase3.md) | Cross links, 23 numbered sentence fixes (030 sections B-D), SoT sync, changelog, PR delivery | wp2 (links need all four files) |

Order follows the link graph: uiux files link only to existing frontend files, frontend files
link back to the uiux files, and wp3 closes the remaining forward links. PRs form a manual
chain (DEV-STACK-01): PR1 base dev, PR2 base PR1 head, PR3 base PR2 head. The roadmap docs
ship in PR1.

## Accept criteria (mirrors goalplan c-1..c-8)

| ID | Criterion | Phase | Proof |
|---|---|---|---|
| c-1 | WCAG 2.2 AA owner with all A/AA criteria and the six additions | wp2 | 020 accept table |
| c-2 | Platform-neutral HIG principles reference | wp1 | 010 accept table |
| c-3 | Experience audit procedure | wp1 | 010 accept table |
| c-4 | Visual audit loop with before/after gate | wp2 | 020 accept table |
| c-5 | Conflicting WCAG statements corrected | wp3 | 030 rg returns nothing |
| c-6 | Seeded fixture proof | wp2 | 020 H run.log |
| c-7 | Gates and tests exit 0 at PR head | wp3 | receipt + gate output |
| c-8 | PRs open with before/after, green, unmerged | wp3 | gh pr view |

## Conventions and reuse

- Rule ids: new ids UX-PRINCIPLES-01, UX-AUDIT-01..07, FE-WCAG22-01..02, FE-VISUAL-AUDIT-01..03;
  `rg -n 'UX-AUDIT|UX-PRINCIPLES|FE-WCAG22|FE-VISUAL-AUDIT' plugins/codexclaw/skills` found none on
  c12c71c8 (single-definition check 4 of the prompt gate).
- Budgets (architect D-record, structure/70_prompt_architecture.md): routers ≤ 10240 bytes
  (now 3987 and 3807), references target ≤ 16 KiB, 24 KiB reported. New files: universal-principles.md
  about 7.0 KB, experience-audit.md 6.4 KB, wcag22-aa.md 12 KB, visual-audit-loop.md 5.7 KB.
- Reused owners, linked and not restated: visual-verification.md (viewports, capture),
  anti-slop.md / anti-slop-enforcement.md (rendered rule ids), a11y-patterns.md (widgets),
  cxc-qa evidence-contract.md (receipts), cxc-loop (goals and cycles), dev stacked-prs.md.
- SoT sync target: structure/INDEX.md skill table and docs-site skills guide (030 G).

## Architect consultation

Proposal, dispositions and the reflection verdict: [004](004_architect_consultation.md).
Architect handle `01a17e1c-1bae-7400-b95f-83ef964231d2` (sol "Kant").


## Fresh-reader check (C-READER-01)

A context-free gpt-6-sol reader stumbled on undefined HOTL/satisfy-spec/docs-first, "host
goal", "020 H", "last head", "sol A reviewer", the meaning of "23 sentence fixes" and unlabeled
file sizes. All seven were rewritten above on 2026-10-28.
