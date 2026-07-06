# 10 — cxc-qa reinforcement: visual-QA reference + tool ladder

Status: A-audited plan (round 2; 2 blockers folded, see Audit synthesis)
Owner directives (2026-07-07): survey modularization patterns and decide if
cxc-qa needs references/; strengthen visual QA with codex-native rules,
emphasizing `cxc-dev-frontend` + `cxc-dev-uiux-design` as mandatory visual
companions; codify the browser/GUI tool hierarchy (computer-use, browse-use,
agbrowse, chrome plugin — "agbrowse 제외하면 다 CUA 기반"); gpt-5.5 + cxc-search
external evidence round.

## Modularization survey (repo pattern)

Skill sizes: dev-frontend 518L + 33 refs, dev-testing 523L + 6 refs,
dev-uiux-design 311L + 15 refs; small skills (interview 124L, qa 142L) have 0
refs. Pattern: SKILL.md stays a router under ~520L; depth moves to
`references/` when a section would otherwise bloat the body. cxc-qa's visual
section needs research-grounded depth (tool ladder, oracle-judge limits,
viewport matrix) that would double the body -> adopt ONE reference file now
(`references/visual-qa.md`), keep the body a router. No other refs yet.

## External evidence (gpt-5.5 + cxc-search, claim-ledger, 2026-07-07)

Tier-2 proven findings driving the design:

1. Agent harnesses converged on real-browser screenshot->inspect->iterate
   (Codex frontend-designs doc, Claude Code browser-tester, Cursor, Devin).
2. Playwright is the center of gravity (`init-agents --loop=codex`).
3. Objective screenshot baselines BEFORE subjective vision review
   (toHaveScreenshot/pixelmatch; Vitest 4 visual regression).
4. Numeric diff pre-metrics are agent-friendly artifacts (pixelmatch/odiff).
5. LLM/VLM-as-visual-judge is an approximator, not an oracle (MLLM-as-UI-Judge,
   WebDevJudge: bias/leniency/functional-equivalence failures).
6. Mitigation: deterministic gates first, then rubric judgment with discrete
   outputs (Arize/LangSmith).
7. Vision judges unreliable on dense text + CJK — pair screenshots with DOM
   text extraction (ReadBench).
8. TUI: VHS/teatest exist beyond tmux capture (fixed dims, golden files).
9. Authoritative adversarial matrix: reflow/narrow, 200% zoom, keyboard,
   dark mode, reduced-motion, offline, no-JS, locale/long-string
   (W3C reflow, USWDS, Playwright emulation, web.dev).

## Diff-level plan

1. NEW `plugins/codexclaw/skills/qa/references/visual-qa.md` (~120L):
   - **Companion-skill mandate (QA-VISUAL-COMPANION-01)**: a visual verdict
     grounded in `cxc-dev-frontend` (rendered implementation / anti-slop /
     visual-verification.md checklist) — plus `cxc-dev-uiux-design` ONLY for
     design-direction judgments — is not a grounded verdict; the oracle
     rubric MUST cite those rule ids, not taste. (Reviewer-refined phrasing.)
   - **Tool ladder pointer**: the QA tool ladder (QA-TOOL-LADDER-01) is
     CANONICALLY owned by `dev-testing` §4.6 (the landed tool-routing owner —
     audit blocker 1); this reference points to it and adds only the
     visual-evidence workflow around it.
   - **Objective-first rule (QA-VISUAL-METRIC-01)**: before any oracle verdict,
     capture deterministic evidence: viewport-matrix screenshots (1440/1024/
     768/390, +320 when dense — dev-frontend visual-verification.md list),
     DOM text extraction for any text-correctness claim (CJK especially),
     exit codes/console errors from the dev server, Playwright
     toHaveScreenshot/pixelmatch numbers when a baseline exists. Screenshots
     are read back via `view_image`, never trusted blind.
   - **Oracle limits + rubric**: dual-pass reviewers judge with discrete
     verdicts against the dev-frontend checklist (not "looks good"); CJK
     clipping claims require DOM-extracted text lengths alongside pixels;
     leniency bias countered by requiring each PASS to name the checked rule
     ids.
   - **Extended adversarial classes (visual surfaces)**: narrow/reflow 320px,
     200% zoom, dark mode, `prefers-reduced-motion`, offline/no-JS (when
     app-shell claims exist), locale long-string/CJK. N/A rules per SKILL §3.
   - **TUI addendum**: tmux capture stays default; VHS (fixed dims/theme,
     rendered GIF/PNG) or teatest golden files when the repo already uses
     them.
   - Sources section with the Tier-2 URLs.
