# r4 moved history

Source: `plugins/codexclaw/skills/qa/SKILL.md`

Lineage: lazycodex `visual-qa` / `review-work` /
`lazycodex-qa-executor` (vendored at `devlog/.lazycodex/`), translated to
codexclaw's no-server, Codex-native-tool model.

Source: `plugins/codexclaw/skills/qa/SKILL.md`

## v2 candidates (deliberately not shipped)

- Node-only ports of lazycodex's `image-diff` / `tui-check` scoring scripts
  (objective similarity/overflow JSON as oracle reference input). v1 uses
  direct `view_image` inspection + inline width checks; vendor scripts only
  if field friction shows the inline checks miss real defects.
- A review-work-style multi-lane orchestrator: not planned — the A gate,
  C adversarial review, REVIEW-SYNTHESIS-01, and this skill already cover
  those lanes without a 5-spawn token bill.

Source: `plugins/codexclaw/skills/search/SKILL.md`

There is no codex-native equivalent and J-10 removed them deliberately.

Source: `plugins/codexclaw/skills/search/SKILL.md`

- The blocked-URL reader and ultraresearch decomposition are absorbed as Tier 2
  helper tactics and Tier 3 method, not as new tiers or vendored browsers.

Source: `plugins/codexclaw/skills/recall/SKILL.md`

This diagnostic improvement does not resolve #191's native routing/guard
mismatch.

Source: `plugins/codexclaw/skills/recall/SKILL.md`

Worked recoveries (eval 2026-09-10, re-measured after the long-query
relaxation). `지난번 로컬 소스를 실제 서비스에 연결하고 정상 동작까지 확인한 방법`
now returns hits as-is, on word overlap alone, so read them before trusting
them. `코덱스를 재시작하면 플러그인이 사라지는 문제` and
`2.49.0 배포하고 npm 패키지가 진짜 그 소스인지 검증한 기록` are still 0 as-is on
this corpus: five words is a strict AND, and the release sentence's required
`2.49.0` and `npm` never share a message with three of its remaining words.
All three recover as `source dogfooding` / `plugin restart` / `2.49.0 배포 npm`.

Source: `plugins/codexclaw/skills/interview/SKILL.md`

It is the exception now, not the only door — until 260825 the gate
demanded a level no writer could produce, so every interview spent an override and the row
stopped distinguishing anything.

Source: `plugins/codexclaw/skills/lunasearch/SKILL.md`

## Gap note (vs lazycodex ultraresearch)

This skill is intentionally lighter than lazycodex `ultraresearch`. It does not
run the EXPAND convergence loop, keep a session journal, verify by executing
code, or generate reports — those belong to `cxc-search` Tier 3. lunasearch is
the cheap one-shot discovery fan-out; ultraresearch is the deep multi-wave
research protocol. Use lunasearch when breadth-for-cost is the goal; escalate
to `cxc-search` Tier 3 when the question needs iterative expansion and
contested-claim verification.

Source: `plugins/codexclaw/skills/skill-hub/SKILL.md`

# skill-hub (DEPRECATED)

Capability routing is now canonical in `dev/SKILL.md` under "Capability
Routing Hub". The former implicit set claim is stale.

Load `cxc-dev`, then follow its routing table.

Source: `plugins/codexclaw/skills/orchestrate/SKILL.md`

# cxc-orchestrate (DEPRECATED)

Phase control semantics have been merged into `$cxc-pabcd` under
"Phase Control / Orchestrate". Use `$cxc-pabcd` instead.

Source: `plugins/codexclaw/skills/goalplan/SKILL.md`

# cxc-goalplan (DEPRECATED)

This skill has been merged into `$cxc-loop`. All goalplan concepts (work-phases,
criteria, checkpoints, evidence, CLI surface) now live in the loop skill.

Use `$cxc-loop` instead. The `cxc goalplan` CLI commands still work as deprecated
aliases for `cxc loop`.

For multi-cycle loops, `cxc-loop` now mandates a docs-first entry cycle
(LOOP-DOCS-FIRST-01) before implementation work-phases.

Source: `plugins/codexclaw/skills/dev-diagram-viewer/SKILL.md`

# cxc-dev-diagram-viewer (DEPRECATED)

This skill was renamed to `$cxc-dev-visualizer`. Every reference, asset and
verification rule (DIAGRAM-LAYOUT-01, DIAGRAM-RENDER-VERIFY-01, DIAGRAM-SYNTAX-01,
DIAGRAM-A11Y-01) now lives under `skills/dev-visualizer/`.

Use `$cxc-dev-visualizer` instead. This folder ships only so older prompts,
devlogs and subagent attachments that name `cxc-dev-diagram-viewer` still
resolve to the current owner.

Source: `plugins/codexclaw/skills/recall/SKILL.md`

`2.49.0 provenance` ranked a 2.48 session first.

