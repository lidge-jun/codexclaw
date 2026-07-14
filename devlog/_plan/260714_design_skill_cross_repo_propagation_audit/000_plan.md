# Design Skill Cross-Repo Propagation Audit

- Date: 2026-07-14
- Status: repair complete; fresh independent re-review PASS (same day)
- Scope: `codexclaw`, `../cli-jaw/skills_ref`, `../pabcd_initiative/skills`, `../ima2-gen/skills`

## Goal

Propagate the design-award research additions from codexclaw into each sibling
repository without replacing that repository's existing skill conventions.
Names, reference paths, document layout, validation limits, and repo-specific
guidance must remain local to each target.

## Independent review result

Overall verdict: **FAIL**. The four locations are not yet consistent enough to
call the propagation complete.

- `codexclaw`: core taxonomy and rule anchors are present. One shared Medium
  issue remains: `Fluorescent single-color fields` is marked `Emerging` using
  evidence that belongs to the broader single-saturated-field axis.
- `cli-jaw`: agent-neutral names are correct, but the patch is still effectively
  a wholesale codexclaw transplant. Existing React/Vite/design-system guidance
  was lost, and focused CI fails because `motion.md` is 1,113 lines and
  `asset-requirements.md` is 506 lines against the 500-line limit.
- `pabcd_initiative`: the patch has the same wholesale shape and conflicts with
  the repository's additive/adapted-port convention. Existing browser-connection
  and React hook guidance was removed; copied `devlog/_fin/...` evidence paths do
  not exist locally.
- `ima2-gen`: the `ima2-front`/`ima2-uiux` names and flat reference layout are
  preserved, but the split-hero carve-out, Segmented Multi-Pill Navigation, and
  the `16 movements / Liquid Editorial §1.14` routing updates are missing. Old
  `dev-frontend`, `dev-uiux-design`, and `references/core/` pointers also remain.

## Repair order

1. Correct the shared codexclaw trend-maturity row and re-establish the semantic
   source baseline.
2. Rebuild the cli-jaw patch from its own HEAD as an additive merge; preserve
   target-only rules, split files to satisfy the 500-line CI contract, and remove
   dangling evidence paths.
3. Rebuild the pabcd_initiative patch from its own HEAD using the same additive
   method while preserving its local guidance and paths.
4. Complete the ima2-specific mapping: flat paths, ima2 names, missing rule
   blocks, movement count/section pointer, and internal reference resolution.
5. Re-run per-repo validators, cli-jaw focused CI, semantic-anchor checks, path
   resolution, leakage scans, and a final four-repo review.

## Evidence snapshot

- Four independent sol reviewers were assigned one repository each.
- `cxc loop validate --slug design-md-detail-consolidation-fold-the-2026-07`:
  source consolidation ledger passes, but the new semantic review found the
  maturity-classification issue above.
- cli-jaw focused test:
  `uv run --no-project --with pytest python -m pytest -p no:cacheprovider tests/test_dev_frontend_refresh.py -q`
  -> `1 failed, 5 passed`.
- All eight skill directories pass `quick_validate.py`; this proves structural
  skill validity only and does not cover tailoring, semantic omissions, or CI.
- No repair was applied during this review.

## Repair result (2026-07-14, goalplan `repair-the-design-award-skill-cross-repo-propaga`)

All four repair classes were closed the same day by one local fix plus three
sol-medium worker dispatches (one per repo), then re-reviewed by a fresh
independent sol-medium reviewer. Verdict: **OVERALL PASS**, residual issues
Critical/High/Medium none (one Low navigation-clarity note on shorthand
`skill + basename` spans that all resolve uniquely).

- `codexclaw`: `design-trends.md:108` reclassified to the table's own
  uncoded-technique convention (`not separately coded` / `Signature pending
  recode`) with a canonical pointer to the parent-family row `Single saturated
  brand field` (6/45, Established, line 76). No other row borrows counts.
- `cli-jaw`: rebuilt additively from skills_ref HEAD; React/Vite/design-system
  guidance restored; 51 touched md files, max 487 lines (500-line CI gate);
  focused pytest `tests/test_dev_frontend_refresh.py` -> `6 passed`;
  `codexclaw|cxc-|devlog/_fin` scan zero hits; 90/90 SKILL.md references resolve.
- `pabcd_initiative`: rebuilt additively from HEAD; Browser Connection Budgets
  and React hook guidance restored byte-for-byte; forbidden scan zero hits;
  148/148 references resolve; 22 skill files changed, `git diff --check` clean.
- `ima2-gen`: mapping completed content-only in `skills/ima2*` — split-hero
  carve-out (`layout-discipline.md:24`, `anti-slop.md:225`), Segmented
  Multi-Pill Navigation (`top-bar.md:62`), 16 design movements routing
  (`ima2-uiux/SKILL.md:74`), Liquid Editorial anchored at
  `design-isms.md` §1.14; stale `dev-frontend|dev-uiux-design|references/core`
  scan zero hits; 123/123 references resolve. Note: this checkout's git
  metadata is redirected through a codex worktree, so verification was
  content-based (rg), not git-diff-based.
- Validators: `quick_validate.py` -> `Skill is valid!` on all 8 skill dirs.

Evidence receipts: `.codexclaw/evidence/260714-cli-jaw-design-award-leaf-attempt-2.md`,
`.codexclaw/evidence/subagent-stop-9-attempt-3-design-award-additive-port.md`,
`.codexclaw/evidence/subagent-stop-9-ima2-design-award-mapping.md`,
`.codexclaw/evidence/260714-four-repo-repair-review.md` (final review).
All target-repo changes remain uncommitted for user review; no git commits were made.
