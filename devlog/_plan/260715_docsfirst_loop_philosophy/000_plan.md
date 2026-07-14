# 000 — Docs-First Multi-PABCD Loop Philosophy: 스킬군 전체 반영 계획

- Unit: `devlog/_plan/260715_docsfirst_loop_philosophy/`
- Session: `019f61d6-e726-7c72-b636-02a0581600ad`
- Goalplan: `.codexclaw/goalplans/codexclaw-multi-pabcd-docs-first-work-phase-work/`
- Class: C3 (스킬 계약 텍스트, 다중 파일, 코드 무변경)
- Date: 2026-07-15

## Objective

여러 번의 PABCD cycle이 필요한 루프에 대해 다음 철학을 codexclaw 스킬 계약으로 영구화한다:

1. **등록과 문서화는 동시 진입이다.** 멀티 work-phase 루프는 goalplan `workPhases[]` 등록과
   동시에 최초 work-phase를 **docs-only PABCD**로 돈다.
2. **최초 사이클의 산출물은 로드맵 자체다.** devlog 유닛에 `000-009` 조사 +
   `010/020/030...` decade별 diff-level 구현 문서(필요시 `021` 같은 세부 문서)를 전량 확정한다.
3. **구현은 그 다음 사이클부터다.** 이후 각 work-phase가 decade 하나씩을 구현 PABCD로 소화한다.
4. **loop는 pabcd 필독을 강제한다.** cxc-loop만 읽고 루프를 돌리는 것은 계약 위반이며,
   cxc-pabcd의 DIFFLEVEL-ROADMAP-01 / PHASE-SPLIT-01 / LEXICO-SPLIT-01 / UNIT-RESIDENCE-01 /
   one-work-phase-one-cycle 을 반드시 읽는다.

## Loop-spec header

- Loop archetype: spec-satisfaction (검증자 = rg 텍스트 존재 + yaml 파싱 + hooks diff 0 + 커밋).
- Trigger: 사용자 지시 (2026-07-15, "전체적 cxc의 스킬에 모두 이게 내 철학이라고 … 직접 패치해").
- Goal: 위 4개 철학이 스킬 텍스트에 반영되고 커밋됨.
- Non-goals: hooks(`plugins/codexclaw/hooks/*`, `src/hooks*`, `dist/*`) 변경, TS 코드 변경,
  기존 dirty 파일 정리, 단일-사이클 작업에 대한 문서 강제 확대.
- Verifier: `rg`로 신규 규칙 텍스트 확인, `uv run --with pyyaml`로 frontmatter 검증,
  `git diff --stat`으로 hooks 무변경 확인, `cxc loop validate`.
- Stop condition: 수용 기준 (a)-(f) 충족 (goal objective 참조).
- Memory artifact: 이 유닛 + goalplan ledger.
- Expected terminal outcome: DONE. Escalation: 스킬 규약 충돌 시 NEEDS_HUMAN.
- HOTL resource bounds: write scope = 이 유닛 + `plugins/codexclaw/skills/*/SKILL.md` +
  `structure/00_philosophy.md` + goalplan 파일. 예산: 이 세션 내 완결(사이클 3개), 외부 비용 없음.

## 사례 근거: codex-meetup-demo (사용자 지적)

`/Users/jun/Desktop/codex-meetup-demo/`는 이 철학이 없을 때의 실패 형태를 그대로 보여준다
(2026-07-15 확인):

- 산출물: `slides-ko.html`(866줄), `slides.html`, PDF 2종, 스크립트 5종.
- 계획 문서: `PABCD-PLAN-7-8-ALT-SCRIPTS.md`, `ALTERNATIVE-SCRIPTS-7-8.md`, `SCRIPT.md`,
  `SCRIPT-KO-12MIN.md`, `TALK-KO-12MIN.md`, `TALK-KO-15MIN.md` — 전부 bare 대문자 파일명.
