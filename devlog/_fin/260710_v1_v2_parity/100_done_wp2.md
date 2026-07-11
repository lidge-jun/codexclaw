# 100 — WP2 D 마감 (terminal outcome: DONE)

## 배송물

1. **hook trust-drift 검사 + 재신뢰** (cxc-ops):
   - `src/hook-trust.ts` — 업스트림 identity 해시 포트(이벤트별 matcher 필터,
     async/비-command/빈 command/불량 정규식 스킵 패리티, 비-Windows 전용),
     멀티라인 TOML 문자열 인지 라인 스캐너(중독 방어), 설치 키 자동 선택
     (정확히 1개, 모호 시 fail-closed + --key), retrust(타임스탬프 백업 +
     symlink-보존 tmp+rename 원자 쓰기 + 안전핀 + `codex features list` 사후
     검증 + 실패 롤백).
   - doctor에 hook-trust 검사 통합, `cxc hooks retrust` CLI verb.
2. **네이티브 V2 스킬 어포던스** (subagent-config): V2-shape 스폰에서 인라인이
   무산출일 때(암호문 포함) `[CXC-SKILL-AFFORDANCE]` 평문 자가-로드 블록 부착.
   마커 검사를 닫힌 skill 블록 제외 스캔으로 정밀화(독트린의 마커 인용이
   dedupe를 오염시키던 실버그 수리).
3. 독트린/문서: trust-drift 규칙("훅 JSON 수정 후 cxc doctor → drift 시
   cxc hooks retrust") + 어포던스 채널 반영 (Harvey, 증거 수록).

## 게이트

- A-gate: Dewey(sol/medium) 3라운드 — r1 FAIL(3H) → r2 FAIL(1H: matcher
  이벤트 필터) → r3 GO-WITH-FIXES(0). 합성 095.
- C-gate: Hubble(sol/medium) r1 FAIL(2H: TOML 문자열 중독 실증, symlink 파괴
  실증 + Med 3) → 수리(Laplace 부분 + 메인 마감) → Feynman(opus/medium,
  sol 사용량 한도로 대체) r2 PASS — 5개 closure 전부 코드 검증, 53/53.
  합성 097.
- 스위트 1097/1098(선행 실패 1건만), gate OK, dist 리빌드.

## 라이브 증거

- doctor가 실제 drift를 탐지 (subagent-stop 오탐 → matcher 필터 수리 →
  PASS; 이후 의도적 mutate → FAIL → retrust → PASS → 스냅샷 복원 → PASS).
- 네이티브 sol V2 자식 수신문 바이트 덤프: guard + `[CXC-SKILL-AFFORDANCE]`
  블록(절대경로 템플릿 포함) 동시 확인.

## 비관적 마감 (LOOP-PESSIMIST-01)

- C-gate 리뷰어의 프로브가 잡은 2건(HIGH)은 유닛 테스트가 못 잡던 실결함 —
  fixture 다양성(멀티라인 문자열, symlink)이 설계 단계에서 빠져 있었다.
- 남은 알려진 것: CRLF 멀티라인 테스트 공백(코드 정상, Low), `codex features
  list` 검증이 codex 바이너리 신뢰에 의존(설계상 수용, Low), doctor의
  선행 skills FAIL(사문 스킬 스텁 — 별도 정리 후보), sol 사용량 한도로
  마지막 리뷰어만 opus로 대체(사용자 명시 sol/medium 이탈은 이 1회, 사유
  기록).
