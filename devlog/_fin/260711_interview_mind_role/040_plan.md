# 040 — 플랜: interviewer 역할 옵트인 (cxc-interview Mind 디스패치의 역할화)

> **보류 (260711, 030 결정)** — 옵션 0(개념 레벨 개선)이 채택되어 이 플랜은
> 실행하지 않는다. C1(인터뷰 전용 노브) 또는 C4(effort 하드 강제)가 실제
> 요구로 승격될 때의 에스컬레이션 경로로만 보존. 근거: `020_rescan_spawnpath.md`.

- Date: 2026-07-11
- Work class: C3 (크로스 컴포넌트: subagent-config + pabcd-state + agents + CLI/MCP/GUI + 스킬 문서)
- 근거: `000_research.md` (file:line 증거는 그쪽 참조)

## Loop-spec

- **Archetype**: 단발 기능 유닛 (work-phase 4개, 각 1 PABCD 사이클)
- **Trigger**: 사용자 요청 — gjc식 per-role 모델/추론강도 고정을 인터뷰 Mind에 적용
- **Goal**: 옵트인 시 Mind 컨트래딕션 렌즈가 전용 `interviewer` 역할로 스폰되어
  **명시 지정된 reasoning effort**(+선택 모델)로 실행된다. 옵트아웃(기본)이면
  오늘과 바이트 동일한 동작.
- **Non-goals**: gjc식 프로파일 티어(eco/medium/pro) 시스템, Mind 프롬프트 5종의
  내용 변경(FROZEN), 골 방화벽/HITL 계약 변경, V1/V2 스폰 경로 자체의 수정.
- **Verifier**: `bun test` (subagent-config + pabcd-state) + `tsc` + directive
  스냅샷 테스트(옵트인 on/off/불완전 3상태).
- **Stop condition**: WP4 D-close (문서 동기화 포함) 또는 LOOP-REPAIR-01 (동일
  검증 실패 3라운드 시 P 회귀).
- **Memory artifact**: 본 devlog 폴더 (050 audit, 060 check, 070 done 예약).
- **Expected terminal outcomes**: done | blocked(스폰 훅 계약 충돌 발견 시).
- **Escalation**: spawn-attach의 역할 식별이 interviewer를 못 태우는 구조적 문제
  발견 시 → 사용자에게 V1/V2 parity 트랙과의 순서 조정 질의.

## 설계 결정

- **D1 — 역할 1개, 렌즈 5개.** 새 역할은 `interviewer` 하나. 5-Mind는 디스패치
  시 task 메시지에 실리는 렌즈 프롬프트(minds.ts `MIND_ROLE_PROMPTS`, FROZEN)로
  유지. `MIND_CONCURRENCY_CAP=3` 불변. (5개 역할화는 store/GUI 표면 5배 비용 대비
  효용 없음 — Mind는 프롬프트 차이일 뿐 모델/강도 요구가 동일.)
- **D2 — 활성화 술어 = "effort 명시" (요청의 '지정해야하도록').**
  옵트인은 두 조건이 모두 참일 때만 산다:
  1. `interview.mindDispatch === "role"` (신규 옵트인 키), 그리고
  2. `roles.interviewer.effort !== null` (EFFORTS 와이어 값 중 하나).
  effort가 null이면 옵트인은 **불활성(inert)** — directive는 인라인 폴백 +
  CLI `cxc subagents get interviewer`가 경고 표기. 모델은 mode="model"일 때만
  필수(기존 store 불변식 그대로) — 즉 "부모 모델 + 고정 effort"도 유효한 gjc식
  구성이다.
- **D3 — 컴포넌트 결합 회피: 훅은 store 파일을 직접 읽는다.** pabcd-state가
  subagent-config 패키지를 import하지 않고, `.codexclaw/subagents.json`을
  **파일 포맷 계약**으로 소비하는 최소 리더(활성화 술어 판정만)를 갖는다.
  strict-reconstruct 원칙 동일(깨진 JSON → 불활성, never throw).
  (대안: 패키지 import — audit에서 기존 크로스 import 전례가 발견되면 뒤집기.)
