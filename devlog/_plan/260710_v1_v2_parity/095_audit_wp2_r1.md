# 095 — WP2 A-gate r1 합성 (Dewey/gpt-5.6-sol, FAIL, blockers=3)

수용 5건 전부 계획 반영:

- B1 (HIGH) 해시 포트 미커버 분기 — upstream은 Windows에서 commandWindows를
  선택 후 command_windows=None으로 정규화, async:true 핸들러는 스킵,
  Stop/UserPromptSubmit의 matcher는 무시(discovery.rs:451,463; common.rs:105).
  → 포트에 반영 + 골든 픽스처(기본/0 타임아웃, matcher 유/무/무시 이벤트,
  status 유/무, async 스킵; Windows 분기는 darwin 전용 주석+미지원 명시).
- B2 (HIGH) config 쓰기 원자성/검증 — tmp+rename 원자 쓰기, 섹션 경계 정확
  스캔(교체 vs 신설 두 경로), 중복 헤더/해시 거부, 무관 바이트·enabled 보존,
  검증 실패 시 자동 롤백, 최종 검증은 doctor 재실행 + `codex features list`
  (호스트 TOML 파서 경유) 성공 확인.
- B3 (HIGH) 라이브 스모크 복원 프로토콜 — 자동 왕복은 fixture CODEX_HOME
  전용으로 격리; 실컨피그 최종 스모크는 훅 파일+config 바이트 스냅샷 →
  finally 복원 → 복원 후 doctor PASS 증명까지.
- F4 (MED) 어포던스가 기존 exact-equal 단언 3곳(401/468/476/567) 무효화 —
  R3 주장 철회, 해당 핀 명시적 갱신 + 제로멘션/기인라인/오버플로/dedupe/순서
  테스트 추가. 제로멘션 평문 V2에 어포던스 부착은 의도된 오버헤드로 기록.
- F5 (MED) 설치 키 계약 — CODEX_HOME 존중, enabled 플러그인 키 정확히 1개
  선택, 모호하면 fail-closed(+ --key 명시 옵션). 루트 tie-break 제거.
  키 형식 확정: `<plugin>@<marketplace>:hooks/<file>:<event>:<g>:<h>` (./ 없음).

리뷰어 확증: None 필드는 TOML 변환에서 드롭(null 아님), 재현 알고리즘이
현 14개 trusted_hash 전부와 일치, dev-symlink 무영향.
