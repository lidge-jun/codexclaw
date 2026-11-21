# 011 — Merge dev-frontend + dev-uiux-design into cxc-dev-design (2026-11-21)

**Decision.** The owner asked (2026-11-21) "frontend랑 uiux design 이랑 합치면은 안되는건가", then
chose "cxc-dev-design 이걸로 하고 visulizer 도 해서 … 푸시까지 전부 다 진행 관련된 레포들 전부".
dev-visualizer stays separate: documents, PDF and diagrams have different outputs and proof.

**Why one skill.**
- The two skills cross-referenced each other in 40 files.
- The rule "read uiux before frontend for an open-ended brief" was a single point of failure.
- Anti-slop rules were split into "concept-level" and "implementation-level" and had to be
  updated twice.
- The leading OSS design skills each ship one skill covering direction to audit: impeccable,
  hallmark, taste-skill, heydamir/unslop.
- Size was not a constraint. The two routers came to 8.5 KB against a 10 KB budget, and
  references load lazily.

## Layout

```
skills/dev-design/
  SKILL.md                 modes: Direction, Copy, Build, Audit; house defaults; references
  agents/openai.yaml       implicit: true
  references/direction/    ex dev-uiux-design/references/* (32 files)
  references/build/        ex dev-frontend/references/core/* (45 files)
  references/stacks/       ex dev-frontend/references/stacks/*
  references/stack-index.md
  references/copy/         new: copy-process, copy-registers, copy-tells
  scripts/                 ex dev-frontend/scripts + ui-lint.mjs, copy-lint.mjs, fixtures
  examples/
skills/dev-frontend/       redirect stub (implicit: false), like goalplan → loop
skills/dev-uiux-design/    redirect stub (implicit: false)
```

## How the merge was made

1. **Moves.** All files were moved with `git mv`, so history follows.
2. **Links.** Every relative Markdown link in the skills tree was recomputed from its old
   resolved target to the new location (session script `tmp/relink.py`). Prose path strings
   were rewritten with the same directory map.
3. **Names.**
   - Outside the skill: `cxc-dev-frontend` and `cxc-dev-uiux-design` became `cxc-dev-design`,
     and the folder names became `dev-design`. Doubled phrases were fixed by hand: dev router
     table, skill-ownership, skill-hub catalog, structure INDEX, docs-site, READMEs, NOTICE,
     visualizer router.
   - Inside the skill: the old skill names became "direction mode" or "build mode". Lane B
     then rewrote the two role-boundaries files for one skill with modes.
4. **Runtime.** In `subagent-config`, `SURFACE_SKILL.frontend` and `.uiux` map to
   `dev-design`. The leaf-safe list in the attach hook now names `dev-design`. dist was
   rebuilt (`build.mjs`).
5. **Tests.** The `manifest-policy` implicit set is now {dev, dev-design, interview, loop,
   pabcd, recall, search}. The spawn-wrapper tests expect `$cxc-dev-design`.
6. **Inventory.** `inventory.json` gained `dev-design`, and the stubs stay listed. The skills
   README catalog lists the stubs as deprecated.
7. **Historical files left alone.** CHANGELOG.md and `port-provenance.json` keep the old
   names as history.

## Content added in the same branch

The content came from four parallel lanes:

- **A, copy.** copy-process, copy-registers (owner register from the A/B runs plus the Apple
  KR study) and copy-tells. The second-generation tells are WARN caps, not bans. ux-writing-ko
  gained microcopy rules.
- **B, rules and platform.**
  - FE-HERO-ALIGN-01: centered by default; a left-aligned hero needs a counterweight; split
    50:50.
  - Removed the anti-center ban, softened FE-HERO-SPLIT-01, and corrected the weight-extremes
    advice.
  - New platform-2026 and agent-action-ux files.
  - HIG corrections, Korea findings, trend dates.
- **C, lint.** ui-lint and copy-lint with fixtures and node tests, plus an honest NOT_RUN in
  render mode.
- **D, visualizer.** look.mjs render check, diagram-type catalog, brand gate and the
  source-patterns refresh.

Each lane's report and the gate outputs are recorded in 012.

## Downstream

- **noslopdesign** (lidge-jun/noslopdesign) syncs from codexclaw **main** with a rule table
  mapping dev-frontend → noslop-frontend and dev-uiux-design → noslop-uiux. Its branch maps
  dev-design → noslop-design, and the old skills become redirects. It must merge after
  codexclaw main contains dev-design; until then the weekly sync from main would see the old
  layout.
- **aside-visualizer** (lidge-jun/aside-visualizer) is the Aside port of dev-visualizer; the
  lane D changes are ported there.
- **Installed Aside skills (u/0)**: cxc-dev-frontend and cxc-dev-uiux-design are replaced by
  cxc-dev-design with an Aside port note, and dev-visualizer is updated from aside-visualizer.
