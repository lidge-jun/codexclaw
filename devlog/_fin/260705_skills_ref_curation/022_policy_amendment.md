# 022 — Policy Amendment (user 지시 반영)

- Date: 2026-07-05
- Amends: 020 drop 기준, 021 도입 범위

---

## Amendment 1: "Claude CLI 참조 = 드랍 사유" 폐기

`claude -p` 등 CLI 경로 참조는 드랍 사유가 아니다. 어댑터 프리앰블/import 시
`codex exec` 등가 명령으로 치환 명시하면 됨.

- 구분 기준 재정의:
  - **치환 keep**: 스킬의 본질 가치가 방법론/워크플로우이고 claude CLI는 실행
    수단일 뿐인 것 → import 시 `codex exec` 치환 주석. (예: autonomous-loops의
    루프 패턴 자체는 유효)
  - **드랍**: 스킬의 존재 이유 자체가 Claude CLI/Claude API 래핑인 것
    (예: claude-api — Codex 환경에서 무의미). active가 아니면서 순수 래퍼인 것만.
- 실측: claude 참조 밀집 스킬은 3개뿐 (autonomous-loops 47회, claude-api 19회,
  plankton-code-quality 4회) → 치환 비용 미미.

## Amendment 2: active 33종 절대 보존 (재확인, 강등 불가)

어떤 dedupe/드랍 판정도 active 세트를 건드릴 수 없음. 020의 드랍 후보 중 active와
겹치는 항목 없음 확인됨 (드랍 후보는 전부 dormant).

## Amendment 3: ClawHub 소스 지원 추가

재편을 "cli-jaw 스냅샷 1회성"이 아니라 **다중 소스 import 파이프라인**으로 확장:

- `cxc skill sync` 가 소스 어댑터를 가짐: `cli-jaw` (로컬 경로), `clawhub`
  (github.com/openclaw/clawhub 레지스트리, MIT), `hermes`
  (NousResearch/hermes-agent, MIT, 선별 목록 기반), `github` (임의 repo 경로).
- 각 어댑터는 소스별 metadata (openclaw.requires/install, hermes.toolsets)를
  codexclaw registry 공통 스키마로 정규화.
- ClawHub는 레지스트리 API/repo 구조가 안정되면 검색까지 연동 가능하나, 1차는
  "명시 스킬 id pull"만 (스코프 억제).

## Amendment 4: Hermes 선별 도입 확정

021 shortlist의 Hermes 4종 (gitnexus-explorer, oss-forensics, dspy, fastmcp)을
030 keep 목록에 포함. 도입 시 metadata.hermes 필드 정규화 + 어댑터 프리앰블.

## 030에 미치는 영향

- drop 목록에서 "Claude-specific" 사유 항목 재심사 (autonomous-loops는 치환 keep
  후보로 이동, claude-api는 순수 래퍼 드랍 유지).
- import 파이프라인 스펙(040)에 소스 어댑터 계층 추가.