- **D4 — 프롬프트 캐논은 `agents/interviewer.toml`.** B-opt2 관례 그대로: toml이
  원본, 스폰 시 인라인 주입. 본문 = "read-only contradiction lens" 계약
  (JSON 배열만 반환, 질문/편집/유저호출 금지 = minds.ts SHARED_OUTPUT_CONTRACT와
  동일 문구 공유) + LEAF-TOPOLOGY-01 블록. `promptOverride`는 기존 역할과 동일
  의미로 동작.
- **D5 — agent_type은 `explorer`(read-only).** Mind는 렌즈다. 쓰기 없음.

## 파일 변경 지도 (diff-level)

### WP1 — 파운데이션: store 스키마 + 역할 정의 (의존 없음)

| 파일 | 변경 |
|---|---|
| `components/subagent-config/src/store.ts` | `ROLES`에 `"interviewer"` 추가(:15); `SubagentsConfig`에 `interview: { mindDispatch: "inline" \| "role" }` 섹션 + 기본 `"inline"`; `reconstructInterview()` strict 재구성; `isMindRoleDispatchActive(cfg)` 술어(D2) export |
| `agents/interviewer.toml` | 신규 — name/description/nickname_candidates/model="default" + developer_instructions(D4) |
| `components/subagent-config/test/store.test.ts` (계열) | 4역할 기본값, interview 섹션 재구성(누락/오타/불량 JSON → inline), 술어 진리표(4상태: off/on+effort/on-effort/broken) |

### WP2 — 스폰 경로 (WP1 소비)

| 파일 | 변경 |
|---|---|
| `components/subagent-config/src/spawn-wrapper.ts` | `ROLE_AGENT_TYPE.interviewer="explorer"`(:24); `ROLE_BASE_SKILLS.interviewer=[]`(:80 — 렌즈에 스킬 부착 없음, dev 라우터 불필요); `taskNameForRole` prefix `interviewer_`(:316); `resolveSpawnPayload(cwd,"interviewer",mindPrompt)` 경로 테스트 |
| `components/subagent-config/src/spawn-attach-hook.ts` | 변경 없음이 목표 — 역할별 model/effort 주입이 RoleName 유니온으로 제네릭한지 **검증만**; 하드코딩 발견 시 최소 수정 |
| 테스트 | S8/S10 패턴 연장: interviewer 스폰 페이로드에 configured model/effort가 non-full-fork에서 실리고 full-fork에서 안 실림 |

### WP3 — 훅 통합: directive 분기 (WP1+WP2 소비)

| 파일 | 변경 |
|---|---|
| `components/pabcd-state/src/minds.ts` | `buildMindRoleDispatchDirective(effort, model?)` 추가 — 기존 `MIND_DISPATCH_DIRECTIVE` 본문 + "각 Mind를 `interviewer` 역할로 스폰하라(agent_type explorer, task_name interviewer_*, fork_turns \"none\", 렌즈 프롬프트는 message에)" 지시. 기존 상수는 폴백으로 유지(FROZEN 본문 불변) |
| `components/pabcd-state/src/hook.ts` | `interviewDirective()` → `interviewDirective(cwd)`(:225); 호출부 3곳(:380,:440,:554)에서 cwd 전달; D3 최소 리더로 술어 판정 → 활성 시 role-dispatch directive, 아니면 현행 그대로 |
| 테스트 | directive 3상태 스냅샷; **골 방화벽 회귀**: goal-active면 옵트인과 무관하게 인터뷰 억제 유지(기존 테스트에 옵트인 on 픽스처 추가) |

### WP4 — 표면 + 문서 (WP1-3 소비)

| 파일 | 변경 |
|---|---|
| `components/subagent-config/src/cli.ts` | 역할 enum 자동 연동 확인(:28,:38,:43,:86); `cxc subagents set interviewer --effort ...`; effort 미지정 상태에서 `interview.mindDispatch=role`이면 경고 출력; 옵트인 토글 서브커맨드 (`cxc subagents interview role\|inline`) |
| `components/subagent-config/src/mcp.ts` | enum `[...ROLES]` 연동 확인(:46) + interview 토글 노출 |
| `gui/src/pages/Subagents.tsx` | 4번째 역할 카드 + 옵트인 토글(effort 미설정 시 토글 disabled + 사유 툴팁) |
| `agents/README.md` | 역할 표에 interviewer 행 + 옵트인/술어 문단 |
| `skills/interview/SKILL.md` | Runtime Status에 "Mind role dispatch (opt-in)" 문단: 술어, 폴백, 방화벽 불변 명시 |

