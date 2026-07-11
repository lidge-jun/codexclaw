# 097 — WP2 C-gate r1 합성 (Hubble/gpt-5.6-sol, FAIL, High 2 + Med 3)

검증 통과 확인: pabcd 인용-마커 경로(인라인+dedupe+guard 1회), V1 제외,
크기 가드, CLI exit 코드, 14개 라이브 해시 전부, 문서 정합(수동 retrust).

수리 계획 (전부 수용, 워커 1기):

- B1 (HIGH) 멀티라인 TOML 문자열 내 헤더-형 라인이 스캐너에 섹션으로 오인 —
  안전핀 우회 + 거짓 신뢰 보고 실증됨. 수리: 라인 스캐너에 triple-quote
  (\"\"\"/''' ) 상태 추적 추가 — 문자열 내부에서는 헤더/키 인식 금지. 사후
  검증에 독립 채널 추가: `codex features list` 실행(exit 0) + 하드닝된
  스캐너 재확인. 롤백 경로 테스트 추가.
- B2 (HIGH) renameSync가 symlink config.toml을 실파일로 대체(dotfile 관리
  파괴, 실증) — 수리: lstat로 symlink 감지 시 realpathSync로 타깃 해석,
  tmp+rename을 타깃 디렉터리에서 수행(링크 정체성 보존). 백업도 타깃 기준.
  테스트: symlink fixture에서 링크 유지 + 타깃 갱신 확인.
- M3 discovery 스킵 패리티: type이 command가 아닌 핸들러(prompt/agent) 스킵,
  빈 command 스킵, matcher 정규식 컴파일 실패 시 해당 엔트리 스킵(전체 throw
  금지) — upstream discovery 동작 정렬.
- M4 SubagentStop+matcher 골든 핀: 실파일 subagent-stop-verifying-evidence.json
  vs 라이브 신뢰 해시 sha256:9afd7aecc... 단언 추가 (matcher-드롭 목록 회귀 방지).
- M5 섹션 헤더 트레일링 코멘트 허용 (`[plugins."x@y"] # comment`).
