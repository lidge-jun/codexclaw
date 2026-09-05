# Dev skill 배포용 정책 정합성 패치

기준 HEAD: `5ebcff6a2e00e82b2d50c405245d9ee342a477fd`.
세션: `01a0702d-41a2-7640-a78b-6e761b42e3ab`.
시작 상태: clean managed worktree, I. 사용자 “전부 패치가자 cxc-loop”로 실행 승인.
조사: `devlog/_fin/260905_dev_skill_audit/`. 인터뷰 증거는 이 세션의 answer ledger와 `.codexclaw/plan/dev-skill-interview.md`다.

## 승인한 정책

- C0은 devlog 생략. C1은 기존 owning unit에서만 짧게 기록한다.
- 안전·정확성·권한·진실한 검증은 필수. 길이·구조·스타일은 사유가 있으면 예외를 허용한다.
- 배포용 스킬이다. Aside 선호를 필수 의존성으로 만들지 않는다.
- agbrowse는 병렬 수집에 활용하되 권장 설치다. 없으면 실제 가용한 native 도구로 대체한다.
- 적합한 대체도 없으면 제한과 필요한 조치를 보고한다. 검증을 생략하고 성공으로 처리하지 않는다.

## Loop spec

| 항목 | 계약 |
|---|---|
| Class | C3 정책/문서, 보안 지침은 C4 수준 검토; 앱 runtime 변경 없음 |
| Archetype | spec-satisfaction repair |
| Goal | F01–F21의 확정 문제와 정책 경계를 일관된 배포용 스킬로 수정 |
| Non-goals | 캐시·개인 skill·계정·버전·provider 변경, 설치, push/merge/release/deploy |
| Verifier | exact-edit roadmap 재현, YAML parser, existing manifest-policy tests, 변경된 sync helper의 실제 fixture 실행, 독립 의미/시나리오 검토 |
| Stop | 모든 작업 단계 D 종료, 항목별 처분과 fresh evidence, clean local commits, goalplan validate |
| Memory | 이 unit + session-bound goalplan/ledger |
| Escalation | 새로운 외부 권한 필요 시 중단. 같은 packet 2명 실패 시 main이 회수. 범위 변경은 P에서 명시 |
| Resources | 120분, 동시 leaf 3명 이하, primary-source fetch 추가 15회 이하, 구매 없음 |
| Outcomes | DONE / 근거 있는 NOOP / 구체적 BLOCKED·UNSAFE·NEEDS_HUMAN·BUDGET_EXHAUSTED |

위험 제한: 안전 규칙을 스타일 예외로 낮추지 않는다. 이미지 취약점 gate의 기존 엄격함은 유지하고 일반 예외와의 우선순위만 명시한다. formal ASVS 준수 주장에는 공식 버전/ID/적용성/증거가 필요하다. 이번 로컬 문서 패치가 제품의 ASVS 인증이라는 주장을 하지 않는다.

## 단계 지도

| Work phase | 의존 | 산출물 |
|---|---|---|
| wp0 | — | 이 계획, 모든 후속 exact before/after, 독립 A 감사; docs-only |
| wp1 | wp0 | `010_common_policy.md`: dev 공통 권한/기록/스타일, shared browser routing, search/testing/workflow/SoT 포인터 |
| wp2 | wp1 | `020_domain_contracts.md`: architecture/backend/data/debug/review/devops/security/FE/UX/scaffolding의 소비 규칙 |
| wp3 | wp2 | `030_diagram_delivery.md`: 현재 visualize 위임, portable capability 설명, inspection helper와 focused tests, 통합 완료 |

한 work-phase는 한 P→A→B→C→D다. 지금 wp0에서 실제 skill/helper/test 파일은 수정하지 않는다. 각 후속 P에서 pre-written diff를 현재 tree와 다시 대조한다. 전체 계획은 `001_patch_operations.json`에도 exact replacement 순서로 기록했으며 실제 적용은 apply_patch로 한다.

```text
plugins/codexclaw/skills/
  dev/references/browser-routing.md   NEW canonical selection policy
  dev*/                              scoped router/reference patches
  pabcd/ search/ interview/           common policy consumers
  dev-diagram-viewer/upstream/        optional inspection helper
plugins/codexclaw/test/
  visualize-inspection.test.mjs       NEW isolated executable fixture checks
structure/                           existing SoT sync
devlog/_plan/260905_dev_skill_refresh/
  000_plan.md, 001_patch_operations.json
  010_common_policy.md, 020_domain_contracts.md, 030_diagram_delivery.md
```

개인 `agbrowse-browser`와 설치된 codexclaw cache는 수정하지 않는다. 배포 문서는 개인 skill 존재나 private absolute path를 전제하지 않는다. 역사적 audit와 그 hash 검사기를 고쳐 과거 증거를 새 코드에 맞추지 않는다.

## 검증 선행 실행

