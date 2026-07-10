# 010 — codex-rs 업스트림 V1/V2 사실표 (Boole/gpt-5.6-sol, 260710)

- Method: 로컬 체크아웃 `/Users/jun/Developer/codex/121_openai-codex/codex-rs` 소스 정독
  (Tier 2 source-open) + GitHub 이슈 웹 확인. 전체 인용은 세션 로그, 여기엔 결정에
  영향을 주는 항목만 요약.

## 스폰 스키마

| 항목 | V1 | V2 |
|---|---|---|
| 툴셋 | `multi_agent_v1.spawn_agent` + send_input/resume_agent/wait_agent/close_agent | `spawn_agent`/send_message/followup_task/wait_agent/interrupt_agent/list_agents |
| 필수 | message XOR items (런타임 검증) | task_name + message |
| 옵션 | items/agent_type/fork_context/model/effort/service_tier | agent_type/fork_turns/model/effort/service_tier — items 없음, deny_unknown_fields |
| 메타 노출 | 항상 노출 | 기본 hide_spawn_agent_metadata=true → model/effort 등 4필드 스키마에서 제거 (config/mod.rs:1175) |
| fork | fork_context=false 기본(초기 프롬프트만) | fork_turns 기본 "all"(전체 히스토리); "none"/정수 문자열만 오버라이드 허용 |
| full-fork 오버라이드 거부 | fork_context=true 시 agent_type/model/effort 거부 | fork_turns 생략/"all" 동일 거부 (multi_agents_v2/spawn.rs:67) |
| 전송 | message → UserInput::Text | message → InterAgentCommunication.encrypted_content (multi_agents_v2.rs:54) |

## ★ 스킬 멘션 주입 (파급 최대)

- V1: bare `$slug`(유일명일 때), `$plugin:slug`, `[$label](skill://path)`, items 스킬
  아이템 전부 주입됨 (injection.rs:396,540,283,138).
- **V2: spawn message에서는 어떤 멘션 형태도 주입되지 않음** — V2는
  `InterAgentCommunication`으로 전달되는데 스킬 수집기는 `TurnInput::UserInput`만
  받는다 (turn.rs:524). full-history fork 시 부모 히스토리에 이미 주입된 스킬
  본문을 "상속"할 수는 있으나 이는 fork 상속이지 멘션 파싱이 아님.
- ⇒ codexclaw 독트린(SEARCH-ATTACH-01 "BOTH the v1 and v2 spawn surfaces",
  spawn-wrapper "message는 v1+v2 공용 채널") 과 정면 모순. **HIGH contradiction.**
  260710 프로브(PROBE-A..G)는 전부 V1 표면에서 수행된 것이라 이 모순을 못 봤다.

## 훅 표면

- PreToolUse updatedInput = 전체 교체, 양쪽 동일 (registry.rs:69,103,118).
- 훅 이름: V1 네임스페이스형과 비네임스페이스 V2는 `spawn_agent`로 정규화 +
  `Agent` alias. 단 **provider가 V2를 `collaboration` 네임스페이스로 감싸면 훅
  이름이 `collaborationspawn_agent`(무구두점 연결)가 되고 alias도 없음**
  (registry.rs:713, hook_names.rs:41) — `^spawn_agent$` 매처가 안 걸릴 수 있는
  경로 존재. MEDIUM risk (현 로컬 기본 경로에선 미발화 조건 미확인).

## 라이프사이클

- wait: V1=대상 지정+최종상태+내용 반환 / V2=무대상 mailbox, 내용 미반환.
- follow-up: V1 send_input(즉시 턴 개시, interrupt 가능)+resume / V2 send_message(큐잉만)
  vs followup_task(idle 턴 개시, evicted 자동 리로드).
- close: V1 close_agent 필요(동시성 카운트) / V2 close 부재, interrupt만.
- 동시성: V1 agents.max_threads 기본 6 / V2 max_concurrent_threads_per_session 기본 4(루트 포함).
  agents.max_threads 검증 에러는 **플래그** v2일 때만; 카탈로그-선정 V2는 우회 후 무시.

## 버전 결정

- features.multi_agent_v2=true → V2, 아니면 multi_agent(기본 on) → V1.
- models.json `multi_agent_version`이 플래그보다 우선: sol/terra=V2 명시, luna=V1 명시,
  gpt-5.5/5.4/5.4-mini/5.2 등은 null(플래그 폴백). 첫 실turn에 OnceLock 고정,
  resume 메타 우선, 메타 없는 구세션은 V1 폴백 (session/mod.rs:3098).
- 자동 위임: V1은 어떤 effort에서도 미주입; V2는 Ultra=Proactive, 그 외 ExplicitRequestOnly.
  multi_agent_mode_hint_text 설정 시(빈 문자열 포함) effort 규칙 오버라이드.

## 최근 7일 업스트림 변화

- 3380969a (07-09): gpt-5.6 3종 추가(sol/terra=V2, luna=V1). b7807380 (07-08): gpt-5.3-codex 제거.
- 058d97c5/1bd9d841/6b488252 (07-07): collab begin/end 이벤트 → canonical turn items
  (툴 인자/대기 의미론 불변).
- 이슈 #26753(encrypted spawn 400): NOT_PLANNED 종결. #31097(카탈로그 우선순위): open.
