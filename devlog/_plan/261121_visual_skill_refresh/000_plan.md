# 000 — visual_skill_refresh: Plan

codexclaw's three visual skills (`dev-frontend`, `dev-uiux-design`, `dev-visualizer`) know
more than the open-source design skills that now lead the category, but they enforce almost
nothing in code, their trend and platform notes stop at 2026-07-14, and their copy rules
cover only the first generation of model-written tells. Two of their own recipes also teach
the look the user has rejected: a colored left accent bar on panels and nav items, and hue
filled buttons. This unit removes those recipes first, then adds a copy module, executable
lint gates, a 2026 platform/agentic-UX refresh and visualizer upgrades. Agents building UI,
reports and landing copy with codexclaw, and the user reviewing their output, are who it
changes things for. The public downstream `lidge-jun/noslopdesign` picks the changes up
through its existing weekly sync; this unit does not touch it.

Research: [001 OSS survey](001_oss_survey.md), [002 web platform 2026](002_web_platform_2026.md),
[003 copywriting](003_copywriting_research.md), [004 color restraint directive](004_color_restraint_directive.md),
[005 current gaps with anchors](005_current_gaps.md), [006 Apple HIG examples](006_apple_hig_examples.md),
[007 site survey: YC P26, Korea, foreign](007_site_survey.md), 008 external reviews (pending).

Catalog (third-party screenshots and Apple illustrations, kept out of the repo): Aside
session artifact `visual-catalog/visual-catalog-2026-11-21.pdf` (25 pages) with its HTML
source `catalog.html`; raw probes in the session `tmp/cap/` and `tmp/hig/`.

## Loop-spec

- **Loop archetype:** satisfy-spec, multi-cycle, docs-first (this cycle is docs-only).
- **Trigger:** user requests 2026-11-21 (Aside session): "codexclaw visual skill 개선좀하자
  frontend랑 dev uiux 최신 트렌드로 … 최근 오픈소스랑 한번 비교해봐", then "카피라이팅 부분도
  손봐야돼", then "필에 왼쪽 강조 이것도 없애고 색상도 최대한 많이 없도록 버튼에 많은색이 들어가지
  않게 … svg나 이런거를 이런식으로 (Activity Monitor screenshot) … devlog 쓰자 계속".
- **Goal:** five work-phases, each a complete cycle:
  1. wp1 (010): color restraint. Ban one-sided accent bars everywhere; neutral buttons with
     monochrome SVG glyphs; a per-screen color budget; fix every recipe/sample that teaches
     the opposite.
  2. wp2 (020): copy module. Fact sheet, voice card, registers, device budget, second
     generation tells in English and Korean, over-correction table, product microcopy, and
     routing to `kwrite`.
  3. wp3 (030): executable gates. `ui-lint` (static + rendered checks for the bans that can
     be counted) and `copy-lint` (EN/KO), both dependency-free Node scripts with fixtures.
  4. wp4 (040): platform and pattern refresh. Baseline 2026 CSS/HTML features, agent action
     UX (plan preview, approval, undo, activity log), DESIGN.md spec alignment, trend file
     dates.
  5. wp5 (050): visualizer. Rendered look loop for HTML/SVG figures, diagram type catalog,
     first-use brand profile gate, figure-first rules not yet adopted.
- **Non-goals:** copying text or code from any surveyed repository (ideas only, own words, as
  in the 2026-09-08 survey); new runtime dependencies; changing other skills' rule content;
  the noslopdesign repo; releases; merging.
- **Verifier:** `node plugins/codexclaw/scripts/check-prompt-architecture.mjs` (exit 0 at
  baseline, 2026-11-21); `node plugins/codexclaw/scripts/gate.mjs`; per-phase grep or fixture
  assertions listed in each phase doc; wp3 adds `node --test` fixtures for both linters.
- **Stop condition:** every phase's acceptance list holds with captured command output.
- **Expected terminal outcomes:** DONE; BLOCKED (a gate cannot run); NEEDS_HUMAN (a design
  decision the directive does not settle, a push or merge); NOOP ruled out by 005.
- **Escalation:** `git push`, PR creation and merge need the user's explicit approval. A rule
  that would contradict the user's 2026-11-21 directive goes back to the user.
- **Resource bounds:** none stated. Work happens in the worktree
  `~/Developer/new/700_projects/codexclaw-wt/visual-skill-refresh`, branch
  `docs/visual-skill-refresh` from `origin/dev` 2915878c.

## Ordering

wp1 first: it is the user's direct instruction, it is small, and later phases (lint rules,
copy samples, visualizer assets) must not re-teach what it removes. wp2 before wp3 because the
copy linter counts the tells wp2 defines. wp4 and wp5 are independent of each other and may
swap.

## Privacy

The user's Activity Monitor screenshot shows local process names. It is described in words in
004 and is not committed (DEV-PRIVACY-01).
