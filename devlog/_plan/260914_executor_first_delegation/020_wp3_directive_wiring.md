# 020 wp3 — 단계 안내 배선 (directive wiring)

P/B 진입 시 구현 담당 소유자를 실제로 가리키게 한다. 훅 경로와 CLI 경로 둘 다 고친다.
같은 턴 안에서 CLI로 단계를 올리면 `UserPromptSubmit` 훅이 다시 돌지 않으므로,
훅만 고치면 그 경로에는 안내가 전달되지 않는다.

## Owner

executor. 수정 파일, 문자열, 검증 방법이 모두 확정돼 있다. main은 반환된 diff를 검토·통합한다.

## Change 1 — `components/pabcd-state/src/hook.ts` P directive

Anchor: `PHASE_DIRECTIVES`(292행)의 `P` 배열(302-307행).

BEFORE:

```ts
  P: [
    "[codexclaw: PLAN]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Load $codexclaw:cxc-pabcd for P and C2+ plan-output; $codexclaw:cxc-dev selects class and relevant surfaces. No implementation yet.",
    "Plan-only ends with the plan. Forbidden checks: NOT RUN; naming an artifact grants no write permission.",
  ].join("\n"),
```

AFTER:

```ts
  P: [
    "[codexclaw: PLAN]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Load $codexclaw:cxc-pabcd for P and C2+ plan-output; $codexclaw:cxc-dev selects class and relevant surfaces. No implementation yet.",
    "Record implementation ownership per planned change: a specified slice defaults to the configured executor, main needs a stated reason ($codexclaw:cxc-dev Implementation delegation).",
    "Plan-only ends with the plan. Forbidden checks: NOT RUN; naming an artifact grants no write permission.",
  ].join("\n"),
```

## Change 2 — `components/pabcd-state/src/hook.ts` B directive

Anchor: 같은 객체의 `B` 배열(314-319행).

BEFORE:

```ts
  B: [
    "[codexclaw: BUILD]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Use $codexclaw:cxc-dev for class/surfaces; authorized PABCD B uses $codexclaw:cxc-pabcd. Implement only authorized scope.",
    "Forbidden checks: NOT RUN; no invented proof.",
  ].join("\n"),
```

AFTER:

```ts
  B: [
    "[codexclaw: BUILD]",
    "Apply this pointer and its owners within exact user limits and permissions. No-delegation means no dispatch.",
    "Use $codexclaw:cxc-dev for class/surfaces; authorized PABCD B uses $codexclaw:cxc-pabcd. Implement only authorized scope.",
    "Execute the plan's recorded implementation ownership; an unassigned slice needs a P amendment, and main verifies a returned diff rather than the report.",
    "Forbidden checks: NOT RUN; no invented proof.",
  ].join("\n"),
```

주의: `phaseDirective("B", opts)`는 base 뒤에 ACTIVE WORK-PHASE 블록을 붙인다(360-371행).
새 줄은 base 안에 들어가므로 bound/unbound 양쪽에서 모두 나타난다.

## Change 3 — `components/pabcd-state/src/orchestrate-cli.ts` 공통 힌트

파일 상단 import 아래, `runOrchestrateCli`(456행) 앞에 상수와 헬퍼를 추가한다.

```ts
/**
 * 260914: the phase directive only reaches a turn through UserPromptSubmit, so a
 * same-turn CLI progression (P -> ... -> B inside one turn) never sees it. Echo a
 * one-line pointer on the two edges whose owner decision is about to be made or
 * executed. Advice only — it changes no gate.
 */
const OWNERSHIP_HINT: Partial<Record<Phase, string>> = {
  P: "implementation ownership: record an owner per planned change (cxc-dev Implementation delegation)",
  B: "implementation ownership: execute the plan's recorded owners; a new handoff needs a P amendment",
};

function withOwnershipHint(phase: Phase, output: string): string {
  const hint = OWNERSHIP_HINT[phase];
  return hint ? `${output} [${hint}]` : output;
}
```

