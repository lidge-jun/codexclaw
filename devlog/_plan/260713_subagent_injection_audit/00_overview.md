# 260713 — 서브에이전트 기본 지침 주입 감사 + v1 leaf guard 검토

날짜: 2026-07-13
세션: 019f5aef-1afc-7141-88ab-0ebb635919ce
방법: SOL 병렬 파견 (Chandrasekhar: 주입 경로 추적, Tesla: v1 leaf 분석)

---

## 배경

사용자가 opencodex 서브에이전트 작업 결과를 첨부하면서, 서브에이전트에 기본 지침
(cxc-dev discipline 등)이 제대로 주입되지 않는 문제가 발생한다고 보고했다.
동시에 v1에서 LEAF_GUARD_BLOCK이 불필요하지 않은지 검토 요청.

## 1. 주입 경로별 판정

| 경로 | 판정 | 핵심 근거 |
|------|------|-----------|
| v1 `skill://` 링크 | ✅ WORKING | upstream `injection.rs`가 링크를 파싱해서 실제 SKILL.md를 child에게 주입 |
| v2 plaintext inline | ✅ WORKING | hook이 `<skill>` 블록으로 본문 직접 첨부. 단 256 KiB atomic cap 초과 시 전부 누락 |
| v2 ciphertext affordance | ⚠️ PARTIAL | affordance 바이트는 child에게 도달 확인됨. child가 실제로 self-load했는지 행동 검증 없음 |
| `subagents.json` model/effort | ✅ WORKING | hook에서 `resolveSpawnConfig()` → model/effort 주입 정상 |
| **`promptOverride`** | ❌ **BROKEN** | store에 저장/resolve되지만 native spawn hook에서 전혀 소비되지 않음 |
| hook 등록 | ✅ WORKING | manifest + matcher 정상. 단 hook trust drift 시 조용히 비활성화 가능 |

### promptOverride 결함 상세

`store.ts`의 `resolveSpawnConfig()`는 `promptOverride`를 정상 반환한다:

```
store.ts:180  →  promptOverride: cfg.promptOverride
```

그런데 `spawn-attach-hook.ts`의 `runSpawnAttachHook()`은 resolution에서
`model`과 `effort`만 읽고 `promptOverride`는 아예 참조하지 않는다.

`promptOverride`가 실제 소비되는 곳은 별도 `spawn-wrapper.ts:378`뿐인데,
이건 codexclaw wrapper를 거쳐 payload를 만들 때만 동작한다. 모델이 native
`spawn_agent`를 직접 호출하면 PreToolUse hook만 거치므로 promptOverride가
적용되지 않는다.

**경로 분기:**
- codexclaw wrapper → `spawn-wrapper.ts` → promptOverride 적용 ✅
- 모델 직접 spawn_agent 호출 → PreToolUse hook → promptOverride 미적용 ❌

대부분의 실제 서브에이전트 파견은 모델이 직접 spawn_agent를 호출하는 경로이므로,
이것이 "기본 지침 주입이 안 됨"의 주요 원인이다.

### v2 ciphertext affordance 약점

native ChatGPT 백엔드 V2 세션에서:
1. hook이 message를 ciphertext로 수신 → normalization/inlining은 no-op
2. leaf guard는 plaintext로 prepend되어 child에게 도달
3. affordance 블록도 plaintext로 append되어 child에게 도달
4. **그러나** child가 affordance를 해석해서 SKILL.md를 파일로 읽었다는 행동 증거 없음

affordance는 강제 injection이 아니라 "직접 읽으라"는 텍스트 요청이다.
모델이 무시하면 skill discipline이 적용되지 않는다.

## 2. v1 leaf guard 검토

### 판정: v1에서 leaf 제거

**v1 서브에이전트는 애초에 재귀 spawn이 불가능하다.** native `agents.max_depth`
(기본 1)이 depth 2 이상을 거부하고, D1 hook deny도 child의 spawn_agent를 거절한다.
"LEAF agent니까 spawn하지 마"라는 텍스트는 물리적으로 불가능한 것을 다시 말하는
순수한 토큰 낭비다. "leaf"라는 개념 자체가 v1에서는 의미가 없다.

LEAF_GUARD_BLOCK의 제약 (2) "cxc orchestrate/loop/goal 금지"와 (3) "write scope
준수"는 유효하지만, 이건 "leaf topology"와 무관한 FSM 소유권 선언과 scope 제한이다.
leaf를 빼고 이것만 짧게 남기면 된다.

### 토큰 비용

현재 LEAF_GUARD_BLOCK: 737 bytes, ~160-200 tokens, 11 lines. spawn 관련 문구가
대부분(8줄)을 차지한다. v1에서는 FSM/scope 선언만 남기면 ~40 tokens.

### 실제 위반 증거

