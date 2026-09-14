# 010 wp2 — 지침 문구 (policy text)

구현 담당 판단의 소유자를 한 곳에 만들고, 계획 규약과 B 단계가 그것을 가리키게 한다.
런타임 강제는 추가하지 않는다(E7).

## Owner

main. 문장 자체가 판단물이고 슬라이스가 작다.

## Change 1 — `plugins/codexclaw/skills/dev/SKILL.md`

Anchor: `### Discovery delegation` 절 마지막 줄(현재 204행,
"applicable tiers; token totals alone cannot compare differently priced models.")과
`### Capability Routing Hub` 사이에 새 절을 삽입한다.

AFTER (삽입할 전체 텍스트):

```markdown
### Implementation delegation

Once a slice is specified — goal, editable files, the contract it must preserve
and the check that proves it — assign it to the configured `executor` by
default. Sequential work qualifies: a dependency order decides the order of the
packets, not who types the diff. Main keeps the specification, the load-bearing
judgment, the review of the returned diff and the integration.

Implementing a specified slice locally needs a stated reason, and only three
hold by default: the edit is small enough that packaging it costs more than
making it (§0.1), a load-bearing judgment inside the slice is still open so the
packet cannot state its decision boundary, or handoff plus re-work measurably
exceeds the delegated work. "It is sequential", "I already understand it" and
"typing it is faster" are not reasons; neither is read-only-style parallelism,
which is a separate question from who implements.

Delegate one verifiable bundle — the slice a single check can prove — rather
than one packet per file. P records the owner of each planned change and B
executes that assignment (`../pabcd/references/plan-output.md`); handing a new
slice to a subagent mid-B still requires a P amendment. Model, effort, fallback
and receipts stay with the configured dispatch path. Verify a returned
implementation against the VCS diff, never the report alone (§3). No-delegation
limits, host restrictions and DISPATCH-ECONOMY-01's specifiability /
verifiability / judgment axes take precedence.
```

검증: `rg -n 'Implementation delegation' plugins/codexclaw/skills/dev/SKILL.md`가
새 절 헤더를 반환하고, 기존 `:201` "Discovery does not replace implementation
delegation" 문장이 그대로 남아 있을 것.

## Change 2 — `plugins/codexclaw/skills/pabcd/references/plan-output.md`

Anchor: 9필드 표 아래 본문 마지막 문단(현재 23-27행, "Scope restrictions remain
authoritative. ...")과 `## Reader summary` 사이에 새 절을 삽입한다.
9필드 표와 "nine concepts" 문구는 건드리지 않는다(개수 불일치 방지).

AFTER (삽입할 전체 텍스트):

```markdown
## Implementation ownership

The file change map names an owner for each planned change: the configured
`executor` for slices whose scope and check are settled, or main with a
one-line reason from `cxc-dev`'s Implementation delegation exceptions. A plan
that assigns nothing has not decided; it has defaulted to main silently. B
executes the recorded assignment, and a new handoff mid-B remains a P amendment
(see Escalation condition above). Discovery and review keep their own owners.

```text
transform helper + its unit test — executor: scope and check are settled
shared policy wording and integration — main: the judgment is the deliverable
one-line typo in a file already open — main: packaging costs more than the edit
```
```

검증: `rg -n 'Implementation ownership' plugins/codexclaw/skills/pabcd/references/plan-output.md`.
중첩 코드펜스이므로 삽입 후 파일을 실제로 열어 펜스가 깨지지 않았는지 확인한다.

## Change 3 — `plugins/codexclaw/skills/pabcd/SKILL.md`

Anchor: 83행 B 항목의 마지막 문장
("When P declared a stack, follow `DEV-STACK-02` in `cxc-dev` `references/stacked-prs.md`.")
뒤에 한 문장을 같은 줄에 이어 붙인다.

AFTER (해당 줄의 꼬리):

```text
... When P declared a stack, follow `DEV-STACK-02` in `cxc-dev` `references/stacked-prs.md`. Execute the plan's recorded implementation ownership — specified slices go to the configured executor and main verifies the returned diff (`cxc-dev` Implementation delegation); a slice the plan did not assign needs a P amendment, not a mid-B improvisation.
```

## Change 4 — `structure/20_pabcd_dispatch_doctrine.md`

Anchor: DISPATCH-ECONOMY-01 본문에서 탐색 소유권을 dev로 넘기는 문장(현재 200-203행)
바로 뒤에 구현 담당 소유자 포인터를 추가한다.

BEFORE:

```text
  For authorized source/log investigation, [dev's Discovery delegation](../plugins/codexclaw/skills/dev/SKILL.md#discovery-delegation)
  owns the early ownership decision, concrete local exceptions and reconsideration
  after scope growth or truncation. Parallelism alone does not reduce returned context;
  this guidance adds no runtime enforcement or mandatory spawn count.
```

AFTER:

```text
  For authorized source/log investigation, [dev's Discovery delegation](../plugins/codexclaw/skills/dev/SKILL.md#discovery-delegation)
  owns the early ownership decision, concrete local exceptions and reconsideration
  after scope growth or truncation. For implementation, [dev's Implementation delegation](../plugins/codexclaw/skills/dev/SKILL.md#implementation-delegation)
  owns the same decision: a specified slice defaults to the configured executor, and
  the P plan records the owner that B then executes. Parallelism alone does not
  reduce returned context; this guidance adds no runtime enforcement or mandatory spawn count.
```

줄바꿈 주의: `rg`는 줄 단위로 매치하므로 "Implementation delegation"을 줄 경계로 쪼개면
아래 accept criteria가 빈 결과(exit 1)를 낸다. 링크 라벨을 한 줄에 유지한다.


## Change 5 — `structure/INDEX.md` (conditional)

INDEX가 규칙 ID나 스킬 절 목록을 실제로 들고 있으면 같은 변경을 반영한다.
들고 있지 않으면(현재 확인된 범위에서는 파일 단위 맵만 존재) 이 문서에
`N/A + 이유`로 기록하고 파일은 수정하지 않는다. 추측으로 항목을 만들지 않는다.

## Accept criteria (wp2)

- `rg -n 'Implementation delegation' plugins/codexclaw/skills/dev/SKILL.md` 히트.
- `rg -n 'Implementation ownership' plugins/codexclaw/skills/pabcd/references/plan-output.md` 히트.
- `rg -n "recorded implementation ownership" plugins/codexclaw/skills/pabcd/SKILL.md` 히트.
- `rg -n 'Implementation delegation' structure/20_pabcd_dispatch_doctrine.md` 히트
  (고정 문자열, 한 줄 안에 있어야 함).
- `npm test`가 이 단계에서도 통과(문서 변경이 manifest/skill 테스트를 깨지 않음).

## Out of scope (wp2)

전역 AGENTS.md, `agents/*.toml`, delegation.md의 전송 규약, 코드 변경.
