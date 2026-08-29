# 000 — request-user-input autopilot: Plan

## Objective

새 컴퓨터에 codexclaw를 깔면, codex 앱의 **질문선택지 UI**(`request_user_input`)가
아무 수동 조작 없이 켜져 있어야 한다. 인터뷰 같은 평범한 상황에서 쓸 수 있으면 되고,
goal(HOTL 자율 실행) 중에는 계속 막혀 있는 게 맞다 — 그건 설계이고 이 유닛의 non-goal이다.

## 직전 유닛의 오조준 정정

`devlog/_plan/260829_config-autopilot/030_interview_default.md`은 **cxc 자신의**
인터뷰 진입 정책(`off|new-unit|always`)을 만들었다. 사용자가 원한 건 그게 아니다.
cxc가 인터뷰를 하겠다고 마음먹는 것과, codex 런타임이 질문선택지 도구를 모델에게
노출하는 것은 다른 층이다. 후자는 순전히 codex `config.toml` 소관이다.
그 유닛의 산출물은 폐기하지 않는다(자문 전용이라 해롭지 않다). 이 유닛이 진짜 층을 다룬다.

## 게이트 구조 (codex-rs 소스 실측)

노출까지 게이트가 둘이고, 둘 다 codex 쪽 키다.

| # | 키 | 소비 지점 | 부재 시 |
|---|---|---|---|
| 1 | `[tools.experimental_request_user_input].enabled` | `core/src/tools/spec_plan.rs:723` 도구 등록 | **true** — `core/src/config/mod.rs:2511` `.is_none_or(|c| c.enabled)` |
| 2 | `features.default_mode_request_user_input` | `tools/src/tool_config.rs:38-46` `request_user_input_available_modes()` | **false** — `features/src/lib.rs:1248-1253` `Stage::UnderDevelopment` |

모드 판정 `protocol/src/config_types.rs:658-660` `allows_request_user_input()`은
`ModeKind::Plan`만 매치한다. 즉 Plan 모드는 원래 허용, **Default 모드는 게이트 2가
켜져야** 목록에 들어간다. 사용자가 평소 쓰는 건 Default이므로 게이트 2가 실질 스위치다.

미허용 모드에서 호출하면 `request_user_input_spec.rs:94-106`이
`"request_user_input is unavailable in {mode} mode"`를 돌려준다.

## 격차 판정 (렌즈 2기 + 실측)

게이트 1은 손댈 필요가 없다. 키가 없으면 이미 true다. 게이트 2는 이미
`DECLARED_FEATURES`(`config-guard/src/features.ts:17`)에 있고 `activate()`가
`codex features enable`을 돌린다(`activate.ts:188`). 실측: 임시 `CODEX_HOME`에서
`codex features enable default_mode_request_user_input` → exit 0, 파일에 기록됨,
under-development 경고만 stderr.

**그래서 진짜 격차는 TOML 키가 아니라 그 코드를 아무도 부르지 않는다는 것이다.**

| 격차 | 근거 | 심각도 |
|---|---|---|
| G1 — 마켓플레이스 설치 경로에 `cxc enable` 진입점이 없다 | `docs-site/.../installation.md:19`는 `codex plugin add`만; `cxc enable`은 소스 체크아웃 트랙(:71)에만 문서화. `plugin.json`에 활성화 훅 없음, 루트 `package.json`에 `postinstall` 없음 | HIGH |
| G2 — 실패가 조용히 삼켜진다 | `features.ts:27` `SOFT_FEATURES`에 이 플래그가 있어 `activate.ts:193`이 계속 진행. `cli.ts:127`은 괄호 한 줄로 보고하고 exit 0 | HIGH |
| G3 — SOFT 소속의 근거가 사실과 다르다 | `features.ts:22-23`은 "under-development라 실패할 수 있다"고 적었지만 `cli/src/main.rs:915`의 `validate_feature`는 stage를 보지 않고 키 존재만 본다. 실측 exit 0 | MEDIUM |
| G4 — 게이트 1을 명시 기록해도 이득이 0이다 | 부재 시 이미 true(`core/src/config/mod.rs:2511` `.is_none_or`, 필드 `#[serde(default = "default_true")]` `config_toml.rs:642-646`) | 기록만 |

**게이트 1은 쓰지 않는다.** 근거는 위험이 아니라 이득 부재다.

### G4 근거 정정 (독립 리뷰 B1)

초고는 `ToolsToml`이 `deny_unknown_fields`라 upstream rename 시 사용자 config가
파싱 불가가 된다고 적었다. **틀렸다.** `config_toml.rs:630`의 속성은
`#[schemars(deny_unknown_fields)]`이고 그건 JSON 스키마 생성 힌트다. serde 역직렬화
규칙이 아니다. 실측: `rg "serde\(deny_unknown_fields\)" config/src/config_toml.rs` → 0건.

미지 키를 실제로 거부하는 경로는 따로 있다 — `config/src/strict_config.rs:87`의
`serde_ignored` 기반 `strict_config`이고, 옵트인이다(`tui/src/lib.rs:2569`와
`cli/src/main.rs` 세 곳에서만 켜지며 app-server는 `false` 기본).

결론은 유지하되 이유를 바꾼다. 게이트 1을 안 쓰는 이유는 **부재가 이미 true라서 얻을 게
없다**는 것 하나다. 없는 위험을 근거로 세우면 그 오독이 저장소 상식으로 굳는다.

## Loop-spec

