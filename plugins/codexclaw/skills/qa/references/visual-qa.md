# Visual QA — grounding, metrics-first, oracle limits

Deep rules for any VISUAL surface verdict (web UI, TUI). Everything here is E7
discipline. The tool ladder itself (QA-TOOL-LADDER-01) is canonically owned by
`dev-testing` §4.6; this file owns the evidence workflow AROUND those tools.

## Companion-skill mandate (QA-VISUAL-COMPANION-01)

A visual verdict must be grounded in rules, not taste:

- Load `cxc-dev-frontend` for every visual QA pass — its §5 anti-slop rules and
  `references/core/visual-verification.md` checklist (viewport matrix, CJK
  clipping, focus visibility, CTA integrity, containment) ARE the rubric.
- Load `cxc-dev-uiux-design` ONLY when the verdict judges design DIRECTION
  (personality, layout vocabulary, UX-state meaning) — not for mechanical
  render checks.
- Every oracle PASS names the rule ids it checked (e.g. FE-HERO-01,
  FE-GRADIENT-01, FE-A11Y-POLISH-01). "Looks good" with no cited rule is not a
  verdict; it is leniency bias — VLM judges are approximators, not oracles
  (MLLM-as-UI-Judge, WebDevJudge: documented bias/functional-equivalence
  failures).

## Objective evidence first (QA-VISUAL-METRIC-01)

Capture deterministic evidence BEFORE any subjective verdict — the numbers aim
the reviewer; they are not the verdict:

1. **Viewport matrix screenshots** — 1440 / 1024 / 768 / 390 px (+320 when
   text/buttons are dense), per `dev-frontend` visual-verification.md. Read
   every screenshot back with `view_image`; a screenshot never inspected is
   not evidence.
2. **DOM text extraction for text claims** — vision models degrade on dense
   text and CJK (ReadBench); any clipping/orphan/label claim pairs the pixels
   with extracted DOM text (browser evaluate / `curl` + parse). Korean orphan
   checks ("합니다." alone on a line) are DOM+pixel checks, never pixel-only.
3. **Runtime signals** — dev-server console errors, failed asset requests,
   exit codes. Vite 8 forwards browser console to the CLI; wire it before
   judging rendered behavior.
4. **Pixel diffs when a baseline exists** — Playwright `toHaveScreenshot` /
   pixelmatch / odiff numbers if the repo already has them; do NOT vendor new
   diff tooling for a one-shot QA pass. No baseline -> viewport matrix +
   checklist is the objective layer.

## Oracle passes (C3+; rubric-bound)

The dual passes from SKILL.md §5, with judge-reliability mitigations
(deterministic-gates-first + discrete rubric outputs; Arize/LangSmith
guidance):

- Pass A (design-system + functional integrity) judges against the
  QA-VISUAL-COMPANION-01 rubric and returns per-rule findings.
- Pass B (visual fidelity + CJK precision) receives the DOM-extracted text
  alongside screenshots — it confirms rendering, the DOM confirms content.
- Both return discrete verdicts (PASS/REVISE/FAIL per finding), each finding
  located (viewport + region + rule id). Synthesis in the main session.

## Extended adversarial classes (visual surfaces)

Beyond SKILL.md §4 classes, probe when applicable (W3C reflow / USWDS /
Playwright emulation matrix):

- narrow reflow at 320px (WCAG 1.4.10);
- 200% zoom / text scaling;
- dark mode (`prefers-color-scheme`), theme toggle if shipped;
- `prefers-reduced-motion` (motion must degrade, not vanish into broken
  layout);
- offline / no-JS only when the surface claims app-shell or SSR behavior;
- locale long-string + CJK stress labels.

N/A rules per SKILL.md §3: structurally inapplicable only, with a recorded
reason.

## TUI addendum

`tmux capture-pane -p` (+ `-e`) with a stated real width stays the default.
When the repo already uses them, prefer their harnesses: VHS (scripted
terminal renders with fixed dimensions/theme -> PNG/GIF artifacts) or
Bubble Tea `teatest` golden files. Do not introduce either for a one-shot QA
pass. Width checks are objective: `awk 'length > COLS' capture.txt` is the
minimum overflow gate; box-drawing/border misalignment and wide-char (CJK)
column drift are read from the plain capture, cited by line number.

## Sources (Tier-2 proven, 2026-07-07)

- Codex frontend-designs guidance (screenshot/iterate loop):
  developers.openai.com/codex/use-cases/frontend-designs
- Playwright visual comparisons + emulation matrix: playwright.dev/docs/test-snapshots,
  playwright.dev/docs/emulation
- pixelmatch / odiff (numeric diff artifacts): github.com/mapbox/pixelmatch,
  github.com/dmtrKovalenko/odiff
- VLM-judge limits: arxiv.org/html/2510.08783v1 (MLLM as UI Judge),
  arxiv.org/html/2510.18560v1 (WebDevJudge), arxiv.org/html/2505.19091v1 (ReadBench)
- Judge mitigation patterns: arize.com/llm-as-a-judge,
  docs.langchain.com/langsmith/llm-as-judge
- Reflow/zoom/a11y matrix: w3.org/WAI/WCAG21/Understanding/reflow.html,
  designsystem.digital.gov/documentation/accessibility
- TUI harnesses: github.com/charmbracelet/vhs, charm.land/blog/teatest