`Phase` 타입이 아직 import 되지 않았다면 `./state.ts`(또는 현재 `Phase`를 export 하는
모듈)에서 타입 import를 추가한다. 새 의존성은 넣지 않는다.

## Change 4 — 전이 성공 출력 두 곳

Anchor A: 1121행 일반 전이 성공 반환.

BEFORE:

```ts
  return { code: 0, output: `orchestrate ${args.verb}: current=${state.phase} -> ${result.state.phase} (${state.phase} → ${result.state.phase}, session ${sessionId})` };
```

AFTER:

```ts
  return { code: 0, output: withOwnershipHint(result.state.phase, `orchestrate ${args.verb}: current=${state.phase} -> ${result.state.phase} (${state.phase} → ${result.state.phase}, session ${sessionId})`) };
```

Anchor B: 656행 I→P 오버라이드 경로.

BEFORE:

```ts
      return { code: 0, output: `orchestrate P: I → P (agent override, session ${sessionId})` };
```

AFTER:

```ts
      return { code: 0, output: withOwnershipHint("P", `orchestrate P: I → P (agent override, session ${sessionId})`) };
```

D 종료 출력(739행)과 `status`/`reset` 출력은 건드리지 않는다.

## Change 5 — 테스트

1. `components/pabcd-state/test/hook.test.ts`의 "wp3: phase pointers retain owners and
   active work-phase boundaries" 테스트(110-122행)에 두 줄을 추가한다.

```ts
  assert.match(phaseDirective("P"), /Record implementation ownership/);
  assert.match(phaseDirective("B"), /recorded implementation ownership/);
```

2. `components/pabcd-state/test/orchestrate-cli.test.ts`에 새 테스트를 추가한다.
   기존 헬퍼(임시 cwd 생성, 세션 준비)를 재사용하고 새 헬퍼를 만들지 않는다.

```ts
test("260914: P and B entry echo the implementation-ownership pointer; other verbs do not", () => {
  // IDLE -> P 출력에 포인터가 있고, A 전이 출력에는 없다.
  // 실제 러너 형태는 이 파일의 기존 테스트를 그대로 따른다.
});
```

   최소 단언: `orchestrate P` 출력이 `/implementation ownership/`에 match,
   `orchestrate A` 출력은 doesNotMatch, `orchestrate B` 출력은 match,
   `orchestrate D`(C→IDLE 종료) 출력도 doesNotMatch.
   I→P 오버라이드 경로(656행 반환)도 별도로 match를 단언한다. 기존 테스트의
   `readyInterview()`, `seedPlanUnit()`, `freshCwd()` 헬퍼를 재사용한다.

3. 기존 테스트 중 전이 출력 문자열을 `assert.equal`로 고정한 곳이 있으면 함께 갱신한다.
   먼저 `rg -n "orchestrate P: current=|orchestrate B: current=|assert.equal\(res.output"`로 찾는다.

RED/GREEN: 새 단언을 먼저 추가해 실패(RED)를 확인한 뒤 소스를 고쳐 통과(GREEN)시킨다.

## Change 6 — 빌드 산출물

`node plugins/codexclaw/scripts/build.mjs`를 돌려 `dist/hook.js`와
`dist/orchestrate-cli.js`를 갱신하고 함께 커밋한다. 설치 payload는 `src`가 아니라
`dist`를 쓰므로 이걸 빼면 격리 검증이 옛 문자열을 본다.
`inventory.json`은 이 빌드가 재생성하지 않는다. 실제로 변하면 그 변경도 함께 커밋한다.

## Accept criteria (wp3)

- `npm test` 0 failures(새 단언 포함), RED 확인 기록.
- `node plugins/codexclaw/scripts/build.mjs` exit 0.
- `dist/hook.js`와 `dist/orchestrate-cli.js`에 새 문자열이 존재(`rg`로 확인).

## Out of scope (wp3)

새 CLI 서브커맨드, 새 훅 이벤트, gate/transition 로직 변경, D/status 출력 변경.
