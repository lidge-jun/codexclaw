# 080 — codex exec 라이브 스모크: 이월 2건 실측 + 중대 발견 2건

- Date: 2026-07-10 오후 / Session: 019f4a07-70d9-7fc3-bdcb-9276fa5f2522
- Method: `codex exec` 신규 세션 프로브 (run A~T), 자식 자기보고는 오염
  가능성이 확인돼 후반은 롤아웃 판독 + 바이트 덤프 + deny 이진 실험으로 전환.

## 발견 1 — 훅 신뢰 게이트 (운영 사고 + 복구)

- codex-rs는 훅 정의(event+matcher+command 정규화 TOML)의 sha256을
  `hooks.state.<key>.trusted_hash`로 고정하고, 불일치 시 그 훅만 **조용히
  스킵** (hooks/src/engine/discovery.rs:598, 경고 없음).
- 본 패치 커밋이 매처를 바꾸면서 해시가 어긋나 **신규 세션 전체에서 스폰 훅이
  꺼져 있었음** (run A~C: PreToolUse 이벤트 0). `-c bypass_hook_trust=true`는
  무효 키(CLI 플래그 `--dangerously-bypass-hook-trust` 전용 오버라이드).
- 판정 실험: deny 훅 + 플래그 → spawn이 `CXC-SMOKE-DENY-MARKER`로 차단되며
  훅 이름이 `collaborationspawn_agent`로 로그에 찍힘 (run M).
- 복구: 마켓플레이스가 personal→codexclaw로 개명돼 있어
  `codex plugin remove codexclaw@personal` + `add codexclaw@codexclaw` +
  dev-symlink 재적용. 재설치도 신뢰를 자동 기록하지 않아, 공식 해시 알고리즘
  (identity TOML→canonical JSON→sha256, config/src/fingerprint.rs)을 재현해
  검증(불변 훅 해시 일치 확인) 후 14개 훅의 trusted_hash를 config.toml에 삽입.
  백업: ~/.codex/config.toml.bak-260710-trust. 구 @personal 항목은 잔존(무해).
- run T (bypass 없음): `hook: PreToolUse` 발화 + 자식 파일 덤프에
  `[CXC-LEAF-GUARD]` 바이트 확인 → **신뢰 복구 + 네이티브 V2 매처/guard 검증 완료.**
- 교훈(후속 작업 후보): 훅 JSON을 수정/커밋할 때마다 재신뢰 필요 —
  `cxc doctor`에 trust drift 검사 + 재신뢰 헬퍼 추가할 것.

## 발견 2 — 네이티브 V2 spawn message는 훅에 암호문으로 도착

- run R 캡처: 훅 stdin의 `tool_input.message` = `gAAAAAB...` (백엔드 암호화).
  ChatGPT 백엔드가 sol/terra의 spawn 인자 `message`를 암호화해 내려보냄 —
  로컬 훅은 평문을 볼 수 없다.
- 파급: **멘션 정규화·SKILL.md 인라인은 네이티브 V2에서 원리적으로 불가**
  (인라인은 멘션을 못 찾아 안전한 no-op — 코드 수정 불요).
- 유효한 것(실증): guard 평문 prepend는 자식에게 평문으로 도달 (run P/T 바이트
  확인 — 자식 수신문 = guard 평문 + 복호화된 원문), `model`/`reasoning_effort`
  필드는 평문이라 주입 경로도 유효 (fork_turns 가드 동일).
- V2 스킬 전달의 실전 대안(후속 설계): 자식 세션에서도 도는 SessionStart/
  UserPromptSubmit 훅으로 스킬 어포던스를 자식에 주입 (자식 세션에서
  SessionStart 훅 발화는 실측 확인됨), 또는 fork 상속 경유.
- 비-네이티브 경로(암호화 없는 provider/프록시)에서는 인라인·정규화가 설계대로
  동작 (dist 직접 구동 + e2e로 증명).

## 스모크 결과표 (최종)

| 항목 | 판정 | 증거 |
|---|---|---|
| 매처 `collaborationspawn_agent` 발화 | PASS | run M deny 로그, run T PreToolUse |
| V1/V2 leaf guard 도달 | PASS | run P/T 자식 파일 덤프 바이트 |
| V2 model/effort 주입 합법성 | PASS(간접) | 필드 평문 + upstream 검증 소스 |
| V2 멘션 정규화/인라인 (네이티브) | **불가(암호화)** | run R 훅 stdin 캡처 |
| V2 멘션 정규화/인라인 (비암호화 경로) | PASS | dist 직구동 + e2e 82/82 |
| 훅 신뢰 복구 | PASS | run T (bypass 없음) |