## 스코프 경계

- **IN**: 위 파일 지도 전부, 각 WP의 테스트, SoT 문서 2건(README/SKILL.md).
- **OUT**: Mind 프롬프트 내용, `normalizeMindOutput` 검증 로직, 골/Stop/HITL 계약,
  V1/V2 페이로드 빌더 로직, 프로파일 티어, 글로벌 config, `.codexclaw/interviews/`
  캡처 포맷.

## 수용 기준 (활성화 시나리오 포함, C-ACTIVATION-GROUNDING-01)

1. **옵트인 활성**: `subagents.json`에 `interview.mindDispatch="role"` +
   `roles.interviewer.effort="low"` 픽스처 → `interviewDirective(cwd)` 출력에
   role-dispatch 블록 존재 + effort 문자열 포함. (트리거: 훅 유닛테스트 픽스처;
   관찰: directive 문자열 어서션)
2. **불완전 옵트인 폴백**: 동일 픽스처에서 effort=null → 출력이 현행
   `MIND_DISPATCH_DIRECTIVE` 경로와 동일 + 폴백 사유 한 줄. (트리거: effort 제거
   픽스처; 관찰: 스냅샷 diff)
3. **기본값 무변화**: `subagents.json` 부재/기존 3역할 파일 → directive 바이트
   동일(회귀 스냅샷). 기존 파일의 strict-reconstruct가 interviewer/interview
   섹션을 조용히 기본값 생성하되 디스크에 새 필드를 **쓰지 않는다**(읽기 경로
   무부작용). (트리거: 구버전 store 픽스처; 관찰: 스냅샷 + 파일 mtime/내용 불변)
4. **스폰 주입**: interviewer 스폰 페이로드(non-full-fork)에 configured
   model/effort 주입, full-fork면 거부 규칙 유지. (트리거: S8/S10 연장 테스트;
   관찰: 페이로드 어서션)
5. **방화벽 불변**: goal-active + 옵트인 on → 인터뷰 directive 자체가 억제.
   (트리거: goal 픽스처 + 옵트인 픽스처 동시; 관찰: 기존 방화벽 테스트 그린 유지)
6. **CLI 경고 활성화**: effort 미지정 + mindDispatch=role 상태에서
   `cxc subagents get interviewer` 실행 → 경고 라인. (트리거: CLI 통합 테스트;
   관찰: stdout 어서션)

## OPEN ASSUMPTIONS (인터뷰 미실시 항목 — 착수 전 이의 있으면 여기서 수정)

- **A1**: "gjc 정도로" = per-role model/effort 명시 고정 수준. 프로파일 티어는
  후속 유닛. (근거: 000 §gjc 레퍼런스)
- **A2**: "지정해야하도록"의 필수 대상은 **effort**. 모델은 mode="model"일 때만
  필수. 모델까지 무조건 필수면 D2 술어에 `mode==="model"` 조건 추가 — 1줄 변경.
- **A3**: 옵트인 단위는 프로젝트(`.codexclaw/subagents.json`), 세션/글로벌 아님.
- **A4**: Mind 5종 공유 역할 1개(D1). Mind별 차등 강도가 필요해지면 후속.
- **A5**: `../jawcode/devlog/gjc` 경로 자체(클론 코드)를 인터뷰 대상으로 삼는
  기능 요구는 아님 — 레퍼런스 지시로 해석.

## Audit 시드 (050에서 리뷰어가 때릴 곳)

- D3 최소 리더 vs 기존 크로스 컴포넌트 import 전례 — 실코드 확인.
- spawn-attach-hook의 역할 식별이 `taskNameForRole` prefix 기반인지 store 기반인지
  — interviewer가 공짜로 타는지 실검증 (WP2 "변경 없음" 주장의 근거).
- 수용 기준 3의 "바이트 동일" 주장 — directive에 phase footer 등 동적 요소가
  섞이면 스냅샷 전략 수정 필요.
- gui/dist, components/*/dist 리빌드 체크리스트 (기존 배포 관례 확인).