- 진단: devlog 유닛 없음, 번호(decade) 체계 없음, 조사/구현 분리 없음, diff-level 로드맵 없음.
  PABCD를 표방한 파일명(`PABCD-PLAN-*`)조차 LEXICO-SPLIT-01 FAIL 형태다. 여러 번의 수정
  사이클(7-8차 대안 스크립트, 12분/15분 개정판)이 실제로 있었는데도 각 사이클이 문서 지도 없이
  파일 증식으로만 남았다 — "문서화 PABCD를 안 돈 멀티 사이클"의 전형.
- 교훈: 멀티 사이클이 **사후에 발견되는** 작업일수록 최초 docs-only 사이클이 필요하다.
  루프의 기억은 transcript가 아니라 디스크 문서다.

## 삽입점 인벤토리 (조사 결과, 2026-07-15)

| 파일 | 현재 상태 | 개입 |
|------|-----------|------|
| `plugins/codexclaw/skills/loop/SKILL.md` | Contract에 "overlay on pabcd" 한 줄뿐. docs-first 진입 계약 없음. pabcd 필독 포인터 없음 | **핵심**: LOOP-DOCS-FIRST-01 섹션 신설 (010) |
| `plugins/codexclaw/skills/pabcd/SKILL.md` | DIFFLEVEL-ROADMAP-01 존재, Phase-0은 "MAY" | MAY → 루프 문맥에선 DEFAULT로 승격 + loop 교차참조 (010) |
| `plugins/codexclaw/skills/dev/SKILL.md` | §0.4 Workflow Modes가 pabcd/loop 포인팅만 | 한 줄: 멀티 사이클 루프는 docs-first 진입 (020) |
| `plugins/codexclaw/skills/interview/SKILL.md` | 유닛 residence를 Interview가 정착 | 한 줄: 멀티 사이클 판명 시 첫 work-phase는 roadmap 사이클 (020) |
| `plugins/codexclaw/skills/goalplan/SKILL.md` | deprecated stub | 한 줄 포인터 (020) |
| `plugins/codexclaw/skills/dev-scaffolding/SKILL.md` | Phase docs 표에 LEXICO-SPLIT-01만 | 한 줄: 멀티 사이클 유닛의 decade 문서는 WP0에서 전량 생성 (020) |
| `structure/00_philosophy.md` | §6 Evidence-first에 docs-first loop 항목 없음 | §6에 철학 bullet 추가 (020) |
| hooks (`plugins/codexclaw/hooks/*`) | — | **불변** (사용자 지시) |

"전체적 스킬에 모두" 해석: 모든 `dev-*` 스킬에 중복 서술하면 SSOT가 깨진다. 항상-on인
`dev` 라우터 + 진입 계약 소유자인 `loop` + 형식 소유자인 `pabcd` + 문서 정착 지점인
`interview`/`dev-scaffolding` + 철학 문서(`structure/00_philosophy.md`)를 커버하면 라우팅
그래프상 전 스킬이 이 철학을 경유한다. (근거: dev §Companion Skills의 DEV-ROUTE-01,
dev §0.4가 pabcd/loop를 canonical로 지정.)

## Work-phase map (dependency-ordered)

| WP | decade doc | 내용 | 의존 |
|----|-----------|------|------|
| WP0 (this) | 000 | 조사 + 로드맵 lock + goalplan 정밀화 | — |
| WP1 | `010_wp1_loop_pabcd_core.md` | loop + pabcd 코어 패치 | WP0 lock |
| WP2 | `020_wp2_periphery_philosophy.md` | dev/interview/goalplan/dev-scaffolding/philosophy 패치 + 검증 + 커밋 | WP1 텍스트가 SSOT이므로 그 뒤 |

수용 기준은 goal objective (a)-(f)와 goalplan `criteria[]` c1-c5에 1:1로 기록됨.

## Activation scenarios (C-ACTIVATION-GROUNDING-01)

- 신설 규칙 텍스트는 조건부 코드가 아니라 계약 문서다. 활성화 검증 = (1) rg로 규칙 ID와
  포인터 대상 규칙 ID가 실제 파일에 존재, (2) 교차참조가 가리키는 섹션/규칙명이 실존
  (사양 드리프트 없음), (3) frontmatter 파싱 통과.
