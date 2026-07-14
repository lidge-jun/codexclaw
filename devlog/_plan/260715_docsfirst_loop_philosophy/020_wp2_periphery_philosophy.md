# 020 — WP2: 주변 스킬 + structure/00_philosophy.md 교차참조 패치 (diff-level)

Scope: `plugins/codexclaw/skills/dev/SKILL.md` (MODIFY), `plugins/codexclaw/skills/interview/SKILL.md` (MODIFY), `plugins/codexclaw/skills/dev-scaffolding/SKILL.md` (MODIFY), `plugins/codexclaw/skills/goalplan/SKILL.md` (MODIFY), `structure/00_philosophy.md` (MODIFY). 그 외 파일 OUT.

## Edit 1 — dev/SKILL.md §0.4 Workflow Modes에 docs-first 한 줄 추가 (MODIFY)

위치: §0.4 끝부분, "classify each work-phase independently." 다음 줄에 삽입.

삽입 텍스트:

```
Multi-cycle loops (2+ work-phases) enter docs-first: the first work-phase is a
docs-only PABCD that locks the diff-level roadmap before any implementation cycle
(LOOP-DOCS-FIRST-01, `cxc-loop`).
```

## Edit 2 — interview/SKILL.md: Contract 섹션에 multi-cycle 탐지 bullet 추가 (MODIFY)

위치: Contract의 마지막 bullet ("Record medium/low unresolved items as OPEN ASSUMPTIONS before leaving Interview." 다음)에 삽입.

삽입 텍스트:

```
- When Interview reveals work that will span 2+ PABCD cycles, flag the unit as
  multi-cycle so that the first work-phase enters as a docs-only roadmap cycle
  (LOOP-DOCS-FIRST-01, `cxc-loop`). Interview settles unit residence
  (UNIT-RESIDENCE-01) but does not write decade docs — that is the roadmap
  cycle's job.
```

## Edit 3 — dev-scaffolding/SKILL.md: SCAF-SOT-01 문단 끝에 교차참조 추가 (MODIFY)

위치: SCAF-SOT-01 규칙 문단 뒤, "do not flatten or renumber local history." 라인 다음에 삽입.

삽입 텍스트:

```
- In multi-cycle loop units, the decade docs (010, 020, 030...) are authored during
  the docs-only first work-phase (LOOP-DOCS-FIRST-01, `cxc-loop`), not scaffolded
  empty.
```

## Edit 4 — goalplan/SKILL.md: deprecated stub에 docs-first pointer 추가 (MODIFY)

위치: "Use `$cxc-loop` instead." 라인 다음에 삽입.

삽입 텍스트:

```
For multi-cycle loops, `cxc-loop` now mandates a docs-first entry cycle
(LOOP-DOCS-FIRST-01) before implementation work-phases.
```

## Edit 5 — structure/00_philosophy.md §6: docs-first loop 철학 bullet 추가 (MODIFY)

위치: §6 Evidence-first execution, 세 번째 bullet("Commits are **small, atomic, conventional**…") 다음에 새 bullet 삽입.

삽입 텍스트:

```
- Multi-cycle loops buy their memory first: the first work-phase is a docs-only
  PABCD that writes the diff-level roadmap (decade docs + research notes) before
  any implementation cycle. Memory lives on disk, not in the transcript — a loop
  that skips this step loses its steering between cycles
  (LOOP-DOCS-FIRST-01, `cxc-loop`).
```

## Verification (WP2 C-phase)

- `rg -n "LOOP-DOCS-FIRST-01" plugins/codexclaw/skills/dev/SKILL.md plugins/codexclaw/skills/interview/SKILL.md plugins/codexclaw/skills/dev-scaffolding/SKILL.md plugins/codexclaw/skills/goalplan/SKILL.md structure/00_philosophy.md` → 5 파일 전부 히트.
- frontmatter: `uv run --with pyyaml` 파싱 exit 0 (모든 변경 SKILL.md).
- `git diff --stat` 에 hooks 경로 없음.
- 교차참조 대상 `cxc-loop`의 LOOP-DOCS-FIRST-01이 010에서 신설된 것과 일치.
