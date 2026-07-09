# 040 — Search Tooling Spec: `cxc skill search` (WP3 P-phase)

- Date: 2026-07-05
- 전제 (023): 원격 검색 일원화. 로컬 vendoring 없음. 상시 토큰 0 (CLI만).
- Ground truth: github.com/lidge-jun/cli-jaw-skills (WP2에서 정비/푸시 완료 —
  entry paths, superseded_by, 정규화된 requires, 비잘림 설명).

---

## CLI 표면

```
cxc skill search <query...> [--source jaw|clawhub|hermes|gh|all] [--limit N] [--json]
cxc skill show <id> [--source jaw|clawhub|hermes]   # raw SKILL.md 본문 출력 (프리앰블 부착)
```

- `search` 기본 source는 `jaw` (1차 소스). `all`은 jaw+clawhub+hermes 순차.
  `gh`는 명시 요청시에만 (rate limit).
- `show`는 매칭 스킬의 raw SKILL.md를 fetch해 stdout으로 — 에이전트가 바로 로드.

## 컴포넌트 배치

`components/skill-search/` 신규 (zero-dep, node:* only — 기존 컴포넌트 패턴 준수):

- `src/cli.ts` — argv 파싱, 커맨드 라우팅
- `src/sources.ts` — 소스 어댑터 (fetch URL 구성 + 응답 정규화)
- `src/scoring.ts` — 순수 키워드 스코어러
- `src/cache.ts` — `$CODEXCLAW_HOME ?? ~/.codexclaw` 아래 `skill-cache/` TTL 캐시
  (recall index-db.ts와 동일 규약; 삭제 가능한 derived cache로 문서화)
- `test/*.test.ts` — node:test, 네트워크는 fixture 주입 (fetch 함수 주입식)
- 배선 (audit 확정): `scripts/build.mjs` COMPONENTS 배열에 `skill-search` 추가;
  `bin/codexclaw.mjs` 스위치에 `case "skill"` + skillSearchCli 경로 추가
  (`cxc`는 package.json bin alias — /opt/homebrew symlink라 재설치 불필요);
  루트 package.json `test` 스크립트에 신규 테스트 글롭 추가;
  컴포넌트 package.json (`scripts.test = "node --test"`) 생성.

## 소스 어댑터

| source | fetch | 검색 대상 |
|--------|-------|-----------|
| jaw | `raw.githubusercontent.com/lidge-jun/cli-jaw-skills/main/registry.json` | name/desc/desc_ko/category/keywords |
| hermes | raw `NousResearch/hermes-agent/main/website/docs/reference/skills-catalog.md` (이름/설명/경로 카탈로그, rate-limit 없음) → show 시 raw SKILL.md URL 구성. tree API는 fallback | 카탈로그 이름/설명 |
| clawhub | (WP4 개정) `clawhub.ai/api/v1/search?q=` 마켓플레이스 API (무인증, slug/displayName/summary), body는 `/api/v1/packages/<slug>/file?path=SKILL.md`. 쿼리-시점 검색이라 캐시 없음, 서버 랭킹 신뢰, slug dedupe | 마켓플레이스 전체 (repo 13개 아닌 수천 스킬) |
| gh | `gh search code "filename:SKILL.md <query>"` (gh CLI 있을 때만) | GitHub 전역 |

정규화 결과 행: `{id, source, description, rawUrl, superseded_by?, status?, requires?}`

## 스코어링 (의도적으로 단순)

- 토큰화한 쿼리 각 단어에 대해: id 정확일치 +10, id 부분일치 +5, name +4,
  description +2, category/keywords +3. 한국어 쿼리는 desc_ko 대상 동일 가중.
- `superseded_by` 있으면 점수 x0.5 + 출력에 `→ use <target> (active)` 표시.
- `status: claude-specific` 점수 x0.5 + 표기.
- BM25/인덱스 없음 — registry 231행 선형 스캔이면 충분.

## 캐시

- `~/.codexclaw/skill-cache/<source>.json`, TTL 1h (mtime 비교).
- `--refresh` 플래그로 강제 갱신. 네트워크 실패 시 stale 캐시 fallback +
  경고 한 줄 (fail-open).

## 어댑터 프리앰블 (022 확정)

`show` 출력 머리에 고정 프리앰블:

```
[codexclaw external skill adapter]
- This is an EXTERNAL skill. codexclaw dev discipline (cxc-dev) always wins on conflict.
- Substitute Claude-specific tools with Codex equivalents:
  claude -p / claude CLI -> codex exec; Read/Grep/Glob tools -> shell (cat/rg/fd).
- Resolve path placeholders ({baseDir}, $CODEX_HOME/skills/...) against the skill's
  raw URL directory, not the local filesystem.
- If the skill name collides with a codexclaw built-in (dev-*, search), the built-in
  is authoritative; use this document as supplementary reference only.
```

search 결과 꼬리에도 1줄 요약 프리앰블 포인터.

## 노출 경로 (skill-hub 연동)

- `skill-hub/SKILL.md`에 "Dormant/외부 스킬 검색은 `cxc skill search <query>`" 한 줄
  추가 (문서-only 헌장 유지: 러너는 CLI, 스킬은 포인터만).
- dev SKILL.md는 변경 없음 (스코프 억제; skill-hub가 라우터).

## 테스트 계획

- scoring: 단어 매칭/가중/강등 케이스 (순수함수)
- sources: fixture JSON으로 정규화 검증 (fetch 주입)
- cache: TTL 만료/stale fallback (tmpdir)
- cli: `search --json` end-to-end (fetch mock), `show` 프리앰블 부착 확인
- 라이브 스모크 1회: 실제 jaw 소스 fetch (CI 아닌 수동 C-phase 증거)

## Out of scope

- MCP tool 노출 (없음 — no-server/토큰-0 원칙)
- clawhub.ai 웹 API 연동 (repo tree로 시작, 레지스트리 API는 후속)
- 검색 결과 자동 로드 (에이전트가 show/URL fetch로 명시 로드)
