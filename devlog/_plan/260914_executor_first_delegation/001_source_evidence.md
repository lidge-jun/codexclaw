# 001 source evidence

읽은 지점과 사실만 기록한다. 판단은 000/decade 문서가 소유한다.

## 지금 존재하는 것

- `plugins/codexclaw/skills/dev/SKILL.md:167` `### Discovery delegation` — 탐색 위임 기준의 소유자.
  같은 절 `:201`은 "Discovery does not replace implementation delegation or independent review."라고
  말하지만, 그 implementation delegation 기준을 정의하는 절은 이 파일에 없다.
- `structure/20_pabcd_dispatch_doctrine.md:196` DISPATCH-ECONOMY-01 — 3축 위임 가능성 판정,
  `:227` *Model routing* — 정형화된 구현 슬라이스는 기본적으로 싸고 빠른 모델 계열로 보낸다.
  `:200`은 탐색 소유권을 dev의 Discovery delegation에 위임한다. 구현 담당에 대한 같은 포인터는 없다.
- `plugins/codexclaw/skills/pabcd/references/delegation.md:73` — "For implementation dispatch,
  prefer `executor` when exposed by the live schema." 전송 방법은 정의돼 있다.
- `plugins/codexclaw/skills/pabcd/references/plan-output.md:8` 9필드 loop-spec 표 — 담당 필드 없음.
  `:18` Escalation condition — "pushing a slice to a worker requires a P-phase amendment,
  never a mid-B improvisation." 즉 B 중간 위임은 이미 금지돼 있는데, P에서 담당을 정하라는 요구가 없다.
- `plugins/codexclaw/skills/pabcd/SKILL.md:83` B 항목 — 구현·검증·범위 이탈만 말하고 담당은 말하지 않는다.
- `plugins/codexclaw/components/pabcd-state/src/hook.ts:292` `PHASE_DIRECTIVES`,
  `:302` P, `:314` B, `:360` `phaseDirective()` — 주입 문자열의 단일 소유 지점.
- `plugins/codexclaw/components/pabcd-state/src/orchestrate-cli.ts:1121` — 전이 성공 출력은
  `orchestrate <verb>: current=X -> Y (...)` 한 줄이며 단계 안내를 담지 않는다.
  `:656`은 I→P 오버라이드 경로의 별도 성공 출력이다.

## 현재 설정 (확인 시점 2026-09-14)

`readSettings()` 해석 결과 `/home/jun/code/codexclaw`, `/home/jun/code/opencodex`,
`/home/jun/code/quota-monitor` 모두 executor = `devin/swe-2` / `high`,
fallback = `combo/grok-4.6` / `xhigh`, source=global. `$CODEX_HOME/agents/executor.toml` 존재.
이는 설정 해석 결과이며, 실제 서비스 모델이나 비용 절감의 증거가 아니다.

## 관측된 행동 (원인 아님)

연결된 작업 `01a09ed3-c8ea-77c1-9e29-bbda8fc4d299`에서 생성된 서브에이전트는 리뷰어 8개,
탐색·구현 0개였다. 같은 세션이 dev/SKILL.md의 Discovery delegation 본문을 실제로 읽었으므로
"지침이 전달되지 않았다"는 설명은 성립하지 않는다. 단일 사례이므로 모델 일반 성향의 증거로 쓰지 않는다.
