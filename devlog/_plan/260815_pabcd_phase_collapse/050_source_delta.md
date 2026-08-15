---
created: 2026-08-15
status: design
workPhase: wp4
tags: [codexclaw, source-identity, b-to-c]
---

# 050 — B>C 소스 델타 게이트

## 목적

B는 구현 위상이다. 구현했다면 소스가 변한다. B 진입 시점과 B>C 시점의
소스 정체성이 **동일하면** B에서 아무것도 구현하지 않은 것이다 —
000이 관측한 "P에서 다 하고 B는 도장만 찍기"가 여기서 걸린다.

## 기존 자산 재사용 (직접 만들지 않는다)

`source-identity.ts`의 `captureSourceIdentity(cwd)`를 쓴다. 이 모듈은
라운드 2에서 내가 만들려던 것을 이미, 더 낫게 구현해 놨다:

- `git status --porcelain=v1 -z --untracked-files=all` — uall이 없으면
  untracked 디렉터리가 한 줄로 접혀 내부 파일 변화를 놓친다.
  (내가 실험으로 재발견한 구멍을 주석이 이미 설명한다.)
- z 플래그로 공백/따옴표 포함 경로를 안전하게 파싱.
- dirty 파일의 **내용 해시**까지 계산 — RM 상태가 유지되는 후속 편집을 잡는다.
- HEAD SHA 포함.

비교는 `compareSource(a, b)`가 same / different / unavailable을 돌려준다.

## 변경

### `state.ts` — phaseEntrySource 필드

B 진입 시점의 SourceIdentity를 담는다. B가 아닌 위상에서는 null.
`readState()` 재구성은 기존 엄격 패턴을 따르고, 필드가 없으면 null이다
(레거시 상태 93개는 전부 이 경로로 들어온다).

### 캡처 시점

**B 진입 시에만** 찍는다. 매 전이마다 git을 부르지 않는다(감사 MINOR 2의 성능 지적).
측정값은 22ms로 B 진입 1회라면 무시할 수 있다.

- CLI: `orchestrate-cli.ts`의 A>B 성공 직후
- 채팅: `hook.ts`의 A>B 처리 직후

`applyHumanTransition()`은 cwd를 받지 않는 순수 helper이므로(감사 MAJOR 3),
캡처는 helper 내부가 아니라 **호출부**에서 한다. 이 결정을 여기 명시한다.

### 판정

B>C에서 스냅샷이 null이 아니면 현재 정체성과 비교한다.

| 비교 결과 | 동작 |
|-----------|------|
| different | 통과 |
| same | **거부** — B에서 소스가 전혀 변하지 않았다 |
| unavailable | 통과 (fail-open) |
| 스냅샷 null | 통과 (레거시/캡처 실패) |

## activation scenario

| 시나리오 | 트리거 | 관측 효과 |
|----------|--------|-----------|
| 빈 B 거부 | B 진입 후 아무것도 안 하고 C 시도 | 비영 exit, phase는 B 유지 |
| 정상 통과 | B에서 파일 수정 후 C | 통과 |
| 비git 무영향 | git 없는 디렉터리 | 통과 |

## 알려진 한계 (감사관 지적 그대로 수용)

- **커밋 우회**: P에서 만든 dirty 변경을 B 진입 직후 커밋하면 HEAD가 바뀌어 통과한다.
  스냅샷 비교는 **상태 변화**를 증명하지 **인과성**을 증명하지 못한다.
- **공유 워크트리 오귀속**: state는 세션 단위지만 git 트리는 저장소 전역이다.
  다른 세션이나 사용자의 변경이 이 세션의 구현으로 오인될 수 있다.
- **서브모듈**: superproject porcelain이 계속 같은 상태면 내부 변경을 놓친다.
- **비git**: 전체 fail-open.

이 한계를 알면서 넣는 이유는 **보조 신호**로 충분하기 때문이다.
주 방어선은 030(미완 사이클 차단)과 060(감사 실물 요구)이다.