D2가 v1에서 실제 FSM 침범이나 scope 위반을 잡은 기록된 사건은 없다.
v1 D2는 260710 parity 작업에서 "대칭성 요구"로 도입된 것이지 회귀 수정이 아니었다.

### 제거 시 리스크

- `cxc orchestrate` 호출 → FSM state 오염: 의미 있는 리스크. D1 미커버.
- scope 외 파일 쓰기: 의미 있는 리스크. native sandbox는 workspace 단위라
  dispatcher의 파일 소유권 범위를 강제하지 않음.
- spawn 관련: 리스크 없음. 아키텍처 수준에서 이미 불가능.

### 권장안: v1에서 leaf 제거, FSM/scope 선언으로 교체

```
[CXC-SUBAGENT-SCOPE] This is one bounded delegated task. The parent
owns cxc orchestration, loop, and goal state; do not invoke those
commands. Stay within the stated file/write scope and report any
required expansion.
```

v2는 full LEAF_GUARD_BLOCK 유지 (v2는 native depth 제한이 없어서
proactive delegation 때문에 강한 문구가 더 가치 있음).

## 3. 발견 요약 — 우선순위 순

1. **promptOverride 미사용 (P0)**: native spawn hook에서 `resolution.promptOverride`를
   읽어서 message에 주입하는 로직 필요. model/effort와 동일한 패턴으로 구현 가능.

2. **v2 ciphertext self-load 미검증 (P1)**: affordance 전달은 확인됐지만 child
   행동 검증 없음. SubagentStop hook에서 skill-load 증거를 체크하거나,
   affordance를 더 강제적인 형태로 변환 필요.

3. **v1 leaf 제거 (P2)**: v1은 재귀 spawn이 아키텍처 수준에서 불가능하므로
   leaf 개념 자체가 불필요. LEAF_GUARD_BLOCK을 `[CXC-SUBAGENT-SCOPE]`
   FSM/scope 선언으로 교체. ~150 token 절약.

4. **hook trust drift (P3)**: hook 정의 변경 후 trusted hash 미갱신 시 조용히
   skip되는 문제. 기존 devlog 080에 기록된 known issue.

5. **256 KiB atomic overflow (P3)**: 일반적인 2-4개 skill 조합에서는 cap 이하이나,
   다수 surface skill 동시 부착 시 모든 body 누락. 현재 테스트 커버리지 있음.

## 4. 후속 작업

- [ ] P0: `spawn-attach-hook.ts`에 promptOverride 주입 로직 추가
- [ ] P1: v2 ciphertext child의 skill self-load 행동 검증 방법 설계
- [ ] P2: v1/v2 분기 guard 구현 (v1: FSM/scope 블록, v2: full leaf)
- [ ] v1 coordinator variant: 재귀 grant 자체가 무의미 (v1은 재귀 불가).
      coordinator도 FSM/scope 선언만 남기면 됨.

## 검증

SOL 서브에이전트가 fresh 테스트 실행: 82 passed, 0 failed (spawn-attach-hook
unit + e2e). codex-rs upstream 소스 (`injection.rs`, `turn.rs`, `spawn.rs`,
`multi_agents_v2.rs`) 직접 읽어서 경로 확인.

---

## 5. 구현 결과 (WP1 PABCD 사이클)

### 변경 파일

- `spawn-attach-hook.ts`: +118 -36 (3개 상수 추가, guard 선택 로직, promptOverride 주입)
- `spawn-attach-hook.test.ts`: +92 -7 (6개 기존 테스트 수정, 7개 신규 테스트)

### WP1: promptOverride 주입

- `resolveSpawnConfig()` 호출을 `isFullHistoryFork` 밖으로 이동
- `resolution.promptOverride`를 message에 prepend (guard 뒤, task 앞)
- full-history fork에서도 주입 (message 텍스트이므로 codex-rs 거부 대상 아님)
- A-gate 리뷰어 지적으로 수정: full-history fork 가드에서 분리

### WP2: v1 leaf 제거

- `V1_SCOPE_BLOCK` + `V1_SCOPE_BLOCK_COORDINATOR` 상수 추가
- `v2Spawn` 기반 guard 선택: v1→scope 블록, v2→full leaf
- surface-specific marker dedupe (cross-contamination 방지)
- A-gate 리뷰어 지적으로 수정: surface-specific dedupe, 기존 guard 뒤 삽입

### A-gate 감사 이력

- 초심사: FAIL (1 High + 2 Medium)
  - High: promptOverride가 full-history fork에서 누락
  - Medium: cross-surface marker가 guard를 억제
  - Medium: 기존 guard 앞에 promptOverride 배치
- 3개 수정 후 재심사: PASS

### 검증

- unit: 72 pass, 0 fail (134ms)
- e2e: 27 pass, 0 fail (3795ms)
- git diff: +176 -36 across 3 files
