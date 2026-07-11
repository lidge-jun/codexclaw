# 090 — work-phase 2 계획: 훅 trust-drift 검사/재신뢰 + 네이티브 V2 스킬 어포던스

- Date: 2026-07-10 / Session: 019f4a07-70d9-7fc3-bdcb-9276fa5f2522
- Class: C2-C3 (컴포넌트 2개, 신규 CLI 표면 1개, config.toml 쓰기 — 후자는 C4성
  주의: 백업+정확 검증 필수)

## Loop-spec

- Archetype: spec-satisfaction repair. Trigger: 080_exec_smoke 후속 2건, 사용자
  "후속까지 완료해줘 (sol/medium 무제한)". Mode: HITL 체이닝(명시 위임).
- Goal: (1) 훅 파일 수정→trusted_hash 불일치→조용한 비활성화 사고를 `cxc doctor`
  가 탐지하고 `cxc hooks retrust`로 복구 가능하게; (2) 네이티브 V2(암호화)
  스폰에서도 자식이 $cxc-* 스킬을 스스로 로드할 수 있는 평문 어포던스 제공.
- Non-goals: codex-rs 수정, TUI hooks 브라우저 대체, 자식 SessionStart 신규 훅
  (어포던스는 기존 spawn 훅의 평문 prepend가 이미 실증된 채널이므로 그걸 사용),
  goal DB, @personal 잔존 항목 청소(무해).
- Verifier: 컴포넌트 테스트 + gate + 라이브 스모크 2건 (drift 탐지 재현,
  네이티브 V2 자식의 어포던스 수신).
- Stop: cr1-cr5 충족. Terminal: DONE | NEEDS_HUMAN(해시 알고리즘이 upstream과
  달라질 때). Escalation: config.toml 쓰기 실패/파손 → 즉시 백업 복원.

## Ground facts (이 세션 실측)

- 신뢰 해시 = identity(TOML: event_name label + matcher + normalized handler
  [type/command/timeout(기본600,min1)/async(기본false)/statusMessage(있을 때만)])
  → canonical JSON(키 정렬, 구분자 최소) → sha256. 파이썬 재현이 불변 훅 해시와
  일치 검증됨 (080).
- (A-r1/r2 정밀화) upstream 정규화 추가 분기: Windows에서는 commandWindows를
  command로 선택 후 `command_windows=None`으로 정규화 — 우리 포트는 **비-Windows
  (darwin+linux) 전용, Windows는 fail-closed** (단일 계약, r2 F3); `async: true`
  핸들러는 디스커버리가 스킵(해시 대상 아님); **matcher는 이벤트별 필터 적용
  후 해시** — Stop/UserPromptSubmit 등 matcher-무시 이벤트는 upstream이
  matcher를 None으로 매핑한 뒤 group.matcher를 덮어쓰고 직렬화하므로(r2 B1,
  common.rs:105, discovery.rs:451,576) 포트도 동일 필터를 구현하고 "matcher
  텍스트가 있는 Stop 훅" 골든 픽스처로 고정한다. matcher-존중 이벤트는 파일
  값 그대로. None 필드는 TOML 변환에서 드롭(null 아님). 키 형식(리뷰어 확증):
  `<plugin>@<marketplace>:hooks/<file>:<event_label>:<g>:<h>`, `./` 없음.
  재현 알고리즘은 현 codexclaw@codexclaw 14개 trusted_hash 전부와 일치.
- hooks.state 키 = `<plugin>@<marketplace>:hooks/<file>.json:<event_label>:<g>:<h>`.
  현 설치 키는 codexclaw@codexclaw (personal에서 개명).
- 네이티브 V2: 훅의 message는 암호문이지만 **평문 prepend는 자식에게 평문으로
  도달** (run P/T 바이트 증명). model/effort 필드도 평문.

## Scope boundary

IN: plugins/codexclaw/components/cxc-ops/{src,test,dist} (doctor + 신규
  hook-trust 모듈 + retrust verb), bin/codexclaw.mjs (verb 배선 + help),
  plugins/codexclaw/components/subagent-config/{src,test,dist} (어포던스 블록),
  plugins/codexclaw/test/hook-e2e.test.mjs (어포던스 e2e),
  skills/structure/docs-site의 관련 서술 갱신, 이 devlog 유닛.
OUT: codex-rs, ~/.codex/config.toml 직접 커밋(런타임 파일 — retrust가 쓰되
  테스트는 fixture로), gui, goal 로직.

## Accept criteria

- cr1 drift 탐지: `cxc doctor`가 설치 키 기준으로 각 훅의 current_hash vs
  trusted_hash를 비교해 불일치/미신뢰 훅을 FAIL(사유·경로 포함)로 보고 —
  fixture 테스트 + 라이브(훅 파일 임시 수정 후 doctor 재실행) 재현.
