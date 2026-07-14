# 010 — WP1: cxc-loop + cxc-pabcd 코어 패치 (diff-level)

Scope: `plugins/codexclaw/skills/loop/SKILL.md` (MODIFY), `plugins/codexclaw/skills/pabcd/SKILL.md` (MODIFY). 그 외 파일 OUT.

## Edit 1 — loop/SKILL.md: LOOP-DOCS-FIRST-01 섹션 신설 (NEW section)

위치: `## Contract` 섹션 끝(마지막 bullet "Goal mode is PABCD-only …" 다음, `## HOTL Goal-Setting Rule` 앞)에 삽입.

삽입 텍스트:

```markdown
## Docs-first multi-cycle entry (LOOP-DOCS-FIRST-01, DEFAULT — STRICT for HOTL)

A loop is a chain of PABCD cycles, and a chain is only as disciplined as the
documents each cycle re-reads at P. Memory lives on disk, not in the transcript —
so a loop that will span 2+ work-phases buys its memory FIRST:

1. **Register and document in the same motion.** Arm the goalplan
   (`workPhases[]` + `criteria[]`, skeleton is fine) AND run the FIRST
   work-phase as a **docs-only PABCD cycle** (the `cxc-pabcd` Phase-0 pass).
   Its deliverable is the devlog unit: `000-009` research plus EVERY
   implementation phase's decade doc (`010`, `020`, `030`, ... with sub-docs
   like `021` where a phase needs finer grain) written to full diff-level
   precision (DIFFLEVEL-ROADMAP-01).
2. **The roadmap cycle's D is the roadmap lock.** Closing it finalizes the
   goalplan: `workPhases[]` are refined to map 1:1 onto the decade docs.
   The initial registration is a skeleton; the lock is the docs-only D, and
   the map stays APPEND-friendly afterwards (LOOP-UNIT-CHAIN-01).
3. **Implementation starts at the NEXT cycle.** Each later work-phase consumes
   exactly one decade doc as one full PABCD cycle: its P re-verifies the
   pre-written doc against the current tree (stale check), amends it, then
   executes. Never implement two decade docs in one B.
4. **Docs-only means docs-only.** Allowed in the first cycle: research notes,
   inventories, DESIGN.md, repro/state snapshots, the decade docs themselves.
   Not allowed: production code patches, deploy actions, or completion claims
   for implementation criteria.

**Mandatory read (LOOP-READS-PABCD-01, STRICT):** before claiming any
multi-cycle loop, READ `cxc-pabcd` §Implementation-Unit Documents — specifically
DIFFLEVEL-ROADMAP-01, PHASE-SPLIT-01 (dependency-ordered slicing, no effort
buckets), LEXICO-SPLIT-01 (numbered docs, research/implementation separation),
UNIT-RESIDENCE-01, and the one-work-phase-one-cycle invariant. Running a loop
from this skill alone, without those rules loaded, is a contract violation:
`cxc-loop` owns WHEN the loop enters docs-first; `cxc-pabcd` owns WHAT the
documents must be. Do not restate its rules here; read them there.

Exemptions: a loop that genuinely fits ONE work-phase skips the docs-only cycle
(ordinary `cxc-pabcd` ceremony applies); C0/C1 fast-path work is untouched. If
multi-cycle scope is DISCOVERED mid-loop, the docs-first debt comes due: the
next P is the roadmap amendment that writes the missing decade docs before
further implementation cycles.
```

근거: pabcd의 Phase-0 "MAY"를 루프 문맥에서 DEFAULT로 승격하는 것이 이 유닛의 핵심.
STRICT-for-HOTL인 이유: 무인 루프는 사용자가 중간 교정을 못 하므로 디스크 로드맵이 유일한 조향면.

## Edit 2 — loop/SKILL.md: description frontmatter에 트리거 어휘 추가 (MODIFY)

Before (description 끝부분):

```
... PABCD 여러 번, 여러 번 돌려, 반복 실행, 루프 돌려, 끝까지 해줘."
```

After:

```
... PABCD 여러 번, 여러 번 돌려, 반복 실행, 루프 돌려, 끝까지 해줘, docs-first, 문서화 먼저, 로드맵 사이클."
```

## Edit 3 — loop/SKILL.md: Contract의 overlay bullet에 필독 포인터 연결 (MODIFY)

Before:

```
- `cxc-loop` is an overlay on `cxc-pabcd`, not a replacement. Before claiming a
  loop is active, follow `cxc-pabcd` phase semantics and enter a real PABCD state
  with `cxc orchestrate I|P --session <id>` (or the human free-pass chat surface).
```

After:

```
- `cxc-loop` is an overlay on `cxc-pabcd`, not a replacement. Before claiming a
  loop is active, follow `cxc-pabcd` phase semantics (multi-cycle loops: read the
  rules named in LOOP-READS-PABCD-01 below first) and enter a real PABCD state
  with `cxc orchestrate I|P --session <id>` (or the human free-pass chat surface).
```

## Edit 4 — pabcd/SKILL.md: Phase-0 "MAY" 문장에 loop 승격 교차참조 (MODIFY)

위치: §Implementation-Unit Documents, "**Loop / multi-pass tasks**" 문단.

Before:

```
amends it before building. The first pass MAY be a design-only PABCD pass (Phase 0):
a code-free whole-system design/documentation cycle that produces exactly this
difflevel roadmap before the first implementation work-phase.
```

After:

```
amends it before building. The first pass MAY be a design-only PABCD pass (Phase 0):
a code-free whole-system design/documentation cycle that produces exactly this
difflevel roadmap before the first implementation work-phase. Under a `cxc-loop`
multi-cycle entry this Phase-0 docs-only pass is the DEFAULT first work-phase, and
STRICT for HOTL goal loops (LOOP-DOCS-FIRST-01, `cxc-loop`) — there the roadmap
cycle's D locks the goalplan work-phase map before any implementation cycle starts.
```

## Verification (WP1 C-phase)

- `rg -n "LOOP-DOCS-FIRST-01|LOOP-READS-PABCD-01" plugins/codexclaw/skills/loop/SKILL.md plugins/codexclaw/skills/pabcd/SKILL.md` → 양쪽 히트.
- 포인터 대상 규칙 실존: `rg -n "DIFFLEVEL-ROADMAP-01|PHASE-SPLIT-01|LEXICO-SPLIT-01|UNIT-RESIDENCE-01" plugins/codexclaw/skills/pabcd/SKILL.md` → 전부 히트.
- frontmatter: `uv run --with pyyaml python -c "..."` 파싱 exit 0.
- `git diff --stat` 에 hooks 경로 없음.