- Node exact replacement 재현: JSON의 before를 현재 source에서 찾고 각 after를 메모리에서 순차 적용. 91 edits / 30 files / 후속 phase docs 3개 확인, exit 0. 직접 인자는 이 unit이다.
- `node --test plugins/codexclaw/test/manifest-policy.test.mjs`: baseline 6/6 PASS, exit 0. skill metadata와 manifest를 실제 읽지만 정책 의미는 검증하지 않는다.
- Ruby YAML 파싱: `ruby -ryaml -e 'ARGV.each { |p| x=YAML.safe_load(File.read(p).split(/^---\s*$/)[1]); abort(p) unless x["name"].is_a?(String) && x["description"].is_a?(String) }; puts "YAML PASS: #{ARGV.size} skills"' plugins/codexclaw/skills/dev*/SKILL.md` → 13개 PASS, exit 0.
- skill-creator quick_validate.py는 PyYAML이 없어 실행 실패. dependency를 설치하지 않고 기존 Ruby YAML과 repo metadata 검사를 사용한다.
- 새 visualize-inspection test는 아직 구현 전이다. wp3에서 명시 root, 비어 있는 cache, 실제 version 선택, hash drift, malformed tracker를 임시 fixture에서 실행한다. Windows native 실행은 수행하지 않으며 Bash가 없으면 지원 증거로 세지 않는다.
- 의미 검증은 독립 reviewer가 입력 시나리오에서 실제 선택을 도출해 확인한다. prose 문구 존재를 assert하는 테스트는 만들지 않는다.

## 항목별 목표 처분

| Finding | 단계 | 목표 |
|---|---|---|
| F01 | wp1 | 공통 C0/C1 예외와 PABCD/scaffold 소비 규칙 통일 |
| F02 | wp1 | optional capability 기반 browser owner 하나, built UI agbrowse 금지 제거 |
| F03 | wp3 | frozen visualize contract를 현재 exposed skill 위임으로 교체 |
| F04 | wp2 | ASVS 장 번호·자체 checklist·formal conformance 구분 |
| F05 | wp2 | React fixed icon pair 제거, Design Read 소비 |
| F06 | wp2 | simple에 대한 반대 density 산술 제거 |
| F07 | wp1/wp2 | 길이만으로 blocker 승격 금지 |
| F08 | wp1 | OLTP와 analytical data routing 분리 |
| F09 | wp2 | 범위에 맞는 검증, 추가 발견과 추가 수정 권한 분리 |
| F10 | wp2 | docs scaffold에 설치·빌드 요구하지 않음 |
| F11 | wp2 | 배포되지 않는 goalplan 참조를 shipped design reference로 대체 |
| F12 | wp2 | 입력 shape parsing과 domain invariant 구분 |
| F13 | wp2 | existing/protocol envelope·error 예외 소비 |
| F14 | wp1 | ESM 선호와 runtime/bundler 기술 사실 분리 |
| F15 | wp2 | EXPLAIN ANALYZE의 실행 부작용·권한·격리 명시 |
| F16 | wp2 | 승인된 incident mitigation과 permanent fix RCA 분리 |
| F17 | wp3 | primary interaction을 실제 검증 |
| F18 | wp2 | Compiler 활성화와 profiler 확인 뒤 memo 판단 |
| F19 | wp2 | stricter image policy 유지, 외부 설정/automation 권한 분리 |
| F20 | wp2 | importable Python package 명명 분리 |
| F21 | wp1/wp3 | 실제 schema/renderer 확인, unsupported fields 미사용 |

부가 수정: Rust module와 Cargo graph를 혼동한 단정, 근거 없는 5–10배 성능 수치, 연결 수/queue 5초를 보편 기준으로 쓴 문구는 조건을 명시한다. OTel status와 Gateway API 공식 권고처럼 반증에서 유지된 정보는 바꾸지 않는다. 모든 147개 reference 예제를 최신 버전으로 실행했다는 주장도 하지 않는다.

## 강제성·우회 기록

E7 agent guidance다. 실행 표면은 skill을 읽은 에이전트이며, 지침을 읽지 않거나 상위 지시가 다른 경우 prose만으로 강제할 수 없다. 최종 자동 enforcement layer는 없음. runtime hook/goal DB를 변경하지 않는다. 자동 검사는 metadata/파일과 helper 결과만 증명한다.

추가 env `CXC_VISUALIZE_ROOT`: creation=caller env, serialization=process environment, read=sync-check.sh root selection, consumer=cache glob/version/hash inspection and fixture test. 기본값은 CODEX_HOME 또는 HOME의 cache이며 override/default/fallback은 서로 다른 fixture 값으로 검증한다. 이 값은 권한 상승이나 설치를 수행하지 않는다.

## 종료

wp0/1/2/3 네 사이클을 각각 D로 닫았다. 최종 scope는 감사 보완을 포함한 109 edits / 33 source-helper-test 파일이다. F01–F21 처분은 005, 검증과 한계는 006, 실제 C receipt는 034에 있다. source 패치 DONE이며 설치본 배포는 수행하지 않았다. 이 unit은 `_fin/260905_dev_skill_refresh/`로 보관한다.