- cr2 재신뢰: `cxc hooks retrust`가 백업 생성 후 설치 키의 trusted_hash를
  재계산·기록하고, 재실행 doctor가 PASS — fixture + 라이브 검증. 알고리즘
  자기검증: 재계산 해시가 기존 일치 항목과 동일해야 실행(안전핀).
  (A-r1 B2) 쓰기 프로토콜: tmp 파일 + rename 원자 쓰기, 섹션 경계 정확 스캔
  (기존 키 교체 / 신설 append 두 경로 각각 테스트), 중복 헤더·해시 라인 거부,
  무관 바이트/enabled 보존 단언, 검증 실패 시 백업 자동 롤백, 사후 검증 =
  doctor 재실행 + `codex features list` 파스 성공.
  (A-r1 F5) 설치 키 계약: CODEX_HOME 존중; config의 enabled `[plugins."<name>@…"]`
  키가 정확히 1개일 때만 자동 선택, 0개/2개+면 fail-closed로 후보를 나열하고
  `--key <plugin@marketplace>` 명시 요구.
- cr3 어포던스: V2-shape 스폰에서 인라인이 아무 본문도 못 붙였을 때(암호문
  포함) `[CXC-SKILL-AFFORDANCE]` 평문 블록이 message에 부착 — 자식에게 "$cxc-*
  멘션을 보면 <skillsDir>/<folder>/SKILL.md를 읽어 로드하라" 지시. 마커 dedupe,
  플레인 v1 경로에는 미부착. 유닛 + e2e.
  (A-r1 F4, r2 정정) V2 exact-equal 단언(spawn-attach-hook.test.ts:401,468,476)
  만 갱신한다; **:567은 V1 스폰 핀이므로 그대로 보존** — "플레인 V1은 어포던스
  미부착" 계약의 커버리지다. 제로멘션 평문 V2에도 부착되는 것은 의도된 소액
  오버헤드로 기록. 추가 테스트: 제로멘션/기인라인/오버플로 상호작용/마커
  dedupe/guard-어포던스 순서 + V1 미부착.
- cr4 라이브: 네이티브 sol 세션 스폰 자식의 수신문 파일 덤프에 어포던스 블록
  바이트 확인. drift 왕복(수정→FAIL→retrust→PASS)의 **자동 검증은 fixture
  CODEX_HOME 전용**(실컨피그 불변); 실컨피그 최종 스모크는 훅 파일+config
  바이트 스냅샷 → finally 복원 → 복원 후 doctor PASS 증명까지 포함 (A-r1 B3).
- cr5 스위트/문서: 전체 테스트+gate 그린, dist 리빌드, "fork 상속에 의존" 서술을
  "어포던스 채널" 반영으로 갱신 (Bohr가 넣은 문구 11곳 + INDEX).

## Work-phase map

- S1 [worker A] cxc-ops: `src/hook-trust.ts` 신설 — identityHash(이 세션 검증
  알고리즘 포트, A-r1/r2 B1 분기 포함: async 스킵, 이벤트별 matcher 필터,
  비-Windows 전용 + Windows fail-closed),
  readInstalledPluginKey(enabled 키 정확히 1개 자동 선택, 모호 시 fail-closed
  + --key), listHookEntries
  (plugin.json→각 훅 JSON 파싱→키+해시), diagnose(현재 vs trusted), retrust
  (백업 `config.toml.bak-<ts>` → tmp+rename 원자 upsert → 실패 시 롤백;
  기존 personal 항목 불변).
  doctor.ts에 hook-trust 검사 추가, cli.ts에 `hooks retrust` verb,
  bin/codexclaw.mjs 배선+help. 테스트: fixture config/훅으로 해시 일치·drift·
  retrust 왕복·안전핀 + 골든 픽스처(기본/0 타임아웃, matcher 유/무, status
  유/무, async 스킵, 교체/신설 upsert, 중복 거부, 무관 바이트 보존).
- S2 [메인] subagent-config: `SKILL_AFFORDANCE_MARKER`/`SKILL_AFFORDANCE_BLOCK`
  (skillsDir 경로 템플릿 포함) — v2Spawn && 인라인 무변경 && 마커 부재 시
  message 말미 부착. 크기 가드 존중. 유닛 4종 + e2e 1종 + 기존 v2 테스트 갱신.
- S3 [worker B] 문서: Bohr 문구("fork 상속에 의존")를 어포던스 채널로 갱신
  (11곳 + INDEX + 60의 trust-drift 절 신설: 훅 수정 시 재신뢰 절차 `cxc hooks
  retrust`), agents/README 필요 시.
- S4 [메인] 검증: 스위트+gate+dist, 라이브 스모크 2건, devlog 100_done.

## 리스크

- R1 config.toml 파서 없이 문자열 upsert — TOML 라이브러리 금지(무의존 정책)
  이므로 섹션 단위 정규식 upsert + 사전 백업 + tmp/rename 원자 쓰기 + 사후
  검증(doctor 재실행 + `codex features list`) + 실패 롤백 (A-r1 B2).
- R2 해시 알고리즘 upstream 변경 추적 — 안전핀(기존 일치 항목 재검증)이 흡수,
  불일치 시 retrust 중단+NEEDS_HUMAN.
- R3 (A-r2 최종) 어포던스는 V2 exact-equal 핀 3곳(401/468/476)을 갱신하게
  만든다 — 별도 마커/블록으로 분리하되 해당 핀 갱신을 S2 작업 항목에 명시
  포함; V1 핀 :567은 보존.