- Loop archetype: verifier-defined. `npm test` + `cxc doctor`가 done을 정의한다.
- Trigger: 사용자 요청 — "다른 컴퓨터에서도 깔 때 자동으로 켜지게".
- Goal: 새 머신에서 codexclaw를 설치한 뒤 첫 세션에서 Default 모드 `request_user_input`이 사용 가능하고, 켜지지 못했다면 사용자가 그 사실을 안다.
- Non-goals: goal 활성 중 노출(`goal-gate.ts:59,125` fail-closed 보존), 게이트 1 명시 기록, 실제 `~/.codex/config.toml` 이번 사이클 쓰기, `~/.codex/memories` 접근.
- Verifier: `npm test` 전체, `cxc doctor` overall PASS.
- Stop condition: c1~c5 전부 met.
- Write scope: `plugins/codexclaw/components/config-guard/{src,test}`, `plugins/codexclaw/components/cxc-ops/{src,test}`, `plugins/codexclaw/hooks/`, `plugins/codexclaw/.codex-plugin/plugin.json`, `docs-site/src/content/docs/`, 이 플랜 디렉터리.
- Out-of-scope: `devlog/_plan/260829_goalplan-dependency-execution/`(다른 세션 소유), `devlog/_plan/260829_config-autopilot/`(닫힌 선행 유닛, 참조만), dirty 상태인 ast-grep/dev-diagram-viewer/dev-symlink.sh(다른 작업 소유).

## Work-phase map (one phase = one full PABCD cycle)

| WP | Doc | Slice | Depends on |
|----|-----|-------|------------|
| wp1 | 000 (이 문서) | docs-only 로드맵 확정 | — |
| wp2 | 010 | SOFT 침묵 제거 — 게이트 2 실패를 사용자에게 보이게 | wp1 |
| wp3 | 020 | self-heal SessionStart 체크 — 설치 경로와 무관하게 게이트 2를 보장 | wp2 |
| wp4 | 030 | doctor 체크 + 문서 정정 | wp3 |

의존 근거(PHASE-SPLIT-01): wp2가 "실패를 어떻게 표현하는가"를 정하고, wp3가 그 표현을
세션 시작 시점에 재사용하며, wp4가 진단·문서 표면에 노출한다.

## Accept criteria

- c1 — 이 유닛에 000/010/020/030이 diff-level로 존재한다.
- c2 — 게이트 2 enable이 실패하면 `cxc enable`이 눈에 띄게 보고한다. 활성화 시나리오: 페이크 러너가 그 키에만 exit 1을 반환하고, stdout/stderr에 명시적 경고와 복구 방법이 나오는지 대조한다.
- c3 — SessionStart에서 게이트 2가 꺼져 있으면 codexclaw가 스스로 켠다(1회, 멱등). 활성화 시나리오: 임시 `CODEX_HOME`에 플래그 없는 config.toml을 두고 훅을 돌린 뒤 파일과 재실행 무변화를 확인한다.
- c4 — self-heal은 절대 세션을 실패시키지 않고 goal 억제를 건드리지 않는다. 활성화 시나리오: 러너가 throw하도록 주입해도 exit 0이고, `goal-gate` 테스트가 그대로 초록이다.
- c5 — `npm test` 전체 통과 + `cxc doctor` PASS + `~/.codex/memories` md5 불변.

## 위험과 완화

| 위험 | 완화 |
|---|---|
| self-heal이 사용자가 **의도적으로 끈** 플래그를 되켠다 | 매니페스트에 self-heal 이력을 남기고, `cxc disable` 후에는 재시도하지 않는다(옵트아웃 마커). 020에서 상세화 |
| SessionStart마다 `codex features list`를 돌려 느려진다 | 결과를 codexHome에 캐시하고 config.toml mtime으로 무효화. 020에서 상세화 |
| upstream이 키를 rename | `is_known_feature_key` 거부는 exit != 0으로 드러난다. wp2가 그걸 보이게 만드는 게 정확히 이 대비다 |

## 목표 서술 정정 (독립 리뷰 B4)

"아무 수동 조작 없이"는 이 메커니즘으로 도달 불가다. 플러그인 훅은
`hooks/src/engine/discovery.rs:253`에서 `is_managed: false`로 등록되고,
`trusted_hash`가 없으면 `hook_trust_status`가 `Untrusted`를 반환하며(:655-668),
핸들러는 `bypass_hook_trust || matches!(trust_status, Managed | Trusted)`일 때만
실행 집합에 들어간다(:566-571). codexclaw 자신도 이미 이걸 안다 —
`cxc-ops/src/doctor.ts:374`: "A fresh install has NO `[hooks.state.*]` sections at all".

즉 새 머신에서 self-heal 훅은 **사용자가 훅을 승인한 뒤부터** 돈다. 그 승인은 나머지
22개 훅이 이미 요구하는 것과 같은 단일 프롬프트이므로 새로 생기는 부담은 아니지만,
계획이 "설치 경로와 무관하게 반드시 돈다"고 주장하면 거짓이다.

게다가 순서 함정이 있다. 승인이 일어나는 세션이 곧 self-heal이 돌 세션이므로, 플래그는
그 다음 세션부터 유효하다. 설치에서 Default 모드 도구 사용까지 **세션 두 개**가 걸린다.

목표를 이렇게 다시 쓴다: **훅 승인 한 번 뒤에는, 그리고 그 이후 영구히, 수동 조작이 없다.**
정직한 표현은 "install-independent"가 아니라 "훅으로 닿을 수 있는 가장 이른 지점"이다.

`UserPromptSubmit`이나 `Stop`으로 옮기면 승인과 같은 세션에 발화하지만 같은 신뢰 게이트를
공유하므로 의존을 없애지 못하고 타이밍만 당긴다. SessionStart를 유지하고, 사용자에게
두 세션이 걸린다는 사실을 020의 컨텍스트 문장에서 말한다.