2. `plugins/codexclaw/skills/dev-testing/SKILL.md` §4.6 — upgrade the existing
   tool table into the canonical **QA-TOOL-LADDER-01** (audit blocker 1 fix):
   ordered hierarchy for BUILT-surface QA — (1) in-app browser default,
   (2) chrome real-profile CDP, (3) computer-use GUI last resort, all
   CUA-class; (4) agbrowse as the one non-CUA rung, owned by cxc-search,
   QA-legal only for public-URL response-shape checks. Explicit inversion
   note vs SEARCH-BROWSE-01 (agbrowse-first is for public-web proof; QA of
   surfaces the agent serves starts at the in-app browser).
3. `plugins/codexclaw/skills/qa/SKILL.md` — body stays router-sized:
   - Modular References table (new, 2 rows: visual-qa.md; "when: any visual
     surface verdict").
   - §2 web/TUI rows point to the reference.
   - §5 C3+ oracle bullet: passes MUST load `cxc-dev-frontend` (+
     `cxc-dev-uiux-design` for direction judgments) and cite rule ids;
     pointer to QA-TOOL-LADDER-01 (dev-testing §4.6).
4. `structure/60_native_capabilities.md` — REWRITE the ownership sentence
   (audit blocker 2): escalation routing for public-web proof owned by
   `cxc-search` (SEARCH-BROWSE-01); built-surface QA tool routing owned by
   `cxc-dev-testing` §4.6 (QA-TOOL-LADDER-01). Not a parallel owner line —
   one scoped sentence replacing the exclusive claim.
5. This devlog doc records the survey + evidence.

OUT: no new hooks; no vendored pixelmatch/odiff (named as "use when repo has
them" only); no cxc-search ladder changes; no dev-frontend edits.

## Accept criteria

- references/visual-qa.md exists, <150L, carries QA-VISUAL-COMPANION-01 /
  QA-VISUAL-METRIC-01 with honest E7 labels + source URLs; QA-TOOL-LADDER-01
  canonical in dev-testing §4.6.
- SKILL.md gains Modular References table; total body still <200L.
- `rg 'QA-TOOL-LADDER-01'` hits dev-testing §4.6 (canonical), qa reference
  (pointer), structure/60 (scoped ownership sentence).
- npm test green (manifest policy counts references files as skill content —
  verify no count gate breaks).
- No contradiction with cxc-search SEARCH-BROWSE-01 (QA ladder scoped to
  built-surface QA; public-web proof stays search-owned).

## Audit synthesis (REVIEW-SYNTHESIS-01, round 2)

Reviewer (reused C-gate reviewer, DISPATCH-ACTOR-01): FAIL, 2 blockers, both
ACCEPTED:

1. QA-TOOL-LADDER-01 in qa/references violated the ownership split WE landed
   last cycle (qa owns procedure, dev-testing §4.6 owns tool routing). RCA:
   round-2 plan drafted against the owner directive wording ("codify in
   cxc-qa") without re-checking the standing ownership map. Fix: canonical
   ladder lands in dev-testing §4.6; qa reference points.
2. structure/60's "escalation routing OWNED by cxc-search" is an exclusive
   claim; adding a parallel owner would contradict it. Fix: rewrite that
   sentence into a scoped two-owner split instead of appending.

Minor notes adopted: companion mandate phrasing (uiux-design only for
direction judgments); no verdict.json schema change (DOM extraction rides
artifactRefs); no manifest/count risk for references files.
