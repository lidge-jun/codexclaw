# 150 — 채널 배달 (telegram / discord)

Status: TODO (후순위) · work-phase 150

상위: [090_expansion_moc.md](090_expansion_moc.md)

## 목표 (jun 확정)
telegram-send / discord 채널 연결 — 후순위(~150)로 배치. 스케줄 작업(040) 결과 배달과 연동
가능성 검토.

## 조사/설계 산출물 (채울 항목)
- cli-jaw telegram-send 스킬 구조 (Bot API / 로컬 API 폴백, 파일 타입 핸들링).
- codexclaw에서 채널 배달을 어떻게 노출할지 (CLI 커맨드 vs 스킬).
- Phase 3 스케줄 결과 배달(043)과의 연결 지점.
- discord degraded mode 주의사항 반영.
